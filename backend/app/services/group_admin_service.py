"""
Group Admin Service
Handles group chat administration: member management, permissions, moderation
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.exceptions import (
    InvalidInputError,
    ResourceNotFoundError,
    PermissionDeniedError,
)
from app.services.websocket_manager import manager
import logging

logger = logging.getLogger(__name__)


class GroupRole:
    """Group member roles"""

    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class AuditAction:
    """Audit log action types"""

    MUTE_USER = "mute_user"
    UNMUTE_USER = "unmute_user"
    BAN_USER = "ban_user"
    UNBAN_USER = "unban_user"
    REMOVE_MEMBER = "remove_member"
    CHANGE_ROLE = "change_role"
    DELETE_MESSAGE = "delete_message"
    PIN_MESSAGE = "pin_message"
    UNPIN_MESSAGE = "unpin_message"
    LOCK_ROOM = "lock_room"
    UNLOCK_ROOM = "unlock_room"


class GroupAdminService:
    """Service for group chat administration"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def _verify_admin_permission(
        self, conversation_id: str, user_id: str, require_owner: bool = False
    ) -> Dict[str, Any]:
        """
        Verify user has admin permission in a conversation
        
        Args:
            conversation_id: Conversation ID
            user_id: User ID to check
            require_owner: If True, require owner role
            
        Returns:
            Member document
            
        Raises:
            ResourceNotFoundError: If conversation or membership not found
            PermissionDeniedError: If user lacks permission
        """
        # Get conversation
        conversation = await self.db.conversations.find_one(
            {"_id": ObjectId(conversation_id)}
        )
        if not conversation:
            raise ResourceNotFoundError(
                resource_type="Conversation", resource_id=conversation_id
            )

        # Get member
        member = await self.db.conversation_members.find_one(
            {"conversation_id": conversation_id, "user_id": user_id}
        )
        if not member:
            raise PermissionDeniedError(
                message="You are not a member of this conversation"
            )

        # Check permission
        role = member.get("role", GroupRole.MEMBER)
        if require_owner and role != GroupRole.OWNER:
            raise PermissionDeniedError(message="Only the group owner can perform this action")

        if not require_owner and role not in [GroupRole.OWNER, GroupRole.ADMIN]:
            raise PermissionDeniedError(
                message="Only admins and owners can perform this action"
            )

        return member

    async def _log_audit(
        self,
        conversation_id: str,
        actor_id: str,
        action: str,
        target_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """Log an admin action to audit trail"""
        audit_entry = {
            "conversation_id": conversation_id,
            "actor_id": actor_id,
            "target_id": target_id,
            "action": action,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc),
        }
        await self.db.room_audit_log.insert_one(audit_entry)

    async def mute_member(
        self,
        conversation_id: str,
        admin_id: str,
        target_user_id: str,
        duration_hours: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Mute a member in a group (prevents them from sending messages)
        
        Args:
            conversation_id: Conversation ID
            admin_id: Admin performing the action
            target_user_id: User to mute
            duration_hours: Hours to mute for (None = indefinite)
            
        Returns:
            Updated member document
        """
        # Verify admin permission
        await self._verify_admin_permission(conversation_id, admin_id)

        # Can't mute yourself
        if admin_id == target_user_id:
            raise InvalidInputError("target_user_id", "Cannot mute yourself")

        # Get target member
        target_member = await self.db.conversation_members.find_one(
            {"conversation_id": conversation_id, "user_id": target_user_id}
        )
        if not target_member:
            raise ResourceNotFoundError(
                resource_type="Member", resource_id=target_user_id
            )

        # Can't mute owner or admin (unless you're owner)
        target_role = target_member.get("role", GroupRole.MEMBER)
        if target_role in [GroupRole.OWNER, GroupRole.ADMIN]:
            admin_member = await self.db.conversation_members.find_one(
                {"conversation_id": conversation_id, "user_id": admin_id}
            )
            if admin_member.get("role") != GroupRole.OWNER:
                raise PermissionDeniedError(
                    message="Only the owner can mute admins"
                )

        # Calculate mute expiry
        muted_until = None
        if duration_hours:
            muted_until = datetime.now(timezone.utc) + timedelta(hours=duration_hours)

        # Update member
        await self.db.conversation_members.update_one(
            {"_id": target_member["_id"]}, {"$set": {"muted_until": muted_until}}
        )

        # Log audit
        await self._log_audit(
            conversation_id,
            admin_id,
            AuditAction.MUTE_USER,
            target_user_id,
            {"duration_hours": duration_hours, "until": muted_until},
        )

        # Emit socket event
        await manager.emit_to_room(
            conversation_id,
            "member_muted",
            {
                "conversation_id": conversation_id,
                "user_id": target_user_id,
                "muted_until": muted_until.isoformat() if muted_until else None,
            },
        )

        logger.info(
            f"Admin {admin_id} muted user {target_user_id} in conversation {conversation_id} for {duration_hours}h"
        )

        updated_member = await self.db.conversation_members.find_one(
            {"_id": target_member["_id"]}
        )
        return {**updated_member, "_id": str(updated_member["_id"])}

    async def unmute_member(
        self, conversation_id: str, admin_id: str, target_user_id: str
    ) -> Dict[str, Any]:
        """Unmute a member"""
        await self._verify_admin_permission(conversation_id, admin_id)

        result = await self.db.conversation_members.update_one(
            {"conversation_id": conversation_id, "user_id": target_user_id},
            {"$set": {"muted_until": None}},
        )

        if result.modified_count == 0:
            raise ResourceNotFoundError(resource_type="Member", resource_id=target_user_id)

        await self._log_audit(
            conversation_id, admin_id, AuditAction.UNMUTE_USER, target_user_id
        )

        await manager.emit_to_room(
            conversation_id,
            "member_unmuted",
            {"conversation_id": conversation_id, "user_id": target_user_id},
        )

        logger.info(
            f"Admin {admin_id} unmuted user {target_user_id} in conversation {conversation_id}"
        )

        member = await self.db.conversation_members.find_one(
            {"conversation_id": conversation_id, "user_id": target_user_id}
        )
        return {**member, "_id": str(member["_id"])}

    async def ban_member(
        self,
        conversation_id: str,
        admin_id: str,
        target_user_id: str,
        duration_days: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Ban a member from a group (removes and prevents rejoin)
        
        Args:
            conversation_id: Conversation ID
            admin_id: Admin performing the action
            target_user_id: User to ban
            duration_days: Days to ban for (None = permanent)
        """
        await self._verify_admin_permission(conversation_id, admin_id)

        if admin_id == target_user_id:
            raise InvalidInputError("target_user_id", "Cannot ban yourself")

        # Get target member
        target_member = await self.db.conversation_members.find_one(
            {"conversation_id": conversation_id, "user_id": target_user_id}
        )
        if not target_member:
            raise ResourceNotFoundError(resource_type="Member", resource_id=target_user_id)

        # Calculate ban expiry
        banned_until = None
        if duration_days:
            banned_until = datetime.now(timezone.utc) + timedelta(days=duration_days)

        # Update member with ban
        await self.db.conversation_members.update_one(
            {"_id": target_member["_id"]}, {"$set": {"banned_until": banned_until}}
        )

        await self._log_audit(
            conversation_id,
            admin_id,
            AuditAction.BAN_USER,
            target_user_id,
            {"duration_days": duration_days, "until": banned_until},
        )

        await manager.emit_to_room(
            conversation_id,
            "member_banned",
            {
                "conversation_id": conversation_id,
                "user_id": target_user_id,
                "banned_until": banned_until.isoformat() if banned_until else None,
            },
        )

        logger.info(
            f"Admin {admin_id} banned user {target_user_id} from conversation {conversation_id}"
        )

        updated_member = await self.db.conversation_members.find_one(
            {"_id": target_member["_id"]}
        )
        return {**updated_member, "_id": str(updated_member["_id"])}

    async def remove_member(
        self, conversation_id: str, admin_id: str, target_user_id: str
    ) -> bool:
        """Remove a member from a group"""
        await self._verify_admin_permission(conversation_id, admin_id)

        if admin_id == target_user_id:
            raise InvalidInputError("target_user_id", "Cannot remove yourself")

        result = await self.db.conversation_members.delete_one(
            {"conversation_id": conversation_id, "user_id": target_user_id}
        )

        if result.deleted_count == 0:
            raise ResourceNotFoundError(resource_type="Member", resource_id=target_user_id)

        # Remove from participants list
        await self.db.conversations.update_one(
            {"_id": ObjectId(conversation_id)},
            {"$pull": {"participants": target_user_id}},
        )

        await self._log_audit(
            conversation_id, admin_id, AuditAction.REMOVE_MEMBER, target_user_id
        )

        await manager.emit_to_room(
            conversation_id,
            "member_removed",
            {"conversation_id": conversation_id, "user_id": target_user_id},
        )

        logger.info(
            f"Admin {admin_id} removed user {target_user_id} from conversation {conversation_id}"
        )

        return True

    async def change_member_role(
        self, conversation_id: str, owner_id: str, target_user_id: str, new_role: str
    ) -> Dict[str, Any]:
        """Change a member's role (owner only)"""
        await self._verify_admin_permission(conversation_id, owner_id, require_owner=True)

        if new_role not in [GroupRole.ADMIN, GroupRole.MEMBER]:
            raise InvalidInputError("new_role", "Invalid role. Must be 'admin' or 'member'")

        result = await self.db.conversation_members.update_one(
            {"conversation_id": conversation_id, "user_id": target_user_id},
            {"$set": {"role": new_role}},
        )

        if result.modified_count == 0:
            raise ResourceNotFoundError(resource_type="Member", resource_id=target_user_id)

        await self._log_audit(
            conversation_id,
            owner_id,
            AuditAction.CHANGE_ROLE,
            target_user_id,
            {"new_role": new_role},
        )

        await manager.emit_to_room(
            conversation_id,
            "member_role_changed",
            {
                "conversation_id": conversation_id,
                "user_id": target_user_id,
                "new_role": new_role,
            },
        )

        logger.info(
            f"Owner {owner_id} changed user {target_user_id} role to {new_role} in conversation {conversation_id}"
        )

        member = await self.db.conversation_members.find_one(
            {"conversation_id": conversation_id, "user_id": target_user_id}
        )
        return {**member, "_id": str(member["_id"])}

    async def delete_message(
        self, conversation_id: str, admin_id: str, message_id: str
    ) -> bool:
        """
        Delete a message (soft delete)
        Admin, owner, or message sender can delete
        """
        # Get message
        message = await self.db.messages.find_one({"_id": ObjectId(message_id)})
        if not message:
            raise ResourceNotFoundError(resource_type="Message", resource_id=message_id)

        # Check permission: sender, admin, or owner can delete
        sender_id = message.get("sender_id")
        if sender_id != admin_id:
            await self._verify_admin_permission(conversation_id, admin_id)

        # Soft delete
        await self.db.messages.update_one(
            {"_id": ObjectId(message_id)},
            {"$set": {"deleted_at": datetime.now(timezone.utc), "deleted_by": admin_id}},
        )

        await self._log_audit(
            conversation_id, admin_id, AuditAction.DELETE_MESSAGE, metadata={"message_id": message_id}
        )

        await manager.emit_to_room(
            conversation_id,
            "message_deleted",
            {
                "conversation_id": conversation_id,
                "message_id": message_id,
                "deleted_at": datetime.now(timezone.utc).isoformat(),
            },
        )

        logger.info(
            f"Admin {admin_id} deleted message {message_id} in conversation {conversation_id}"
        )

        return True

    async def pin_message(
        self, conversation_id: str, admin_id: str, message_id: str
    ) -> Dict[str, Any]:
        """Pin a message to the top of the conversation"""
        await self._verify_admin_permission(conversation_id, admin_id)

        message = await self.db.messages.find_one({"_id": ObjectId(message_id)})
        if not message:
            raise ResourceNotFoundError(resource_type="Message", resource_id=message_id)

        # Update conversation
        await self.db.conversations.update_one(
            {"_id": ObjectId(conversation_id)}, {"$set": {"pinned_message_id": message_id}}
        )

        await self._log_audit(
            conversation_id, admin_id, AuditAction.PIN_MESSAGE, metadata={"message_id": message_id}
        )

        await manager.emit_to_room(
            conversation_id,
            "message_pinned",
            {"conversation_id": conversation_id, "message_id": message_id},
        )

        logger.info(
            f"Admin {admin_id} pinned message {message_id} in conversation {conversation_id}"
        )

        return {"message_id": message_id, "conversation_id": conversation_id}

    async def lock_room(
        self, conversation_id: str, owner_id: str, locked: bool
    ) -> Dict[str, Any]:
        """Lock/unlock room (only owner can post when locked)"""
        await self._verify_admin_permission(conversation_id, owner_id, require_owner=True)

        await self.db.conversations.update_one(
            {"_id": ObjectId(conversation_id)}, {"$set": {"locked": locked}}
        )

        action = AuditAction.LOCK_ROOM if locked else AuditAction.UNLOCK_ROOM
        await self._log_audit(conversation_id, owner_id, action)

        await manager.emit_to_room(
            conversation_id,
            "room_locked" if locked else "room_unlocked",
            {"conversation_id": conversation_id, "locked": locked},
        )

        logger.info(
            f"Owner {owner_id} {'locked' if locked else 'unlocked'} conversation {conversation_id}"
        )

        return {"conversation_id": conversation_id, "locked": locked}

    async def get_audit_log(
        self, conversation_id: str, admin_id: str, limit: int = 50, skip: int = 0
    ) -> List[Dict[str, Any]]:
        """Get audit log for a conversation"""
        await self._verify_admin_permission(conversation_id, admin_id)

        logs = (
            await self.db.room_audit_log.find({"conversation_id": conversation_id})
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
            .to_list(length=limit)
        )

        # Enrich with user data
        enriched_logs = []
        for log in logs:
            actor = await self.db.users.find_one({"_id": ObjectId(log["actor_id"])})
            target = None
            if log.get("target_id"):
                target = await self.db.users.find_one({"_id": ObjectId(log["target_id"])})

            # Build actor info
            actor_id = str(actor["_id"]) if actor else log["actor_id"]
            actor_name = actor.get("name", "Unknown") if actor else "Unknown"
            
            # Build target info
            target_info = None
            if target:
                target_id = str(target["_id"])
                target_name = target.get("name", "Unknown")
                target_info = {"id": target_id, "name": target_name}
            elif log.get("target_id"):
                target_info = {"id": log.get("target_id"), "name": None}

            enriched_logs.append(
                {
                    "id": str(log["_id"]),
                    "conversation_id": log["conversation_id"],
                    "action": log["action"],
                    "metadata": log.get("metadata", {}),
                    "created_at": log["created_at"],
                    "actor": {"id": actor_id, "name": actor_name},
                    "target": target_info,
                }
            )

        return enriched_logs
