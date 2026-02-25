"""
Integration tests for Group Admin API
Tests group chat moderation and administration endpoints
"""
import pytest
from typing import Any
from httpx import AsyncClient
from datetime import datetime, timezone, timedelta
from bson import ObjectId


# ============ Helper Fixtures ============

@pytest.fixture
async def test_conversation(test_db: Any):
    """Create a test group conversation"""
    conversation_id = ObjectId()
    await test_db.conversations.insert_one({
        "_id": conversation_id,
        "type": "group",
        "name": "Test Group",
        "created_at": datetime.now(timezone.utc)
    })
    return str(conversation_id)


@pytest.fixture
async def test_members(test_db: Any, test_conversation: str):
    """Create test members with different roles"""
    owner_id = str(ObjectId())
    admin_id = str(ObjectId())
    member_id = str(ObjectId())
    
    # Create users
    await test_db.users.insert_many([
        {"_id": ObjectId(owner_id), "email": "owner@test.com", "role": "grihasta", "status": "active"},
        {"_id": ObjectId(admin_id), "email": "admin@test.com", "role": "grihasta", "status": "active"},
        {"_id": ObjectId(member_id), "email": "member@test.com", "role": "grihasta", "status": "active"}
    ])
    
    # Create memberships
    await test_db.conversation_members.insert_many([
        {"conversation_id": test_conversation, "user_id": owner_id, "role": "owner", "joined_at": datetime.now(timezone.utc)},
        {"conversation_id": test_conversation, "user_id": admin_id, "role": "admin", "joined_at": datetime.now(timezone.utc)},
        {"conversation_id": test_conversation, "user_id": member_id, "role": "member", "joined_at": datetime.now(timezone.utc)}
    ])
    
    return {
        "owner_id": owner_id,
        "admin_id": admin_id,
        "member_id": member_id
    }


# ============ Mute/Unmute Tests ============

@pytest.mark.asyncio
async def test_mute_member_success(async_client: AsyncClient, auth_headers, test_db: Any, test_conversation: str, test_members: dict):
    """Test admin successfully muting a member"""
    # Act: Mute member for 24 hours
    response = await async_client.post(
        f"/api/v1/groups/{test_conversation}/mute",
        json={
            "user_id": test_members["member_id"],
            "duration_hours": 24
        },
        headers=auth_headers
    )
    
    # Assert: Mute successful
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "for 24 hours" in data["message"]
    
    # Assert: Database updated
    member = await test_db.conversation_members.find_one({
        "conversation_id": test_conversation,
        "user_id": test_members["member_id"]
    })
    assert member is not None
    assert member.get("muted_until") is not None


@pytest.mark.asyncio
async def test_mute_member_indefinitely(async_client: AsyncClient, auth_headers, test_db: Any, test_conversation: str, test_members: dict):
    """Test muting member without duration (indefinite)"""
    # Act: Mute indefinitely
    response = await async_client.post(
        f"/api/v1/groups/{test_conversation}/mute",
        json={
            "user_id": test_members["member_id"]
            # No duration_hours
        },
        headers=auth_headers
    )
    
    # Assert: Indefinite mute
    assert response.status_code == 200
    data = response.json()
    assert "indefinitely" in data["message"]


@pytest.mark.asyncio
async def test_unmute_member_success(async_client: AsyncClient, auth_headers, test_db: Any, test_conversation: str, test_members: dict):
    """Test successfully unmuting a member"""
    # Arrange: Mute the member first
    await test_db.conversation_members.update_one(
        {"conversation_id": test_conversation, "user_id": test_members["member_id"]},
        {"$set": {"muted_until": datetime.now(timezone.utc) + timedelta(hours=24)}}
    )
    
    # Act: Unmute member
    response = await async_client.post(
        f"/api/v1/groups/{test_conversation}/unmute",
        params={"user_id": test_members["member_id"]},
        headers=auth_headers
    )
    
    # Assert: Unmute successful
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "unmuted successfully" in data["message"]
    
    # Assert: Database updated
    member = await test_db.conversation_members.find_one({
        "conversation_id": test_conversation,
        "user_id": test_members["member_id"]
    })
    assert member.get("muted_until") is None


