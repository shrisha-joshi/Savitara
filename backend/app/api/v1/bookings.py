"""
Booking API Endpoints
Handles booking creation, management, and attendance confirmation
SonarQube: S5659 - Secure OTP generation
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Dict, Any, Optional
import logging
from datetime import datetime, timedelta, timezone
import secrets
import string
from bson import ObjectId

from app.schemas.requests import (
    BookingCreateRequest,
    BookingStatusUpdateRequest,
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
)
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
)
from app.db.connection import get_db
from app.models.database import Booking, BookingStatus, PaymentStatus, UserRole


# Module-level constants
BOOKING_COMPLETED = "Booking Completed"

# Valid booking status transitions – enforced in update_booking_status and cancel_booking
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
    new_acharya_id: str,
    notes: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_acharya),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Refer/pass a booking to another Acharya (by Acharya)"""
    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise ResourceNotFoundError(resource_type="Booking", resource_id=booking_id)

    # Only the current assigned Acharya can refer
    if str(booking["acharya_id"]) != current_user["id"]:
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
    """Apply coupon if valid and return discount amount"""
    if not coupon_code:
        return 0.0

    coupon = await db.coupons.find_one(
        {
            "code": coupon_code,
            "is_active": True,
            "valid_from": {"$lte": datetime.now(timezone.utc)},
            "valid_until": {"$gte": datetime.now(timezone.utc)},
        }
    )

    if not coupon:
        return 0.0

    # Check usage limit
    max_uses = coupon.get("max_uses", 0)
    current_uses = coupon.get("used_count", 0)

    if max_uses > 0 and current_uses >= max_uses:
        logger.info(f"Coupon {coupon_code} has reached max usage limit")
        return 0.0

    discount = subtotal * (coupon.get("discount_percentage", 0) / 100)

    # Increment coupon usage count
    await db.coupons.update_one({"_id": coupon["_id"]}, {"$inc": {"used_count": 1}})

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


@router.post(
    "",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Booking",
    description="Create a new pooja booking with payment",
)
# NOSONAR
async def create_booking(
    booking_data: BookingCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_grihasta),
    db: AsyncIOMotorDatabase = Depends(get_db),
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
        grihasta_id = current_user["id"]

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

        booking_dict = booking.model_dump(by_alias=True)
        # Ensure _id is removed if None to allow MongoDB to generate it
        if "_id" in booking_dict and booking_dict["_id"] is None:
            del booking_dict["_id"]
        
        # Remove unique fields that are None to avoid duplicate key errors with sparse indexes
        if "razorpay_order_id" in booking_dict and booking_dict["razorpay_order_id"] is None:
            del booking_dict["razorpay_order_id"]
        if "razorpay_payment_id" in booking_dict and booking_dict["razorpay_payment_id"] is None:
            del booking_dict["razorpay_payment_id"]
            
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
    status_filter: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
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


