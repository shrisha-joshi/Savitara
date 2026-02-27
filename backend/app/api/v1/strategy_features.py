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
from app.db.connection import get_db
from app.schemas.requests import StandardResponse, BookingCreateRequest, Location
from app.services.penalty_service import PenaltyService
from app.services.backup_acharya_service import BackupAcharyaService
from app.services.guarantee_service import GuaranteeService
from app.services.pricing_service import PricingService

import logging

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Strategy Features"])

# ============= Constants =============
MATCH_OP = "$match"


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
        raise ResourceNotFoundError(message="Booking not found", resource_id=booking_id)

    # Verify user is participant
    user_id = current_user["user_id"]
    if user_id not in [booking.get("grihasta_id"), booking.get("acharya_id")]:
        raise InsufficientPermissionsError(message="Not a participant in this booking")

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
        raise ResourceNotFoundError(message="Booking not found", resource_id=booking_id)

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
    user_id = current_user["user_id"]

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
    user_id = current_user["user_id"]
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
    user_id = current_user["user_id"]

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

    # Check if expired
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
