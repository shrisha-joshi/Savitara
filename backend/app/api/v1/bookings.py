async def _fetch_and_validate_booking(booking_id, current_user, db):
    booking_doc = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking_doc:
        raise ResourceNotFoundError(resource_type="Booking", resource_id=booking_id)
    if str(booking_doc["grihasta_id"]) != current_user["id"]:
        raise PermissionDeniedError(action="Verify payment")
    return booking_doc

def _check_idempotency(booking_doc, booking_id):
    if (
        booking_doc.get("status") == BookingStatus.CONFIRMED.value
        and booking_doc.get("payment_status") == PaymentStatus.COMPLETED.value
    ):
        return StandardResponse(
            success=True,
            data={
                "booking_id": booking_id,
                "status": BookingStatus.CONFIRMED.value,
                "start_otp": booking_doc.get("start_otp"),
            },
            message="Payment already verified. Booking is confirmed.",
        )
    return None

def _verify_razorpay_signature(payment_service, booking_doc, razorpay_payment_id, razorpay_signature):
    is_valid = payment_service.verify_payment_signature(
        razorpay_order_id=booking_doc["razorpay_order_id"],
        razorpay_payment_id=razorpay_payment_id,
        razorpay_signature=razorpay_signature,
    )
    if not is_valid:
        raise PaymentFailedError(
            order_id=booking_doc["razorpay_order_id"],
            details={"error": "Invalid payment signature"},
        )

def _validate_acharya_id(acharya_id, db):
    if not ObjectId.is_valid(acharya_id):
        raise InvalidInputError(message="Invalid acharya_id format", field="acharya_id")
    return db.acharya_profiles.find_one({"_id": ObjectId(acharya_id)})

def _parse_requested_start(date_time):
    try:
        requested_start = datetime.fromisoformat(date_time.replace("Z", TIMEZONE_UTC_OFFSET))
        if requested_start.tzinfo is None:
            requested_start = requested_start.replace(tzinfo=timezone.utc)
        return requested_start
    except ValueError as exc:
        raise InvalidInputError(
            message=f"Invalid date_time: {exc}. Use ISO-8601, e.g. 2026-03-15T14:00:00",
            field="date_time",
        ) from exc

def _find_conflicts(candidates, requested_start, requested_end):
    conflicts = []
    latest_conflict_end = None
    for booking in candidates:
        b_start = booking.get("scheduled_datetime")
        if b_start is None:
            continue
        if isinstance(b_start, str):
            b_start = datetime.fromisoformat(b_start.replace("Z", TIMEZONE_UTC_OFFSET))
        if b_start.tzinfo is None:
            b_start = b_start.replace(tzinfo=timezone.utc)
        b_duration = booking.get("duration_hours", 2)
        b_end = b_start + timedelta(hours=b_duration)
        if b_start < requested_end and b_end > requested_start:
            conflicts.append({
                "booking_id": str(booking["_id"]),
                "start": b_start.isoformat(),
                "end": b_end.isoformat(),
            })
            if latest_conflict_end is None or b_end > latest_conflict_end:
                latest_conflict_end = b_end
    return conflicts, latest_conflict_end

"""
Booking API Endpoints
Handles booking creation, management, and attendance confirmation
SonarQube: S5659 - Secure OTP generation
"""
from fastapi import APIRouter, Body, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Annotated, Dict, Any, Optional
import logging
from datetime import datetime, timedelta, timezone
import secrets
import string
from bson import ObjectId
from pydantic import BaseModel, Field

from app.schemas.requests import (
    BookingCreateRequest,
    BookingStatusUpdateRequest,
    BookingReferRequest,
    AttendanceConfirmRequest,
    StandardResponse,
)
from app.core.constants import (
    MONGO_LOOKUP,
    MONGO_MATCH,
    MONGO_UNWIND,
    MONGO_SORT,
    MONGO_SKIP,
    MONGO_LIMIT,
    ERROR_CONFIRM_ATTENDANCE,
    ERROR_VIEW_BOOKING,
    MONGO_IF_NULL,
    FIELD_POOJA_NAME,
    FIELD_SERVICE_NAME,
    TIMEZONE_UTC_OFFSET,
)
from app.core.config import settings
from app.core.security import (
    get_current_user,
    get_current_grihasta,
    get_current_acharya,
)
from app.core.exceptions import (
    ResourceNotFoundError,
    InvalidInputError,
    PermissionDeniedError,
    SlotUnavailableError,
    PaymentFailedError,
    ValidationError,
)
from app.db.connection import get_db
from app.models.database import Booking, BookingStatus, PaymentStatus, UserRole

# Constants to avoid duplication (S1192)
ACTION_CANCEL_BOOKING = "Cancel booking"


# Module-level constants
BOOKING_COMPLETED = "Booking Completed"

# Central state machine — all transition validation is delegated here
from app.services.booking_state_machine import (  # noqa: E402, PLC0415
    validate_transition as _validate_transition,
    emit_booking_update,
)

# Legacy transition table retained for reference only.
# Enforcement is now handled by booking_state_machine.VALID_TRANSITIONS.
_BOOKING_TRANSITIONS: Dict[str, list] = {
    BookingStatus.PENDING_PAYMENT.value: [BookingStatus.CONFIRMED.value, BookingStatus.CANCELLED.value, BookingStatus.FAILED.value],
    BookingStatus.REQUESTED.value:       [BookingStatus.CONFIRMED.value, BookingStatus.CANCELLED.value, BookingStatus.REJECTED.value],
    BookingStatus.CONFIRMED.value:       [BookingStatus.IN_PROGRESS.value, BookingStatus.CANCELLED.value],
    BookingStatus.IN_PROGRESS.value:     [BookingStatus.COMPLETED.value],
    BookingStatus.COMPLETED.value:       [],
    BookingStatus.CANCELLED.value:       [],
    BookingStatus.REJECTED.value:        [],
    BookingStatus.FAILED.value:          [],
}

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/bookings", tags=["Bookings"])

from app.core.exceptions import ResourceNotFoundError

