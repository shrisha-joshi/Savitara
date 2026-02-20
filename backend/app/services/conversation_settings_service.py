"""
Conversation Settings Service
Handles per-user conversation preferences (pin, archive, mute, notifications)
"""
from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.exceptions import NotFoundException, ForbiddenException
import logging

logger = logging.getLogger(__name__)

# Constants
MSG_CONVERSATION_NOT_FOUND = "Conversation not found"
MSG_NOT_PARTICIPANT = "You are not a participant in this conversation"


class ConversationSettingsService:
    """Service for managing per-user conversation settings"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def get_settings(
        self, conversation_id: str, user_id: str
    ) -> Dict[str, Any]:
        """
        Get user's settings for a conversation (with defaults if not set)

        Args:
            conversation_id: ID of the conversation
            user_id: ID of the user

        Returns:
            Dictionary with settings

        Raises:
            NotFoundException: If conversation not found
            ForbiddenException: If user not a participant
        """
        # Verify conversation exists and user is participant
        await self._verify_participant(conversation_id, user_id)

        # Get settings (or return defaults)
        settings = await self.db.conversation_user_settings.find_one(
            {"conversation_id": conversation_id, "user_id": user_id}
        )

        if not settings:
            # Return default settings
            return {
                "conversation_id": conversation_id,
                "user_id": user_id,
                "is_pinned": False,
                "pin_rank": None,
                "is_archived": False,
                "muted_until": None,
                "notifications_on": True,
                "last_read_at": None,
            }

        # Convert ObjectId to string for JSON serialization
        settings.pop("_id", None)
        return settings

    async def update_settings(
        self, conversation_id: str, user_id: str, updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update user's settings for a conversation

        Args:
            conversation_id: ID of the conversation
            user_id: ID of the user
            updates: Dictionary of fields to update

        Returns:
            Updated settings

        Raises:
            NotFoundException: If conversation not found
            ForbiddenException: If user not a participant
        """
        # Verify conversation exists and user is participant
        await self._verify_participant(conversation_id, user_id)

        # Add updated_at timestamp
        updates["updated_at"] = datetime.now(timezone.utc)

        # Upsert settings
        await self.db.conversation_user_settings.update_one(
            {"conversation_id": conversation_id, "user_id": user_id},
            {"$set": updates, "$setOnInsert": {"created_at": datetime.now(timezone.utc)}},
            upsert=True,
        )

        logger.info(
            f"Updated conversation settings for user {user_id} in conversation {conversation_id}"
        )

        # Return updated settings
        return await self.get_settings(conversation_id, user_id)

    async def pin_conversation(
        self, conversation_id: str, user_id: str
    ) -> Dict[str, Any]:
        """
        Pin a conversation to the top of the list

        Args:
            conversation_id: ID of the conversation
            user_id: ID of the user

        Returns:
            Updated settings
        """
        # Get current max pin_rank for user
        max_rank_doc = await self.db.conversation_user_settings.find_one(
            {"user_id": user_id, "is_pinned": True},
            sort=[("pin_rank", -1)],
        )

        # New pin gets rank 0, existing pins are incremented
        # This keeps most recent pin at top
        if max_rank_doc and max_rank_doc.get("pin_rank") is not None:
            # Increment all existing pin ranks
            await self.db.conversation_user_settings.update_many(
                {"user_id": user_id, "is_pinned": True},
                {"$inc": {"pin_rank": 1}},
            )
            new_rank = 0
        else:
            new_rank = 0

        return await self.update_settings(
            conversation_id, user_id, {"is_pinned": True, "pin_rank": new_rank}
        )

    async def unpin_conversation(
        self, conversation_id: str, user_id: str
    ) -> Dict[str, Any]:
        """Unpin a conversation"""
        return await self.update_settings(
            conversation_id, user_id, {"is_pinned": False, "pin_rank": None}
        )

    async def archive_conversation(
        self, conversation_id: str, user_id: str
    ) -> Dict[str, Any]:
        """Archive a conversation"""
        return await self.update_settings(
            conversation_id, user_id, {"is_archived": True}
        )

    async def unarchive_conversation(
        self, conversation_id: str, user_id: str
    ) -> Dict[str, Any]:
        """Unarchive a conversation"""
        return await self.update_settings(
            conversation_id, user_id, {"is_archived": False}
        )

    async def mute_conversation(
        self, conversation_id: str, user_id: str, until: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Mute a conversation

        Args:
            conversation_id: ID of the conversation
            user_id: ID of the user
            until: When to unmute (None = indefinite)

        Returns:
            Updated settings
        """
        return await self.update_settings(
            conversation_id, user_id, {"muted_until": until}
        )

    async def unmute_conversation(
        self, conversation_id: str, user_id: str
    ) -> Dict[str, Any]:
        """Unmute a conversation"""
        return await self.update_settings(
            conversation_id, user_id, {"muted_until": None}
        )

    async def mark_as_read(
        self, conversation_id: str, user_id: str
    ) -> Dict[str, Any]:
        """
        Mark conversation as read

        Args:
            conversation_id: ID of the conversation
            user_id: ID of the user

        Returns:
            Updated settings
        """
        return await self.update_settings(
            conversation_id,
            user_id,
            {"last_read_at": datetime.now(timezone.utc)},
        )

    async def _verify_participant(self, conversation_id: str, user_id: str):
        """
        Verify conversation exists and user is a participant

        Args:
            conversation_id: ID of the conversation
            user_id: ID of the user

        Raises:
            NotFoundException: If conversation not found
            ForbiddenException: If user not a participant
        """
        conversation = await self.db.conversations.find_one(
            {"_id": ObjectId(conversation_id)}
        )

        if not conversation:
            raise NotFoundException(MSG_CONVERSATION_NOT_FOUND)

        participants = conversation.get("participants", [])
        if ObjectId(user_id) not in participants:
            raise ForbiddenException(MSG_NOT_PARTICIPANT)

    def get_mute_durations(self) -> Dict[str, int]:
        """
        Get standard mute duration options (in seconds)

        Returns:
            Dictionary of mute duration labels to seconds
        """
        return {
            "1_hour": 3600,
            "8_hours": 8 * 3600,
            "24_hours": 24 * 3600,
            "1_week": 7 * 24 * 3600,
            "indefinite": None,  # None means indefinite
        }

    def calculate_mute_until(self, duration_label: str) -> Optional[datetime]:
        """
        Calculate mute_until timestamp from duration label

        Args:
            duration_label: One of "1_hour", "8_hours", "24_hours", "1_week", "indefinite"

        Returns:
            Datetime when mute should expire, or None for indefinite
        """
        durations = self.get_mute_durations()
        seconds = durations.get(duration_label)

        if seconds is None:
            return None  # Indefinite mute

        return datetime.now(timezone.utc) + timedelta(seconds=seconds)
