"""
Pydantic Models for Database Documents
SonarQube: S1192 - No string duplication
SonarQube: S117 - Proper naming conventions
"""
from pydantic import BaseModel, Field, validator, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
from bson import ObjectId


class PyObjectId(ObjectId):
    """Custom ObjectId type for Pydantic"""
    
    @classmethod
    def __get_validators__(cls):
        yield cls.validate
    
    @classmethod
    def validate(cls, v, values=None):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)
    
    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema, handler):
        json_schema = handler(core_schema)
        json_schema.update(type="string")
        return json_schema


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


class BookingStatus(str, Enum):
    """Booking status enumeration"""
    REQUESTED = "requested"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REJECTED = "rejected"


class PaymentStatus(str, Enum):
    """Payment status enumeration"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


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
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    device_tokens: List[str] = []
    credits: int = 0
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
        arbitrary_types_allowed = True


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
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
        arbitrary_types_allowed = True


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
    availability: List[AvailabilitySlot] = []
    verification_documents: List[str] = []  # URLs to documents
    referred_by: Optional[str] = None  # Changed to str
    referral_code: Optional[str] = None
    ratings: Dict[str, float] = {
        "average": 0.0,
        "count": 0
    }
    bio: Optional[str] = None
    profile_picture: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
        arbitrary_types_allowed = True


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
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
        arbitrary_types_allowed = True


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
    pooja_id: PyObjectId
    booking_type: str  # "only" or "with_samagri"
    date_time: datetime
    duration_minutes: int
    location: Optional[Location] = None
    status: BookingStatus = BookingStatus.REQUESTED
    payment_status: PaymentStatus = PaymentStatus.PENDING
    base_amount: float
    samagri_amount: Optional[float] = 0
    discount_amount: Optional[float] = 0
    total_amount: float
    coupon_code: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    start_otp: Optional[str] = None  # OTP for starting the event
    attendance: Optional[AttendanceConfirmation] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
        arbitrary_types_allowed = True


class Message(BaseModel):
    """Chat message model"""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    conversation_id: PyObjectId
    sender_id: PyObjectId
    receiver_id: Optional[PyObjectId] = None  # None for open chat
    content: str
    is_open_chat: bool = False
    expires_at: Optional[datetime] = None  # For 7-day auto-delete
    read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
        arbitrary_types_allowed = True


class Conversation(BaseModel):
    """Conversation model"""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    participants: List[PyObjectId]
    is_open_chat: bool = False
    expires_at: Optional[datetime] = None
    last_message_at: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
        arbitrary_types_allowed = True


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
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
        arbitrary_types_allowed = True


class Referral(BaseModel):
    """Referral model"""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    referrer_id: PyObjectId
    code: str  # Unique referral code
    referred_users: List[PyObjectId] = []
    credits_earned: int = 0
    status: str = "active"  # active, inactive
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
        arbitrary_types_allowed = True


class Notification(BaseModel):
    """Notification model"""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    user_id: Optional[PyObjectId] = None  # None for broadcast
    title: str
    body: str
    notification_type: str  # booking, chat, announcement, etc.
    data: Dict[str, Any] = {}
    read: bool = False
    sent_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
        arbitrary_types_allowed = True


class PanchangaEvent(BaseModel):
    """Panchanga (Hindu calendar) event model"""
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
    bookings: List[PyObjectId] = []  # Bookings on this date
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
        arbitrary_types_allowed = True
