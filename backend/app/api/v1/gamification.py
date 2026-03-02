"""
Gamification API Endpoints
Handles coins, points, vouchers, coupons, loyalty, referrals
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Annotated, Optional, List
from datetime import datetime, timezone
from bson import ObjectId

from app.core.security import get_current_user
from app.core.constants import (
    MONGO_GROUP,
    MONGO_COND,
    MONGO_STATUS,
    ERROR_ADMIN_REQUIRED,
)
from app.services.gamification_service import GamificationService
from app.db.connection import get_db
from app.models.gamification import ActionType, Coupon
from pydantic import BaseModel, Field

router = APIRouter()


# ==================== Request/Response Models ====================


class AwardCoinsRequest(BaseModel):
    action: ActionType
    reference_id: Optional[str] = None
    custom_amount: Optional[int] = None
    description: Optional[str] = None


class RedeemCoinsRequest(BaseModel):
    amount: int = Field(..., gt=0)
    booking_id: str
    booking_amount: float


class AwardPointsRequest(BaseModel):
    amount: int = Field(..., gt=0)
    action: ActionType
    reference_id: Optional[str] = None
    description: Optional[str] = None
    target_user_id: Optional[str] = None


class ValidateCouponRequest(BaseModel):
    code: str
    booking_amount: float
    service_id: Optional[str] = None


class CalculatePriceRequest(BaseModel):
    base_amount: float = Field(..., gt=0)
    service_id: Optional[str] = None
    coupon_code: Optional[str] = None
    use_coins: int = Field(0, ge=0)


class CreateReferralRequest(BaseModel):
    referral_code: str
    referee_role: str = "grihasta"


class CreateVoucherRequest(BaseModel):
    code: str
    discount_type: str
    discount_value: float
    expires_at: datetime
    usage_limit: int = 1
    metadata: Optional[dict] = {}


class CreateCouponRequest(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    discount_type: str
    discount_value: float
    max_discount: Optional[float] = None
    min_booking_amount: Optional[float] = 0
    valid_from: datetime
    valid_until: datetime
    is_active: bool = True
    usage_limit: Optional[int] = None
    per_user_limit: int = 1
    applicable_for: List[str] = ["all"]
    applicable_services: List[str] = ["all"]
    first_booking_only: bool = False
    can_combine_offers: bool = False
    terms_conditions: List[str] = []


# ==================== Serialization Helper ====================


def _sanitize(obj):
    """Recursively convert ObjectId → str and datetime → ISO string for JSON safety."""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(i) for i in obj]
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj


# ==================== Coins Endpoints ====================


@router.post("/coins/award")
async def award_coins_endpoint(
    request: AwardCoinsRequest,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db=Depends(get_db),
):
    """Award coins to current user (internal use by other services)"""
    # Restrict to admin or system roles
    allowed_roles = ["admin", "system"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Not authorized to award coins")

    service = GamificationService(db)
    result = await service.award_coins(
        user_id=str(current_user["id"]),
        action=request.action,
        reference_id=request.reference_id,
        custom_amount=request.custom_amount,
        description=request.description,
    )
    return result


@router.post("/coins/redeem")
async def redeem_coins_endpoint(
    request: RedeemCoinsRequest,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db=Depends(get_db),
):
    """Redeem coins for booking discount"""
    service = GamificationService(db)
    result = await service.redeem_coins(
        user_id=str(current_user["id"]),
        amount=request.amount,
        booking_id=request.booking_id,
        booking_amount=request.booking_amount,
    )

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    return result


@router.get("/coins/balance")
async def get_coins_balance(
    current_user: Annotated[dict, Depends(get_current_user)], db=Depends(get_db)
):
    """Get user's coin balance and transactions"""
    service = GamificationService(db)
    result = await service.get_user_coins(str(current_user["id"]))
    return _sanitize(result)


@router.get("/coins/transactions")
async def get_coin_transactions(
    limit: Annotated[int, Query(le=100)] = 50,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db=Depends(get_db),
):
    """Get coin transaction history"""
    transactions = (
        await db.coin_transactions.find({"user_id": str(current_user["id"])})
        .sort("created_at", -1)
        .limit(limit)
        .to_list(limit)
    )

    return _sanitize({"transactions": transactions})


# ==================== Points & Loyalty Endpoints ====================


