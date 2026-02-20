"""
Block Service
Handles user-to-user blocking functionality
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.moderation import BlockedUser
from app.core.exceptions import InvalidInputError, ResourceNotFoundError
from app.services.websocket_manager import manager
import logging

logger = logging.getLogger(__name__)


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
            raise InvalidInputError("message", "Cannot block yourself")

        # Verify blocked user exists
        blocked_user = await self.db.users.find_one({"_id": ObjectId(blocked_user_id)})
        if not blocked_user:
            raise ResourceNotFoundError(
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

        return False

    async def get_blocked_users(
        self, blocker_id: str, limit: int = 100, skip: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get list of users blocked by a user with user details
        
        Args:
            blocker_id: ID of blocker
            limit: Maximum number of results
            skip: Number of results to skip
            
        Returns:
            List of blocked users with user details
        """
        # Get blocked user IDs
        blocks = (
            await self.db.blocked_users.find({"blocker_id": blocker_id})
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
            .to_list(length=limit)
        )

        if not blocks:
            return []

        # Get blocked user details
        blocked_ids = [block["blocked_user_id"] for block in blocks]
        users = await self.db.users.find(
            {"_id": {"$in": [ObjectId(uid) for uid in blocked_ids if ObjectId.is_valid(uid)]}}
        ).to_list(length=len(blocked_ids))

        # Create user lookup dict
        user_dict = {str(user["_id"]): user for user in users}

        # Combine block info with user details
        result = []
        for block in blocks:
            blocked_user_id = block["blocked_user_id"]
            user = user_dict.get(blocked_user_id, {})
            
            result.append(
                {
                    "block_id": str(block["_id"]),
                    "blocked_user_id": blocked_user_id,
                    "blocked_at": block["created_at"],
                    "reason": block.get("reason"),
                    "is_mutual": block.get("is_mutual", False),
                    "user": {
                        "id": blocked_user_id,
                        "name": user.get("name", "Unknown User"),
                        "email": user.get("email", ""),
                        "profile_picture": user.get("profile_picture"),
                        "role": user.get("role", "user"),
                    },
                }
            )

        return result

    async def is_blocked(self, user_id_a: str, user_id_b: str) -> Dict[str, bool]:
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

        return {
            "a_blocks_b": a_blocks_b is not None,
            "b_blocks_a": b_blocks_a is not None,
            "is_blocked": a_blocks_b is not None or b_blocks_a is not None,
            "is_mutual": a_blocks_b is not None and b_blocks_a is not None,
        }

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
