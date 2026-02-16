"""
Gamification Service
Handles coins, points, vouchers, coupons, loyalty tiers, referrals
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Tuple
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
import random
import string

from app.models.gamification import (
    CoinTransaction,
    PointsTransaction,
    Voucher,
    UserVoucher,
    CouponUsage,
    PriceDisplay,
    Referral,
    ActionType,
    LoyaltyTier,
    AcharyaTier,
    COIN_REWARDS,
    LOYALTY_TIERS,
    ACHARYA_TIERS,
    COINS_TO_RUPEES,
    MAX_COIN_REDEMPTION_PERCENT,
)


class GamificationService:
    """Service for all gamification features"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.coins_collection = db.user_coins
        self.coin_transactions = db.coin_transactions
        self.points_collection = db.user_loyalty
        self.points_transactions = db.points_transactions
        self.vouchers = db.vouchers
        self.user_vouchers = db.user_vouchers
        self.coupons = db.coupons
        self.coupon_usage = db.coupon_usage
        self.pricing_rules = db.pricing_rules
        self.referrals = db.referrals
        self.daily_rewards = db.daily_rewards
        self.user_streaks = db.user_streaks
        self.milestones = db.milestones

    # ==================== Coins System ====================

    async def award_coins(
        self,
        user_id: str,
        action: ActionType,
        reference_id: Optional[str] = None,
        custom_amount: Optional[int] = None,
        description: Optional[str] = None,
    ) -> Dict:
        """Award coins to user for an action"""
        # Get coin amount
        amount = custom_amount or COIN_REWARDS.get(action, 0)

        if amount <= 0:
            return {"success": False, "message": "Invalid coin amount"}

        # Get or create user coins record
        user_coins = await self.coins_collection.find_one({"user_id": user_id})

        if not user_coins:
            user_coins = {
                "user_id": user_id,
                "total_earned": 0,
                "total_redeemed": 0,
                "current_balance": 0,
                "lifetime_balance": 0,
                "last_updated": datetime.now(timezone.utc),
            }
            await self.coins_collection.insert_one(user_coins)

        # Update balances
        new_balance = user_coins["current_balance"] + amount

        await self.coins_collection.update_one(
            {"user_id": user_id},
            {
                "$inc": {
                    "total_earned": amount,
                    "current_balance": amount,
                    "lifetime_balance": amount,
                },
                "$set": {"last_updated": datetime.now(timezone.utc)},
            },
        )

        # Create transaction record
        transaction = CoinTransaction(
            user_id=user_id,
            transaction_type="earned",
            amount=amount,
            action=action,
            description=description or f"Earned {amount} coins for {action.value}",
            reference_id=reference_id,
            balance_after=new_balance,
            expires_at=datetime.now(timezone.utc) + timedelta(days=365),
        )

        await self.coin_transactions.insert_one(
            transaction.dict(by_alias=True, exclude={"id"})
        )

        # Check for milestones
        await self._check_coin_milestones(user_id, new_balance)

        return {
            "success": True,
            "coins_awarded": amount,
            "new_balance": new_balance,
            "action": action.value,
        }

    async def redeem_coins(
        self, user_id: str, amount: int, booking_id: str, booking_amount: float
    ) -> Dict:
        """Redeem coins for booking discount"""
        # Validate amount
        max_redemption = int(
            booking_amount * MAX_COIN_REDEMPTION_PERCENT / 100 / COINS_TO_RUPEES
        )

        if amount > max_redemption:
            return {
                "success": False,
                "message": f"Maximum {max_redemption} coins can be redeemed (30% of booking)",
            }

        # Check balance
        user_coins = await self.coins_collection.find_one({"user_id": user_id})

        if not user_coins or user_coins["current_balance"] < amount:
            return {"success": False, "message": "Insufficient coins balance"}

        # Calculate discount
        discount = amount * COINS_TO_RUPEES
        new_balance = user_coins["current_balance"] - amount

        # Update balance
        await self.coins_collection.update_one(
            {"user_id": user_id},
            {
                "$inc": {"total_redeemed": amount, "current_balance": -amount},
                "$set": {"last_updated": datetime.now(timezone.utc)},
            },
        )

        # Create transaction
        transaction = CoinTransaction(
            user_id=user_id,
            transaction_type="redeemed",
            amount=-amount,
            description=f"Redeemed {amount} coins for ₹{discount:.2f} discount",
            reference_id=booking_id,
            balance_after=new_balance,
        )

        await self.coin_transactions.insert_one(
            transaction.dict(by_alias=True, exclude={"id"})
        )

        return {
            "success": True,
            "coins_redeemed": amount,
            "discount_amount": discount,
            "new_balance": new_balance,
        }

    async def get_user_coins(self, user_id: str) -> Dict:
        """Get user's coin balance and recent transactions"""
        user_coins = await self.coins_collection.find_one({"user_id": user_id})

        if not user_coins:
            return {
                "current_balance": 0,
                "total_earned": 0,
                "total_redeemed": 0,
                "lifetime_balance": 0,
                "recent_transactions": [],
            }

        # Get recent transactions
        transactions = (
            await self.coin_transactions.find({"user_id": user_id})
            .sort("created_at", -1)
            .limit(20)
            .to_list(20)
        )

        return {
            "current_balance": user_coins["current_balance"],
            "total_earned": user_coins["total_earned"],
            "total_redeemed": user_coins["total_redeemed"],
            "lifetime_balance": user_coins["lifetime_balance"],
            "rupees_value": user_coins["current_balance"] * COINS_TO_RUPEES,
            "recent_transactions": transactions,
        }

    # ==================== Points & Loyalty System ====================

    async def award_points(
        self,
        user_id: str,
        amount: int,
        action: ActionType,
        reference_id: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Dict:
        """Award points to user"""
        # Get user loyalty
        loyalty = await self.points_collection.find_one({"user_id": user_id})

        if not loyalty:
            # Determine role
            user = await self.db.users.find_one({"_id": ObjectId(user_id)})
            role = user.get("role", "grihasta")

            loyalty = {
                "user_id": user_id,
                "role": role,
                "current_tier": LoyaltyTier.BRONZE.value
                if role == "grihasta"
                else AcharyaTier.RISING_STAR.value,
                "points": 0,
                "tier_progress": 0.0,
                "discount_percentage": 5 if role == "grihasta" else 0,
                "coin_multiplier": 1.0,
                "last_updated": datetime.now(timezone.utc),
            }
            await self.points_collection.insert_one(loyalty)

        # Update points
        new_points = loyalty["points"] + amount

        # Calculate new tier
        new_tier, tier_data = self._calculate_tier(new_points, loyalty["role"])

        await self.points_collection.update_one(
            {"user_id": user_id},
            {
                "$inc": {"points": amount},
                "$set": {
                    "current_tier": new_tier,
                    "discount_percentage": tier_data.get(
                        "discount", tier_data.get("commission_reduction", 0)
                    ),
                    "coin_multiplier": tier_data.get("multiplier", 1.0),
                    "last_updated": datetime.now(timezone.utc),
                },
            },
        )

        # Create transaction
        transaction = PointsTransaction(
            user_id=user_id,
            amount=amount,
            action=action,
            description=description or f"Earned {amount} points for {action.value}",
            reference_id=reference_id,
            balance_after=new_points,
        )

        await self.points_transactions.insert_one(
            transaction.dict(by_alias=True, exclude={"id"})
        )

        # Check tier upgrade
        tier_upgraded = new_tier != loyalty["current_tier"]

        return {
            "success": True,
            "points_awarded": amount,
            "new_balance": new_points,
            "current_tier": new_tier,
            "tier_upgraded": tier_upgraded,
        }

    def _calculate_tier(self, points: int, role: str) -> Tuple[str, Dict]:
        """Calculate tier based on points"""
        tiers = LOYALTY_TIERS if role == "grihasta" else ACHARYA_TIERS

        for tier_name, tier_data in tiers.items():
            if tier_data["min"] <= points <= tier_data["max"]:
                return tier_name.value, tier_data

        return list(tiers.keys())[0].value, list(tiers.values())[0]

    async def get_user_loyalty(self, user_id: str) -> Dict:
        """Get user's loyalty status"""
        loyalty = await self.points_collection.find_one({"user_id": user_id})

        if not loyalty:
            return {
                "current_tier": "bronze",
                "points": 0,
                "tier_progress": 0.0,
                "discount_percentage": 5,
                "coin_multiplier": 1.0,
            }

        # Calculate progress to next tier
        tiers = LOYALTY_TIERS if loyalty["role"] == "grihasta" else ACHARYA_TIERS
        current_points = loyalty["points"]

        # Find next tier
        tier_list = sorted(tiers.items(), key=lambda x: x[1]["min"])
        next_tier = None

        for tier_name, tier_data in tier_list:
            if tier_data["min"] > current_points:
                next_tier = tier_name.value
                points_needed = tier_data["min"] - current_points
                break

        return {
            **loyalty,
            "next_tier": next_tier,
            "points_to_next_tier": points_needed if next_tier else 0,
            "tier_benefits": self._get_tier_benefits(
                loyalty["current_tier"], loyalty["role"]
            ),
        }

    def _get_tier_benefits(self, tier: str, role: str) -> List[str]:
        """Get benefits for a tier"""
        if role == "grihasta":
            benefits = {
                "bronze": ["5% discount", "Standard support"],
                "silver": ["10% discount", "Priority support", "2x coins"],
                "gold": ["15% discount", "Free rescheduling", "3x coins"],
                "platinum": [
                    "20% discount",
                    "Free cancellations",
                    "5x coins",
                    "VIP support",
                ],
            }
        else:
            benefits = {
                "rising_star": ["Basic visibility", "Standard commission"],
                "established": ["Featured placement", "2% commission reduction"],
                "master": ["Top search", "5% commission reduction", "Premium badge"],
                "guru": [
                    "Homepage feature",
                    "10% commission reduction",
                    "Personal manager",
                ],
            }

        return benefits.get(tier, [])

    # ==================== Vouchers ====================

    async def create_voucher(self, voucher_data: Dict) -> Dict:
        """Admin creates a voucher"""
        voucher = Voucher(**voucher_data)
        result = await self.vouchers.insert_one(
            voucher.dict(by_alias=True, exclude={"id"})
        )

        return {
            "success": True,
            "voucher_id": str(result.inserted_id),
            "code": voucher.code,
        }

    async def award_voucher_to_user(
        self, user_id: str, voucher_code: str, earned_via: str
    ) -> Dict:
        """Award a voucher to a user"""
        # Get voucher
        voucher = await self.vouchers.find_one(
            {"code": voucher_code, "is_active": True}
        )

        if not voucher:
            return {"success": False, "message": "Voucher not found"}

        # Check if user already has this voucher
        existing = await self.user_vouchers.find_one(
            {"user_id": user_id, "voucher_code": voucher_code, "is_used": False}
        )

        if existing:
            return {"success": False, "message": "User already has this voucher"}

        # Create user voucher
        user_voucher = UserVoucher(
            user_id=user_id,
            voucher_id=str(voucher["_id"]),
            voucher_code=voucher_code,
            earned_via=earned_via,
            expires_at=voucher["valid_until"],
        )

        await self.user_vouchers.insert_one(
            user_voucher.dict(by_alias=True, exclude={"id"})
        )

        return {
            "success": True,
            "voucher": {
                "code": voucher["code"],
                "name": voucher["name"],
                "description": voucher["description"],
                "discount_value": voucher["discount_value"],
            },
        }

    async def get_user_vouchers(self, user_id: str) -> List[Dict]:
        """Get all active vouchers for a user"""
        user_vouchers = await self.user_vouchers.find(
            {
                "user_id": user_id,
                "is_used": False,
                "expires_at": {"$gt": datetime.now(timezone.utc)},
            }
        ).to_list(100)

        # Get voucher details
        result = []
        for uv in user_vouchers:
            voucher = await self.vouchers.find_one({"_id": ObjectId(uv["voucher_id"])})
            if voucher:
                result.append(
                    {
                        **voucher,
                        "user_voucher_id": str(uv["_id"]),
                        "earned_at": uv["earned_at"],
                        "expires_at": uv["expires_at"],
                    }
                )

        return result

    # ==================== Coupons ====================

    async def validate_coupon(
        self,
        code: str,
        user_id: str,
        booking_amount: float,
        _service_id: Optional[str] = None,
    ) -> Dict:
        """Validate a coupon code"""
        coupon = await self.coupons.find_one({"code": code, "is_active": True})

        if not coupon:
            return {"valid": False, "message": "Invalid coupon code"}

        # Check validity period
        now = datetime.now(timezone.utc)
        if now < coupon["valid_from"] or now > coupon["valid_until"]:
            return {"valid": False, "message": "Coupon expired"}

        # Check usage limit
        if coupon.get("usage_limit") and coupon["used_count"] >= coupon["usage_limit"]:
            return {"valid": False, "message": "Coupon usage limit reached"}

        # Check per user limit
        user_usage = await self.coupon_usage.count_documents(
            {"coupon_code": code, "user_id": user_id}
        )

        if user_usage >= coupon["per_user_limit"]:
            return {"valid": False, "message": "You've already used this coupon"}

        # Check minimum amount
        if booking_amount < coupon.get("min_booking_amount", 0):
            return {
                "valid": False,
                "message": f"Minimum booking amount ₹{coupon['min_booking_amount']} required",
            }

        # Calculate discount
        if coupon["discount_type"] == "percentage":
            discount = booking_amount * coupon["discount_value"] / 100
            if coupon.get("max_discount"):
                discount = min(discount, coupon["max_discount"])
        else:
            discount = coupon["discount_value"]

        return {
            "valid": True,
            "coupon_id": str(coupon["_id"]),
            "discount": discount,
            "final_amount": booking_amount - discount,
            "coupon_name": coupon["name"],
        }

    async def apply_coupon(
        self, code: str, user_id: str, booking_id: str, discount: float
    ) -> Dict:
        """Apply coupon to a booking"""
        coupon = await self.coupons.find_one({"code": code})

        if not coupon:
            return {"success": False}

        # Create usage record
        usage = CouponUsage(
            coupon_id=str(coupon["_id"]),
            coupon_code=code,
            user_id=user_id,
            booking_id=booking_id,
            discount_applied=discount,
        )

        await self.coupon_usage.insert_one(usage.dict(by_alias=True, exclude={"id"}))

        # Update coupon used count
        await self.coupons.update_one({"code": code}, {"$inc": {"used_count": 1}})

        return {"success": True}

    # ==================== Dynamic Pricing ====================

    async def calculate_price(
        self,
        base_amount: float,
        user_id: str,
        service_id: Optional[str] = None,
        coupon_code: Optional[str] = None,
        use_coins: int = 0,
    ) -> PriceDisplay:
        """Calculate final price with all discounts"""
        # Get user loyalty for tier discount
        loyalty = await self.get_user_loyalty(user_id)
        tier_discount_percent = loyalty.get("discount_percentage", 0)

        # Start with base price
        display_price = base_amount * 1.2  # Show 20% higher as "original price"
        discount_amount = base_amount * 0.2  # Initial 20% off badge

        # Apply tier discount
        tier_discount = base_amount * tier_discount_percent / 100

        # Apply coupon if provided
        coupon_discount = 0
        if coupon_code:
            validation = await self.validate_coupon(
                coupon_code, user_id, base_amount, service_id
            )
            if validation.get("valid"):
                coupon_discount = validation["discount"]

        # Apply coins
        coin_discount = use_coins * COINS_TO_RUPEES if use_coins > 0 else 0

        # Calculate final price
        total_discount = (
            discount_amount + tier_discount + coupon_discount + coin_discount
        )
        final_price = max(base_amount - total_discount, 0)

        # Calculate savings
        total_savings = display_price - final_price
        savings_percentage = (total_savings / display_price) * 100

        # Generate badges
        badges = []
        if discount_amount > 0:
            badges.append(f"{int((discount_amount / base_amount) * 100)}% OFF")
        if tier_discount > 0:
            badges.append(f"{loyalty['current_tier'].upper()} MEMBER")
        if coupon_discount > 0:
            badges.append("COUPON APPLIED")
        if coin_discount > 0:
            badges.append(f"{use_coins} COINS USED")

        return PriceDisplay(
            base_price=base_amount,
            display_price=display_price,
            discount_percentage=20.0,
            platform_discount=tier_discount + coupon_discount + coin_discount,
            final_price=final_price,
            total_savings=total_savings,
            savings_percentage=savings_percentage,
            badges=badges,
            applied_coupons=[coupon_code] if coupon_code else [],
            coins_used=use_coins,
        )

    # ==================== Referral System ====================

    async def generate_referral_code(self, user_id: str) -> str:
        """Generate unique referral code for user"""
        # Generate random 8-char code
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=8))

        # Update user
        await self.db.users.update_one(
            {"_id": ObjectId(user_id)}, {"$set": {"referral_code": code}}
        )

        return code

    async def create_referral(
        self, _referrer_id: str, referral_code: str, referee_role: str = "grihasta"
    ) -> Dict:
        """Create a referral when someone uses a code"""
        # Get referrer
        referrer = await self.db.users.find_one({"referral_code": referral_code})

        if not referrer:
            return {"success": False, "message": "Invalid referral code"}

        # Create referral record
        referral = Referral(
            referrer_id=str(referrer["_id"]),
            referrer_role=referrer["role"],
            referee_role=referee_role,
            referral_code=referral_code,
            status="pending",
        )

        result = await self.referrals.insert_one(
            referral.dict(by_alias=True, exclude={"id"})
        )

        return {"success": True, "referral_id": str(result.inserted_id)}

    async def complete_referral(
        self, referral_id: str, referee_id: str, first_booking_id: Optional[str] = None
    ) -> Dict:
        """Complete referral and award rewards"""
        referral = await self.referrals.find_one({"_id": ObjectId(referral_id)})

        if not referral or referral["rewards_given"]:
            return {"success": False}

        # Update referral
        await self.referrals.update_one(
            {"_id": ObjectId(referral_id)},
            {
                "$set": {
                    "referee_id": referee_id,
                    "status": "completed_booking" if first_booking_id else "signed_up",
                    "first_booking_at": datetime.now(timezone.utc)
                    if first_booking_id
                    else None,
                    "rewards_given": True,
                    "rewarded_at": datetime.now(timezone.utc),
                }
            },
        )

        # Award coins to referrer
        referrer_coins = 200 if not first_booking_id else 500
        await self.award_coins(
            referral["referrer_id"],
            ActionType.REFER_FRIEND
            if not first_booking_id
            else ActionType.REFERRAL_BOOKING,
            reference_id=referral_id,
            custom_amount=referrer_coins,
            description=f"Referral reward: {referrer_coins} coins",
        )

        # Award coins to referee
        await self.award_coins(
            referee_id,
            ActionType.SIGNUP,
            reference_id=referral_id,
            custom_amount=200,
            description="Welcome bonus: 200 coins",
        )

        # Give WELCOME100 coupon to referee
        await self.award_voucher_to_user(referee_id, "WELCOME100", "signup_referral")

        return {"success": True}

    # ==================== Helper Methods ====================

    async def _check_coin_milestones(self, user_id: str, new_balance: int) -> None:
        """Check and award milestone achievements"""
        milestones = [1000, 5000, 10000, 25000, 50000]

        for milestone in milestones:
            if new_balance >= milestone:
                existing = await self.milestones.find_one(
                    {
                        "user_id": user_id,
                        "milestone_type": "lifetime_coins",
                        "milestone_count": milestone,
                    }
                )

                if not existing:
                    # Award milestone
                    bonus = milestone // 10  # 10% bonus
                    await self.award_coins(
                        user_id,
                        ActionType.COMPLETE_PROFILE,
                        custom_amount=bonus,
                        description=f"Milestone bonus: Reached {milestone} lifetime coins!",
                    )

                    # Record milestone
                    await self.milestones.insert_one(
                        {
                            "user_id": user_id,
                            "milestone_type": "lifetime_coins",
                            "milestone_count": milestone,
                            "achieved_at": datetime.now(timezone.utc),
                            "rewards": [{"type": "coins", "amount": bonus}],
                            "rewarded": True,
                        }
                    )
