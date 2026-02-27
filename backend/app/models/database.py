"""
Pydantic Models for Database Documents
SonarQube: S1192 - No string duplication
SonarQube: S117 - Proper naming conventions
"""
from pydantic import BaseModel, Field, EmailStr, GetCoreSchemaHandler, ConfigDict
from pydantic_core import CoreSchema, core_schema
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from enum import Enum
from bson import ObjectId


def utcnow():
    return datetime.now(timezone.utc)


class PyObjectId(ObjectId):
    """Custom ObjectId type for Pydantic"""

    @classmethod
    def __get_pydantic_core_schema__(
        cls, _source_type: Any, _handler: GetCoreSchemaHandler
    ) -> CoreSchema:
        return core_schema.json_or_python_schema(
            json_schema=core_schema.str_schema(),
            python_schema=core_schema.union_schema(
                [
                    core_schema.is_instance_schema(ObjectId),
                    core_schema.chain_schema(
                        [
                            core_schema.str_schema(),
                            core_schema.no_info_plain_validator_function(cls.validate),
                        ]
                    ),
                ]
            ),
            serialization=core_schema.plain_serializer_function_ser_schema(
                lambda x: str(x)
            ),
        )

    @classmethod
    def validate(cls, value: Any) -> ObjectId:
        if not ObjectId.is_valid(value):
            raise ValueError("Invalid ObjectId")
        return ObjectId(value)


class UserRole(str, Enum):
    """User role enumeration"""

    GRIHASTA = "grihasta"
    ACHARYA = "acharya"
    ADMIN = "admin"


class UserStatus(str, Enum):
    """User status enumeration"""

    PENDING = "pending"
    ACTIVE = "active"
    VERIFIED = "verified"
    SUSPENDED = "suspended"
    DELETED = "deleted"


class BookingStatus(str, Enum):
    """Booking status enumeration"""

    PENDING_PAYMENT = "pending_payment"
    REQUESTED = "requested"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    FAILED = "failed"


class PaymentStatus(str, Enum):
    """Payment status enumeration"""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    NOT_REQUIRED = "not_required"


class Location(BaseModel):
    """Location model"""

    city: str
    state: Optional[str] = None
    country: str = "India"
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class User(BaseModel):
    """Base user model"""

    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    email: EmailStr
    google_id: Optional[str] = None
    password_hash: Optional[str] = None
    role: UserRole
    status: UserStatus = UserStatus.PENDING
    onboarded: bool = False  # Track if user completed onboarding
    profile_picture: Optional[str] = None  # User's profile photo URL
    referral_code: Optional[str] = None  # Unique referral code for user
    preferred_language: Optional[str] = "en"  # User's preferred language
    terms_accepted_at: Optional[
        datetime
    ] = None  # When user accepted Terms & Conditions
    privacy_accepted_at: Optional[datetime] = None  # When user accepted Privacy Policy
    acharya_agreement_accepted_at: Optional[
        datetime
    ] = None  # For Acharyas: Service Provider Agreement
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    last_login: Optional[datetime] = None
    device_tokens: List[str] = []
    credits: int = 0

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class GrihastaProfile(BaseModel):
    """Grihasta (Seeker) profile model"""

    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    user_id: str  # Store as string for consistent querying
    name: str
    phone: Optional[str] = None
    location: Location
    parampara: str  # Spiritual tradition
    preferences: Dict[str, Any] = {}
    referred_by: Optional[str] = None  # Changed to str
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class AvailabilitySlot(BaseModel):
    """Availability slot model"""

    date: str  # YYYY-MM-DD format
    time_slots: List[Dict[str, str]]  # [{"start": "09:00", "end": "12:00"}]
    is_blocked: bool = False


class AcharyaProfile(BaseModel):
    """Acharya (Scholar) profile model"""

    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    user_id: str  # Store as string for consistent querying
    name: str
    phone: Optional[str] = None
    parampara: str
    gotra: str
    experience_years: int
    study_place: str
    specializations: List[str] = []
    languages: List[str] = []
    location: Location
    # DEPRECATED: Do NOT add new availability slots here.
    # Availability is managed exclusively via `acharya_schedules` collection (AcharyaSchedule model).
    # This field is kept for backward compatibility during migration only.
    availability: List[AvailabilitySlot] = []
    verification_documents: List[str] = []  # URLs to documents
    kyc_status: str = "pending"  # pending, verified, rejected
    referred_by: Optional[str] = None  # Changed to str
    referral_code: Optional[str] = None
    ratings: Dict[str, float] = {"average": 0.0, "count": 0}
    bio: Optional[str] = None
    profile_picture: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class Pooja(BaseModel):
    """Pooja (Service) model"""

    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: str
    description: str
    category: str  # daily, festival, special
    base_price: float
    samagri_price: Optional[float] = None
    duration_minutes: int
    image_url: Optional[str] = None
    is_active: bool = True
    created_by: PyObjectId  # Admin who created
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class AttendanceConfirmation(BaseModel):
    """Two-way attendance confirmation"""

    grihasta_confirmed: bool = False
    acharya_confirmed: bool = False
    grihasta_timestamp: Optional[datetime] = None
    acharya_timestamp: Optional[datetime] = None

    @property
    def is_fully_confirmed(self) -> bool:
        return self.grihasta_confirmed and self.acharya_confirmed


