"""
Strategy Features API Endpoints
Implements features from SAVITARA_STRATEGY_REPORT.md:
- Scarcity display (§6.5)
- Booking checklist (§8.1 Stage 4)
- No-show penalty management (§10.1)
- Backup Acharya reassignment (§10.1)
- Money-back guarantee (§7.8)
- Bundle booking (§6.7)
- Subscription "Devotee Plus" (§6.9)
"""
from datetime import datetime, timezone, timedelta
from typing import Annotated, Dict, Any, Optional, List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.core.exceptions import (
    InvalidInputError,
    ResourceNotFoundError,
    InsufficientPermissionsError,
)
from app.core.security import get_current_user
from app.core.config import settings
from app.db.connection import get_db
from app.schemas.requests import StandardResponse, BookingCreateRequest, Location
from app.services.penalty_service import PenaltyService
from app.services.backup_acharya_service import BackupAcharyaService
from app.services.booking_discovery_service import BookingDiscoveryService
from app.services.guarantee_service import GuaranteeService
from app.services.pricing_service import PricingService

import logging

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Strategy Features"])

# ============= Constants =============
MATCH_OP = "$match"
BOOKING_NOT_FOUND_MESSAGE = "Booking not found"
NOT_A_PARTICIPANT_MESSAGE = "Not a participant in this booking"


def _get_scarcity_level(count: int) -> str:
    """Return scarcity level string based on count."""
    if count <= 3:
        return "high"
    if count <= 10:
        return "medium"
    return "low"


# ============= Schemas =============


class ScarcityQuery(BaseModel):
    """Query params for scarcity display"""
    date: str = Field(..., description="Date YYYY-MM-DD")
    city: str = Field(..., description="City name")
    specialization: Optional[str] = None


class BundleBookingRequest(BaseModel):
    """Bundle booking — multiple poojas at once for discount"""
    acharya_id: str
    pooja_ids: List[str] = Field(..., min_length=2, max_length=10)
    date: str = Field(..., description="Date YYYY-MM-DD")
    time: str = Field(..., description="Time HH:MM")
    location: Optional[Location] = None
    notes: Optional[str] = Field(None, max_length=500)


class SubscriptionCreateRequest(BaseModel):
    """Create Devotee Plus subscription"""
    plan: str = Field(..., pattern="^(monthly|quarterly|annual)$")


class PenaltyReverseRequest(BaseModel):
    """Admin request to reverse a penalty"""
    reason: str = Field(..., min_length=5, max_length=500)


class BundleRecommendationQuery(BaseModel):
    """Bundle recommendation request payload."""

    pooja_ids: List[str] = Field(default_factory=list, max_length=5)
    limit: int = Field(3, ge=1, le=5)


class WaitlistRequest(BaseModel):
    """Waitlist join request for auto-match when the primary slot is unavailable."""

    acharya_id: str
    desired_datetime: datetime
    duration_hours: int = Field(2, ge=1, le=12)
    pooja_id: Optional[str] = None
    service_name: Optional[str] = Field(None, max_length=120)
    location: Optional[Location] = None


class ChecklistReminderRequest(BaseModel):
    """Schedule preparation checklist reminders for a booking."""

    remind_before_minutes: int = Field(180, ge=15, le=10080)
    channels: List[str] = Field(default_factory=lambda: ["in_app", "push"])


class LiteFlowDeferRequest(BaseModel):
    """Defer completion when the user opts into lite flow."""

    reason: str = Field(..., min_length=3, max_length=300)
    defer_minutes: Optional[int] = Field(None, ge=5, le=2880)
    checklist_pending: List[str] = Field(default_factory=list, max_length=20)


def _current_user_id(current_user: Dict[str, Any]) -> str:
    """Support both `id` and legacy `user_id` auth payload shapes."""
    return str(current_user.get("id") or current_user.get("user_id") or "")


def _normalize_reminder_channels(channels: List[str]) -> List[str]:
    allowed = {"in_app", "push", "email", "sms"}
    normalized = []
    for channel in channels:
        candidate = str(channel).strip().lower()
        if candidate in allowed and candidate not in normalized:
            normalized.append(candidate)
    return normalized or ["in_app", "push"]


# ============= Scarcity Display API (Strategy Report §6.5) =============


