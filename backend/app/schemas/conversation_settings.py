"""
Schemas for conversation settings API
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class ConversationSettingsResponse(BaseModel):
    """Response model for conversation settings"""

    conversation_id: str
    user_id: str
    is_pinned: bool = False
    pin_rank: Optional[int] = None
    is_archived: bool = False
    muted_until: Optional[datetime] = None
    notifications_on: bool = True
    last_read_at: Optional[datetime] = None


class UpdateSettingsRequest(BaseModel):
    """Request to update multiple settings at once"""

    is_pinned: Optional[bool] = None
    pin_rank: Optional[int] = None
    is_archived: Optional[bool] = None
    muted_until: Optional[datetime] = None
    notifications_on: Optional[bool] = None


class MuteRequest(BaseModel):
    """Request to mute a conversation"""

    duration: str = Field(
        ...,
        description="Mute duration: '1_hour', '8_hours', '24_hours', '1_week', 'indefinite'",
    )

    @field_validator("duration")
    @classmethod
    def validate_duration(cls, v: str) -> str:
        """Validate mute duration"""
        valid_durations = {"1_hour", "8_hours", "24_hours", "1_week", "indefinite"}
        if v not in valid_durations:
            raise ValueError(f"Duration must be one of: {', '.join(valid_durations)}")
        return v


class MuteResponse(BaseModel):
    """Response after muting"""

    muted_until: Optional[datetime] = None
    is_indefinite: bool = False


class MarkReadRequest(BaseModel):
    """Request to mark conversation as read"""

    message_id: Optional[str] = None
