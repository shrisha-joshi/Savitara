"""
Tests for Conversation Settings Feature
Tests: ConversationSettingsService, Settings API endpoints
"""
import pytest
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.conversation_settings_service import ConversationSettingsService
from app.core.exceptions import NotFoundException, ForbiddenException


@pytest.fixture
def mock_db():
    """Mock MongoDB database"""
    db = MagicMock()
    db.conversation_user_settings = MagicMock()
    db.conversations = MagicMock()
    db.users = MagicMock()
    return db


@pytest.fixture
def settings_service(mock_db):
    """Conversation settings service instance"""
    return ConversationSettingsService(mock_db)


@pytest.fixture
def sample_conversation():
    """Sample conversation document"""
    user1 = ObjectId()
    user2 = ObjectId()
    return {
        "_id": ObjectId(),
        "participants": [user1, user2],
        "last_message_at": datetime.now(timezone.utc),
    }


@pytest.fixture
def sample_settings():
    """Sample conversation settings"""
    return {
        "_id": ObjectId(),
        "conversation_id": str(ObjectId()),
        "user_id": str(ObjectId()),
        "is_pinned": False,
        "pin_rank": None,
        "is_archived": False,
        "muted_until": None,
        "notifications_on": True,
        "last_read_at": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }


class TestConversationSettingsService:
    """Unit tests for ConversationSettingsService"""

    @pytest.mark.asyncio
    async def test_get_settings_existing(
        self, settings_service, mock_db, sample_conversation, sample_settings
    ):
        """Test getting existing settings"""
        conversation_id = str(sample_conversation["_id"])
        user_id = str(sample_conversation["participants"][0])

        mock_db.conversations.find_one = AsyncMock(return_value=sample_conversation)
        mock_db.conversation_user_settings.find_one = AsyncMock(
            return_value=sample_settings
        )

        result = await settings_service.get_settings(conversation_id, user_id)

        assert result["conversation_id"] == conversation_id
        assert result["user_id"] == user_id
        assert "is_pinned" in result
        assert "is_archived" in result

    @pytest.mark.asyncio
    async def test_get_settings_default(
        self, settings_service, mock_db, sample_conversation
    ):
        """Test getting default settings when none exist"""
        conversation_id = str(sample_conversation["_id"])
        user_id = str(sample_conversation["participants"][0])

        mock_db.conversations.find_one = AsyncMock(return_value=sample_conversation)
        mock_db.conversation_user_settings.find_one = AsyncMock(return_value=None)

        result = await settings_service.get_settings(conversation_id, user_id)

        # Should return defaults
        assert result["is_pinned"] is False
        assert result["is_archived"] is False
        assert result["notifications_on"] is True
        assert result["muted_until"] is None

    @pytest.mark.asyncio
    async def test_get_settings_conversation_not_found(
        self, settings_service, mock_db
    ):
        """Test getting settings for non-existent conversation"""
        conversation_id = str(ObjectId())
        user_id = str(ObjectId())

        mock_db.conversations.find_one = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc_info:
            await settings_service.get_settings(conversation_id, user_id)

        assert "Conversation not found" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_settings_user_not_participant(
        self, settings_service, mock_db, sample_conversation
    ):
        """Test getting settings when user is not a participant"""
        conversation_id = str(sample_conversation["_id"])
        user_id = str(ObjectId())  # Different user

        mock_db.conversations.find_one = AsyncMock(return_value=sample_conversation)

        with pytest.raises(ForbiddenException) as exc_info:
            await settings_service.get_settings(conversation_id, user_id)

        assert "not a participant" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_update_settings(
        self, settings_service, mock_db, sample_conversation
    ):
        """Test updating conversation settings"""
        conversation_id = str(sample_conversation["_id"])
        user_id = str(sample_conversation["participants"][0])

        updates = {"notifications_on": False, "is_archived": True}

        mock_db.conversations.find_one = AsyncMock(return_value=sample_conversation)
        mock_db.conversation_user_settings.update_one = AsyncMock()
        mock_db.conversation_user_settings.find_one = AsyncMock(
            return_value={**updates, "conversation_id": conversation_id, "user_id": user_id}
        )

        await settings_service.update_settings(
            conversation_id, user_id, updates
        )

        # Verify update was called
        assert mock_db.conversation_user_settings.update_one.called
        call_args = mock_db.conversation_user_settings.update_one.call_args
        assert call_args[1]["upsert"] is True
        assert "$set" in call_args[0][1]

    @pytest.mark.asyncio
    async def test_pin_conversation(
        self, settings_service, mock_db, sample_conversation
    ):
        """Test pinning a conversation"""
        conversation_id = str(sample_conversation["_id"])
        user_id = str(sample_conversation["participants"][0])

        # No existing pins
        mock_db.conversation_user_settings.find_one = AsyncMock(
            side_effect=[
                None,  # First call: check for max pin_rank
                {"is_pinned": True, "pin_rank": 0},  # Second call: return updated settings
            ]
        )
        mock_db.conversations.find_one = AsyncMock(return_value=sample_conversation)
        mock_db.conversation_user_settings.update_one = AsyncMock()
        mock_db.conversation_user_settings.update_many = AsyncMock()

        result = await settings_service.pin_conversation(conversation_id, user_id)

        # Should set pin_rank to 0
        assert result["is_pinned"] is True
        assert result["pin_rank"] == 0

    @pytest.mark.asyncio
    async def test_pin_conversation_increments_existing(
        self, settings_service, mock_db, sample_conversation
    ):
        """Test pinning when other pins exist (should increment their ranks)"""
        conversation_id = str(sample_conversation["_id"])
        user_id = str(sample_conversation["participants"][0])

        # Existing pin with rank 0
        existing_pin = {"pin_rank": 0, "is_pinned": True}

        mock_db.conversation_user_settings.find_one = AsyncMock(
            side_effect=[
                existing_pin,  # First call: get max pin_rank
                {"is_pinned": True, "pin_rank": 0},  # Second call: return new settings
            ]
        )
        mock_db.conversations.find_one = AsyncMock(return_value=sample_conversation)
        mock_db.conversation_user_settings.update_many = AsyncMock()
        mock_db.conversation_user_settings.update_one = AsyncMock()

        await settings_service.pin_conversation(conversation_id, user_id)

        # Should have incremented existing pins
        assert mock_db.conversation_user_settings.update_many.called
        increment_call = mock_db.conversation_user_settings.update_many.call_args
        assert "$inc" in increment_call[0][1]

    @pytest.mark.asyncio
    async def test_unpin_conversation(
        self, settings_service, mock_db, sample_conversation
    ):
        """Test unpinning a conversation"""
        conversation_id = str(sample_conversation["_id"])
        user_id = str(sample_conversation["participants"][0])

        mock_db.conversations.find_one = AsyncMock(return_value=sample_conversation)
        mock_db.conversation_user_settings.update_one = AsyncMock()
        mock_db.conversation_user_settings.find_one = AsyncMock(
            return_value={"is_pinned": False, "pin_rank": None}
        )

        result = await settings_service.unpin_conversation(conversation_id, user_id)

        assert result["is_pinned"] is False
        assert result["pin_rank"] is None

    @pytest.mark.asyncio
    async def test_archive_conversation(
        self, settings_service, mock_db, sample_conversation
    ):
        """Test archiving a conversation"""
        conversation_id = str(sample_conversation["_id"])
        user_id = str(sample_conversation["participants"][0])

        mock_db.conversations.find_one = AsyncMock(return_value=sample_conversation)
        mock_db.conversation_user_settings.update_one = AsyncMock()
        mock_db.conversation_user_settings.find_one = AsyncMock(
            return_value={"is_archived": True}
        )

        result = await settings_service.archive_conversation(conversation_id, user_id)

        assert result["is_archived"] is True

    @pytest.mark.asyncio
    async def test_unarchive_conversation(
        self, settings_service, mock_db, sample_conversation
    ):
        """Test unarchiving a conversation"""
        conversation_id = str(sample_conversation["_id"])
        user_id = str(sample_conversation["participants"][0])

        mock_db.conversations.find_one = AsyncMock(return_value=sample_conversation)
        mock_db.conversation_user_settings.update_one = AsyncMock()
        mock_db.conversation_user_settings.find_one = AsyncMock(
            return_value={"is_archived": False}
        )

        result = await settings_service.unarchive_conversation(
            conversation_id, user_id
        )

        assert result["is_archived"] is False

    @pytest.mark.asyncio
    async def test_mute_conversation(
        self, settings_service, mock_db, sample_conversation
    ):
        """Test muting a conversation"""
        conversation_id = str(sample_conversation["_id"])
        user_id = str(sample_conversation["participants"][0])
        mute_until = datetime.now(timezone.utc) + timedelta(hours=1)

        mock_db.conversations.find_one = AsyncMock(return_value=sample_conversation)
        mock_db.conversation_user_settings.update_one = AsyncMock()
        mock_db.conversation_user_settings.find_one = AsyncMock(
            return_value={"muted_until": mute_until}
        )

        result = await settings_service.mute_conversation(
            conversation_id, user_id, mute_until
        )

        assert result["muted_until"] == mute_until

    @pytest.mark.asyncio
    async def test_mute_conversation_indefinite(
        self, settings_service, mock_db, sample_conversation
    ):
        """Test muting indefinitely (muted_until = None)"""
        conversation_id = str(sample_conversation["_id"])
        user_id = str(sample_conversation["participants"][0])

        mock_db.conversations.find_one = AsyncMock(return_value=sample_conversation)
        mock_db.conversation_user_settings.update_one = AsyncMock()
        mock_db.conversation_user_settings.find_one = AsyncMock(
            return_value={"muted_until": None}
        )

        result = await settings_service.mute_conversation(
            conversation_id, user_id, None
        )

        assert result["muted_until"] is None

    @pytest.mark.asyncio
    async def test_unmute_conversation(
        self, settings_service, mock_db, sample_conversation
    ):
        """Test unmuting a conversation"""
        conversation_id = str(sample_conversation["_id"])
        user_id = str(sample_conversation["participants"][0])

        mock_db.conversations.find_one = AsyncMock(return_value=sample_conversation)
        mock_db.conversation_user_settings.update_one = AsyncMock()
        mock_db.conversation_user_settings.find_one = AsyncMock(
            return_value={"muted_until": None}
        )

        result = await settings_service.unmute_conversation(conversation_id, user_id)

        assert result["muted_until"] is None

    @pytest.mark.asyncio
    async def test_mark_as_read(
        self, settings_service, mock_db, sample_conversation
    ):
        """Test marking conversation as read"""
        conversation_id = str(sample_conversation["_id"])
        user_id = str(sample_conversation["participants"][0])

        mock_db.conversations.find_one = AsyncMock(return_value=sample_conversation)
        mock_db.conversation_user_settings.update_one = AsyncMock()
        
        now = datetime.now(timezone.utc)
        mock_db.conversation_user_settings.find_one = AsyncMock(
            return_value={"last_read_at": now}
        )

        result = await settings_service.mark_as_read(conversation_id, user_id)

        assert result["last_read_at"] is not None

    def test_get_mute_durations(self, settings_service):
        """Test mute duration constants"""
        durations = settings_service.get_mute_durations()

        assert "1_hour" in durations
        assert "8_hours" in durations
        assert "24_hours" in durations
        assert "1_week" in durations
        assert "indefinite" in durations

        assert durations["1_hour"] == 3600
        assert durations["8_hours"] == 8 * 3600
        assert durations["24_hours"] == 24 * 3600
        assert durations["1_week"] == 7 * 24 * 3600
        assert durations["indefinite"] is None

    def test_calculate_mute_until(self, settings_service):
        """Test calculating mute_until timestamp"""
        # 1 hour from now
        result = settings_service.calculate_mute_until("1_hour")
        assert result is not None
        expected = datetime.now(timezone.utc) + timedelta(hours=1)
        # Allow 1 second tolerance
        assert abs((result - expected).total_seconds()) < 1

        # Indefinite
        result = settings_service.calculate_mute_until("indefinite")
        assert result is None