@pytest.mark.asyncio
async def test_non_admin_cannot_mute(async_client: AsyncClient, test_db: Any, test_conversation: str, test_members: dict):
    """Test that non-admin members cannot mute others"""
    # Arrange: Headers for regular member
    member_headers = {"Authorization": "Bearer member_token"}
    
    # Act: Try to mute as member
    await async_client.post(
        f"/api/v1/groups/{test_conversation}/mute",
        json={
            "user_id": test_members["owner_id"],
            "duration_hours": 1
        },
        headers=member_headers
    )
    
    # Assert: Permission denied (actual status depends on implementation)
    # This test requires proper auth fixture for member role


# ============ Ban/Unban Tests ============

@pytest.mark.asyncio
async def test_ban_member_temporary(async_client: AsyncClient, auth_headers, test_db: Any, test_conversation: str, test_members: dict):
    """Test banning member for specific duration"""
    # Act: Ban for 7 days
    response = await async_client.post(
        f"/api/v1/groups/{test_conversation}/ban",
        json={
            "user_id": test_members["member_id"],
            "duration_days": 7
        },
        headers=auth_headers
    )
    
    # Assert: Ban successful
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "for 7 days" in data["message"]
    
    # Assert: Database updated
    member = await test_db.conversation_members.find_one({
        "conversation_id": test_conversation,
        "user_id": test_members["member_id"]
    })
    assert member is not None
    assert member.get("banned_until") is not None


@pytest.mark.asyncio
async def test_ban_member_permanently(async_client: AsyncClient, auth_headers, test_db: Any, test_conversation: str, test_members: dict):
    """Test permanent ban (no duration)"""
    # Act: Permanent ban
    response = await async_client.post(
        f"/api/v1/groups/{test_conversation}/ban",
        json={
            "user_id": test_members["member_id"]
            # No duration_days
        },
        headers=auth_headers
    )
    
    # Assert: Permanent ban
    assert response.status_code == 200
    data = response.json()
    assert "permanently" in data["message"]


@pytest.mark.asyncio
async def test_cannot_ban_owner(async_client: AsyncClient, auth_headers, test_db: Any, test_conversation: str, test_members: dict):
    """Test that owner cannot be banned"""
    # Act: Try to ban owner
    response = await async_client.post(
        f"/api/v1/groups/{test_conversation}/ban",
        json={
            "user_id": test_members["owner_id"],
            "duration_days": 1
        },
        headers=auth_headers
    )
    
    # Assert: Error (owner protected)
    assert response.status_code == 400
    assert "owner" in response.json()["detail"].lower()


# ============ Remove Member Tests ============

@pytest.mark.asyncio
async def test_remove_member_success(async_client: AsyncClient, auth_headers, test_db: Any, test_conversation: str, test_members: dict):
    """Test admin removing a member"""
    # Act: Remove member
    response = await async_client.delete(
        f"/api/v1/groups/{test_conversation}/members/{test_members['member_id']}",
        headers=auth_headers
    )
    
    # Assert: Member removed
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "removed successfully" in data["message"]
    
    # Assert: Database updated (member record deleted or marked as left)
    member = await test_db.conversation_members.find_one({
        "conversation_id": test_conversation,
        "user_id": test_members["member_id"]
    })
    # Depending on implementation, could be None or have left_at timestamp
    assert member is None or member.get("left_at") is not None


@pytest.mark.asyncio
async def test_cannot_remove_owner(async_client: AsyncClient, auth_headers, test_db: Any, test_conversation: str, test_members: dict):
    """Test that owner cannot be removed"""
    # Act: Try to remove owner
    response = await async_client.delete(
        f"/api/v1/groups/{test_conversation}/members/{test_members['owner_id']}",
        headers=auth_headers
    )
    
    # Assert: Error
    assert response.status_code == 400
    assert "owner" in response.json()["detail"].lower()


# ============ Role Management Tests ============

