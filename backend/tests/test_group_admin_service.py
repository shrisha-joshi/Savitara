"""
Unit Tests for GroupAdminService
Tests the business logic for group chat administration and moderation
"""
import pytest
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.group_admin_service import GroupAdminService, GroupRole, AuditAction
from app.core.exceptions import (
    InvalidInputError,
    ResourceNotFoundError,
    PermissionDeniedError,
)


@pytest.fixture
def mock_db():
    """Create mock database"""
    db = MagicMock()
    db.conversations = AsyncMock()
    db.conversation_members = AsyncMock()
    db.messages = AsyncMock()
    db.room_audit_log = AsyncMock()
    return db


@pytest.fixture
def group_admin_service(mock_db):
    """Create GroupAdminService instance with mock database"""
    return GroupAdminService(mock_db)


@pytest.fixture
def mock_conversation():
    """Mock conversation document"""
    return {
        "_id": ObjectId(),
        "type": "group",
        "name": "Test Group",
        "created_at": datetime.now(timezone.utc),
    }


@pytest.fixture
def mock_admin_member():
    """Mock admin member document"""
    return {
        "_id": ObjectId(),
        "conversation_id": "conv_123",
        "user_id": "admin_user",
        "role": GroupRole.ADMIN,
        "joined_at": datetime.now(timezone.utc),
    }


@pytest.fixture
def mock_owner_member():
    """Mock owner member document"""
    return {
        "_id": ObjectId(),
        "conversation_id": "conv_123",
        "user_id": "owner_user",
        "role": GroupRole.OWNER,
        "joined_at": datetime.now(timezone.utc),
    }


@pytest.fixture
def mock_regular_member():
    """Mock regular member document"""
    return {
        "_id": ObjectId(),
        "conversation_id": "conv_123",
        "user_id": "regular_user",
        "role": GroupRole.MEMBER,
        "joined_at": datetime.now(timezone.utc),
    }


class TestVerifyAdminPermission:
    """Tests for _verify_admin_permission method"""

    @pytest.mark.asyncio
    async def test_admin_has_permission(self, group_admin_service, mock_db, mock_conversation, mock_admin_member):
        """Test that admin has permission"""
        conv_id = str(mock_conversation["_id"])
        admin_id = mock_admin_member["user_id"]

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.return_value = mock_admin_member

        result = await group_admin_service._verify_admin_permission(conv_id, admin_id)

        assert result["role"] == GroupRole.ADMIN

    @pytest.mark.asyncio
    async def test_owner_has_permission(self, group_admin_service, mock_db, mock_conversation, mock_owner_member):
        """Test that owner has permission"""
        conv_id = str(mock_conversation["_id"])
        owner_id = mock_owner_member["user_id"]

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.return_value = mock_owner_member

        result = await group_admin_service._verify_admin_permission(conv_id, owner_id)

        assert result["role"] == GroupRole.OWNER

    @pytest.mark.asyncio
    async def test_regular_member_denied(self, group_admin_service, mock_db, mock_conversation, mock_regular_member):
        """Test that regular members are denied admin actions"""
        conv_id = str(mock_conversation["_id"])
        user_id = mock_regular_member["user_id"]

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.return_value = mock_regular_member

        with pytest.raises(PermissionDeniedError):
            await group_admin_service._verify_admin_permission(conv_id, user_id)

    @pytest.mark.asyncio
    async def test_owner_required(self, group_admin_service, mock_db, mock_conversation, mock_admin_member):
        """Test that owner-only actions deny admins"""
        conv_id = str(mock_conversation["_id"])
        admin_id = mock_admin_member["user_id"]

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.return_value = mock_admin_member

        with pytest.raises(PermissionDeniedError):
            await group_admin_service._verify_admin_permission(conv_id, admin_id, require_owner=True)

    @pytest.mark.asyncio
    async def test_nonexistent_conversation(self, group_admin_service, mock_db):
        """Test permission check on nonexistent conversation"""
        conv_id = str(ObjectId())
        user_id = "user_123"

        mock_db.conversations.find_one.return_value = None

        with pytest.raises(ResourceNotFoundError):
            await group_admin_service._verify_admin_permission(conv_id, user_id)

    @pytest.mark.asyncio
    async def test_non_member(self, group_admin_service, mock_db, mock_conversation):
        """Test permission check for non-member"""
        conv_id = str(mock_conversation["_id"])
        user_id = "non_member"

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.return_value = None

        with pytest.raises(PermissionDeniedError):
            await group_admin_service._verify_admin_permission(conv_id, user_id)