class Booking(BaseModel):
    """Booking model"""

    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    grihasta_id: PyObjectId
    acharya_id: PyObjectId
    pooja_id: Optional[PyObjectId] = None
    service_name: Optional[str] = None
    booking_type: str  # "only" or "with_samagri"
    booking_mode: str = "instant"  # "instant" or "request"
    requirements: Optional[str] = None  # User requirements for "request" mode
    date_time: datetime
    end_time: Optional[datetime] = None
    location: Optional[Location] = None
    status: BookingStatus = BookingStatus.PENDING_PAYMENT
    payment_status: PaymentStatus = PaymentStatus.PENDING
    base_price: float = 0
    samagri_price: Optional[float] = 0
    platform_fee: Optional[float] = 0
    discount: Optional[float] = 0
    total_amount: float = 0
    coupon_code: Optional[str] = None
    applied_voucher_id: Optional[str] = None  # Voucher (from user_vouchers) applied to this booking
    version: int = 1  # Optimistic lock — always include in update filter: {_id: X, version: N}
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    start_otp: Optional[str] = None  # OTP for starting the event
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    attendance: Optional[AttendanceConfirmation] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class MessageType(str, Enum):
    """Message type enumeration"""
    TEXT = "text"
    VOICE = "voice"
    IMAGE = "image"
    VIDEO = "video"
    FILE = "file"
    FORWARDED = "forwarded"


class MessageReaction(BaseModel):
    """Embedded reaction in a message"""
    user_id: PyObjectId
    emoji: str = Field(max_length=8)  # Unicode emoji
    created_at: datetime = Field(default_factory=utcnow)

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class ForwardedMessageInfo(BaseModel):
    """Embedded info about forwarded message origin"""
    message_id: Optional[PyObjectId] = None
    sender_name: Optional[str] = None
    room_name: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class Message(BaseModel):
    """Chat message model with reactions, media, and forwarding support"""

    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    conversation_id: Optional[PyObjectId] = None  # None for open chat
    sender_id: PyObjectId
    receiver_id: Optional[PyObjectId] = None  # None for open chat
    content: str
    is_open_chat: bool = False
    expires_at: Optional[datetime] = None  # For 7-day auto-delete
    read: bool = False
    created_at: datetime = Field(default_factory=utcnow)
    
    # New fields for enhanced chat features
    message_type: MessageType = MessageType.TEXT
    reactions: List[MessageReaction] = Field(default_factory=list)
    
    # Media fields (for voice, image, video, file)
    media_url: Optional[str] = None
    media_mime: Optional[str] = None
    media_duration_s: Optional[int] = None  # Duration in seconds for voice/video
    media_waveform: Optional[List[float]] = None  # Waveform data for voice messages
    
    # Forwarding fields
    forwarded_from: Optional[ForwardedMessageInfo] = None
    
    # Soft delete and edit tracking
    edited_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True, use_enum_values=True)


class RoomType(str, Enum):
    """Conversation room type enumeration"""
    DIRECT = "direct"
    PRIVATE_GROUP = "private_group"
    ACHARYA_GROUP = "acharya_group"
    COMMUNITY = "community"


class Conversation(BaseModel):
    """Conversation model with group chat and privacy controls"""

    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    participants: List[PyObjectId]
    is_open_chat: bool = False
    expires_at: Optional[datetime] = None
    last_message_at: datetime = Field(default_factory=utcnow)
    created_at: datetime = Field(default_factory=utcnow)
    
    # New fields for group chat and privacy
    room_type: RoomType = RoomType.DIRECT
    allow_forward_out: bool = True  # Allow forwarding messages out of this room
    locked: bool = False  # Room locked (only admins can post)
    pinned_message_id: Optional[PyObjectId] = None
    # For DIRECT rooms: participants[] is authoritative (exactly 2 users).
    # For GROUP/COMMUNITY rooms: use conversation_members collection exclusively.
    # participants[] is NOT updated for groups after creation — do NOT query it for group membership.
    member_count: int = 0  # Cached counter updated via $inc on join/leave (groups only)

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True, use_enum_values=True)