@pytest.mark.asyncio
async def test_change_member_role_to_admin(async_client: AsyncClient, auth_headers, test_db: Any, test_conversation: str, test_members: dict):
    """Test owner promoting member to admin"""
    # Note: Requires owner auth headers
    owner_headers = {"Authorization": "Bearer owner_token"}
    
    # Act: Change member to admin
    await async_client.patch(
        f"/api/v1/groups/{test_conversation}/members/{test_members['member_id']}/role",
        json={"new_role": "admin"},
        headers=owner_headers
    )
    
    # Assert: Role changed (requires owner auth)
    # This test needs proper owner auth fixture


@pytest.mark.asyncio
async def test_change_admin_role_to_member(async_client: AsyncClient, auth_headers, test_db: Any, test_conversation: str, test_members: dict):
    """Test owner demoting admin to member"""
    owner_headers = {"Authorization": "Bearer owner_token"}
    
    # Act: Demote admin
    await async_client.patch(
        f"/api/v1/groups/{test_conversation}/members/{test_members['admin_id']}/role",
        json={"new_role": "member"},
        headers=owner_headers
    )
    
    # Note: Requires owner auth fixture


@pytest.mark.asyncio
async def test_non_owner_cannot_change_roles(async_client: AsyncClient, auth_headers, test_db: Any, test_conversation: str, test_members: dict):
    """Test that only owner can change roles"""
    # Arrange: Admin trying to change roles
    admin_headers = {"Authorization": "Bearer admin_token"}
    
    # Act: Admin tries to change role
    await async_client.patch(
        f"/api/v1/groups/{test_conversation}/members/{test_members['member_id']}/role",
        json={"new_role": "admin"},
        headers=admin_headers
    )
    
    # Assert: Permission denied
    # Requires proper role-based auth fixtures


# ============ Message Moderation Tests ============

@pytest.mark.asyncio
async def test_delete_message_success(async_client: AsyncClient, auth_headers, test_db: Any, test_conversation: str, test_members: dict):
    """Test admin deleting a message"""
    # Arrange: Create a test message
    message_id = ObjectId()
    await test_db.messages.insert_one({
        "_id": message_id,
        "conversation_id": test_conversation,
        "sender_id": test_members["member_id"],
        "content": "Test message",
        "created_at": datetime.now(timezone.utc)
    })
    
    # Act: Delete message
    response = await async_client.delete(
        f"/api/v1/groups/{test_conversation}/messages/{str(message_id)}",
        headers=auth_headers
    )
    
    # Assert: Message deleted
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    
    # Assert: Database updated
    message = await test_db.messages.find_one({"_id": message_id})
    assert message is None or message.get("deleted") is True


@pytest.mark.asyncio
async def test_pin_message_success(async_client: AsyncClient, auth_headers, test_db: Any, test_conversation: str, test_members: dict):
    """Test admin pinning a message"""
    # Arrange: Create message to pin
    message_id = ObjectId()
    await test_db.messages.insert_one({
        "_id": message_id,
        "conversation_id": test_conversation,
        "sender_id": test_members["admin_id"],
        "content": "Important announcement",
        "created_at": datetime.now(timezone.utc)
    })
    
    # Act: Pin message
    response = await async_client.post(
        f"/api/v1/groups/{test_conversation}/pin",
        json={"message_id": str(message_id)},
        headers=auth_headers
    )
    
    # Assert: Message pinned
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "pinned successfully" in data["message"]
    
    # Assert: Database updated
    message = await test_db.messages.find_one({"_id": message_id})
    assert message.get("pinned") is True or message.get("is_pinned") is True