@router.put(
    "/{booking_id}/refer",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Refer/Pass Booking to Another Acharya",
    description="Allows Acharya to refer/pass a booking to another Acharya by updating acharya_id.",
)
async def refer_booking(
    booking_id: str,
    refer_data: BookingReferRequest,
    current_user: Annotated[Dict[str, Any], Depends(get_current_acharya)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Refer/pass a booking to another Acharya (by Acharya)"""
    new_acharya_id = refer_data.new_acharya_id
    notes = refer_data.notes

    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise ResourceNotFoundError(resource_type="Booking", resource_id=booking_id)

    # Only the current assigned Acharya can refer — resolve profile ID
    acharya_id = current_user["id"]
    acharya_obj = ObjectId(acharya_id) if ObjectId.is_valid(acharya_id) else None
    acharya_profile = await db.acharya_profiles.find_one(
        {"user_id": acharya_obj or acharya_id}, {"_id": 1}
    )
    acharya_profile_id = acharya_profile.get("_id") if acharya_profile else None
    if str(booking["acharya_id"]) not in [str(acharya_profile_id), acharya_id]:
        raise PermissionDeniedError(action="Refer booking")

    # Validate new Acharya exists
    new_acharya = await db.acharya_profiles.find_one({"_id": ObjectId(new_acharya_id)})
    if not new_acharya:
        raise ResourceNotFoundError(resource_type="Acharya", resource_id=new_acharya_id)

    # Update booking's acharya_id and add note
    update_doc = {
        "acharya_id": ObjectId(new_acharya_id),
        "status": BookingStatus.REQUESTED.value,  # Reset to requested for new Acharya
        "updated_at": datetime.now(timezone.utc),
    }
    if notes:
        update_doc["notes"] = notes

    await db.bookings.update_one({"_id": ObjectId(booking_id)}, {"$set": update_doc})

    # Notify new Acharya (optional: and Grihasta)
    try:
        from app.services.notification_service import NotificationService
        notification_service = NotificationService()
        if new_acharya.get("fcm_token"):
            notification_service.send_notification(
                token=new_acharya["fcm_token"],
                title="New Booking Assigned",
                body="A booking has been referred to you.",
                data={"type": "booking_referred", "booking_id": booking_id},
            )
    except Exception as e:
        logger.warning(f"Failed to send referral notification: {e}")

    return StandardResponse(success=True, message="Booking referred to new Acharya.")

from app.services.pricing_service import PricingService


def generate_otp(length: int = 6) -> str:
    """
    Generate secure OTP
    SonarQube: S5659 - Uses secrets module for cryptographic randomness
    """
    return "".join(secrets.choice(string.digits) for _ in range(length))


async def _validate_acharya_and_pooja(
    db: AsyncIOMotorDatabase, acharya_id: str, pooja_id: Optional[str]
) -> tuple[dict, Optional[dict]]:
    """Validate Acharya and optional Pooja exist"""
    # 1. Validate Acharya exists
    acharya = await db.acharya_profiles.find_one({"_id": ObjectId(acharya_id)})
    if not acharya:
        raise ResourceNotFoundError(resource_type="Acharya", resource_id=acharya_id)

    # 2. Validate Pooja exists when ID provided
    if not pooja_id:
        return acharya, None

    pooja = await db.poojas.find_one({"_id": ObjectId(pooja_id)})
    if not pooja:
        raise ResourceNotFoundError(resource_type="Pooja", resource_id=pooja_id)
    return acharya, pooja


async def _check_slot_availability(
    db: AsyncIOMotorDatabase, acharya_id: str, start_time: datetime, end_time: datetime
):
    """Check if the requested slot is available"""
    conflicting_booking = await db.bookings.find_one(
        {
            "acharya_id": acharya_id,
            "status": {
                "$nin": [
                    BookingStatus.CANCELLED.value,
                    BookingStatus.COMPLETED.value,
                    BookingStatus.FAILED.value,
                ]
            },
            "$or": [
                {"date_time": {"$gte": start_time, "$lt": end_time}},
                {"date_time": {"$lt": start_time}, "end_time": {"$gt": start_time}},
            ],
        }
    )

    if conflicting_booking:
        raise SlotUnavailableError(
            acharya_id=acharya_id, start_time=start_time, end_time=end_time
        )


async def _process_coupon(
    db: AsyncIOMotorDatabase, coupon_code: str, subtotal: float
) -> float:
    """Apply coupon if valid and return discount amount.
    Uses atomic find_one_and_update to prevent race-condition overuse (C6).
    """
    if not coupon_code:
        return 0.0

    now = datetime.now(timezone.utc)

    # Atomic check-and-increment: the filter ensures used_count < max_uses
    # so two concurrent requests cannot both pass the limit check.
    coupon = await db.coupons.find_one_and_update(
        {
            "code": coupon_code,
            "is_active": True,
            "valid_from": {"$lte": now},
            "valid_until": {"$gte": now},
            "$expr": {
                "$or": [
                    {"$eq": ["$max_uses", 0]},          # unlimited
                    {"$lt": [{"$ifNull": ["$used_count", 0]}, "$max_uses"]},
                ]
            },
        },
        {"$inc": {"used_count": 1}},
        return_document=False,  # return the document *before* the update
    )

    if not coupon:
        logger.info(f"Coupon {coupon_code} invalid, expired, or usage limit reached")
        return 0.0

    discount = subtotal * (coupon.get("discount_percentage", 0) / 100)

    return discount


async def _compute_pricing_context(
    db: AsyncIOMotorDatabase,
    pooja: Optional[dict],
    booking_data: BookingCreateRequest,
    booking_datetime: datetime,
    duration_hours: int,
) -> dict:
    """Calculate pricing details for booking, supporting custom services"""
    slot_end = booking_datetime + timedelta(hours=duration_hours)

    subtotal = 0.0
    platform_fee = 0.0
    total_amount = 0.0
    discount = 0.0
    base_price = 0.0
    samagri_price = 0.0

    if pooja:
        pricing_result = PricingService.calculate_price(
            base_price=float(pooja.get("base_price", 500.0)),
            booking_datetime=booking_datetime,
            has_samagri=(booking_data.booking_type == "with_samagri"),
            duration_hours=duration_hours,
        )

        subtotal = pricing_result["subtotal"]
        platform_fee = pricing_result["fees"]["platform_fee"]
        total_amount = pricing_result["total"]
        base_price = pricing_result.get("base_price", pooja.get("price", 0))
        samagri_price = pricing_result.get("samagri_price", 0)

        if booking_data.coupon_code:
            discount = await _process_coupon(db, booking_data.coupon_code, subtotal)
            total_amount -= discount
    else:
        if booking_data.booking_mode != "request":
            raise InvalidInputError(
                message="Custom service requests must use request mode",
                field="booking_mode",
            )

    return {
        "duration_hours": duration_hours,
        "slot_end": slot_end,
        "subtotal": subtotal,
        "platform_fee": platform_fee,
        "total_amount": total_amount,
        "discount": discount,
        "base_price": base_price,
        "samagri_price": samagri_price,
    }


def _create_razorpay_order(
    booking_data: BookingCreateRequest, total_amount: float, grihasta_id: str
) -> Optional[str]:
    """Create Razorpay order for instant bookings"""
    if booking_data.booking_mode != "instant" or total_amount <= 0:
        return None

    try:
        from app.services.payment_service import RazorpayService

        payment_service = RazorpayService()
        razorpay_order = payment_service.create_order(
            amount=total_amount,
            currency="INR",
            notes={
                "grihasta_id": grihasta_id,
                "acharya_id": booking_data.acharya_id,
                "pooja_id": booking_data.pooja_id,
            },
        )
        return razorpay_order.get("order_id")
    except Exception as e:
        logger.warning(f"Razorpay order creation warning: {e}")
        # Fallback dummy order ID only in non-production environments
        if not settings.is_production:
            return f"order_dev_{secrets.token_hex(8)}"
        raise


def _send_booking_notification(
    acharya: dict, current_user: dict, pooja: Optional[dict], booking_id: str
):
    """Send notification to Acharya for new booking request"""
    try:
        from app.services.notification_service import NotificationService

        notification_service = NotificationService()
        if acharya.get("fcm_token"):
            pooja_name = pooja.get("name") if pooja else "custom service"
            notification_service.send_notification(
                token=acharya["fcm_token"],
                title="New Booking Request",
                body=f"Request from {current_user.get('full_name', 'a user')} for {pooja_name}",
                data={"type": "booking_request", "booking_id": booking_id},
            )
    except Exception as e:
        logger.warning(f"Failed to send request notification: {e}")


def _prepare_booking_dict(booking: Booking) -> Dict[str, Any]:
    """Prepare booking dict for MongoDB insertion."""
    booking_dict = booking.model_dump(by_alias=True)
    
    # Remove _id if None to allow MongoDB to generate it
    if "_id" in booking_dict and booking_dict["_id"] is None:
        del booking_dict["_id"]
    
    # Convert ID strings back to ObjectId for proper MongoDB storage
    for id_field in ["grihasta_id", "acharya_id", "pooja_id"]:
        if id_field in booking_dict and booking_dict[id_field] and isinstance(booking_dict[id_field], str):
            booking_dict[id_field] = ObjectId(booking_dict[id_field])
    
    # Remove unique fields that are None to avoid duplicate key errors
    for unique_field in ["razorpay_order_id", "razorpay_payment_id"]:
        if unique_field in booking_dict and booking_dict[unique_field] is None:
            del booking_dict[unique_field]
    
    return booking_dict


def _parse_grihasta_id(user_id_str: str) -> Any:
    """Parse grihasta ID, converting to ObjectId if valid."""
    try:
        return ObjectId(user_id_str)
    except Exception:
        return user_id_str


@router.get(
    "/price-estimate",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Dynamic Price Estimate",
    description=(
        "Returns a full price breakdown for a proposed booking using PricingService. "
        "Call this whenever the user changes date, time, duration, or booking type to "
        "show real-time dynamic pricing (weekend/peak/festival surcharges, platform fee, GST)."
    ),
)
async def get_price_estimate(
    acharya_id: str = Query(..., description="Acharya profile ID"),
    date_time: str = Query(..., description="ISO-8601 datetime e.g. 2026-03-15T14:00:00"),
    duration_hours: int = Query(2, ge=1, le=12, description="Booking duration in hours"),
    booking_type: str = Query("only", description="'only' or 'with_samagri'"),
    pooja_id: Optional[str] = Query(None, description="Optional pooja/service ID for base price"),
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """
    Dynamic price estimate endpoint — called by mobile BookingScreen on every
    date/time/duration change so users see accurate pricing before booking.

    Price components returned:
      • base_price         — hourly_rate × duration_hours
      • weekend_surcharge  — +50% on Saturday/Sunday
      • peak_hour_adj      — +20% during 17:00–22:00
      • off_peak_discount  — −15% on weekday 06:00–10:00
      • urgent_surcharge   — +50% if booking is < 24 h away
      • festival_surcharge — +30% on major Hindu festival days (from PanchangaService)
      • festival_name      — name of the festival (if applicable)
      • samagri_fee        — ₹200/hr when booking_type == 'with_samagri'
      • platform_fee       — 10% of subtotal
      • gst                — 18% of subtotal
      • subtotal           — after all surcharges/discounts, before platform_fee/GST
      • total_price        — final amount Grihasta pays
      • acharya_earnings   — after platform cut
    """
    # ── 1. Validate Acharya ────────────────────────────────────────────────
    if not ObjectId.is_valid(acharya_id):
        raise InvalidInputError(message="Invalid acharya_id format", field="acharya_id")

    acharya = await db.acharya_profiles.find_one({"_id": ObjectId(acharya_id)})
    if not acharya:
        raise ResourceNotFoundError(resource_type="Acharya", resource_id=acharya_id)

    # ── 2. Resolve base hourly rate ────────────────────────────────────────
    # Prefer pooja base_price when a specific pooja is selected
    base_hourly_rate = float(acharya.get("hourly_rate", 500.0))
    if pooja_id and ObjectId.is_valid(pooja_id):
        pooja = await db.poojas.find_one({"_id": ObjectId(pooja_id)})
        if pooja and "base_price" in pooja:
            # base_price in poojas is total, not per-hour — keep as-is for the estimate
            base_hourly_rate = float(pooja["base_price"])

    # ── 3. Parse datetime ──────────────────────────────────────────────────
    try:
        booking_dt = datetime.fromisoformat(date_time.replace("Z", TIMEZONE_UTC_OFFSET))
        if booking_dt.tzinfo is None:
            booking_dt = booking_dt.replace(tzinfo=timezone.utc)
    except ValueError as exc:
        raise InvalidInputError(
            message=f"Invalid date_time format: {exc}. Use ISO-8601, e.g. 2026-03-15T14:00:00",
            field="date_time",
        ) from exc

    if booking_dt < datetime.now(timezone.utc):
        raise InvalidInputError(
            message="date_time must be in the future",
            field="date_time",
        )

    # ── 4. Calculate pricing ───────────────────────────────────────────────
    has_samagri = booking_type == "with_samagri"
    estimate = PricingService.get_price_estimate(
        base_hourly_rate=base_hourly_rate,
        booking_datetime=booking_dt,
        duration_hours=duration_hours,
        has_samagri=has_samagri,
    )

    pricing = estimate["estimate"]

    # ── 5. Flatten to a frontend-friendly structure ────────────────────────
    surcharges = pricing.get("surcharges", {})
    fees = pricing.get("fees", {})

    acharya_earnings = PricingService.estimate_acharya_earnings(pricing["total"])

    return StandardResponse(
        success=True,
        data={
            "base_price": pricing["base_price"],
            "weekend_surcharge": surcharges.get("weekend", 0.0),
            "peak_hour_adj": surcharges.get("peak_hours", 0.0),
            "off_peak_discount": surcharges.get("off_peak_discount", 0.0),
            "urgent_surcharge": surcharges.get("urgent_booking", 0.0),
            "festival_surcharge": surcharges.get("festival", 0.0),
            "festival_name": surcharges.get("festival_name"),
            "samagri_fee": fees.get("samagri", 0.0),
            "platform_fee": fees.get("platform_fee", 0.0),
            "gst": fees.get("gst", 0.0),
            "subtotal": pricing["subtotal"],
            "total_price": pricing["total"],
            "acharya_earnings": acharya_earnings["acharya_earnings"],
            "duration_hours": duration_hours,
            "currency": "INR",
            "booking_datetime": booking_dt.isoformat(),
        },
    )


@router.get(
    "/check-availability",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Check Acharya Availability",
    description=(
        "Returns whether the requested time slot is available for a given Acharya. "
        "Checks for overlapping confirmed/pending/in-progress bookings. "
        "Also returns the next available slot when unavailable."
    ),
)
async def check_availability(
    acharya_id: str = Query(..., description="Acharya profile ID"),
    date_time: str = Query(..., description="ISO-8601 datetime e.g. 2026-03-15T14:00:00"),
    duration: int = Query(2, ge=1, le=12, description="Booking duration in hours"),
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """
    Slot availability endpoint — called by BookingScreen on every date/time/duration
    change so users see a live available / unavailable indicator before submitting.
    """
    # 1. Validate Acharya
    acharya = await _validate_acharya_id(acharya_id, db)
    if not acharya:
        raise ResourceNotFoundError(resource_type="Acharya", resource_id=acharya_id)

    # 2. Parse requested slot
    requested_start = _parse_requested_start(date_time)
    if requested_start < datetime.now(timezone.utc):
        raise InvalidInputError(
            message="date_time must be in the future",
            field="date_time",
        )
    requested_end = requested_start + timedelta(hours=duration)

    # 3. Fetch active bookings for this acharya spanning a 2-day window
    window_start = requested_start - timedelta(hours=12)
    window_end = requested_end + timedelta(hours=12)
    blocking_statuses = ["confirmed", "pending_payment", "in_progress"]
    candidates_cursor = db.bookings.find(
        {
            "acharya_id": str(acharya["_id"]),
            "status": {"$in": blocking_statuses},
            "scheduled_datetime": {"$gte": window_start, "$lt": window_end},
        },
        {"_id": 1, "scheduled_datetime": 1, "duration_hours": 1},
    )
    candidates = await candidates_cursor.to_list(length=50)

    # 4. Python-side overlap detection
    conflicts, latest_conflict_end = _find_conflicts(candidates, requested_start, requested_end)
    available = len(conflicts) == 0

    # 5. Suggest next free slot (first gap after all conflicts end)
    next_available_slot: Optional[str] = None
    if not available and latest_conflict_end is not None:
        minutes = latest_conflict_end.minute
        round_up = timedelta(minutes=(30 - minutes % 30) % 30) if minutes > 0 else timedelta(0)
        next_slot = latest_conflict_end + round_up
        next_available_slot = next_slot.isoformat()

    return StandardResponse(
        success=True,
        data={
            "available": available,
            "next_available_slot": next_available_slot,
            "conflicts": conflicts,
        },
    )


@router.post(
    "",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Booking",
    description="Create a new pooja booking with payment",
)
async def create_booking(
    booking_data: BookingCreateRequest,
    current_user: Annotated[Dict[str, Any], Depends(get_current_grihasta)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """
    Create booking with slot validation and payment initiation

    Flow:
    1. Validate Acharya and Pooja exist
    2. Check slot availability
    3. Calculate pricing (with coupon if provided)
    4. Create Razorpay order
    5. Create booking record (PENDING_PAYMENT)
    """
    try:
        grihasta_id = _parse_grihasta_id(current_user["id"])
        logger.info(f"Creating booking for grihasta_id: {grihasta_id} (type: {type(grihasta_id)})")

        # 1 & 2. Validate Acharya and Pooja
        acharya, pooja = await _validate_acharya_and_pooja(
            db, booking_data.acharya_id, booking_data.pooja_id
        )

        # 3. Parse datetime (assume UTC)
        booking_datetime = datetime.strptime(
            f"{booking_data.date} {booking_data.time}", "%Y-%m-%d %H:%M"
        ).replace(tzinfo=timezone.utc)

        # 4. Check if datetime is in the future
        if booking_datetime <= datetime.now(timezone.utc):
            raise InvalidInputError(
                message="Booking time must be in the future", field="date_time"
            )

        # 4b. Determine duration
        duration_hours = int(pooja.get("duration_hours", 2)) if pooja else 2

        # 5. Check slot availability (skip for request mode, Acharya will confirm)
        if booking_data.booking_mode == "instant":
            slot_start = booking_datetime
            slot_end = booking_datetime + timedelta(hours=duration_hours)

            await _check_slot_availability(
                db, booking_data.acharya_id, slot_start, slot_end
            )

        pricing_context = await _compute_pricing_context(
            db=db,
            pooja=pooja,
            booking_data=booking_data,
            booking_datetime=booking_datetime,
            duration_hours=duration_hours,
        )

        # Use slot end from pricing context (ensures consistency)
        slot_end = pricing_context["slot_end"]
        platform_fee = pricing_context["platform_fee"]
        total_amount = pricing_context["total_amount"]
        discount = pricing_context["discount"]
        base_price = pricing_context["base_price"]
        samagri_price = pricing_context["samagri_price"]

        # 7. Create Razorpay order (only for instant bookings with pooja)
        razorpay_order_id = _create_razorpay_order(
            booking_data, total_amount, grihasta_id
        )

        # Determine initial status and payment status
        initial_status = BookingStatus.PENDING_PAYMENT
        payment_status = PaymentStatus.PENDING

        if booking_data.booking_mode == "request":
            initial_status = BookingStatus.REQUESTED
            payment_status = (
                PaymentStatus.NOT_REQUIRED
            )  # Payment happens after approval

        # 8. Create booking
        booking = Booking(
            grihasta_id=grihasta_id,
            acharya_id=booking_data.acharya_id,
            pooja_id=booking_data.pooja_id,
            service_name=booking_data.service_name
            or (pooja.get("name") if pooja else None),
            booking_type=booking_data.booking_type,
            booking_mode=booking_data.booking_mode,
            requirements=booking_data.requirements,
            date_time=booking_datetime,
            end_time=slot_end,
            location=booking_data.location,
            status=initial_status,
            payment_status=payment_status,
            base_price=base_price,
            samagri_price=samagri_price,
            platform_fee=platform_fee,
            discount=discount,
            total_amount=total_amount,
            razorpay_order_id=razorpay_order_id,
            coupon_code=booking_data.coupon_code,
            notes=booking_data.notes,
        )

        # Prepare and insert booking using helper
        booking_dict = _prepare_booking_dict(booking)
        logger.info(f"Inserting booking with grihasta_id={booking_dict.get('grihasta_id')} (type: {type(booking_dict.get('grihasta_id'))})")
            
        result = await db.bookings.insert_one(booking_dict)
        booking.id = str(result.inserted_id)

        logger.info(f"Booking created: {booking.id} for Grihasta {grihasta_id}")

        # Send request notification to Acharya
        if booking_data.booking_mode == "request":
            _send_booking_notification(acharya, current_user, pooja, str(booking.id))

        response_message = "Booking created. Please complete payment."
        if booking_data.booking_mode == "request":
            response_message = "Booking requested. Waiting for Acharya approval."

        return StandardResponse(
            success=True,
            data={
                "booking_id": str(booking.id),
                "razorpay_order_id": razorpay_order_id,
                "amount": total_amount,
                "currency": "INR",
                "status": initial_status.value,
            },
            message=response_message,
        )

    except (ResourceNotFoundError, InvalidInputError, SlotUnavailableError):
        raise
    except Exception as e:
        logger.error(f"Create booking error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create booking",
        )


@router.get(
    "",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Bookings",
    description="Get user bookings",
)
async def get_bookings_root(
    status_filter: Annotated[Optional[str], Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Get bookings alias"""
    return await get_my_bookings(status_filter, page, limit, current_user, db)


async def _notify_booking_status_update(
    db: AsyncIOMotorDatabase,
    booking: Dict[str, Any],
    booking_id: str,
    status_update,
    update_doc: Dict[str, Any],
) -> None:
    """Send WS + FCM notifications after a booking status change."""
    try:
        from app.services.websocket_manager import manager  # noqa: PLC0415

        grihasta = await db.users.find_one({"_id": booking.get("grihasta_id")})
        grihasta_id = str(booking.get("grihasta_id"))
        acharya_id = str(booking.get("acharya_id"))

        payment_required = (
            status_update.status == BookingStatus.CONFIRMED.value
            and booking.get("booking_mode") == "request"
            and status_update.amount is not None
        )

        websocket_data = {
            "type": "payment_required" if payment_required else "booking_update",
            "booking_id": booking_id,
            "status": status_update.status,
            "payment_status": update_doc.get("payment_status", booking.get("payment_status")),
            "amount": update_doc.get("total_amount", booking.get("total_amount")),
            "message": f"Booking {status_update.status}",
        }

        await manager.send_personal_message(grihasta_id, websocket_data)
        await manager.send_personal_message(acharya_id, websocket_data)

        if payment_required and grihasta and grihasta.get("fcm_token"):
            try:
                from app.services.notification_service import NotificationService  # noqa: PLC0415

                NotificationService().send_notification(
                    token=grihasta["fcm_token"],
                    title="Booking Approved!",
                    body=f"Acharya approved your request. Amount: \u20B9{status_update.amount}. Please complete payment.",
                    data={
                        "type": "payment_required",
                        "booking_id": booking_id,
                        "amount": str(status_update.amount),
                    },
                )
            except Exception as fcm_exc:  # noqa: BLE001
                logger.warning(f"Failed to send FCM notification: {fcm_exc}")
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Failed to send notifications: {exc}")


async def _check_status_update_permission(
    db: AsyncIOMotorDatabase, booking: Dict[str, Any], user_id: str, user_role: str
) -> None:
    """Check if user has permission to update booking status."""
    if user_role not in [UserRole.ADMIN.value, UserRole.ACHARYA.value]:
        raise PermissionDeniedError(action="Update status")

    if user_role == UserRole.ACHARYA.value:
        acharya_obj = ObjectId(user_id) if ObjectId.is_valid(user_id) else None
        acharya_profile = await db.acharya_profiles.find_one(
            {"user_id": acharya_obj or user_id}, {"_id": 1}
        )
        acharya_profile_id = acharya_profile.get("_id") if acharya_profile else None
        if str(booking.get("acharya_id")) not in [str(acharya_profile_id), user_id]:
            raise PermissionDeniedError(action="Update status")


@router.put(
    "/{booking_id}/status",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Booking Status",
)
async def update_booking_status(
    booking_id: str,
    status_update: BookingStatusUpdateRequest,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Update booking status"""
    # Booking status transition matrix – prevent illegal state changes
    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise ResourceNotFoundError(resource_type="Booking", resource_id=booking_id)

    current_status = booking.get("status", "")
    new_status = status_update.status
    # Validate via central state machine (checks both legality and role permissions)
    _validate_transition(current_status, new_status, current_user["role"])

    # Check permission using helper
    await _check_status_update_permission(db, booking, current_user["id"], current_user["role"])

    update_doc = {
        "status": status_update.status,
        "updated_at": datetime.now(timezone.utc),
    }

    if status_update.amount is not None:
        update_doc["total_amount"] = status_update.amount

    if status_update.notes is not None:
        update_doc["notes"] = status_update.notes

    # For request-mode bookings, when Acharya confirms, auto-generate start OTP and set status to confirmed
    if (
        status_update.status == BookingStatus.CONFIRMED.value
        and booking.get("booking_mode") == "request"
        and not booking.get("start_otp")
    ):
        update_doc["start_otp"] = generate_otp()
        # Set payment status to pending when Acharya confirms request
        update_doc["payment_status"] = PaymentStatus.PENDING.value

    await db.bookings.update_one({"_id": ObjectId(booking_id)}, {"$set": update_doc})

    # Send notifications after status update (includes FCM for payment_required)
    # Note: _notify_booking_status_update also emits the booking_update WS event.
    await _notify_booking_status_update(db, booking, booking_id, status_update, update_doc)

    return StandardResponse(success=True, message="Status updated")


async def _check_cancel_permission(
    db: AsyncIOMotorDatabase, booking: Dict[str, Any], user_id: str, user_role: str
) -> None:
    """Check if user has permission to cancel the booking."""
    if user_role == UserRole.GRIHASTA.value:
        if str(booking["grihasta_id"]) != user_id:
            raise PermissionDeniedError(action=ACTION_CANCEL_BOOKING)
    elif user_role == UserRole.ACHARYA.value:
        acharya_obj = ObjectId(user_id) if ObjectId.is_valid(user_id) else None
        acharya_profile = await db.acharya_profiles.find_one(
            {"user_id": acharya_obj or user_id}, {"_id": 1}
        )
        acharya_profile_id = acharya_profile.get("_id") if acharya_profile else None
        if str(booking["acharya_id"]) not in [str(acharya_profile_id), user_id]:
            raise PermissionDeniedError(action=ACTION_CANCEL_BOOKING)
    elif user_role != UserRole.ADMIN.value:
        raise PermissionDeniedError(action=ACTION_CANCEL_BOOKING)


@router.put(
    "/{booking_id}/cancel",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Cancel Booking",
)
async def cancel_booking(
    booking_id: str,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Cancel booking"""
    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise ResourceNotFoundError(resource_type="Booking", resource_id=booking_id)

    # Check permission using helper
    await _check_cancel_permission(db, booking, current_user["id"], current_user["role"])

    # Validate via central state machine
    current_status = booking.get("status")
    _validate_transition(current_status, BookingStatus.CANCELLED.value, current_user["role"])

    await db.bookings.update_one(
        {"_id": ObjectId(booking_id)},
        {
            "$set": {
                "status": BookingStatus.CANCELLED.value,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    # Emit booking_update WS event to both parties
    await emit_booking_update(db, booking_id, booking, BookingStatus.CANCELLED.value)

    # Trigger Razorpay refund if payment was already collected
    if (
        booking.get("payment_status") == PaymentStatus.COMPLETED.value
        and booking.get("razorpay_payment_id")
    ):
        try:
            from app.services.payment_service import RazorpayService

            razorpay_svc = RazorpayService()
            refund_amount = booking.get("total_amount", 0)
            refund_result = razorpay_svc.initiate_refund(
                payment_id=booking["razorpay_payment_id"],
                amount=refund_amount,
                notes={"reason": "Booking cancelled by user", "booking_id": booking_id},
            )
            await db.bookings.update_one(
                {"_id": ObjectId(booking_id)},
                {
                    "$set": {
                        "payment_status": "refunded",
                        "razorpay_refund_id": refund_result.get("id"),
                        "refund_amount": booking.get("total_amount", 0),
                    }
                },
            )
        except Exception as refund_exc:  # noqa: BLE001
            logger.error(
                f"[cancel_booking] Auto-refund failed for booking {booking_id}: {refund_exc}"
            )
            # Don't block cancellation — refund can be retried manually by admin

    return StandardResponse(success=True, message="Booking cancelled")


@router.post(
    "/{booking_id}/generate-otp",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate OTP",
)
async def generate_attendance_otp(
    booking_id: str,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Generate OTP for attendance"""
    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise ResourceNotFoundError(resource_type="Booking", resource_id=booking_id)

    # Authorization: only booking participants (grihasta or acharya) can generate OTP
    user_id = current_user["id"]
    is_grihasta = str(booking.get("grihasta_id")) == user_id
    is_acharya = str(booking.get("acharya_id")) == user_id
    if not is_grihasta and not is_acharya and current_user.get("role") != "admin":
        raise PermissionDeniedError(action="Generate OTP for this booking")

    otp = generate_otp()

    # Store OTP in booking document with expiry (M8 fix: OTP expires in 30 minutes)
    otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
    await db.bookings.update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {"start_otp": otp, "otp_expires_at": otp_expires_at, "updated_at": datetime.now(timezone.utc)}},
    )

    return StandardResponse(success=True, data={"otp": otp}, message="OTP generated")


@router.post(
    "/{booking_id}/create-payment-order",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Create Payment Order for Request-Mode Booking",
    description="Create Razorpay payment order for approved request-mode bookings",
)
async def create_payment_order_for_request(
    booking_id: str,
    current_user: Annotated[Dict[str, Any], Depends(get_current_grihasta)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """
    Create Razorpay payment order for request-mode bookings after Acharya approval
    """
    try:
        # Get booking
        booking_doc = await db.bookings.find_one({"_id": ObjectId(booking_id)})
        if not booking_doc:
            raise ResourceNotFoundError(resource_type="Booking", resource_id=booking_id)

        # Verify ownership
        if str(booking_doc["grihasta_id"]) != current_user["id"]:
            raise PermissionDeniedError(action="Create payment order")

        # Verify booking is in request mode and confirmed by Acharya
        if booking_doc.get("booking_mode") != "request":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This endpoint is only for request-mode bookings"
            )

        if booking_doc.get("status") != BookingStatus.CONFIRMED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Booking must be confirmed by Acharya before payment"
            )

        # Check if amount is set
        total_amount = booking_doc.get("total_amount", 0)
        if total_amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Booking amount not set by Acharya"
            )

        # Check if payment order already exists
        if booking_doc.get("razorpay_order_id"):
            return StandardResponse(
                success=True,
                data={
                    "razorpay_order_id": booking_doc["razorpay_order_id"],
                    "amount": total_amount,
                    "currency": "INR"
                },
                message="Payment order already exists"
            )

        # Create Razorpay order
        try:
            from app.services.payment_service import PaymentService

            payment_service = PaymentService()
            razorpay_order = payment_service.create_order(
                amount=total_amount,
                currency="INR",
                notes={
                    "grihasta_id": str(booking_doc["grihasta_id"]),
                    "acharya_id": str(booking_doc["acharya_id"]),
                    "booking_id": booking_id,
                    "booking_mode": "request"
                },
            )
            razorpay_order_id = razorpay_order.get("id")
        except Exception as e:
            logger.warning(f"Razorpay order creation warning: {e}")
            # Only allow fallback dev order IDs in non-production environments
            if settings.APP_ENV == "production":
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Payment gateway unavailable. Please try again later.",
                )
            razorpay_order_id = f"order_dev_{secrets.token_hex(8)}"

        # Update booking with razorpay_order_id and payment status
        await db.bookings.update_one(
            {"_id": ObjectId(booking_id)},
            {
                "$set": {
                    "razorpay_order_id": razorpay_order_id,
                    "payment_status": PaymentStatus.PENDING.value,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

        return StandardResponse(
            success=True,
            data={
                "razorpay_order_id": razorpay_order_id,
                "amount": total_amount,
                "currency": "INR",
                "booking_id": booking_id
            },
            message="Payment order created successfully"
        )

    except (ResourceNotFoundError, PermissionDeniedError, HTTPException):
        raise
    except Exception as e:
        logger.error(f"Create payment order error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create payment order"
        )


@router.post(
    "/{booking_id}/payment/verify",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify Payment",
    description="Verify Razorpay payment and confirm booking",
)
async def verify_payment(
    booking_id: str,
    payment_data: Annotated[dict, Body(..., example={"razorpay_payment_id": "pay_xxx", "razorpay_signature": "sig_xxx"})],
    current_user: Annotated[Dict[str, Any], Depends(get_current_grihasta)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """
    Verify Razorpay payment signature and update booking
    Payment credentials sent in request body (not URL) for security.

    SonarQube: S4502 - Webhook signature verification
    """
    razorpay_payment_id = payment_data.get("razorpay_payment_id")
    razorpay_signature = payment_data.get("razorpay_signature")
    if not razorpay_payment_id or not razorpay_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="razorpay_payment_id and razorpay_signature are required",
        )
    try:
        # Get booking and validate ownership
        booking_doc = await _fetch_and_validate_booking(booking_id, current_user, db)

        # Idempotency guard
        idempotent_response = _check_idempotency(booking_doc, booking_id)
        if idempotent_response:
            return idempotent_response

        # Validate state transition
        _validate_transition(
            booking_doc.get("status", ""),
            BookingStatus.CONFIRMED.value,
            current_user["role"],
        )

        # Verify Razorpay signature
        try:
            from app.services.payment_service import RazorpayService
            payment_service = RazorpayService()
            _verify_razorpay_signature(payment_service, booking_doc, razorpay_payment_id, razorpay_signature)
        except Exception as e:
            logger.error(f"Payment verification failed unexpectedly: {e}")
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Payment verification error — please contact support",
            )

        # Update booking status
        start_otp = generate_otp()
        await db.bookings.update_one(
            {"_id": ObjectId(booking_id)},
            {
                "$set": {
                    "status": BookingStatus.CONFIRMED.value,
                    "payment_status": PaymentStatus.COMPLETED.value,
                    "razorpay_payment_id": razorpay_payment_id,
                    "start_otp": start_otp,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

        # Send confirmation notifications
        try:
            from app.services.notification_service import NotificationService
            from app.services.websocket_manager import manager
            notification_service = NotificationService()
            # Notify Grihasta
            grihasta = await db.users.find_one({"_id": ObjectId(booking_doc["grihasta_id"])} )
            if grihasta and grihasta.get("fcm_token"):
                notification_service.send_notification(
                    token=grihasta["fcm_token"],
                    title="Booking Confirmed",
                    body="Your booking is confirmed. Check the app for details.",
                    data={"type": "booking_confirmed", "booking_id": booking_id},
                )
            # Notify Acharya
            acharya_profile = await db.acharya_profiles.find_one({"_id": ObjectId(booking_doc["acharya_id"])} )
            if acharya_profile:
                acharya = await db.users.find_one({"_id": acharya_profile.get("user_id")} )
                if acharya and acharya.get("fcm_token"):
                    notification_service.send_notification(
                        token=acharya["fcm_token"],
                        title="New Booking Confirmed",
                        body="Booking confirmed with payment",
                        data={"type": "booking_confirmed", "booking_id": booking_id},
                    )
            # Emit unified booking_update WS event via state machine helper
            await emit_booking_update(
                db,
                booking_id,
                booking_doc,
                BookingStatus.CONFIRMED.value,
                extra={"payment_status": PaymentStatus.COMPLETED.value},
            )
        except Exception as e:
            logger.warning(f"Failed to send confirmation notifications: {e}")

        logger.info(f"Payment verified for booking {booking_id}")
        return StandardResponse(
            success=True,
            data={
                "booking_id": booking_id,
                "status": BookingStatus.CONFIRMED.value,
                "start_otp": start_otp,
            },
            message="Payment verified. Booking confirmed.",
        )
    except (ResourceNotFoundError, PermissionDeniedError, PaymentFailedError):
        raise
    except Exception as e:
        logger.error(f"Verify payment error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Payment verification failed",
        )


@router.post(
    "/{booking_id}/start",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Start Booking",
    description="Mark booking as started with OTP verification",
)
async def start_booking(
    booking_id: str,
    otp: Annotated[Optional[str], Query(description="OTP from query param")] = None,
    body_otp: Annotated[Optional[Dict[str, Any]], Body(description="OTP from JSON body")] = None,
    current_user: Annotated[Dict[str, Any], Depends(get_current_acharya)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """
    Start booking session with OTP verification
    """
    try:
        # Resolve OTP from query param or JSON body
        resolved_otp = otp
        if not resolved_otp and body_otp and isinstance(body_otp, dict):
            resolved_otp = body_otp.get("otp")
        if not resolved_otp:
            raise InvalidInputError(message="OTP is required", field="otp")

        acharya_id = current_user["id"]
        acharya_obj_id = ObjectId(acharya_id) if ObjectId.is_valid(acharya_id) else None

        # Get booking
        booking_doc = await db.bookings.find_one({"_id": ObjectId(booking_id)})
        if not booking_doc:
            raise ResourceNotFoundError(resource_type="Booking", resource_id=booking_id)

        # Verify Acharya (allow profile id match)
        acharya_profile = await db.acharya_profiles.find_one(
            {"user_id": acharya_obj_id or acharya_id}, {"_id": 1}
        )
        acharya_profile_id = acharya_profile.get("_id") if acharya_profile else None
        if str(booking_doc.get("acharya_id")) not in [str(acharya_profile_id), acharya_id]:
            raise PermissionDeniedError(action="Start booking")

        # Validate state transition via central state machine
        _validate_transition(
            booking_doc["status"],
            BookingStatus.IN_PROGRESS.value,
            current_user["role"],
        )

        # Verify OTP — M8 fix: check expiry
        otp_expires_at = booking_doc.get("otp_expires_at")
        if otp_expires_at and datetime.now(timezone.utc) > otp_expires_at:
            raise InvalidInputError(message="OTP has expired. Please generate a new one.", field="otp")
        if booking_doc.get("start_otp") != resolved_otp:
            raise InvalidInputError(message="Invalid OTP", field="otp")

        # Update to IN_PROGRESS
        await db.bookings.update_one(
            {"_id": ObjectId(booking_id)},
            {
                "$set": {
                    "status": BookingStatus.IN_PROGRESS.value,
                    "started_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

        # Emit booking_update WS event to both parties
        await emit_booking_update(db, booking_id, booking_doc, BookingStatus.IN_PROGRESS.value)

        logger.info(f"Booking {booking_id} started by Acharya {acharya_id}")

        return StandardResponse(success=True, message="Booking started successfully")

    except (ResourceNotFoundError, PermissionDeniedError, InvalidInputError):
        raise
    except Exception as e:
        logger.error(f"Start booking error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start booking",
        )


def _update_attendance_for_user(
    attendance: dict, user_role: str, confirmed: bool
) -> dict:
    """Update attendance confirmation for specific user role"""
    now = datetime.now(timezone.utc)
    if user_role == UserRole.GRIHASTA.value:
        attendance["grihasta_confirmed"] = confirmed
        attendance["grihasta_confirmed_at"] = now
    else:
        attendance["acharya_confirmed"] = confirmed
        attendance["acharya_confirmed_at"] = now
    return attendance


async def _complete_booking_with_notifications(db, booking_id: str, booking_doc: dict):
    """Complete booking and send notifications to both parties"""
    await db.bookings.update_one(
        {"_id": ObjectId(booking_id)},
        {
            "$set": {
                "status": BookingStatus.COMPLETED.value,
                "completed_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    # Emit booking_update WS event immediately after DB write
    await emit_booking_update(db, booking_id, booking_doc, BookingStatus.COMPLETED.value)

    try:
        from app.services.notification_service import NotificationService

        notification_service = NotificationService()

        # Notify Grihasta
        grihasta = await db.users.find_one(
            {"_id": ObjectId(booking_doc["grihasta_id"])}
        )
        if grihasta and grihasta.get("fcm_token"):
            notification_service.send_notification(
                token=grihasta["fcm_token"],
                title=BOOKING_COMPLETED,
                body="Your booking has been completed successfully",
                data={"type": "booking_completed", "booking_id": booking_id},
            )

        # Notify Acharya
        acharya = await db.users.find_one({"_id": ObjectId(booking_doc["acharya_id"])})
        if acharya and acharya.get("fcm_token"):
            notification_service.send_notification(
                token=acharya["fcm_token"],
                title=BOOKING_COMPLETED,
                body="Booking completed. Payment will be transferred.",
                data={"type": "booking_completed", "booking_id": booking_id},
            )
    except Exception as e:
        logger.warning(f"Failed to send completion notification: {e}")


def _verify_booking_participation(
    booking_doc: dict, user_id: str, user_role: str
) -> None:
    """Verify user is participant in booking"""
    acharya_user_id = booking_doc.get("acharya_user_id")
    if (
        (
            user_role == UserRole.GRIHASTA.value
            and str(booking_doc["grihasta_id"]) != user_id
        )
        or (
            user_role == UserRole.ACHARYA.value
            and str(booking_doc["acharya_id"]) != user_id
            and str(acharya_user_id) != user_id
        )
        or (user_role not in [UserRole.GRIHASTA.value, UserRole.ACHARYA.value])
    ):
        raise PermissionDeniedError(action=ERROR_CONFIRM_ATTENDANCE)


async def _update_booking_attendance(
    db: AsyncIOMotorDatabase,
    booking_id: str,
    attendance: dict,
    user_role: str,
    confirmed: bool,
) -> dict:
    """Update attendance confirmation for user role"""
    if user_role == UserRole.GRIHASTA.value:
        attendance["grihasta_confirmed"] = confirmed
        attendance["grihasta_confirmed_at"] = datetime.now(timezone.utc)
    else:
        attendance["acharya_confirmed"] = confirmed
        attendance["acharya_confirmed_at"] = datetime.now(timezone.utc)

    await db.bookings.update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {"attendance": attendance, "updated_at": datetime.now(timezone.utc)}},
    )
    return attendance


@router.post(
    "/{booking_id}/attendance/confirm",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Confirm Attendance",
    description="Two-way attendance confirmation (both parties must confirm)",
)
async def confirm_attendance(
    booking_id: str,
    confirm_data: AttendanceConfirmRequest,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """
    Two-way attendance confirmation

    Both Grihasta and Acharya must confirm attendance within 24 hours
    """
    try:
        user_id = current_user["id"]
        user_role = current_user["role"]

        # Get booking
        booking_doc = await db.bookings.find_one({"_id": ObjectId(booking_id)})
        if not booking_doc:
            raise ResourceNotFoundError(resource_type="Booking", resource_id=booking_id)

        # Verify participation
        _verify_booking_participation(booking_doc, user_id, user_role)

        # Check if booking is completed
        if booking_doc["status"] != BookingStatus.IN_PROGRESS.value:
            raise InvalidInputError(
                message="Attendance can only be confirmed for in-progress bookings",
                field="status",
            )

        # Update attendance confirmation
        attendance = await _update_booking_attendance(
            db,
            booking_id,
            booking_doc.get("attendance", {}),
            user_role,
            confirm_data.confirmed,
        )

        # Check if both confirmed
        if attendance.get("grihasta_confirmed") and attendance.get("acharya_confirmed"):
            # Both confirmed - complete booking
            await _complete_booking_with_notifications(db, booking_id, booking_doc)

            return StandardResponse(
                success=True,
                message="Booking completed successfully. Payment will be transferred to Acharya.",
            )

        return StandardResponse(
            success=True,
            message=f"Attendance confirmed. Waiting for {'Acharya' if user_role == UserRole.GRIHASTA.value else 'Grihasta'} confirmation.",
        )

    except (ResourceNotFoundError, PermissionDeniedError, InvalidInputError):
        raise
    except Exception as e:
        logger.error(f"Confirm attendance error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to confirm attendance",
        )


async def _build_user_booking_query(
    db: AsyncIOMotorDatabase, user_id: str, role: str, status_filter: Optional[str]
) -> Dict[str, Any]:
    """Build query for user's bookings based on role."""
    try:
        user_obj_id = ObjectId(user_id)
    except Exception:
        user_obj_id = None
        logger.warning(f"Could not convert user_id to ObjectId: {user_id}")

    query: Dict[str, Any] = {}
    if role == UserRole.GRIHASTA.value:
        query["grihasta_id"] = user_obj_id if user_obj_id else user_id
        logger.info(f"Grihasta query: {query}")
    elif role == UserRole.ACHARYA.value:
        acharya_profile = await db.acharya_profiles.find_one(
            {"user_id": user_obj_id or user_id}, {"_id": 1}
        )
        acharya_profile_id = acharya_profile.get("_id") if acharya_profile else None
        logger.info(f"Acharya profile lookup: user_id={user_id}, found_profile_id={acharya_profile_id}")
        query["acharya_id"] = acharya_profile_id if acharya_profile_id else (user_obj_id or user_id)
        logger.info(f"Acharya query: {query}")
    else:
        raise PermissionDeniedError(action="View bookings")

    if status_filter:
        query["status"] = status_filter
    return query


def _build_my_bookings_pipeline(
    query: Dict[str, Any], page: int, limit: int
) -> list:
    """Build aggregation pipeline for my-bookings endpoint."""
    return [
        {MONGO_MATCH: query},
        {MONGO_LOOKUP: {"from": "poojas", "localField": "pooja_id", "foreignField": "_id", "as": "pooja"}},
        {MONGO_UNWIND: {"path": "$pooja", "preserveNullAndEmptyArrays": True}},
        {MONGO_LOOKUP: {"from": "acharya_profiles", "localField": "acharya_id", "foreignField": "_id", "as": "acharya"}},
        {MONGO_UNWIND: {"path": "$acharya", "preserveNullAndEmptyArrays": True}},
        {MONGO_LOOKUP: {"from": "users", "localField": "grihasta_id", "foreignField": "_id", "as": "grihasta_user"}},
        {MONGO_UNWIND: {"path": "$grihasta_user", "preserveNullAndEmptyArrays": True}},
        {MONGO_LOOKUP: {"from": "users", "localField": "acharya.user_id", "foreignField": "_id", "as": "acharya_user"}},
        {MONGO_UNWIND: {"path": "$acharya_user", "preserveNullAndEmptyArrays": True}},
        {
            "$addFields": {
                "pooja_name": {MONGO_IF_NULL: [FIELD_POOJA_NAME, FIELD_SERVICE_NAME]},
                "acharya_user_id": "$acharya.user_id",
                "pooja_type": {MONGO_IF_NULL: [FIELD_POOJA_NAME, FIELD_SERVICE_NAME]},
                "grihasta_name": {MONGO_IF_NULL: ["$grihasta_user.full_name", "$grihasta_user.name"]},
                "acharya_name": {MONGO_IF_NULL: ["$acharya.name", "$acharya_user.full_name", "$acharya_user.name"]},
                "scheduled_datetime": "$date_time",
            }
        },
        {MONGO_SORT: {"created_at": -1}},
        {MONGO_SKIP: (page - 1) * limit},
        {MONGO_LIMIT: limit},
    ]


def _serialize_document(doc: Any) -> Any:
    """
    Recursively walk *doc* and convert every ObjectId to a string.
    Lists and nested dicts are walked in-place.  Returns the mutated object.

    This supersedes the flat _serialize_booking_ids() for the detail endpoint
    where joined sub-documents (pooja, acharya, grihasta_user, acharya_user)
    each contain their own ObjectId fields.
    """
    if isinstance(doc, dict):
        for key in doc.keys():
            val = doc[key]
            if isinstance(val, ObjectId):
                doc[key] = str(val)
                if key == "_id":
                    doc["id"] = doc[key]
            elif isinstance(val, (dict, list)):
                doc[key] = _serialize_document(val)
        return doc
    if isinstance(doc, list):
        return [_serialize_document(item) for item in doc]
    if isinstance(doc, ObjectId):
        return str(doc)
    return doc


def _serialize_booking_ids(booking: Dict[str, Any]) -> None:
    """Convert ObjectIds to strings for JSON serialization.

    Delegates to _serialize_document so nested joined sub-documents
    (pooja, acharya, grihasta_user, acharya_user) are also serialised.
    """
    _serialize_document(booking)


@router.get(
    "/my-bookings",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get My Bookings",
    description="Get bookings for current user (Grihasta or Acharya)",
)
# NOSONAR python:S3776 - Complex aggregation pipeline with role-based queries and multiple joins
async def get_my_bookings(
    status_filter: Annotated[Optional[str], Query(description="Filter by status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Get bookings for current user with pagination"""
    try:
        user_id = current_user["id"]
        role = current_user["role"]

        # Build query using helper
        query = await _build_user_booking_query(db, user_id, role, status_filter)
        
        logger.info(f"Final query before pipeline: {query}")
        count_before_pipeline = await db.bookings.count_documents(query)
        logger.info(f"Bookings matching query: {count_before_pipeline}")

        # Build and execute pipeline using helper
        pipeline = _build_my_bookings_pipeline(query, page, limit)
        bookings = await db.bookings.aggregate(pipeline).to_list(length=limit)

        # Serialize ObjectIds using helper
        for booking in bookings:
            _serialize_booking_ids(booking)

        total_count = await db.bookings.count_documents(query)

        return StandardResponse(
            success=True,
            data={
                "bookings": bookings,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "pages": (total_count + limit - 1) // limit,
                },
            },
        )

    except PermissionDeniedError:
        raise
    except Exception as e:
        logger.error(f"Get bookings error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch bookings",
        )


@router.get(
    "/{booking_id}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Booking Details",
    description="Get detailed information about a specific booking",
)
async def get_booking_details(
    booking_id: str,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Get booking details with full information"""
    try:
        # Get booking with aggregation
        pipeline = [
            {MONGO_MATCH: {"_id": ObjectId(booking_id)}},
            {
                MONGO_LOOKUP: {
                    "from": "poojas",
                    "localField": "pooja_id",
                    "foreignField": "_id",
                    "as": "pooja",
                }
            },
            {MONGO_UNWIND: {"path": "$pooja", "preserveNullAndEmptyArrays": True}},
            {
                MONGO_LOOKUP: {
                    "from": "acharya_profiles",
                    "localField": "acharya_id",
                    "foreignField": "_id",
                    "as": "acharya",
                }
            },
            {MONGO_UNWIND: {"path": "$acharya", "preserveNullAndEmptyArrays": True}},
            {
                MONGO_LOOKUP: {
                    "from": "users",
                    "localField": "grihasta_id",
                    "foreignField": "_id",
                    "as": "grihasta_user",
                }
            },
            {"$unwind": {"path": "$grihasta_user", "preserveNullAndEmptyArrays": True}},
            {
                MONGO_LOOKUP: {
                    "from": "users",
                    "localField": "acharya.user_id",
                    "foreignField": "_id",
                    "as": "acharya_user",
                }
            },
            {"$unwind": {"path": "$acharya_user", "preserveNullAndEmptyArrays": True}},
            {
                "$addFields": {
                    "pooja_name": {MONGO_IF_NULL: [FIELD_POOJA_NAME, FIELD_SERVICE_NAME]},
                    "acharya_user_id": "$acharya.user_id",
                    "pooja_type": {MONGO_IF_NULL: [FIELD_POOJA_NAME, FIELD_SERVICE_NAME]},
                    "grihasta_name": {
                        MONGO_IF_NULL: [
                            "$grihasta_user.full_name",
                            "$grihasta_user.name",
                        ]
                    },
                    "acharya_name": {
                        MONGO_IF_NULL: [
                            "$acharya.name",
                            "$acharya_user.full_name",
                            "$acharya_user.name",
                        ]
                    },
                    "scheduled_datetime": "$date_time",
                }
            },
        ]

        bookings = await db.bookings.aggregate(pipeline).to_list(length=1)

        if not bookings:
            raise ResourceNotFoundError(resource_type="Booking", resource_id=booking_id)

        booking = bookings[0]

        # Verify access
        user_role = current_user["role"]
        user_id = current_user["id"]
        acharya_profile_id = booking.get("acharya_id")
        acharya_user_id = booking.get("acharya_user_id")
        if (
            user_role == UserRole.GRIHASTA.value
            and str(booking.get("grihasta_id")) != user_id
        ) or (
            user_role == UserRole.ACHARYA.value
            and (str(acharya_profile_id) != user_id and str(acharya_user_id) != user_id)
        ):
            raise PermissionDeniedError(action=ERROR_VIEW_BOOKING)

        # Recursively convert all ObjectIds (including nested joined sub-documents)
        _serialize_document(booking)

        return StandardResponse(success=True, data=booking)

    except (ResourceNotFoundError, PermissionDeniedError):
        raise
    except Exception as e:
        logger.error(f"Get booking details error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch booking details",
        )


@router.post(
    "/{booking_id}/mark-arrival",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark Acharya Arrival (Location-Verified)",
    description="Verify Acharya's location and mark arrival for event-driven attendance confirmation",
)
async def mark_acharya_arrival(
    booking_id: str,
    location_data: Dict[str, float] = Body(..., example={"lat": 12.9716, "lng": 77.5946}),
    current_user: Annotated[Dict[str, Any], Depends(get_current_acharya)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """
    Mark Acharya arrival with location verification.
    
    Implements Prompt 1: Event-Driven Attendance Verification
    - Validates Acharya is within 150m of booking location using Haversine formula
    - Updates booking status to IN_PROGRESS
    - Broadcasts real-time notification to Grihasta via WebSocket
    
    Args:
        booking_id: The booking to mark arrival for
        location_data: Current coordinates {"lat": float, "lng": float}
        current_user: Authenticated Acharya user
        db: Database connection
    
    Returns:
        Updated booking with attendance confirmation
    
    Raises:
        ValidationError (BKG_004): If location is outside 150m radius
        NotFoundError (BKG_002): If booking not found
        ValidationError (BKG_003): If Acharya not authorized for this booking
    """
    try:
        from app.services.booking_service import verify_location_and_mark_arrival
        from app.services.websocket_manager import manager
        
        acharya_id = current_user["id"]
        
        # Verify location and mark arrival
        updated_booking = await verify_location_and_mark_arrival(
            db=db,
            booking_id=booking_id,
            acharya_id=acharya_id,
            current_coords=location_data,
            websocket_manager=manager,
        )
        
        # Serialize ObjectIds for response
        _serialize_document(updated_booking)
        
        return StandardResponse(
            success=True,
            data=updated_booking,
            message="Arrival confirmed successfully. The Grihasta has been notified.",
        )
    
    except (ValidationError, ResourceNotFoundError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Mark arrival error for booking {booking_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark arrival. Please try again.",
        )
