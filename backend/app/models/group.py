"""
Group Chat Models
Handles group conversation members, roles, and admin actions audit log
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from enum import Enum


def utcnow():
    return datetime.now(timezone.utc)


class MemberRole(str, Enum):
    """Role of a member in a group conversation"""
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class AuditAction(str, Enum):
    """Admin actions that are logged"""
    MUTE_USER = "mute_user"
    UNMUTE_USER = "unmute_user"
    BAN_USER = "ban_user"
    UNBAN_USER = "unban_user"
    REMOVE_USER = "remove_user"
    ADD_USER = "add_user"
    DELETE_MESSAGE = "delete_message"
    PIN_MESSAGE = "pin_message"
    UNPIN_MESSAGE = "unpin_message"
    LOCK_ROOM = "lock_room"
    UNLOCK_ROOM = "unlock_room"
    CHANGE_ROLE = "change_role"
    UPDATE_SETTINGS = "update_settings"


class ConversationMember(BaseModel):
    """
    Member of a group conversation with role and status
    """

    id: Optional[str] = Field(alias="_id", default=None)
    conversation_id: str  # Group conversation ID
    user_id: str  # User ID of the member
    
    # Role and permissions
    role: MemberRole = MemberRole.MEMBER
    
    # Moderation status
    muted_until: Optional[datetime] = None  # If set, user cannot post until this time
    banned_until: Optional[datetime] = None  # If set, user is banned from the group
    
    # Timestamps
    joined_at: datetime = Field(default_factory=utcnow)
    created_at: datetime = Field(default_factory=utcnow)

    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)

    @property
    def is_muted(self) -> bool:
        """Check if member is currently muted"""
        if self.muted_until is None:
            return False
        return self.muted_until > utcnow()

    @property
    def is_banned(self) -> bool:
        """Check if member is currently banned"""
        if self.banned_until is None:
            return False
        return self.banned_until > utcnow()

    @property
    def can_post(self) -> bool:
        """Check if member can post messages"""
        return not (self.is_muted or self.is_banned)

    @property
    def is_admin_or_owner(self) -> bool:
        """Check if member has admin privileges"""
        return self.role in [MemberRole.ADMIN, MemberRole.OWNER]


class RoomAuditLog(BaseModel):
    """
    Audit log for admin actions in group conversations
    """

    id: Optional[str] = Field(alias="_id", default=None)
    conversation_id: str  # Group conversation ID
    actor_id: str  # User ID of admin who performed the action
    target_id: Optional[str] = None  # User ID affected by the action (if applicable)
    message_id: Optional[str] = None  # Message ID affected (if applicable)
    
    # Action details
    action: AuditAction
    metadata: Dict[str, Any] = {}  # Additional context (reason, duration, old value, new value, etc.)
    
    # Timestamps
    created_at: datetime = Field(default_factory=utcnow)

    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)