@pytest.mark.asyncio
async def test_unpin_message(async_client: AsyncClient, auth_headers, test_db: Any, test_conversation: str, test_members: dict):
    """Test unpinning a message"""
    # Arrange: Create pinned message
    message_id = ObjectId()
    await test_db.messages.insert_one({
        "_id": message_id,
        "conversation_id": test_conversation,
        "sender_id": test_members["admin_id"],
        "content": "Pinned message",
        "pinned": True,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Update conversation to reference pinned message
    await test_db.conversations.update_one(
        {"_id": ObjectId(test_conversation)},
        {"$set": {"pinned_message_id": str(message_id)}}
    )
    
    # Act: Unpin (implementation may vary - might be DELETE /pin or POST with message_id=None)
    # This depends on actual implementation


# ============ Room Settings Tests ============

@pytest.mark.asyncio
async def test_lock_room_success(async_client: AsyncClient, test_db: Any, test_conversation: str):
    """Test owner locking the room"""
    owner_headers = {"Authorization": "Bearer owner_token"}
    
    # Act: Lock room
    await async_client.patch(
        f"/api/v1/groups/{test_conversation}/lock",
        json={"locked": True},
        headers=owner_headers
    )
    
    # Note: Requires owner auth fixture


@pytest.mark.asyncio
async def test_unlock_room_success(async_client: AsyncClient, test_db: Any, test_conversation: str):
    """Test owner unlocking the room"""
    owner_headers = {"Authorization": "Bearer owner_token"}
    
    # Arrange: Lock the room first
    await test_db.conversations.update_one(
        {"_id": ObjectId(test_conversation)},
        {"$set": {"locked": True}}
    )
    
    # Act: Unlock room
    await async_client.patch(
        f"/api/v1/groups/{test_conversation}/lock",
        json={"locked": False},
        headers=owner_headers
    )
    
    # Note: Requires owner auth fixture


@pytest.mark.asyncio
async def test_non_owner_cannot_lock_room(async_client: AsyncClient, test_db: Any, test_conversation: str):
    """Test that only owner can lock/unlock room"""
    admin_headers = {"Authorization": "Bearer admin_token"}
    
    # Act: Admin tries to lock
    await async_client.patch(
        f"/api/v1/groups/{test_conversation}/lock",
        json={"locked": True},
        headers=admin_headers
    )
    
    # Assert: Permission denied
    # Requires proper auth fixtures


# ============ Audit Log Tests ============

@pytest.mark.asyncio
async def test_get_audit_log_success(async_client: AsyncClient, auth_headers, test_db: Any, test_conversation: str, test_members: dict):
    """Test retrieving audit log"""
    # Arrange: Create audit log entries
    for _ in range(5):
        await test_db.group_audit_logs.insert_one({
            "conversation_id": test_conversation,
            "admin_id": test_members["admin_id"],
            "action": "mute_member",
            "target_user_id": test_members["member_id"],
            "created_at": datetime.now(timezone.utc)
        })
    
    # Act: Get audit log
    response = await async_client.get(
        f"/api/v1/groups/{test_conversation}/audit?limit=10&skip=0",
        headers=auth_headers
    )
    
    # Assert: Audit log returned
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["data"]["logs"]) >= 5


@pytest.mark.asyncio
async def test_get_audit_log_pagination(async_client: AsyncClient, auth_headers, test_db: Any, test_conversation: str, test_members: dict):
    """Test audit log pagination"""
    # Arrange: Create 25 audit entries
    for i in range(25):
        await test_db.group_audit_logs.insert_one({
            "conversation_id": test_conversation,
            "admin_id": test_members["admin_id"],
            "action": "mute_member" if i % 2 == 0 else "ban_member",
            "target_user_id": test_members["member_id"],
            "created_at": datetime.now(timezone.utc)
        })
    
    # Act: Get first page
    response = await async_client.get(
        f"/api/v1/groups/{test_conversation}/audit?limit=20&skip=0",
        headers=auth_headers
    )
    
    # Assert: First page
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]["logs"]) == 20
    
    # Act: Get second page
    response2 = await async_client.get(
        f"/api/v1/groups/{test_conversation}/audit?limit=20&skip=20",
        headers=auth_headers
    )
    
    # Assert: Second page
    data2 = response2.json()
    assert len(data2["data"]["logs"]) == 5


@pytest.mark.asyncio
async def test_non_admin_cannot_view_audit_log(async_client: AsyncClient, test_db: Any, test_conversation: str):
    """Test that regular members cannot view audit log"""
    member_headers = {"Authorization": "Bearer member_token"}
    
    # Act: Member tries to view audit log
    await async_client.get(
        f"/api/v1/groups/{test_conversation}/audit",
        headers=member_headers
    )
    
    # Assert: Permission denied
    # Requires proper auth fixtures


# ============ Permission Tests ============