class TestMuteMember:
    """Tests for mute_member method"""

    @pytest.mark.asyncio
    async def test_mute_member_success(self, group_admin_service, mock_db, mock_conversation, mock_admin_member):
        """Test successfully muting a member"""
        conv_id = str(mock_conversation["_id"])
        admin_id = mock_admin_member["user_id"]
        target_id = "target_user"

        target_member = {
            "_id": ObjectId(),
            "conversation_id": conv_id,
            "user_id": target_id,
            "role": GroupRole.MEMBER,
        }

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.side_effect = [mock_admin_member, target_member]
        mock_db.conversation_members.update_one.return_value = AsyncMock(modified_count=1)
        mock_db.room_audit_log.insert_one.return_value = AsyncMock()

        with patch('app.services.group_admin_service.manager.emit_to_room', new_callable=AsyncMock):
            result = await group_admin_service.mute_member(
                conversation_id=conv_id,
                admin_id=admin_id,
                target_user_id=target_id,
                duration_hours=24,
            )

        assert result is not None
        assert "muted_until" in result
        mock_db.conversation_members.update_one.assert_called_once()
        mock_db.room_audit_log.insert_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_mute_indefinite(self, group_admin_service, mock_db, mock_conversation, mock_admin_member):
        """Test muting member indefinitely"""
        conv_id = str(mock_conversation["_id"])
        admin_id = mock_admin_member["user_id"]
        target_id = "target_user"

        target_member = {
            "_id": ObjectId(),
            "conversation_id": conv_id,
            "user_id": target_id,
            "role": GroupRole.MEMBER,
        }

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.side_effect = [mock_admin_member, target_member]
        mock_db.conversation_members.update_one.return_value = AsyncMock(modified_count=1)
        mock_db.room_audit_log.insert_one.return_value = AsyncMock()

        with patch('app.services.group_admin_service.manager.emit_to_room', new_callable=AsyncMock):
            result = await group_admin_service.mute_member(
                conversation_id=conv_id,
                admin_id=admin_id,
                target_user_id=target_id,
                duration_hours=None,  # Indefinite
            )

        # muted_until should be far in future or None
        assert result is not None

    @pytest.mark.asyncio
    async def test_cannot_mute_self(self, group_admin_service, mock_db, mock_conversation, mock_admin_member):
        """Test that admins cannot mute themselves"""
        conv_id = str(mock_conversation["_id"])
        admin_id = mock_admin_member["user_id"]

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.return_value = mock_admin_member

        with pytest.raises(InvalidInputError) as exc_info:
            await group_admin_service.mute_member(
                conversation_id=conv_id,
                admin_id=admin_id,
                target_user_id=admin_id,  # Same user
                duration_hours=24,
            )

        assert "Cannot mute yourself" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_cannot_mute_owner(self, group_admin_service, mock_db, mock_conversation, mock_admin_member, mock_owner_member):
        """Test that admins cannot mute the owner"""
        conv_id = str(mock_conversation["_id"])
        admin_id = mock_admin_member["user_id"]
        owner_id = mock_owner_member["user_id"]

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.side_effect = [mock_admin_member, mock_owner_member]

        with pytest.raises(PermissionDeniedError):
            await group_admin_service.mute_member(
                conversation_id=conv_id,
                admin_id=admin_id,
                target_user_id=owner_id,
                duration_hours=24,
            )


class TestUnmuteMember:
    """Tests for unmute_member method"""

    @pytest.mark.asyncio
    async def test_unmute_member_success(self, group_admin_service, mock_db, mock_conversation, mock_admin_member):
        """Test successfully unmuting a member"""
        conv_id = str(mock_conversation["_id"])
        admin_id = mock_admin_member["user_id"]
        target_id = "target_user"

        muted_member = {
            "_id": ObjectId(),
            "conversation_id": conv_id,
            "user_id": target_id,
            "role": GroupRole.MEMBER,
            "muted_until": datetime.now(timezone.utc) + timedelta(hours=24),
        }

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.side_effect = [mock_admin_member, muted_member]
        mock_db.conversation_members.update_one.return_value = AsyncMock(modified_count=1)
        mock_db.room_audit_log.insert_one.return_value = AsyncMock()

        with patch('app.services.group_admin_service.manager.emit_to_room', new_callable=AsyncMock):
            result = await group_admin_service.unmute_member(
                conversation_id=conv_id,
                admin_id=admin_id,
                target_user_id=target_id,
            )

        assert result is not None
        assert result.get("muted_until") is None
        mock_db.conversation_members.update_one.assert_called_once()


