"""
Trust Score & Dispute Resolution API Endpoints
PUBLIC: Trust score viewing, dispute filing, checkpoint verification
ADMIN: Dispute resolution, guarantee processing
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId

from app.core.security import get_current_user, get_current_admin
from app.db.connection import get_database
from app.models.database import User
from app.models.trust import (
    AcharyaTrustScore,
    Dispute,
    RefundRequest,
    AttendanceCheckpoint,
    DisputeStatus,
    DisputeResolutionAction,
)
from app.services.trust_service import TrustScoreService
from app.services.audit_service import AuditService
from app.core.exceptions import ResourceNotFoundError, ValidationError
from pydantic import BaseModel, Field


router = APIRouter(prefix="/trust", tags=["Trust & Verification"])

_DISPUTE_NOT_FOUND = "Dispute not found"


# ==================== REQUEST/RESPONSE SCHEMAS ====================


class TrustScoreResponse(BaseModel):
    """Public trust score display"""
    acharya_id: str
    composite_score: float = Field(ge=0.0, le=100.0)
    verification_badge: str  # "BASIC", "SAVITARA_VERIFIED", "PREMIUM_VERIFIED"
    is_verified_provider: bool
    
    # Component Breakdown
    verification_score: float
    completion_score: float
    response_time_score: float
    rebooking_score: float
    review_quality_score: float
    
    # Stats
    total_guarantees_honored: int
    total_disputes_resolved: int
    last_updated: datetime


class CheckpointRequest(BaseModel):
    """Check-in/Check-out OTP request"""
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class CheckpointVerifyRequest(BaseModel):
    """OTP verification"""
    otp_code: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class DisputeFileRequest(BaseModel):
    """File a dispute"""
    booking_id: str
    category: str  # "SERVICE_QUALITY", "PAYMENT", "CANCELLATION", "HARASSMENT", "OTHER"
    description: str = Field(min_length=20, max_length=2000)


class DisputeEvidenceRequest(BaseModel):
    """Submit evidence for dispute"""
    evidence_urls: List[str]
    description: Optional[str] = None


class DisputeResolveRequest(BaseModel):
    """Admin dispute resolution"""
    resolution: str
    compensation_amount: Optional[float] = None
    resolution_notes: str


class ServiceGuaranteeClaimRequest(BaseModel):
    """Claim service guarantee"""
    guarantee_type: str  # "QUALITY_GUARANTEE", "TIME_GUARANTEE", "CANCELLATION_PROTECTION"
    claim_reason: str = Field(min_length=20, max_length=1000)


# ==================== PUBLIC ENDPOINTS ====================


@router.get("/acharyas/{acharya_id}/trust-score", response_model=TrustScoreResponse)
async def get_acharya_trust_score(
    acharya_id: str,
    db=Depends(get_database),
):
    """
    Get public trust score for an Acharya
    
    Available to: Everyone (public)
    Use case: Display on Acharya profile, search results
    
    Returns:
        Composite trust score (0-100) with component breakdown
    """
    try:
        # Calculate fresh trust score
        trust_score = await TrustScoreService.calculate_acharya_trust_score(db, acharya_id)
        
        return TrustScoreResponse(
            acharya_id=trust_score.acharya_id,
            composite_score=trust_score.trust_score.calculate_composite(),
            verification_badge=trust_score.verification_badge,
            is_verified_provider=trust_score.is_verified_provider,
            verification_score=trust_score.trust_score.verification_level,
            completion_score=trust_score.trust_score.completion_rate,
            response_time_score=trust_score.trust_score.response_time_score,
            rebooking_score=trust_score.trust_score.rebooking_rate,
            review_quality_score=trust_score.trust_score.review_quality_score,
            total_guarantees_honored=trust_score.total_guarantees_honored,
            total_disputes_resolved=trust_score.total_disputes_resolved,
            last_updated=trust_score.last_score_update
        )
    
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate trust score: {str(e)}")


@router.post("/bookings/{booking_id}/checkpoints/check-in")
async def create_check_in_checkpoint(
    booking_id: str,
    current_user: User = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Generate OTP for Acharya check-in
    
    Flow:
    1. Acharya arrives at location
    2. Acharya requests OTP (this endpoint)
    3. System generates 6-digit OTP
    4. Grihasta receives OTP via SMS
    5. Acharya enters OTP to verify arrival
    
    Available to: Acharya only
    """
    if current_user.role != "acharya":
        raise HTTPException(status_code=403, detail="Only Acharyas can check-in")
    
    # Verify booking belongs to this Acharya
    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if str(booking["acharya_id"]) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your booking")
    
    # Generate OTP
    checkpoint = await TrustScoreService.generate_booking_checkpoint_otp(
        db, booking_id, "CHECK_IN"
    )
    
    # Audit log
    audit = AuditService(db)
    await audit.log_action(
        user_id=str(current_user.id),
        action="BOOKING_CHECK_IN_REQUESTED",
        resource_type="booking",
        resource_id=booking_id,
        details={"checkpoint_id": checkpoint.id}
    )
    
    return {
        "message": "Check-in OTP sent to Grihasta",
        "checkpoint_id": checkpoint.id,
        "expires_at": checkpoint.otp_expires_at
    }


