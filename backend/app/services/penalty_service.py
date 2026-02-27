"""
Penalty Service — Acharya No-Show Penalty System
Strategy Report §10.1 O1, §5.1 S1
"""
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

# Penalty configuration
PENALTY_TIERS = {
    "first_offense": {"amount": 200, "action": "warning"},      # ₹200 + warning
    "second_offense": {"amount": 500, "action": "warning"},     # ₹500 + warning
    "third_offense": {"amount": 1000, "action": "suspension"},  # ₹1000 + 7-day suspension
    "repeat_offender": {"amount": 2000, "action": "ban"},       # ₹2000 + permanent ban review
}


class PenaltyService:
    """Manages no-show penalties for Acharyas"""

    @classmethod
    async def assess_penalty(
        cls,
        db: AsyncIOMotorDatabase,
        acharya_id: str,
        booking_id: str,
        penalty_type: str = "no_show",
    ) -> Dict[str, Any]:
        """
        Assess a penalty against an Acharya for a no-show or violation.
        Penalty severity escalates with repeated offenses.
        """
        # Count previous penalties
        prev_count = await db.penalties.count_documents(
            {"acharya_id": acharya_id, "status": {"$ne": "reversed"}}
        )

        # Determine tier
        if prev_count == 0:
            tier = PENALTY_TIERS["first_offense"]
            tier_name = "first_offense"
        elif prev_count == 1:
            tier = PENALTY_TIERS["second_offense"]
            tier_name = "second_offense"
        elif prev_count == 2:
            tier = PENALTY_TIERS["third_offense"]
            tier_name = "third_offense"
        else:
            tier = PENALTY_TIERS["repeat_offender"]
            tier_name = "repeat_offender"

        penalty_doc = {
            "acharya_id": acharya_id,
            "booking_id": booking_id,
            "penalty_type": penalty_type,
            "tier": tier_name,
            "amount": tier["amount"],
            "action": tier["action"],
            "offense_number": prev_count + 1,
            "status": "active",
            "created_at": datetime.now(timezone.utc),
        }

        result = await db.penalties.insert_one(penalty_doc)
        penalty_doc["_id"] = str(result.inserted_id)

        # Deduct from wallet
        await db.wallets.update_one(
            {"user_id": acharya_id},
            {"$inc": {"balance": -tier["amount"]}},
        )

        # Record wallet transaction
        await db.wallet_transactions.insert_one({
            "user_id": acharya_id,
            "type": "penalty",
            "amount": -tier["amount"],
            "description": f"No-show penalty (offense #{prev_count + 1})",
            "reference_id": booking_id,
            "created_at": datetime.now(timezone.utc),
        })

        # Apply suspension if needed
        if tier["action"] == "suspension":
            await db.users.update_one(
                {"_id": ObjectId(acharya_id)},
                {"$set": {"status": "suspended", "suspended_until": datetime.now(timezone.utc)}},
            )
            logger.warning(f"Acharya {acharya_id} suspended for repeated no-shows")
        elif tier["action"] == "ban":
            await db.users.update_one(
                {"_id": ObjectId(acharya_id)},
                {"$set": {"status": "suspended"}},
            )
            logger.warning(f"Acharya {acharya_id} flagged for ban review — repeat offender")

        logger.info(
            f"Penalty assessed: Acharya={acharya_id}, Booking={booking_id}, "
            f"Tier={tier_name}, Amount=₹{tier['amount']}"
        )

        return penalty_doc

    @classmethod
    async def get_acharya_penalties(
        cls,
        db: AsyncIOMotorDatabase,
        acharya_id: str,
        page: int = 1,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """Get penalty history for an Acharya"""
        skip = (page - 1) * limit
        total = await db.penalties.count_documents({"acharya_id": acharya_id})

        penalties = await db.penalties.find(
            {"acharya_id": acharya_id}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)

        for p in penalties:
            p["_id"] = str(p["_id"])

        return {
            "penalties": penalties,
            "total": total,
            "page": page,
            "limit": limit,
        }

    @classmethod
    async def reverse_penalty(
        cls,
        db: AsyncIOMotorDatabase,
        penalty_id: str,
        admin_id: str,
        reason: str,
    ) -> Optional[Dict[str, Any]]:
        """Reverse a penalty (admin action)"""
        penalty = await db.penalties.find_one({"_id": ObjectId(penalty_id)})
        if not penalty:
            return None

        # Mark as reversed
        await db.penalties.update_one(
            {"_id": ObjectId(penalty_id)},
            {
                "$set": {
                    "status": "reversed",
                    "reversed_by": admin_id,
                    "reverse_reason": reason,
                    "reversed_at": datetime.now(timezone.utc),
                }
            },
        )

        # Refund wallet
        await db.wallets.update_one(
            {"user_id": penalty["acharya_id"]},
            {"$inc": {"balance": penalty["amount"]}},
        )

        await db.wallet_transactions.insert_one({
            "user_id": penalty["acharya_id"],
            "type": "penalty_reversal",
            "amount": penalty["amount"],
            "description": f"Penalty reversed: {reason}",
            "reference_id": str(penalty_id),
            "created_at": datetime.now(timezone.utc),
        })

        logger.info(f"Penalty {penalty_id} reversed by admin {admin_id}: {reason}")
        return {**penalty, "_id": str(penalty["_id"]), "status": "reversed"}