class Review(BaseModel):
    """Review model"""

    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    booking_id: PyObjectId
    grihasta_id: PyObjectId
    acharya_id: Optional[PyObjectId] = None  # None if reviewing platform/pooja
    pooja_id: Optional[PyObjectId] = None
    rating: int = Field(ge=1, le=5)  # 1-5 stars
    comment: Optional[str] = None
    review_type: str  # "acharya", "pooja", "platform"
    is_public: bool = False  # Admin decides visibility
    created_at: datetime = Field(default_factory=utcnow)

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class Referral(BaseModel):
    """Unified referral model — single source of truth for all referral tracking.

    Schema rule: one document per referral relationship (one referrer → one referee).
    The old model stored a list of referred_users inside one document, causing write
    amplification and making per-referee queries O(n). This model uses one doc per pair.

    Indexed fields: referrer_id, referee_id (unique sparse), referral_code, status.
    """

    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    referrer_id: str  # User who shared the referral code
    referrer_role: str  # "grihasta" or "acharya"
    referee_id: Optional[str] = None  # User who used the code (populated after signup)
    referee_role: Optional[str] = None
    referral_code: str  # The code the referee used to sign up
    status: str = "pending"  # pending | signed_up | completed_booking | rewarded
    rewards_given: bool = False
    referrer_reward: Dict[str, Any] = {}  # {"coins": 500, "voucher": "REFER500"}
    referee_reward: Dict[str, Any] = {}
    signed_up_at: Optional[datetime] = None
    first_booking_at: Optional[datetime] = None
    rewarded_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class Notification(BaseModel):
    """Notification model"""

    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    user_id: Optional[PyObjectId] = None  # None for broadcast
    title: str
    body: str
    notification_type: str  # booking, chat, announcement, etc.
    data: Dict[str, Any] = {}
    read: bool = False
    sent_at: datetime = Field(default_factory=utcnow)

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class PanchangaData(BaseModel):
    """Detailed Panchanga calculation data"""

    samvatsara: str = ""  # Hindu year name
    ayana: str = ""  # Uttarayana/Dakshinayana
    ritu: str = ""  # Season
    masa: str = ""  # Month
    paksha: str = ""  # Fortnight (Shukla/Krishna)
    tithi: Dict[str, Any] = {}  # {name, end_time}
    vara: str = ""  # Day of week
    nakshatra: Dict[str, Any] = {}  # {name, end_time}
    yoga: Dict[str, Any] = {}  # {name, end_time}
    karana: Dict[str, Any] = {}  # {name, end_time}
    rahu_kala: Dict[str, str] = {}  # {start, end}
    gulika_kala: Dict[str, str] = {}  # {start, end}
    yama_ghanta: Dict[str, str] = {}  # {start, end}
    abhijit_muhurta: Dict[str, str] = {}  # {start, end}
    sunrise: str = ""
    sunset: str = ""
    moonrise: str = ""
    moonset: str = ""
    special_events: List[str] = []
    festivals: List[str] = []
    is_auspicious: bool = True


class PanchangaCache(BaseModel):
    """Cached Panchanga data for quick retrieval"""

    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    date: datetime
    region: str  # IN-KA, IN-TN, etc.
    latitude: float
    longitude: float
    sampradaya: str = "smartha"  # smartha, vaishnava, shaiva, madhva
    panchanga_data: PanchangaData
    created_at: datetime = Field(default_factory=utcnow)
    expires_at: datetime  # Cache expires after 7 days

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class RegionConfig(BaseModel):
    """Region configuration for Panchanga calculations"""

    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    region_code: str  # IN-KA, IN-TN, etc.
    region_name: str  # Karnataka, Tamil Nadu
    latitude: float
    longitude: float
    timezone: str = "Asia/Kolkata"
    sampradayas: List[str] = ["smartha"]
    calculation_method: str = "drik"  # drik or suryasiddhanta
    language: str = "en"
    is_active: bool = True
    created_at: datetime = Field(default_factory=utcnow)

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class ScheduleSlot(BaseModel):
    """Individual time slot in Acharya's schedule"""

    start_time: datetime
    end_time: datetime
    status: str = "available"  # available, blocked, booked
    booking_id: Optional[PyObjectId] = None
    notes: str = ""
    tithi: str = ""  # Associated Panchanga info
    is_auspicious: bool = True


