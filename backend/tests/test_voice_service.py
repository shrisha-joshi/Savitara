"""
Unit Tests for Voice Service

Tests voice message functionality including:
- Upload URL generation (S3 + local)
- File size/MIME validation
- Voice message creation/deletion
- Storage usage calculation
- Media URL retrieval
"""
import pytest
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from datetime import datetime, timedelta, timezone
from bson import ObjectId

from app.services.voice_service import VoiceService
from app.models.database import Message, MessageType, User


class TestVoiceService:
    """Test suite for VoiceService"""

    @pytest.fixture
    def voice_service(self, test_db):
        """Create voice service instance"""
        return VoiceService(test_db)

    @pytest.fixture
    def mock_user_id(self):
        """Mock user ID"""
        return str(ObjectId())

    @pytest.fixture
    def mock_conversation_id(self):
        """Mock conversation ID"""
        return str(ObjectId())

    @pytest.mark.asyncio
    async def test_get_upload_url_s3_success(self, voice_service, mock_user_id):
        """Test successful S3 upload URL generation"""
        with patch('app.services.voice_service.boto3') as mock_boto3:
            # Mock S3 client
            mock_s3 = MagicMock()
            mock_boto3.client.return_value = mock_s3
            mock_s3.generate_presigned_url.return_value = "https://s3.amazonaws.com/bucket/key?signature=xxx"
            
            result = await voice_service.get_upload_url(
                user_id=mock_user_id,
                mime_type="audio/webm",
                file_size_bytes=1024000  # 1MB
            )
            
            assert result is not None
            assert "upload_url" in result
            assert "storage_key" in result
            assert "backend" in result
            assert result["backend"] == "s3"
            assert result["upload_url"].startswith("https://s3.amazonaws.com/")

    @pytest.mark.asyncio
    async def test_get_upload_url_file_too_large(self, voice_service, mock_user_id):
        """Test upload URL generation fails for files > 10MB"""
        with pytest.raises(ValueError, match="File size exceeds maximum"):
            await voice_service.get_upload_url(
                user_id=mock_user_id,
                mime_type="audio/webm",
                file_size_bytes=11 * 1024 * 1024  # 11MB
            )

    @pytest.mark.asyncio
    async def test_get_upload_url_invalid_mime_type(self, voice_service, mock_user_id):
        """Test upload URL generation fails for invalid MIME type"""
        with pytest.raises(ValueError, match="Invalid MIME type"):
            await voice_service.get_upload_url(
                user_id=mock_user_id,
                mime_type="application/pdf",  # Not audio
                file_size_bytes=1024000
            )

    @pytest.mark.asyncio
    async def test_get_upload_url_local_backend(self, voice_service, mock_user_id):
        """Test local storage upload URL generation"""
        with patch('app.core.config.settings') as mock_settings:
            mock_settings.STORAGE_BACKEND = "local"
            
            result = await voice_service.get_upload_url(
                user_id=mock_user_id,
                mime_type="audio/ogg",
                file_size_bytes=512000  # 512KB
            )
            
            assert result is not None
            assert "upload_token" in result
            assert "storage_key" in result
            assert "backend" in result
            assert result["backend"] == "local"

    @pytest.mark.asyncio
    async def test_create_voice_message_success(self, voice_service, mock_user_id, mock_conversation_id, test_db):
        """Test successful voice message creation"""
        # Create test user
        await test_db.users.insert_one({
            "_id": ObjectId(mock_user_id),
            "name": "Test User",
            "email": "test@example.com",
        })
        
        # Create test conversation
        await test_db.conversations.insert_one({
            "_id": ObjectId(mock_conversation_id),
            "participants": [ObjectId(mock_user_id)],
        })
        
        message = await voice_service.create_voice_message(
            user_id=mock_user_id,
            conversation_id=mock_conversation_id,
            storage_key="voice/123/456.ogg",
            duration_s=45,
            mime_type="audio/ogg",
            waveform=[0.1, 0.3, 0.5, 0.7, 0.5, 0.3, 0.1]
        )
        
        assert message is not None
        assert message.message_type == MessageType.VOICE
        assert message.media_url == "voice/123/456.ogg"
        assert message.media_duration_s == 45
        assert message.media_mime == "audio/ogg"
        assert message.media_waveform is not None
        assert len(message.media_waveform) == 7

    @pytest.mark.asyncio
    async def test_create_voice_message_invalid_conversation(self, voice_service, mock_user_id):
        """Test voice message creation fails for invalid conversation"""
        fake_conversation_id = str(ObjectId())
        
        with pytest.raises(ValueError, match="Conversation not found"):
            await voice_service.create_voice_message(
                user_id=mock_user_id,
                conversation_id=fake_conversation_id,
                storage_key="voice/123/456.ogg",
                duration_s=30,
                mime_type="audio/ogg"
            )

    @pytest.mark.asyncio
    async def test_create_voice_message_not_participant(self, voice_service, mock_user_id, test_db):
        """Test voice message creation fails if user not in conversation"""
        other_user_id = str(ObjectId())
        conversation_id = str(ObjectId())
        
        # Create conversation with different participant
        await test_db.conversations.insert_one({
            "_id": ObjectId(conversation_id),
            "participants": [ObjectId(other_user_id)],
        })
        
        with pytest.raises(ValueError, match="not a participant"):
            await voice_service.create_voice_message(
                user_id=mock_user_id,
                conversation_id=conversation_id,
                storage_key="voice/123/456.ogg",
                duration_s=30,
                mime_type="audio/ogg"
            )

    @pytest.mark.asyncio
    async def test_delete_voice_message_success(self, voice_service, mock_user_id, mock_conversation_id, test_db):
        """Test successful voice message deletion"""
        # Create user
        await test_db.users.insert_one({
            "_id": ObjectId(mock_user_id),
            "name": "Test User",
        })
        
        # Create conversation
        await test_db.conversations.insert_one({
            "_id": ObjectId(mock_conversation_id),
            "participants": [ObjectId(mock_user_id)],
        })
        
        # Create voice message
        message_id = str(ObjectId())
        await test_db.messages.insert_one({
            "_id": ObjectId(message_id),
            "conversation_id": ObjectId(mock_conversation_id),
            "sender_id": ObjectId(mock_user_id),
            "message_type": "voice",
            "media_url": "voice/123/456.ogg",
            "created_at": datetime.now(timezone.utc),
        })
        
        # Delete message
        result = await voice_service.delete_voice_message(
            message_id=message_id,
            user_id=mock_user_id
        )
        
        assert result is True
        
        # Verify soft delete
        deleted_message = await test_db.messages.find_one({"_id": ObjectId(message_id)})
        assert deleted_message is not None
        assert deleted_message.get("deleted_at") is not None

    @pytest.mark.asyncio
    async def test_delete_voice_message_not_sender(self, voice_service, mock_user_id, test_db):
        """Test voice message deletion fails if user is not sender"""
        other_user_id = str(ObjectId())
        conversation_id = str(ObjectId())
        message_id = str(ObjectId())
        
        # Create message sent by other user
        await test_db.messages.insert_one({
            "_id": ObjectId(message_id),
            "conversation_id": ObjectId(conversation_id),
            "sender_id": ObjectId(other_user_id),  # Different sender
            "message_type": "voice",
            "media_url": "voice/123/456.ogg",
            "created_at": datetime.now(timezone.utc),
        })
        
        with pytest.raises(ValueError, match="not authorized"):
            await voice_service.delete_voice_message(
                message_id=message_id,
                user_id=mock_user_id
            )

    @pytest.mark.asyncio
    async def test_get_media_url_s3(self, voice_service):
        """Test media URL retrieval for S3 backend"""
        with patch('app.services.voice_service.boto3') as mock_boto3:
            mock_s3 = MagicMock()
            mock_boto3.client.return_value = mock_s3
            mock_s3.generate_presigned_url.return_value = "https://s3.amazonaws.com/bucket/key?signature=xxx"
            
            url = await voice_service.get_media_url(
                storage_key="voice/123/456.ogg",
                backend="s3"
            )
            
            assert url.startswith("https://s3.amazonaws.com/")

    @pytest.mark.asyncio
    async def test_get_media_url_local(self, voice_service):
        """Test media URL retrieval for local backend"""
        url = await voice_service.get_media_url(
            storage_key="voice/123/456.ogg",
            backend="local"
        )
        
        assert "/api/v1/voice/media/" in url

    @pytest.mark.asyncio
    async def test_get_user_voice_storage_usage(self, voice_service, mock_user_id, test_db):
        """Test storage usage calculation"""
        # Create user
        await test_db.users.insert_one({
            "_id": ObjectId(mock_user_id),
            "name": "Test User",
        })
        
        # Create voice messages with different sizes
        conversation_id = str(ObjectId())
        await test_db.conversations.insert_one({
            "_id": ObjectId(conversation_id),
            "participants": [ObjectId(mock_user_id)],
        })
        
        # Message 1: 1MB
        await test_db.messages.insert_one({
            "_id": ObjectId(),
            "conversation_id": ObjectId(conversation_id),
            "sender_id": ObjectId(mock_user_id),
            "message_type": "voice",
            "media_url": "voice/1.ogg",
            "media_size_bytes": 1024000,
            "created_at": datetime.now(timezone.utc),
        })
        
        # Message 2: 2MB
        await test_db.messages.insert_one({
            "_id": ObjectId(),
            "conversation_id": ObjectId(conversation_id),
            "sender_id": ObjectId(mock_user_id),
            "message_type": "voice",
            "media_url": "voice/2.ogg",
            "media_size_bytes": 2048000,
            "created_at": datetime.now(timezone.utc),
        })
        
        usage = await voice_service.get_user_voice_storage_usage(mock_user_id)
        
        assert usage is not None
        assert usage["total_messages"] == 2
        assert usage["total_bytes"] == 3072000  # 3MB
        assert usage["total_mb"] == pytest.approx(3.0)

    @pytest.mark.asyncio
    async def test_validate_mime_type_valid_types(self, voice_service):
        """Test MIME type validation accepts valid audio types"""
        valid_types = [
            "audio/webm",
            "audio/ogg",
            "audio/mpeg",
            "audio/mp4",
            "audio/aac",
            "audio/wav",
        ]
        
        for mime_type in valid_types:
            # Should not raise
            voice_service._validate_mime_type(mime_type)

    @pytest.mark.asyncio  
    async def test_validate_mime_type_invalid_types(self, voice_service):
        """Test MIME type validation rejects non-audio types"""
        invalid_types = [
            "video/mp4",
            "image/jpeg",
            "application/pdf",
            "text/plain",
        ]
        
        for mime_type in invalid_types:
            with pytest.raises(ValueError, match="Invalid MIME type"):
                voice_service._validate_mime_type(mime_type)

    @pytest.mark.asyncio
    async def test_generate_storage_key(self, voice_service, mock_user_id):
        """Test storage key generation format"""
        storage_key = voice_service._generate_storage_key(
            user_id=mock_user_id,
            mime_type="audio/ogg"
        )
        
        assert storage_key.startswith(f"voice/{mock_user_id}/")
        assert storage_key.endswith(".ogg")
        assert len(storage_key.split("/")) == 3  # voice/user_id/filename.ext