@router.post("/points/award")
async def award_points_endpoint(
    request: AwardPointsRequest,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db=Depends(get_db),
):
    """Award points to user"""
    target_user_id = request.target_user_id or str(current_user["id"])

    # Preventing self-award unless admin/staff
    if target_user_id == str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Cannot award points to self")

    # Only admin/staff can award points to others
    if current_user.get("role") not in ["admin", "staff"]:
        raise HTTPException(status_code=403, detail="Not authorized to award points")

    service = GamificationService(db)
    result = await service.award_points(
        user_id=target_user_id,
        amount=request.amount,
        action=request.action,
        reference_id=request.reference_id,
        description=request.description,
    )
    return result


@router.get("/loyalty/status")
async def get_loyalty_status(
    current_user: Annotated[dict, Depends(get_current_user)], db=Depends(get_db)
):
    """Get user's loyalty tier and benefits"""
    service = GamificationService(db)
    result = await service.get_user_loyalty(str(current_user["id"]))
    return _sanitize(result)


@router.get("/loyalty/tiers")
async def get_loyalty_tiers(current_user: Annotated[dict, Depends(get_current_user)]):
    """Get all loyalty tiers and their benefits"""
    return {
        "grihasta_tiers": [
            {
                "name": "Bronze",
                "min_points": 0,
                "max_points": 999,
                "discount": 5,
                "coin_multiplier": 1.0,
                "benefits": ["5% discount", "Standard support"],
            },
            {
                "name": "Silver",
                "min_points": 1000,
                "max_points": 4999,
                "discount": 10,
                "coin_multiplier": 2.0,
                "benefits": ["10% discount", "Priority support", "2x coins"],
            },
            {
                "name": "Gold",
                "min_points": 5000,
                "max_points": 9999,
                "discount": 15,
                "coin_multiplier": 3.0,
                "benefits": ["15% discount", "Free rescheduling", "3x coins"],
            },
            {
                "name": "Platinum",
                "min_points": 10000,
                "max_points": None,
                "discount": 20,
                "coin_multiplier": 5.0,
                "benefits": [
                    "20% discount",
                    "Free cancellations",
                    "5x coins",
                    "VIP support",
                ],
            },
        ],
        "acharya_tiers": [
            {
                "name": "Rising Star",
                "min_points": 0,
                "max_points": 999,
                "commission_reduction": 0,
                "benefits": ["Basic visibility"],
            },
            {
                "name": "Established",
                "min_points": 1000,
                "max_points": 4999,
                "commission_reduction": 2,
                "benefits": ["Featured placement", "2% less commission"],
            },
            {
                "name": "Master",
                "min_points": 5000,
                "max_points": 9999,
                "commission_reduction": 5,
                "benefits": ["Top search", "5% less commission", "Premium badge"],
            },
            {
                "name": "Guru",
                "min_points": 10000,
                "max_points": None,
                "commission_reduction": 10,
                "benefits": [
                    "Homepage feature",
                    "10% less commission",
                    "Personal manager",
                ],
            },
        ],
    }


# ==================== Vouchers Endpoints ====================


@router.get("/vouchers/my")
async def get_my_vouchers(
    current_user: Annotated[dict, Depends(get_current_user)], db=Depends(get_db)
):
    """Get all active vouchers for current user"""
    service = GamificationService(db)
    vouchers = await service.get_user_vouchers(str(current_user["id"]))
    return _sanitize({"vouchers": vouchers})


@router.post("/vouchers/{voucher_code}/claim")
async def claim_voucher(
    voucher_code: str,
    earned_via: Annotated[str, Query()] = "manual_claim",
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db=Depends(get_db),
):
    """Claim a voucher by code"""
    service = GamificationService(db)
    result = await service.award_voucher_to_user(
        user_id=str(current_user["id"]),
        voucher_code=voucher_code,
        earned_via=earned_via,
    )

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    return result


# ==================== Coupons Endpoints ====================


@router.post("/coupons/validate")
async def validate_coupon(
    request: ValidateCouponRequest,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db=Depends(get_db),
):
    """Validate a coupon code"""
    service = GamificationService(db)
    result = await service.validate_coupon(
        code=request.code,
        user_id=str(current_user["id"]),
        booking_amount=request.booking_amount,
        service_id=request.service_id,
    )

    if not result["valid"]:
        raise HTTPException(status_code=400, detail=result["message"])

    return result


