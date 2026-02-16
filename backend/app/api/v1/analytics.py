"""
Analytics API Endpoints
Provides comprehensive analytics data for admin dashboard
SonarQube: S5122 - Proper authorization checks
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Dict, Any, Optional, Tuple
import logging
from datetime import datetime, timedelta, timezone

from app.schemas.requests import StandardResponse
from app.core.constants import (
    MONGO_MATCH,
    MONGO_GROUP,
    MONGO_SORT,
    MONGO_LIMIT,
    MONGO_SUM,
    MONGO_LOOKUP,
    MONGO_UNWIND,
    MONGO_PROJECT,
)
from app.core.security import get_current_admin
from app.db.connection import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["Analytics"])

# Constants for reducing code duplication (SonarQube compliance)
FIELD_TOTAL_AMOUNT = "$total_amount"
FIELD_CREATED_AT = "$created_at"
FIELD_STATUS = "$status"
MONGO_DATE_TO_STRING = "$dateToString"
MONGO_TO_STRING = "$toString"
MONGO_COND = "$cond"
TIME_RANGE_DESC = "Time range"


def get_date_range(time_range: str) -> Tuple[datetime, datetime]:
    """Calculate start and end dates based on time range"""
    now = datetime.now(timezone.utc)
    end_date = now

    if time_range == "7days":
        start_date = now - timedelta(days=7)
    elif time_range == "30days":
        start_date = now - timedelta(days=30)
    elif time_range == "90days":
        start_date = now - timedelta(days=90)
    elif time_range == "1year":
        start_date = now - timedelta(days=365)
    else:
        start_date = now - timedelta(days=30)

    return start_date, end_date


def calculate_growth(current: float, previous: float) -> float:
    """Calculate percentage growth"""
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return round(((current - previous) / previous) * 100, 1)


@router.get(
    "/overview",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Analytics Overview",
    description="Get key metrics overview for dashboard",
)
async def get_analytics_overview(
    time_range: str = Query(
        "30days", description=f"{TIME_RANGE_DESC}: 7days, 30days, 90days, 1year"
    ),
    current_user: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get comprehensive analytics overview"""
    try:
        start_date, end_date = get_date_range(time_range)

        # Calculate previous period for comparison
        period_duration = end_date - start_date
        prev_start = start_date - period_duration
        prev_end = start_date

        # Current period metrics
        total_users = await db.users.count_documents({})
        total_acharyas = await db.users.count_documents(
            {"role": "acharya", "status": "active"}
        )
        total_bookings = await db.bookings.count_documents({})

        new_users_current = await db.users.count_documents(
            {"created_at": {"$gte": start_date, "$lte": end_date}}
        )
        new_bookings_current = await db.bookings.count_documents(
            {"created_at": {"$gte": start_date, "$lte": end_date}}
        )

        # Revenue for current period
        revenue_pipeline = [
            {
                MONGO_MATCH: {
                    "status": "completed",
                    "completed_at": {"$gte": start_date, "$lte": end_date},
                }
            },
            {MONGO_GROUP: {"_id": None, "total": {MONGO_SUM: FIELD_TOTAL_AMOUNT}}},
        ]
        revenue_result = await db.bookings.aggregate(revenue_pipeline).to_list(1)
        revenue_current = revenue_result[0]["total"] if revenue_result else 0

        # Previous period metrics for growth calculation
        new_users_prev = await db.users.count_documents(
            {"created_at": {"$gte": prev_start, "$lte": prev_end}}
        )
        new_bookings_prev = await db.bookings.count_documents(
            {"created_at": {"$gte": prev_start, "$lte": prev_end}}
        )

        revenue_prev_pipeline = [
            {
                MONGO_MATCH: {
                    "status": "completed",
                    "completed_at": {"$gte": prev_start, "$lte": prev_end},
                }
            },
            {MONGO_GROUP: {"_id": None, "total": {MONGO_SUM: FIELD_TOTAL_AMOUNT}}},
        ]
        revenue_prev_result = await db.bookings.aggregate(
            revenue_prev_pipeline
        ).to_list(1)
        revenue_prev = revenue_prev_result[0]["total"] if revenue_prev_result else 0

        # Active users (users with activity in current period)
        active_users = await db.users.count_documents(
            {"last_login": {"$gte": start_date}}
        )

        # Pending verifications
        pending_verifications = await db.users.count_documents(
            {"role": "acharya", "status": "pending"}
        )

        # Average rating
        rating_pipeline = [
            {MONGO_MATCH: {"ratings.average": {"$gt": 0}}},
            {MONGO_GROUP: {"_id": None, "avg": {"$avg": "$ratings.average"}}},
        ]
        rating_result = await db.acharya_profiles.aggregate(rating_pipeline).to_list(1)
        avg_rating = rating_result[0]["avg"] if rating_result else 4.5

        return StandardResponse(
            success=True,
            data={
                "totalUsers": total_users,
                "totalAcharyas": total_acharyas,
                "totalBookings": total_bookings,
                "totalRevenue": revenue_current,
                "activeUsers": active_users,
                "pendingVerifications": pending_verifications,
                "averageRating": round(avg_rating, 1),
                "revenueGrowth": calculate_growth(revenue_current, revenue_prev),
                "userGrowth": calculate_growth(new_users_current, new_users_prev),
                "bookingGrowth": calculate_growth(
                    new_bookings_current, new_bookings_prev
                ),
            },
        )

    except Exception as e:
        logger.error(f"Analytics overview error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch analytics overview",
        )


