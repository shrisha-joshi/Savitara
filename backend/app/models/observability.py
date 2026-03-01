"""
Observability, Tracing, and Metrics Models
Enterprise-grade monitoring and analytics infrastructure
"""
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum


def utcnow():
    return datetime.now(timezone.utc)


# ==================== DISTRIBUTED TRACING ====================


class TraceContext(BaseModel):
    """
    Distributed tracing context for request correlation
    
    Implementation: OpenTelemetry-compatible
    Propagation: W3C Trace Context standard
    
    Usage:
    >>> trace = TraceContext.generate()
    >>> logger.info("Booking created", extra={"trace_id": trace.trace_id})
    """
    trace_id: str  # Unique ID for entire request flow (128-bit hex)
    span_id: str  # Unique ID for this operation (64-bit hex)
    parent_span_id: Optional[str]  # Parent operation
    trace_flags: str = "01"  # Sampled
    trace_state: Optional[str]  # Vendor-specific
    
    # Service Context
    service_name: str = "savitara-backend"
    operation_name: str  # e.g., "POST /bookings"
    
    # Timing
    start_time: datetime = Field(default_factory=utcnow)
    end_time: Optional[datetime]
    duration_ms: Optional[float]
    
    # Tags
    tags: Dict[str, str] = {}  # {"user_id": "123", "booking_id": "456"}
    
    model_config = ConfigDict(populate_by_name=True)
    
    @classmethod
    def generate(cls, operation_name: str, service_name: str = "savitara-backend"):
        """Generate new trace context"""
        import secrets
        return cls(
            trace_id=secrets.token_hex(16),
            span_id=secrets.token_hex(8),
            operation_name=operation_name,
            service_name=service_name,
        )


# ==================== STRUCTURED LOGGING ====================


class LogLevel(str, Enum):
    """Log severity levels"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class StructuredLog(BaseModel):
    """
    Structured log entry for centralized logging
    
    Format: JSON
    Destination: CloudWatch / ELK / Datadog
    
    Fields follow OpenTelemetry semantic conventions
    """
    timestamp: datetime = Field(default_factory=utcnow)
    level: LogLevel
    message: str
    
    # Tracing
    trace_id: Optional[str]
    span_id: Optional[str]
    
    # Service Context
    service_name: str = "savitara-backend"
    service_version: Optional[str]
    environment: str = "production"  # "dev", "staging", "prod"
    
    # Request Context
    http_method: Optional[str]
    http_path: Optional[str]
    http_status_code: Optional[int]
    http_user_agent: Optional[str]
    
    # User Context
    user_id: Optional[str]
    user_role: Optional[str]
    session_id: Optional[str]
    
    # Business Context
    booking_id: Optional[str]
    acharya_id: Optional[str]
    grihasta_id: Optional[str]
    
    # Error Context
    error_type: Optional[str]
    error_message: Optional[str]
    error_stack_trace: Optional[str]
    
    # Custom Fields
    custom_fields: Dict[str, Any] = {}
    
    # Performance
    duration_ms: Optional[float]
    
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)


# ==================== INVESTOR METRICS ====================


class MetricType(str, Enum):
    """Types of business metrics"""
    COUNTER = "counter"  # Monotonically increasing
    GAUGE = "gauge"  # Point-in-time value
    HISTOGRAM = "histogram"  # Distribution
    SUMMARY = "summary"  # Aggregated statistics


class BusinessMetric(BaseModel):
    """
    Investor-ready business metrics tracking
    
    Key Metrics:
    - CAC (Customer Acquisition Cost)
    - LTV (Lifetime Value)
    - GMV (Gross Merchandise Value)
    - Take Rate (Platform Fee %)
    - Repeat Booking %
    - Acharya Churn
    - NRR (Net Revenue Retention)
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    # Metric Identification
    metric_name: str  # "gmv", "cac", "ltv", "repeat_rate", etc.
    metric_type: MetricType
    metric_category: str  # "revenue", "growth", "retention", "efficiency"
    
    # Value
    value: float
    unit: str  # "rupees", "percentage", "days", "count"
    
    # Dimensions (breakdown)
    dimensions: Dict[str, str] = {}  # {"city": "Bangalore", "user_segment": "premium"}
    
    # Time Period
    period_start: datetime
    period_end: datetime
    granularity: str = "daily"  # "hourly", "daily", "weekly", "monthly"
    
    # Comparison
    previous_period_value: Optional[float]
    change_percentage: Optional[float]
    trend: Optional[str]  # "up", "down", "stable"
    
    # Benchmarks
    target_value: Optional[float]
    target_met: bool = False
    
    # Metadata
    calculated_at: datetime = Field(default_factory=utcnow)
    data_sources: List[str] = []  # ["bookings", "payments", "users"]
    calculation_method: Optional[str]
    
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)