class TestBanMember:
    """Tests for ban_member method"""

    @pytest.mark.asyncio
    async def test_ban_member_success(self, group_admin_service, mock_db, mock_conversation, mock_admin_member):
        """Test successfully banning a member"""
        conv_id = str(mock_conversation["_id"])
        admin_id = mock_admin_member["user_id"]
        target_id = "target_user"

        target_member = {
            "_id": ObjectId(),
            "conversation_id": conv_id,
            "user_id": target_id,
            "role": GroupRole.MEMBER,
        }

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.side_effect = [mock_admin_member, target_member]
        mock_db.conversation_members.update_one.return_value = AsyncMock(modified_count=1)
        mock_db.room_audit_log.insert_one.return_value = AsyncMock()

        with patch('app.services.group_admin_service.manager.emit_to_room', new_callable=AsyncMock):
            result = await group_admin_service.ban_member(
                conversation_id=conv_id,
                admin_id=admin_id,
                target_user_id=target_id,
                duration_days=7,
            )

        assert result is not None
        assert "banned_until" in result
        mock_db.conversation_members.update_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_ban_permanent(self, group_admin_service, mock_db, mock_conversation, mock_admin_member):
        """Test permanent ban (None duration)"""
        conv_id = str(mock_conversation["_id"])
        admin_id = mock_admin_member["user_id"]
        target_id = "target_user"

        target_member = {
            "_id": ObjectId(),
            "conversation_id": conv_id,
            "user_id": target_id,
            "role": GroupRole.MEMBER,
        }

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.side_effect = [mock_admin_member, target_member]
        mock_db.conversation_members.update_one.return_value = AsyncMock(modified_count=1)
        mock_db.room_audit_log.insert_one.return_value = AsyncMock()

        with patch('app.services.group_admin_service.manager.emit_to_room', new_callable=AsyncMock):
            result = await group_admin_service.ban_member(
                conversation_id=conv_id,
                admin_id=admin_id,
                target_user_id=target_id,
                duration_days=None,  # Permanent
            )

        assert result is not None


class TestRemoveMember:
    """Tests for remove_member method"""

    @pytest.mark.asyncio
    async def test_remove_member_success(self, group_admin_service, mock_db, mock_conversation, mock_admin_member):
        """Test successfully removing a member from group"""
        conv_id = str(mock_conversation["_id"])
        admin_id = mock_admin_member["user_id"]
        target_id = "target_user"

        target_member = {
            "_id": ObjectId(),
            "conversation_id": conv_id,
            "user_id": target_id,
            "role": GroupRole.MEMBER,
        }

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.side_effect = [mock_admin_member, target_member]
        mock_db.conversation_members.delete_one.return_value = AsyncMock(deleted_count=1)
        mock_db.room_audit_log.insert_one.return_value = AsyncMock()

        with patch('app.services.group_admin_service.manager.emit_to_room', new_callable=AsyncMock):
            result = await group_admin_service.remove_member(
                conversation_id=conv_id,
                admin_id=admin_id,
                target_user_id=target_id,
            )

        assert result is True
        mock_db.conversation_members.delete_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_cannot_remove_owner(self, group_admin_service, mock_db, mock_conversation, mock_admin_member, mock_owner_member):
        """Test that owner cannot be removed"""
        conv_id = str(mock_conversation["_id"])
        admin_id = mock_admin_member["user_id"]
        owner_id = mock_owner_member["user_id"]

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.side_effect = [mock_admin_member, mock_owner_member]

        with pytest.raises(PermissionDeniedError):
            await group_admin_service.remove_member(
                conversation_id=conv_id,
                admin_id=admin_id,
                target_user_id=owner_id,
            )


