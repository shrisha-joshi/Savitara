"""
Integration Tests for Forwarding API Endpoints

Tests message forwarding API functionality including:
- Forward to users endpoint
- Forward to conversation endpoint
- Forward count endpoint
- Privacy and permission checks
- Block enforcement
"""
import pytest
from httpx import AsyncClient
from bson import ObjectId
from datetime import datetime

from app.core.security import SecurityManager


class TestForwardingAPI:
    """Integration tests for message forwarding API endpoints"""

    @pytest.fixture
    async def authenticated_client(self, async_client, test_db):
        """Create authenticated test client"""
        # Create test user
        user_id = str(ObjectId())
        await test_db.users.insert_one({
            "_id": ObjectId(user_id),
            "name": "Test User",
            "email": "test@example.com",
            "role": "grihasta",
        })
        
        # Generate JWT token
        token = SecurityManager.create_access_token(user_id=user_id, role="grihasta")
        
        # Add auth header
        async_client.headers["Authorization"] = f"Bearer {token}"
        async_client.user_id = user_id
        
        return async_client

    @pytest.fixture
    async def setup_forward_test_data(self, test_db, authenticated_client):
        """Setup test data for forwarding tests"""
        # Create recipient users
        recipient1_id = str(ObjectId())
        recipient2_id = str(ObjectId())
        
        await test_db.users.insert_many([
            {"_id": ObjectId(recipient1_id), "name": "Recipient 1", "email": "r1@test.com"},
            {"_id": ObjectId(recipient2_id), "name": "Recipient 2", "email": "r2@test.com"},
        ])
        
        # Create source conversation
        source_conv_id = str(ObjectId())
        await test_db.conversations.insert_one({
            "_id": ObjectId(source_conv_id),
            "participants": [ObjectId(authenticated_client.user_id), ObjectId(recipient1_id)],
            "room_type": "direct",
            "created_at": datetime.utcnow(),
        })
        
        # Create message to forward
        message_id = str(ObjectId())
        await test_db.messages.insert_one({
            "_id": ObjectId(message_id),
            "conversation_id": ObjectId(source_conv_id),
            "sender_id": ObjectId(authenticated_client.user_id),
            "content": "Message to forward",
            "message_type": "text",
            "created_at": datetime.utcnow(),
        })
        
        # Create target conversation
        target_conv_id = str(ObjectId())
        await test_db.conversations.insert_one({
            "_id": ObjectId(target_conv_id),
            "participants": [ObjectId(authenticated_client.user_id), ObjectId(recipient2_id)],
            "room_type": "direct",
            "created_at": datetime.utcnow(),
        })
        
        return {
            "message_id": message_id,
            "recipient1_id": recipient1_id,
            "recipient2_id": recipient2_id,
            "source_conv_id": source_conv_id,
            "target_conv_id": target_conv_id,
        }

    @pytest.mark.asyncio
    async def test_forward_to_users_success(self, authenticated_client, setup_forward_test_data):
        """Test POST /messages/{id}/forward successful forwarding to users"""
        data = await setup_forward_test_data
        
        response = await authenticated_client.post(
            f"/api/v1/messages/{data['message_id']}/forward",
            json={
                "recipient_ids": [data["recipient1_id"], data["recipient2_id"]]
            }
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        assert result["data"]["success_count"] == 2
        assert result["data"]["failed_count"] == 0
        assert len(result["data"]["forwarded_messages"]) == 2

    @pytest.mark.asyncio
    async def test_forward_to_users_unauthorized(self, async_client, setup_forward_test_data):
        """Test forward endpoint requires authentication"""
        data = await setup_forward_test_data
        
        response = await async_client.post(
            f"/api/v1/messages/{data['message_id']}/forward",
            json={
                "recipient_ids": [data["recipient1_id"]]
            }
        )
        
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_forward_to_users_max_recipients_limit(self, authenticated_client, setup_forward_test_data, test_db):
        """Test forwarding fails when exceeding max recipients"""
        data = await setup_forward_test_data
        
        # Create 51 recipients
        recipient_ids = []
        for i in range(51):
            recipient_id = str(ObjectId())
            recipient_ids.append(recipient_id)
            await test_db.users.insert_one({
                "_id": ObjectId(recipient_id),
                "name": f"Recipient {i}",
            })
        
        response = await authenticated_client.post(
            f"/api/v1/messages/{data['message_id']}/forward",
            json={
                "recipient_ids": recipient_ids
            }
        )
        
        assert response.status_code == 400
        result = response.json()
        assert result["success"] is False
        assert "maximum" in result["message"].lower() or "limit" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_forward_to_users_not_participant(self, authenticated_client, test_db):
        """Test forwarding fails if user not participant in source conversation"""
        # Create message in conversation where user is not a participant
        other_user_id = str(ObjectId())
        conv_id = str(ObjectId())
        message_id = str(ObjectId())
        
        await test_db.users.insert_one({
            "_id": ObjectId(other_user_id),
            "name": "Other User",
        })
        
        await test_db.conversations.insert_one({
            "_id": ObjectId(conv_id),
            "participants": [ObjectId(other_user_id)],
        })
        
        await test_db.messages.insert_one({
            "_id": ObjectId(message_id),
            "conversation_id": ObjectId(conv_id),
            "sender_id": ObjectId(other_user_id),
            "content": "Message",
            "message_type": "text",
            "created_at": datetime.utcnow(),
        })
        
        response = await authenticated_client.post(
            f"/api/v1/messages/{message_id}/forward",
            json={
                "recipient_ids": [other_user_id]
            }
        )
        
        assert response.status_code == 403
        result = response.json()
        assert result["success"] is False

    @pytest.mark.asyncio
    async def test_forward_to_users_with_blocks(self, authenticated_client, setup_forward_test_data, test_db):
        """Test forwarding skips blocked recipients"""
        data = await setup_forward_test_data
        
        # Create block
        await test_db.user_blocks.insert_one({
            "_id": ObjectId(),
            "blocker_id": ObjectId(data["recipient2_id"]),
            "blocked_id": ObjectId(authenticated_client.user_id),
            "created_at": datetime.utcnow(),
        })
        
        response = await authenticated_client.post(
            f"/api/v1/messages/{data['message_id']}/forward",
            json={
                "recipient_ids": [data["recipient1_id"], data["recipient2_id"]]
            }
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["data"]["success_count"] == 1  # Only recipient1
        assert result["data"]["failed_count"] == 1  # recipient2 blocked
        assert len(result["data"]["failed_recipients"]) == 1

    @pytest.mark.asyncio
    async def test_forward_to_conversation_success(self, authenticated_client, setup_forward_test_data, test_db):
        """Test POST /messages/{id}/forward/conversation successful forwarding"""
        data = await setup_forward_test_data
        
        # Create group conversation
        group_conv_id = str(ObjectId())
        await test_db.conversations.insert_one({
            "_id": ObjectId(group_conv_id),
            "participants": [
                ObjectId(authenticated_client.user_id),
                ObjectId(data["recipient1_id"]),
                ObjectId(data["recipient2_id"])
            ],
            "room_type": "private_group",
            "name": "Test Group",
            "created_at": datetime.utcnow(),
        })
        
        response = await authenticated_client.post(
            f"/api/v1/messages/{data['message_id']}/forward/conversation",
            json={
                "conversation_id": group_conv_id
            }
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        assert "message" in result["data"]
        assert result["data"]["message"]["conversation_id"] == group_conv_id
        assert result["data"]["message"]["message_type"] == "forwarded"

    @pytest.mark.asyncio
    async def test_forward_to_conversation_not_member(self, authenticated_client, setup_forward_test_data, test_db):
        """Test forwarding to conversation fails if user not a member"""
        data = await setup_forward_test_data
        
        # Create conversation without authenticated user
        group_conv_id = str(ObjectId())
        await test_db.conversations.insert_one({
            "_id": ObjectId(group_conv_id),
            "participants": [ObjectId(data["recipient1_id"]), ObjectId(data["recipient2_id"])],
            "room_type": "private_group",
            "created_at": datetime.utcnow(),
        })
        
        response = await authenticated_client.post(
            f"/api/v1/messages/{data['message_id']}/forward/conversation",
            json={
                "conversation_id": group_conv_id
            }
        )
        
        assert response.status_code == 403
        result = response.json()
        assert result["success"] is False

    @pytest.mark.asyncio
    async def test_forward_respects_allow_forward_out(self, authenticated_client, setup_forward_test_data, test_db):
        """Test forwarding respects allow_forward_out setting"""
        data = await setup_forward_test_data
        
        # Disable forwarding on source conversation
        await test_db.conversations.update_one(
            {"_id": ObjectId(data["source_conv_id"])},
            {"$set": {"allow_forward_out": False}}
        )
        
        response = await authenticated_client.post(
            f"/api/v1/messages/{data['message_id']}/forward",
            json={
                "recipient_ids": [data["recipient1_id"]]
            }
        )
        
        assert response.status_code == 403
        result = response.json()
        assert result["success"] is False
        assert "not allowed" in result["message"].lower() or "disabled" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_get_forward_count(self, authenticated_client, setup_forward_test_data, test_db):
        """Test GET /messages/{id}/forward-count returns correct count"""
        data = await setup_forward_test_data
        
        # Create some forwarded messages
        for i in range(3):
            recipient_id = str(ObjectId())
            await test_db.users.insert_one({
                "_id": ObjectId(recipient_id),
                "name": f"Recipient {i}",
            })
            
            conv_id = str(ObjectId())
            await test_db.conversations.insert_one({
                "_id": ObjectId(conv_id),
                "participants": [ObjectId(authenticated_client.user_id), ObjectId(recipient_id)],
            })
            
            await test_db.messages.insert_one({
                "_id": ObjectId(),
                "conversation_id": ObjectId(conv_id),
                "sender_id": ObjectId(authenticated_client.user_id),
                "message_type": "forwarded",
                "forwarded_from": {"message_id": data["message_id"]},
                "created_at": datetime.utcnow(),
            })
        
        response = await authenticated_client.get(
            f"/api/v1/messages/{data['message_id']}/forward-count"
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        assert result["data"]["forward_count"] == 3
        assert result["data"]["message_id"] == data["message_id"]

    @pytest.mark.asyncio
    async def test_forward_preserves_metadata(self, authenticated_client, setup_forward_test_data, test_db):
        """Test forwarded message preserves original metadata"""
        data = await setup_forward_test_data
        
        response = await authenticated_client.post(
            f"/api/v1/messages/{data['message_id']}/forward",
            json={
                "recipient_ids": [data["recipient1_id"]]
            }
        )
        
        assert response.status_code == 200
        result = response.json()
        
        # Get forwarded message from database
        forwarded_msg_id = result["data"]["forwarded_messages"][0]["message_id"]
        forwarded_msg = await test_db.messages.find_one({"_id": ObjectId(forwarded_msg_id)})
        
        assert forwarded_msg is not None
        assert forwarded_msg["message_type"] == "forwarded"
        assert "forwarded_from" in forwarded_msg
        assert forwarded_msg["forwarded_from"]["message_id"] == data["message_id"]
        assert forwarded_msg["forwarded_from"]["sender_name"] is not None
        assert forwarded_msg["content"] == "Message to forward"

    @pytest.mark.asyncio
    async def test_forward_validation_errors(self, authenticated_client, setup_forward_test_data):
        """Test validation errors for malformed requests"""
        data = await setup_forward_test_data
        
        # Missing recipient_ids
        response = await authenticated_client.post(
            f"/api/v1/messages/{data['message_id']}/forward",
            json={}
        )
        assert response.status_code == 422
        
        # Empty recipient_ids list
        response2 = await authenticated_client.post(
            f"/api/v1/messages/{data['message_id']}/forward",
            json={"recipient_ids": []}
        )
        assert response2.status_code == 400
        
        # Invalid message ID format
        response3 = await authenticated_client.post(
            "/api/v1/messages/invalid_id/forward",
            json={"recipient_ids": [data["recipient1_id"]]}
        )
        assert response3.status_code in [400, 404]

    @pytest.mark.asyncio
    async def test_forward_nonexistent_message(self, authenticated_client):
        """Test forwarding nonexistent message returns 404"""
        fake_message_id = str(ObjectId())
        fake_recipient_id = str(ObjectId())
        
        response = await authenticated_client.post(
            f"/api/v1/messages/{fake_message_id}/forward",
            json={"recipient_ids": [fake_recipient_id]}
        )
        
        assert response.status_code == 404
        result = response.json()
        assert result["success"] is False

    @pytest.mark.asyncio
    async def test_forward_creates_conversations(self, authenticated_client, setup_forward_test_data, test_db):
        """Test forwarding creates new conversations for new recipients"""
        data = await setup_forward_test_data
        
        # Create new user without existing conversation
        new_recipient_id = str(ObjectId())
        await test_db.users.insert_one({
            "_id": ObjectId(new_recipient_id),
            "name": "New Recipient",
        })
        
        response = await authenticated_client.post(
            f"/api/v1/messages/{data['message_id']}/forward",
            json={"recipient_ids": [new_recipient_id]}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["data"]["success_count"] == 1
        
        # Verify new conversation was created
        new_conv = await test_db.conversations.find_one({
            "participants": {
                "$all": [ObjectId(authenticated_client.user_id), ObjectId(new_recipient_id)]
            },
            "$expr": {"$eq": [{"$size": "$participants"}, 2]}
        })
        
        assert new_conv is not None
