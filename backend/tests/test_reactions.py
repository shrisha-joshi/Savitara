"""
Tests for Message Reactions Feature
Tests: ReactionsService, Reactions API endpoints, WebSocket events
"""
import pytest
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import HTTPException
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.reactions_service import ReactionsService
from app.core.exceptions import (
    ResourceNotFoundError as NotFoundException,
    PermissionDeniedError as ForbiddenException,
    SavitaraException as BadRequestException,
)


@pytest.fixture
def mock_db():
    """Mock MongoDB database"""
    db = MagicMock()
    db.messages = MagicMock()
    db.conversations = MagicMock()
    db.blocked_users = MagicMock()
    return db


@pytest.fixture
def reactions_service(mock_db):
    """Reactions service instance with mocked DB"""
    return ReactionsService(mock_db)


@pytest.fixture
def sample_message():
    """Sample message document"""
    return {
        "_id": ObjectId(),
        "conversation_id": ObjectId(),
        "sender_id": ObjectId(),
        "receiver_id": ObjectId(),
        "content": "Test message",
        "reactions": [],
        "created_at": datetime.now(timezone.utc),
    }


@pytest.fixture
def sample_conversation():
    """Sample conversation document"""
    sender_id = ObjectId()
    receiver_id = ObjectId()
    return {
        "_id": ObjectId(),
        "participants": [sender_id, receiver_id],
        "last_message_at": datetime.now(timezone.utc),
    }


