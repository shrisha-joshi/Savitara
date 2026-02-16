"""
Loyalty Program Service
"""
from enum import Enum
from typing import Dict, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class LoyaltyTier(str, Enum):
    """Loyalty tiers based on booking history"""

    BRONZE = "bronze"  # 0-5 bookings
    SILVER = "silver"  # 6-15 bookings
    GOLD = "gold"  # 16-30 bookings
    PLATINUM = "platinum"  # 31+ bookings


class LoyaltyService:
    """
    Loyalty program service

    Features:
    - Tiered benefits (Bronze, Silver, Gold, Platinum)
    - Points earning on bookings
    - Discount percentages
    - Exclusive perks
    """

    # Tier thresholds (number of completed bookings)
    TIER_THRESHOLDS = {
        LoyaltyTier.BRONZE: 0,
        LoyaltyTier.SILVER: 6,
        LoyaltyTier.GOLD: 16,
        LoyaltyTier.PLATINUM: 31,
    }

    # Discount percentages by tier
    TIER_DISCOUNTS = {
        LoyaltyTier.BRONZE: 0,
        LoyaltyTier.SILVER: 5,
        LoyaltyTier.GOLD: 10,
        LoyaltyTier.PLATINUM: 15,
    }

    # Points per rupee spent
    POINTS_PER_RUPEE = 0.1  # 1 point per ₹10

    @staticmethod
    def calculate_tier(total_bookings: int) -> LoyaltyTier:
        """Determine loyalty tier based on booking count"""
        if total_bookings >= LoyaltyService.TIER_THRESHOLDS[LoyaltyTier.PLATINUM]:
            return LoyaltyTier.PLATINUM
        elif total_bookings >= LoyaltyService.TIER_THRESHOLDS[LoyaltyTier.GOLD]:
            return LoyaltyTier.GOLD
        elif total_bookings >= LoyaltyService.TIER_THRESHOLDS[LoyaltyTier.SILVER]:
            return LoyaltyTier.SILVER
        else:
            return LoyaltyTier.BRONZE

    @staticmethod
    def get_discount_percentage(tier: LoyaltyTier) -> float:
        """Get discount percentage for tier"""
        return LoyaltyService.TIER_DISCOUNTS[tier]

    @staticmethod
    def calculate_points(amount: float) -> int:
        """Calculate points earned for amount spent"""
        return int(amount * LoyaltyService.POINTS_PER_RUPEE)

    @staticmethod
    async def get_user_loyalty(
        db: AsyncIOMotorDatabase, user_id: str
    ) -> Optional[Dict]:
        """Get user's loyalty status"""
        loyalty = await db.user_loyalty.find_one({"user_id": user_id})
        return loyalty

    @staticmethod
    async def initialize_loyalty(db: AsyncIOMotorDatabase, user_id: str) -> Dict:
        """Initialize loyalty account for new user"""
        loyalty = {
            "user_id": user_id,
            "tier": LoyaltyTier.BRONZE.value,
            "points": 0,
            "total_bookings": 0,
            "total_spent": 0.0,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        }

        await db.user_loyalty.insert_one(loyalty)
        logger.info(f"Initialized loyalty account for user {user_id}")
        return loyalty

    @staticmethod
    async def award_points(
        db: AsyncIOMotorDatabase, user_id: str, booking_amount: float
    ) -> Dict:
        """
        Award points after booking completion
        Also updates tier if thresholds are met
        """
        # Get or create loyalty account
        loyalty = await LoyaltyService.get_user_loyalty(db, user_id)
        if not loyalty:
            loyalty = await LoyaltyService.initialize_loyalty(db, user_id)

        # Calculate points
        points_earned = LoyaltyService.calculate_points(booking_amount)

        # Update loyalty
        new_points = loyalty.get("points", 0) + points_earned
        new_bookings = loyalty.get("total_bookings", 0) + 1
        new_total_spent = loyalty.get("total_spent", 0.0) + booking_amount

        # Determine new tier
        new_tier = LoyaltyService.calculate_tier(new_bookings)

        # Update database
        await db.user_loyalty.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "tier": new_tier.value,
                    "points": new_points,
                    "total_bookings": new_bookings,
                    "total_spent": new_total_spent,
                    "updated_at": datetime.now(),
                }
            },
        )

        logger.info(
            f"Awarded {points_earned} points to user {user_id}. "
            f"New tier: {new_tier.value}, Total points: {new_points}"
        )

        return {
            "points_earned": points_earned,
            "total_points": new_points,
            "tier": new_tier.value,
            "tier_upgraded": new_tier.value != loyalty.get("tier"),
        }

    @staticmethod
    async def redeem_points(
        db: AsyncIOMotorDatabase, user_id: str, points: int
    ) -> bool:
        """
        Redeem points (e.g., for discounts)
        Returns True if successful, False if insufficient points
        """
        loyalty = await LoyaltyService.get_user_loyalty(db, user_id)
        if not loyalty or loyalty.get("points", 0) < points:
            return False

        # Deduct points
        await db.user_loyalty.update_one(
            {"user_id": user_id},
            {"$inc": {"points": -points}, "$set": {"updated_at": datetime.now()}},
        )

        logger.info(f"User {user_id} redeemed {points} points")
        return True

    @staticmethod
    def get_tier_benefits(tier: LoyaltyTier) -> Dict:
        """Get benefits for a loyalty tier"""
        benefits = {
            LoyaltyTier.BRONZE: {
                "discount": "0%",
                "priority_support": False,
                "exclusive_acharyas": False,
                "free_cancellation": False,
            },
            LoyaltyTier.SILVER: {
                "discount": "5%",
                "priority_support": True,
                "exclusive_acharyas": False,
                "free_cancellation": "Up to 6 hours before",
            },
            LoyaltyTier.GOLD: {
                "discount": "10%",
                "priority_support": True,
                "exclusive_acharyas": True,
                "free_cancellation": "Up to 12 hours before",
            },
            LoyaltyTier.PLATINUM: {
                "discount": "15%",
                "priority_support": True,
                "exclusive_acharyas": True,
                "free_cancellation": "Up to 24 hours before",
                "dedicated_account_manager": True,
            },
        }

        return benefits.get(tier, benefits[LoyaltyTier.BRONZE])

    @staticmethod
    async def apply_loyalty_discount(
        db: AsyncIOMotorDatabase, user_id: str, amount: float
    ) -> Dict[str, float]:
        """
        Apply loyalty discount to booking amount

        Returns:
            Dict with original amount, discount, and final amount
        """
        loyalty = await LoyaltyService.get_user_loyalty(db, user_id)
        if not loyalty:
            return {
                "original_amount": amount,
                "discount": 0.0,
                "discount_percentage": 0.0,
                "final_amount": amount,
            }

        tier = LoyaltyTier(loyalty["tier"])
        discount_percentage = LoyaltyService.get_discount_percentage(tier)
        discount_amount = amount * (discount_percentage / 100)

        return {
            "original_amount": amount,
            "discount": round(discount_amount, 2),
            "discount_percentage": discount_percentage,
            "final_amount": round(amount - discount_amount, 2),
            "tier": tier.value,
        }
