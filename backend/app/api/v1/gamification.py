"""
Gamification API Endpoints
Handles coins, points, vouchers, coupons, loyalty, referrals
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from datetime import datetime, timezone

from app.core.security import get_current_user
from app.core.constants import (
    MONGO_GROUP, MONGO_COND, MONGO_STATUS, ERROR_ADMIN_REQUIRED
)
from app.services.gamification_service import GamificationService
from app.db.connection import get_database
from app.models.gamification import ActionType, RewardType, Coupon
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


# ==================== Coins Endpoints ====================

@router.post("/coins/award")
async def award_coins_endpoint(
    request: AwardCoinsRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Award coins to current user (internal use by other services)"""
    # Restrict to admin or system roles
    allowed_roles = ["admin", "system"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Not authorized to award coins")

    service = GamificationService(db)
    result = await service.award_coins(
        user_id=str(current_user["_id"]),
        action=request.action,
        reference_id=request.reference_id,
        custom_amount=request.custom_amount,
        description=request.description
    )
    return result


@router.post("/coins/redeem")
async def redeem_coins_endpoint(
    request: RedeemCoinsRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Redeem coins for booking discount"""
    service = GamificationService(db)
    result = await service.redeem_coins(
        user_id=str(current_user["_id"]),
        amount=request.amount,
        booking_id=request.booking_id,
        booking_amount=request.booking_amount
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@router.get("/coins/balance")
async def get_coins_balance(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get user's coin balance and transactions"""
    service = GamificationService(db)
    result = await service.get_user_coins(str(current_user["_id"]))
    return result


@router.get("/coins/transactions")
async def get_coin_transactions(
    limit: int = Query(50, le=100),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get coin transaction history"""
    transactions = await db.coin_transactions.find(
        {"user_id": str(current_user["_id"])}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"transactions": transactions}


# ==================== Points & Loyalty Endpoints ====================

@router.post("/points/award")
async def award_points_endpoint(
    request: AwardPointsRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Award points to user"""
    target_user_id = request.target_user_id or str(current_user["_id"])
    
    # Preventing self-award unless admin/staff
    if target_user_id == str(current_user["_id"]):
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
        description=request.description
    )
    return result


@router.get("/loyalty/status")
async def get_loyalty_status(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get user's loyalty tier and benefits"""
    service = GamificationService(db)
    result = await service.get_user_loyalty(str(current_user["_id"]))
    return result


@router.get("/loyalty/tiers")
async def get_loyalty_tiers(current_user: dict = Depends(get_current_user)):
    """Get all loyalty tiers and their benefits"""
    return {
        "grihasta_tiers": [
            {
                "name": "Bronze",
                "min_points": 0,
                "max_points": 999,
                "discount": 5,
                "coin_multiplier": 1.0,
                "benefits": ["5% discount", "Standard support"]
            },
            {
                "name": "Silver",
                "min_points": 1000,
                "max_points": 4999,
                "discount": 10,
                "coin_multiplier": 2.0,
                "benefits": ["10% discount", "Priority support", "2x coins"]
            },
            {
                "name": "Gold",
                "min_points": 5000,
                "max_points": 9999,
                "discount": 15,
                "coin_multiplier": 3.0,
                "benefits": ["15% discount", "Free rescheduling", "3x coins"]
            },
            {
                "name": "Platinum",
                "min_points": 10000,
                "max_points": None,
                "discount": 20,
                "coin_multiplier": 5.0,
                "benefits": ["20% discount", "Free cancellations", "5x coins", "VIP support"]
            }
        ],
        "acharya_tiers": [
            {
                "name": "Rising Star",
                "min_points": 0,
                "max_points": 999,
                "commission_reduction": 0,
                "benefits": ["Basic visibility"]
            },
            {
                "name": "Established",
                "min_points": 1000,
                "max_points": 4999,
                "commission_reduction": 2,
                "benefits": ["Featured placement", "2% less commission"]
            },
            {
                "name": "Master",
                "min_points": 5000,
                "max_points": 9999,
                "commission_reduction": 5,
                "benefits": ["Top search", "5% less commission", "Premium badge"]
            },
            {
                "name": "Guru",
                "min_points": 10000,
                "max_points": None,
                "commission_reduction": 10,
                "benefits": ["Homepage feature", "10% less commission", "Personal manager"]
            }
        ]
    }


# ==================== Vouchers Endpoints ====================

@router.get("/vouchers/my")
async def get_my_vouchers(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get all active vouchers for current user"""
    service = GamificationService(db)
    vouchers = await service.get_user_vouchers(str(current_user["_id"]))
    return {"vouchers": vouchers}


@router.post("/vouchers/{voucher_code}/claim")
async def claim_voucher(
    voucher_code: str,
    earned_via: str = Query("manual_claim"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Claim a voucher by code"""
    service = GamificationService(db)
    result = await service.award_voucher_to_user(
        user_id=str(current_user["_id"]),
        voucher_code=voucher_code,
        earned_via=earned_via
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


# ==================== Coupons Endpoints ====================

@router.post("/coupons/validate")
async def validate_coupon(
    request: ValidateCouponRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Validate a coupon code"""
    service = GamificationService(db)
    result = await service.validate_coupon(
        code=request.code,
        user_id=str(current_user["_id"]),
        booking_amount=request.booking_amount,
        service_id=request.service_id
    )
    
    if not result["valid"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@router.get("/coupons/available")
async def get_available_coupons(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get all available coupons for current user"""
    # Get active coupons
    now = datetime.now(timezone.utc)
    coupons = await db.coupons.find({
        "is_active": True,
        "valid_from": {"$lte": now},
        "valid_until": {"$gte": now}
    }).to_list(100)
    
    user_id = str(current_user["_id"])
    result = []
    
    if not coupons:
        return {"coupons": []}
        
    # Batch usage lookups
    coupon_codes = [c["code"] for c in coupons]
    usage_pipeline = [
        {"$match": {
            "user_id": user_id,
            "coupon_code": {"$in": coupon_codes}
        }},
        {MONGO_GROUP: {
            "_id": "$coupon_code",
            "count": {"$sum": 1}
        }}
    ]
    
    usage_list = await db.coupon_usage.aggregate(usage_pipeline).to_list(None)
    usage_map = {item["_id"]: item["count"] for item in usage_list}
    
    for coupon in coupons:
        used_count = usage_map.get(coupon["code"], 0)
        
        if used_count < coupon["per_user_limit"]:
            result.append({
                "code": coupon["code"],
                "name": coupon["name"],
                "description": coupon["description"],
                "discount_type": coupon["discount_type"],
                "discount_value": coupon["discount_value"],
                "max_discount": coupon.get("max_discount"),
                "min_booking_amount": coupon.get("min_booking_amount", 0),
                "valid_until": coupon["valid_until"],
                "can_combine": coupon.get("can_combine_offers", False)
            })
    
    return {"coupons": result}


# ==================== Pricing Endpoints ====================

@router.post("/pricing/calculate")
async def calculate_price(
    request: CalculatePriceRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Calculate final price with all discounts (Amazon-style display)"""
    service = GamificationService(db)
    price_display = await service.calculate_price(
        base_amount=request.base_amount,
        user_id=str(current_user["_id"]),
        service_id=request.service_id,
        coupon_code=request.coupon_code,
        use_coins=request.use_coins
    )
    
    return price_display.dict()


# ==================== Referral Endpoints ====================

@router.get("/referral/my-code")
async def get_my_referral_code(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get or generate user's referral code"""
    service = GamificationService(db)
    user_id_str = str(current_user["_id"])
    
    # Check if user has code
    if current_user.get("referral_code"):
        code = current_user["referral_code"]
    else:
        code = await service.generate_referral_code(user_id_str)
    
    # Get referral stats using aggregation
    pipeline = [
        {"$match": {"referrer_id": user_id_str}},
        {MONGO_GROUP: {
            "_id": None,
            "total": {"$sum": 1},
            "signed_up": {
                "$sum": {
                    MONGO_COND: [{"$in": [MONGO_STATUS, ["signed_up", "completed_booking"]]}, 1, 0]
                }
            },
            "completed_booking": {
                "$sum": {
                    MONGO_COND: [{"$eq": [MONGO_STATUS, "completed_booking"]}, 1, 0]
                }
            },
            "pending": {
                "$sum": {
                    MONGO_COND: [{"$eq": [MONGO_STATUS, "pending"]}, 1, 0]
                }
            }
        }}
    ]
    
    agg_result = await db.referrals.aggregate(pipeline).to_list(1)
    
    if agg_result:
        stats = {
            "total": agg_result[0]["total"],
            "signed_up": agg_result[0]["signed_up"],
            "completed_booking": agg_result[0]["completed_booking"],
            "pending": agg_result[0]["pending"]
        }
    else:
        stats = {
            "total": 0,
            "signed_up": 0,
            "completed_booking": 0,
            "pending": 0
        }
    
    return {
        "referral_code": code,
        "referral_link": f"https://savitara.com/signup?ref={code}",
        "stats": stats
    }


@router.post("/referral/create")
async def create_referral(
    request: CreateReferralRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Create a referral (called when someone uses referral code)"""
    service = GamificationService(db)
    result = await service.create_referral(
        referrer_id=str(current_user["_id"]),
        referral_code=request.referral_code,
        referee_role=request.referee_role
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@router.get("/referral/leaderboard")
async def get_referral_leaderboard(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format"),
    db = Depends(get_database)
):
    """Get referral leaderboard for a month"""
    if not month:
        # Current month
        month = datetime.now(timezone.utc).strftime("%Y-%m")
    
    leaderboard = await db.referral_leaderboard.find(
        {"month": month}
    ).sort("rank", 1).limit(10).to_list(10)
    
    return {"month": month, "leaderboard": leaderboard}


# ==================== Milestones Endpoints ====================

@router.get("/milestones/my")
async def get_my_milestones(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get user's achieved milestones"""
    milestones = await db.milestones.find(
        {"user_id": str(current_user["_id"])}
    ).sort("achieved_at", -1).to_list(100)
    
    return {"milestones": milestones}


@router.get("/milestones/available")
async def get_available_milestones(current_user: dict = Depends(get_current_user)):
    """Get all available milestones"""
    return {
        "grihasta": [
            {"type": "bookings", "count": 1, "reward": "500 coins + REPEAT15 voucher"},
            {"type": "bookings", "count": 5, "reward": "1,000 coins + Silver tier"},
            {"type": "bookings", "count": 10, "reward": "₹200 wallet credit"},
            {"type": "bookings", "count": 25, "reward": "Gold tier + 5,000 coins"},
            {"type": "bookings", "count": 50, "reward": "₹1,000 wallet + Platinum tier"},
            {"type": "referrals", "count": 5, "reward": "1,000 coins"},
            {"type": "referrals", "count": 10, "reward": "3,000 coins"},
            {"type": "reviews", "count": 10, "reward": "500 coins"},
            {"type": "reviews", "count": 25, "reward": "1,500 coins"}
        ],
        "acharya": [
            {"type": "bookings", "count": 10, "reward": "2,000 coins + Featured badge"},
            {"type": "bookings", "count": 50, "reward": "5,000 coins + Master tier"},
            {"type": "bookings", "count": 100, "reward": "₹2,000 wallet credit"},
            {"type": "bookings", "count": 500, "reward": "Guru tier + Personal manager"},
            {"type": "referrals", "count": 5, "reward": "10,000 coins"},
            {"type": "rating", "value": "4.5+", "reward": "500 coins/month"}
        ]
    }


# ==================== Statistics Endpoints ====================

@router.get("/stats/overview")
async def get_gamification_overview(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get complete gamification overview for user"""
    service = GamificationService(db)
    
    # Get all data
    coins = await service.get_user_coins(str(current_user["_id"]))
    loyalty = await service.get_user_loyalty(str(current_user["_id"]))
    vouchers = await service.get_user_vouchers(str(current_user["_id"]))
    
    # Get referral code
    referral_code = current_user.get("referral_code", "")
    if not referral_code:
        referral_code = await service.generate_referral_code(str(current_user["_id"]))
    
    return {
        "coins": {
            "balance": coins["current_balance"],
            "rupees_value": coins["rupees_value"],
            "total_earned": coins["total_earned"]
        },
        "loyalty": {
            "tier": loyalty["current_tier"],
            "points": loyalty["points"],
            "discount": loyalty["discount_percentage"],
            "next_tier": loyalty.get("next_tier"),
            "points_to_next": loyalty.get("points_to_next_tier", 0)
        },
        "vouchers": {
            "count": len(vouchers),
            "active": len([v for v in vouchers if not v.get("is_used", False)])
        },
        "referral": {
            "code": referral_code,
            "link": f"https://savitara.com/signup?ref={referral_code}"
        }
    }


# ==================== Admin Endpoints ====================

@router.post("/admin/vouchers/create")
async def create_voucher_admin(
    voucher_data: CreateVoucherRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Admin: Create a new voucher"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail=ERROR_ADMIN_REQUIRED)
    
    service = GamificationService(db)
    
    # Convert Pydantic model to dict
    data = voucher_data.dict()
    data["created_by"] = str(current_user["_id"])
    
    result = await service.create_voucher(data)
    
    return result


@router.post("/admin/coupons/create")
async def create_coupon_admin(
    coupon_data: CreateCouponRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Admin: Create a new coupon"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail=ERROR_ADMIN_REQUIRED)
    
    # coupon_data is now a Pydantic model
    data = coupon_data.dict(exclude_unset=True)
    data["created_by"] = str(current_user["_id"])
    
    # Use the imported Coupon model if needed for further validation or consistency
    # (though CreateCouponRequest handles input validation)
    coupon = Coupon(**data)
    
    result = await db.coupons.insert_one(coupon.dict(by_alias=True, exclude={"id"}))
    
    return {
        "success": True,
        "coupon_id": str(result.inserted_id),
        "code": coupon.code
    }


@router.get("/admin/analytics")
async def get_gamification_analytics(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
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
    tier_pipeline = [
        {MONGO_GROUP: {"_id": "$current_tier", "count": {"$sum": 1}}}
    ]
    tier_dist = await db.user_loyalty.aggregate(tier_pipeline).to_list(10)
    
    # Coupon usage
    coupon_usage = await db.coupon_usage.count_documents({})
    active_coupons = await db.coupons.count_documents({"is_active": True})
    
    # Referral stats
    total_referrals = await db.referrals.count_documents({})
    completed_referrals = await db.referrals.count_documents({"status": "completed_booking"})
    
    return {
        "coins": {
            "total_in_circulation": total_coins,
            "rupees_value": total_coins * 0.1
        },
        "loyalty": {
            "tier_distribution": {item["_id"]: item["count"] for item in tier_dist}
        },
        "coupons": {
            "active_count": active_coupons,
            "total_usage": coupon_usage
        },
        "referrals": {
            "total": total_referrals,
            "completed": completed_referrals,
            "conversion_rate": (completed_referrals / total_referrals * 100) if total_referrals > 0 else 0
        }
    }
