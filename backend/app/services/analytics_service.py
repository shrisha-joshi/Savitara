"""
Analytics Service for Tracking User Events and Metrics
"""
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

from app.utils.decorators import fire_and_forget
from app.core.constants import MONGO_GROUP

logger = logging.getLogger(__name__)


class AnalyticsService:
    """
    Analytics service for tracking:
    - User events (signups, bookings, payments)
    - Platform metrics
    - User behavior
    - Business insights
    """

    @staticmethod
    @fire_and_forget("track_event")
    async def track_event(
        db: AsyncIOMotorDatabase,
        event_name: str,
        user_id: str,
        properties: Dict[str, Any] = None,
    ):
        """Track user event"""
        event = {
            "event_name": event_name,
            "user_id": user_id,
            "properties": properties or {},
            "timestamp": datetime.now(),
            "date": datetime.now().date(),
            "hour": datetime.now().hour,
        }

        await db.analytics_events.insert_one(event)
        logger.info(f"Event tracked: {event_name} for user {user_id}")

    # User Events

    @staticmethod
    async def track_user_signup(db: AsyncIOMotorDatabase, user_id: str, role: str):
        """Track new user signup"""
        await AnalyticsService.track_event(
            db, "user_signup", user_id, {"role": role, "platform": "mobile"}
        )

    @staticmethod
    async def track_profile_completed(
        db: AsyncIOMotorDatabase, user_id: str, role: str
    ):
        """Track profile completion"""
        await AnalyticsService.track_event(
            db, "profile_completed", user_id, {"role": role}
        )

    # Booking Events

    @staticmethod
    async def track_booking_created(db: AsyncIOMotorDatabase, booking: Dict):
        """Track booking creation"""
        await AnalyticsService.track_event(
            db,
            "booking_created",
            booking["grihasta_id"],
            {
                "booking_id": str(booking["_id"]),
                "acharya_id": booking["acharya_id"],
                "pooja_type": booking.get("pooja_type"),
                "amount": booking.get("total_amount"),
                "with_samagri": booking.get("booking_type") == "with_samagri",
            },
        )

    @staticmethod
    async def track_booking_confirmed(
        db: AsyncIOMotorDatabase, booking_id: str, user_id: str
    ):
        """Track booking confirmation"""
        await AnalyticsService.track_event(
            db, "booking_confirmed", user_id, {"booking_id": booking_id}
        )

    @staticmethod
    async def track_booking_cancelled(
        db: AsyncIOMotorDatabase,
        booking_id: str,
        user_id: str,
        reason: Optional[str] = None,
    ):
        """Track booking cancellation"""
        await AnalyticsService.track_event(
            db,
            "booking_cancelled",
            user_id,
            {"booking_id": booking_id, "reason": reason},
        )

    @staticmethod
    async def track_booking_completed(
        db: AsyncIOMotorDatabase, booking_id: str, user_id: str
    ):
        """Track booking completion"""
        await AnalyticsService.track_event(
            db, "booking_completed", user_id, {"booking_id": booking_id}
        )

    # Payment Events

    @staticmethod
    async def track_payment_initiated(
        db: AsyncIOMotorDatabase, user_id: str, booking_id: str, amount: float
    ):
        """Track payment initiation"""
        await AnalyticsService.track_event(
            db,
            "payment_initiated",
            user_id,
            {"booking_id": booking_id, "amount": amount},
        )

    @staticmethod
    async def track_payment_completed(
        db: AsyncIOMotorDatabase,
        user_id: str,
        booking_id: str,
        amount: float,
        payment_method: str,
    ):
        """Track successful payment"""
        await AnalyticsService.track_event(
            db,
            "payment_completed",
            user_id,
            {
                "booking_id": booking_id,
                "amount": amount,
                "payment_method": payment_method,
            },
        )

    @staticmethod
    async def track_payment_failed(
        db: AsyncIOMotorDatabase, user_id: str, booking_id: str, reason: str
    ):
        """Track failed payment"""
        await AnalyticsService.track_event(
            db, "payment_failed", user_id, {"booking_id": booking_id, "reason": reason}
        )

    # Search Events

    @staticmethod
    async def track_search(
        db: AsyncIOMotorDatabase,
        user_id: str,
        query: str,
        filters: Dict[str, Any],
        results_count: int,
    ):
        """Track search query"""
        await AnalyticsService.track_event(
            db,
            "search_performed",
            user_id,
            {"query": query, "filters": filters, "results_count": results_count},
        )

    # Analytics Queries

    @staticmethod
    async def get_dashboard_metrics(
        db: AsyncIOMotorDatabase, start_date: datetime, end_date: datetime
    ) -> Dict[str, Any]:
        """Get dashboard metrics for admin"""

        # Total users
        total_users = await db.users.count_documents({})
        new_users = await db.users.count_documents(
            {"created_at": {"$gte": start_date, "$lte": end_date}}
        )

        # Total bookings
        total_bookings = await db.bookings.count_documents({})
        new_bookings = await db.bookings.count_documents(
            {"created_at": {"$gte": start_date, "$lte": end_date}}
        )

        # Revenue
        revenue_pipeline = [
            {
                "$match": {
                    "status": "completed",
                    "created_at": {"$gte": start_date, "$lte": end_date},
                }
            },
            {MONGO_GROUP: {"_id": None, "total_revenue": {"$sum": "$total_amount"}}},  # noqa: E501
        ]
        revenue_result = await db.bookings.aggregate(revenue_pipeline).to_list(1)
        total_revenue = revenue_result[0]["total_revenue"] if revenue_result else 0

        # Active acharyas
        active_acharyas = await db.acharya_profiles.count_documents(
            {"status": "verified"}
        )

        # Average rating
        rating_pipeline = [
            {MONGO_GROUP: {"_id": None, "avg_rating": {"$avg": "$ratings.average"}}}
        ]
        rating_result = await db.acharya_profiles.aggregate(rating_pipeline).to_list(1)
        avg_rating = rating_result[0]["avg_rating"] if rating_result else 0

        return {
            "users": {"total": total_users, "new": new_users},
            "bookings": {"total": total_bookings, "new": new_bookings},
            "revenue": {"total": total_revenue, "currency": "INR"},
            "acharyas": {"active": active_acharyas},
            "avg_rating": round(avg_rating, 2),
        }

    @staticmethod
    async def get_booking_trends(
        db: AsyncIOMotorDatabase, days: int = 30
    ) -> List[Dict[str, Any]]:
        """Get booking trends over time"""
        start_date = datetime.now() - timedelta(days=days)

        pipeline = [
            {"$match": {"created_at": {"$gte": start_date}}},
            {
                MONGO_GROUP: {
                    "_id": {
                        "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}
                    },
                    "count": {"$sum": 1},
                    "revenue": {"$sum": "$total_amount"},
                }
            },
            {"$sort": {"_id": 1}},
        ]

        results = await db.bookings.aggregate(pipeline).to_list(days)
        return [
            {"date": r["_id"], "bookings": r["count"], "revenue": r["revenue"]}
            for r in results
        ]

    @staticmethod
    async def get_top_acharyas(
        db: AsyncIOMotorDatabase, limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get top performing acharyas"""
        pipeline = [
            {
                "$lookup": {
                    "from": "bookings",
                    "localField": "user_id",
                    "foreignField": "acharya_id",
                    "as": "bookings",
                }
            },
            {
                "$addFields": {
                    "total_bookings": {"$size": "$bookings"},
                    "total_revenue": {"$sum": "$bookings.total_amount"},
                }
            },
            {"$sort": {"total_revenue": -1}},
            {"$limit": limit},
            {
                "$project": {
                    "name": 1,
                    "total_bookings": 1,
                    "total_revenue": 1,
                    "ratings": 1,
                }
            },
        ]

        return await db.acharya_profiles.aggregate(pipeline).to_list(limit)