class AcharyaSchedule(BaseModel):
    """Acharya's daily schedule with availability"""

    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    acharya_id: PyObjectId
    date: datetime
    region: str = "IN-KA"
    slots: List[ScheduleSlot] = []
    working_hours: Dict[str, str] = {"start": "09:00", "end": "18:00"}
    is_day_blocked: bool = False
    blocked_reason: str = ""
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class CalendarEventType(str, Enum):
    """Calendar event types"""

    BOOKING = "booking"
    PERSONAL = "personal"
    REMINDER = "reminder"
    FESTIVAL = "festival"
    RITUAL = "ritual"


class GrihastaCalendarEvent(BaseModel):
    """Grihasta's personal calendar event"""

    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    user_id: PyObjectId
    event_type: CalendarEventType
    title: str
    description: str = ""
    date: datetime
    start_time: datetime
    end_time: datetime
    booking_id: Optional[PyObjectId] = None  # If linked to booking
    panchanga_info: Dict[str, Any] = {}  # {tithi, nakshatra, is_auspicious}
    reminder_before: int = 60  # Minutes before event
    reminder_sent: bool = False
    color: str = "#F97316"  # Saffron default
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class PanchangaEvent(BaseModel):
    """Panchanga (Hindu calendar) event model - Legacy compatibility"""

    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    date: str  # YYYY-MM-DD
    tithi: str
    nakshatra: str
    yoga: str
    karana: str
    sunrise: str
    sunset: str
    moonrise: str
    moonset: str
    festivals: List[str] = []
    auspicious_timings: List[Dict[str, str]] = []
    # DEPRECATED: Do not append booking IDs here — this array grows forever.
    # Query bookings by date_time range in the bookings collection instead.
    bookings: List[PyObjectId] = []  # Bookings on this date

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


# ==================== Wallet Model ====================

class UserWallet(BaseModel):
    """Wallet balance document — one per user.

    Balance is maintained via atomic $inc operations on `balance` and `bonus_balance`.
    NEVER compute balance by summing wallet_transactions — use this document.
    Collection: db.wallets (unique index on user_id)
    """

    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    user_id: str  # Unique — one wallet per user
    balance: float = 0.0        # Real money (credited via Razorpay / earned by Acharya)
    bonus_balance: float = 0.0  # Promotional balance (cannot be withdrawn)
    currency: str = "INR"
    is_active: bool = True
    total_credited: float = 0.0   # Lifetime credits (for analytics)
    total_debited: float = 0.0    # Lifetime debits
    total_earned: float = 0.0     # Acharya earnings total
    total_withdrawn: float = 0.0  # Acharya total withdrawals
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


# ==================== Device Model ====================

class DeviceOS(str, Enum):
    """Mobile OS"""
    ANDROID = "android"
    IOS = "ios"
    WEB = "web"


class UserDevice(BaseModel):
    """Normalized device token record — replaces the raw device_tokens[] array on User.

    Rationale: device_tokens[] on User grows unbounded with stale tokens, has no
    metadata (device type, last active), and requires full user doc rewrite to add/remove.
    This collection has one doc per device, with TTL cleanup on last_seen.
    Collection: db.user_devices (indexes: user_id, fcm_token unique)
    """

    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    user_id: str
    fcm_token: str          # Firebase Cloud Messaging token (unique)
    device_os: DeviceOS
    app_version: Optional[str] = None
    device_model: Optional[str] = None
    is_active: bool = True
    last_seen: datetime = Field(default_factory=utcnow)  # TTL cleanup target
    created_at: datetime = Field(default_factory=utcnow)

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True, use_enum_values=True)


# ==================== Unread Count Model ====================

class ConversationUnreadCount(BaseModel):
    """Per-user unread message counter for a conversation.

    Rationale: Computing unread count via COUNT(messages WHERE created_at > last_read_at)
    is expensive at scale. This collection caches the count and is updated via $inc
    on message insert and $set {count: 0} on read.
    Collection: db.unread_counts (compound unique index: conversation_id + user_id)
    """

    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    conversation_id: str
    user_id: str
    count: int = 0              # Unread message count
    last_message_id: Optional[str] = None  # ID of the last unread message
    last_message_at: Optional[datetime] = None
    updated_at: datetime = Field(default_factory=utcnow)

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


# ==================== Message Reaction Record ====================

class MessageReactionRecord(BaseModel):
    """Standalone message reaction record (external collection).

    Rationale: Embedding reactions[] in Message documents causes write amplification
    (each reaction rewrites the array), prevents efficient per-user reaction queries,
    and creates document bloat for popular messages.
    Collection: db.message_reactions (compound unique index: message_id + user_id)
    """

    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    message_id: str
    conversation_id: str  # Denormalized for efficient conversation-level aggregation
    user_id: str
    emoji: str = Field(max_length=8)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)  # For reaction changes

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
