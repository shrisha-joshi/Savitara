"""
Investor Metrics Service
CAC, LTV, GMV, NRR, Repeat Booking, Churn calculations
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.observability import (
    CACCalculation,
    LTVCalculation,
    GMVTracking,
    RepeatBookingMetrics,
    AcharyaChurnMetrics,
    NRRCalculation,
)
from app.core.constants import MONGO_MATCH, MONGO_GROUP, FIELD_TOTAL_AMOUNT


def utcnow():
    return datetime.now(timezone.utc)


class InvestorMetricsService:
    """
    Calculate investor-ready business metrics
    
    Key Metrics:
    - CAC (Customer Acquisition Cost)
    - LTV (Lifetime Value)
    - GMV (Gross Merchandise Value)
    - Repeat Booking Rate
    - Acharya Churn
    - NRR (Net Revenue Retention)
    """
    
    @staticmethod
    async def calculate_cac(
        db: AsyncIOMotorDatabase,
        period_start: datetime,
        period_end: datetime,
        marketing_spend: Dict[str, float]
    ) -> CACCalculation:
        """
        Calculate Customer Acquisition Cost
        
        Formula: Total Marketing Spend / New Customers Acquired
        
        Args:
            period_start: Start of period
            period_end: End of period
            marketing_spend: {"google_ads": 50000, "facebook": 30000, "referral": 10000}
        
        Returns:
            CACCalculation with blended and channel-specific CAC
        """
        # Count new users in period
        new_grihastas = await db.users.count_documents({
            "role": "grihasta",
            "created_at": {"$gte": period_start, "$lte": period_end}
        })
        
        new_acharyas = await db.users.count_documents({
            "role": "acharya",
            "created_at": {"$gte": period_start, "$lte": period_end}
        })
        
        total_new_users = new_grihastas + new_acharyas
        
        # Calculate total spend
        total_spend = sum(marketing_spend.values())
        
        # Calculate CAC
        blended_cac = total_spend / total_new_users if total_new_users > 0 else 0.0
        
        # Assume 80% of users are Grihastas, 20% Acharyas for spend allocation
        grihasta_spend = total_spend * 0.80
        acharya_spend = total_spend * 0.20
        
        grihasta_cac = grihasta_spend / new_grihastas if new_grihastas > 0 else 0.0
        acharya_cac = acharya_spend / new_acharyas if new_acharyas > 0 else 0.0
        
        # Channel CAC (simplified - assume even distribution)
        cac_by_channel = {}
        for channel, spend in marketing_spend.items():
            channel_users = total_new_users * (spend / total_spend)
            cac_by_channel[channel] = spend / channel_users if channel_users > 0 else 0.0
        
        # Target CAC (industry benchmark: ₹500 for marketplace)
        target_cac = 500.0
        cac_efficiency = target_cac / blended_cac if blended_cac > 0 else 0.0
        
        cac_calc = CACCalculation(
            period_start=period_start,
            period_end=period_end,
            new_grihastas=new_grihastas,
            new_acharyas=new_acharyas,
            total_new_users=total_new_users,
            total_marketing_spend=total_spend,
            channel_breakdown=marketing_spend,
            blended_cac=blended_cac,
            grihasta_cac=grihasta_cac,
            acharya_cac=acharya_cac,
            cac_by_channel=cac_by_channel,
            target_cac=target_cac,
            cac_efficiency=cac_efficiency,
            calculated_at=utcnow()
        )
        
        # Store in database
        await db.business_metrics.insert_one(
            cac_calc.model_dump(by_alias=True, exclude={"id"})
        )
        
        return cac_calc
    
    @staticmethod
    async def calculate_ltv(
        db: AsyncIOMotorDatabase,
        cohort_month: str  # "2024-01"
    ) -> LTVCalculation:
        """
        Calculate Lifetime Value for a cohort
        
        Formula: Avg Revenue Per User × Avg Lifespan (months) × Gross Margin
        
        Args:
            cohort_month: Format "YYYY-MM"
        
        Returns:
            LTVCalculation with retention rates and LTV:CAC ratio
        """
        # Parse cohort month
        year, month = map(int, cohort_month.split("-"))
        cohort_start = datetime(year, month, 1, tzinfo=timezone.utc)
        cohort_end = datetime(year, month + 1 if month < 12 else 1, 
                             1 if month < 12 else year + 1, tzinfo=timezone.utc)
        
        # Get cohort users
        cohort_users = await db.users.find({
            "role": "grihasta",
            "created_at": {"$gte": cohort_start, "$lt": cohort_end}
        }).to_list(length=None)
        
        cohort_size = len(cohort_users)
        cohort_user_ids = [str(u["_id"]) for u in cohort_users]
        
        # Count active users (at least 1 booking in last 60 days)
        sixty_days_ago = utcnow() - timedelta(days=60)
        active_bookings = await db.bookings.distinct("user_id", {
            "user_id": {"$in": cohort_user_ids},
            "created_at": {"$gte": sixty_days_ago}
        })
        active_users = len(active_bookings)
        churned_users = cohort_size - active_users
        
        # Calculate total revenue from cohort
        bookings = await db.bookings.find({
            "user_id": {"$in": cohort_user_ids},
            "status": "completed"
        }).to_list(length=None)
        
        total_revenue = sum(b.get("total_amount", 0) for b in bookings)
        avg_revenue_per_user = total_revenue / cohort_size if cohort_size > 0 else 0.0
        avg_bookings_per_user = len(bookings) / cohort_size if cohort_size > 0 else 0.0
        avg_booking_value = total_revenue / len(bookings) if bookings else 0.0
        
        # Calculate lifespan
        months_since_cohort = (utcnow().year - year) * 12 + (utcnow().month - month)
        avg_lifespan_months = months_since_cohort if months_since_cohort > 0 else 1
        
        # Retention rates (simplified - check bookings in each month)
        retention_month_1 = await InvestorMetricsService._calculate_retention(
            db, cohort_user_ids, cohort_start, 1
        )
        retention_month_3 = await InvestorMetricsService._calculate_retention(
            db, cohort_user_ids, cohort_start, 3
        )
        retention_month_6 = await InvestorMetricsService._calculate_retention(
            db, cohort_user_ids, cohort_start, 6
        )
        retention_month_12 = await InvestorMetricsService._calculate_retention(
            db, cohort_user_ids, cohort_start, 12
        )
        
        # Calculate LTV
        gross_margin = 0.20  # Platform takes 20% fee
        ltv = avg_revenue_per_user * (avg_lifespan_months / 12.0) * gross_margin
        
        # Get CAC for this cohort
        cac_record = await db.business_metrics.find_one({
            "period_start": {"$lte": cohort_start},
            "period_end": {"$gte": cohort_end},
            "blended_cac": {"$exists": True}
        })
        cac = cac_record.get("blended_cac", 0) if cac_record else None
        ltv_cac_ratio = ltv / cac if cac and cac > 0 else None
        
        ltv_calc = LTVCalculation(
            cohort_month=cohort_month,
            cohort_size=cohort_size,
            active_users=active_users,
            churned_users=churned_users,
            total_revenue=total_revenue,
            avg_revenue_per_user=avg_revenue_per_user,
            avg_booking_value=avg_booking_value,
            avg_bookings_per_user=avg_bookings_per_user,
            avg_lifespan_months=float(avg_lifespan_months),
            retention_rate_month_1=retention_month_1,
            retention_rate_month_3=retention_month_3,
            retention_rate_month_6=retention_month_6,
            retention_rate_month_12=retention_month_12,
            gross_margin_percentage=gross_margin * 100,
            ltv=ltv,
            cac=cac,
            ltv_cac_ratio=ltv_cac_ratio,
            calculated_at=utcnow()
        )
        
        await db.business_metrics.insert_one(
            ltv_calc.model_dump(by_alias=True, exclude={"id"})
        )
        
        return ltv_calc
    
    @staticmethod
    async def _calculate_retention(
        db: AsyncIOMotorDatabase,
        user_ids: List[str],
        cohort_start: datetime,
        months_after: int
    ) -> float:
        """Calculate retention rate N months after cohort start"""
        target_month_start = cohort_start + timedelta(days=30 * months_after)
        target_month_end = target_month_start + timedelta(days=30)
        
        active_in_month = await db.bookings.distinct("user_id", {
            "user_id": {"$in": user_ids},
            "created_at": {"$gte": target_month_start, "$lt": target_month_end}
        })
        
        return len(active_in_month) / len(user_ids) if user_ids else 0.0
    
    @staticmethod
    async def calculate_gmv(
        db: AsyncIOMotorDatabase,
        period_start: datetime,
        period_end: datetime
    ) -> GMVTracking:
        """
        Calculate Gross Merchandise Value
        
        GMV = Total booking value processed
        Net Revenue = GMV × Take Rate
        """
        # Aggregate bookings by status
        pipeline = [
            {MONGO_MATCH: {"created_at": {"$gte": period_start, "$lte": period_end}}},
            {MONGO_GROUP: {
                "_id": "$status",
                "total_amount": {"$sum": FIELD_TOTAL_AMOUNT},
                "count": {"$sum": 1}
            }}
        ]
        
        results = await db.bookings.aggregate(pipeline).to_list(length=None)
        
        total_gmv = 0.0
        completed_gmv = 0.0
        pending_gmv = 0.0
        cancelled_gmv = 0.0
        total_bookings = 0
        completed_bookings = 0
        
        for result in results:
            status = result["_id"]
            amount = result["total_amount"]
            count = result["count"]
            
            total_gmv += amount
            total_bookings += count
            
            if status == "completed":
                completed_gmv = amount
                completed_bookings = count
            elif status in ["pending", "accepted", "in_progress"]:
                pending_gmv += amount
            elif status == "cancelled":
                cancelled_gmv = amount
        
        avg_booking_value = total_gmv / total_bookings if total_bookings > 0 else 0.0
        
        # Platform fee calculation (20%)
        platform_fee_collected = completed_gmv * 0.20
        take_rate = (platform_fee_collected / total_gmv * 100) if total_gmv > 0 else 0.0
        
        # GMV breakdowns
        gmv_by_city = await InvestorMetricsService._gmv_by_dimension(
            db, period_start, period_end, "city"
        )
        gmv_by_service = await InvestorMetricsService._gmv_by_dimension(
            db, period_start, period_end, "pooja_name"
        )
        
        # Previous period comparison
        prev_period_start = period_start - (period_end - period_start)
        prev_results = await db.bookings.aggregate([
            {MONGO_MATCH: {"created_at": {"$gte": prev_period_start, "$lt": period_start}}},
            {MONGO_GROUP: {"_id": None, "total": {"$sum": FIELD_TOTAL_AMOUNT}}}
        ]).to_list(1)
        
        previous_period_gmv = prev_results[0]["total"] if prev_results else 0.0
        gmv_growth = ((total_gmv - previous_period_gmv) / previous_period_gmv * 100) if previous_period_gmv > 0 else 0.0
        
        gmv_tracking = GMVTracking(
            period_start=period_start,
            period_end=period_end,
            granularity="monthly",
            total_gmv=total_gmv,
            completed_gmv=completed_gmv,
            pending_gmv=pending_gmv,
            cancelled_gmv=cancelled_gmv,
            total_bookings=total_bookings,
            completed_bookings=completed_bookings,
            avg_booking_value=avg_booking_value,
            platform_fee_collected=platform_fee_collected,
            take_rate_percentage=take_rate,
            gmv_by_city=gmv_by_city,
            gmv_by_service=gmv_by_service,
            previous_period_gmv=previous_period_gmv,
            gmv_growth_rate=gmv_growth,
            calculated_at=utcnow()
        )
        
        await db.business_metrics.insert_one(
            gmv_tracking.model_dump(by_alias=True, exclude={"id"})
        )
        
        return gmv_tracking
    
    @staticmethod
    async def _gmv_by_dimension(
        db: AsyncIOMotorDatabase,
        period_start: datetime,
        period_end: datetime,
        dimension_field: str
    ) -> Dict[str, float]:
        """Helper to calculate GMV by dimension"""
        pipeline = [
            {MONGO_MATCH: {
                "created_at": {"$gte": period_start, "$lte": period_end},
                "status": "completed"
            }},
            {MONGO_GROUP: {
                "_id": f"${dimension_field}",
                "total": {"$sum": FIELD_TOTAL_AMOUNT}
            }}
        ]
        
        results = await db.bookings.aggregate(pipeline).to_list(length=None)
        return {r["_id"]: r["total"] for r in results if r["_id"]}
    
    @staticmethod
    async def calculate_repeat_booking_metrics(
        db: AsyncIOMotorDatabase,
        period_start: datetime,
        period_end: datetime
    ) -> RepeatBookingMetrics:
        """Calculate repeat booking rate - key PMF indicator"""
        # Get all Grihastas with completed bookings in period
        bookings = await db.bookings.find({
            "created_at": {"$gte": period_start, "$lte": period_end},
            "status": "completed"
        }).to_list(length=None)
        
        # Count bookings per user
        user_booking_counts = {}
        for booking in bookings:
            user_id = booking["user_id"]
            user_booking_counts[user_id] = user_booking_counts.get(user_id, 0) + 1
        
        total_grihastas = len(user_booking_counts)
        first_time_bookers = sum(1 for count in user_booking_counts.values() if count == 1)
        repeat_bookers = total_grihastas - first_time_bookers
        
        repeat_rate = (repeat_bookers / total_grihastas * 100) if total_grihastas > 0 else 0.0
        
        # Frequency distribution
        users_with_2 = sum(1 for c in user_booking_counts.values() if c == 2)
        users_with_3_to_5 = sum(1 for c in user_booking_counts.values() if 3 <= c <= 5)
        users_with_6_plus = sum(1 for c in user_booking_counts.values() if c >= 6)
        
        avg_bookings_repeat = sum(c for c in user_booking_counts.values() if c > 1) / repeat_bookers if repeat_bookers > 0 else 0.0
        
        # Revenue breakdown
        revenue_from_repeat = sum(
            b["total_amount"] for b in bookings
            if user_booking_counts.get(b["user_id"], 0) > 1
        )
        revenue_from_new = sum(
            b["total_amount"] for b in bookings
            if user_booking_counts.get(b["user_id"], 0) == 1
        )
        total_revenue = revenue_from_repeat + revenue_from_new
        repeat_revenue_pct = (revenue_from_repeat / total_revenue * 100) if total_revenue > 0 else 0.0
        
        metrics = RepeatBookingMetrics(
            period_start=period_start,
            period_end=period_end,
            total_grihastas=total_grihastas,
            first_time_bookers=first_time_bookers,
            repeat_bookers=repeat_bookers,
            repeat_rate_percentage=repeat_rate,
            avg_bookings_per_repeat_customer=avg_bookings_repeat,
            users_with_2_bookings=users_with_2,
            users_with_3_to_5_bookings=users_with_3_to_5,
            users_with_6_plus_bookings=users_with_6_plus,
            revenue_from_repeat=revenue_from_repeat,
            revenue_from_new=revenue_from_new,
            repeat_revenue_percentage=repeat_revenue_pct,
            calculated_at=utcnow()
        )
        
        await db.business_metrics.insert_one(
            metrics.model_dump(by_alias=True, exclude={"id"})
        )
        
        return metrics
    
    @staticmethod
    async def calculate_acharya_churn(
        db: AsyncIOMotorDatabase,
        period_start: datetime,
        period_end: datetime
    ) -> AcharyaChurnMetrics:
        """Calculate Acharya churn - supply side health"""
        # Get all Acharyas
        total_acharyas = await db.users.count_documents({"role": "acharya"})
        
        # Active: at least 1 booking in period
        active_acharya_ids = await db.bookings.distinct("acharya_id", {
            "created_at": {"$gte": period_start, "$lte": period_end},
            "status": "completed"
        })
        active_acharyas = len(active_acharya_ids)
        
        # Inactive: 0 bookings in period
        inactive_acharyas = total_acharyas - active_acharyas
        
        # Churned: 0 bookings for 60+ days
        sixty_days_ago = period_end - timedelta(days=60)
        recent_acharya_ids = await db.bookings.distinct("acharya_id", {
            "created_at": {"$gte": sixty_days_ago}
        })
        churned_acharyas = total_acharyas - len(recent_acharya_ids)
        
        monthly_churn_rate = (churned_acharyas / total_acharyas * 100) if total_acharyas > 0 else 0.0
        
        metrics = AcharyaChurnMetrics(
            period_start=period_start,
            period_end=period_end,
            total_acharyas=total_acharyas,
            active_acharyas=active_acharyas,
            inactive_acharyas=inactive_acharyas,
            churned_acharyas=churned_acharyas,
            monthly_churn_rate=monthly_churn_rate,
            churn_reasons={},  # Would need exit surveys
            reactivation_attempts=0,
            successfully_reactivated=0,
            calculated_at=utcnow()
        )
        
        await db.business_metrics.insert_one(
            metrics.model_dump(by_alias=True, exclude={"id"})
        )
        
        return metrics
