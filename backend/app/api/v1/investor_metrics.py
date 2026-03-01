"""
Investor Metrics API Endpoints
Dashboard metrics for CAC, LTV, GMV, NRR, Churn
ADMIN ONLY
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta

from app.core.security import get_current_admin
from app.db.connection import get_database
from app.models.database import User
from app.services.investor_metrics_service import InvestorMetricsService
from pydantic import BaseModel


router = APIRouter(prefix="/metrics", tags=["Investor Metrics"])


class MetricsRequest(BaseModel):
    """Request for metrics calculation"""
    period_start: datetime
    period_end: datetime
    marketing_spend: Optional[Dict[str, float]] = None


@router.post("/cac", dependencies=[Depends(get_current_admin)])
async def calculate_cac_metric(
    request: MetricsRequest,
    db=Depends(get_database),
):
    """
    Calculate Customer Acquisition Cost
    
    ADMIN ONLY
    
    Formula: Total Marketing Spend / New Customers
    
    Request body:
    ```json
    {
        "period_start": "2024-01-01T00:00:00Z",
        "period_end": "2024-01-31T23:59:59Z",
        "marketing_spend": {
            "google_ads": 50000,
            "facebook": 30000,
            "referral": 10000,
            "organic": 0
        }
    }
    ```
    """
    marketing_spend = request.marketing_spend or {
        "google_ads": 0,
        "facebook": 0,
        "referral": 0,
        "organic": 0
    }
    
    cac = await InvestorMetricsService.calculate_cac(
        db,
        request.period_start,
        request.period_end,
        marketing_spend
    )
    
    return {
        "cac": cac.model_dump(by_alias=True),
        "summary": {
            "blended_cac": round(cac.blended_cac, 2),
            "total_users": cac.total_new_users,
            "total_spend": cac.total_marketing_spend,
            "efficiency": f"{cac.cac_efficiency:.1%}",
            "status": "good" if cac.cac_efficiency >= 1.0 else "needs_improvement"
        }
    }


@router.get("/ltv/{cohort_month}", dependencies=[Depends(get_current_admin)])
async def calculate_ltv_metric(
    cohort_month: str,
    db=Depends(get_database),
):
    """
    Calculate Lifetime Value for a cohort
    
    ADMIN ONLY
    
    Args:
        cohort_month: Format "YYYY-MM" (e.g., "2024-01")
    
    Formula: Avg Revenue × Avg Lifespan × Gross Margin
    """
    ltv = await InvestorMetricsService.calculate_ltv(db, cohort_month)
    
    ltv_cac_status = "excellent" if ltv.ltv_cac_ratio and ltv.ltv_cac_ratio >= 3.0 else "needs_improvement"
    
    return {
        "ltv": ltv.model_dump(by_alias=True),
        "summary": {
            "ltv": round(ltv.ltv, 2),
            "cac": round(ltv.cac, 2) if ltv.cac else None,
            "ltv_cac_ratio": round(ltv.ltv_cac_ratio, 2) if ltv.ltv_cac_ratio else None,
            "cohort_size": ltv.cohort_size,
            "retention_month_6": f"{ltv.retention_rate_month_6:.1%}",
            "status": ltv_cac_status
        }
    }


@router.post("/gmv", dependencies=[Depends(get_current_admin)])
async def calculate_gmv_metric(
    request: MetricsRequest,
    db=Depends(get_database),
):
    """
    Calculate Gross Merchandise Value
    
    ADMIN ONLY
    
    GMV = Total booking value processed
    Net Revenue = GMV × Take Rate (20%)
    """
    gmv = await InvestorMetricsService.calculate_gmv(
        db,
        request.period_start,
        request.period_end
    )
    
    return {
        "gmv": gmv.model_dump(by_alias=True),
        "summary": {
            "total_gmv": round(gmv.total_gmv, 2),
            "completed_gmv": round(gmv.completed_gmv, 2),
            "platform_revenue": round(gmv.platform_fee_collected, 2),
            "take_rate": f"{gmv.take_rate_percentage:.1f}%",
            "growth_rate": f"{gmv.gmv_growth_rate:+.1f}%",
            "avg_booking": round(gmv.avg_booking_value, 2)
        }
    }


@router.post("/repeat-rate", dependencies=[Depends(get_current_admin)])
async def calculate_repeat_booking_metric(
    request: MetricsRequest,
    db=Depends(get_database),
):
    """
    Calculate Repeat Booking Rate
    
    ADMIN ONLY
    
    Key indicator of product-market fit
    
    Target: >40% repeat rate
    """
    repeat = await InvestorMetricsService.calculate_repeat_booking_metrics(
        db,
        request.period_start,
        request.period_end
    )
    
    pmf_status = "strong" if repeat.repeat_rate_percentage >= 40 else "developing"
    
    return {
        "repeat_metrics": repeat.model_dump(by_alias=True),
        "summary": {
            "repeat_rate": f"{repeat.repeat_rate_percentage:.1f}%",
            "total_users": repeat.total_grihastas,
            "repeat_users": repeat.repeat_bookers,
            "repeat_revenue_pct": f"{repeat.repeat_revenue_percentage:.1f}%",
            "pmf_indicator": pmf_status
        }
    }


@router.post("/churn", dependencies=[Depends(get_current_admin)])
async def calculate_churn_metric(
    request: MetricsRequest,
    db=Depends(get_database),
):
    """
    Calculate Acharya Churn Rate
    
    ADMIN ONLY
    
    Churn = Acharyas with 0 bookings for 60+ days
    
    Target: <5% monthly churn
    """
    churn = await InvestorMetricsService.calculate_acharya_churn(
        db,
        request.period_start,
        request.period_end
    )
    
    health_status = "healthy" if churn.monthly_churn_rate < 5.0 else "at_risk"
    
    return {
        "churn_metrics": churn.model_dump(by_alias=True),
        "summary": {
            "total_acharyas": churn.total_acharyas,
            "active_acharyas": churn.active_acharyas,
            "churn_rate": f"{churn.monthly_churn_rate:.1f}%",
            "churned_count": churn.churned_acharyas,
            "supply_health": health_status
        }
    }


@router.get("/dashboard", dependencies=[Depends(get_current_admin)])
async def get_investor_dashboard(
    days: int = Query(30, description="Period in days"),
    db=Depends(get_database),
):
    """
    Get comprehensive investor dashboard metrics
    
    ADMIN ONLY
    
    Returns:
        All key metrics for the specified period
    """
    period_end = datetime.now(timezone.utc)
    period_start = period_end - timedelta(days=days)
    
    # Calculate all metrics in parallel (simplified - would use asyncio.gather)
    gmv = await InvestorMetricsService.calculate_gmv(db, period_start, period_end)
    repeat = await InvestorMetricsService.calculate_repeat_booking_metrics(db, period_start, period_end)
    churn = await InvestorMetricsService.calculate_acharya_churn(db, period_start, period_end)
    
    # Get recent LTV (last month's cohort)
    last_month = period_end - timedelta(days=30)
    cohort_month = f"{last_month.year}-{last_month.month:02d}"
    try:
        ltv = await InvestorMetricsService.calculate_ltv(db, cohort_month)
        ltv_data = ltv.model_dump(by_alias=True)
    except:
        ltv_data = None
    
    return {
        "period": {
            "start": period_start,
            "end": period_end,
            "days": days
        },
        "gmv": {
            "total": round(gmv.total_gmv, 2),
            "completed": round(gmv.completed_gmv, 2),
            "growth_rate": round(gmv.gmv_growth_rate, 2),
            "platform_revenue": round(gmv.platform_fee_collected, 2),
            "avg_booking_value": round(gmv.avg_booking_value, 2)
        },
        "repeat_bookings": {
            "repeat_rate": round(repeat.repeat_rate_percentage, 2),
            "total_users": repeat.total_grihastas,
            "repeat_users": repeat.repeat_bookers,
            "repeat_revenue_pct": round(repeat.repeat_revenue_percentage, 2)
        },
        "supply_health": {
            "total_acharyas": churn.total_acharyas,
            "active_acharyas": churn.active_acharyas,
            "churn_rate": round(churn.monthly_churn_rate, 2),
            "inactive_count": churn.inactive_acharyas
        },
        "ltv_analysis": ltv_data,
        "health_indicators": {
            "gmv_growth": "growing" if gmv.gmv_growth_rate > 0 else "declining",
            "pmf_strength": "strong" if repeat.repeat_rate_percentage >= 40 else "developing",
            "supply_stability": "stable" if churn.monthly_churn_rate < 5 else "at_risk",
            "ltv_cac_ratio": round(ltv.ltv_cac_ratio, 2) if ltv_data and ltv.ltv_cac_ratio else None
        }
    }


@router.get("/trends", dependencies=[Depends(get_current_admin)])
async def get_metric_trends(
    metric: str = Query(..., description="Metric name: gmv, repeat_rate, churn"),
    months: int = Query(6, description="Number of months to show"),
    db=Depends(get_database),
):
    """
    Get historical trends for a metric
    
    ADMIN ONLY
    
    Useful for charts/graphs in admin dashboard
    """
    trends = []
    current_date = datetime.now(timezone.utc)
    
    for i in range(months, 0, -1):
        month_start = current_date.replace(day=1) - timedelta(days=30 * i)
        month_end = month_start + timedelta(days=30)
        
        if metric == "gmv":
            data = await InvestorMetricsService.calculate_gmv(db, month_start, month_end)
            value = data.total_gmv
        elif metric == "repeat_rate":
            data = await InvestorMetricsService.calculate_repeat_booking_metrics(db, month_start, month_end)
            value = data.repeat_rate_percentage
        elif metric == "churn":
            data = await InvestorMetricsService.calculate_acharya_churn(db, month_start, month_end)
            value = data.monthly_churn_rate
        else:
            value = 0
        
        trends.append({
            "month": f"{month_start.year}-{month_start.month:02d}",
            "value": round(value, 2)
        })
    
    return {
        "metric": metric,
        "trends": trends
    }
