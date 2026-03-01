"""
Trust Architecture Models
Enterprise-grade trust, verification, and dispute resolution system
"""
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum


def utcnow():
    return datetime.now(timezone.utc)


# ==================== TRUST SCORE SYSTEM ====================


class VerificationLevel(str, Enum):
    """Acharya verification levels"""
    UNVERIFIED = "unverified"
    BASIC = "basic"  # Phone + email verified
    IDENTITY_VERIFIED = "identity_verified"  # KYC documents verified
    CREDENTIAL_VERIFIED = "credential_verified"  # Educational certificates verified
    SAVITARA_CERTIFIED = "savitara_certified"  # Full verification + background check
    ELITE = "elite"  # Top 5% performers with perfect record


class TrustScoreComponent(BaseModel):
    """Individual component of trust score"""
    metric_name: str
    raw_value: float
    normalized_score: float  # 0-100
    weight: float  # Weight in final composite score
    last_updated: datetime = Field(default_factory=utcnow)


class AcharyaTrustScore(BaseModel):
    """
    Weighted composite trust score for Acharyas
    
    Components:
    - Verification Level (30%): Identity, credentials, background check
    - Completion Rate (20%): Bookings completed vs cancelled
    - Response Time (15%): Average time to accept/respond to bookings
    - Rebooking Rate (15%): % of customers who book again
    - Review Quality (15%): Average rating + consistency + sentiment
    - Platform Compliance (5%): Policy adherence, no violations
    
    Score Range: 0-100
    Public Display: "Verified by Savitara" badge if score >= 85
    """
    id: Optional[str] = Field(alias="_id", default=None)
    acharya_id: str  # Reference to acharya_profiles.user_id
    
    # Composite Score
    overall_score: float = 0.0  # 0-100
    score_tier: str = "unranked"  # emerging, trusted, verified, elite
    public_badge: bool = False  # "Verified by Savitara" badge
    
    # Individual Components (weighted)
    verification_level: VerificationLevel = VerificationLevel.UNVERIFIED
    verification_score: float = 0.0  # 0-100, weight: 30%
    
    completion_rate: float = 0.0  # 0-100%, weight: 20%
    completion_score: float = 0.0
    
    avg_response_time_minutes: float = 0.0
    response_time_score: float = 0.0  # 0-100, weight: 15%
    
    rebooking_rate: float = 0.0  # 0-100%
    rebooking_score: float = 0.0  # weight: 15%
    
    avg_rating: float = 0.0  # 1-5 stars
    rating_consistency: float = 0.0  # Standard deviation (lower is better)
    review_quality_score: float = 0.0  # 0-100, weight: 15%
    
    compliance_score: float = 100.0  # Starts at 100, deductions for violations, weight: 5%
    
    # Detailed Metrics
    total_bookings: int = 0
    completed_bookings: int = 0
    cancelled_by_acharya: int = 0
    total_reviews: int = 0
    five_star_reviews: int = 0
    repeat_customers: int = 0
    unique_customers: int = 0
    
    # Penalties & Violations
    total_violations: int = 0
    active_warnings: int = 0
    offline_booking_attempts: int = 0  # Disintermediation attempts
    
    # Timestamps
    last_calculated: datetime = Field(default_factory=utcnow)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    
    # Score History (for trend analysis)
    score_history: List[Dict[str, Any]] = []  # [{score: 85, date: "2024-01-01"}, ...]
    
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)


class TrustBadge(BaseModel):
    """Public trust badge earned by Acharya"""
    id: Optional[str] = Field(alias="_id", default=None)
    acharya_id: str
    badge_type: str  # "verified_savitara", "top_rated", "elite_performer", "quick_responder"
    badge_name: str
    badge_icon_url: Optional[str]
    awarded_at: datetime = Field(default_factory=utcnow)
    expires_at: Optional[datetime]  # Some badges expire and need renewal
    is_active: bool = True
    
    model_config = ConfigDict(populate_by_name=True)


