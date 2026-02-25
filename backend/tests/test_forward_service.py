"""
Unit Tests for Forwarding Service

Tests message forwarding functionality including:
- Privacy validation checks
- Max conversations limit enforcement
- Conversation membership validation
- Block status checking
- Forwarded message metadata preservation
"""
import pytest
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timezone
from bson import ObjectId

from app.services.forwarding_service import ForwardingService
from app.models.database import Message, MessageType


class TestForwardingService:
    """Test suite for ForwardingService"""

    @pytest.fixture
    def forwarding_service(self, test_db):
        """Create forwarding service instance"""
        return ForwardingService(test_db)

    @pytest.fixture
    async def setup_users_and_conversations(self, test_db):
        """Setup test users and conversations"""
        # Create users
        user1_id = str(ObjectId())
        user2_id = str(ObjectId())
        user3_id = str(ObjectId())
        
        await test_db.users.insert_many([
            {"_id": ObjectId(user1_id), "name": "User 1", "email": "user1@test.com"},
            {"_id": ObjectId(user2_id), "name": "User 2", "email": "user2@test.com"},
            {"_id": ObjectId(user3_id), "name": "User 3", "email": "user3@test.com"},
        ])
        
        # Create conversations
        conv1_id = str(ObjectId())
        conv2_id = str(ObjectId())
        
        await test_db.conversations.insert_many([
            {
                "_id": ObjectId(conv1_id),
                "participants": [ObjectId(user1_id), ObjectId(user2_id)],
                "room_type": "direct",
                "created_at": datetime.now(timezone.utc),
            },
            {
                "_id": ObjectId(conv2_id),
                "participants": [ObjectId(user1_id), ObjectId(user3_id)],
                "room_type": "direct",
                "created_at": datetime.now(timezone.utc),
            }
        ])
        
        # Create a message
        message_id = str(ObjectId())
        await test_db.messages.insert_one({
            "_id": ObjectId(message_id),
            "conversation_id": ObjectId(conv1_id),
            "sender_id": ObjectId(user1_id),
            "content": "Test message",
            "message_type": "text",
            "created_at": datetime.now(timezone.utc),
        })
        
        return {
            "user1_id": user1_id,
            "user2_id": user2_id,
            "user3_id": user3_id,
            "conv1_id": conv1_id,
            "conv2_id": conv2_id,
            "message_id": message_id,
        }

    @pytest.mark.asyncio
    async def test_forward_message_success(self, forwarding_service, setup_users_and_conversations):
        """Test successful message forwarding"""
        data = await setup_users_and_conversations
        
        result = await forwarding_service.forward_message(
            message_id=data["message_id"],
            sender_id=data["user1_id"],
            recipient_ids=[data["user3_id"]]
        )
        
        assert result is not None
        assert len(result["forwarded_messages"]) == 1
        assert result["success_count"] == 1
        assert result["failed_count"] == 0

    @pytest.mark.asyncio
    async def test_forward_message_max_recipients_exceeded(self, forwarding_service, setup_users_and_conversations, test_db):
        """Test forwarding fails when exceeding max recipients limit"""
        data = await setup_users_and_conversations
        
        # Create 51 users and conversations (exceeds max 50 limit)
        recipient_ids = []
        for i in range(51):
            user_id = str(ObjectId())
            recipient_ids.append(user_id)
            await test_db.users.insert_one({
                "_id": ObjectId(user_id),
                "name": f"User {i}",
                "email": f"user{i}@test.com",
            })
        
        with pytest.raises(ValueError, match="Maximum .* recipients"):
            await forwarding_service.forward_message(
                message_id=data["message_id"],
                sender_id=data["user1_id"],
                recipient_ids=recipient_ids
            )

    @pytest.mark.asyncio
    async def test_forward_message_not_participant(self, forwarding_service, setup_users_and_conversations):
        """Test forwarding fails if sender is not participant in source conversation"""
        data = await setup_users_and_conversations
        
        with pytest.raises(ValueError, match="not authorized|not a participant"):
            await forwarding_service.forward_message(
                message_id=data["message_id"],
                sender_id=data["user2_id"],  # User2 trying to forward from conv with user1
                recipient_ids=[data["user3_id"]]
            )

    @pytest.mark.asyncio
    async def test_forward_message_blocked_recipient(self, forwarding_service, setup_users_and_conversations, test_db):
        """Test forwarding fails for blocked recipients"""
        data = await setup_users_and_conversations
        
        # Create block relationship
        await test_db.user_blocks.insert_one({
            "_id": ObjectId(),
            "blocker_id": ObjectId(data["user3_id"]),
            "blocked_id": ObjectId(data["user1_id"]),
            "created_at": datetime.now(timezone.utc),
        })
        
        result = await forwarding_service.forward_message(
            message_id=data["message_id"],
            sender_id=data["user1_id"],
            recipient_ids=[data["user3_id"]]
        )
        
        # Should skip blocked recipient
        assert result["failed_count"] == 1
        assert len(result["failed_recipients"]) == 1

    @pytest.mark.asyncio
    async def test_forward_message_preserves_metadata(self, forwarding_service, setup_users_and_conversations, test_db):
        """Test forwarded message contains original metadata"""
        data = await setup_users_and_conversations
        
        result = await forwarding_service.forward_message(
            message_id=data["message_id"],
            sender_id=data["user1_id"],
            recipient_ids=[data["user3_id"]]
        )
        
        # Get the forwarded message
        forwarded_msg_id = result["forwarded_messages"][0]["message_id"]
        forwarded_msg = await test_db.messages.find_one({"_id": ObjectId(forwarded_msg_id)})
        
        assert forwarded_msg is not None
        assert forwarded_msg["message_type"] == "forwarded"
        assert "forwarded_from" in forwarded_msg
        assert forwarded_msg["forwarded_from"]["message_id"] == data["message_id"]
        assert forwarded_msg["forwarded_from"]["sender_name"] == "User 1"

    @pytest.mark.asyncio
    async def test_forward_to_conversation_success(self, forwarding_service, setup_users_and_conversations, test_db):
        """Test successful forwarding to group conversation"""
        data = await setup_users_and_conversations
        
        # Create a group conversation
        group_conv_id = str(ObjectId())
        await test_db.conversations.insert_one({
            "_id": ObjectId(group_conv_id),
            "participants": [ObjectId(data["user1_id"]), ObjectId(data["user2_id"]), ObjectId(data["user3_id"])],
            "room_type": "private_group",
            "name": "Test Group",
            "created_at": datetime.now(timezone.utc),
        })
        
        result = await forwarding_service.forward_message_to_conversation(
            message_id=data["message_id"],
            sender_id=data["user1_id"],
            conversation_id=group_conv_id
        )
        
        assert result is not None
        assert "message" in result
        assert result["message"]["conversation_id"] == group_conv_id

    @pytest.mark.asyncio
    async def test_forward_to_conversation_not_member(self, forwarding_service, setup_users_and_conversations, test_db):
        """Test forwarding to conversation fails if sender not a member"""
        data = await setup_users_and_conversations
        
        # Create conversation without sender
        group_conv_id = str(ObjectId())
        await test_db.conversations.insert_one({
            "_id": ObjectId(group_conv_id),
            "participants": [ObjectId(data["user2_id"]), ObjectId(data["user3_id"])],
            "room_type": "private_group",
            "created_at": datetime.now(timezone.utc),
        })
        
        with pytest.raises(ValueError, match="not a member"):
            await forwarding_service.forward_message_to_conversation(
                message_id=data["message_id"],
                sender_id=data["user1_id"],
                conversation_id=group_conv_id
            )

    @pytest.mark.asyncio
    async def test_forward_respects_allow_forward_out(self, forwarding_service, setup_users_and_conversations, test_db):
        """Test forwarding respects conversation's allow_forward_out setting"""
        data = await setup_users_and_conversations
        
        # Set allow_forward_out to false
        await test_db.conversations.update_one(
            {"_id": ObjectId(data["conv1_id"])},
            {"$set": {"allow_forward_out": False}}
        )
        
        with pytest.raises(ValueError, match="Forwarding not allowed|disabled"):
            await forwarding_service.forward_message(
                message_id=data["message_id"],
                sender_id=data["user1_id"],
                recipient_ids=[data["user3_id"]]
            )

    @pytest.mark.asyncio
    async def test_get_forward_count(self, forwarding_service, setup_users_and_conversations, test_db):
        """Test getting forward count for a message"""
        data = await setup_users_and_conversations
        
        # Forward message multiple times
        for _ in range(3):
            recipient_id = str(ObjectId())
            await test_db.users.insert_one({
                "_id": ObjectId(recipient_id),
                "name": "Recipient",
            })
            
            conv_id = str(ObjectId())
            await test_db.conversations.insert_one({
                "_id": ObjectId(conv_id),
                "participants": [ObjectId(data["user1_id"]), ObjectId(recipient_id)],
            })
            
            # Create forwarded message
            await test_db.messages.insert_one({
                "_id": ObjectId(),
                "conversation_id": ObjectId(conv_id),
                "sender_id": ObjectId(data["user1_id"]),
                "message_type": "forwarded",
                "forwarded_from": {"message_id": data["message_id"]},
                "created_at": datetime.now(timezone.utc),
            })
        
        count = await forwarding_service.get_forward_count(data["message_id"])
        
        assert count == 3

    @pytest.mark.asyncio
    async def test_create_or_get_conversation(self, forwarding_service, setup_users_and_conversations, test_db):
        """Test conversation creation or retrieval for 1-on-1"""
        data = await setup_users_and_conversations
        
        # First call should get existing conversation
        conv_id = await forwarding_service._get_or_create_conversation(
            user1_id=data["user1_id"],
            user2_id=data["user2_id"]
        )
        
        assert conv_id == data["conv1_id"]
        
        # Call with new user should create new conversation
        new_user_id = str(ObjectId())
        await test_db.users.insert_one({
            "_id": ObjectId(new_user_id),
            "name": "New User",
        })
        
        new_conv_id = await forwarding_service._get_or_create_conversation(
            user1_id=data["user1_id"],
            user2_id=new_user_id
        )
        
        assert new_conv_id is not None
        assert new_conv_id != data["conv1_id"]
        
        # Verify conversation was created
        new_conv = await test_db.conversations.find_one({"_id": ObjectId(new_conv_id)})
        assert new_conv is not None
        assert len(new_conv["participants"]) == 2

    @pytest.mark.asyncio
    async def test_verify_message_access(self, forwarding_service, setup_users_and_conversations):
        """Test message access verification"""
        data = await setup_users_and_conversations
        
        # User1 should have access (is participant)
        has_access = await forwarding_service._verify_message_access(
            message_id=data["message_id"],
            user_id=data["user1_id"]
        )
        assert has_access is True
        
        # User3 should not have access (not participant in conv1)
        has_access = await forwarding_service._verify_message_access(
            message_id=data["message_id"],
            user_id=data["user3_id"]
        )
        assert has_access is False

    @pytest.mark.asyncio
    async def test_check_blocked_recipients(self, forwarding_service, setup_users_and_conversations, test_db):
        """Test blocked recipients check"""
        data = await setup_users_and_conversations
        
        # Create blocks
        await test_db.user_blocks.insert_many([
            {
                "_id": ObjectId(),
                "blocker_id": ObjectId(data["user2_id"]),
                "blocked_id": ObjectId(data["user1_id"]),
                "created_at": datetime.now(timezone.utc),
            },
            {
                "_id": ObjectId(),
                "blocker_id": ObjectId(data["user1_id"]),
                "blocked_id": ObjectId(data["user3_id"]),
                "created_at": datetime.now(timezone.utc),
            }
        ])
        
        blocked = await forwarding_service._check_blocked_recipients(
            sender_id=data["user1_id"],
            recipient_ids=[data["user2_id"], data["user3_id"]]
        )
        
        # Both should be blocked (bidirectional check)
        assert data["user2_id"] in blocked
        assert data["user3_id"] in blocked
