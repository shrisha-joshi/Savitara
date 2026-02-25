"""
Unit Tests for BlockService
Tests the business logic for user blocking functionality
"""
import pytest
from datetime import datetime, timezone
from bson import ObjectId
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.block_service import BlockService
from app.core.exceptions import InvalidInputError, ResourceNotFoundError


@pytest.fixture
def mock_db():
    """Create mock database"""
    db = MagicMock()
    db.users = AsyncMock()
    db.blocked_users = AsyncMock()
    return db


@pytest.fixture
def block_service(mock_db):
    """Create BlockService instance with mock database"""
    return BlockService(mock_db)


class TestBlockUser:
    """Tests for block_user method"""

    @pytest.mark.asyncio
    async def test_block_user_success(self, block_service, mock_db):
        """Test successfully blocking a user"""
        blocker_id = str(ObjectId())
        blocked_id = str(ObjectId())

        # Mock user exists
        mock_db.users.find_one.return_value = {
            "_id": ObjectId(blocked_id),
            "email": "blocked@test.com",
            "role": "grihasta",
        }

        # Mock no existing block
        mock_db.blocked_users.find_one.side_effect = [None, None]  # existing block, reverse block

        # Mock insert result
        inserted_id = ObjectId()
        mock_db.blocked_users.insert_one.return_value = AsyncMock(inserted_id=inserted_id)

        with patch('app.services.block_service.manager.emit_to_user', new_callable=AsyncMock):
            result = await block_service.block_user(
                blocker_id=blocker_id,
                blocked_user_id=blocked_id,
                reason="spam"
            )

        assert result.blocker_id == blocker_id
        assert result.blocked_user_id == blocked_id
        assert result.reason == "spam"
        assert result.is_mutual is False
        assert mock_db.blocked_users.insert_one.called

    @pytest.mark.asyncio
    async def test_block_user_already_blocked(self, block_service, mock_db):
        """Test blocking user that's already blocked (idempotent)"""
        blocker_id = str(ObjectId())
        blocked_id = str(ObjectId())

        # Mock user exists
        mock_db.users.find_one.return_value = {"_id": ObjectId(blocked_id)}

        # Mock existing block
        existing_block = {
            "_id": str(ObjectId()),
            "blocker_id": blocker_id,
            "blocked_user_id": blocked_id,
            "reason": "harassment",
            "is_mutual": False,
            "created_at": datetime.now(timezone.utc),
        }
        mock_db.blocked_users.find_one.return_value = existing_block

        result = await block_service.block_user(blocker_id, blocked_id)

        # Should return existing block without creating new one
        assert result.blocker_id == blocker_id
        assert not mock_db.blocked_users.insert_one.called

    @pytest.mark.asyncio
    async def test_block_user_mutual_block(self, block_service, mock_db):
        """Test creating mutual block when reverse block exists"""
        blocker_id = str(ObjectId())
        blocked_id = str(ObjectId())

        # Mock user exists
        mock_db.users.find_one.return_value = {"_id": ObjectId(blocked_id)}

        # Mock no existing block, but reverse block exists
        reverse_block = {
            "_id": str(ObjectId()),
            "blocker_id": blocked_id,
            "blocked_user_id": blocker_id,
            "is_mutual": False,
        }
        mock_db.blocked_users.find_one.side_effect = [None, reverse_block]

        # Mock insert and update
        mock_db.blocked_users.insert_one.return_value = AsyncMock(inserted_id=ObjectId())
        mock_db.blocked_users.update_one.return_value = AsyncMock()

        with patch('app.services.block_service.manager.emit_to_user', new_callable=AsyncMock):
            result = await block_service.block_user(blocker_id, blocked_id)

        # Should create mutual block
        assert result.is_mutual is True
        # Should update reverse block to mutual
        mock_db.blocked_users.update_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_cannot_block_self(self, block_service):
        """Test that users cannot block themselves"""
        user_id = str(ObjectId())

        with pytest.raises(InvalidInputError) as exc_info:
            await block_service.block_user(user_id, user_id)

        assert "Cannot block yourself" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_block_nonexistent_user(self, block_service, mock_db):
        """Test blocking a user that doesn't exist"""
        blocker_id = str(ObjectId())
        blocked_id = str(ObjectId())

        # Mock user doesn't exist
        mock_db.users.find_one.return_value = None

        with pytest.raises(ResourceNotFoundError) as exc_info:
            await block_service.block_user(blocker_id, blocked_id)

        assert blocked_id in str(exc_info.value)


class TestUnblockUser:
    """Tests for unblock_user method"""

    @pytest.mark.asyncio
    async def test_unblock_user_success(self, block_service, mock_db):
        """Test successfully unblocking a user"""
        blocker_id = str(ObjectId())
        blocked_id = str(ObjectId())

        # Mock delete result
        mock_db.blocked_users.delete_one.return_value = AsyncMock(deleted_count=1)

        # Mock reverse block check
        mock_db.blocked_users.find_one.return_value = None

        with patch('app.services.block_service.manager.emit_to_user', new_callable=AsyncMock):
            result = await block_service.unblock_user(blocker_id, blocked_id)

        assert result is True
        mock_db.blocked_users.delete_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_unblock_mutual_block(self, block_service, mock_db):
        """Test unblocking when there was a mutual block"""
        blocker_id = str(ObjectId())
        blocked_id = str(ObjectId())

        # Mock delete result
        mock_db.blocked_users.delete_one.return_value = AsyncMock(deleted_count=1)

        # Mock reverse block exists
        reverse_block = {
            "_id": str(ObjectId()),
            "blocker_id": blocked_id,
            "blocked_user_id": blocker_id,
            "is_mutual": True,
        }
        mock_db.blocked_users.find_one.return_value = reverse_block
        mock_db.blocked_users.update_one.return_value = AsyncMock()

        with patch('app.services.block_service.manager.emit_to_user', new_callable=AsyncMock):
            result = await block_service.unblock_user(blocker_id, blocked_id)

        assert result is True
        # Should update reverse block to not mutual
        mock_db.blocked_users.update_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_unblock_not_blocked(self, block_service, mock_db):
        """Test unblocking when no block exists"""
        blocker_id = str(ObjectId())
        blocked_id = str(ObjectId())

        # Mock no deletion
        mock_db.blocked_users.delete_one.return_value = AsyncMock(deleted_count=0)
        mock_db.blocked_users.find_one.return_value = None

        result = await block_service.unblock_user(blocker_id, blocked_id)

        # Should still return True (idempotent)
        assert result is True