# ==================== IMMUTABLE AUDIT LOG ====================


class AuditEventType(str, Enum):
    """Types of auditable events"""
    # User Events
    USER_CREATED = "user_created"
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"
    USER_UPDATED = "user_updated"
    USER_SUSPENDED = "user_suspended"
    USER_DELETED = "user_deleted"
    
    # Booking Events
    BOOKING_CREATED = "booking_created"
    BOOKING_CONFIRMED = "booking_confirmed"
    BOOKING_STARTED = "booking_started"
    BOOKING_COMPLETED = "booking_completed"
    BOOKING_CANCELLED = "booking_cancelled"
    BOOKING_REJECTED = "booking_rejected"
    BOOKING_MODIFIED = "booking_modified"
    
    # Payment Events
    PAYMENT_INITIATED = "payment_initiated"
    PAYMENT_COMPLETED = "payment_completed"
    PAYMENT_FAILED = "payment_failed"
    PAYMENT_REFUNDED = "payment_refunded"
    REFUND_PROCESSED = "refund_processed"
    
    # Trust & Safety
    REVIEW_CREATED = "review_created"
    REVIEW_FLAGGED = "review_flagged"
    DISPUTE_CREATED = "dispute_created"
    DISPUTE_RESOLVED = "dispute_resolved"
    TRUST_SCORE_UPDATED = "trust_score_updated"
    VERIFICATION_COMPLETED = "verification_completed"
    POLICY_VIOLATION = "policy_violation"
    
    # Disintermediation Detection
    PHONE_NUMBER_DETECTED = "phone_number_detected"
    SUSPICIOUS_MESSAGE = "suspicious_message"
    OFFLINE_BOOKING_ATTEMPT = "offline_booking_attempt"
    
    # Admin Actions
    ADMIN_ACTION = "admin_action"
    MANUAL_OVERRIDE = "manual_override"
    USER_WARNING_ISSUED = "user_warning_issued"
    USER_RANK_ADJUSTED = "user_rank_adjusted"