@router.get("/coupons/available")
async def get_available_coupons(
    current_user: Annotated[dict, Depends(get_current_user)], db=Depends(get_db)
):
    """Get all available coupons for current user"""
    # Get active coupons
    now = datetime.now(timezone.utc)
    coupons = await db.coupons.find(
        {"is_active": True, "valid_from": {"$lte": now}, "valid_until": {"$gte": now}}
    ).to_list(100)

    user_id = str(current_user["id"])
    result = []

    if not coupons:
        return {"coupons": []}

    # Batch usage lookups
    coupon_codes = [c["code"] for c in coupons]
    usage_pipeline = [
        {"$match": {"user_id": user_id, "coupon_code": {"$in": coupon_codes}}},
        {MONGO_GROUP: {"_id": "$coupon_code", "count": {"$sum": 1}}},
    ]

    usage_list = await db.coupon_usage.aggregate(usage_pipeline).to_list(None)
    usage_map = {item["_id"]: item["count"] for item in usage_list}

    for coupon in coupons:
        used_count = usage_map.get(coupon["code"], 0)

        if used_count < coupon["per_user_limit"]:
            result.append(
                {
                    "code": coupon["code"],
                    "name": coupon["name"],
                    "description": coupon["description"],
                    "discount_type": coupon["discount_type"],
                    "discount_value": coupon["discount_value"],
                    "max_discount": coupon.get("max_discount"),
                    "min_booking_amount": coupon.get("min_booking_amount", 0),
                    "valid_until": coupon["valid_until"],
                    "can_combine": coupon.get("can_combine_offers", False),
                }
            )

    return {"coupons": result}


# ==================== Pricing Endpoints ====================


@router.post("/pricing/calculate")
async def calculate_price(
    request: CalculatePriceRequest,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db=Depends(get_db),
):
    """Calculate final price with all discounts (Amazon-style display)"""
    service = GamificationService(db)
    price_display = await service.calculate_price(
        base_amount=request.base_amount,
        user_id=str(current_user["id"]),
        service_id=request.service_id,
        coupon_code=request.coupon_code,
        use_coins=request.use_coins,
    )

    return price_display.dict()


# ==================== Referral Endpoints ====================


@router.get("/referral/my-code")
async def get_my_referral_code(
    current_user: Annotated[dict, Depends(get_current_user)], db=Depends(get_db)
):
    """Get or generate user's referral code"""
    service = GamificationService(db)
    user_id_str = str(current_user["id"])

    # Check if user has code
    if current_user.get("referral_code"):
        code = current_user["referral_code"]
    else:
        code = await service.generate_referral_code(user_id_str)

    # Get referral stats using aggregation
    pipeline = [
        {"$match": {"referrer_id": user_id_str}},
        {
            MONGO_GROUP: {
                "_id": None,
                "total": {"$sum": 1},
                "signed_up": {
                    "$sum": {
                        MONGO_COND: [
                            {"$in": [MONGO_STATUS, ["signed_up", "completed_booking"]]},
                            1,
                            0,
                        ]
                    }
                },
                "completed_booking": {
                    "$sum": {
                        MONGO_COND: [{"$eq": [MONGO_STATUS, "completed_booking"]}, 1, 0]
                    }
                },
                "pending": {
                    "$sum": {MONGO_COND: [{"$eq": [MONGO_STATUS, "pending"]}, 1, 0]}
                },
            }
        },
    ]

    agg_result = await db.referrals.aggregate(pipeline).to_list(1)

    if agg_result:
        stats = {
            "total": agg_result[0]["total"],
            "signed_up": agg_result[0]["signed_up"],
            "completed_booking": agg_result[0]["completed_booking"],
            "pending": agg_result[0]["pending"],
        }
    else:
        stats = {"total": 0, "signed_up": 0, "completed_booking": 0, "pending": 0}

    return {
        "referral_code": code,
        "referral_link": f"https://savitara.com/signup?ref={code}",
        "stats": stats,
    }


@router.post("/referral/create")
async def create_referral(
    request: CreateReferralRequest,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db=Depends(get_db),
):
    """Create a referral (called when someone uses referral code)"""
    service = GamificationService(db)
    result = await service.create_referral(
        referrer_id=str(current_user["id"]),
        referral_code=request.referral_code,
        referee_role=request.referee_role,
    )

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    return result


@router.get("/referral/leaderboard")
async def get_referral_leaderboard(
    month: Annotated[Optional[str], Query(description="Month in YYYY-MM format")] = None,
    db=Depends(get_db),
):
    """Get referral leaderboard for a month"""
    if not month:
        # Current month
        month = datetime.now(timezone.utc).strftime("%Y-%m")

    leaderboard = (
        await db.referral_leaderboard.find({"month": month})
        .sort("rank", 1)
        .limit(10)
        .to_list(10)
    )

    return {"month": month, "leaderboard": leaderboard}