@router.put(
    "/{booking_id}/status",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Booking Status",
)
async def update_booking_status(
    booking_id: str,
    status_update: BookingStatusUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Update booking status"""
    # Booking status transition matrix – prevent illegal state changes
    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise ResourceNotFoundError(resource_type="Booking", resource_id=booking_id)

    current_status = booking.get("status", "")
    new_status = status_update.status
    if new_status != current_status and new_status not in _BOOKING_TRANSITIONS.get(current_status, []):
        raise InvalidInputError(
            field="status",
            message=f"Cannot transition booking from '{current_status}' to '{new_status}'",
        )

    if current_user["role"] not in [UserRole.ADMIN.value, UserRole.ACHARYA.value]:
        raise PermissionDeniedError(action="Update status")

    if current_user["role"] == UserRole.ACHARYA.value:
        acharya_id = current_user["id"]
        acharya_obj = ObjectId(acharya_id) if ObjectId.is_valid(acharya_id) else None
        acharya_profile = await db.acharya_profiles.find_one(
            {"user_id": acharya_obj or acharya_id}, {"_id": 1}
        )
        acharya_profile_id = acharya_profile.get("_id") if acharya_profile else None
        if str(booking.get("acharya_id")) not in [str(acharya_profile_id), acharya_id]:
            raise PermissionDeniedError(action="Update status")

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

    # Send notifications after status update
    await _notify_booking_status_update(db, booking, booking_id, status_update, update_doc)

    return StandardResponse(success=True, message="Status updated")


@router.put(
    "/{booking_id}/cancel",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Cancel Booking",
)
async def cancel_booking(
    booking_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Cancel booking"""
    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise ResourceNotFoundError(resource_type="Booking", resource_id=booking_id)

    if (
        current_user["role"] == UserRole.GRIHASTA.value
        and current_user["id"] != booking["grihasta_id"]
    ):
        raise PermissionDeniedError(action="Cancel booking")

    await db.bookings.update_one(
        {"_id": ObjectId(booking_id)},
        {
            "$set": {
                "status": BookingStatus.CANCELLED.value,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    # Trigger Razorpay refund if payment was already collected
    if (
        booking.get("payment_status") == PaymentStatus.COMPLETED.value
        and booking.get("razorpay_payment_id")
    ):
        try:
            from app.services.payment_service import RazorpayService

            razorpay_svc = RazorpayService()
            refund_amount_paise = int(booking.get("total_amount", 0) * 100)
            refund_result = razorpay_svc.initiate_refund(
                payment_id=booking["razorpay_payment_id"],
                amount=refund_amount_paise,
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
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Generate OTP for attendance"""
    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise ResourceNotFoundError(resource_type="Booking", resource_id=booking_id)

    otp = generate_otp()

    # Store OTP in booking document
    await db.bookings.update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {"start_otp": otp, "updated_at": datetime.now(timezone.utc)}},
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
    current_user: Dict[str, Any] = Depends(get_current_grihasta),
    db: AsyncIOMotorDatabase = Depends(get_db),
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
            # In development, use dummy order ID
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
    razorpay_payment_id: str,
    razorpay_signature: str,
    current_user: Dict[str, Any] = Depends(get_current_grihasta),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Verify Razorpay payment signature and update booking

    SonarQube: S4502 - Webhook signature verification
    """
    try:
        # Get booking
        booking_doc = await db.bookings.find_one({"_id": ObjectId(booking_id)})
        if not booking_doc:
            raise ResourceNotFoundError(resource_type="Booking", resource_id=booking_id)

        # Verify ownership
        if str(booking_doc["grihasta_id"]) != current_user["id"]:
            raise PermissionDeniedError(action="Verify payment")

        # Verify Razorpay signature
        try:
            from app.services.payment_service import RazorpayService

            payment_service = RazorpayService()
            is_valid = payment_service.verify_payment_signature(
                razorpay_order_id=booking_doc["razorpay_order_id"],
                razorpay_payment_id=razorpay_payment_id,
                razorpay_signature=razorpay_signature,
            )
        except Exception as e:
            logger.error(f"Payment verification failed unexpectedly: {e}")
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Payment verification error — please contact support",
            )

        if not is_valid:
            raise PaymentFailedError(
                order_id=booking_doc["razorpay_order_id"],
                details={"error": "Invalid payment signature"},
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
            grihasta = await db.users.find_one(
                {"_id": ObjectId(booking_doc["grihasta_id"])}
            )
            if grihasta and grihasta.get("fcm_token"):
                notification_service.send_notification(
                    token=grihasta["fcm_token"],
                    title="Booking Confirmed",
                    body=f"Your booking is confirmed. OTP: {start_otp}",
                    data={"type": "booking_confirmed", "booking_id": booking_id},
                )

            # Notify Acharya
            acharya_profile = await db.acharya_profiles.find_one(
                {"_id": ObjectId(booking_doc["acharya_id"])}
            )
            if acharya_profile:
                acharya = await db.users.find_one(
                    {"_id": acharya_profile.get("user_id")}
                )
                if acharya and acharya.get("fcm_token"):
                    notification_service.send_notification(
                        token=acharya["fcm_token"],
                        title="New Booking Confirmed",
                        body=f"Booking confirmed with payment",
                        data={"type": "booking_confirmed", "booking_id": booking_id},
                    )
            
            # Send WebSocket updates to both parties
            grihasta_id = str(booking_doc["grihasta_id"])
            acharya_id = str(booking_doc["acharya_id"])
            
            websocket_data = {
                "type": "booking_update",
                "booking_id": booking_id,
                "status": BookingStatus.CONFIRMED.value,
                "payment_status": PaymentStatus.COMPLETED.value,
                "message": "Payment verified. Booking confirmed."
            }
            
            await manager.send_personal_message(grihasta_id, websocket_data)
            await manager.send_personal_message(acharya_id, websocket_data)
            
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
    otp: str,
    current_user: Dict[str, Any] = Depends(get_current_acharya),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Start booking session with OTP verification
    """
    try:
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

        # Check booking status
        if booking_doc["status"] != BookingStatus.CONFIRMED.value:
            raise InvalidInputError(
                message=f"Cannot start booking with status: {booking_doc['status']}",
                field="status",
            )

        # Verify OTP
        if booking_doc.get("start_otp") != otp:
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
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
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


@router.get(
    "/my-bookings",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get My Bookings",
    description="Get bookings for current user (Grihasta or Acharya)",
)
async def get_my_bookings(
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get bookings for current user with pagination"""
    try:
        user_id = current_user["id"]
        role = current_user["role"]

        try:
            user_obj_id = ObjectId(user_id)
        except Exception:
            user_obj_id = None

        # Build query
        query = {}
        if role == UserRole.GRIHASTA.value:
            query["grihasta_id"] = user_obj_id or user_id
        elif role == UserRole.ACHARYA.value:
            # Acharya bookings are stored by acharya_profile _id; resolve profile by user_id
            acharya_profile = await db.acharya_profiles.find_one(
                {"user_id": user_obj_id or user_id}, {"_id": 1}
            )
            acharya_profile_id = acharya_profile.get("_id") if acharya_profile else None
            query["acharya_id"] = acharya_profile_id or user_obj_id or user_id
        else:
            raise PermissionDeniedError(action="View bookings")

        if status_filter:
            query["status"] = status_filter

        # Get bookings with details
        pipeline = [
            {MONGO_MATCH: query},
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
            {MONGO_UNWIND: {"path": "$grihasta_user", "preserveNullAndEmptyArrays": True}},
            {
                MONGO_LOOKUP: {
                    "from": "users",
                    "localField": "acharya.user_id",
                    "foreignField": "_id",
                    "as": "acharya_user",
                }
            },
            {MONGO_UNWIND: {"path": "$acharya_user", "preserveNullAndEmptyArrays": True}},
            {
                "$addFields": {
                    "pooja_name": {"$ifNull": ["$pooja.name", "$service_name"]},
                    "acharya_user_id": "$acharya.user_id",
                    "pooja_type": {"$ifNull": ["$pooja.name", "$service_name"]},
                    "grihasta_name": {
                        "$ifNull": [
                            "$grihasta_user.full_name",
                            "$grihasta_user.name",
                        ]
                    },
                    "acharya_name": {
                        "$ifNull": [
                            "$acharya.name",
                            "$acharya_user.full_name",
                            "$acharya_user.name",
                        ]
                    },
                    "scheduled_datetime": "$date_time",
                }
            },
            {MONGO_SORT: {"created_at": -1}},
            {MONGO_SKIP: (page - 1) * limit},
            {MONGO_LIMIT: limit},
        ]

        bookings = await db.bookings.aggregate(pipeline).to_list(length=limit)

        # Get total count
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
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
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
                    "pooja_name": {"$ifNull": ["$pooja.name", "$service_name"]},
                    "acharya_user_id": "$acharya.user_id",
                    "pooja_type": {"$ifNull": ["$pooja.name", "$service_name"]},
                    "grihasta_name": {
                        "$ifNull": [
                            "$grihasta_user.full_name",
                            "$grihasta_user.name",
                        ]
                    },
                    "acharya_name": {
                        "$ifNull": [
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

        return StandardResponse(success=True, data=booking)

    except (ResourceNotFoundError, PermissionDeniedError):
        raise
    except Exception as e:
        logger.error(f"Get booking details error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch booking details",
        )
