"""
Hindu Spiritual Services Models
Comprehensive service catalog with booking options
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from enum import Enum
from app.models.database import PyObjectId


def utcnow():
    return datetime.now(timezone.utc)


class ServiceCategory(str, Enum):
    """Service categories"""

    LIFE_CEREMONIES = "life_ceremonies"  # Sanskars
    WORSHIP = "worship"  # Daily/Special Pujas
    FESTIVALS = "festivals"  # Festival-specific
    REMEDIAL = "remedial"  # Navagraha, Vastu, etc.
    ANCESTRAL = "ancestral"  # Shradh, Pitru Paksha
    SPECIAL_OCCASIONS = "special_occasions"  # Griha Pravesh, etc.


class MuhurtaRequired(str, Enum):
    """Whether service requires Muhurta (auspicious timing)"""

    MANDATORY = "mandatory"  # Must select auspicious date
    RECOMMENDED = "recommended"  # Better on auspicious date
    NOT_REQUIRED = "not_required"  # Any day is fine


class ServiceBookingType(str, Enum):
    """Booking options for services"""

    MUHURTA_CONSULTATION = "muhurta_consultation"  # Just date selection
    FULL_SERVICE = "full_service"  # Complete package by platform
    CUSTOM_ACHARYA = "custom_acharya"  # User selects Acharya


class Service(BaseModel):
    """Hindu spiritual service model"""

    id: Optional[PyObjectId] = Field(alias="_id", default=None)

    # Basic Information
    name_english: str = Field(..., min_length=3, max_length=100)
    name_sanskrit: str = Field(..., min_length=3, max_length=100)
    category: ServiceCategory
    short_description: str = Field(..., max_length=200)  # 2-line summary

    # Detailed Information
    full_description: str  # Complete description
    importance: str  # Religious/spiritual significance
    benefits: List[str] = []  # Benefits of performing this service
    requirements: List[str] = []  # What's needed (materials, preparation)
    duration_minutes: int = Field(default=60, ge=15, le=1440)  # Service duration

    # Timing & Muhurta
    muhurta_required: MuhurtaRequired
    best_tithis: List[str] = []  # Recommended lunar days
    best_nakshatras: List[str] = []  # Recommended constellations
    avoid_days: List[str] = []  # Days to avoid

    # Booking Options
    booking_types_available: List[ServiceBookingType] = Field(
        default=[
            ServiceBookingType.MUHURTA_CONSULTATION,
            ServiceBookingType.FULL_SERVICE,
            ServiceBookingType.CUSTOM_ACHARYA,
        ]
    )

    # Pricing (Admin controlled)
    muhurta_consultation_price: float = Field(default=99.0, ge=0)
    full_service_base_price: float = Field(default=2100.0, ge=0)
    custom_acharya_base_price: float = Field(default=1500.0, ge=0)

    # Platform Package Details (for full_service)
    platform_provides: List[str] = []  # Materials provided by platform
    customer_provides: List[str] = []  # Customer brings these
    acharya_experience_required: str = "5+ years"  # Min Acharya qualification

    # Media
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    icon: str = "om"  # Icon identifier

    # Metadata
    is_active: bool = True
    popularity_score: int = Field(default=0, ge=0)  # For sorting
    total_bookings: int = Field(default=0, ge=0)
    average_rating: float = Field(default=0.0, ge=0, le=5)

    # Admin
    created_by: Optional[PyObjectId] = None
    updated_by: Optional[PyObjectId] = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_schema_extra={
            "example": {
                "name_english": "Griha Pravesh",
                "name_sanskrit": "गृह प्रवेश",
                "category": "special_occasions",
                "short_description": "House warming ceremony performed before entering a new home. Essential for positive energy and prosperity.",
                "full_description": "Griha Pravesh is an important Hindu ceremony...",
                "importance": "This sacred ritual purifies the new home...",
                "benefits": ["Removes negative energy", "Brings prosperity"],
                "requirements": ["New broom", "Milk", "Turmeric"],
                "muhurta_required": "mandatory",
            }
        },
    )


class ServiceBooking(BaseModel):
    """Service booking with selected options"""

    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    service_id: PyObjectId
    user_id: PyObjectId
    booking_type: ServiceBookingType

    # Selected Muhurta (if applicable)
    selected_date: Optional[datetime] = None
    selected_time_slot: Optional[str] = None
    muhurta_details: Dict[str, Any] = {}  # Panchanga info

    # Acharya Assignment
    acharya_id: Optional[PyObjectId] = None  # Assigned or selected Acharya
    is_platform_assigned: bool = True  # False if user selected

    # Address & Contact
    venue_address: Dict[str, str] = {}
    contact_number: str
    alternate_number: Optional[str] = None

    # Pricing
    base_price: float
    platform_fee: float = 0.0
    taxes: float = 0.0
    total_amount: float

    # Payment
    payment_id: Optional[str] = None
    payment_status: str = "pending"
    paid_at: Optional[datetime] = None

    # Status
    status: str = "pending"  # pending, confirmed, in_progress, completed, cancelled
    confirmed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None

    # Notes
    special_requests: Optional[str] = None
    admin_notes: Optional[str] = None

    # Timestamps
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