class TestChangeRole:
    """Tests for change_member_role method"""

    @pytest.mark.asyncio
    async def test_promote_to_admin(self, group_admin_service, mock_db, mock_conversation, mock_owner_member):
        """Test owner promoting member to admin"""
        conv_id = str(mock_conversation["_id"])
        owner_id = mock_owner_member["user_id"]
        target_id = "target_user"

        target_member = {
            "_id": ObjectId(),
            "conversation_id": conv_id,
            "user_id": target_id,
            "role": GroupRole.MEMBER,
        }

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.side_effect = [mock_owner_member, target_member]
        mock_db.conversation_members.update_one.return_value = AsyncMock(modified_count=1)
        mock_db.room_audit_log.insert_one.return_value = AsyncMock()

        with patch('app.services.group_admin_service.manager.emit_to_room', new_callable=AsyncMock):
            result = await group_admin_service.change_member_role(
                conversation_id=conv_id,
                owner_id=owner_id,
                target_user_id=target_id,
                new_role=GroupRole.ADMIN,
            )

        assert result is not None
        assert result["role"] == GroupRole.ADMIN
        mock_db.conversation_members.update_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_demote_admin_to_member(self, group_admin_service, mock_db, mock_conversation, mock_owner_member, mock_admin_member):
        """Test owner demoting admin to member"""
        conv_id = str(mock_conversation["_id"])
        owner_id = mock_owner_member["user_id"]
        admin_id = mock_admin_member["user_id"]

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.side_effect = [mock_owner_member, mock_admin_member]
        mock_db.conversation_members.update_one.return_value = AsyncMock(modified_count=1)
        mock_db.room_audit_log.insert_one.return_value = AsyncMock()

        with patch('app.services.group_admin_service.manager.emit_to_room', new_callable=AsyncMock):
            result = await group_admin_service.change_member_role(
                conversation_id=conv_id,
                owner_id=owner_id,
                target_user_id=admin_id,
                new_role=GroupRole.MEMBER,
            )

        assert result is not None
        assert result["role"] == GroupRole.MEMBER

    @pytest.mark.asyncio
    async def test_only_owner_can_change_roles(self, group_admin_service, mock_db, mock_conversation, mock_admin_member):
        """Test that only owner can change roles"""
        conv_id = str(mock_conversation["_id"])
        admin_id = mock_admin_member["user_id"]
        target_id = "target_user"

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.return_value = mock_admin_member

        with pytest.raises(PermissionDeniedError):
            await group_admin_service.change_member_role(
                conversation_id=conv_id,
                owner_id=admin_id,  # Admin trying to change roles
                target_user_id=target_id,
                new_role=GroupRole.ADMIN,
            )


class TestDeleteMessage:
    """Tests for delete_message method"""

    @pytest.mark.asyncio
    async def test_delete_message_by_admin(self, group_admin_service, mock_db, mock_conversation, mock_admin_member):
        """Test admin deleting a message"""
        conv_id = str(mock_conversation["_id"])
        admin_id = mock_admin_member["user_id"]
        message_id = str(ObjectId())

        message = {
            "_id": ObjectId(message_id),
            "conversation_id": conv_id,
            "sender_id": "other_user",
            "content": "Test message",
        }

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.return_value = mock_admin_member
        mock_db.messages.find_one.return_value = message
        mock_db.messages.update_one.return_value = AsyncMock(modified_count=1)
        mock_db.room_audit_log.insert_one.return_value = AsyncMock()

        with patch('app.services.group_admin_service.manager.emit_to_room', new_callable=AsyncMock):
            result = await group_admin_service.delete_message(
                conversation_id=conv_id,
                admin_id=admin_id,
                message_id=message_id,
            )

        assert result is True
        mock_db.messages.update_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_own_message(self, group_admin_service, mock_db, mock_conversation):
        """Test user deleting their own message"""
        conv_id = str(mock_conversation["_id"])
        user_id = "user_123"
        message_id = str(ObjectId())

        member = {
            "_id": ObjectId(),
            "conversation_id": conv_id,
            "user_id": user_id,
            "role": GroupRole.MEMBER,
        }

        message = {
            "_id": ObjectId(message_id),
            "conversation_id": conv_id,
            "sender_id": user_id,  # Own message
            "content": "Test message",
        }

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.return_value = member
        mock_db.messages.find_one.return_value = message
        mock_db.messages.update_one.return_value = AsyncMock(modified_count=1)
        mock_db.room_audit_log.insert_one.return_value = AsyncMock()

        with patch('app.services.group_admin_service.manager.emit_to_room', new_callable=AsyncMock):
            result = await group_admin_service.delete_message(
                conversation_id=conv_id,
                admin_id=user_id,
                message_id=message_id,
            )

        assert result is True


