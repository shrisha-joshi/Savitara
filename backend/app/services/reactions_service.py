"""
Reactions Service
Handles adding, removing, and aggregating message reactions
"""
from typing import List, Dict, Optional
from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from fastapi import HTTPException

from app.models.database import MessageReaction, PyObjectId
from app.core.exceptions import (
    ResourceNotFoundError,
    PermissionDeniedError,
    InvalidInputError,
)
from app.utils.emoji_whitelist import ALLOWED_EMOJIS
from app.services.websocket_manager import manager
import logging

logger = logging.getLogger(__name__)

# Constants
MSG_NOT_FOUND = "Message not found"
MSG_INVALID_EMOJI = "Invalid emoji. Must be one of the allowed emojis."
MSG_NO_ACCESS = "You do not have access to this conversation"
MSG_BLOCKED = "Cannot react to messages from users you have blocked or who have blocked you"


class ReactionSummary:
    """Summary of reactions for a message"""

    def __init__(self, emoji: str, count: int, reacted_by_me: bool):
        self.emoji = emoji
        self.count = count
        self.reacted_by_me = reacted_by_me

    def to_dict(self) -> Dict:
        return {
            "emoji": self.emoji,
            "count": self.count,
            "reactedByMe": self.reacted_by_me,
        }


class ReactionsService:
    """Service for handling message reactions"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def add_reaction(
        self, message_id: str, user_id: str, emoji: str
    ) -> List[Dict]:
        """
        Add a reaction to a message (idempotent)

        Args:
            message_id: ID of the message to react to
            user_id: ID of the user adding the reaction
            emoji: Emoji to add (must be in whitelist)

        Returns:
            List of reaction summaries for the message

        Raises:
            NotFoundException: If message not found
            ForbiddenException: If user blocked or no access
            BadRequestException: If emoji not in whitelist
        """
        # 1. Validate emoji is in whitelist
        if emoji not in ALLOWED_EMOJIS:
            raise InvalidInputError(MSG_INVALID_EMOJI)

        # 2. Get message and validate it exists
        message = await self.db.messages.find_one({"_id": ObjectId(message_id)})
        if not message:
            raise ResourceNotFoundError(MSG_NOT_FOUND)

        # 3. Check user has access to the conversation
        conversation_id = message.get("conversation_id")
        if conversation_id:
            conversation = await self.db.conversations.find_one(
                {"_id": conversation_id}
            )
            if conversation:
                participants = conversation.get("participants", [])
                if ObjectId(user_id) not in participants:
                    raise PermissionDeniedError(MSG_NO_ACCESS)

        # 4. Check user is not blocked by message sender
        sender_id = message.get("sender_id")
        is_blocked = await self._check_blocked(str(sender_id), user_id)
        if is_blocked:
            raise PermissionDeniedError(MSG_BLOCKED)

        # 5. Add reaction (idempotent - check if already exists)
        existing_reactions = message.get("reactions", [])
        user_obj_id = ObjectId(user_id)

        # Check if user already reacted with this emoji
        already_reacted = any(
            r.get("user_id") == user_obj_id and r.get("emoji") == emoji
            for r in existing_reactions
        )

        if not already_reacted:
            # Add new reaction
            new_reaction = {
                "user_id": user_obj_id,
                "emoji": emoji,
                "created_at": datetime.now(timezone.utc),
            }
            await self.db.messages.update_one(
                {"_id": ObjectId(message_id)},
                {"$push": {"reactions": new_reaction}},
            )
            logger.info(
                f"User {user_id} added reaction {emoji} to message {message_id}"
            )

            # Broadcast reaction_added event to conversation participants
            await self._broadcast_reaction_event(
                conversation_id,
                message_id,
                user_id,
                emoji,
                "reaction_added"
            )
        else:
            logger.info(
                f"User {user_id} already reacted with {emoji} to message {message_id} (idempotent)"
            )

        # 6. Return aggregated reaction summary
        return await self.get_reactions_summary(message_id, user_id)

    async def remove_reaction(
        self, message_id: str, user_id: str, emoji: str
    ) -> List[Dict]:
        """
        Remove a reaction from a message

        Args:
            message_id: ID of the message
            user_id: ID of the user removing the reaction
            emoji: Emoji to remove

        Returns:
            List of reaction summaries for the message

        Raises:
            NotFoundException: If message not found
        """
        # Verify message exists
        message = await self.db.messages.find_one({"_id": ObjectId(message_id)})
        if not message:
            raise ResourceNotFoundError(MSG_NOT_FOUND)

        conversation_id = message.get("conversation_id")

        # Remove reaction (no-op if doesn't exist)
        result = await self.db.messages.update_one(
            {"_id": ObjectId(message_id)},
            {
                "$pull": {
                    "reactions": {"user_id": ObjectId(user_id), "emoji": emoji}
                }
            },
        )

        if result.modified_count > 0:
            logger.info(
                f"User {user_id} removed reaction {emoji} from message {message_id}"
            )

            # Broadcast reaction_removed event to conversation participants
            await self._broadcast_reaction_event(
                conversation_id,
                message_id,
                user_id,
                emoji,
                "reaction_removed"
            )
        else:
            logger.info(
                f"User {user_id} had no reaction {emoji} on message {message_id} (no-op)"
            )

        # Return updated reaction summary
        return await self.get_reactions_summary(message_id, user_id)

    async def get_reactions_summary(
        self, message_id: str, user_id: Optional[str] = None
    ) -> List[Dict]:
        """
        Get aggregated reaction summary for a message

        Args:
            message_id: ID of the message
            user_id: Optional ID of current user (for reactedByMe flag)

        Returns:
            List of reaction summaries [{emoji, count, reactedByMe}]

        Raises:
            NotFoundException: If message not found
        """
        message = await self.db.messages.find_one({"_id": ObjectId(message_id)})
        if not message:
            raise ResourceNotFoundError("Message not found")

        reactions = message.get("reactions", [])

        # Aggregate reactions by emoji
        reaction_counts = {}
        user_reactions = set()

        user_obj_id = ObjectId(user_id) if user_id else None

        for reaction in reactions:
            emoji = reaction.get("emoji")
            reactor_id = reaction.get("user_id")

            if emoji:
                reaction_counts[emoji] = reaction_counts.get(emoji, 0) + 1

                if user_obj_id and reactor_id == user_obj_id:
                    user_reactions.add(emoji)

        # Build summary list
        summaries = []
        for emoji, count in sorted(
            reaction_counts.items(), key=lambda x: x[1], reverse=True
        ):
            summary = ReactionSummary(
                emoji=emoji, count=count, reacted_by_me=emoji in user_reactions
            )
            summaries.append(summary.to_dict())

        return summaries

    async def _check_blocked(self, user_id_1: str, user_id_2: str) -> bool:
        """
        Check if two users have blocked each other (either direction)

        Args:
            user_id_1: First user ID
            user_id_2: Second user ID

        Returns:
            True if blocked (either direction), False otherwise
        """
        block = await self.db.blocked_users.find_one(
            {
                "$or": [
                    {
                        "blocker_id": user_id_1,
                        "blocked_user_id": user_id_2,
                    },
                    {
                        "blocker_id": user_id_2,
                        "blocked_user_id": user_id_1,
                    },
                ]
            }
        )
        return block is not None

    async def _broadcast_reaction_event(
        self,
        conversation_id: ObjectId,
        message_id: str,
        user_id: str,
        emoji: str,
        event_type: str
    ):
        """
        Broadcast reaction event to all conversation participants via WebSocket

        Args:
            conversation_id: ID of the conversation
            message_id: ID of the message
            user_id: ID of the user who reacted
            emoji: The emoji that was added/removed
            event_type: Either "reaction_added" or "reaction_removed"
        """
        if not conversation_id:
            return

        # Get conversation to find all participants
        conversation = await self.db.conversations.find_one({"_id": conversation_id})
        if not conversation:
            return

        participants = conversation.get("participants", [])

        # Create the event payload
        event_data = {
            "type": event_type,
            "message_id": message_id,
            "conversation_id": str(conversation_id),
            "user_id": user_id,
            "emoji": emoji,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # Send to all participants
        for participant_id in participants:
            participant_str = str(participant_id)
            try:
                await manager.send_personal_message(participant_str, event_data)
            except Exception as e:
                logger.warning(
                    f"Failed to send {event_type} to user {participant_str}: {e}"
                )

