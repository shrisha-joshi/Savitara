"""
Moderation Models for User Reports and Blocking
Handles user safety, abuse reporting, and blocking functionality
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum


def utcnow():
    return datetime.now(timezone.utc)


class ReportReason(str, Enum):
    """Reasons for reporting a user"""

    HARASSMENT = "harassment"
    SPAM = "spam"
    INAPPROPRIATE_CONTENT = "inappropriate_content"
    FAKE_PROFILE = "fake_profile"
    SCAM = "scam"
    VIOLENCE = "violence"
    HATE_SPEECH = "hate_speech"
    OTHER = "other"


class ReportStatus(str, Enum):
    """Status of a report"""

    PENDING = "pending"
    REVIEWING = "reviewing"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"
    ACTION_TAKEN = "action_taken"


class ReportAction(str, Enum):
    """Actions taken on a report"""

    WARNING_SENT = "warning_sent"
    USER_SUSPENDED = "user_suspended"
    USER_BANNED = "user_banned"
    CONTENT_REMOVED = "content_removed"
    NO_ACTION = "no_action"


class UserReport(BaseModel):
    """User report model - when a user reports another user"""

    id: Optional[str] = Field(alias="_id", default=None)
    reporter_id: str  # User who is reporting
    reported_user_id: str  # User being reported
    reason: ReportReason
    description: str = ""
    evidence_urls: List[str] = []  # Screenshots, chat logs, etc.
    context: str = ""  # Booking ID, chat ID, etc.
    status: ReportStatus = ReportStatus.PENDING
    priority: int = 1  # 1 (low) to 5 (high)
    reviewed_by: Optional[str] = None  # Admin ID
    reviewed_at: Optional[datetime] = None
    action_taken: Optional[ReportAction] = None
    admin_notes: str = ""
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    model_config = ConfigDict(use_enum_values=True, populate_by_name=True)


class BlockedUser(BaseModel):
    """Blocked user relationship - User A blocks User B"""

    id: Optional[str] = Field(alias="_id", default=None)
    blocker_id: str  # User who is blocking
    blocked_user_id: str  # User being blocked
    reason: Optional[str] = None  # Optional reason why they blocked
    is_mutual: bool = False  # True if both users blocked each other
    created_at: datetime = Field(default_factory=utcnow)

    model_config = ConfigDict(populate_by_name=True)


class UserWarning(BaseModel):
    """Warning issued to a user"""

    id: Optional[str] = Field(alias="_id", default=None)
    user_id: str
    issued_by: str  # Admin ID
    reason: str
    severity: int = 1  # 1 (minor) to 5 (severe)
    report_id: Optional[str] = None
    expires_at: Optional[datetime] = None
    acknowledged: bool = False
    acknowledged_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utcnow)

    model_config = ConfigDict(populate_by_name=True)


class UserSuspension(BaseModel):
    """User suspension record"""

    id: Optional[str] = Field(alias="_id", default=None)
    user_id: str
    suspended_by: str  # Admin ID
    reason: str
    report_ids: List[str] = []  # Related reports
    suspended_at: datetime = Field(default_factory=utcnow)
    suspended_until: Optional[datetime] = None  # None = permanent ban
    is_active: bool = True
    lifted_by: Optional[str] = None  # Admin who lifted suspension
    lifted_at: Optional[datetime] = None
    appeal_message: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)
