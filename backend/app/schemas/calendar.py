"""
Calendar and Schedule Schemas
Request/Response schemas for calendar functionality
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class CalendarEventType(str, Enum):
    """Calendar event types"""
    BOOKING = "booking"
    PERSONAL = "personal"
    REMINDER = "reminder"
    FESTIVAL = "festival"
    RITUAL = "ritual"


class SlotStatus(str, Enum):
    """Schedule slot status"""
    AVAILABLE = "available"
    BLOCKED = "blocked"
    BOOKED = "booked"


class ScheduleSlotCreate(BaseModel):
    """Create/Update schedule slot"""
    start_time: datetime
    end_time: datetime
    status: SlotStatus = SlotStatus.AVAILABLE
    notes: str = ""


class AcharyaScheduleUpdate(BaseModel):
    """Update Acharya's schedule"""
    date: datetime
    slots: List[ScheduleSlotCreate]
    working_hours: Optional[Dict[str, str]] = {"start": "09:00", "end": "18:00"}
    is_day_blocked: bool = False
    blocked_reason: str = ""


class BlockDatesRequest(BaseModel):
    """Block multiple dates"""
    dates: List[datetime]
    reason: str
    block_all_day: bool = True


class CalendarEventCreate(BaseModel):
    """Create calendar event"""
    event_type: CalendarEventType
    title: str
    description: str = ""
    date: datetime
    start_time: datetime
    end_time: datetime
    booking_id: Optional[str] = None
    reminder_before: int = 60  # Minutes
    color: str = "#F97316"


class CalendarEventUpdate(BaseModel):
    """Update calendar event"""
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    reminder_before: Optional[int] = None
    color: Optional[str] = None


class PanchangaRequest(BaseModel):
    """Request Panchanga for date"""
    date: datetime
    latitude: float = 12.9716  # Bangalore
    longitude: float = 77.5946
    region: str = "IN-KA"
    sampradaya: str = "smartha"


class MonthCalendarRequest(BaseModel):
    """Request month calendar"""
    year: int
    month: int  # 1-12
    latitude: float = 12.9716
    longitude: float = 77.5946
    region: str = "IN-KA"
    sampradaya: str = "smartha"


class AvailabilityCheckRequest(BaseModel):
    """Check Acharya availability"""
    acharya_id: str
    date: datetime
    duration_minutes: int = 60


class AuspiciousDaysRequest(BaseModel):
    """Find auspicious days"""
    start_date: datetime
    end_date: datetime
    activity_type: str = "general"  # marriage, grihapravesh, travel, etc.
    region: str = "IN-KA"
    sampradaya: str = "smartha"