# ==================== Milestones Endpoints ====================


@router.get("/milestones/my")
async def get_my_milestones(
    current_user: Annotated[dict, Depends(get_current_user)], db=Depends(get_db)
):
    """Get user's achieved milestones"""
    milestones = (
        await db.milestones.find({"user_id": str(current_user["id"])})
        .sort("achieved_at", -1)
        .to_list(100)
    )

    return {"milestones": milestones}


@router.get("/milestones/available")
async def get_available_milestones(current_user: Annotated[dict, Depends(get_current_user)]):
    """Get all available milestones"""
    return {
        "grihasta": [
            {"type": "bookings", "count": 1, "reward": "500 coins + REPEAT15 voucher"},
            {"type": "bookings", "count": 5, "reward": "1,000 coins + Silver tier"},
            {"type": "bookings", "count": 10, "reward": "â‚¹200 wallet credit"},
            {"type": "bookings", "count": 25, "reward": "Gold tier + 5,000 coins"},
            {
                "type": "bookings",
                "count": 50,
                "reward": "â‚¹1,000 wallet + Platinum tier",
            },
            {"type": "referrals", "count": 5, "reward": "1,000 coins"},
            {"type": "referrals", "count": 10, "reward": "3,000 coins"},
            {"type": "reviews", "count": 10, "reward": "500 coins"},
            {"type": "reviews", "count": 25, "reward": "1,500 coins"},
        ],
        "acharya": [
            {"type": "bookings", "count": 10, "reward": "2,000 coins + Featured badge"},
            {"type": "bookings", "count": 50, "reward": "5,000 coins + Master tier"},
            {"type": "bookings", "count": 100, "reward": "â‚¹2,000 wallet credit"},
            {
                "type": "bookings",
                "count": 500,
                "reward": "Guru tier + Personal manager",
            },
            {"type": "referrals", "count": 5, "reward": "10,000 coins"},
            {"type": "rating", "value": "4.5+", "reward": "500 coins/month"},
        ],
    }


# ==================== Statistics Endpoints ====================


@router.get("/stats/overview")
async def get_gamification_overview(
    current_user: Annotated[dict, Depends(get_current_user)], db=Depends(get_db)
):
    """Get complete gamification overview for user"""
    try:
        service = GamificationService(db)

        # Get all data
        coins = await service.get_user_coins(str(current_user["id"]))
        loyalty = await service.get_user_loyalty(str(current_user["id"]))
        vouchers = await service.get_user_vouchers(str(current_user["id"]))

        # Get referral code
        referral_code = current_user.get("referral_code", "")
        if not referral_code:
            referral_code = await service.generate_referral_code(str(current_user["id"]))

        return {
            "coins": {
                "balance": coins["current_balance"],
                "rupees_value": coins.get("rupees_value", 0),
                "total_earned": coins["total_earned"],
            },
            "loyalty": {
                "tier": loyalty["current_tier"],
                "points": loyalty["points"],
                "discount": loyalty["discount_percentage"],
                "next_tier": loyalty.get("next_tier"),
                "points_to_next": loyalty.get("points_to_next_tier", 0),
            },
            "vouchers": {
                "count": len(vouchers),
                "active": len([v for v in vouchers if not v.get("is_used", False)]),
            },
            "referral": {
                "code": referral_code,
                "link": f"https://savitara.com/signup?ref={referral_code}",
            },
        }
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail="Failed to fetch gamification overview") from exc


# ==================== Admin Endpoints ====================


@router.post("/admin/vouchers/create")
async def create_voucher_admin(
    voucher_data: CreateVoucherRequest,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db=Depends(get_db),
):
    """Admin: Create a new voucher"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail=ERROR_ADMIN_REQUIRED)

    service = GamificationService(db)

    # Convert Pydantic model to dict
    data = voucher_data.dict()
    data["created_by"] = str(current_user["id"])

    result = await service.create_voucher(data)

    return result


@router.post("/admin/coupons/create")
async def create_coupon_admin(
    coupon_data: CreateCouponRequest,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db=Depends(get_db),
):
    """Admin: Create a new coupon"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail=ERROR_ADMIN_REQUIRED)

    # coupon_data is now a Pydantic model
    data = coupon_data.dict(exclude_unset=True)
    data["created_by"] = str(current_user["id"])

    # Use the imported Coupon model if needed for further validation or consistency
    # (though CreateCouponRequest handles input validation)
    coupon = Coupon(**data)

    result = await db.coupons.insert_one(coupon.dict(by_alias=True, exclude={"id"}))

    return {"success": True, "coupon_id": str(result.inserted_id), "code": coupon.code}