class TestReactionsService:
    """Unit tests for ReactionsService"""

    @pytest.mark.asyncio
    async def test_add_reaction_success(
        self, reactions_service, mock_db, sample_message, sample_conversation
    ):
        """Test successfully adding a reaction"""
        message_id = str(sample_message["_id"])
        user_id = str(sample_message["receiver_id"])
        emoji = "👍"

        # Mock database responses
        mock_db.messages.find_one = AsyncMock(return_value=sample_message)
        mock_db.conversations.find_one = AsyncMock(return_value=sample_conversation)
        mock_db.blocked_users.find_one = AsyncMock(return_value=None)
        mock_db.messages.update_one = AsyncMock(
            return_value=MagicMock(modified_count=1)
        )

        # Mock WebSocket manager
        with patch("app.services.reactions_service.manager") as mock_manager:
            mock_manager.send_personal_message = AsyncMock()

            result = await reactions_service.add_reaction(message_id, user_id, emoji)

            # Verify reaction was added
            assert mock_db.messages.update_one.called
            call_args = mock_db.messages.update_one.call_args
            assert call_args[0][0] == {"_id": ObjectId(message_id)}
            assert "$push" in call_args[0][1]

            # Verify result is a list of summaries
            assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_add_reaction_invalid_emoji(
        self, reactions_service, mock_db, sample_message
    ):
        """Test adding a reaction with invalid emoji"""
        message_id = str(sample_message["_id"])
        user_id = str(sample_message["receiver_id"])
        invalid_emoji = "INVALID"

        with pytest.raises(BadRequestException) as exc_info:
            await reactions_service.add_reaction(message_id, user_id, invalid_emoji)

        assert "Invalid emoji" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_add_reaction_message_not_found(
        self, reactions_service, mock_db
    ):
        """Test adding reaction to non-existent message"""
        message_id = str(ObjectId())
        user_id = str(ObjectId())
        emoji = "😀"

        mock_db.messages.find_one = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc_info:
            await reactions_service.add_reaction(message_id, user_id, emoji)

        assert "Message not found" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_add_reaction_user_blocked(
        self, reactions_service, mock_db, sample_message, sample_conversation
    ):
        """Test adding reaction when user is blocked"""
        message_id = str(sample_message["_id"])
        user_id = str(sample_message["receiver_id"])
        emoji = "😀"

        mock_db.messages.find_one = AsyncMock(return_value=sample_message)
        mock_db.conversations.find_one = AsyncMock(return_value=sample_conversation)
        # User is blocked
        mock_db.blocked_users.find_one = AsyncMock(
            return_value={"blocker_id": ObjectId(), "blocked_user_id": ObjectId()}
        )

        with pytest.raises(ForbiddenException) as exc_info:
            await reactions_service.add_reaction(message_id, user_id, emoji)

        assert "blocked" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_add_reaction_no_access_to_conversation(
        self, reactions_service, mock_db, sample_message
    ):
        """Test adding reaction when user is not in conversation"""
        message_id = str(sample_message["_id"])
        user_id = str(ObjectId())  # Different user not in participants
        emoji = "😀"

        conversation_without_user = {
            "_id": sample_message["conversation_id"],
            "participants": [ObjectId(), ObjectId()],
        }

        mock_db.messages.find_one = AsyncMock(return_value=sample_message)
        mock_db.conversations.find_one = AsyncMock(
            return_value=conversation_without_user
        )

        with pytest.raises(ForbiddenException) as exc_info:
            await reactions_service.add_reaction(message_id, user_id, emoji)

        assert "access" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_add_reaction_idempotent(
        self, reactions_service, mock_db, sample_message, sample_conversation
    ):
        """Test that adding the same reaction twice is idempotent"""
        message_id = str(sample_message["_id"])
        user_id = str(sample_message["receiver_id"])
        emoji = "👍"

        # Message already has this reaction
        sample_message["reactions"] = [
            {
                "user_id": ObjectId(user_id),
                "emoji": emoji,
                "created_at": datetime.now(timezone.utc),
            }
        ]

        mock_db.messages.find_one = AsyncMock(return_value=sample_message)
        mock_db.conversations.find_one = AsyncMock(return_value=sample_conversation)
        mock_db.blocked_users.find_one = AsyncMock(return_value=None)
        mock_db.messages.update_one = AsyncMock()

        with patch("app.services.reactions_service.manager"):
            result = await reactions_service.add_reaction(message_id, user_id, emoji)

            # Should not call update_one since reaction already exists
            assert not mock_db.messages.update_one.called
            assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_remove_reaction_success(
        self, reactions_service, mock_db, sample_message
    ):
        """Test successfully removing a reaction"""
        message_id = str(sample_message["_id"])
        user_id = str(sample_message["receiver_id"])
        emoji = "👍"

        sample_message["reactions"] = [
            {
                "user_id": ObjectId(user_id),
                "emoji": emoji,
                "created_at": datetime.now(timezone.utc),
            }
        ]

        mock_db.messages.find_one = AsyncMock(return_value=sample_message)
        mock_db.messages.update_one = AsyncMock(
            return_value=MagicMock(modified_count=1)
        )

        with patch("app.services.reactions_service.manager") as mock_manager:
            mock_manager.send_personal_message = AsyncMock()

            result = await reactions_service.remove_reaction(message_id, user_id, emoji)

            # Verify $pull was called
            assert mock_db.messages.update_one.called
            call_args = mock_db.messages.update_one.call_args
            assert "$pull" in call_args[0][1]

            assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_remove_reaction_not_exists(
        self, reactions_service, mock_db, sample_message
    ):
        """Test removing a reaction that doesn't exist (no-op)"""
        message_id = str(sample_message["_id"])
        user_id = str(sample_message["receiver_id"])
        emoji = "👍"

        # No reactions on message
        sample_message["reactions"] = []

        mock_db.messages.find_one = AsyncMock(return_value=sample_message)
        mock_db.messages.update_one = AsyncMock(
            return_value=MagicMock(modified_count=0)
        )

        with patch("app.services.reactions_service.manager"):
            result = await reactions_service.remove_reaction(message_id, user_id, emoji)

            # Should still return successfully (no-op)
            assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_get_reactions_summary(
        self, reactions_service, mock_db, sample_message
    ):
        """Test getting aggregated reaction summary"""
        message_id = str(sample_message["_id"])
        user_id = str(sample_message["receiver_id"])

        # Add multiple reactions
        user1 = ObjectId()
        user2 = ObjectId(user_id)
        user3 = ObjectId()

        sample_message["reactions"] = [
            {"user_id": user1, "emoji": "👍", "created_at": datetime.now(timezone.utc)},
            {"user_id": user2, "emoji": "👍", "created_at": datetime.now(timezone.utc)},
            {"user_id": user3, "emoji": "❤️", "created_at": datetime.now(timezone.utc)},
        ]

        mock_db.messages.find_one = AsyncMock(return_value=sample_message)

        result = await reactions_service.get_reactions_summary(message_id, user_id)

        # Should return aggregated summary
        assert len(result) == 2  # Two different emojis
        
        # Find thumbs up reaction
        thumbs_up = next((r for r in result if r["emoji"] == "👍"), None)
        assert thumbs_up is not None
        assert thumbs_up["count"] == 2
        assert thumbs_up["reacted_by_me"] is True  # user_id reacted with 👍

        # Find heart reaction
        heart = next((r for r in result if r["emoji"] == "❤️"), None)
        assert heart is not None
        assert heart["count"] == 1
        assert heart["reacted_by_me"] is False  # user_id didn't react with ❤️

    @pytest.mark.asyncio
    async def test_get_reactions_summary_empty(
        self, reactions_service, mock_db, sample_message
    ):
        """Test getting summary for message with no reactions"""
        message_id = str(sample_message["_id"])
        user_id = str(sample_message["receiver_id"])

        sample_message["reactions"] = []

        mock_db.messages.find_one = AsyncMock(return_value=sample_message)

        result = await reactions_service.get_reactions_summary(message_id, user_id)

        assert result == []