class TestIsBlocked:
    """Tests for is_blocked method"""

    @pytest.mark.asyncio
    async def test_is_blocked_true(self, block_service, mock_db):
        """Test when user is blocked"""
        blocker_id = str(ObjectId())
        blocked_id = str(ObjectId())

        # Mock block exists
        mock_db.blocked_users.find_one.return_value = {
            "_id": str(ObjectId()),
            "blocker_id": blocker_id,
            "blocked_user_id": blocked_id,
        }

        result = await block_service.is_blocked(blocker_id, blocked_id)

        assert result is True

    @pytest.mark.asyncio
    async def test_is_blocked_false(self, block_service, mock_db):
        """Test when user is not blocked"""
        blocker_id = str(ObjectId())
        blocked_id = str(ObjectId())

        # Mock no block
        mock_db.blocked_users.find_one.return_value = None

        result = await block_service.is_blocked(blocker_id, blocked_id)

        assert result is False

    @pytest.mark.asyncio
    async def test_is_blocked_bidirectional(self, block_service, mock_db):
        """Test bidirectional block check"""
        user1_id = str(ObjectId())
        user2_id = str(ObjectId())

        # Mock no block in either direction
        mock_db.blocked_users.count_documents.return_value = 0

        result = await block_service.is_blocked_bidirectional(user1_id, user2_id)

        assert result is False

        # Mock block exists
        mock_db.blocked_users.count_documents.return_value = 1

        result = await block_service.is_blocked_bidirectional(user1_id, user2_id)

        assert result is True


class TestGetBlockedUsers:
    """Tests for get_blocked_users method"""

    @pytest.mark.asyncio
    async def test_get_blocked_users_with_data(self, block_service, mock_db):
        """Test getting blocked users list"""
        blocker_id = str(ObjectId())
        blocked_user1_id = ObjectId()
        blocked_user2_id = ObjectId()

        # Mock blocked users
        blocked_list = [
            {
                "_id": str(ObjectId()),
                "blocker_id": blocker_id,
                "blocked_user_id": str(blocked_user1_id),
                "reason": "spam",
                "is_mutual": False,
                "created_at": datetime.now(timezone.utc),
            },
            {
                "_id": str(ObjectId()),
                "blocker_id": blocker_id,
                "blocked_user_id": str(blocked_user2_id),
                "reason": "harassment",
                "is_mutual": True,
                "created_at": datetime.now(timezone.utc),
            },
        ]

        # Mock aggregation pipeline
        mock_cursor = AsyncMock()
        mock_cursor.to_list.return_value = blocked_list
        mock_db.blocked_users.aggregate.return_value = mock_cursor

        result = await block_service.get_blocked_users(blocker_id, limit=20, offset=0)

        assert len(result["users"]) == 2
        assert result["total"] == 2
        assert result["users"][1]["is_mutual"] is True

    @pytest.mark.asyncio
    async def test_get_blocked_users_pagination(self, block_service, mock_db):
        """Test pagination of blocked users"""
        blocker_id = str(ObjectId())

        # Mock empty result for page 2
        mock_cursor = AsyncMock()
        mock_cursor.to_list.return_value = []
        mock_db.blocked_users.aggregate.return_value = mock_cursor

        result = await block_service.get_blocked_users(blocker_id, limit=20, offset=40)

        assert len(result["users"]) == 0
        assert result["total"] == 0


class TestGetMutualBlocks:
    """Tests for get_mutual_blocks method"""

    @pytest.mark.asyncio
    async def test_get_mutual_blocks(self, block_service, mock_db):
        """Test getting mutual blocks"""
        user_id = str(ObjectId())

        # Mock mutual blocks
        mutual_blocks = [
            {
                "_id": str(ObjectId()),
                "blocker_id": user_id,
                "blocked_user_id": str(ObjectId()),
                "is_mutual": True,
                "created_at": datetime.now(timezone.utc),
            }
        ]

        mock_cursor = AsyncMock()
        mock_cursor.to_list.return_value = mutual_blocks
        mock_db.blocked_users.find.return_value = mock_cursor

        result = await block_service.get_mutual_blocks(user_id)

        assert len(result) == 1
        assert result[0]["is_mutual"] is True


class TestBlockCount:
    """Tests for block_count method"""

    @pytest.mark.asyncio
    async def test_block_count(self, block_service, mock_db):
        """Test getting block count"""
        blocker_id = str(ObjectId())

        # Mock count
        mock_db.blocked_users.count_documents.return_value = 5

        result = await block_service.block_count(blocker_id)

        assert result == 5
        mock_db.blocked_users.count_documents.assert_called_with(
            {"blocker_id": blocker_id}
        )

    @pytest.mark.asyncio
    async def test_block_count_zero(self, block_service, mock_db):
        """Test getting block count when no blocks"""
        blocker_id = str(ObjectId())

        mock_db.blocked_users.count_documents.return_value = 0

        result = await block_service.block_count(blocker_id)

        assert result == 0