class AuditLog(BaseModel):
    """
    Immutable audit log for all critical platform events
    
    Features:
    - Append-only (no updates or deletes)
    - Full event context and metadata
    - Tamper-evident via hash chain (optional)
    - Regulatory compliance (GDPR, PCI-DSS)
    - Forensic analysis capability
    
    Collection: audit_logs (indexed: timestamp, user_id, event_type, booking_id)
    Retention: 7 years for compliance
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    # Event Identification
    event_type: AuditEventType
    event_category: str  # "user", "booking", "payment", "trust", "admin"
    trace_id: Optional[str]  # Distributed tracing ID
    
    # Actor
    actor_id: Optional[str]  # User/Admin who triggered the event
    actor_role: Optional[str]  # "grihasta", "acharya", "admin", "system"
    actor_ip: Optional[str]
    actor_user_agent: Optional[str]
    
    # Target
    target_id: Optional[str]  # Resource affected (booking_id, user_id, etc.)
    target_type: Optional[str]  # "booking", "user", "payment", "review"
    
    # Event Details
    description: str
    old_value: Optional[Dict[str, Any]]  # State before change
    new_value: Optional[Dict[str, Any]]  # State after change
    metadata: Dict[str, Any] = {}  # Additional context
    
    # System Context
    service_name: str = "savitara-backend"
    service_version: Optional[str]
    environment: str = "production"  # "development", "staging", "production"
    
    # Timestamp (immutable)
    timestamp: datetime = Field(default_factory=utcnow)
    
    # Tamper Detection (optional)
    previous_log_id: Optional[str]  # Create hash chain
    log_hash: Optional[str]  # Hash of this log entry
    
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)


# ==================== DISPUTE RESOLUTION ====================


class DisputeType(str, Enum):
    """Types of disputes"""
    SERVICE_NOT_RENDERED = "service_not_rendered"
    INCOMPLETE_SERVICE = "incomplete_service"
    LATE_ARRIVAL = "late_arrival"
    NO_SHOW_ACHARYA = "no_show_acharya"
    NO_SHOW_GRIHASTA = "no_show_grihasta"
    PRICING_ISSUE = "pricing_issue"
    PAYMENT_ISSUE = "payment_issue"
    POOR_SERVICE_QUALITY = "poor_service_quality"
    RUDE_BEHAVIOR = "rude_behavior"
    OFFLINE_PAYMENT_REQUEST = "offline_payment_request"
    POLICY_VIOLATION = "policy_violation"
    OTHER = "other"


class DisputeStatus(str, Enum):
    """Dispute resolution states"""
    OPEN = "open"
    UNDER_REVIEW = "under_review"
    EVIDENCE_REQUESTED = "evidence_requested"
    PENDING_RESPONSE = "pending_response"
    MEDIATION = "mediation"
    RESOLVED_REFUND = "resolved_refund"
    RESOLVED_NO_REFUND = "resolved_no_refund"
    RESOLVED_PARTIAL_REFUND = "resolved_partial_refund"
    ESCALATED = "escalated"
    CLOSED = "closed"


class DisputeResolutionAction(str, Enum):
    """Actions taken to resolve disputes"""
    FULL_REFUND = "full_refund"
    PARTIAL_REFUND = "partial_refund"
    VOUCHER_COMPENSATION = "voucher_compensation"
    WARNING_ISSUED = "warning_issued"
    NO_ACTION = "no_action"
    ACCOUNT_SUSPENSION = "account_suspension"
    MANUAL_PAYOUT = "manual_payout"


class Dispute(BaseModel):
    """
    Structured dispute resolution system
    
    SLA Targets:
    - First response: 2 hours
    - Resolution (simple): 24 hours
    - Resolution (complex): 72 hours
    
    Auto-refund triggers:
    - No-show by Acharya (checked-in but didn't arrive)
    - Service not started within 30 min of booking time
    - Both parties confirm service failure
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    # Parties
    booking_id: str
    raised_by: str  # "grihasta" or "acharya"
    complainant_id: str  # User who raised the dispute
    respondent_id: str  # Other party
    
    # Dispute Details
    dispute_type: DisputeType
    subject: str  # Brief title
    description: str  # Detailed description from complainant
    evidence_urls: List[str] = []  # Photos, videos, chat screenshots
    
    # Status
    status: DisputeStatus = DisputeStatus.OPEN
    priority: str = "medium"  # "low", "medium", "high", "critical"
    assigned_to: Optional[str]  # Admin user_id handling the dispute
    
    # Resolution
    resolution_action: Optional[DisputeResolutionAction]
    resolution_notes: Optional[str]
    refund_amount: Optional[float]
    compensation_voucher_id: Optional[str]
    
    # Timeline
    created_at: datetime = Field(default_factory=utcnow)
    first_response_at: Optional[datetime]
    resolved_at: Optional[datetime]
    closed_at: Optional[datetime]
    
    # SLA Tracking
    sla_breached: bool = False
    response_time_minutes: Optional[int]
    resolution_time_hours: Optional[float]
    
    # Communication Thread
    messages: List[Dict[str, Any]] = []  # [{from: "admin", message: "...", timestamp: "..."}]
    
    # Auto-Refund Eligibility
    auto_refund_eligible: bool = False
    auto_refund_reason: Optional[str]
    
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)


# ==================== SERVICE GUARANTEE & AUTO-REFUND ====================


class RefundEligibility(str, Enum):
    """Refund eligibility status"""
    ELIGIBLE = "eligible"
    NOT_ELIGIBLE = "not_eligible"
    PENDING_REVIEW = "pending_review"
    PARTIALLY_ELIGIBLE = "partially_eligible"