@router.get("/admin/analytics")
async def get_gamification_analytics(
    current_user: Annotated[dict, Depends(get_current_user)], db=Depends(get_db)
):
    """Admin: Get gamification analytics"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail=ERROR_ADMIN_REQUIRED)

    # Total coins in circulation
    coins_pipeline = [
        {MONGO_GROUP: {"_id": None, "total": {"$sum": "$current_balance"}}}
    ]
    coins_result = await db.user_coins.aggregate(coins_pipeline).to_list(1)
    total_coins = coins_result[0]["total"] if coins_result else 0

    # Tier distribution
    tier_pipeline = [{MONGO_GROUP: {"_id": "$current_tier", "count": {"$sum": 1}}}]
    tier_dist = await db.user_loyalty.aggregate(tier_pipeline).to_list(10)

    # Coupon usage
    coupon_usage = await db.coupon_usage.count_documents({})
    active_coupons = await db.coupons.count_documents({"is_active": True})

    # Referral stats
    total_referrals = await db.referrals.count_documents({})
    completed_referrals = await db.referrals.count_documents(
        {"status": "completed_booking"}
    )

    return {
        "coins": {
            "total_in_circulation": total_coins,
            "rupees_value": total_coins * 0.1,
        },
        "loyalty": {
            "tier_distribution": {item["_id"]: item["count"] for item in tier_dist}
        },
        "coupons": {"active_count": active_coupons, "total_usage": coupon_usage},
        "referrals": {
            "total": total_referrals,
            "completed": completed_referrals,
            "conversion_rate": (completed_referrals / total_referrals * 100)
            if total_referrals > 0
            else 0,
        },
    }


# ==================== Streaks & Daily Rewards Endpoints ====================


@router.get("/streaks/my")
async def get_my_streak(
    current_user: Annotated[dict, Depends(get_current_user)], db=Depends(get_db)
):
    """Get user's current login streak"""
    service = GamificationService(db)
    streak = await service.get_user_streak(str(current_user["id"]))

    if not streak:
        # Create initial streak record
        from app.models.gamification import UserStreak
        from datetime import datetime, timezone

        new_streak = UserStreak(
            user_id=str(current_user["id"]),
            current_streak=1,
            longest_streak=1,
            last_login=datetime.now(timezone.utc),
            streak_active=True,
            total_logins=1,
        )
        await db.user_streaks.insert_one(
            new_streak.model_dump(by_alias=True, exclude={"id"})
        )
        return {
            "current_streak": 1,
            "longest_streak": 1,
            "last_login": new_streak.last_login,
            "streak_active": True,
            "total_logins": 1,
        }

    return streak


@router.post("/streaks/checkin")
async def daily_checkin(
    current_user: Annotated[dict, Depends(get_current_user)], db=Depends(get_db)
):
    """Record daily check-in and update streak"""
    service = GamificationService(db)
    result = await service.record_daily_checkin(str(current_user["id"]))

    return result


@router.get("/streaks/leaderboard")
async def get_streak_leaderboard(
    limit: Annotated[int, Query(le=50)] = 10,
    db=Depends(get_db),
):
    """Get top users by streak"""
    leaderboard = (
        await db.user_streaks.find({"streak_active": True})
        .sort("current_streak", -1)
        .limit(limit)
        .to_list(limit)
    )

    # Get user details
    user_ids = [ObjectId(s["user_id"]) for s in leaderboard]
    users = await db.users.find({"_id": {"$in": user_ids}}).to_list(None)
    user_map = {str(u["_id"]): u for u in users}

    result = []
    for i, streak in enumerate(leaderboard):
        user = user_map.get(streak["user_id"])
        if user:
            result.append(
                {
                    "rank": i + 1,
                    "user_id": streak["user_id"],
                    "user_name": user.get("name", "Anonymous"),
                    "current_streak": streak["current_streak"],
                    "longest_streak": streak["longest_streak"],
                }
            )

    return {"leaderboard": result}


# ==================== Achievements Endpoints ====================