class TestReactionsAPI:
    """Integration tests for Reactions API endpoints"""

    @pytest.mark.asyncio
    async def test_add_reaction_endpoint_requires_auth(self, client):
        """Test that add reaction endpoint requires authentication"""
        message_id = str(ObjectId())
        response = await client.post(
            f"/api/v1/messages/{message_id}/reactions",
            json={"emoji": "👍"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_add_reaction_endpoint_validates_emoji(
        self, client, auth_headers
    ):
        """Test that endpoint validates emoji"""
        message_id = str(ObjectId())
        response = await client.post(
            f"/api/v1/messages/{message_id}/reactions",
            json={"emoji": "invalid"},
            headers=auth_headers,
        )
        assert response.status_code == 400
        data = response.json()
        assert "emoji" in data.get("detail", "").lower()

    @pytest.mark.asyncio
    async def test_remove_reaction_endpoint(self, client, auth_headers):
        """Test remove reaction endpoint"""
        message_id = str(ObjectId())
        emoji = "👍"
        
        # Should return 404 if message not found
        response = await client.delete(
            f"/api/v1/messages/{message_id}/reactions/{emoji}",
            headers=auth_headers,
        )
        # Depending on implementation, could be 404 or 200 (no-op)
        assert response.status_code in [200, 404]

    @pytest.mark.asyncio
    async def test_get_reactions_endpoint(self, client, auth_headers):
        """Test get reactions summary endpoint"""
        message_id = str(ObjectId())
        
        response = await client.get(
            f"/api/v1/messages/{message_id}/reactions",
            headers=auth_headers,
        )
        # Should return 404 if message not found
        assert response.status_code in [200, 404]


@pytest.fixture
def sample_emoji_list():
    """Sample list of allowed emojis for testing"""
    return ["😀", "😃", "😄", "😁", "👍", "👎", "❤️", "🔥", "💯"]


def test_emoji_whitelist_validation():
    """Test emoji whitelist validation"""
    from app.utils.emoji_whitelist import is_valid_emoji, ALLOWED_EMOJIS

    # Valid emojis
    assert is_valid_emoji("😀")
    assert is_valid_emoji("👍")
    assert is_valid_emoji("❤️")

    # Invalid emojis
    assert not is_valid_emoji("invalid")
    assert not is_valid_emoji("")
    assert not is_valid_emoji("abc")

    # Whitelist should have 200 emojis
    assert len(ALLOWED_EMOJIS) == 200