@router.get(
    "/availability/count",
    response_model=StandardResponse,
    summary="Scarcity Display — Available Acharyas",
    description="Returns count of available Acharyas for a date/city, powering 'Only X Acharyas available' UX",
)
async def get_availability_count(
    date: Annotated[str, Query(..., description="Date in YYYY-MM-DD format")],
    city: Annotated[str, Query(..., description="City name")],
    specialization: Annotated[Optional[str], Query(description="Filter by specialization")] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Strategy Report §6.5 — Scarcity display to drive urgency"""
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise InvalidInputError(message="Invalid date format. Use YYYY-MM-DD", field="date")

    match_filter: Dict[str, Any] = {
        "location.city": {"$regex": f"^{city}$", "$options": "i"},
        "is_available": True,
    }
    if specialization:
        match_filter["specializations"] = specialization

    # Count available Acharyas in the city
    pipeline = [
        {MATCH_OP: match_filter},
        {
            "$lookup": {
                "from": "users",
                "let": {"uid": {"$toObjectId": "$user_id"}},
                "pipeline": [
                    {MATCH_OP: {"$expr": {"$eq": ["$_id", "$$uid"]}}},
                    {MATCH_OP: {"status": {"$in": ["active", "verified"]}}},
                ],
                "as": "user",
            }
        },
        {MATCH_OP: {"user": {"$ne": []}}},
        {"$count": "total"},
    ]

    result = await db.acharya_profiles.aggregate(pipeline).to_list(length=1)
    count = result[0]["total"] if result else 0

    # Generate scarcity message
    if count == 0:
        message = f"No Acharyas available in {city} for this date"
    elif count <= 3:
        message = f"Only {count} Acharya{'s' if count > 1 else ''} available — book now!"
    elif count <= 10:
        message = f"{count} Acharyas available in {city}"
    else:
        message = f"{count}+ Acharyas available in {city}"

    return StandardResponse(
        success=True,
        data={
            "available_count": count,
            "city": city,
            "date": date,
            "specialization": specialization,
            "scarcity_level": _get_scarcity_level(count),
            "message": message,
        },
    )


# ============= Booking Checklist API (Strategy Report §8.1 Stage 4) =============


def _build_service_checklist(service: dict) -> List[Dict[str, str]]:
    """Extract checklist items from service requirements."""
    items: List[Dict[str, str]] = []
    for req in service.get("requirements", []):
        items.append({"item": req, "category": "requirement", "provided_by": "customer"})
    for item in service.get("customer_provides", []):
        items.append({"item": item, "category": "customer_provides", "provided_by": "customer"})
    for item in service.get("acharya_provides", []):
        items.append({"item": item, "category": "acharya_provides", "provided_by": "acharya"})
    return items


def _build_standard_checklist(booking: dict) -> List[Dict[str, str]]:
    """Build standard preparation checklist items."""
    items = [
        {"item": "Clean and prepare the pooja area", "category": "preparation", "provided_by": "customer"},
        {"item": "Keep fresh flowers and water ready", "category": "preparation", "provided_by": "customer"},
        {"item": "Ensure quiet environment during the ritual", "category": "preparation", "provided_by": "customer"},
    ]
    if booking.get("booking_type") == "with_samagri":
        items.append({"item": "Samagri will be provided by the Acharya", "category": "samagri", "provided_by": "acharya"})
    else:
        items.append({"item": "Arrange samagri (pooja materials) as per requirements", "category": "samagri", "provided_by": "customer"})
    return items


def _format_booking_date(booking: dict) -> str:
    """Format booking date_time field to string."""
    dt = booking.get("date_time", "")
    if isinstance(dt, datetime):
        return dt.isoformat()
    return str(dt)


@router.get(
    "/bookings/{booking_id}/checklist",
    response_model=StandardResponse,
    summary="What to Prepare — Auto-generated Checklist",
    description="Returns auto-generated checklist of items to prepare before a booking",
)
async def get_booking_checklist(
    booking_id: str,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Strategy Report §8.1 Stage 4 — Auto-generated preparation checklist"""
    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise ResourceNotFoundError(message=BOOKING_NOT_FOUND_MESSAGE, resource_id=booking_id)

    # Verify user is participant
    user_id = _current_user_id(current_user)
    if user_id not in [booking.get("grihasta_id"), booking.get("acharya_id")]:
        raise InsufficientPermissionsError(message=NOT_A_PARTICIPANT_MESSAGE)

    # Get service/pooja details
    service = None
    if booking.get("pooja_id"):
        service = await db.services.find_one({"_id": ObjectId(booking["pooja_id"])})
    elif booking.get("service_name"):
        service = await db.services.find_one({"name": booking["service_name"]})

    checklist_items = _build_service_checklist(service) if service else []
    checklist_items.extend(_build_standard_checklist(booking))

    service_name = booking.get("service_name") or (service.get("name") if service else "Custom Pooja")

    return StandardResponse(
        success=True,
        data={
            "booking_id": booking_id,
            "service_name": service_name,
            "date": _format_booking_date(booking),
            "checklist": checklist_items,
            "total_items": len(checklist_items),
        },
    )


@router.post(
    "/bookings/{booking_id}/checklist/reminders",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Schedule checklist reminder",
    description="Schedules a pre-booking checklist reminder that the worker can deliver over selected channels.",
)
async def schedule_booking_checklist_reminder(
    booking_id: str,
    request: ChecklistReminderRequest,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise ResourceNotFoundError(message=BOOKING_NOT_FOUND_MESSAGE, resource_id=booking_id)

    user_id = _current_user_id(current_user)
    participant_ids = {str(booking.get("grihasta_id")), str(booking.get("acharya_id"))}
    if user_id not in participant_ids and current_user.get("role") != "admin":
        raise InsufficientPermissionsError(message=NOT_A_PARTICIPANT_MESSAGE)

    booking_start = booking.get("date_time")
    if not isinstance(booking_start, datetime):
        raise InvalidInputError(
            message="Booking start time unavailable for reminder scheduling",
            field="booking_id",
        )
    if booking_start.tzinfo is None:
        booking_start = booking_start.replace(tzinfo=timezone.utc)
    else:
        booking_start = booking_start.astimezone(timezone.utc)

    remind_at = booking_start - timedelta(minutes=request.remind_before_minutes)
    now = datetime.now(timezone.utc)
    if remind_at <= now:
        raise InvalidInputError(
            message="Reminder window has already passed for this booking",
            field="remind_before_minutes",
        )

    channels = _normalize_reminder_channels(request.channels)
    reminder_doc = {
        "booking_id": booking_id,
        "user_id": user_id,
        "remind_before_minutes": request.remind_before_minutes,
        "channels": channels,
        "booking_start_at": booking_start,
        "remind_at": remind_at,
        "status": "scheduled",
        "created_at": now,
        "updated_at": now,
    }

    await db.booking_checklist_reminders.update_one(
        {
            "booking_id": booking_id,
            "user_id": user_id,
            "remind_before_minutes": request.remind_before_minutes,
            "status": {"$in": ["scheduled", "queued"]},
        },
        {"$set": reminder_doc},
        upsert=True,
    )

    await db.bookings.update_one(
        {"_id": booking["_id"]},
        {
            "$addToSet": {"checklist_reminder_schedule_minutes": request.remind_before_minutes},
            "$set": {"updated_at": now},
        },
    )

    return StandardResponse(
        success=True,
        data={
            "booking_id": booking_id,
            "user_id": user_id,
            "remind_before_minutes": request.remind_before_minutes,
            "channels": channels,
            "remind_at": remind_at.isoformat(),
            "status": "scheduled",
        },
        message="Checklist reminder scheduled",
    )


@router.post(
    "/bookings/{booking_id}/lite/defer",
    response_model=StandardResponse,
    summary="Defer lite-flow completion",
    description="Stores a deferred completion intent and schedules a follow-up nudge window for low-friction continuation.",
)
async def defer_lite_flow_completion(
    booking_id: str,
    request: LiteFlowDeferRequest,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise ResourceNotFoundError(message=BOOKING_NOT_FOUND_MESSAGE, resource_id=booking_id)

    user_id = _current_user_id(current_user)
    participant_ids = {str(booking.get("grihasta_id")), str(booking.get("acharya_id"))}
    if user_id not in participant_ids and current_user.get("role") != "admin":
        raise InsufficientPermissionsError(message=NOT_A_PARTICIPANT_MESSAGE)

    now = datetime.now(timezone.utc)
    defer_minutes = request.defer_minutes or settings.LITE_FLOW_DEFAULT_DEFER_MINUTES
    deferred_until = now + timedelta(minutes=defer_minutes)

    defer_doc = {
        "booking_id": booking_id,
        "user_id": user_id,
        "reason": request.reason,
        "checklist_pending": request.checklist_pending,
        "defer_minutes": defer_minutes,
        "deferred_until": deferred_until,
        "nudge_attempts": 0,
        "status": "open",
        "created_at": now,
        "updated_at": now,
    }

    await db.booking_lite_deferred.update_one(
        {
            "booking_id": booking_id,
            "user_id": user_id,
            "status": {"$in": ["open", "nudged"]},
        },
        {"$set": defer_doc},
        upsert=True,
    )
    await db.bookings.update_one(
        {"_id": booking["_id"]},
        {
            "$set": {
                "lite_flow_deferred": True,
                "lite_flow_pending_items": request.checklist_pending,
                "updated_at": now,
            }
        },
    )

    return StandardResponse(
        success=True,
        data={
            "booking_id": booking_id,
            "user_id": user_id,
            "defer_minutes": defer_minutes,
            "deferred_until": deferred_until.isoformat(),
            "status": "open",
        },
        message="Lite-flow completion deferred",
    )


# ============= Penalty Management (Strategy Report §10.1) =============


@router.get(
    "/admin/penalties/{acharya_id}",
    response_model=StandardResponse,
    summary="Get Acharya Penalty History",
)
async def get_acharya_penalties(
    acharya_id: str,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Admin endpoint to view Acharya penalty history"""
    if current_user.get("role") != "admin":
        raise InsufficientPermissionsError(required_role="admin")

    result = await PenaltyService.get_acharya_penalties(db, acharya_id, page, limit)
    return StandardResponse(success=True, data=result)


@router.post(
    "/admin/penalties/{penalty_id}/reverse",
    response_model=StandardResponse,
    summary="Reverse a Penalty",
)
async def reverse_penalty(
    penalty_id: str,
    request: PenaltyReverseRequest,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Admin endpoint to reverse a penalty"""
    if current_user.get("role") != "admin":
        raise InsufficientPermissionsError(required_role="admin")

    result = await PenaltyService.reverse_penalty(
        db, penalty_id, current_user["user_id"], request.reason
    )
    if not result:
        raise ResourceNotFoundError(message="Penalty not found", resource_id=penalty_id)

    return StandardResponse(success=True, data=result, message="Penalty reversed")


# ============= Backup Acharya (Strategy Report §10.1) =============


@router.post(
    "/admin/bookings/{booking_id}/reassign",
    response_model=StandardResponse,
    summary="Manually Reassign Booking to Backup Acharya",
)
async def reassign_booking(
    booking_id: str,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Admin endpoint to trigger backup Acharya reassignment"""
    if current_user.get("role") != "admin":
        raise InsufficientPermissionsError(required_role="admin")

    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise ResourceNotFoundError(message=BOOKING_NOT_FOUND_MESSAGE, resource_id=booking_id)

    backup = await BackupAcharyaService.find_backup_acharya(
        db, booking, booking["acharya_id"]
    )
    if not backup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No backup Acharya available in the same city/specialization",
        )

    result = await BackupAcharyaService.reassign_booking(
        db, booking_id, backup["user_id"], reason="admin_reassignment"
    )

    return StandardResponse(
        success=True,
        data=result,
        message="Booking reassigned to backup Acharya",
    )


# ============= Money-Back Guarantee (Strategy Report §7.8) =============


@router.get(
    "/guarantee/policy",
    response_model=StandardResponse,
    summary="Get Money-Back Guarantee Policy",
)
async def get_guarantee_policy():
    """Public endpoint — returns current guarantee policy"""
    policy = await GuaranteeService.get_guarantee_policy()
    return StandardResponse(success=True, data=policy)


@router.post(
    "/admin/guarantee/refund/{booking_id}",
    response_model=StandardResponse,
    summary="Process Guarantee Refund",
)
async def process_guarantee_refund(
    booking_id: str,
    reason: Annotated[str, Query(..., description="Reason for guarantee refund")],
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Admin endpoint to trigger guarantee refund"""
    if current_user.get("role") != "admin":
        raise InsufficientPermissionsError(required_role="admin")

    result = await GuaranteeService.process_guarantee_refund(db, booking_id, reason)
    return StandardResponse(success=True, data=result, message="Guarantee refund processed")


# ============= Bundle Booking (Strategy Report §6.7) =============


@router.post(
    "/bookings/bundle",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Bundle Booking — Multiple Poojas at Discount",
    description="Book 3+ poojas together for automatic 10% bundle discount",
)
async def create_bundle_booking(
    request: BundleBookingRequest,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """
    Strategy Report §6.7 — Bundle pricing.
    10% automatic discount for 3+ poojas bundled together.
    """
    user_id = _current_user_id(current_user)

    # Validate Acharya exists
    acharya = await db.users.find_one({"_id": ObjectId(request.acharya_id)})
    if not acharya:
        raise ResourceNotFoundError(message="Acharya not found", resource_id=request.acharya_id)

    # Validate date/time
    try:
        booking_dt = datetime.strptime(f"{request.date} {request.time}", "%Y-%m-%d %H:%M")
    except ValueError:
        raise InvalidInputError(message="Invalid date/time format", field="date/time")

    if booking_dt < datetime.now():
        raise InvalidInputError(message="Booking date must be in the future", field="date")

    # Fetch all pooja services
    poojas = []
    total_base_price = 0

    for pooja_id in request.pooja_ids:
        pooja = await db.services.find_one({"_id": ObjectId(pooja_id)})
        if not pooja:
            raise ResourceNotFoundError(message=f"Pooja not found: {pooja_id}", resource_id=pooja_id)
        poojas.append(pooja)
        total_base_price += pooja.get("base_price", pooja.get("price", 500))

    # Calculate pricing with dynamic pricing
    pricing = PricingService.calculate_price(
        base_price=total_base_price,
        booking_datetime=booking_dt,
        has_samagri=False,
        duration_hours=1,
    )

    # Apply bundle discount (10% for 3+, 5% for 2)
    bundle_discount_pct = 0.10 if len(poojas) >= 3 else 0.05
    bundle_discount = round(pricing["total"] * bundle_discount_pct, 2)
    final_total = round(pricing["total"] - bundle_discount, 2)

    # Create bundle booking
    bundle_doc = {
        "grihasta_id": user_id,
        "acharya_id": request.acharya_id,
        "pooja_ids": request.pooja_ids,
        "pooja_names": [p.get("name", "Unknown") for p in poojas],
        "is_bundle": True,
        "date_time": booking_dt,
        "location": request.location.model_dump() if request.location else None,
        "notes": request.notes,
        "status": "pending_payment",
        "payment_status": "pending",
        "base_total": total_base_price,
        "pricing_breakdown": pricing,
        "bundle_discount_pct": bundle_discount_pct,
        "bundle_discount": bundle_discount,
        "total_amount": final_total,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }

    result = await db.bookings.insert_one(bundle_doc)

    logger.info(
        f"Bundle booking created: {result.inserted_id}, "
        f"{len(poojas)} poojas, discount={bundle_discount_pct*100}%"
    )

    return StandardResponse(
        success=True,
        data={
            "booking_id": str(result.inserted_id),
            "poojas": [
                {"id": str(p["_id"]), "name": p.get("name", "Unknown")}
                for p in poojas
            ],
            "base_total": total_base_price,
            "bundle_discount": bundle_discount,
            "bundle_discount_pct": f"{int(bundle_discount_pct * 100)}%",
            "total_amount": final_total,
            "pricing_breakdown": pricing,
            "date_time": booking_dt.isoformat(),
        },
        message=f"Bundle booking created with {int(bundle_discount_pct*100)}% discount",
    )


# ============= Subscription "Devotee Plus" (Strategy Report §6.9) =============

SUBSCRIPTION_PLANS = {
    "monthly": {"price": 299, "duration_days": 30, "label": "Monthly"},
    "quarterly": {"price": 799, "duration_days": 90, "label": "Quarterly"},
    "annual": {"price": 2499, "duration_days": 365, "label": "Annual"},
}

SUBSCRIPTION_BENEFITS = [
    "Priority booking — get matched with top Acharyas first",
    "5% extra discount on all bookings",
    "Free samagri on one booking per month",
    "Exclusive access to premium Acharyas",
    "Ad-free experience",
    "Priority customer support",
    "₹100 monthly wallet credit",
]


@router.get(
    "/subscriptions/plans",
    response_model=StandardResponse,
    summary="Get Devotee Plus Subscription Plans",
)
async def get_subscription_plans():
    """Public endpoint — returns available subscription plans and benefits"""
    plans = []
    for plan_id, plan in SUBSCRIPTION_PLANS.items():
        plans.append({
            "plan_id": plan_id,
            "label": plan["label"],
            "price": plan["price"],
            "duration_days": plan["duration_days"],
            "currency": "INR",
        })

    return StandardResponse(
        success=True,
        data={
            "plans": plans,
            "benefits": SUBSCRIPTION_BENEFITS,
        },
    )


@router.post(
    "/subscriptions/create",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Subscribe to Devotee Plus",
)
async def create_subscription(
    request: SubscriptionCreateRequest,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """
    Create a Devotee Plus subscription.
    Strategy Report §6.9: 10-15% of Y2 revenue.
    """
    user_id = _current_user_id(current_user)
    plan = SUBSCRIPTION_PLANS.get(request.plan)
    if not plan:
        raise InvalidInputError(message="Invalid plan", field="plan")

    # Check existing active subscription
    existing = await db.subscriptions.find_one({
        "user_id": user_id,
        "status": "active",
        "expires_at": {"$gt": datetime.now(timezone.utc)},
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an active subscription",
        )

    now = datetime.now(timezone.utc)
    subscription_doc = {
        "user_id": user_id,
        "plan": request.plan,
        "price": plan["price"],
        "currency": "INR",
        "status": "pending_payment",
        "benefits": SUBSCRIPTION_BENEFITS,
        "starts_at": now,
        "expires_at": now + timedelta(days=plan["duration_days"]),
        "created_at": now,
    }

    result = await db.subscriptions.insert_one(subscription_doc)

    # NOTE: Razorpay subscription/recurring billing integration pending
    # For now, mark as active (payment integration needed)
    await db.subscriptions.update_one(
        {"_id": result.inserted_id},
        {"$set": {"status": "active"}},
    )

    # Grant monthly wallet credit
    await db.wallets.update_one(
        {"user_id": user_id},
        {"$inc": {"balance": 100}},
        upsert=True,
    )
    await db.wallet_transactions.insert_one({
        "user_id": user_id,
        "type": "subscription_credit",
        "amount": 100,
        "description": f"Devotee Plus {plan['label']} — welcome credit",
        "reference_id": str(result.inserted_id),
        "created_at": now,
    })

    logger.info(f"Subscription created: user={user_id}, plan={request.plan}")

    return StandardResponse(
        success=True,
        data={
            "subscription_id": str(result.inserted_id),
            "plan": request.plan,
            "price": plan["price"],
            "currency": "INR",
            "status": "active",
            "starts_at": now.isoformat(),
            "expires_at": (now + timedelta(days=plan["duration_days"])).isoformat(),
            "benefits": SUBSCRIPTION_BENEFITS,
        },
        message=f"Devotee Plus {plan['label']} subscription activated",
    )


@router.get(
    "/subscriptions/my",
    response_model=StandardResponse,
    summary="Get My Subscription Status",
)
async def get_my_subscription(
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Get current user's subscription status"""
    user_id = _current_user_id(current_user)

    subscription = await db.subscriptions.find_one(
        {"user_id": user_id, "status": "active"},
        sort=[("created_at", -1)],
    )

    if not subscription:
        return StandardResponse(
            success=True,
            data={"subscribed": False, "plans_available": list(SUBSCRIPTION_PLANS.keys())},
            message="No active subscription",
        )

    if subscription["expires_at"] < datetime.now(timezone.utc):
        await db.subscriptions.update_one(
            {"_id": subscription["_id"]},
            {"$set": {"status": "expired"}},
        )
        return StandardResponse(
            success=True,
            data={"subscribed": False, "expired": True},
            message="Subscription expired",
        )

    return StandardResponse(
        success=True,
        data={
            "subscribed": True,
            "subscription_id": str(subscription["_id"]),
            "plan": subscription["plan"],
            "status": subscription["status"],
            "starts_at": subscription["starts_at"].isoformat(),
            "expires_at": subscription["expires_at"].isoformat(),
            "benefits": subscription.get("benefits", SUBSCRIPTION_BENEFITS),
        },
    )


@router.get(
    "/bookings/bundle/recommendations",
    response_model=StandardResponse,
    summary="Best-value bundle recommendations",
    description="Returns high-savings ritual bundles based on selected or recent services.",
)
async def get_bundle_recommendations(
    pooja_ids: Annotated[Optional[List[str]], Query(description="Anchor pooja/service IDs")] = None,
    limit: Annotated[int, Query(ge=1, le=5)] = 3,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    bundles = await BookingDiscoveryService.get_best_value_bundles(
        db,
        user_id=_current_user_id(current_user),
        service_ids=pooja_ids or [],
        limit=limit,
    )
    return StandardResponse(
        success=True,
        data={"bundles": bundles, "count": len(bundles)},
        message="Bundle recommendations ready",
    )


@router.get(
    "/packages/recommendations",
    response_model=StandardResponse,
    summary="Personalized package recommendations",
    description="Returns package suggestions personalized from the user's ritual history.",
)
async def get_personalized_package_recommendations(
    limit: Annotated[int, Query(ge=1, le=5)] = 3,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    packages = await BookingDiscoveryService.get_personalized_packages(
        db,
        user_id=_current_user_id(current_user),
        limit=limit,
    )
    return StandardResponse(
        success=True,
        data={"packages": packages, "count": len(packages)},
        message="Personalized packages ready",
    )


@router.post(
    "/bookings/waitlist",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Join waitlist with auto-match",
    description="Creates a waitlist entry and immediately suggests matching alternative Acharyas when possible.",
)
async def create_waitlist_entry(
    request: WaitlistRequest,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    waitlist_entry = await BookingDiscoveryService.create_waitlist_entry(
        db,
        user_id=_current_user_id(current_user),
        request_data=request.model_dump(mode="json", exclude_none=True),
    )
    return StandardResponse(
        success=True,
        data=waitlist_entry,
        message=(
            "Waitlist created with immediate matches"
            if waitlist_entry.get("auto_match_candidates")
            else "Waitlist created"
        ),
    )


@router.get(
    "/acharyas/{acharya_id}/reliability",
    response_model=StandardResponse,
    summary="Acharya on-time and compensation badges",
    description="Returns punctuality and compensation reliability badges for an Acharya profile.",
)
async def get_acharya_reliability_badges(
    acharya_id: str,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    badges = await BookingDiscoveryService.get_reliability_badges(
        db,
        acharya_id=acharya_id,
    )
    return StandardResponse(
        success=True,
        data=badges,
        message="Reliability badges ready",
    )


@router.get(
    "/bookings/{booking_id}/no-show-risk",
    response_model=StandardResponse,
    summary="Predict no-show risk and interventions",
    description="Rules-first no-show risk score with operational interventions and backup options.",
)
async def get_booking_no_show_risk(
    booking_id: str,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise ResourceNotFoundError(message="Booking not found", resource_id=booking_id)

    user_id = _current_user_id(current_user)
    participant_ids = {str(booking.get("grihasta_id")), str(booking.get("acharya_id"))}
    if user_id not in participant_ids and current_user.get("role") != "admin":
        raise InsufficientPermissionsError(message=NOT_A_PARTICIPANT_MESSAGE)

    risk = await BookingDiscoveryService.get_no_show_risk(
        db,
        booking_like=booking,
    )
    return StandardResponse(
        success=True,
        data={"booking_id": booking_id, **risk},
        message="No-show risk forecast ready",
    )


class RecurringRitualSubscriptionRequest(BaseModel):
    """Create recurring ritual subscription request."""

    ritual_slug: str = Field(..., min_length=3, max_length=80)
    cadence: str = Field(..., pattern="^(weekly|monthly|lunar_monthly)$")
    start_date: str = Field(..., description="Date in YYYY-MM-DD format")
    city: Optional[str] = Field(None, max_length=80)
    notes: Optional[str] = Field(None, max_length=300)


class FamilyAccountRequest(BaseModel):
    """Family account configuration for guardian booking flows."""

    family_members: List[Dict[str, Any]] = Field(default_factory=list, max_length=12)
    guardian_booking_enabled: bool = True
    elder_friendly_mode: bool = False


class TimelineEventRequest(BaseModel):
    """Ceremony timeline update event."""

    stage: str = Field(..., pattern="^(prep|travel|check_in|completion)$")
    note: Optional[str] = Field(None, max_length=300)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class OutcomeJournalRequest(BaseModel):
    """Ritual outcome journal entry payload."""

    mood: str = Field(..., min_length=2, max_length=40)
    reflections: str = Field(..., min_length=10, max_length=1500)
    follow_up_interest: List[str] = Field(default_factory=list, max_length=8)


class NpsFeedbackRequest(BaseModel):
    """NPS feedback payload for rescue workflow."""

    score: int = Field(..., ge=0, le=10)
    feedback: Optional[str] = Field(None, max_length=1000)


class GiftRitualCheckoutRequest(BaseModel):
    """Gift-a-ritual checkout payload for diaspora use-cases."""

    recipient_name: str = Field(..., min_length=2, max_length=120)
    recipient_phone: Optional[str] = Field(None, max_length=30)
    recipient_email: Optional[str] = Field(None, max_length=120)
    city: str = Field(..., min_length=2, max_length=80)
    pooja_id: Optional[str] = None
    service_name: str = Field(..., min_length=3, max_length=120)
    scheduled_date: str = Field(..., description="Date in YYYY-MM-DD format")
    message: Optional[str] = Field(None, max_length=300)


RECURRING_RITUAL_CATALOG = [
    {
        "slug": "sankashta-chaturthi",
        "label": "Sankashta Chaturthi",
        "default_cadence": "lunar_monthly",
    },
    {
        "slug": "monday-rudra-abhisheka",
        "label": "Every Monday Rudra Abhisheka",
        "default_cadence": "weekly",
    },
    {
        "slug": "pournima-satyanarayana",
        "label": "Every Pournima Satyanarayana Pooja",
        "default_cadence": "lunar_monthly",
    },
]


def _is_valid_date_string(value: str) -> bool:
    try:
        datetime.strptime(value, "%Y-%m-%d")
        return True
    except ValueError:
        return False


async def _load_authorized_booking(
    db: AsyncIOMotorDatabase,
    booking_id: str,
    current_user: Dict[str, Any],
) -> Dict[str, Any]:
    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise ResourceNotFoundError(message=BOOKING_NOT_FOUND_MESSAGE, resource_id=booking_id)

    user_id = _current_user_id(current_user)
    participant_ids = {str(booking.get("grihasta_id")), str(booking.get("acharya_id"))}
    if user_id not in participant_ids and current_user.get("role") != "admin":
        raise InsufficientPermissionsError(message=NOT_A_PARTICIPANT_MESSAGE)
    return booking


@router.get(
    "/subscriptions/rituals/catalog",
    response_model=StandardResponse,
    summary="Recurring ritual subscription catalog",
)
async def get_recurring_ritual_catalog():
    return StandardResponse(
        success=True,
        data={"rituals": RECURRING_RITUAL_CATALOG, "count": len(RECURRING_RITUAL_CATALOG)},
    )


@router.post(
    "/subscriptions/rituals/create",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create recurring ritual subscription",
    description="Creates recurring ritual reminders for monthly/weekly sankalp and vrat journeys.",
)
async def create_recurring_ritual_subscription(
    request: RecurringRitualSubscriptionRequest,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    if not _is_valid_date_string(request.start_date):
        raise InvalidInputError(message="start_date must be YYYY-MM-DD", field="start_date")

    user_id = _current_user_id(current_user)
    start_dt = datetime.strptime(request.start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    cadence_days = 7 if request.cadence == "weekly" else 30

    doc = {
        "user_id": user_id,
        "ritual_slug": request.ritual_slug,
        "cadence": request.cadence,
        "city": request.city,
        "notes": request.notes,
        "status": "active",
        "starts_at": start_dt,
        "next_ritual_at": start_dt,
        "cadence_days": cadence_days,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    result = await db.recurring_ritual_subscriptions.insert_one(doc)
    return StandardResponse(
        success=True,
        data={
            "subscription_id": str(result.inserted_id),
            "ritual_slug": request.ritual_slug,
            "cadence": request.cadence,
            "next_ritual_at": start_dt.isoformat(),
        },
        message="Recurring ritual subscription created",
    )


@router.get(
    "/subscriptions/rituals/my",
    response_model=StandardResponse,
    summary="Get my recurring ritual subscriptions",
)
async def get_my_recurring_ritual_subscriptions(
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    user_id = _current_user_id(current_user)
    docs = await db.recurring_ritual_subscriptions.find(
        {"user_id": user_id, "status": {"$in": ["active", "paused"]}}
    ).sort("created_at", -1).to_list(length=50)
    for item in docs:
        item["id"] = str(item["_id"])
        item["_id"] = str(item["_id"])
    return StandardResponse(success=True, data={"subscriptions": docs, "count": len(docs)})


@router.post(
    "/family/accounts",
    response_model=StandardResponse,
    summary="Upsert family account preferences",
    description="Stores guardian booking settings and elder-friendly family details for future bookings.",
)
async def upsert_family_account(
    request: FamilyAccountRequest,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    user_id = _current_user_id(current_user)
    now = datetime.now(timezone.utc)
    payload = {
        "user_id": user_id,
        "family_members": request.family_members,
        "guardian_booking_enabled": request.guardian_booking_enabled,
        "elder_friendly_mode": request.elder_friendly_mode,
        "updated_at": now,
    }
    await db.family_accounts.update_one(
        {"user_id": user_id},
        {"$set": payload, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )

    await db.grihasta_profiles.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "family_members": request.family_members,
                "guardian_booking_enabled": request.guardian_booking_enabled,
                "elder_friendly_mode": request.elder_friendly_mode,
                "updated_at": now,
            }
        },
    )

    return StandardResponse(
        success=True,
        data={"user_id": user_id, **payload},
        message="Family account preferences saved",
    )


@router.get(
    "/family/accounts/my",
    response_model=StandardResponse,
    summary="Get family account preferences",
)
async def get_my_family_account(
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    user_id = _current_user_id(current_user)
    doc = await db.family_accounts.find_one({"user_id": user_id})
    if not doc:
        return StandardResponse(success=True, data={"configured": False, "family_members": []})
    doc["id"] = str(doc["_id"])
    doc["_id"] = str(doc["_id"])
    return StandardResponse(success=True, data={"configured": True, **doc})


@router.get(
    "/bookings/{booking_id}/financing/options",
    response_model=StandardResponse,
    summary="Get in-flow financing options",
    description="Returns installment options for high-ticket rituals inside checkout flow.",
)
async def get_financing_options(
    booking_id: str,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    booking = await _load_authorized_booking(db, booking_id, current_user)
    total_amount = float(booking.get("total_amount") or 0)
    if total_amount < 5000:
        return StandardResponse(
            success=True,
            data={"eligible": False, "reason": "Financing available for bookings above ₹5000"},
        )

    plans = []
    for months, apr in ((3, 0.10), (6, 0.12), (9, 0.14)):
        interest = round(total_amount * apr * (months / 12), 2)
        repayable = round(total_amount + interest, 2)
        monthly_emi = round(repayable / months, 2)
        plans.append(
            {
                "plan_months": months,
                "apr": apr,
                "interest": interest,
                "total_repayable": repayable,
                "monthly_emi": monthly_emi,
            }
        )

    return StandardResponse(
        success=True,
        data={"eligible": True, "booking_id": booking_id, "total_amount": total_amount, "plans": plans},
        message="Financing options ready",
    )


@router.get(
    "/pricing/smart-estimate",
    response_model=StandardResponse,
    summary="Smart pricing estimate with fairness guardrails",
)
async def get_smart_pricing_estimate(
    city: Annotated[str, Query(..., description="City name")],
    base_price: Annotated[float, Query(..., gt=0)],
    date_time: Annotated[str, Query(..., description="ISO-8601 datetime")],
    duration_hours: Annotated[int, Query(ge=1, le=12)] = 2,
    has_samagri: Annotated[bool, Query()] = False,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    try:
        booking_dt = datetime.fromisoformat(date_time.replace("Z", "+00:00"))
        if booking_dt.tzinfo is None:
            booking_dt = booking_dt.replace(tzinfo=timezone.utc)
    except ValueError as exc:
        raise InvalidInputError(message=f"Invalid date_time: {exc}", field="date_time") from exc

    dynamic = PricingService.calculate_price(
        base_price=base_price,
        booking_datetime=booking_dt,
        has_samagri=has_samagri,
        duration_hours=duration_hours,
    )
    raw_total = float(dynamic.get("total", 0))

    window_start = booking_dt - timedelta(hours=2)
    window_end = booking_dt + timedelta(hours=2)
    demand_count = await db.bookings.count_documents(
        {
            "status": {"$in": ["requested", "confirmed", "pending_payment", "in_progress"]},
            "date_time": {"$gte": window_start, "$lte": window_end},
            "location.city": {"$regex": f"^{city}$", "$options": "i"},
        }
    )

    demand_multiplier = 1.0
    if demand_count >= 12:
        demand_multiplier = 1.2
    elif demand_count >= 6:
        demand_multiplier = 1.1

    seasonal_multiplier = 1.15 if booking_dt.month in {9, 10, 11} else 1.0
    unconstrained_total = round(raw_total * demand_multiplier * seasonal_multiplier, 2)

    fairness_min = round(raw_total * 0.8, 2)
    fairness_max = round(raw_total * 1.35, 2)
    final_total = max(fairness_min, min(unconstrained_total, fairness_max))

    return StandardResponse(
        success=True,
        data={
            "base_dynamic_total": raw_total,
            "demand_multiplier": demand_multiplier,
            "seasonal_multiplier": seasonal_multiplier,
            "unconstrained_total": unconstrained_total,
            "fairness_bounds": {"min": fairness_min, "max": fairness_max},
            "final_total": round(final_total, 2),
            "demand_count_window": demand_count,
        },
    )


@router.post(
    "/bookings/{booking_id}/timeline/events",
    response_model=StandardResponse,
    summary="Append ceremony timeline event",
    description="Tracks ceremony journey stages (prep, travel, check-in, completion).",
)
async def append_timeline_event(
    booking_id: str,
    request: TimelineEventRequest,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    booking = await _load_authorized_booking(db, booking_id, current_user)
    now = datetime.now(timezone.utc)
    event_doc = {
        "booking_id": booking_id,
        "stage": request.stage,
        "note": request.note,
        "metadata": request.metadata,
        "actor_id": _current_user_id(current_user),
        "actor_role": current_user.get("role"),
        "created_at": now,
    }
    inserted = await db.booking_timeline_events.insert_one(dict(event_doc))
    await db.bookings.update_one(
        {"_id": booking["_id"]},
        {"$set": {"timeline_stage": request.stage, "updated_at": now}},
    )
    return StandardResponse(
        success=True,
        data={"timeline_event_id": str(inserted.inserted_id), **event_doc},
        message="Timeline event recorded",
    )


@router.get(
    "/bookings/{booking_id}/timeline",
    response_model=StandardResponse,
    summary="Get ceremony timeline",
)
async def get_booking_timeline(
    booking_id: str,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    booking = await _load_authorized_booking(db, booking_id, current_user)
    events = await db.booking_timeline_events.find({"booking_id": booking_id}).sort("created_at", 1).to_list(length=100)
    for event in events:
        event["id"] = str(event["_id"])
        event["_id"] = str(event["_id"])
    return StandardResponse(
        success=True,
        data={
            "booking_id": booking_id,
            "current_stage": booking.get("timeline_stage"),
            "events": events,
            "count": len(events),
        },
    )


@router.get(
    "/bookings/{booking_id}/calendar/export",
    response_model=StandardResponse,
    summary="Export booking to external/internal calendar",
    description="Provides Google/Apple/WhatsApp export payloads compatible with Savitara's internal calendar model.",
)
async def export_booking_calendar_links(
    booking_id: str,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    booking = await _load_authorized_booking(db, booking_id, current_user)
    start_dt = booking.get("date_time")
    if not isinstance(start_dt, datetime):
        raise InvalidInputError(message="Booking date/time unavailable", field="booking_id")
    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)
    end_dt = booking.get("end_time") or (start_dt + timedelta(hours=2))

    title = booking.get("service_name") or "Savitara Ritual Booking"
    city = (booking.get("location") or {}).get("city", "India")
    description = f"{title} in {city}"
    g_start = start_dt.strftime("%Y%m%dT%H%M%SZ")
    g_end = end_dt.strftime("%Y%m%dT%H%M%SZ") if isinstance(end_dt, datetime) else g_start

    google_url = (
        "https://calendar.google.com/calendar/render?action=TEMPLATE"
        f"&text={title}&dates={g_start}/{g_end}&details={description}&location={city}"
    )
    apple_ics = (
        "BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\n"
        f"UID:{booking_id}@savitara\n"
        f"DTSTART:{g_start}\nDTEND:{g_end}\n"
        f"SUMMARY:{title}\nDESCRIPTION:{description}\nLOCATION:{city}\n"
        "END:VEVENT\nEND:VCALENDAR"
    )
    whatsapp_text = (
        f"Ritual booking reminder: {title} on {start_dt.strftime('%d %b %Y %I:%M %p')} ({city})."
    )

    internal_event_payload = {
        "event_type": "booking",
        "title": title,
        "description": description,
        "date": start_dt.date().isoformat(),
        "start_time": start_dt.isoformat(),
        "end_time": end_dt.isoformat() if isinstance(end_dt, datetime) else start_dt.isoformat(),
        "booking_id": booking_id,
        "reminder_before": 60,
    }

    return StandardResponse(
        success=True,
        data={
            "google_calendar_url": google_url,
            "apple_ics": apple_ics,
            "whatsapp_text": whatsapp_text,
            "internal_event_payload": internal_event_payload,
        },
        message="Calendar export payloads ready",
    )


@router.get(
    "/checkout/variant",
    response_model=StandardResponse,
    summary="Get checkout variant by segment",
)
async def get_checkout_variant(
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    user_id = _current_user_id(current_user)
    bookings_count = await db.bookings.count_documents({"grihasta_id": user_id})
    if bookings_count == 0:
        variant = "guided_first_booking"
    elif bookings_count < 5:
        variant = "trust_badge_focus"
    else:
        variant = "express_repeat_checkout"

    return StandardResponse(
        success=True,
        data={"user_id": user_id, "bookings_count": bookings_count, "variant": variant},
    )


@router.post(
    "/bookings/{booking_id}/journal",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create ritual outcome journal entry",
)
async def create_outcome_journal_entry(
    booking_id: str,
    request: OutcomeJournalRequest,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    _ = await _load_authorized_booking(db, booking_id, current_user)
    now = datetime.now(timezone.utc)
    entry = {
        "booking_id": booking_id,
        "user_id": _current_user_id(current_user),
        "mood": request.mood,
        "reflections": request.reflections,
        "follow_up_interest": request.follow_up_interest,
        "created_at": now,
        "updated_at": now,
    }
    inserted = await db.booking_outcome_journals.insert_one(dict(entry))

    follow_ups = await BookingDiscoveryService.get_personalized_packages(
        db,
        user_id=_current_user_id(current_user),
        limit=3,
    )
    return StandardResponse(
        success=True,
        data={"journal_id": str(inserted.inserted_id), "entry": entry, "follow_up_recommendations": follow_ups},
        message="Ritual outcome journal saved",
    )


@router.get(
    "/bookings/{booking_id}/journal",
    response_model=StandardResponse,
    summary="Get ritual outcome journal entries",
)
async def get_outcome_journal_entries(
    booking_id: str,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    _ = await _load_authorized_booking(db, booking_id, current_user)
    docs = await db.booking_outcome_journals.find({"booking_id": booking_id}).sort("created_at", -1).to_list(length=50)
    for doc in docs:
        doc["id"] = str(doc["_id"])
        doc["_id"] = str(doc["_id"])
    return StandardResponse(success=True, data={"entries": docs, "count": len(docs)})


@router.post(
    "/bookings/{booking_id}/nps",
    response_model=StandardResponse,
    summary="Submit NPS and trigger rescue workflow",
)
async def submit_booking_nps(
    booking_id: str,
    request: NpsFeedbackRequest,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    _ = await _load_authorized_booking(db, booking_id, current_user)
    now = datetime.now(timezone.utc)
    payload = {
        "booking_id": booking_id,
        "user_id": _current_user_id(current_user),
        "score": request.score,
        "feedback": request.feedback,
        "created_at": now,
    }
    await db.booking_nps_feedback.insert_one(payload)

    rescue_ticket = None
    if request.score <= 6:
        rescue_doc = {
            "booking_id": booking_id,
            "user_id": _current_user_id(current_user),
            "score": request.score,
            "feedback": request.feedback,
            "status": "open",
            "priority": "high" if request.score <= 3 else "medium",
            "created_at": now,
            "updated_at": now,
        }
        rescue = await db.nps_rescue_workflows.insert_one(rescue_doc)
        rescue_ticket = str(rescue.inserted_id)

    return StandardResponse(
        success=True,
        data={"booking_id": booking_id, "score": request.score, "rescue_ticket_id": rescue_ticket},
        message="NPS feedback recorded",
    )


@router.post(
    "/bookings/gift",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Gift a ritual checkout",
)
async def create_gift_ritual_checkout(
    request: GiftRitualCheckoutRequest,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    if not _is_valid_date_string(request.scheduled_date):
        raise InvalidInputError(message="scheduled_date must be YYYY-MM-DD", field="scheduled_date")

    user_id = _current_user_id(current_user)
    gift_doc = {
        "sender_user_id": user_id,
        "recipient_name": request.recipient_name,
        "recipient_phone": request.recipient_phone,
        "recipient_email": request.recipient_email,
        "city": request.city,
        "pooja_id": request.pooja_id,
        "service_name": request.service_name,
        "scheduled_date": request.scheduled_date,
        "message": request.message,
        "status": "pending_payment",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    result = await db.gift_ritual_checkouts.insert_one(dict(gift_doc))
    return StandardResponse(
        success=True,
        data={"gift_checkout_id": str(result.inserted_id), **gift_doc},
        message="Gift ritual checkout created",
    )


@router.get(
    "/concierge/hotline",
    response_model=StandardResponse,
    summary="City-wise concierge hotline escalation",
)
async def get_concierge_hotline(
    city: Annotated[str, Query(..., description="City name")],
    festival: Annotated[Optional[str], Query(description="Festival context")] = None,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    normalized_city = city.strip().lower()
    hotlines = {
        "mumbai": "+91-22-6200-1085",
        "bengaluru": "+91-80-6200-1085",
        "delhi": "+91-11-6200-1085",
        "chennai": "+91-44-6200-1085",
        "pune": "+91-20-6200-1085",
    }
    hotline = hotlines.get(normalized_city, "+91-120-6200-1085")
    peak_festival = bool(festival)

    escalation_doc = {
        "user_id": _current_user_id(current_user),
        "city": city,
        "festival": festival,
        "hotline": hotline,
        "peak_festival": peak_festival,
        "status": "opened",
        "created_at": datetime.now(timezone.utc),
    }
    await db.concierge_escalations.insert_one(escalation_doc)

    return StandardResponse(
        success=True,
        data={
            "city": city,
            "festival": festival,
            "hotline": hotline,
            "peak_festival": peak_festival,
            "available_hours": "06:00-23:00 IST",
        },
        message="Concierge hotline details ready",
    )
