"""
Gamification Models for Savitara Platform
Includes: Coins, Points, Vouchers, Coupons, Loyalty Tiers, Pricing Rules
"""
from datetime import datetime, timezone
from typing import Optional, List, Dict
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum


class RewardType(str, Enum):
    """Types of rewards in the system"""

    COINS = "coins"
    POINTS = "points"
    VOUCHER = "voucher"
    COUPON = "coupon"
    WALLET_CREDIT = "wallet_credit"


class CouponType(str, Enum):
    """Types of coupons"""

    PERCENTAGE = "percentage"  # 20% off
    FIXED = "fixed"  # ₹100 off
    FREE_SHIPPING = "free_shipping"
    BUNDLE = "bundle"  # Buy X get Y


class VoucherCategory(str, Enum):
    """Voucher categories"""

    BOOKING_DISCOUNT = "booking_discount"
    POOJA_ITEMS = "pooja_items"
    PREMIUM_FEATURES = "premium_features"
    PROFILE_BOOST = "profile_boost"


class LoyaltyTier(str, Enum):
    """Loyalty tiers for users"""

    BRONZE = "bronze"  # 0-999
    SILVER = "silver"  # 1,000-4,999
    GOLD = "gold"  # 5,000-9,999
    PLATINUM = "platinum"  # 10,000+


class AcharyaTier(str, Enum):
    """Acharya performance tiers"""

    RISING_STAR = "rising_star"  # 0-999
    ESTABLISHED = "established"  # 1,000-4,999
    MASTER = "master"  # 5,000-9,999
    GURU = "guru"  # 10,000+


class ActionType(str, Enum):
    """Actions that earn rewards"""

    # User actions
    SIGNUP = "signup"
    COMPLETE_PROFILE = "complete_profile"
    FIRST_BOOKING = "first_booking"
    COMPLETE_BOOKING = "complete_booking"
    RATE_ACHARYA = "rate_acharya"
    WRITE_REVIEW = "write_review"
    ADD_REVIEW_PHOTO = "add_review_photo"
    REFER_FRIEND = "refer_friend"
    REFERRAL_BOOKING = "referral_booking"
    DAILY_LOGIN = "daily_login"
    LOGIN_STREAK_7 = "login_streak_7"
    MONTHLY_BOOKING = "monthly_booking"
    MILESTONE_5_BOOKINGS = "milestone_5_bookings"

    # Acharya actions
    COMPLETE_KYC = "complete_kyc"
    FIRST_ACHARYA_BOOKING = "first_acharya_booking"
    MILESTONE_10_BOOKINGS = "milestone_10_bookings"
    MILESTONE_50_BOOKINGS = "milestone_50_bookings"
    MAINTAIN_RATING = "maintain_rating"
    QUICK_RESPONSE = "quick_response"
    REFER_ACHARYA = "refer_acharya"
    UPLOAD_CALENDAR = "upload_calendar"
    ENABLE_INSTANT_BOOKING = "enable_instant_booking"


# ==================== Coins System ====================


class CoinTransaction(BaseModel):
    """Coin transaction model"""

    id: Optional[str] = Field(alias="_id")
    user_id: str
    transaction_type: str  # "earned", "redeemed", "expired", "transferred"
    amount: int  # Positive for earn, negative for spend
    action: Optional[ActionType]
    description: str
    reference_id: Optional[str]  # Booking ID, Referral ID, etc.
    balance_after: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime]  # Coins expire after 1 year
    metadata: Optional[Dict] = {}

    model_config = ConfigDict(use_enum_values=True, populate_by_name=True)


class UserCoins(BaseModel):
    """User's coin balance"""

    id: Optional[str] = Field(alias="_id")
    user_id: str
    total_earned: int = 0
    total_redeemed: int = 0
    current_balance: int = 0
    lifetime_balance: int = 0  # Never decreases, for achievements
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(populate_by_name=True)


# ==================== Points & Loyalty System ====================


class PointsTransaction(BaseModel):
    """Points transaction model"""

    id: Optional[str] = Field(alias="_id")
    user_id: str
    amount: int
    action: ActionType
    description: str
    reference_id: Optional[str]
    balance_after: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Optional[Dict] = {}

    model_config = ConfigDict(use_enum_values=True, populate_by_name=True)


