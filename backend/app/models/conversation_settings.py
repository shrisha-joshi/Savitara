"""
Conversation User Settings Model
Handles per-user, per-conversation preferences like mute, pin, archive
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId


def utcnow():
    return datetime.now(timezone.utc)


class PyObjectId(str):
    """Custom ObjectId type for Pydantic validation"""
    
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return str(v)


class ConversationUserSettings(BaseModel):
    """
    Per-user settings for a conversation
    These settings override global user notification preferences
    """

    id: Optional[str] = Field(alias="_id", default=None)
    conversation_id: str  # Conversation this setting applies to
    user_id: str  # User whose settings these are
    
    # Pin settings
    is_pinned: bool = False
    pin_rank: Optional[int] = None  # Lower number = higher in list, None if not pinned
    
    # Archive settings
    is_archived: bool = False
    
    # Mute settings
    muted_until: Optional[datetime] = None  # None = not muted, datetime = muted until that time
    
    # Notification settings
    notifications_on: bool = True  # If False, no push notifications for this conversation
    
    # Read tracking
    last_read_at: Optional[datetime] = None  # Last time user marked conversation as read
    
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    model_config = ConfigDict(populate_by_name=True)

    @property
    def is_muted(self) -> bool:
        """Check if conversation is currently muted"""
        if self.muted_until is None:
            return False
        return self.muted_until > utcnow()