class RefundReason(str, Enum):
    """Reasons for refund"""
    ACHARYA_NO_SHOW = "acharya_no_show"
    SERVICE_NOT_STARTED = "service_not_started"
    GRIHASTA_CANCELLED_EARLY = "grihasta_cancelled_early"
    ACHARYA_CANCELLED_EARLY = "acharya_cancelled_early"
    PAYMENT_ERROR = "payment_error"
    DUPLICATE_CHARGE = "duplicate_charge"
    DISPUTE_RESOLVED = "dispute_resolved"
    QUALITY_ISSUE = "quality_issue"
    ADMIN_OVERRIDE = "admin_override"


class RefundRequest(BaseModel):
    """
    Auto-refund workflow for service guarantees
    
    Auto-Refund Rules:
    1. Acharya no-show (attendance not marked within 30 min): 100% refund
    2. Grihasta cancellation >24h before booking: 100% refund
    3. Grihasta cancellation 12-24h before: 50% refund
    4. Grihasta cancellation <12h: No refund (unless admin override)
    5. Acharya cancellation <24h: 100% refund + ₹500 voucher compensation
    6. Service quality dispute (resolved in favor of Grihasta): 50-100% refund
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    # Reference
    booking_id: str
    dispute_id: Optional[str]  #Link to dispute if initiated via dispute
    
    # Refund Details
    refund_reason: RefundReason
    original_amount: float
    refund_amount: float
    refund_percentage: int  # 0-100
    
    # Status
    status: str = "pending"  # "pending", "approved", "processing", "completed", "rejected"
    eligibility: RefundEligibility = RefundEligibility.PENDING_REVIEW
    
    # Auto vs Manual
    is_auto_refund: bool = False  # True if triggered automatically
    requires_approval: bool = True  # False for auto-refunds
    approved_by: Optional[str]  # Admin user_id
    
    # Processing
    razorpay_refund_id: Optional[str]
    processed_at: Optional[datetime]
    completed_at: Optional[datetime]
    
    # Metadata
    reason_code: str  # Machine-readable code for analytics
    customer_note: Optional[str]
    admin_note: Optional[str]
    
    # Timestamps
    requested_at: datetime = Field(default_factory=utcnow)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)


# ==================== OTP CHECK-IN / CHECK-OUT FLOW ====================


class AttendanceCheckpoint(BaseModel):
    """
    Mandatory OTP-based attendance tracking
    
    Flow:
    1. Booking confirmed → start_otp generated
    2. Acharya arrives → scans QR or enters OTP → check-in recorded
    3. Service starts → booking status = IN_PROGRESS
    4. Service completes → end_otp generated
    5. Grihasta confirms completion → check-out recorded
    6. Booking status = COMPLETED
    
    If check-in not done within 30 min → auto-dispute + refund trigger
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    booking_id: str
    
    # Check-in (Start)
    start_otp: str  # 6-digit OTP
    start_otp_generated_at: datetime
    start_otp_expires_at: datetime
    checked_in: bool = False
    checked_in_at: Optional[datetime]
    checked_in_by: Optional[str]  # acharya_id usually
    check_in_location: Optional[Dict[str, float]]  # {"lat": 12.97, "lng": 77.59}
    check_in_distance_meters: Optional[float]  # Distance from booking location
    
    # Check-out (End)
    end_otp: Optional[str]
    end_otp_generated_at: Optional[datetime]
    end_otp_expires_at: Optional[datetime]
    checked_out: bool = False
    checked_out_at: Optional[datetime]
    checked_out_by: Optional[str]  # grihasta_id usually
    
    # Service Duration
    actual_duration_minutes: Optional[int]
    scheduled_duration_minutes: Optional[int]
    
    # Anomalies
    late_check_in: bool = False
    late_check_in_minutes: Optional[int]
    early_checkout: bool = False
    no_show_detected: bool = False
    
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(populate_by_name=True)
