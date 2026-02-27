"""
Guarantee Service — Money-Back Guarantee Automation
Strategy Report §7.8 Risk #2, Appendix C Obj #4
"""
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


class GuaranteeService:
    """
    Automated money-back guarantee system.
    Triggers full refund when:
    - Acharya doesn't arrive and no backup is available
    - Booking completion falls below guaranteed satisfaction threshold
    """

    @classmethod
    async def process_guarantee_refund(
        cls,
        db: AsyncIOMotorDatabase,
        booking_id: str,
        reason: str,
    ) -> Dict[str, Any]:
        """
        Process a money-back guarantee refund.
        """
        booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
        if not booking:
            raise ValueError(f"Booking {booking_id} not found")

        grihasta_id = booking["grihasta_id"]
        amount = booking.get("total_amount", 0)

        if amount <= 0:
            return {"refunded": False, "reason": "No payment to refund"}

        # Check if already refunded
        existing_refund = await db.guarantee_refunds.find_one(
            {"booking_id": booking_id}
        )
        if existing_refund:
            return {"refunded": False, "reason": "Already refunded"}

        # Create refund record
        refund_doc = {
            "booking_id": booking_id,
            "grihasta_id": grihasta_id,
            "acharya_id": booking.get("acharya_id"),
            "amount": amount,
            "reason": reason,
            "status": "processed",
            "created_at": datetime.now(timezone.utc),
        }
        await db.guarantee_refunds.insert_one(refund_doc)

        # Credit Grihasta wallet
        await db.wallets.update_one(
            {"user_id": grihasta_id},
            {"$inc": {"balance": amount}},
            upsert=True,
        )

        # Record wallet transaction
        await db.wallet_transactions.insert_one({
            "user_id": grihasta_id,
            "type": "guarantee_refund",
            "amount": amount,
            "description": f"Money-back guarantee: {reason}",
            "reference_id": booking_id,
            "created_at": datetime.now(timezone.utc),
        })

        # Update booking status
        await db.bookings.update_one(
            {"_id": ObjectId(booking_id)},
            {
                "$set": {
                    "payment_status": "refunded",
                    "refund_reason": reason,
                    "refunded_at": datetime.now(timezone.utc),
                }
            },
        )

        # Notify Grihasta
        await db.notifications.insert_one({
            "user_id": grihasta_id,
            "type": "guarantee_refund",
            "title": "Refund Processed",
            "body": f"₹{amount} has been refunded to your wallet under our money-back guarantee.",
            "data": {"booking_id": booking_id, "amount": amount},
            "read": False,
            "created_at": datetime.now(timezone.utc),
        })

        logger.info(f"Guarantee refund: ₹{amount} for booking {booking_id} — {reason}")

        return {
            "refunded": True,
            "amount": amount,
            "booking_id": booking_id,
            "reason": reason,
        }

    @classmethod
    async def check_no_show_refunds(
        cls, db: AsyncIOMotorDatabase
    ) -> int:
        """
        Scheduled job: Auto-refund bookings cancelled due to no-show
        with no backup available.
        """
        cancelled_bookings = await db.bookings.find({
            "status": "cancelled",
            "cancel_reason": "no_show_no_backup",
            "payment_status": {"$nin": ["refunded", "not_required"]},
        }).to_list(length=50)

        refunded = 0
        for booking in cancelled_bookings:
            try:
                result = await cls.process_guarantee_refund(
                    db,
                    str(booking["_id"]),
                    "Acharya no-show — no backup available",
                )
                if result["refunded"]:
                    refunded += 1
            except Exception as e:
                logger.error(f"Refund failed for booking {booking['_id']}: {e}")

        if refunded:
            logger.info(f"Processed {refunded} guarantee refunds")
        return refunded

    @classmethod
    async def get_guarantee_policy(cls) -> Dict[str, Any]:
        """Return the current guarantee policy details"""
        return {
            "money_back_guarantee": True,
            "eligible_scenarios": [
                "Acharya no-show with no backup available",
                "Booking cancelled by platform due to quality issues",
                "Service not completed as described",
            ],
            "refund_method": "Wallet credit (instant)",
            "processing_time": "Immediate for eligible cases",
            "coverage": "100% of booking amount",
        }