class UserLoyalty(BaseModel):
    """User's loyalty status"""

    id: Optional[str] = Field(alias="_id")
    user_id: str
    role: str  # "grihasta" or "acharya"
    current_tier: str  # LoyaltyTier or AcharyaTier
    points: int = 0
    tier_progress: float = 0.0  # 0-100% progress to next tier
    next_tier: Optional[str]
    tier_benefits: List[str] = []
    discount_percentage: int = 0
    coin_multiplier: float = 1.0
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    tier_upgraded_at: Optional[datetime]

    model_config = ConfigDict(populate_by_name=True)


# ==================== Vouchers System ====================


class Voucher(BaseModel):
    """Voucher model"""

    id: Optional[str] = Field(alias="_id")
    code: str  # e.g., "NEXT20", "POOJA50"
    name: str
    description: str
    category: VoucherCategory
    discount_type: CouponType
    discount_value: float  # 20 for 20%, 100 for ₹100
    max_discount: Optional[float]  # Max discount cap
    min_booking_amount: Optional[float]
    valid_from: datetime
    valid_until: datetime
    total_quantity: int  # Total available
    used_quantity: int = 0
    per_user_limit: int = 1  # How many times per user
    applicable_for: List[str] = ["all"]  # ["all"] or ["grihasta", "acharya"]
    applicable_services: List[str] = ["all"]  # Service IDs or ["all"]
    is_active: bool = True
    terms_conditions: List[str] = []
    created_by: str  # Admin ID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(use_enum_values=True, populate_by_name=True)


class UserVoucher(BaseModel):
    """User's voucher ownership"""

    id: Optional[str] = Field(alias="_id")
    user_id: str
    voucher_id: str
    voucher_code: str
    earned_via: str  # "milestone", "referral", "admin_gift", etc.
    earned_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_used: bool = False
    used_at: Optional[datetime]
    used_in_booking: Optional[str]  # Booking ID
    expires_at: datetime

    model_config = ConfigDict(populate_by_name=True)


# ==================== Coupons System ====================


class Coupon(BaseModel):
    """Coupon code model (promotional codes)"""

    id: Optional[str] = Field(alias="_id")
    code: str  # e.g., "FIRST50", "GANESH50"
    name: str
    description: str
    discount_type: CouponType
    discount_value: float
    max_discount: Optional[float]
    min_booking_amount: Optional[float] = 0
    valid_from: datetime
    valid_until: datetime
    usage_limit: Optional[int] = Field(default=None, description="None means unlimited")
    used_count: int = 0
    per_user_limit: int = 1
    applicable_for: List[str] = ["all"]
    applicable_services: List[str] = ["all"]
    first_booking_only: bool = False
    can_combine_offers: bool = False
    is_active: bool = True
    terms_conditions: List[str] = []
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(use_enum_values=True, populate_by_name=True)


class CouponUsage(BaseModel):
    """Track coupon usage by users"""

    id: Optional[str] = Field(alias="_id")
    coupon_id: str
    coupon_code: str
    user_id: str
    booking_id: str
    discount_applied: float
    used_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(populate_by_name=True)


# ==================== Pricing Rules ====================


class PricingRule(BaseModel):
    """Dynamic pricing rules set by admin"""

    id: Optional[str] = Field(alias="_id")
    name: str
    service_id: Optional[str]  # None = applies to all
    service_category: Optional[str]
    base_price: float
    display_price: float  # The "crossed out" price
    discount_percentage: float
    platform_discount: Optional[float]  # Additional platform discount
    final_price: float
    valid_from: datetime
    valid_until: datetime
    applicable_for: List[str] = ["all"]
    conditions: Dict = {}  # {"first_booking": True, "min_amount": 500}
    priority: int = 0  # Higher priority rules apply first
    is_active: bool = True
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(populate_by_name=True)


class PriceDisplay(BaseModel):
    """Calculated price display for frontend"""

    base_price: float
    display_price: float  # Crossed out
    discount_percentage: float
    platform_discount: float
    final_price: float
    total_savings: float
    savings_percentage: float
    badges: List[str] = []  # ["50% OFF", "Limited Time", "Special Offer"]
    applied_coupons: List[str] = []
    applied_vouchers: List[str] = []
    coins_used: int = 0
    points_used: int = 0


# ==================== Referral System ====================


class Referral(BaseModel):
    """Referral tracking"""

    id: Optional[str] = Field(alias="_id")
    referrer_id: str  # User who referred
    referrer_role: str  # "grihasta" or "acharya"
    referee_id: Optional[str]  # User who was referred (after signup)
    referee_role: str
    referral_code: str  # Unique code per user
    status: str  # "pending", "signed_up", "completed_booking", "rewarded"
    rewards_given: bool = False
    referrer_reward: Dict = {}  # {"coins": 500, "voucher": "REFER500"}
    referee_reward: Dict = {}
    signed_up_at: Optional[datetime]
    first_booking_at: Optional[datetime]
    rewarded_at: Optional[datetime]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(populate_by_name=True)