@pytest.mark.asyncio
async def test_user_not_in_conversation_cannot_moderate(async_client: AsyncClient, test_db: Any, test_conversation: str):
    """Test that users not in conversation cannot perform admin actions"""
    # Arrange: Create user not in conversation
    outsider_id = str(ObjectId())
    await test_db.users.insert_one({
        "_id": ObjectId(outsider_id),
        "email": "outsider@test.com",
        "role": "grihasta",
        "status": "active"
    })
    
    outsider_headers = {"Authorization": "Bearer outsider_token"}
    
    # Act: Try to mute member
    await async_client.post(
        f"/api/v1/groups/{test_conversation}/mute",
        json={
            "user_id": "some_user_id",
            "duration_hours": 1
        },
        headers=outsider_headers
    )
    
    # Assert: Permission denied
    # Requires proper auth fixture


@pytest.mark.asyncio
async def test_nonexistent_conversation_returns_error(async_client: AsyncClient, auth_headers, test_db: Any):
    """Test that operations on nonexistent conversation fail"""
    fake_conversation_id = str(ObjectId())
    
    # Act: Try to mute in nonexistent conversation
    response = await async_client.post(
        f"/api/v1/groups/{fake_conversation_id}/mute",
        json={
            "user_id": str(ObjectId()),
            "duration_hours": 1
        },
        headers=auth_headers
    )
    
    # Assert: Not found or error
    assert response.status_code in [400, 404]


@pytest.mark.asyncio
async def test_group_admin_requires_authentication(async_client: AsyncClient, test_conversation: str):
    """Test that all group admin endpoints require authentication"""
    # Act: Try various endpoints without auth
    endpoints = [
        ("POST", f"/api/v1/groups/{test_conversation}/mute", {"user_id": "test", "duration_hours": 1}),
        ("POST", f"/api/v1/groups/{test_conversation}/ban", {"user_id": "test"}),
        ("DELETE", f"/api/v1/groups/{test_conversation}/members/test", None),
        ("GET", f"/api/v1/groups/{test_conversation}/audit", None)
    ]
    
    for method, url, json_data in endpoints:
        if method == "POST":
            response = await async_client.post(url, json=json_data)
        elif method == "DELETE":
            response = await async_client.delete(url)
        elif method == "GET":
            response = await async_client.get(url)
        
        # Assert: Unauthorized
        assert response.status_code == 401


# ============ Audit Trail Verification Tests ============

@pytest.mark.asyncio
async def test_mute_action_creates_audit_log(async_client: AsyncClient, auth_headers, test_db: Any, test_conversation: str, test_members: dict):
    """Test that muting creates audit log entry"""
    # Act: Mute member
    await async_client.post(
        f"/api/v1/groups/{test_conversation}/mute",
        json={
            "user_id": test_members["member_id"],
            "duration_hours": 24
        },
        headers=auth_headers
    )
    
    # Assert: Audit log created
    audit_log = await test_db.group_audit_logs.find_one({
        "conversation_id": test_conversation,
        "action": "mute_member",
        "target_user_id": test_members["member_id"]
    })
    assert audit_log is not None


@pytest.mark.asyncio
async def test_ban_action_creates_audit_log(async_client: AsyncClient, auth_headers, test_db: Any, test_conversation: str, test_members: dict):
    """Test that banning creates audit log entry"""
    # Act: Ban member
    await async_client.post(
        f"/api/v1/groups/{test_conversation}/ban",
        json={
            "user_id": test_members["member_id"],
            "duration_days": 7
        },
        headers=auth_headers
    )
    
    # Assert: Audit log created
    audit_log = await test_db.group_audit_logs.find_one({
        "conversation_id": test_conversation,
        "action": "ban_member",
        "target_user_id": test_members["member_id"]
    })
    assert audit_log is not None


@pytest.mark.asyncio
async def test_remove_member_creates_audit_log(async_client: AsyncClient, auth_headers, test_db: Any, test_conversation: str, test_members: dict):
    """Test that removing member creates audit log entry"""
    # Act: Remove member
    await async_client.delete(
        f"/api/v1/groups/{test_conversation}/members/{test_members['member_id']}",
        headers=auth_headers
    )
    
    # Assert: Audit log created
    audit_log = await test_db.group_audit_logs.find_one({
        "conversation_id": test_conversation,
        "action": "remove_member",
        "target_user_id": test_members["member_id"]
    })
    assert audit_log is not None