class TestPinMessage:
    """Tests for pin_message method"""

    @pytest.mark.asyncio
    async def test_pin_message_success(self, group_admin_service, mock_db, mock_conversation, mock_admin_member):
        """Test pinning a message"""
        conv_id = str(mock_conversation["_id"])
        admin_id = mock_admin_member["user_id"]
        message_id = str(ObjectId())

        message = {
            "_id": ObjectId(message_id),
            "conversation_id": conv_id,
            "content": "Important message",
        }

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.return_value = mock_admin_member
        mock_db.messages.find_one.return_value = message
        mock_db.conversations.update_one.return_value = AsyncMock(modified_count=1)
        mock_db.room_audit_log.insert_one.return_value = AsyncMock()

        with patch('app.services.group_admin_service.manager.emit_to_room', new_callable=AsyncMock):
            result = await group_admin_service.pin_message(
                conversation_id=conv_id,
                admin_id=admin_id,
                message_id=message_id,
            )

        assert result is not None
        mock_db.conversations.update_one.assert_called_once()


class TestLockRoom:
    """Tests for lock_room method"""

    @pytest.mark.asyncio
    async def test_lock_room_success(self, group_admin_service, mock_db, mock_conversation, mock_owner_member):
        """Test owner locking a room"""
        conv_id = str(mock_conversation["_id"])
        owner_id = mock_owner_member["user_id"]

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.return_value = mock_owner_member
        mock_db.conversations.update_one.return_value = AsyncMock(modified_count=1)
        mock_db.room_audit_log.insert_one.return_value = AsyncMock()

        with patch('app.services.group_admin_service.manager.emit_to_room', new_callable=AsyncMock):
            result = await group_admin_service.lock_room(
                conversation_id=conv_id,
                owner_id=owner_id,
                locked=True,
            )

        assert result is not None
        assert result.get("locked") is True
        mock_db.conversations.update_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_only_owner_can_lock(self, group_admin_service, mock_db, mock_conversation, mock_admin_member):
        """Test that only owner can lock room"""
        conv_id = str(mock_conversation["_id"])
        admin_id = mock_admin_member["user_id"]

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.return_value = mock_admin_member

        with pytest.raises(PermissionDeniedError):
            await group_admin_service.lock_room(
                conversation_id=conv_id,
                owner_id=admin_id,  # Admin, not owner
                locked=True,
            )


class TestGetAuditLog:
    """Tests for get_audit_log method"""

    @pytest.mark.asyncio
    async def test_get_audit_log(self, group_admin_service, mock_db, mock_conversation, mock_admin_member):
        """Test getting audit log for a conversation"""
        conv_id = str(mock_conversation["_id"])
        admin_id = mock_admin_member["user_id"]

        audit_entries = [
            {
                "_id": ObjectId(),
                "conversation_id": conv_id,
                "actor_id": admin_id,
                "action": AuditAction.MUTE_USER,
                "target_id": "user_123",
                "metadata": {"duration_hours": 24},
                "created_at": datetime.now(timezone.utc),
            },
            {
                "_id": ObjectId(),
                "conversation_id": conv_id,
                "actor_id": admin_id,
                "action": AuditAction.DELETE_MESSAGE,
                "target_id": "user_456",
                "metadata": {"message_id": str(ObjectId())},
                "created_at": datetime.now(timezone.utc),
            },
        ]

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.return_value = mock_admin_member

        mock_cursor = AsyncMock()
        mock_cursor.to_list.return_value = audit_entries
        mock_db.room_audit_log.find.return_value = mock_cursor

        result = await group_admin_service.get_audit_log(
            conversation_id=conv_id,
            requester_id=admin_id,
            limit=50,
        )

        assert len(result) == 2
        assert result[0]["action"] == AuditAction.MUTE_USER
        assert result[1]["action"] == AuditAction.DELETE_MESSAGE

    @pytest.mark.asyncio
    async def test_regular_member_cannot_view_audit_log(self, group_admin_service, mock_db, mock_conversation, mock_regular_member):
        """Test that regular members cannot view audit log"""
        conv_id = str(mock_conversation["_id"])
        user_id = mock_regular_member["user_id"]

        mock_db.conversations.find_one.return_value = mock_conversation
        mock_db.conversation_members.find_one.return_value = mock_regular_member

        with pytest.raises(PermissionDeniedError):
            await group_admin_service.get_audit_log(
                conversation_id=conv_id,
                requester_id=user_id,
                limit=50,
            )