class CACCalculation(BaseModel):
    """
    Customer Acquisition Cost (CAC) breakdown
    
    Formula: Total Marketing Spend / New Customers Acquired
    
    Tracked by:
    - Channel (Google Ads, Facebook, Referral, Organic)
    - User Segment (Grihasta vs Acharya)
    - Geography (City/State)
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    period_start: datetime
    period_end: datetime
    
    # Acquisition Data
    new_grihastas: int
    new_acharyas: int
    total_new_users: int
    
    # Marketing Spend
    total_marketing_spend: float
    channel_breakdown: Dict[str, float] = {}  # {"google_ads": 50000, "facebook": 30000}
    
    # CAC Values
    blended_cac: float  # Total spend / total users
    grihasta_cac: float
    acharya_cac: float
    cac_by_channel: Dict[str, float] = {}
    
    # Targets
    target_cac: float
    cac_efficiency: float  # Target / Actual
    
    calculated_at: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(populate_by_name=True)


class LTVCalculation(BaseModel):
    """
    Lifetime Value (LTV) calculation
    
    Formula: Avg Revenue Per User * Avg Customer Lifespan (months) * Gross Margin
    
    Cohort-based tracking for accuracy
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    cohort_month: str  # "2024-01" (users acquired in this month)
    
    # Cohort Stats
    cohort_size: int
    active_users: int  # Still active
    churned_users: int
    
    # Revenue
    total_revenue: float  # From this cohort
    avg_revenue_per_user: float
    avg_booking_value: float
    avg_bookings_per_user: float
    
    # Lifespan
    avg_lifespan_months: float
    retention_rate_month_1: float
    retention_rate_month_3: float
    retention_rate_month_6: float
    retention_rate_month_12: float
    
    # LTV
    gross_margin_percentage: float = 20.0  # Platform takes 20%
    ltv: float  # Final calculated LTV
    
    # LTV:CAC Ratio
    cac: Optional[float]
    ltv_cac_ratio: Optional[float]  # Should be > 3.0
    
    calculated_at: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(populate_by_name=True)


class GMVTracking(BaseModel):
    """
    Gross Merchandise Value (GMV) tracking
    
    GMV = Total booking value processed through platform
    Net Revenue = GMV * Take Rate
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    period_start: datetime
    period_end: datetime
    granularity: str = "daily"
    
    # GMV
    total_gmv: float
    completed_gmv: float  # Only completed bookings
    pending_gmv: float
    cancelled_gmv: float
    
    # Volume
    total_bookings: int
    completed_bookings: int
    avg_booking_value: float
    
    # Take Rate
    platform_fee_collected: float
    take_rate_percentage: float  # (Platform Fee / GMV) * 100
    
    # Breakdowns
    gmv_by_city: Dict[str, float] = {}
    gmv_by_service: Dict[str, float] = {}
    gmv_by_acharya_tier: Dict[str, float] = {}
    
    # Growth
    previous_period_gmv: Optional[float]
    gmv_growth_rate: Optional[float]
    
    calculated_at: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(populate_by_name=True)


class RepeatBookingMetrics(BaseModel):
    """
    Repeat booking rate - key indicator of product-market fit
    
    Repeat Rate = (Users with >1 booking / Total users) * 100
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    period_start: datetime
    period_end: datetime
    
    # User Segmentation
    total_grihastas: int
    first_time_bookers: int
    repeat_bookers: int
    
    # Repeat Metrics
    repeat_rate_percentage: float
    avg_bookings_per_repeat_customer: float
    
    # Frequency Distribution
    users_with_2_bookings: int
    users_with_3_to_5_bookings: int
    users_with_6_plus_bookings: int
    
    # Revenue Impact
    revenue_from_repeat: float
    revenue_from_new: float
    repeat_revenue_percentage: float
    
    # Cohort Analysis
    cohort_breakdown: Dict[str, float] = {}  # {"2024-01": 45.2, "2024-02": 48.1}
    
    calculated_at: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(populate_by_name=True)


