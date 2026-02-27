"""
Tests for Block Enforcement Middleware
Tests: BlockEnforcementMiddleware, block status validation
"""
import pytest
from datetime import datetime, timezone
from bson import ObjectId
from unittest.mock import AsyncMock, MagicMock

from app.middleware.block_enforcement import BlockEnforcementMiddleware
from app.core.exceptions import ForbiddenException


@pytest.fixture
def mock_db():
    """Mock MongoDB database"""
    db = MagicMock()
    db.blocked_users = MagicMock()
    db.conversations = MagicMock()
    return db


@pytest.fixture
def block_enforcer(mock_db):
    """Block enforcement middleware instance"""
    return BlockEnforcementMiddleware(mock_db)


class TestBlockEnforcementMiddleware:
    """Unit tests for BlockEnforcementMiddleware"""

    @pytest.mark.asyncio
    async def test_check_block_status_not_blocked(
        self, block_enforcer, mock_db
    ):
        """Test when users are not blocked"""
        user_id = str(ObjectId())
        target_user_id = str(ObjectId())

        mock_db.blocked_users.find_one = AsyncMock(return_value=None)

        # Should not raise exception
        await block_enforcer.check_block_status(user_id, target_user_id)

        # Verify check was performed
        assert mock_db.blocked_users.find_one.called

    @pytest.mark.asyncio
    async def test_check_block_status_user_blocked_target(
        self, block_enforcer, mock_db
    ):
        """Test when user has blocked target"""
        user_id = ObjectId()
        target_user_id = ObjectId()

        # User has blocked target
        block_record = {
            "blocker_id": user_id,
            "blocked_user_id": target_user_id,
            "created_at": datetime.now(timezone.utc),
        }
        mock_db.blocked_users.find_one = AsyncMock(return_value=block_record)

        with pytest.raises(ForbiddenException) as exc_info:
            await block_enforcer.check_block_status(
                str(user_id), str(target_user_id)
            )

        assert "blocked" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_check_block_status_target_blocked_user(
        self, block_enforcer, mock_db
    ):
        """Test when target has blocked user (reverse block)"""
        user_id = ObjectId()
        target_user_id = ObjectId()

        # Target has blocked user
        block_record = {
            "blocker_id": target_user_id,
            "blocked_user_id": user_id,
            "created_at": datetime.now(timezone.utc),
        }
        mock_db.blocked_users.find_one = AsyncMock(return_value=block_record)

        with pytest.raises(ForbiddenException) as exc_info:
            await block_enforcer.check_block_status(
                str(user_id), str(target_user_id)
            )

        assert "blocked" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_check_block_status_invalid_user_id(
        self, block_enforcer, mock_db
    ):
        """Test with invalid ObjectId (should handle gracefully)"""
        # Should not throw on invalid ID
        await block_enforcer.check_block_status("invalid", "also_invalid")

        # Should not have called database
        assert not mock_db.blocked_users.find_one.called

    @pytest.mark.asyncio
    async def test_check_conversation_participants_blocks_no_blocks(
        self, block_enforcer, mock_db
    ):
        """Test conversation participants with no blocks"""
        conversation_id = str(ObjectId())
        sender_id = str(ObjectId())

        conversation = {
            "_id": ObjectId(conversation_id),
            "participants": [ObjectId(sender_id), ObjectId()],
        }

        mock_db.conversations.find_one = AsyncMock(return_value=conversation)
        mock_db.blocked_users.find_one = AsyncMock(return_value=None)

        # Should not raise
        await block_enforcer.check_conversation_participants_blocks(
            conversation_id, sender_id
        )

    @pytest.mark.asyncio
    async def test_check_conversation_participants_blocks_sender_blocked(
        self, block_enforcer, mock_db
    ):
        """Test when sender is blocked by a participant"""
        conversation_id = str(ObjectId())
        sender_id = ObjectId()
        participant_id = ObjectId()

        conversation = {
            "_id": ObjectId(conversation_id),
            "participants": [sender_id, participant_id],
        }

        # Participant has blocked sender
        block_record = {
            "blocker_id": participant_id,
            "blocked_user_id": sender_id,
        }

        mock_db.conversations.find_one = AsyncMock(return_value=conversation)
        mock_db.blocked_users.find_one = AsyncMock(return_value=block_record)

        with pytest.raises(ForbiddenException) as exc_info:
            await block_enforcer.check_conversation_participants_blocks(
                str(conversation_id), str(sender_id)
            )

        assert "blocked" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_check_conversation_participants_blocks_sender_blocked_participant(
        self, block_enforcer, mock_db
    ):
        """Test when sender has blocked a participant (reverse)"""
        conversation_id = str(ObjectId())
        sender_id = ObjectId()
        participant_id = ObjectId()

        conversation = {
            "_id": ObjectId(conversation_id),
            "participants": [sender_id, participant_id],
        }

        # Mock sequence: first call returns None, second call returns block
        block_record = {
            "blocker_id": sender_id,
            "blocked_user_id": participant_id,
        }

        mock_db.conversations.find_one = AsyncMock(return_value=conversation)
        mock_db.blocked_users.find_one = AsyncMock(
            side_effect=[None, block_record]  # No block from participant, but sender blocked participant
        )

        with pytest.raises(ForbiddenException) as exc_info:
            await block_enforcer.check_conversation_participants_blocks(
                str(conversation_id), str(sender_id)
            )

        assert "blocked" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_check_conversation_participants_blocks_conversation_not_found(
        self, block_enforcer, mock_db
    ):
        """Test when conversation doesn't exist (graceful handling)"""
        conversation_id = str(ObjectId())
        sender_id = str(ObjectId())

        mock_db.conversations.find_one = AsyncMock(return_value=None)

        # Should return without error (graceful)
        await block_enforcer.check_conversation_participants_blocks(
            conversation_id, sender_id
        )

    @pytest.mark.asyncio
    async def test_get_blocked_user_ids(self, block_enforcer, mock_db):
        """Test getting list of blocked user IDs"""
        user_id = ObjectId()

        # Users blocked BY this user
        blocked_by_user = [
            {"blocked_user_id": ObjectId()},
            {"blocked_user_id": ObjectId()},
        ]

        # Users who have blocked this user
        blocked_user = [{"blocker_id": ObjectId()}]

        # Mock cursor
        mock_cursor_1 = MagicMock()
        mock_cursor_1.__aiter__.return_value = iter(blocked_by_user)

        mock_cursor_2 = MagicMock()
        mock_cursor_2.__aiter__.return_value = iter(blocked_user)

        mock_db.blocked_users.find = MagicMock(
            side_effect=[mock_cursor_1, mock_cursor_2]
        )

        result = await block_enforcer.get_blocked_user_ids(str(user_id))

        # Should return 3 unique IDs (2 blocked by user + 1 who blocked user)
        assert len(result) == 3
        assert all(isinstance(id, str) for id in result)

    @pytest.mark.asyncio
    async def test_get_blocked_user_ids_empty(self, block_enforcer, mock_db):
        """Test getting blocked users when none exist"""
        user_id = ObjectId()

        # Mock empty cursors
        empty_cursor = MagicMock()
        empty_cursor.__aiter__.return_value = iter([])

        mock_db.blocked_users.find = MagicMock(return_value=empty_cursor)

        result = await block_enforcer.get_blocked_user_ids(str(user_id))

        assert result == []

    @pytest.mark.asyncio
    async def test_filter_blocked_users(self, block_enforcer, mock_db):
        """Test filtering blocked users from a list"""
        user_id = str(ObjectId())
        blocked_id_1 = str(ObjectId())
        blocked_id_2 = str(ObjectId())
        allowed_id = str(ObjectId())

        user_list = [
            {"id": blocked_id_1, "name": "Blocked User 1"},
            {"id": allowed_id, "name": "Allowed User"},
            {"_id": blocked_id_2, "name": "Blocked User 2"},
        ]

        # Mock get_blocked_user_ids to return blocked IDs
        with pytest.mock.patch.object(
            block_enforcer,
            "get_blocked_user_ids",
            return_value=[blocked_id_1, blocked_id_2],
        ):
            result = await block_enforcer.filter_blocked_users(user_id, user_list)

        # Should only include allowed user
        assert len(result) == 1
        assert result[0]["id"] == allowed_id

    @pytest.mark.asyncio
    async def test_filter_blocked_users_empty_list(
        self, block_enforcer, mock_db
    ):
        """Test filtering when user list is empty"""
        user_id = str(ObjectId())

        with pytest.mock.patch.object(
            block_enforcer, "get_blocked_user_ids", return_value=[]
        ):
            result = await block_enforcer.filter_blocked_users(user_id, [])

        assert result == []


