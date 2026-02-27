"""
Payments API Endpoints
Handles payment initiation, verification, and history
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Annotated, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from bson import ObjectId
import logging

from app.db.connection import get_db
from app.core.security import get_current_user
from app.services.payment_service import RazorpayService
from app.core.exceptions import ResourceNotFoundError, PaymentFailedError
from app.schemas.requests import StandardResponse

router = APIRouter(prefix="/payments", tags=["Payments"])
razorpay_service = RazorpayService()
logger = logging.getLogger(__name__)

# Constants
PAYMENT_NOT_FOUND_MSG = "Payment not found"


# --- Request Schemas ---
class PaymentInitiateRequest(BaseModel):
    amount: float = Field(..., gt=0)
    booking_id: Optional[str] = None
    purpose: str = "booking"  # 'booking', 'wallet_recharge'


class PaymentVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class RefundRequest(BaseModel):
    amount: Optional[float] = None  # Partial refund


# --- Endpoints ---


@router.post(
    "/initiate",
    response_model=StandardResponse,
    responses={500: {"description": "Payment initiation failed"}},
)
async def initiate_payment(
    request: PaymentInitiateRequest,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Initiate a Razorpay payment"""
    try:
        # Create Razorpay Order
        order_data = razorpay_service.create_order(
            amount=request.amount,
            notes={
                "user_id": current_user["id"],
                "booking_id": request.booking_id,
                "purpose": request.purpose,
            },
        )

        # Save pending payment record
        payment_record = {
            "user_id": current_user["id"],
            "amount": request.amount,
            "currency": order_data["currency"],
            "razorpay_order_id": order_data["order_id"],
            "status": "created",
            "purpose": request.purpose,
            "booking_id": request.booking_id,
            "created_at": datetime.now(timezone.utc),
        }

        result = await db.payments.insert_one(payment_record)

        return StandardResponse(
            success=True,
            data={
                "payment_id": str(result.inserted_id),
                "razorpay_order_id": order_data["order_id"],
                "amount": request.amount,
                "currency": order_data["currency"],
            },
        )
    except Exception as e:
        logger.error(f"Payment initiation error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Payment initiation failed. Please try again.",
        )


@router.post(
    "/verify",
    response_model=StandardResponse,
    responses={
        400: {"description": "Signature verification failed"},
        404: {"description": "Payment record not found"},
        500: {"description": "Payment verification failed"},
    },
)
async def verify_payment(
    request: PaymentVerifyRequest,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Verify Razorpay signature"""
    try:
        # Verify signature
        is_valid = razorpay_service.verify_payment_signature(
            request.razorpay_order_id,
            request.razorpay_payment_id,
            request.razorpay_signature,
        )

        if not is_valid:
            raise PaymentFailedError(
                order_id=request.razorpay_order_id,
                details={"reason": "Invalid Signature"},
            )

        # Update Payment Record — filter by user_id to prevent IDOR
        update_result = await db.payments.find_one_and_update(
            {
                "razorpay_order_id": request.razorpay_order_id,
                "user_id": current_user["id"],
            },
            {
                "$set": {
                    "razorpay_payment_id": request.razorpay_payment_id,
                    "razorpay_signature": request.razorpay_signature,
                    "status": "captured",
                    "updated_at": datetime.now(timezone.utc),
                }
            },
            return_document=True,
        )

        if not update_result:
            raise ResourceNotFoundError(message="Payment order not found")

        # Note: Post-payment logic (booking status update, wallet credit) is handled
        # by the /bookings/{id}/payment/verify endpoint which updates booking status

        return StandardResponse(
            success=True,
            data={"status": "captured", "payment_id": str(update_result["_id"])},
        )

    except PaymentFailedError:
        raise HTTPException(status_code=400, detail="Signature verification failed")
    except ResourceNotFoundError:
        raise HTTPException(status_code=404, detail="Payment record not found")
    except Exception as e:
        logger.error(f"Payment verification error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Payment verification failed")


@router.get("/history", response_model=StandardResponse)
async def get_payment_history(
    page: Annotated[int, Query(ge=1, description="Page number")] = 1,
    limit: Annotated[int, Query(ge=1, le=100, description="Items per page")] = 20,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    query = {"user_id": current_user["id"]}
    total_count = await db.payments.count_documents(query)
    cursor = db.payments.find(query).sort("created_at", -1).skip((page - 1) * limit).limit(limit)
    payments = await cursor.to_list(length=limit)
    # Convert ObjectIds
    for p in payments:
        p["id"] = str(p.pop("_id"))

    return StandardResponse(success=True, data={
        "payments": payments,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total_count,
            "pages": (total_count + limit - 1) // limit,
        },
    })


@router.get("/{payment_id}", response_model=StandardResponse)
async def get_payment_details(
    payment_id: str,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    try:
        payment = await db.payments.find_one(
            {"_id": ObjectId(payment_id), "user_id": current_user["id"]}
        )
        if not payment:
            raise ResourceNotFoundError(message=PAYMENT_NOT_FOUND_MSG)

        payment["id"] = str(payment.pop("_id"))
        return StandardResponse(success=True, data=payment)
    except ResourceNotFoundError:
        raise
    except (ValueError, TypeError) as e:
        logger.error(f"Error fetching payment {payment_id}: {e}")
        raise ResourceNotFoundError(message=PAYMENT_NOT_FOUND_MSG) from e


@router.post("/{payment_id}/refund", response_model=StandardResponse)
async def initiate_refund(
    payment_id: str,
    request: RefundRequest = RefundRequest(),  # optional body
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    payment = await db.payments.find_one(
        {"_id": ObjectId(payment_id), "user_id": current_user["id"]}
    )
    if not payment:
        raise ResourceNotFoundError(message=PAYMENT_NOT_FOUND_MSG)

    # Prevent refund on non-captured or already-refunded payments
    if payment.get("status") != "captured":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot refund payment with status '{payment.get('status')}'. Only captured payments can be refunded.",
        )

    # Validate refund amount
    refund_amount: Optional[float] = getattr(request, "amount", None)
    if refund_amount is not None and refund_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Refund amount must be positive",
        )

    # Initiate refund via Razorpay
    razorpay_payment_id = payment.get("razorpay_payment_id")
    if not razorpay_payment_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No Razorpay payment ID found for this payment",
        )

    try:
        refund_result = razorpay_service.initiate_refund(
            payment_id=razorpay_payment_id,
            amount=refund_amount,
            notes={"internal_payment_id": payment_id},
        )
    except Exception as exc:
        logger.error(f"Razorpay refund failed for {payment_id}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Refund initiation failed. Please contact support.",
        )

    await db.payments.update_one(
        {"_id": ObjectId(payment_id)},
        {
            "$set": {
                "status": "refunded",
                "razorpay_refund_id": refund_result.get("refund_id"),
                "refund_amount": refund_result.get("amount"),
                "refund_processed_at": datetime.now(timezone.utc),
            }
        },
    )

    return StandardResponse(success=True, data={"status": "refunded", **refund_result})


@router.get("/refunds/{refund_id}", response_model=StandardResponse)
async def get_refund_status(
    refund_id: str,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Look up a refund by its Razorpay refund ID stored in the payments collection."""
    payment = await db.payments.find_one(
        {"razorpay_refund_id": refund_id, "user_id": current_user["id"]}
    )
    if not payment:
        raise ResourceNotFoundError(message="Refund not found")

    return StandardResponse(
        success=True,
        data={
            "refund_id": refund_id,
            "status": payment.get("status", "unknown"),
            "amount": payment.get("refund_amount"),
            "processed_at": payment.get("refund_processed_at"),
        },
    )