@router.post("/bookings/{booking_id}/checkpoints/{checkpoint_id}/verify")
async def verify_checkpoint(
    booking_id: str,
    checkpoint_id: str,
    request: CheckpointVerifyRequest,
    current_user: User = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Verify check-in/check-out OTP
    
    Flow:
    1. Grihasta provides OTP to Acharya
    2. Acharya enters OTP (this endpoint)
    3. System verifies OTP + location
    4. Booking status updated
    
    Available to: Acharya only
    """
    if current_user.role != "acharya":
        raise HTTPException(status_code=403, detail="Only Acharyas can verify checkpoints")
    
    try:
        location_coords = None
        if request.latitude and request.longitude:
            location_coords = {
                "latitude": request.latitude,
                "longitude": request.longitude
            }
        
        checkpoint = await TrustScoreService.verify_checkpoint_otp(
            db, checkpoint_id, request.otp_code, location_coords
        )
        
        # Update booking status if check-in successful
        if checkpoint.checkpoint_type == "CHECK_IN" and checkpoint.verified_at:
            await db.bookings.update_one(
                {"_id": ObjectId(booking_id)},
                {"$set": {"status": "in_progress", "started_at": datetime.now(timezone.utc)}}
            )
        
        # Audit log
        audit = AuditService(db)
        await audit.log_action(
            user_id=str(current_user.id),
            action="BOOKING_CHECKPOINT_VERIFIED",
            resource_type="booking",
            resource_id=booking_id,
            details={
                "checkpoint_type": checkpoint.checkpoint_type,
                "location_verified": checkpoint.location_verified,
                "distance_m": checkpoint.distance_from_booking_location_m
            }
        )
        
        return {
            "message": "Checkpoint verified successfully",
            "checkpoint_type": checkpoint.checkpoint_type,
            "location_verified": checkpoint.location_verified,
            "distance_from_booking_m": checkpoint.distance_from_booking_location_m
        }
    
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/disputes", response_model=Dict[str, Any])
async def file_dispute(
    request: DisputeFileRequest,
    current_user: User = Depends(get_current_user),
    db=Depends(get_database),
    http_request: Request = None,
):
    """
    File a dispute for a booking
    
    Categories:
    - SERVICE_QUALITY: Poor service, expectations not met
    - PAYMENT: Payment issues, overcharging
    - CANCELLATION: Unfair cancellation
    - HARASSMENT: Inappropriate behavior
    - OTHER: Other issues
    
    Available to: Grihasta or Acharya involved in booking
    """
    # Verify booking exists and user is involved
    booking = await db.bookings.find_one({"_id": ObjectId(request.booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    user_is_grihasta = str(booking["user_id"]) == str(current_user.id)
    user_is_acharya = str(booking["acharya_id"]) == str(current_user.id)
    
    if not (user_is_grihasta or user_is_acharya):
        raise HTTPException(status_code=403, detail="You are not involved in this booking")
    
    # File dispute
    dispute = await TrustScoreService.file_dispute(
        db=db,
        booking_id=request.booking_id,
        filed_by_id=str(current_user.id),
        filed_by_role=current_user.role,
        category=request.category,
        description=request.description
    )
    
    # Audit log
    audit = AuditService(db)
    await audit.log_action(
        user_id=str(current_user.id),
        action="DISPUTE_FILED",
        resource_type="dispute",
        resource_id=dispute.id,
        details={
            "booking_id": request.booking_id,
            "category": request.category
        },
        ip_address=http_request.client.host if http_request else None,
        user_agent=http_request.headers.get("user-agent") if http_request else None
    )
    
    return {
        "message": "Dispute filed successfully",
        "dispute_id": dispute.id,
        "status": dispute.status,
        "filed_at": dispute.filed_at
    }


@router.get("/disputes/{dispute_id}")
async def get_dispute_status(
    dispute_id: str,
    current_user: User = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Get dispute status and details
    
    Available to: User involved in dispute or admin
    """
    dispute = await db.dispute_resolutions.find_one({"_id": ObjectId(dispute_id)})
    if not dispute:
        raise HTTPException(status_code=404, detail=_DISPUTE_NOT_FOUND)
    
    # Check authorization
    is_involved = (
        str(dispute["filed_by_id"]) == str(current_user.id) or
        str(dispute["respondent_id"]) == str(current_user.id)
    )
    is_admin = current_user.role == "admin"
    
    if not (is_involved or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized to view this dispute")
    
    # Convert ObjectId to string
    dispute["_id"] = str(dispute["_id"])
    
    return dispute


@router.post("/disputes/{dispute_id}/evidence")
async def submit_dispute_evidence(
    dispute_id: str,
    request: DisputeEvidenceRequest,
    current_user: User = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Submit evidence (photos, documents) for a dispute
    
    Available to: User involved in dispute
    """
    dispute = await db.dispute_resolutions.find_one({"_id": ObjectId(dispute_id)})
    if not dispute:
        raise HTTPException(status_code=404, detail=_DISPUTE_NOT_FOUND)
    
    # Check authorization
    is_involved = (
        str(dispute["filed_by_id"]) == str(current_user.id) or
        str(dispute["respondent_id"]) == str(current_user.id)
    )
    
    if not is_involved:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Add evidence
    existing_evidence = dispute.get("evidence_submitted", [])
    existing_evidence.extend(request.evidence_urls)
    
    await db.dispute_resolutions.update_one(
        {"_id": ObjectId(dispute_id)},
        {
            "$set": {
                "evidence_submitted": existing_evidence,
                "status": "EVIDENCE_COLLECTION"
            }
        }
    )
    
    # Audit log
    audit = AuditService(db)
    await audit.log_action(
        user_id=str(current_user.id),
        action="DISPUTE_EVIDENCE_SUBMITTED",
        resource_type="dispute",
        resource_id=dispute_id,
        details={"evidence_count": len(request.evidence_urls)}
    )
    
    return {
        "message": "Evidence submitted successfully",
        "total_evidence": len(existing_evidence)
    }


@router.post("/guarantees/claim")
async def claim_service_guarantee(
    request: ServiceGuaranteeClaimRequest,
    current_user: User = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Claim service guarantee for auto-refund
    
    Types:
    - QUALITY_GUARANTEE: Service not satisfactory (50% refund)
    - TIME_GUARANTEE: Acharya late/no-show (100% refund)
    - CANCELLATION_PROTECTION: Last-minute Acharya cancellation (100% refund)
    
    Available to: Grihasta only
    Must claim within 48 hours of booking completion
    """
    if current_user.role != "grihasta":
        raise HTTPException(status_code=403, detail="Only Grihastas can claim guarantees")
    
    try:
        guarantee = await TrustScoreService.process_service_guarantee(
            db=db,
            booking_id=request.booking_id,
            guarantee_type=request.guarantee_type,
            claim_reason=request.claim_reason
        )
        
        # Audit log
        audit = AuditService(db)
        await audit.log_action(
            user_id=str(current_user.id),
            action="SERVICE_GUARANTEE_CLAIMED",
            resource_type="guarantee",
            resource_id=guarantee.id,
            details={
                "booking_id": request.booking_id,
                "guarantee_type": request.guarantee_type,
                "refund_percentage": guarantee.refund_percentage
            }
        )
        
        return {
            "message": "Service guarantee claim submitted",
            "guarantee_id": guarantee.id,
            "refund_percentage": guarantee.refund_percentage,
            "status": guarantee.status
        }
    
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ==================== ADMIN ENDPOINTS ====================


import logging as _log  # noqa: E402

_logger = _log.getLogger(__name__)


async def _trigger_dispute_refund(db, dispute: dict, dispute_id: str, compensation_pct: float) -> None:
    """Initiate a Razorpay refund for an awarded compensation percentage."""
    booking_id = dispute.get("booking_id")
    if not booking_id:
        return
    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not (booking and booking.get("razorpay_payment_id")):
        return
    from app.services.payment_service import RazorpayService  # noqa: PLC0415
    total = float(booking.get("total_amount") or booking.get("total_price") or 0)
    refund_amt = round(total * compensation_pct / 100, 2)
    RazorpayService().initiate_refund(
        payment_id=booking["razorpay_payment_id"],
        amount=refund_amt,
        notes={"reason": "Dispute resolution", "dispute_id": dispute_id},
    )


async def _notify_dispute_parties(db, dispute: dict, dispute_id: str) -> None:
    """Push a resolution notification to complainant and respondent."""
    from app.services.notification_service import NotificationService  # noqa: PLC0415
    ns = NotificationService()
    for id_key in ("complainant_id", "respondent_id"):
        uid = dispute.get(id_key, "")
        if uid and ObjectId.is_valid(str(uid)):
            party = await db.users.find_one({"_id": ObjectId(str(uid))})
            if party and party.get("fcm_token"):
                ns.send_notification(
                    token=party["fcm_token"],
                    title="Dispute Resolved",
                    body="Your dispute has been reviewed and resolved by our team.",
                    data={"type": "dispute_resolved", "dispute_id": dispute_id},
                )


@router.post("/admin/disputes/{dispute_id}/resolve")
async def resolve_dispute(
    dispute_id: str,
    request: DisputeResolveRequest,
    current_user: User = Depends(get_current_admin),
    db=Depends(get_database),
):
    """
    Admin: Resolve a dispute
    
    Resolution options:
    - RESOLVED_IN_FAVOR_OF_GRIHASTA
    - RESOLVED_IN_FAVOR_OF_ACHARYA
    - RESOLVED_MUTUAL_AGREEMENT
    - RESOLVED_NO_FAULT
    
    Available to: Admin only
    """
    dispute = await db.dispute_resolutions.find_one({"_id": ObjectId(dispute_id)})
    if not dispute:
        raise HTTPException(status_code=404, detail=_DISPUTE_NOT_FOUND)
    
    # Update dispute
    await db.dispute_resolutions.update_one(
        {"_id": ObjectId(dispute_id)},
        {
            "$set": {
                "status": request.resolution,
                "resolution_notes": request.resolution_notes,
                "compensation_amount": request.compensation_amount,
                "resolved_at": datetime.now(timezone.utc),
                "resolved_by_admin_id": str(current_user.id)
            }
        }
    )
    
    # Audit log
    audit = AuditService(db)
    await audit.log_action(
        user_id=str(current_user.id),
        action="DISPUTE_RESOLVED",
        resource_type="dispute",
        resource_id=dispute_id,
        details={
            "resolution": request.resolution,
            "compensation_amount": request.compensation_amount
        }
    )
    
    # Trigger Razorpay refund if compensation percentage awarded
    if request.compensation_amount and request.compensation_amount > 0:
        try:
            await _trigger_dispute_refund(db, dispute, dispute_id, request.compensation_amount)
        except Exception as exc:  # noqa: BLE001
            _logger.warning("Dispute refund failed for %s: %s", dispute_id, exc)

    # Notify both parties about the resolution
    try:
        await _notify_dispute_parties(db, dispute, dispute_id)
    except Exception:  # noqa: BLE001
        pass

    return {
        "message": "Dispute resolved successfully",
        "dispute_id": dispute_id,
        "resolution": request.resolution
    }


@router.post("/admin/guarantees/{guarantee_id}/approve")
async def approve_service_guarantee(
    guarantee_id: str,
    current_user: User = Depends(get_current_admin),
    db=Depends(get_database),
):
    """
    Admin: Approve service guarantee claim
    
    Triggers auto-refund to Grihasta
    
    Available to: Admin only
    """
    guarantee = await db.service_guarantees.find_one({"_id": ObjectId(guarantee_id)})
    if not guarantee:
        raise HTTPException(status_code=404, detail="Service guarantee not found")
    
    # Update guarantee
    await db.service_guarantees.update_one(
        {"_id": ObjectId(guarantee_id)},
        {
            "$set": {
                "status": "APPROVED",
                "approved_by_admin_id": str(current_user.id),
                "approved_at": datetime.now(timezone.utc),
                "auto_refund_initiated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Trigger Razorpay refund for the approved guarantee claim
    try:
        _guar_booking = await db.bookings.find_one({"_id": ObjectId(guarantee["booking_id"])})
        if _guar_booking and _guar_booking.get("razorpay_payment_id"):
            from app.services.payment_service import RazorpayService  # noqa: PLC0415
            _total = float(
                _guar_booking.get("total_amount") or _guar_booking.get("total_price") or 0
            )
            _refund_pct = float(guarantee.get("refund_percentage", 100))
            _refund_amt = round(_total * _refund_pct / 100, 2)
            RazorpayService().initiate_refund(
                payment_id=_guar_booking["razorpay_payment_id"],
                amount=_refund_amt,
                notes={"reason": "Service guarantee claim", "guarantee_id": guarantee_id},
            )
            await db.service_guarantees.update_one(
                {"_id": ObjectId(guarantee_id)},
                {"$set": {"razorpay_refund_initiated": True}},
            )
    except Exception as _g_exc:  # noqa: BLE001
        import logging as _logging  # noqa: PLC0415
        _logging.getLogger(__name__).warning(
            "Guarantee refund failed for %s: %s", guarantee_id, _g_exc
        )

    # Audit log
    audit = AuditService(db)
    await audit.log_action(
        user_id=str(current_user.id),
        action="SERVICE_GUARANTEE_APPROVED",
        resource_type="guarantee",
        resource_id=guarantee_id,
        details={
            "booking_id": guarantee["booking_id"],
            "refund_percentage": guarantee["refund_percentage"]
        }
    )
    
    return {
        "message": "Service guarantee approved",
        "guarantee_id": guarantee_id,
        "refund_initiated": True
    }


@router.get("/admin/disputes/stats")
async def get_disputes_stats(
    current_user: User = Depends(get_current_admin),
    db=Depends(get_database),
):
    """
    Admin: Get dispute statistics summary

    Available to: Admin only
    """
    total = await db.dispute_resolutions.count_documents({})
    mediation = await db.dispute_resolutions.count_documents({"status": "mediation"})
    under_review = await db.dispute_resolutions.count_documents({"status": "under_review"})
    resolved = await db.dispute_resolutions.count_documents({
        "status": {"$in": ["resolved_refund", "resolved_no_refund", "resolved_partial_refund"]}
    })
    closed = await db.dispute_resolutions.count_documents({"status": "closed"})

    # Average resolution time in days (for resolved disputes)
    pipeline = [
        {"$match": {"resolved_at": {"$exists": True, "$ne": None}}},
        {"$project": {
            "resolution_days": {
                "$divide": [
                    {"$subtract": ["$resolved_at", "$created_at"]},
                    86400000,
                ]
            }
        }},
        {"$group": {"_id": None, "avg_days": {"$avg": "$resolution_days"}}},
    ]
    result = await db.dispute_resolutions.aggregate(pipeline).to_list(1)
    avg_resolution_days = round(result[0]["avg_days"], 1) if result else 0

    return {
        "total": total,
        "mediation": mediation,
        "under_review": under_review,
        "arbitration": under_review,  # alias used by some admin views
        "resolved": resolved,
        "closed": closed,
        "avg_resolution_days": avg_resolution_days,
    }


@router.get("/admin/disputes")
async def get_all_disputes(
    status: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    current_user: User = Depends(get_current_admin),
    db=Depends(get_database),
):
    """
    Admin: Get all disputes with filtering
    
    Available to: Admin only
    """
    query = {}
    
    if status:
        # 'resolved' is a logical grouping — expand to all resolved variants
        if status == "resolved":
            query["status"] = {"$in": ["resolved_refund", "resolved_no_refund", "resolved_partial_refund"]}
        else:
            query["status"] = status

    if category:
        query["dispute_type"] = category

    cursor = db.dispute_resolutions.find(query).sort("created_at", -1).skip(skip).limit(limit)
    disputes = await cursor.to_list(length=limit)
    
    # Convert ObjectId to string
    for dispute in disputes:
        dispute["_id"] = str(dispute["_id"])
    
    total_count = await db.dispute_resolutions.count_documents(query)
    
    return {
        "disputes": disputes,
        "total": total_count,
        "limit": limit,
        "skip": skip
    }