class TestConversationSettingsAPI:
    """Integration tests for Conversation Settings API endpoints"""

    @pytest.mark.asyncio
    async def test_get_settings_endpoint_requires_auth(self, client):
        """Test that get settings requires authentication"""
        conversation_id = str(ObjectId())
        response = await client.get(
            f"/api/v1/conversations/{conversation_id}/settings"
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_update_settings_endpoint(self, client, auth_headers):
        """Test update settings endpoint"""
        conversation_id = str(ObjectId())
        response = await client.patch(
            f"/api/v1/conversations/{conversation_id}/settings",
            json={"notifications_on": False},
            headers=auth_headers,
        )
        # Should return 404 if conversation not found
        assert response.status_code in [200, 404]

    @pytest.mark.asyncio
    async def test_pin_endpoint(self, client, auth_headers):
        """Test pin conversation endpoint"""
        conversation_id = str(ObjectId())
        response = await client.post(
            f"/api/v1/conversations/{conversation_id}/pin",
            headers=auth_headers,
        )
        assert response.status_code in [200, 404]

    @pytest.mark.asyncio
    async def test_archive_endpoint(self, client, auth_headers):
        """Test archive conversation endpoint"""
        conversation_id = str(ObjectId())
        response = await client.post(
            f"/api/v1/conversations/{conversation_id}/archive",
            headers=auth_headers,
        )
        assert response.status_code in [200, 404]

    @pytest.mark.asyncio
    async def test_mute_endpoint_validates_duration(self, client, auth_headers):
        """Test mute endpoint validates duration"""
        conversation_id = str(ObjectId())
        response = await client.post(
            f"/api/v1/conversations/{conversation_id}/mute",
            json={"duration": "invalid_duration"},
            headers=auth_headers,
        )
        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_mute_endpoint_valid_durations(self, client, auth_headers):
        """Test mute endpoint with valid durations"""
        conversation_id = str(ObjectId())
        
        valid_durations = ["1_hour", "8_hours", "24_hours", "1_week", "indefinite"]
        
        for duration in valid_durations:
            response = await client.post(
                f"/api/v1/conversations/{conversation_id}/mute",
                json={"duration": duration},
                headers=auth_headers,
            )
            # Should accept the request (may return 404 if conv doesn't exist)
            assert response.status_code in [200, 404], f"Failed for duration: {duration}"
