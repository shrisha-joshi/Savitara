"""
Disintermediation Defense Models
Prevents offline transactions and protects platform revenue
"""
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum


def utcnow():
    return datetime.now(timezone.utc)


# ==================== PHONE MASKING & RELAY ====================


class PhoneMaskStatus(str, Enum):
    """Status of masked phone relay"""
    ACTIVE = "active"
    EXPIRED = "expired"
    BLOCKED = "blocked"
    REVOKED = "revoked"


class MaskedPhoneRelay(BaseModel):
    """
    Masked phone relay system - Twilio-style virtual numbers
    
    Flow:
    1. Booking confirmed → create unique masked number pair
    2. Grihasta sees: +91-XXXX-MASKED-1 (Acharya's masked number)
    3. Acharya sees: +91-XXXX-MASKED-2 (Grihasta's masked number)
    4. Calls route through Savitara relay → logs recorded
    5. After booking completion → masks expire in 24h
    
    Prevention:
    - Real numbers never exposed
    - All calls logged + recorded
    - Auto-disconnect after booking window
    - SMS relay with content filtering
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    booking_id: str
    
    # Parties
    grihasta_real_phone: str  # Encrypted in production
    acharya_real_phone: str  # Encrypted in production
    
    # Masked Numbers (Virtual Numbers from Twilio/Exotel)
    grihasta_masked_number: str  # Number shown to Acharya
    acharya_masked_number: str  # Number shown to Grihasta
    
    # Relay Configuration
    status: PhoneMaskStatus = PhoneMaskStatus.ACTIVE
    relay_provider: str = "twilio"  # "twilio", "exotel", "plivo"
    relay_session_id: Optional[str]
    
    # Call Logging
    total_calls: int = 0
    total_call_duration_seconds: int = 0
    call_recordings_urls: List[str] = []
    
    # SMS Relay
    total_sms_sent: int = 0
    sms_blocked_count: int = 0  # Blocked due to suspicious content
    
    # Lifecycle
    created_at: datetime = Field(default_factory=utcnow)
    expires_at: datetime  # Auto-expire 24h after booking completion
    revoked_at: Optional[datetime]
    revoked_reason: Optional[str]
    
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)


class CallLog(BaseModel):
    """Log of all calls made through masked relay"""
    id: Optional[str] = Field(alias="_id", default=None)
    
    booking_id: str
    relay_id: str  # Reference to MaskedPhoneRelay
    
    # Call Details
    from_number: str  # masked number
    to_number: str  # masked number
    caller_id: str  # grihasta_id or acharya_id
    receiver_id: str
    
    # Call Metadata
    call_sid: str  # Twilio/Exotel call ID
    call_status: str  # "initiated", "ringing", "in-progress", "completed", "failed", "busy", "no-answer"
    call_direction: str  # "inbound", "outbound"
    
    # Duration
    duration_seconds: int = 0
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    
    # Recording
    recording_url: Optional[str]
    recording_duration: Optional[int]
    
    # Quality Metrics
    call_quality_score: Optional[float]  # 1-5 (from provider)
    
    # Anomaly Detection
    suspicious: bool = False
    suspicious_reason: Optional[str]  # "excessive_duration", "off_hours", "number_exchange_attempt"
    
    created_at: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(populate_by_name=True)


# ==================== MESSAGE CONTENT FILTERING ====================


class MessageSensitivity(str, Enum):
    """Sensitivity level of detected content"""
    SAFE = "safe"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class FilterAction(str, Enum):
    """Action taken by content filter"""
    ALLOW = "allow"
    WARN = "warn"
    BLOCK = "block"
    FLAG_REVIEW = "flag_review"


class ContentFilterRule(BaseModel):
    """NLP filter rules for detecting disintermediation attempts"""
    id: Optional[str] = Field(alias="_id", default=None)
    
    rule_name: str
    rule_type: str  # "regex", "nlp", "ml_model"
    pattern: Optional[str]  # Regex pattern
    keywords: List[str] = []  # Keyword list
    
    # Detection
    detects: str  # "phone_number", "email", "whatsapp", "social_media", "payment_request"
    sensitivity: MessageSensitivity
    
    # Action
    action: FilterAction
    penalty_points: int = 0  # Points added to violation count
    
    # Examples (for ML training)
    positive_examples: List[str] = []
    negative_examples: List[str] = []
    
    # Status
    is_active: bool = True
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)


class MessageFilterAnalysis(BaseModel):
    """
    NLP analysis result for each message
    
    Detection Patterns:
    - Phone numbers: +91XXXXXXXXXX, 9876543210, (123) 456-7890
    - WhatsApp: "msg me on whatsapp", "WA me", "ping on WA"
    - Payment requests: "pay me directly", "send money to", "UPI ID"
    - Social media: "DM me on insta", "add me on FB"
    - Email: "email me at", "@gmail.com"
    
    NLP Techniques:
    - Regex patterns for structured data (phone, email)
    - Named Entity Recognition (NER) for contact info
    - Sentiment analysis for urgency/pressure
    - Context analysis for innocent vs suspicious
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    # Message Reference
    conversation_id: str
    message_id: str
    sender_id: str
    receiver_id: str
    original_message: str  # Encrypted in production
    
    # Analysis Results
    is_suspicious: bool = False
    sensitivity_level: MessageSensitivity = MessageSensitivity.SAFE
    confidence_score: float = 0.0  # 0-1
    
    # Detections
    detected_patterns: List[str] = []  # ["phone_number", "payment_request"]
    matched_rules: List[str] = []  # Rule IDs that matched
    extracted_entities: Dict[str, List[str]] = {}  # {"phone": ["9876543210"], "email": ["user@example.com"]}
    
    # Action Taken
    action: FilterAction = FilterAction.ALLOW
    blocked: bool = False
    flagged_for_review: bool = False
    warning_shown: bool = False
    
    # User Notification
    notification_sent: bool = False
    notification_message: Optional[str]
    
    # Admin Review
    reviewed_by: Optional[str]  # Admin user_id
    review_status: Optional[str]  # "false_positive", "true_positive", "pending"
    reviewed_at: Optional[datetime]
    
    # Metadata
    analyzed_at: datetime = Field(default_factory=utcnow)
    model_version: str = "1.0"
    
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)


