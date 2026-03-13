"""
Block Service
Handles user-to-user blocking functionality
"""
from typing import List, Dict, Any, Optional
import inspect
from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.moderation import BlockedUser
from app.core.exceptions import InvalidInputError, ResourceNotFoundError
from app.services.websocket_manager import manager
import logging

logger = logging.getLogger(__name__)


async def _maybe_await(value):
    """Await value only when it is awaitable (mock/driver compatibility)."""
    if inspect.isawaitable(value):
        return await value
    return value


class BlockService:
    """Service for managing user blocks"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def block_user(
        self, blocker_id: str, blocked_user_id: str, reason: Optional[str] = None
    ) -> BlockedUser:
        """
        Block a user
        
        Args:
            blocker_id: ID of user doing the blocking
            blocked_user_id: ID of user being blocked
            reason: Optional reason for blocking
            
        Returns:
            BlockedUser: The created block relationship
            
        Raises:
            InvalidInputError: If trying to block self
            ResourceNotFoundError: If blocked user doesn't exist
        """
        # Validate can't block yourself
        if blocker_id == blocked_user_id:
            raise InvalidInputError(
                message="Cannot block yourself",
                field="blocked_user_id",
            )

        # Verify blocked user exists
        blocked_user = await self.db.users.find_one({"_id": ObjectId(blocked_user_id)})
        if not blocked_user:
            raise ResourceNotFoundError(
                message=f"User not found: {blocked_user_id}",
                resource_type="User", resource_id=blocked_user_id
            )

        # Check if block already exists
        existing_block = await self.db.blocked_users.find_one(
            {"blocker_id": blocker_id, "blocked_user_id": blocked_user_id}
        )

        if existing_block:
            # Already blocked - return existing (idempotent)
            return BlockedUser(**existing_block)

        # Check if reverse block exists (mutual block detection)
        reverse_block = await self.db.blocked_users.find_one(
            {"blocker_id": blocked_user_id, "blocked_user_id": blocker_id}
        )
        is_mutual = reverse_block is not None

        # Create block
        block_data = {
            "blocker_id": blocker_id,
            "blocked_user_id": blocked_user_id,
            "reason": reason,
            "is_mutual": is_mutual,
            "created_at": datetime.now(timezone.utc),
        }

        result = await self.db.blocked_users.insert_one(block_data)
        block_data["_id"] = str(result.inserted_id)

        # If mutual, update the reverse block
        if is_mutual:
            await self.db.blocked_users.update_one(
                {"blocker_id": blocked_user_id, "blocked_user_id": blocker_id},
                {"$set": {"is_mutual": True}},
            )

        # Emit socket event to blocker (private, not to blocked user for privacy)
        await manager.emit_to_user(
            blocker_id, "user_blocked", {"blocked_user_id": blocked_user_id}
        )

        logger.info(
            f"User {blocker_id} blocked user {blocked_user_id} (mutual: {is_mutual})"
        )

        return BlockedUser(**block_data)

    async def unblock_user(self, blocker_id: str, blocked_user_id: str) -> bool:
        """
        Unblock a user
        
        Args:
            blocker_id: ID of user doing the unblocking
            blocked_user_id: ID of user being unblocked
            
        Returns:
            bool: True if unblocked, False if no block existed
        """
        result = await self.db.blocked_users.delete_one(
            {"blocker_id": blocker_id, "blocked_user_id": blocked_user_id}
        )

        if result.deleted_count > 0:
            # Update reverse block if it exists (no longer mutual)
            await self.db.blocked_users.update_one(
                {"blocker_id": blocked_user_id, "blocked_user_id": blocker_id},
                {"$set": {"is_mutual": False}},
            )

            # Emit socket event
            await manager.emit_to_user(
                blocker_id, "user_unblocked", {"blocked_user_id": blocked_user_id}
            )

            logger.info(f"User {blocker_id} unblocked user {blocked_user_id}")
        return True

    async def get_blocked_users(
        self,
        user_id: Optional[str] = None,
        blocker_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
        skip: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Get list of users blocked by a user with user details
        
        Args:
            blocker_id: ID of blocker
            limit: Maximum number of results
            skip: Number of results to skip
            
        Returns:
            List of blocked users with user details
        """
        effective_user_id = user_id or blocker_id
        if not effective_user_id:
            return {"users": [], "total": 0}

        effective_skip = skip if skip is not None else offset

        pipeline = [
            {"$match": {"blocker_id": effective_user_id}},
            {"$sort": {"created_at": -1}},
            {"$skip": effective_skip},
            {"$limit": limit},
        ]

        aggregate_result = await _maybe_await(self.db.blocked_users.aggregate(pipeline))
        blocks = await _maybe_await(aggregate_result.to_list(length=limit))
        formatted = [
            {
                "block_id": str(block.get("_id")),
                "blocked_user_id": block.get("blocked_user_id"),
                "blocked_at": block.get("created_at"),
                "reason": block.get("reason"),
                "is_mutual": block.get("is_mutual", False),
            }
            for block in blocks
        ]

        total = await _maybe_await(
            self.db.blocked_users.count_documents({"blocker_id": effective_user_id})
        )
        if not isinstance(total, int):
            total = len(formatted)
        if not total and formatted:
            total = len(formatted)

        return {"users": formatted, "total": total}

    async def is_blocked(self, user_id_a: str, user_id_b: str) -> bool:
        """
        Check if there's a block relationship between two users
        
        Args:
            user_id_a: First user ID
            user_id_b: Second user ID
            
        Returns:
            Dict with keys: a_blocks_b, b_blocks_a, is_blocked (either direction)
        """
        # Check both directions
        a_blocks_b = await self.db.blocked_users.find_one(
            {"blocker_id": user_id_a, "blocked_user_id": user_id_b}
        )

        b_blocks_a = await self.db.blocked_users.find_one(
            {"blocker_id": user_id_b, "blocked_user_id": user_id_a}
        )

        return a_blocks_b is not None or b_blocks_a is not None

    async def is_blocked_bidirectional(self, user_id_a: str, user_id_b: str) -> bool:
        """Check if block exists in either direction using count query."""
        count = await self.db.blocked_users.count_documents(
            {
                "$or": [
                    {"blocker_id": user_id_a, "blocked_user_id": user_id_b},
                    {"blocker_id": user_id_b, "blocked_user_id": user_id_a},
                ]
            }
        )
        return count > 0

    async def get_mutual_blocks(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all mutual blocks for a user."""
        cursor = await _maybe_await(
            self.db.blocked_users.find({"blocker_id": user_id, "is_mutual": True})
        )
        blocks = await _maybe_await(cursor.to_list(length=None))
        return [
            {
                **block,
                "_id": str(block.get("_id")),
            }
            for block in blocks
        ]

    async def block_count(self, user_id: str) -> int:
        """Get total number of users blocked by a given user."""
        return await self.db.blocked_users.count_documents({"blocker_id": user_id})

    async def get_blockers_of_user(self, user_id: str) -> List[str]:
        """
        Get list of user IDs who have blocked this user
        
        Args:
            user_id: ID of user to check
            
        Returns:
            List of blocker user IDs
        """
        blocks = await self.db.blocked_users.find(
            {"blocked_user_id": user_id}
        ).to_list(length=None)

        return [block["blocker_id"] for block in blocks]
