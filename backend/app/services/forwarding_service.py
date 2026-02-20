"""
Message Forwarding Service

Handles message forwarding with proper authorization, context preservation,
and real-time notifications.

Features:
- Forward messages to multiple recipients
- Preserve original message context (sender, room name)
- Support forwarding of all message types (text, voice, media)
- Real-time WebSocket notifications
- Conversation auto-creation for new recipients
- Permission validation
"""

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.connection import get_database
from app.models.database import (
    Message,
    MessageType,
    ForwardedMessageInfo,
    Conversation,
    User,
)
from app.core.exceptions import SavitaraException


class ForwardingService:
    """Service for handling message forwarding operations"""

    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None):
        """Initialize with optional database override (for testing)"""
        self.db = db or get_database()

    async def forward_message(
        self,
        message_id: str,
        sender_id: str,
        recipient_ids: List[str],
        include_original_context: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Forward a message to one or more recipients
        
        Args:
            message_id: ID of the original message to forward
            sender_id: ID of the user performing the forward
            recipient_ids: List of user IDs to forward the message to
            include_original_context: Whether to include sender name and room info
            
        Returns:
            List of created forwarded messages
            
        Raises:
            SavitaraException: If message not found, sender lacks permission,
                             or recipient validation fails
        """
        # Validate and retrieve original message
        original_msg = await self._get_message(message_id)
        if not original_msg:
            raise SavitaraException(
                status_code=404,
                message="Original message not found",
                error_code="MESSAGE_NOT_FOUND"
            )

        # Check if sender has access to the original message
        await self._verify_message_access(original_msg, sender_id)

        # Validate all recipients exist
        recipients = await self._validate_recipients(recipient_ids)
        if len(recipients) != len(recipient_ids):
            raise SavitaraException(
                status_code=400,
                message="One or more recipients not found",
                error_code="INVALID_RECIPIENTS"
            )

        # Check if sender is blocked by any recipient
        blocked_by = await self._check_blocked_recipients(sender_id, recipient_ids)
        if blocked_by:
            raise SavitaraException(
                status_code=403,
                message=f"You are blocked by {len(blocked_by)} recipient(s)",
                error_code="SENDER_BLOCKED"
            )

        # Build forwarding context
        forward_context = await self._build_forward_context(
            original_msg,
            include_original_context
        )

        # Create forwarded messages for each recipient
        forwarded_messages = []
        for recipient_id in recipient_ids:
            # Get or create conversation with recipient
            conversation = await self._get_or_create_conversation(
                sender_id,
                recipient_id
            )

            # Create forwarded message
            forwarded_msg = await self._create_forwarded_message(
                original_msg=original_msg,
                sender_id=sender_id,
                recipient_id=recipient_id,
                conversation_id=str(conversation["_id"]),
                forward_context=forward_context,
            )

            forwarded_messages.append(forwarded_msg)

        return forwarded_messages

    async def forward_message_to_conversation(
        self,
        message_id: str,
        sender_id: str,
        conversation_id: str,
        include_original_context: bool = True,
    ) -> Dict[str, Any]:
        """
        Forward a message to an existing conversation (e.g., group chat)
        
        Args:
            message_id: ID of the original message
            sender_id: ID of the user forwarding
            conversation_id: Target conversation ID
            include_original_context: Whether to include original sender info
            
        Returns:
            Created forwarded message
            
        Raises:
            SavitaraException: If validation fails
        """
        # Validate original message
        original_msg = await self._get_message(message_id)
        if not original_msg:
            raise SavitaraException(
                status_code=404,
                message="Original message not found",
                error_code="MESSAGE_NOT_FOUND"
            )

        # Check sender access to original message
        await self._verify_message_access(original_msg, sender_id)

        # Validate target conversation and membership
        conversation = await self.db.conversations.find_one({
            "_id": ObjectId(conversation_id)
        })
        if not conversation:
            raise SavitaraException(
                status_code=404,
                message="Target conversation not found",
                error_code="CONVERSATION_NOT_FOUND"
            )

        # Check if sender is a participant in target conversation
        sender_oid = ObjectId(sender_id)
        if sender_oid not in conversation["participants"]:
            raise SavitaraException(
                status_code=403,
                message="You are not a member of this conversation",
                error_code="NOT_CONVERSATION_MEMBER"
            )

        # Build forward context
        forward_context = await self._build_forward_context(
            original_msg,
            include_original_context
        )

        # Create forwarded message (receiver_id is None for group chats)
        forwarded_msg = await self._create_forwarded_message(
            original_msg=original_msg,
            sender_id=sender_id,
            recipient_id=None,  # Group chat has no single receiver
            conversation_id=conversation_id,
            forward_context=forward_context,
        )

        return forwarded_msg

    async def _get_message(self, message_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a message by ID"""
        try:
            return await self.db.messages.find_one({
                "_id": ObjectId(message_id),
                "deleted_at": None  # Don't allow forwarding deleted messages
            })
        except Exception:
            return None

    async def _verify_message_access(
        self,
        message: Dict[str, Any],
        user_id: str
    ) -> None:
        """
        Verify user has access to the message
        
        Checks:
        - User is sender or receiver in 1-on-1 chat
        - User is participant in group conversation
        - Message is not from a private/blocked conversation
        """
        user_oid = ObjectId(user_id)

        # Check if user is sender or receiver
        is_sender = message["sender_id"] == user_oid
        is_receiver = message.get("receiver_id") == user_oid

        if is_sender or is_receiver:
            return  # Direct access

        # Check if user is participant in the conversation
        if message.get("conversation_id"):
            conversation = await self.db.conversations.find_one({
                "_id": message["conversation_id"]
            })
            if conversation and user_oid in conversation.get("participants", []):
                return  # Member of group conversation

        # No access
        raise SavitaraException(
            status_code=403,
            message="You don't have permission to forward this message",
            error_code="MESSAGE_ACCESS_DENIED"
        )

    async def _validate_recipients(
        self,
        recipient_ids: List[str]
    ) -> List[Dict[str, Any]]:
        """Validate that all recipient IDs exist and are active users"""
        recipient_oids = [ObjectId(rid) for rid in recipient_ids]
        recipients = await self.db.users.find({
            "_id": {"$in": recipient_oids},
            "is_active": True  # Only forward to active users
        }).to_list(length=len(recipient_ids))

        return recipients

    async def _check_blocked_recipients(
        self,
        sender_id: str,
        recipient_ids: List[str]
    ) -> List[str]:
        """
        Check if sender is blocked by any recipient
        
        Returns:
            List of recipient IDs who have blocked the sender
        """
        sender_oid = ObjectId(sender_id)
        recipient_oids = [ObjectId(rid) for rid in recipient_ids]

        # Query users who have blocked the sender
        blocked_users = await self.db.users.find({
            "_id": {"$in": recipient_oids},
            "blocked_users": sender_oid
        }).to_list(length=len(recipient_ids))

        return [str(user["_id"]) for user in blocked_users]

    async def _get_or_create_conversation(
        self,
        sender_id: str,
        recipient_id: str
    ) -> Dict[str, Any]:
        """Get existing conversation or create new one for forwarding"""
        sender_oid = ObjectId(sender_id)
        recipient_oid = ObjectId(recipient_id)

        # Try to find existing conversation
        conversation = await self.db.conversations.find_one({
            "participants": {"$all": [sender_oid, recipient_oid], "$size": 2},
        })

        if conversation:
            return conversation

        # Create new conversation
        new_conversation = {
            "participants": [sender_oid, recipient_oid],
            "is_open_chat": False,
            "last_message_at": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc),
        }

        result = await self.db.conversations.insert_one(new_conversation)
        new_conversation["_id"] = result.inserted_id

        return new_conversation

    async def _build_forward_context(
        self,
        original_msg: Dict[str, Any],
        include_context: bool
    ) -> Optional[ForwardedMessageInfo]:
        """Build forwarding context with original sender info"""
        if not include_context:
            return None

        # Get original sender name
        sender = await self.db.users.find_one({
            "_id": original_msg["sender_id"]
        })
        sender_name = sender.get("name", "Unknown User") if sender else "Unknown User"

        # Get room name if from a group conversation
        room_name = None
        if original_msg.get("conversation_id"):
            conversation = await self.db.conversations.find_one({
                "_id": original_msg["conversation_id"]
            })
            if conversation:
                # Use conversation name if available, otherwise generate one
                room_name = conversation.get("name", "Group Chat")

        return ForwardedMessageInfo(
            message_id=original_msg["_id"],
            sender_name=sender_name,
            room_name=room_name,
        )

    async def _create_forwarded_message(
        self,
        original_msg: Dict[str, Any],
        sender_id: str,
        recipient_id: Optional[str],
        conversation_id: str,
        forward_context: Optional[ForwardedMessageInfo],
    ) -> Dict[str, Any]:
        """Create a forwarded message in the database"""
        now = datetime.now(timezone.utc)

        # Build forwarded message document
        forwarded_msg_data = {
            "conversation_id": ObjectId(conversation_id),
            "sender_id": ObjectId(sender_id),
            "receiver_id": ObjectId(recipient_id) if recipient_id else None,
            "content": original_msg["content"],
            "message_type": MessageType.FORWARDED,
            "is_open_chat": False,
            "read": False,
            "created_at": now,
            
            # Copy media fields if present
            "media_url": original_msg.get("media_url"),
            "media_mime": original_msg.get("media_mime"),
            "media_duration_s": original_msg.get("media_duration_s"),
            "media_waveform": original_msg.get("media_waveform"),
            
            # Add forwarding context
            "forwarded_from": forward_context.model_dump() if forward_context else None,
        }

        # Insert message
        result = await self.db.messages.insert_one(forwarded_msg_data)
        forwarded_msg_data["_id"] = result.inserted_id

        # Update conversation's last_message_at
        await self.db.conversations.update_one(
            {"_id": ObjectId(conversation_id)},
            {
                "$set": {"last_message_at": now},
            }
        )

        return forwarded_msg_data

    async def get_forward_count(self, message_id: str) -> int:
        """
        Get the number of times a message has been forwarded
        
        Args:
            message_id: Original message ID
            
        Returns:
            Count of forwarded instances
        """
        try:
            count = await self.db.messages.count_documents({
                "forwarded_from.message_id": ObjectId(message_id),
                "deleted_at": None
            })
            return count
        except Exception:
            return 0
