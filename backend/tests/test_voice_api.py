"""
Integration Tests for Voice API Endpoints

Tests voice message API functionality including:
- Upload URL endpoint
- Voice message creation endpoint
- Voice message deletion endpoint
- Storage usage endpoint
- Media URL retrieval endpoint
"""
import pytest
from httpx import AsyncClient
from unittest.mock import patch, MagicMock
from bson import ObjectId
from datetime import datetime

from app.core.security import SecurityManager


class TestVoiceAPI:
    """Integration tests for voice message API endpoints"""

    @pytest.fixture
    async def authenticated_client(self, async_client, test_db, mock_user_data):
        """Create authenticated test client"""
        # Create test user
        user_id = str(ObjectId())
        await test_db.users.insert_one({
            "_id": ObjectId(user_id),
            "name": mock_user_data["name"],
            "email": mock_user_data["email"],
            "role": mock_user_data["role"],
        })
        
        # Generate JWT token
        token = SecurityManager.create_access_token(user_id=user_id, role=mock_user_data["role"])
        
        # Add auth header
        async_client.headers["Authorization"] = f"Bearer {token}"
        async_client.user_id = user_id
        
        return async_client

    @pytest.mark.asyncio
    async def test_get_upload_url_success(self, authenticated_client):
        """Test POST /voice/upload successful upload URL generation"""
        with patch('app.services.voice_service.boto3') as mock_boto3:
            mock_s3 = MagicMock()
            mock_boto3.client.return_value = mock_s3
            mock_s3.generate_presigned_url.return_value = "https://s3.amazonaws.com/bucket/key?sig=xxx"
            
            response = await authenticated_client.post(
                "/api/v1/voice/upload",
                json={
                    "mime_type": "audio/webm",
                    "file_size_bytes": 1024000  # 1MB
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "upload_url" in data["data"]
            assert "storage_key" in data["data"]
            assert "upload_token" in data["data"]

    @pytest.mark.asyncio
    async def test_get_upload_url_file_too_large(self, authenticated_client):
        """Test upload URL generation fails for files > 10MB"""
        response = await authenticated_client.post(
            "/api/v1/voice/upload",
            json={
                "mime_type": "audio/webm",
                "file_size_bytes": 11 * 1024 * 1024  # 11MB
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert "exceeds maximum" in data["message"].lower()

    @pytest.mark.asyncio
    async def test_get_upload_url_invalid_mime_type(self, authenticated_client):
        """Test upload URL generation fails for invalid MIME type"""
        response = await authenticated_client.post(
            "/api/v1/voice/upload",
            json={
                "mime_type": "video/mp4",  # Not audio
                "file_size_bytes": 1024000
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert "invalid mime type" in data["message"].lower()

    @pytest.mark.asyncio
    async def test_get_upload_url_unauthorized(self, async_client):
        """Test upload URL endpoint requires authentication"""
        response = await async_client.post(
            "/api/v1/voice/upload",
            json={
                "mime_type": "audio/webm",
                "file_size_bytes": 1024000
            }
        )
        
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_voice_message_success(self, authenticated_client, test_db):
        """Test POST /voice/messages successful voice message creation"""
        # Create conversation
        conversation_id = str(ObjectId())
        await test_db.conversations.insert_one({
            "_id": ObjectId(conversation_id),
            "participants": [ObjectId(authenticated_client.user_id)],
            "created_at": datetime.utcnow(),
        })
        
        response = await authenticated_client.post(
            "/api/v1/voice/messages",
            json={
                "conversation_id": conversation_id,
                "storage_key": f"voice/{authenticated_client.user_id}/test.ogg",
                "duration_s": 45,
                "mime_type": "audio/ogg",
                "waveform": [0.1, 0.3, 0.5, 0.7, 0.5, 0.3, 0.1]
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert "message" in data["data"]
        assert data["data"]["message"]["message_type"] == "voice"
        assert data["data"]["message"]["media_duration_s"] == 45

    @pytest.mark.asyncio
    async def test_create_voice_message_not_participant(self, authenticated_client, test_db):
        """Test voice message creation fails if user not in conversation"""
        other_user_id = str(ObjectId())
        conversation_id = str(ObjectId())
        
        # Create conversation with different participant
        await test_db.conversations.insert_one({
            "_id": ObjectId(conversation_id),
            "participants": [ObjectId(other_user_id)],
            "created_at": datetime.utcnow(),
        })
        
        response = await authenticated_client.post(
            "/api/v1/voice/messages",
            json={
                "conversation_id": conversation_id,
                "storage_key": "voice/test.ogg",
                "duration_s": 30,
                "mime_type": "audio/ogg"
            }
        )
        
        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_delete_voice_message_success(self, authenticated_client, test_db):
        """Test DELETE /voice/messages/{id} successful deletion"""
        # Create conversation
        conversation_id = str(ObjectId())
        await test_db.conversations.insert_one({
            "_id": ObjectId(conversation_id),
            "participants": [ObjectId(authenticated_client.user_id)],
        })
        
        # Create voice message
        message_id = str(ObjectId())
        await test_db.messages.insert_one({
            "_id": ObjectId(message_id),
            "conversation_id": ObjectId(conversation_id),
            "sender_id": ObjectId(authenticated_client.user_id),
            "message_type": "voice",
            "media_url": "voice/test.ogg",
            "created_at": datetime.utcnow(),
        })
        
        response = await authenticated_client.delete(f"/api/v1/voice/messages/{message_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        
        # Verify soft delete
        deleted_message = await test_db.messages.find_one({"_id": ObjectId(message_id)})
        assert deleted_message is not None
        assert deleted_message.get("deleted_at") is not None

    @pytest.mark.asyncio
    async def test_delete_voice_message_not_sender(self, authenticated_client, test_db):
        """Test voice message deletion fails if user is not sender"""
        other_user_id = str(ObjectId())
        conversation_id = str(ObjectId())
        message_id = str(ObjectId())
        
        # Create message sent by other user
        await test_db.messages.insert_one({
            "_id": ObjectId(message_id),
            "conversation_id": ObjectId(conversation_id),
            "sender_id": ObjectId(other_user_id),
            "message_type": "voice",
            "media_url": "voice/test.ogg",
            "created_at": datetime.utcnow(),
        })
        
        response = await authenticated_client.delete(f"/api/v1/voice/messages/{message_id}")
        
        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_get_storage_usage(self, authenticated_client, test_db):
        """Test GET /voice/storage-usage returns user storage stats"""
        # Create conversation
        conversation_id = str(ObjectId())
        await test_db.conversations.insert_one({
            "_id": ObjectId(conversation_id),
            "participants": [ObjectId(authenticated_client.user_id)],
        })
        
        # Create voice messages
        for i in range(3):
            await test_db.messages.insert_one({
                "_id": ObjectId(),
                "conversation_id": ObjectId(conversation_id),
                "sender_id": ObjectId(authenticated_client.user_id),
                "message_type": "voice",
                "media_url": f"voice/test_{i}.ogg",
                "media_size_bytes": 1024000 * (i + 1),  # 1MB, 2MB, 3MB
                "created_at": datetime.utcnow(),
            })
        
        response = await authenticated_client.get("/api/v1/voice/storage-usage")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["total_messages"] == 3
        assert data["data"]["total_bytes"] == 6144000  # 6MB
        assert data["data"]["total_mb"] == 6.0

    @pytest.mark.asyncio
    async def test_get_playback_url_success(self, authenticated_client, test_db):
        """Test GET /voice/playback-url/{id} returns media URL"""
        # Create conversation
        conversation_id = str(ObjectId())
        await test_db.conversations.insert_one({
            "_id": ObjectId(conversation_id),
            "participants": [ObjectId(authenticated_client.user_id)],
        })
        
        # Create voice message
        message_id = str(ObjectId())
        await test_db.messages.insert_one({
            "_id": ObjectId(message_id),
            "conversation_id": ObjectId(conversation_id),
            "sender_id": ObjectId(authenticated_client.user_id),
            "message_type": "voice",
            "media_url": "voice/test.ogg",
            "storage_backend": "local",
            "created_at": datetime.utcnow(),
        })
        
        response = await authenticated_client.get(f"/api/v1/voice/playback-url/{message_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "playback_url" in data["data"]

    @pytest.mark.asyncio
    async def test_get_playback_url_not_participant(self, authenticated_client, test_db):
        """Test playback URL retrieval fails if user not in conversation"""
        other_user_id = str(ObjectId())
        conversation_id = str(ObjectId())
        message_id = str(ObjectId())
        
        # Create conversation with different participant
        await test_db.conversations.insert_one({
            "_id": ObjectId(conversation_id),
            "participants": [ObjectId(other_user_id)],
        })
        
        # Create voice message
        await test_db.messages.insert_one({
            "_id": ObjectId(message_id),
            "conversation_id": ObjectId(conversation_id),
            "sender_id": ObjectId(other_user_id),
            "message_type": "voice",
            "media_url": "voice/test.ogg",
            "created_at": datetime.utcnow(),
        })
        
        response = await authenticated_client.get(f"/api/v1/voice/playback-url/{message_id}")
        
        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_local_upload_endpoint(self, authenticated_client, test_db):
        """Test POST /voice/upload/{token} for local storage"""
        # First get upload token
        with patch('app.core.config.settings') as mock_settings:
            mock_settings.STORAGE_BACKEND = "local"
            
            response = await authenticated_client.post(
                "/api/v1/voice/upload",
                json={
                    "mime_type": "audio/ogg",
                    "file_size_bytes": 512000
                }
            )
            
            assert response.status_code == 200
            upload_token = response.json()["data"]["upload_token"]
            
            # Upload file with token
            test_audio_data = b"fake audio data"
            files = {"file": ("test.ogg", test_audio_data, "audio/ogg")}
            
            upload_response = await authenticated_client.post(
                f"/api/v1/voice/upload/{upload_token}",
                files=files
            )
            
            assert upload_response.status_code == 200
            data = upload_response.json()
            assert data["success"] is True
            assert "storage_key" in data["data"]

    @pytest.mark.asyncio
    async def test_rate_limiting(self, authenticated_client):
        """Test rate limiting on upload endpoint"""
        # Make multiple rapid requests (assuming 5 per minute limit)
        responses = []
        
        for _ in range(7):  # Exceed limit
            response = await authenticated_client.post(
                "/api/v1/voice/upload",
                json={
                    "mime_type": "audio/webm",
                    "file_size_bytes": 1024000
                }
            )
            responses.append(response)
        
        # Last requests should be rate limited
        rate_limited = [r for r in responses if r.status_code == 429]
        assert len(rate_limited) >= 1  # At least one should be rate limited

    @pytest.mark.asyncio
    async def test_validation_errors(self, authenticated_client):
        """Test validation errors for malformed requests"""
        # Missing required fields
        response = await authenticated_client.post(
            "/api/v1/voice/upload",
            json={
                "mime_type": "audio/webm"
                # Missing file_size_bytes
            }
        )
        
        assert response.status_code == 422  # Validation error
        
        # Invalid field types
        response2 = await authenticated_client.post(
            "/api/v1/voice/upload",
            json={
                "mime_type": "audio/webm",
                "file_size_bytes": "not_a_number"
            }
        )
        
        assert response2.status_code == 422