# ==================== LOYALTY & REWARD FOR REPEAT BOOKINGS ====================


class LoyaltyRewardTrigger(str, Enum):
    """Events that trigger loyalty rewards"""
    REPEAT_BOOKING_SAME_ACHARYA = "repeat_booking_same_acharya"
    STREAK_3_BOOKINGS = "streak_3_bookings"
    MONTHLY_ACTIVE = "monthly_active"
    IN_APP_PAYMENT = "in_app_payment"
    COMPLETE_PROFILE = "complete_profile"


class LoyaltyReward(BaseModel):
    """
    Reward for repeat in-app bookings
    
    Strategy:
    - 2nd booking with same Acharya: 10% discount voucher
    - 3 bookings in a month: ₹200 voucher
    - 5 bookings total: Free premium features for 1 month
    - All payments in-app: Bonus coins multiplier (1.5x)
    
    Purpose: Incentivize staying in-app vs going offline
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    user_id: str
    trigger: LoyaltyRewardTrigger
    
    # Reward
    reward_type: str  # "voucher", "coins", "tier_upgrade", "feature_unlock"
    reward_value: Any  # Voucher ID, coin amount, etc.
    reward_description: str
    
    # Eligibility
    booking_streak: int = 0
    total_bookings: int = 0
    same_acharya_bookings: int = 0
    
    # Redemption
    is_redeemed: bool = False
    redeemed_at: Optional[datetime]
    redeemed_booking_id: Optional[str]
    
    # Expiry
    expires_at: Optional[datetime]
    
    created_at: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)


# ==================== ACHARYA RANK PENALTIES ====================


class RankPenaltyReason(str, Enum):
    """Reasons for rank/score penalties"""
    OFFLINE_BOOKING_ATTEMPT = "offline_booking_attempt"
    NUMBER_SHARING_DETECTED = "number_sharing_detected"
    DIRECT_PAYMENT_REQUEST = "direct_payment_request"
    POLICY_VIOLATION = "policy_violation"
    CUSTOMER_COMPLAINT = "customer_complaint"
    NO_SHOW = "no_show"
    LATE_CANCELLATION = "late_cancellation"
    POOR_RATING = "poor_rating"
    REPEATED_VIOLATIONS = "repeated_violations"


class RankPenalty(BaseModel):
    """
    Penalty system for Acharya ranking
    
    Penalties:
    - First offense (number sharing): -5 trust score points
    - Second offense: -10 points + 7-day warning
    - Third offense: -20 points + 14-day suspension
    - Confirmed offline booking: -50 points + permanent rank drop
    
    Rank Impact:
    - Lowers marketplace sorting position
    - Removes badges/certifications
    - Reduces visibility in search
    - May trigger auto-suspension
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    acharya_id: str
    booking_id: Optional[str]
    
    # Penalty Details
    reason: RankPenaltyReason
    severity: str  # "minor", "moderate", "major", "severe"
    points_deducted: int  # Trust score points removed
    
    # Evidence
    evidence_type: str  # "message_log", "call_recording", "customer_report"
    evidence_id: Optional[str]
    evidence_description: str
    
    # Impact
    current_trust_score: float
    new_trust_score: float
    rank_before: int
    rank_after: int
    badges_removed: List[str] = []
    
    # Administrative
    issued_by: str  # "system" or admin user_id
    is_appealable: bool = True
    appeal_deadline: Optional[datetime]
    appeal_status: Optional[str]  # "pending", "accepted", "rejected"
    
    # Timestamps
    issued_at: datetime = Field(default_factory=utcnow)
    effective_at: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)


# ==================== OFFLINE BOOKING DETECTION ====================


class OfflineBookingIndicator(BaseModel):
    """
    ML-based detection of offline booking attempts
    
    Signals:
    1. High activity spike then sudden drop (moved offline)
    2. Multiple contact exchange attempts
    3. Booking pattern changes (chatting but no bookings)
    4. Grihasta reports direct payment request
    5. Same Grihasta-Acharya pair: many chats, few bookings
    
    Action:
    - Flag for manual review
    - Auto-penalty if confidence > 90%
    - Warning notifications to both parties
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    # Parties
    grihasta_id: str
    acharya_id: str
    
    # Evidence
    total_messages: int
    contact_exchange_attempts: int
    payment_request_mentions: int
    bookings_in_app: int
    bookings_expected: int  # Based on chat frequency
    
    # ML Prediction
    offline_probability: float = 0.0  # 0-1
    confidence_score: float = 0.0
    risk_level: str = "low"  # "low", "medium", "high", "critical"
    
    # Signals Detected
    signals: List[str] = []
    # ["sudden_activity_drop", "number_sharing", "low_conversion_rate"]
    
    # Action
    flagged_for_review: bool = False
    penalty_applied: bool = False
    penalty_id: Optional[str]
    
    # Review
    reviewed_by: Optional[str]
    review_outcome: Optional[str]  # "false_positive", "confirmed", "inconclusive"
    reviewed_at: Optional[datetime]
    
    detected_at: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(populate_by_name=True)
