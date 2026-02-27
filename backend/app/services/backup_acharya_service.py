"""
Backup Acharya Service — Auto-reassignment on No-Show
Strategy Report §10.1 O1, Appendix C Obj #4
"""
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

# Config
NO_SHOW_THRESHOLD_MINUTES = 30  # Acharya must confirm within 30 min of booking start

# MongoDB operator constants
MATCH_OP = "$match"


class BackupAcharyaService:
    """
    Detects Acharya no-shows and auto-reassigns bookings to backup Acharyas.
    Flow:
    1. Detect no-show (Acharya doesn't confirm OTP within threshold)
    2. Find nearest available backup Acharya in same city/specialization
    3. Reassign booking
    4. Notify Grihasta and original/backup Acharyas
    """

    @classmethod
    async def find_backup_acharya(
        cls,
        db: AsyncIOMotorDatabase,
        booking: Dict[str, Any],
        exclude_acharya_id: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Find an available backup Acharya for the booking.
        Matches by: city, specialization, availability on booking date.
        """
        # Get original Acharya's profile to match specializations
        original_profile = await db.acharya_profiles.find_one(
            {"user_id": exclude_acharya_id}
        )
        if not original_profile:
            return None

        city = original_profile.get("location", {}).get("city", "")
        specializations = original_profile.get("specializations", [])

        # Find alternative Acharyas in same city with overlapping specializations
        pipeline = [
            {
                MATCH_OP: {
                    "user_id": {"$ne": exclude_acharya_id},
                    "location.city": city,
                    "specializations": {"$in": specializations},
                    "is_available": True,
                }
            },
            {
                "$lookup": {
                    "from": "users",
                    "let": {"uid": {"$toObjectId": "$user_id"}},
                    "pipeline": [
                        {MATCH_OP: {"$expr": {"$eq": ["$_id", "$$uid"]}}},
                        {MATCH_OP: {"status": "active"}},
                    ],
                    "as": "user",
                }
            },
            {MATCH_OP: {"user": {"$ne": []}}},
            {"$sort": {"rating": -1}},  # Prefer highest-rated
            {"$limit": 1},
        ]

        results = await db.acharya_profiles.aggregate(pipeline).to_list(length=1)
        return results[0] if results else None

    @classmethod
    async def reassign_booking(
        cls,
        db: AsyncIOMotorDatabase,
        booking_id: str,
        new_acharya_id: str,
        reason: str = "no_show",
    ) -> Dict[str, Any]:
        """Reassign a booking to a backup Acharya"""
        booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
        if not booking:
            raise ValueError(f"Booking {booking_id} not found")

        original_acharya_id = booking["acharya_id"]

        # Update booking
        await db.bookings.update_one(
            {"_id": ObjectId(booking_id)},
            {
                "$set": {
                    "acharya_id": new_acharya_id,
                    "reassigned": True,
                    "reassignment_reason": reason,
                    "original_acharya_id": original_acharya_id,
                    "reassigned_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

        # Create reassignment record
        reassignment_doc = {
            "booking_id": booking_id,
            "original_acharya_id": original_acharya_id,
            "new_acharya_id": new_acharya_id,
            "reason": reason,
            "created_at": datetime.now(timezone.utc),
        }
        await db.booking_reassignments.insert_one(reassignment_doc)

        logger.info(
            f"Booking {booking_id} reassigned: {original_acharya_id} → {new_acharya_id} ({reason})"
        )

        return {
            "booking_id": booking_id,
            "original_acharya_id": original_acharya_id,
            "new_acharya_id": new_acharya_id,
            "reassigned": True,
        }

    @classmethod
    async def check_and_reassign_no_shows(
        cls,
        db: AsyncIOMotorDatabase,
    ) -> List[Dict[str, Any]]:
        """
        Scheduled job: Check for bookings past their start time
        where Acharya hasn't confirmed OTP within threshold.
        Auto-reassign to backup if available.
        """
        from app.services.penalty_service import PenaltyService

        now = datetime.now(timezone.utc)
        reassigned = []

        # Find confirmed bookings past start time without OTP confirmation
        overdue_bookings = await db.bookings.find({
            "status": "confirmed",
            "date_time": {"$lt": now},
            "start_otp_verified": {"$ne": True},
            "reassigned": {"$ne": True},
        }).to_list(length=50)

        for booking in overdue_bookings:
            booking_id = str(booking["_id"])
            acharya_id = booking["acharya_id"]

            # Find backup
            backup = await cls.find_backup_acharya(db, booking, acharya_id)

            if backup:
                result = await cls.reassign_booking(
                    db, booking_id, backup["user_id"], reason="no_show"
                )
                reassigned.append(result)

                # Create notification for Grihasta
                await db.notifications.insert_one({
                    "user_id": booking["grihasta_id"],
                    "type": "booking_reassigned",
                    "title": "Acharya Reassigned",
                    "body": "Your booking has been reassigned to another qualified Acharya.",
                    "data": {"booking_id": booking_id},
                    "read": False,
                    "created_at": now,
                })
            else:
                # No backup available — mark for refund
                await db.bookings.update_one(
                    {"_id": booking["_id"]},
                    {"$set": {"status": "cancelled", "cancel_reason": "no_show_no_backup"}},
                )

            # Assess penalty on original Acharya regardless
            await PenaltyService.assess_penalty(db, acharya_id, booking_id, "no_show")

        if reassigned:
            logger.info(f"Auto-reassigned {len(reassigned)} no-show bookings")

        return reassigned
