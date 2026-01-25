"""
API Request/Response Schemas
SonarQube: S1192 - No string duplication
"""
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict, ValidationInfo
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, timezone

def utcnow():
    return datetime.now(timezone.utc)

from app.models.database import UserRole, UserStatus, BookingStatus, Location
from app.core.constants import PHONE_REGEX


# ============= Authentication Schemas =============

class LoginRequest(BaseModel):
    """Email/Password login request"""
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    """User registration request"""
    email: EmailStr
    password: str
    name: str
    role: UserRole

class GoogleAuthRequest(BaseModel):
    """Google OAuth authentication request"""
    id_token: str = Field(..., description="Google ID token")
    role: UserRole = Field(..., description="User role selection")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ...",
                "role": "grihasta"
            }
        }
    )


class TokenResponse(BaseModel):
    """JWT token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: Dict[str, Any]


class RefreshTokenRequest(BaseModel):
    """Refresh token request"""
    refresh_token: str


# ============= User Schemas =============

class UserResponse(BaseModel):
    """User response model"""
    id: str
    email: str
    role: str
    status: str
    created_at: datetime
    credits: int


class GrihastaOnboardingRequest(BaseModel):
    """Grihasta onboarding questionnaire"""
    name: str = Field(..., min_length=2, max_length=100)
    phone: Optional[str] = Field(None, pattern=PHONE_REGEX)
    location: Location
    parampara: str = Field(..., description="Spiritual tradition")
    preferences: Optional[Dict[str, Any]] = {}
    referral_code: Optional[str] = None
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Rajesh Kumar",
                "phone": "+919876543210",
                "location": {
                    "city": "Mumbai",
                    "state": "Maharashtra",
                    "country": "India"
                },
                "parampara": "Shaiva",
                "preferences": {
                    "preferred_language": "Hindi",
                    "interests": ["Vedanta", "Yoga"]
                }
            }
        }
    )


class AcharyaOnboardingRequest(BaseModel):
    """Acharya onboarding questionnaire"""
    name: str = Field(..., min_length=2, max_length=100)
    phone: Optional[str] = Field(None, pattern=r'^\+?[1-9]\d{1,14}$')
    parampara: str
    gotra: str
    experience_years: int = Field(..., ge=0, le=100)
    study_place: str
    specializations: List[str] = Field(..., min_length=1)
    languages: List[str] = Field(..., min_length=1)
    location: Location
    bio: Optional[str] = Field(None, max_length=500)
    referral_code: Optional[str] = None
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Swami Ramakrishna",
                "phone": "+919876543210",
                "parampara": "Advaita Vedanta",
                "gotra": "Bharadvaja",
                "experience_years": 20,
                "study_place": "Varanasi Sanskrit University",
                "specializations": ["Vedanta", "Jyotish", "Rituals"],
                "languages": ["Sanskrit", "Hindi", "English"],
                "location": {
                    "city": "Varanasi",
                    "state": "Uttar Pradesh",
                    "country": "India"
                },
                "bio": "Experienced Acharya specializing in Vedic rituals."
            }
        }
    )


class ProfileUpdateRequest(BaseModel):
    """Profile update request"""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, pattern=r'^\+?[1-9]\d{1,14}$')
    location: Optional[Location] = None
    bio: Optional[str] = Field(None, max_length=500)
    specializations: Optional[List[str]] = None
    languages: Optional[List[str]] = None


# ============= Booking Schemas =============

class BookingCreateRequest(BaseModel):
    """Create booking request"""
    acharya_id: str
    pooja_id: str
    booking_type: str = Field(..., pattern="^(only|with_samagri)$")
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    time: str = Field(..., description="Time in HH:MM format")
    location: Optional[Location] = None
    coupon_code: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=500)
    
    @field_validator('date')
    @classmethod
    def validate_date(cls, v: str) -> str:
        """Validate date format"""
        try:
            datetime.strptime(v, '%Y-%m-%d')
            return v
        except ValueError:
            raise ValueError('Date must be in YYYY-MM-DD format')
    
    @field_validator('time')
    @classmethod
    def validate_time(cls, v: str) -> str:
        """Validate time format"""
        try:
            datetime.strptime(v, '%H:%M')
            return v
        except ValueError:
            raise ValueError('Time must be in HH:MM format')
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "acharya_id": "507f1f77bcf86cd799439011",
                "pooja_id": "507f1f77bcf86cd799439012",
                "booking_type": "with_samagri",
                "date": "2026-02-01",
                "time": "10:00",
                "location": {
                    "city": "Mumbai",
                    "state": "Maharashtra",
                    "country": "India"
                },
                "notes": "Please bring tulsi leaves"
            }
        }
    )


class BookingResponse(BaseModel):
    """Booking response"""
    id: str
    grihasta_id: str
    acharya_id: str
    pooja_id: str
    booking_type: str
    date_time: datetime
    status: str
    payment_status: str
    total_amount: float
    razorpay_order_id: Optional[str]
    start_otp: Optional[str]
    created_at: datetime


class BookingStatusUpdateRequest(BaseModel):
    """Update booking status"""
    action: str = Field(..., pattern="^(confirm|reject|cancel|start|complete)$")
    otp: Optional[str] = None  # Required for 'start' action
    notes: Optional[str] = None


class AttendanceConfirmRequest(BaseModel):
    """Attendance confirmation request"""
    confirmed: bool
    notes: Optional[str] = None


# ============= Chat Schemas =============

class MessageSendRequest(BaseModel):
    """Send message request"""
    receiver_id: Optional[str] = None  # None for open chat
    content: str = Field(..., min_length=1, max_length=2000)
    is_open_chat: bool = False


class MessageResponse(BaseModel):
    """Message response"""
    id: str
    conversation_id: str
    sender_id: str
    content: str
    is_open_chat: bool
    read: bool
    created_at: datetime
    expires_at: Optional[datetime]


class ConversationResponse(BaseModel):
    """Conversation response"""
    id: str
    participants: List[str]
    is_open_chat: bool
    last_message_at: datetime
    unread_count: int


# ============= Review Schemas =============

class ReviewCreateRequest(BaseModel):
    """Create review request"""
    booking_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=1000)
    review_type: str = Field(..., pattern="^(acharya|pooja|platform)$")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "booking_id": "507f1f77bcf86cd799439011",
                "rating": 5,
                "comment": "Excellent service and very knowledgeable",
                "review_type": "acharya"
            }
        }
    )


class ReviewResponse(BaseModel):
    """Review response"""
    id: str
    booking_id: str
    rating: int
    comment: Optional[str]
    review_type: str
    is_public: bool
    created_at: datetime


# ============= Admin Schemas =============

class AcharyaVerificationRequest(BaseModel):
    """Acharya verification action"""
    action: str = Field(..., pattern="^(approve|reject)$")
    notes: Optional[str] = None


class NotificationBroadcastRequest(BaseModel):
    """Broadcast notification request"""
    target_role: Optional[str] = Field(None, pattern="^(grihasta|acharya|all)$")
    title: str = Field(..., max_length=100)
    body: str = Field(..., max_length=500)
    data: Optional[Dict[str, Any]] = {}


class AnalyticsResponse(BaseModel):
    """Analytics response"""
    total_users: int
    total_bookings: int
    total_revenue: float
    active_acharyas: int
    pending_verifications: int
    user_growth: List[Dict[str, Any]]
    revenue_trend: List[Dict[str, Any]]


# ============= Availability Schemas =============

class AvailabilitySlotRequest(BaseModel):
    """Add/update availability slot"""
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    time_slots: List[Dict[str, str]] = Field(..., description="List of time ranges")
    
    @field_validator('date')
    @classmethod
    def validate_date(cls, v: str) -> str:
        try:
            datetime.strptime(v, '%Y-%m-%d')
            return v
        except ValueError:
            raise ValueError('Date must be in YYYY-MM-DD format')
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "date": "2026-02-01",
                "time_slots": [
                    {"start": "09:00", "end": "12:00"},
                    {"start": "15:00", "end": "18:00"}
                ]
            }
        }
    )


# ============= Standard Response Wrapper =============

class StandardResponse(BaseModel):
    """Standard API response wrapper"""
    success: bool
    data: Optional[Any] = None
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=utcnow)