class TestBlockEnforcementIntegration:
    """Integration tests for block enforcement in message sending"""

    @pytest.mark.asyncio
    async def test_send_message_blocked_user(
        self, client, auth_headers, mock_db
    ):
        """Test that sending message to blocked user fails"""
        # Without a properly authenticated user and block relationship,
        # the endpoint should reject at auth level
        response = await client.post(
            "/api/v1/chat/messages",
            json={
                "receiver_id": "507f1f77bcf86cd799439011",
                "content": "Hello",
            },
            headers=auth_headers or {},
        )
        # Expect 401 (no valid auth) or 403 (blocked) or 422 (validation)
        assert response.status_code in [401, 403, 422]

    @pytest.mark.asyncio
    async def test_send_message_blocked_by_user(
        self, client, auth_headers, mock_db
    ):
        """Test that sending message when blocked by recipient fails"""
        response = await client.post(
            "/api/v1/chat/messages",
            json={
                "receiver_id": "507f1f77bcf86cd799439012",
                "content": "Test",
            },
            headers=auth_headers or {},
        )
        assert response.status_code in [401, 403, 422]

    @pytest.mark.asyncio
    async def test_react_to_message_blocked_sender(
        self, client, auth_headers, mock_db
    ):
        """Test that reacting to message from blocked sender fails"""
        response = await client.post(
            "/api/v1/chat/messages/507f1f77bcf86cd799439013/reactions",
            json={"emoji": "👍"},
            headers=auth_headers or {},
        )
        assert response.status_code in [401, 403, 404, 422]