@router.get("/achievements/my")
async def get_my_achievements(
    current_user: Annotated[dict, Depends(get_current_user)], db=Depends(get_db)
):
    """Get user's achieved milestones/achievements"""
    user_id = str(current_user["id"])

    # Get all milestones
    milestones = (
        await db.milestones.find({"user_id": user_id})
        .sort("achieved_at", -1)
        .to_list(100)
    )

    # Get coins balance for lifetime achievements
    user_coins = await db.user_coins.find_one({"user_id": user_id})

    # Get booking count
    booking_count = await db.bookings.count_documents(
        {"grihasta_id": user_id, "status": "completed"}
    )

    # Get review count
    review_count = await db.reviews.count_documents({"grihasta_id": user_id})

    # Get referral count
    referral_count = await db.referrals.count_documents(
        {"referrer_id": user_id, "status": "completed_booking"}
    )

    return {
        "milestones": milestones,
        "achievements": {
            "total_bookings": booking_count,
            "total_reviews": review_count,
            "total_referrals": referral_count,
            "lifetime_coins": user_coins.get("lifetime_balance", 0) if user_coins else 0,
        },
        "next_milestones": [
            {"type": "bookings", "target": booking_count + (5 - booking_count % 5)},
            {"type": "reviews", "target": review_count + (10 - review_count % 10)},
            {"type": "referrals", "target": referral_count + (5 - referral_count % 5)},
        ],
    }


@router.get("/achievements/available")
async def get_available_achievements_v2(current_user: Annotated[dict, Depends(get_current_user)]):
    """Get all available achievements (alternative to /milestones/available)"""
    return await get_available_milestones(current_user)


# ==================== Daily Rewards Endpoints ====================


@router.get("/rewards/daily")
async def get_daily_rewards(
    current_user: Annotated[dict, Depends(get_current_user)], db=Depends(get_db)
):
    """Get daily reward calendar (last 7 days)"""
    from datetime import datetime, timezone, timedelta

    user_id = str(current_user["id"])
    today = datetime.now(timezone.utc).date()

    # Get last 7 days of rewards
    rewards = []
    for i in range(7):
        date = (today - timedelta(days=6 - i)).isoformat()
        reward = await db.daily_rewards.find_one({"user_id": user_id, "date": date})

        if reward:
            rewards.append(
                {
                    "date": date,
                    "day_number": reward.get("day_number", i + 1),
                    "reward_type": reward.get("reward_type", "coins"),
                    "reward_amount": reward.get("reward_amount", 0),
                    "claimed": reward.get("claimed", False),
                    "claimed_at": reward.get("claimed_at"),
                }
            )
        else:
            rewards.append(
                {
                    "date": date,
                    "day_number": i + 1,
                    "reward_type": None,
                    "reward_amount": 0,
                    "claimed": False,
                    "claimed_at": None,
                }
            )

    # Get current streak
    streak = await db.user_streaks.find_one({"user_id": user_id})

    return {
        "rewards": rewards,
        "current_streak": streak.get("current_streak", 0) if streak else 0,
        "can_claim_today": any(
            r["date"] == today.isoformat() and not r["claimed"] for r in rewards
        ),
    }


@router.post("/rewards/claim")
async def claim_daily_reward(
    current_user: Annotated[dict, Depends(get_current_user)], db=Depends(get_db)
):
    """Claim today's daily reward"""
    from datetime import datetime, timezone

    user_id = str(current_user["id"])
    today = datetime.now(timezone.utc).date().isoformat()

    # Check if reward exists and not claimed
    reward = await db.daily_rewards.find_one({"user_id": user_id, "date": today})

    if not reward:
        raise HTTPException(status_code=404, detail="No reward available for today")

    if reward.get("claimed", False):
        raise HTTPException(
            status_code=400, detail="Today's reward has already been claimed"
        )

    # Mark as claimed
    await db.daily_rewards.update_one(
        {"_id": reward["_id"]},
        {
            "$set": {
                "claimed": True,
                "claimed_at": datetime.now(timezone.utc),
            }
        },
    )

    # Award the reward
    service = GamificationService(db)

    if reward["reward_type"] == "coins":
        await service.award_coins(
            user_id=user_id,
            action="DAILY_LOGIN",
            custom_amount=reward["reward_amount"],
            description=f"Day {reward['day_number']} daily reward",
        )

    return {
        "success": True,
        "reward_type": reward["reward_type"],
        "reward_amount": reward["reward_amount"],
        "message": f"Claimed {reward['reward_amount']} {reward['reward_type']}!",
    }