class AcharyaChurnMetrics(BaseModel):
    """
    Acharya churn tracking
    
    Churn = Acharyas who completed 0 bookings in last 30 days
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    period_start: datetime
    period_end: datetime
    
    # Supply Stats
    total_acharyas: int
    active_acharyas: int  # At least 1 booking in period
    inactive_acharyas: int
    churned_acharyas: int  # 0 bookings for 60+ days
    
    # Churn Rate
    monthly_churn_rate: float  # Percentage
    
    # Reasons (from exit surveys/analysis)
    churn_reasons: Dict[str, int] = {}
    # {"low_demand": 15, "low_earnings": 10, "platform_issues": 5}
    
    # Retention Efforts
    reactivation_attempts: int
    successfully_reactivated: int
    
    calculated_at: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(populate_by_name=True)


class NRRCalculation(BaseModel):
    """
    Net Revenue Retention (NRR)
    
    Formula: (Revenue from cohort today / Revenue from cohort 1 year ago) * 100
    
    Includes: expansion revenue (more bookings)
    Excludes: new customer revenue
    
    Target: > 100% (shows expansion)
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    cohort_month: str  # "2023-01"
    measurement_date: datetime
    
    # Cohort Revenue
    cohort_revenue_at_start: float  # Revenue in month 0
    cohort_revenue_current: float  # Revenue in current period
    
    # Retention
    starting_customers: int
    retained_customers: int
    churned_customers: int
    
    # Expansion
    expansion_revenue: float  # Additional revenue from retained customers
    contraction_revenue: float  # Lost revenue from downgrades
    
    # NRR
    nrr_percentage: float  # (Current / Start) * 100
    expansion_rate: float
    
    calculated_at: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(populate_by_name=True)


# ==================== PERFORMANCE MONITORING ====================


class APIPerformanceMetric(BaseModel):
    """
    API endpoint performance tracking
    
    Used for SLO monitoring and alerting
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    # Endpoint
    http_method: str
    http_path: str
    
    # Time Window
    timestamp: datetime = Field(default_factory=utcnow)
    window_minutes: int = 5  # Aggregation window
    
    # Request Stats
    total_requests: int
    successful_requests: int
    failed_requests: int
    error_rate_percentage: float
    
    # Latency (milliseconds)
    p50_latency_ms: float
    p90_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    max_latency_ms: float
    avg_latency_ms: float
    
    # SLO Compliance
    slo_target_p95: float = 500.0  # ms
    slo_met: bool = True
    
    # Errors
    error_breakdown: Dict[str, int] = {}  # {"400": 10, "500": 2}
    
    model_config = ConfigDict(populate_by_name=True)


class DatabaseQueryMetric(BaseModel):
    """
    Database query performance monitoring
    
    Identifies slow queries and missing indexes
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    # Query
    collection: str
    operation: str  # "find", "aggregate", "update", "insert"
    query_pattern: str  # Sanitized query (no values)
    
    # Performance
    execution_time_ms: float
    documents_examined: int
    documents_returned: int
    index_used: Optional[str]
    
    # Flags
    is_slow: bool = False  # execution_time > 100ms
    missing_index: bool = False
    
    # Context
    trace_id: Optional[str]
    api_endpoint: Optional[str]
    
    timestamp: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(populate_by_name=True)