@router.get(
    "/revenue",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Revenue Trends",
    description="Get revenue data over time for charts",
)
async def get_revenue_trends(
    time_range: str = Query("30days", description=TIME_RANGE_DESC),
    current_user: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get daily revenue trends"""
    try:
        start_date, end_date = get_date_range(time_range)

        pipeline = [
            {
                MONGO_MATCH: {
                    "status": "completed",
                    "completed_at": {"$gte": start_date, "$lte": end_date},
                }
            },
            {
                MONGO_GROUP: {
                    "_id": {
                        MONGO_DATE_TO_STRING: {
                            "format": "%Y-%m-%d",
                            "date": "$completed_at",
                        }
                    },
                    "revenue": {MONGO_SUM: FIELD_TOTAL_AMOUNT},
                    "bookings": {MONGO_SUM: 1},
                    "platformFees": {MONGO_SUM: "$platform_fee"},
                }
            },
            {MONGO_SORT: {"_id": 1}},
        ]

        results = await db.bookings.aggregate(pipeline).to_list(length=None)

        revenue_data = [
            {
                "date": r["_id"],
                "revenue": r["revenue"],
                "bookings": r["bookings"],
                "platformFees": r.get("platformFees", 0),
            }
            for r in results
        ]

        return StandardResponse(success=True, data=revenue_data)

    except Exception as e:
        logger.error(f"Revenue trends error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch revenue trends",
        )


@router.get(
    "/user-growth",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get User Growth",
    description="Get user registration trends",
)
async def get_user_growth(
    time_range: str = Query("30days", description=TIME_RANGE_DESC),
    current_user: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get monthly user growth by role"""
    try:
        start_date, end_date = get_date_range(time_range)

        pipeline = [
            {MONGO_MATCH: {"created_at": {"$gte": start_date, "$lte": end_date}}},
            {
                MONGO_GROUP: {
                    "_id": {
                        "month": {
                            MONGO_DATE_TO_STRING: {
                                "format": "%Y-%m",
                                "date": FIELD_CREATED_AT,
                            }
                        },
                        "role": "$role",
                    },
                    "count": {MONGO_SUM: 1},
                }
            },
            {MONGO_SORT: {"_id.month": 1}},
        ]

        results = await db.users.aggregate(pipeline).to_list(length=None)

        # Reorganize data by month
        monthly_data = {}
        for r in results:
            month = r["_id"]["month"]
            role = r["_id"]["role"]
            if month not in monthly_data:
                monthly_data[month] = {"month": month, "users": 0, "acharyas": 0}

            if role == "grihasta":
                monthly_data[month]["users"] = r["count"]
            elif role == "acharya":
                monthly_data[month]["acharyas"] = r["count"]

        growth_data = list(monthly_data.values())

        return StandardResponse(success=True, data=growth_data)

    except Exception as e:
        logger.error(f"User growth error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user growth",
        )


@router.get(
    "/booking-status",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Booking Status Distribution",
    description="Get booking counts by status",
)
async def get_booking_status(
    time_range: str = Query("30days", description=TIME_RANGE_DESC),
    current_user: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get booking distribution by status"""
    try:
        start_date, end_date = get_date_range(time_range)

        pipeline = [
            {MONGO_MATCH: {"created_at": {"$gte": start_date, "$lte": end_date}}},
            {MONGO_GROUP: {"_id": FIELD_STATUS, "count": {MONGO_SUM: 1}}},
        ]

        results = await db.bookings.aggregate(pipeline).to_list(length=None)

        # Map status names to display names
        status_names = {
            "pending": "Pending",
            "confirmed": "Confirmed",
            "in_progress": "In Progress",
            "completed": "Completed",
            "cancelled": "Cancelled",
        }

        status_data = [
            {"name": status_names.get(r["_id"], r["_id"].title()), "value": r["count"]}
            for r in results
        ]

        return StandardResponse(success=True, data=status_data)

    except Exception as e:
        logger.error(f"Booking status error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch booking status",
        )


@router.get(
    "/top-acharyas",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Top Performing Acharyas",
    description="Get acharyas ranked by revenue and bookings",
)
async def get_top_acharyas(
    limit: int = Query(10, ge=1, le=50),
    current_user: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get top performing acharyas"""
    try:
        pipeline = [
            {
                MONGO_LOOKUP: {
                    "from": "bookings",
                    "let": {"acharya_id": {MONGO_TO_STRING: "$user_id"}},
                    "pipeline": [
                        {
                            MONGO_MATCH: {
                                "$expr": {"$eq": ["$acharya_id", "$$acharya_id"]},
                                "status": "completed",
                            }
                        }
                    ],
                    "as": "completed_bookings",
                }
            },
            {
                "$addFields": {
                    "total_bookings": {"$size": "$completed_bookings"},
                    "total_revenue": {"$sum": "$completed_bookings.acharya_amount"},
                }
            },
            {MONGO_SORT: {"total_revenue": -1}},
            {MONGO_LIMIT: limit},
            {
                MONGO_LOOKUP: {
                    "from": "users",
                    "localField": "user_id",
                    "foreignField": "_id",
                    "as": "user",
                }
            },
            {MONGO_UNWIND: {"path": "$user", "preserveNullAndEmptyArrays": True}},
            {
                MONGO_PROJECT: {
                    "_id": 0,
                    "id": {MONGO_TO_STRING: "$_id"},
                    "name": 1,
                    "avatar": "$user.profile_image",
                    "rating": {"$ifNull": ["$ratings.average", 0]},
                    "bookings": "$total_bookings",
                    "revenue": "$total_revenue",
                }
            },
        ]

        results = await db.acharya_profiles.aggregate(pipeline).to_list(limit)

        # Ensure proper defaults
        acharyas = [
            {
                "id": r.get("id", ""),
                "name": r.get("name", "Unknown"),
                "avatar": r.get("avatar", ""),
                "rating": r.get("rating", 4.5),
                "bookings": r.get("bookings", 0),
                "revenue": r.get("revenue", 0),
            }
            for r in results
        ]

        return StandardResponse(success=True, data=acharyas)

    except Exception as e:
        logger.error(f"Top acharyas error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch top acharyas",
        )


@router.get(
    "/popular-services",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Popular Services",
    description="Get most booked pooja services",
)
async def get_popular_services(
    limit: int = Query(10, ge=1, le=50),
    current_user: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get popular pooja services"""
    try:
        pipeline = [
            {
                MONGO_GROUP: {
                    "_id": "$pooja_type",
                    "bookings": {MONGO_SUM: 1},
                    "revenue": {MONGO_SUM: FIELD_TOTAL_AMOUNT},
                }
            },
            {MONGO_SORT: {"bookings": -1}},
            {MONGO_LIMIT: limit},
            {MONGO_PROJECT: {"_id": 0, "service": "$_id", "bookings": 1, "revenue": 1}},
        ]

        results = await db.bookings.aggregate(pipeline).to_list(limit)

        # Handle null service names
        services = [
            {
                "service": r.get("service", "Other") or "Other",
                "bookings": r.get("bookings", 0),
                "revenue": r.get("revenue", 0),
            }
            for r in results
        ]

        return StandardResponse(success=True, data=services)

    except Exception as e:
        logger.error(f"Popular services error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch popular services",
        )


@router.get(
    "/geographic",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Geographic Distribution",
    description="Get user distribution by city/state",
)
async def get_geographic_distribution(
    group_by: str = Query("city", description="Group by: city, state"),
    current_user: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get geographic distribution of users"""
    try:
        group_field = (
            f"$address.{group_by}" if group_by in ["city", "state"] else "$address.city"
        )

        pipeline = [
            {MONGO_MATCH: {f"address.{group_by}": {"$exists": True, "$ne": None}}},
            {MONGO_GROUP: {"_id": group_field, "users": {MONGO_SUM: 1}}},
            {MONGO_SORT: {"users": -1}},
            {MONGO_LIMIT: 20},
        ]

        results = await db.users.aggregate(pipeline).to_list(20)

        locations = [
            {"location": r["_id"] or "Unknown", "users": r["users"]} for r in results
        ]

        return StandardResponse(success=True, data=locations)

    except Exception as e:
        logger.error(f"Geographic distribution error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch geographic distribution",
        )


@router.get(
    "/hourly-activity",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Hourly Activity",
    description="Get booking activity by hour of day",
)
async def get_hourly_activity(
    time_range: str = Query("30days", description=TIME_RANGE_DESC),
    current_user: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get booking activity patterns by hour"""
    try:
        start_date, end_date = get_date_range(time_range)

        pipeline = [
            {MONGO_MATCH: {"created_at": {"$gte": start_date, "$lte": end_date}}},
            {
                MONGO_GROUP: {
                    "_id": {"$hour": FIELD_CREATED_AT},
                    "bookings": {MONGO_SUM: 1},
                }
            },
            {MONGO_SORT: {"_id": 1}},
        ]

        results = await db.bookings.aggregate(pipeline).to_list(24)

        # Fill in missing hours
        hour_map = {r["_id"]: r["bookings"] for r in results}
        activity = [
            {"hour": h, "label": f"{h:02d}:00", "bookings": hour_map.get(h, 0)}
            for h in range(24)
        ]

        return StandardResponse(success=True, data=activity)

    except Exception as e:
        logger.error(f"Hourly activity error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch hourly activity",
        )


@router.get(
    "/conversion-funnel",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Conversion Funnel",
    description="Get user conversion funnel metrics",
)
async def get_conversion_funnel(
    time_range: str = Query("30days", description=TIME_RANGE_DESC),
    current_user: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get conversion funnel from signup to completed booking"""
    try:
        start_date, end_date = get_date_range(time_range)

        # Users signed up
        signups = await db.users.count_documents(
            {"created_at": {"$gte": start_date, "$lte": end_date}}
        )

        # Users with profile completed
        profiles_completed = await db.users.count_documents(
            {
                "created_at": {"$gte": start_date, "$lte": end_date},
                "profile_completed": True,
            }
        )

        # Users who made a booking
        users_with_bookings = await db.bookings.distinct(
            "grihasta_id", {"created_at": {"$gte": start_date, "$lte": end_date}}
        )
        made_booking = len(users_with_bookings)

        # Users with completed booking
        users_with_completed = await db.bookings.distinct(
            "grihasta_id",
            {
                "created_at": {"$gte": start_date, "$lte": end_date},
                "status": "completed",
            },
        )
        completed_booking = len(users_with_completed)

        funnel = [
            {"stage": "Signup", "users": signups, "rate": 100},
            {
                "stage": "Profile Completed",
                "users": profiles_completed,
                "rate": round(
                    (profiles_completed / signups * 100) if signups else 0, 1
                ),
            },
            {
                "stage": "Made Booking",
                "users": made_booking,
                "rate": round((made_booking / signups * 100) if signups else 0, 1),
            },
            {
                "stage": "Completed Booking",
                "users": completed_booking,
                "rate": round((completed_booking / signups * 100) if signups else 0, 1),
            },
        ]

        return StandardResponse(success=True, data=funnel)

    except Exception as e:
        logger.error(f"Conversion funnel error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch conversion funnel",
        )


@router.get(
    "/payment-methods",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Payment Method Distribution",
    description="Get distribution of payment methods used",
)
async def get_payment_methods(
    time_range: str = Query("30days", description=TIME_RANGE_DESC),
    current_user: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get payment method distribution"""
    try:
        start_date, end_date = get_date_range(time_range)

        pipeline = [
            {
                MONGO_MATCH: {
                    "created_at": {"$gte": start_date, "$lte": end_date},
                    "status": "completed",
                }
            },
            {
                MONGO_GROUP: {
                    "_id": "$payment_method",
                    "count": {MONGO_SUM: 1},
                    "amount": {MONGO_SUM: "$amount"},
                }
            },
            {MONGO_SORT: {"count": -1}},
        ]

        results = await db.payments.aggregate(pipeline).to_list(10)

        # Map method names
        method_names = {
            "razorpay": "Razorpay",
            "upi": "UPI",
            "card": "Credit/Debit Card",
            "netbanking": "Net Banking",
            "wallet": "Wallet",
        }

        methods = [
            {
                "method": method_names.get(r["_id"], r["_id"] or "Other"),
                "transactions": r["count"],
                "amount": r["amount"],
            }
            for r in results
        ]

        return StandardResponse(success=True, data=methods)

    except Exception as e:
        logger.error(f"Payment methods error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch payment methods",
        )


@router.get(
    "/acharya-performance",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Acharya Performance Metrics",
    description="Get detailed performance metrics for acharyas",
)
async def get_acharya_performance(
    acharya_id: Optional[str] = Query(None, description="Optional acharya ID"),
    current_user: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get acharya performance metrics"""
    try:
        match_stage = {}
        if acharya_id:
            match_stage["acharya_id"] = acharya_id

        # Booking completion rate
        pipeline = [
            {MONGO_MATCH: match_stage} if match_stage else {MONGO_MATCH: {}},
            {
                MONGO_GROUP: {
                    "_id": "$acharya_id",
                    "total": {MONGO_SUM: 1},
                    "completed": {
                        MONGO_SUM: {
                            MONGO_COND: [{"$eq": [FIELD_STATUS, "completed"]}, 1, 0]
                        }
                    },
                    "cancelled": {
                        MONGO_SUM: {
                            MONGO_COND: [{"$eq": [FIELD_STATUS, "cancelled"]}, 1, 0]
                        }
                    },
                    "total_revenue": {
                        MONGO_SUM: {
                            MONGO_COND: [
                                {"$eq": [FIELD_STATUS, "completed"]},
                                "$acharya_amount",
                                0,
                            ]
                        }
                    },
                }
            },
            {
                "$addFields": {
                    "completion_rate": {
                        "$multiply": [
                            {"$divide": ["$completed", {"$max": ["$total", 1]}]},
                            100,
                        ]
                    }
                }
            },
            {MONGO_SORT: {"total_revenue": -1}},
            {MONGO_LIMIT: 50},
        ]

        results = await db.bookings.aggregate(pipeline).to_list(50)

        performance = [
            {
                "acharyaId": r["_id"],
                "totalBookings": r["total"],
                "completed": r["completed"],
                "cancelled": r["cancelled"],
                "completionRate": round(r.get("completion_rate", 0), 1),
                "totalRevenue": r.get("total_revenue", 0),
            }
            for r in results
        ]

        return StandardResponse(success=True, data=performance)

    except Exception as e:
        logger.error(f"Acharya performance error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch acharya performance",
        )


@router.get(
    "/retention",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get User Retention",
    description="Get user retention metrics by cohort",
)
async def get_retention_metrics(
    current_user: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get user retention by signup cohort"""
    try:
        # Get users by signup month and their booking activity
        pipeline = [
            {
                MONGO_GROUP: {
                    "_id": {
                        MONGO_DATE_TO_STRING: {
                            "format": "%Y-%m",
                            "date": FIELD_CREATED_AT,
                        }
                    },
                    "total_users": {MONGO_SUM: 1},
                    "user_ids": {"$push": {MONGO_TO_STRING: "$_id"}},
                }
            },
            {MONGO_SORT: {"_id": -1}},
            {MONGO_LIMIT: 6},  # Last 6 months
        ]

        cohorts = await db.users.aggregate(pipeline).to_list(6)

        retention_data = []
        for cohort in cohorts:
            # Find users from this cohort who made bookings
            active_users = await db.bookings.distinct(
                "grihasta_id", {"grihasta_id": {"$in": cohort["user_ids"]}}
            )

            retention_rate = (
                (len(active_users) / cohort["total_users"] * 100)
                if cohort["total_users"]
                else 0
            )

            retention_data.append(
                {
                    "cohort": cohort["_id"],
                    "totalUsers": cohort["total_users"],
                    "activeUsers": len(active_users),
                    "retentionRate": round(retention_rate, 1),
                }
            )

        return StandardResponse(success=True, data=retention_data)

    except Exception as e:
        logger.error(f"Retention metrics error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch retention metrics",
        )
