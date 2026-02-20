"""
Block Enforcement Middleware
Prevents blocked users from sending messages or reactions
"""
from typing import Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

from app.core.exceptions import PermissionDeniedError

logger = logging.getLogger(__name__)


class BlockEnforcementMiddleware:
    """Service for enforcing user blocks in chat and reactions"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def check_block_status(
        self, user_id: str, target_user_id: str, action: str = "interact"
    ) -> None:
        """
        Check if users have blocked each other

        Args:
            user_id: ID of the acting user
            target_user_id: ID of the target user
            action: Description of action being attempted

        Raises:
            PermissionDeniedError: If either user has blocked the other
        """
        user_oid = ObjectId(user_id) if ObjectId.is_valid(user_id) else None
        target_oid = (
            ObjectId(target_user_id) if ObjectId.is_valid(target_user_id) else None
        )

        if not user_oid or not target_oid:
            logger.warning(f"Invalid user IDs in block check: {user_id}, {target_user_id}")
            return

        # Check if current user has blocked target
        user_blocks_target = await self.db.blocked_users.find_one(
            {"blocker_id": user_oid, "blocked_user_id": target_oid}
        )

        # Check if target has blocked current user
        target_blocks_user = await self.db.blocked_users.find_one(
            {"blocker_id": target_oid, "blocked_user_id": user_oid}
        )

        if user_blocks_target or target_blocks_user:
            raise PermissionDeniedError(
                f"Cannot {action}: users have blocked interaction"
            )

    async def check_conversation_participants_blocks(
        self, conversation_id: str, sender_id: str
    ) -> None:
        """
        Check if sender is blocked by any conversation participant

        Args:
            conversation_id: ID of the conversation
            sender_id: ID of the message sender

        Raises:
            ForbiddenException: If sender is blocked by any participant
        """
        conv_oid = (
            ObjectId(conversation_id) if ObjectId.is_valid(conversation_id) else None
        )

        if not conv_oid:
            return

        # Get conversation
        conversation = await self.db.conversations.find_one({"_id": conv_oid})

        if not conversation:
            return

        participants = conversation.get("participants", [])
        sender_oid = ObjectId(sender_id) if ObjectId.is_valid(sender_id) else None

        if not sender_oid:
            return

        # Check if sender is blocked by any other participant
        for participant_id in participants:
            # Skip self
            if str(participant_id) == sender_id:
                continue

            # Check if this participant has blocked the sender
            block = await self.db.blocked_users.find_one(
                {"blocker_id": participant_id, "blocked_user_id": sender_oid}
            )

            if block:
                raise PermissionDeniedError(
                    "Cannot send message: you are blocked by a conversation participant"
                )

            # Also check reverse (sender blocked participant) for symmetry
            reverse_block = await self.db.blocked_users.find_one(
                {"blocker_id": sender_oid, "blocked_user_id": participant_id}
            )

            if reverse_block:
                raise PermissionDeniedError(
                    "Cannot send message: you have blocked a conversation participant"
                )

    async def get_blocked_user_ids(self, user_id: str) -> list[str]:
        """
        Get list of user IDs that are blocked by or blocking the given user

        Args:
            user_id: ID of the user

        Returns:
            List of blocked user IDs (as strings)
        """
        user_oid = ObjectId(user_id) if ObjectId.is_valid(user_id) else None

        if not user_oid:
            return []

        blocked_ids = set()

        # Users blocked BY this user
        blocks_cursor = self.db.blocked_users.find({"blocker_id": user_oid})
        async for block in blocks_cursor:
            blocked_ids.add(str(block["blocked_user_id"]))

        # Users who have blocked this user
        blocked_by_cursor = self.db.blocked_users.find({"blocked_user_id": user_oid})
        async for block in blocked_by_cursor:
            blocked_ids.add(str(block["blocker_id"]))

        return list(blocked_ids)

    async def filter_blocked_users(
        self, user_id: str, user_list: list[dict]
    ) -> list[dict]:
        """
        Filter out blocked users from a list

        Args:
            user_id: Current user ID
            user_list: List of user dicts with 'id' or '_id' field

        Returns:
            Filtered list without blocked users
        """
        blocked_ids = await self.get_blocked_user_ids(user_id)
        blocked_ids_set = set(blocked_ids)

        return [
            user
            for user in user_list
            if str(user.get("id", user.get("_id"))) not in blocked_ids_set
        ]