class ReferralLeaderboard(BaseModel):
    """Monthly referral leaderboard"""

    id: Optional[str] = Field(alias="_id")
    month: str  # "2026-02"
    user_id: str
    user_name: str
    user_role: str
    total_referrals: int = 0
    successful_referrals: int = 0  # Completed bookings
    rank: int
    prize: Optional[Dict]  # {"amount": 5000, "description": "Top referrer"}
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(populate_by_name=True)


# ==================== Daily Rewards ====================


class DailyReward(BaseModel):
    """Daily reward tracking"""

    id: Optional[str] = Field(alias="_id")
    user_id: str
    date: str  # "2026-02-04"
    day_number: int  # Day in current streak (1-7)
    reward_type: RewardType
    reward_amount: int
    claimed: bool = False
    claimed_at: Optional[datetime]
    streak_count: int  # Total consecutive days

    model_config = ConfigDict(use_enum_values=True, populate_by_name=True)


class UserStreak(BaseModel):
    """User's login streak"""

    id: Optional[str] = Field(alias="_id")
    user_id: str
    current_streak: int = 0
    longest_streak: int = 0
    last_login: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    streak_active: bool = True
    total_logins: int = 0

    model_config = ConfigDict(populate_by_name=True)


# ==================== Milestone Tracking ====================


class Milestone(BaseModel):
    """Milestone achievements"""

    id: Optional[str] = Field(alias="_id")
    user_id: str
    milestone_type: str  # "bookings", "referrals", "reviews", "earnings"
    milestone_count: int  # 1, 5, 10, 25, 50, 100
    achieved_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    rewards: List[Dict] = []  # [{"type": "coins", "amount": 1000}]
    rewarded: bool = False

    model_config = ConfigDict(populate_by_name=True)


# ==================== Gamification Config ====================

# Coin earning rates
COIN_REWARDS = {
    ActionType.SIGNUP: 100,
    ActionType.COMPLETE_PROFILE: 50,
    ActionType.FIRST_BOOKING: 500,
    ActionType.COMPLETE_BOOKING: 100,
    ActionType.RATE_ACHARYA: 25,
    ActionType.WRITE_REVIEW: 50,
    ActionType.ADD_REVIEW_PHOTO: 30,
    ActionType.REFER_FRIEND: 200,
    ActionType.REFERRAL_BOOKING: 500,
    ActionType.LOGIN_STREAK_7: 100,
    ActionType.COMPLETE_KYC: 200,
    ActionType.MILESTONE_10_BOOKINGS: 1500,
    ActionType.MILESTONE_50_BOOKINGS: 5000,
}

# Points earning rates
POINTS_REWARDS = {
    # 1 point per ₹10 spent for Grihastas
    # 2 points per ₹10 earned for Acharyas
    "booking_multiplier_grihasta": 0.1,  # ₹100 booking = 10 points
    "booking_multiplier_acharya": 0.2,  # ₹100 earning = 20 points
    "referral_completed": 500,
    "acharya_referral_verified": 2000,
}

# Tier thresholds
LOYALTY_TIERS = {
    LoyaltyTier.BRONZE: {"min": 0, "max": 999, "discount": 5, "multiplier": 1.0},
    LoyaltyTier.SILVER: {"min": 1000, "max": 4999, "discount": 10, "multiplier": 2.0},
    LoyaltyTier.GOLD: {"min": 5000, "max": 9999, "discount": 15, "multiplier": 3.0},
    LoyaltyTier.PLATINUM: {
        "min": 10000,
        "max": float("inf"),
        "discount": 20,
        "multiplier": 5.0,
    },
}

ACHARYA_TIERS = {
    AcharyaTier.RISING_STAR: {"min": 0, "max": 999, "commission_reduction": 0},
    AcharyaTier.ESTABLISHED: {"min": 1000, "max": 4999, "commission_reduction": 2},
    AcharyaTier.MASTER: {"min": 5000, "max": 9999, "commission_reduction": 5},
    AcharyaTier.GURU: {"min": 10000, "max": float("inf"), "commission_reduction": 10},
}

# Coin conversion rate
COINS_TO_RUPEES = 0.1  # 100 coins = ₹10
MAX_COIN_REDEMPTION_PERCENT = 30  # Max 30% of booking can be paid with coins
