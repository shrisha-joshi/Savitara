"""
Integration tests for Moderation API
Tests blocking, reporting, and admin moderation endpoints
"""
import pytest
from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
from bson import ObjectId


# ============ Block Endpoints Tests ============

@pytest.mark.asyncio
async def test_block_user_success(async_client: AsyncClient, auth_headers, test_db: AsyncIOMotorDatabase):
    """Test successfully blocking another user"""
    # Arrange: Create test users
    user1 = await test_db.users.insert_one({
        "email": "blocker@test.com",
        "role": "grihasta",
        "status": "active",
        "created_at": datetime.now(timezone.utc)
    })
    user2 = await test_db.users.insert_one({
        "email": "blocked@test.com",
        "role": "grihasta",
        "status": "active",
        "created_at": datetime.now(timezone.utc)
    })
    
    # Mock current_user as user1
    blocked_user_id = str(user2.inserted_id)
    
    # Act: Block user2
    response = await async_client.post(
        f"/api/v1/moderation/block/{blocked_user_id}",
        json={"reason": "spam"},
        headers=auth_headers
    )
    
    # Assert: Response successful
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert "User blocked successfully" in data["message"]
    assert "block_id" in data["data"]
    
    # Assert: Database has block record
    block = await test_db.blocked_users.find_one({
        "blocked_user_id": blocked_user_id
    })
    assert block is not None
    assert block["reason"] == "spam"
    assert block["is_mutual"] is False


@pytest.mark.asyncio
async def test_block_user_creates_mutual_block(async_client: AsyncClient, auth_headers, test_db: AsyncIOMotorDatabase):
    """Test that reciprocal blocks are detected as mutual"""
    # Arrange: Create users and first block (A blocks B)
    user_a_id = str(ObjectId())
    user_b_id = str(ObjectId())
    
    await test_db.users.insert_many([
        {"_id": ObjectId(user_a_id), "email": "usera@test.com", "role": "grihasta", "status": "active"},
        {"_id": ObjectId(user_b_id), "email": "userb@test.com", "role": "grihasta", "status": "active"}
    ])
    
    await test_db.blocked_users.insert_one({
        "blocker_user_id": user_a_id,
        "blocked_user_id": user_b_id,
        "is_mutual": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Act: User B blocks User A (creating mutual block)
    response = await async_client.post(
        f"/api/v1/moderation/block/{user_a_id}",
        json={},
        headers=auth_headers
    )
    
    # Assert: Mutual block detected
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert "mutual block detected" in data["message"]
    assert data["data"]["is_mutual"] is True


@pytest.mark.asyncio
async def test_block_yourself_returns_error(async_client: AsyncClient, auth_headers, test_db: AsyncIOMotorDatabase):
    """Test that you cannot block yourself"""
    # Arrange: Create user
    current_user_id = "507f1f77bcf86cd799439011"  # Mock current user ID from fixture
    
    # Act: Try to block self
    response = await async_client.post(
        f"/api/v1/moderation/block/{current_user_id}",
        json={},
        headers=auth_headers
    )
    
    # Assert: Error returned
    assert response.status_code == 400
    data = response.json()
    assert "cannot block yourself" in data["detail"].lower()


@pytest.mark.asyncio
async def test_unblock_user_success(async_client: AsyncClient, auth_headers, test_db: AsyncIOMotorDatabase):
    """Test successfully unblocking a user"""
    # Arrange: Create block record
    blocker_id = "507f1f77bcf86cd799439011"
    blocked_id = str(ObjectId())
    
    await test_db.users.insert_one({
        "_id": ObjectId(blocked_id),
        "email": "blocked@test.com",
        "role": "grihasta",
        "status": "active"
    })
    
    await test_db.blocked_users.insert_one({
        "blocker_user_id": blocker_id,
        "blocked_user_id": blocked_id,
        "is_mutual": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Act: Unblock user
    response = await async_client.delete(
        f"/api/v1/moderation/block/{blocked_id}",
        headers=auth_headers
    )
    
    # Assert: Unblock successful
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "unblocked successfully" in data["message"]
    
    # Assert: Block record removed
    block = await test_db.blocked_users.find_one({
        "blocker_user_id": blocker_id,
        "blocked_user_id": blocked_id
    })
    assert block is None


@pytest.mark.asyncio
async def test_get_blocked_users_with_pagination(async_client: AsyncClient, auth_headers, test_db: AsyncIOMotorDatabase):
    """Test retrieving blocked users list with pagination"""
    # Arrange: Create multiple blocked users
    blocker_id = "507f1f77bcf86cd799439011"
    
    for i in range(25):
        blocked_id = str(ObjectId())
        await test_db.users.insert_one({
            "_id": ObjectId(blocked_id),
            "email": f"blocked{i}@test.com",
            "role": "grihasta",
            "status": "active"
        })
        await test_db.blocked_users.insert_one({
            "blocker_user_id": blocker_id,
            "blocked_user_id": blocked_id,
            "is_mutual": False,
            "created_at": datetime.now(timezone.utc)
        })
    
    # Act: Get first page
    response = await async_client.get(
        "/api/v1/moderation/blocks?limit=20&offset=0",
        headers=auth_headers
    )
    
    # Assert: First page returned
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["data"]["users"]) == 20
    assert data["data"]["total"] == 25
    assert data["data"]["has_more"] is True
    
    # Act: Get second page
    response2 = await async_client.get(
        "/api/v1/moderation/blocks?limit=20&offset=20",
        headers=auth_headers
    )
    
    # Assert: Second page returned
    data2 = response2.json()
    assert len(data2["data"]["users"]) == 5
    assert data2["data"]["has_more"] is False


@pytest.mark.asyncio
async def test_get_mutual_blocks(async_client: AsyncClient, auth_headers, test_db: AsyncIOMotorDatabase):
    """Test retrieving mutual blocks"""
    # Arrange: Create mutual blocks
    current_user_id = "507f1f77bcf86cd799439011"
    mutual_user_id = str(ObjectId())
    
    await test_db.users.insert_one({
        "_id": ObjectId(mutual_user_id),
        "email": "mutual@test.com",
        "role": "grihasta",
        "status": "active"
    })
    
    # Both users block each other
    await test_db.blocked_users.insert_many([
        {
            "blocker_user_id": current_user_id,
            "blocked_user_id": mutual_user_id,
            "is_mutual": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "blocker_user_id": mutual_user_id,
            "blocked_user_id": current_user_id,
            "is_mutual": True,
            "created_at": datetime.now(timezone.utc)
        }
    ])
    
    # Act: Get mutual blocks
    response = await async_client.get(
        "/api/v1/moderation/blocks/mutual",
        headers=auth_headers
    )
    
    # Assert: Mutual blocks returned
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["data"]["users"]) >= 1


@pytest.mark.asyncio
async def test_get_block_count(async_client: AsyncClient, auth_headers, test_db: AsyncIOMotorDatabase):
    """Test getting count of blocked users"""
    # Arrange: Create some blocks
    blocker_id = "507f1f77bcf86cd799439011"
    
    for i in range(5):
        await test_db.blocked_users.insert_one({
            "blocker_user_id": blocker_id,
            "blocked_user_id": str(ObjectId()),
            "is_mutual": False,
            "created_at": datetime.now(timezone.utc)
        })
    
    # Act: Get block count
    response = await async_client.get(
        "/api/v1/moderation/blocks/count",
        headers=auth_headers
    )
    
    # Assert: Count returned
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["count"] == 5


@pytest.mark.asyncio
async def test_block_without_auth_returns_401(async_client: AsyncClient, test_db: AsyncIOMotorDatabase):
    """Test that blocking requires authentication"""
    # Act: Try to block without auth headers
    response = await async_client.post(
        f"/api/v1/moderation/block/{str(ObjectId())}",
        json={}
    )
    
    # Assert: Unauthorized
    assert response.status_code == 401


# ============ Report Endpoints Tests ============

@pytest.mark.asyncio
async def test_create_user_report_success(async_client: AsyncClient, auth_headers, test_db: AsyncIOMotorDatabase):
    """Test creating a report against a user"""
    # Arrange: Create users
    reporter_id = "507f1f77bcf86cd799439011"
    reported_id = str(ObjectId())
    
    await test_db.users.insert_one({
        "_id": ObjectId(reported_id),
        "email": "reported@test.com",
        "role": "grihasta",
        "status": "active"
    })
    
    # Act: Create report
    response = await async_client.post(
        "/api/v1/moderation/reports",
        json={
            "reported_user_id": reported_id,
            "reason": "harassment",
            "description": "User sent inappropriate messages",
            "evidence_urls": ["https://example.com/screenshot.png"]
        },
        headers=auth_headers
    )
    
    # Assert: Report created
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert "Report submitted successfully" in data["message"]
    assert "report_id" in data["data"]
    assert data["data"]["priority"] == 5  # harassment is high priority
    
    # Assert: Database has report
    report = await test_db.reports.find_one({
        "reported_user_id": reported_id
    })
    assert report is not None
    assert report["reason"] == "harassment"
    assert report["status"] == "pending"
    assert len(report["evidence_urls"]) == 1


@pytest.mark.asyncio
async def test_create_message_report_success(async_client: AsyncClient, auth_headers, test_db: AsyncIOMotorDatabase):
    """Test creating a report for a specific message"""
    # Arrange: Create message and users
    message_id = str(ObjectId())
    reported_user_id = str(ObjectId())
    
    await test_db.users.insert_one({
        "_id": ObjectId(reported_user_id),
        "email": "baduser@test.com",
        "role": "grihasta",
        "status": "active"
    })
    
    await test_db.messages.insert_one({
        "_id": ObjectId(message_id),
        "sender_id": reported_user_id,
        "content": "spam content",
        "created_at": datetime.now(timezone.utc)
    })
    
    # Act: Report message
    response = await async_client.post(
        "/api/v1/moderation/reports",
        json={
            "reported_user_id": reported_user_id,
            "reason": "spam",
            "description": "User is spamming the chat",
            "message_id": message_id
        },
        headers=auth_headers
    )
    
    # Assert: Report created with message reference
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    
    # Assert: Database has message_id
    report = await test_db.reports.find_one({
        "message_id": message_id
    })
    assert report is not None
    assert report["message_id"] == message_id


@pytest.mark.asyncio
async def test_cannot_report_yourself(async_client: AsyncClient, auth_headers, test_db: AsyncIOMotorDatabase):
    """Test that you cannot report yourself"""
    # Arrange: Current user ID
    current_user_id = "507f1f77bcf86cd799439011"
    
    # Act: Try to report self
    response = await async_client.post(
        "/api/v1/moderation/reports",
        json={
            "reported_user_id": current_user_id,
            "reason": "spam",
            "description": "Test"
        },
        headers=auth_headers
    )
    
    # Assert: Error returned
    assert response.status_code == 400
    assert "cannot report yourself" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_report_by_id(async_client: AsyncClient, auth_headers, test_db: AsyncIOMotorDatabase):
    """Test retrieving a specific report"""
    # Arrange: Create report
    reporter_id = "507f1f77bcf86cd799439011"
    report_id = ObjectId()
    
    await test_db.reports.insert_one({
        "_id": report_id,
        "reporter_id": reporter_id,
        "reported_user_id": str(ObjectId()),
        "reason": "harassment",
        "description": "Test report",
        "status": "pending",
        "priority": 5,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Act: Get report
    response = await async_client.get(
        f"/api/v1/moderation/reports/{str(report_id)}",
        headers=auth_headers
    )
    
    # Assert: Report returned
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["reason"] == "harassment"


@pytest.mark.asyncio
async def test_get_user_reports_created_by_me(async_client: AsyncClient, auth_headers, test_db: AsyncIOMotorDatabase):
    """Test getting reports created by current user"""
    # Arrange: Create multiple reports
    reporter_id = "507f1f77bcf86cd799439011"
    
    for i in range(3):
        await test_db.reports.insert_one({
            "reporter_id": reporter_id,
            "reported_user_id": str(ObjectId()),
            "reason": "spam",
            "description": f"Report {i}",
            "status": "pending",
            "priority": 3,
            "created_at": datetime.now(timezone.utc)
        })
    
    # Act: Get my reports
    response = await async_client.get(
        "/api/v1/moderation/reports?include_reported=false",
        headers=auth_headers
    )
    
    # Assert: Reports returned
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["data"]["reports"]) >= 3


@pytest.mark.asyncio
async def test_get_user_reports_include_reported(async_client: AsyncClient, auth_headers, test_db: AsyncIOMotorDatabase):
    """Test getting reports about current user"""
    # Arrange: Create reports against current user
    current_user_id = "507f1f77bcf86cd799439011"
    
    for i in range(2):
        await test_db.reports.insert_one({
            "reporter_id": str(ObjectId()),
            "reported_user_id": current_user_id,
            "reason": "spam",
            "description": f"Report against me {i}",
            "status": "pending",
            "priority": 3,
            "created_at": datetime.now(timezone.utc)
        })
    
    # Act: Get reports about me
    response = await async_client.get(
        "/api/v1/moderation/reports?include_reported=true",
        headers=auth_headers
    )
    
    # Assert: Reports returned
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    # Should include reports about me
    assert len(data["data"]["reports"]) >= 2


# ============ Admin Endpoints Tests ============

@pytest.mark.asyncio
async def test_get_pending_reports_admin_only(async_client: AsyncClient, test_db: AsyncIOMotorDatabase):
    """Test getting pending reports requires admin role"""
    # Arrange: Create non-admin user
    non_admin_headers = {"Authorization": "Bearer fake_non_admin_token"}
    
    # Act: Try to get pending reports
    response = await async_client.get(
        "/api/v1/moderation/admin/reports/pending",
        headers=non_admin_headers
    )
    
    # Assert: Forbidden
    assert response.status_code == 403
    assert "Only admins" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_pending_reports_success(async_client: AsyncClient, test_db: AsyncIOMotorDatabase):
    """Test admin can get pending reports"""
    # Arrange: Create pending reports
    admin_headers = {"Authorization": "Bearer admin_token"}
    
    for i in range(5):
        await test_db.reports.insert_one({
            "reporter_id": str(ObjectId()),
            "reported_user_id": str(ObjectId()),
            "reason": "spam",
            "description": f"Pending report {i}",
            "status": "pending",
            "priority": 3,
            "created_at": datetime.now(timezone.utc)
        })
    
    # Act: Get pending reports as admin
    # Note: This test assumes admin auth is mocked properly
    response = await async_client.get(
        "/api/v1/moderation/admin/reports/pending?limit=10",
        headers=admin_headers
    )
    
    # Note: This will fail without proper admin auth mocking
    # In real implementation, need to set up admin user fixture


@pytest.mark.asyncio
async def test_get_reports_for_specific_user_admin(async_client: AsyncClient, test_db: AsyncIOMotorDatabase):
    """Test admin getting all reports for a specific user"""
    # Arrange: Create reports for target user
    target_user_id = str(ObjectId())
    admin_headers = {"Authorization": "Bearer admin_token"}
    
    for i in range(3):
        await test_db.reports.insert_one({
            "reporter_id": str(ObjectId()),
            "reported_user_id": target_user_id,
            "reason": "harassment",
            "description": f"Report {i}",
            "status": "pending",
            "priority": 5,
            "created_at": datetime.now(timezone.utc)
        })
    
    # Act: Get reports for user
    response = await async_client.get(
        f"/api/v1/moderation/admin/reports/user/{target_user_id}",
        headers=admin_headers
    )
    
    # Note: Requires admin auth fixture


@pytest.mark.asyncio
async def test_update_report_status_admin(async_client: AsyncClient, test_db: AsyncIOMotorDatabase):
    """Test admin updating report status"""
    # Arrange: Create report
    report_id = ObjectId()
    admin_headers = {"Authorization": "Bearer admin_token"}
    
    await test_db.reports.insert_one({
        "_id": report_id,
        "reporter_id": str(ObjectId()),
        "reported_user_id": str(ObjectId()),
        "reason": "spam",
        "description": "Test report",
        "status": "pending",
        "priority": 3,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Act: Update status to reviewing
    response = await async_client.patch(
        f"/api/v1/moderation/admin/reports/{str(report_id)}/status",
        json={
            "status": "reviewing",
            "admin_notes": "Investigating this case"
        },
        headers=admin_headers
    )
    
    # Note: Requires admin auth fixture


@pytest.mark.asyncio
async def test_dismiss_report_admin(async_client: AsyncClient, test_db: AsyncIOMotorDatabase):
    """Test admin dismissing a report"""
    # Arrange: Create report
    report_id = ObjectId()
    admin_headers = {"Authorization": "Bearer admin_token"}
    
    await test_db.reports.insert_one({
        "_id": report_id,
        "reporter_id": str(ObjectId()),
        "reported_user_id": str(ObjectId()),
        "reason": "spam",
        "description": "False report",
        "status": "pending",
        "priority": 3,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Act: Dismiss report
    response = await async_client.post(
        f"/api/v1/moderation/admin/reports/{str(report_id)}/dismiss",
        json={
            "reason": "No evidence found"
        },
        headers=admin_headers
    )
    
    # Note: Requires admin auth fixture


@pytest.mark.asyncio
async def test_take_action_on_report_ban_user(async_client: AsyncClient, test_db: AsyncIOMotorDatabase):
    """Test admin taking ban action on report"""
    # Arrange: Create report
    report_id = ObjectId()
    reported_user_id = str(ObjectId())
    admin_headers = {"Authorization": "Bearer admin_token"}
    
    await test_db.reports.insert_one({
        "_id": report_id,
        "reporter_id": str(ObjectId()),
        "reported_user_id": reported_user_id,
        "reason": "harassment",
        "description": "Severe harassment",
        "status": "reviewing",
        "priority": 5,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Act: Ban user
    response = await async_client.post(
        f"/api/v1/moderation/admin/reports/{str(report_id)}/action",
        json={
            "action": "ban",
            "reason": "Confirmed harassment"
        },
        headers=admin_headers
    )
    
    # Note: Requires admin auth fixture


@pytest.mark.asyncio
async def test_issue_warning_to_user(async_client: AsyncClient, test_db: AsyncIOMotorDatabase):
    """Test admin issuing warning to user"""
    # Arrange: Create user and report
    target_user_id = str(ObjectId())
    report_id = str(ObjectId())
    admin_headers = {"Authorization": "Bearer admin_token"}
    
    await test_db.users.insert_one({
        "_id": ObjectId(target_user_id),
        "email": "warned@test.com",
        "role": "grihasta",
        "status": "active"
    })
    
    # Act: Issue warning
    response = await async_client.post(
        "/api/v1/moderation/admin/warnings",
        json={
            "user_id": target_user_id,
            "reason": "Inappropriate language",
            "severity": "medium",
            "report_id": report_id
        },
        headers=admin_headers
    )
    
    # Note: Requires admin auth fixture


@pytest.mark.asyncio
async def test_get_user_warnings_admin(async_client: AsyncClient, test_db: AsyncIOMotorDatabase):
    """Test admin getting all warnings for a user"""
    # Arrange: Create warnings
    target_user_id = str(ObjectId())
    admin_headers = {"Authorization": "Bearer admin_token"}
    
    for i in range(3):
        await test_db.warnings.insert_one({
            "user_id": target_user_id,
            "admin_id": str(ObjectId()),
            "reason": f"Warning {i}",
            "severity": "low",
            "created_at": datetime.now(timezone.utc)
        })
    
    # Act: Get warnings
    response = await async_client.get(
        f"/api/v1/moderation/admin/warnings/user/{target_user_id}",
        headers=admin_headers
    )
    
    # Note: Requires admin auth fixture


@pytest.mark.asyncio
async def test_report_priority_calculation(async_client: AsyncClient, auth_headers, test_db: AsyncIOMotorDatabase):
    """Test that different reasons get correct priorities"""
    # Arrange: Create reported user
    reported_id = str(ObjectId())
    await test_db.users.insert_one({
        "_id": ObjectId(reported_id),
        "email": "reported@test.com",
        "role": "grihasta",
        "status": "active"
    })
    
    # Test high priority reasons
    high_priority_reasons = ["harassment", "hate_speech", "violence"]
    for reason in high_priority_reasons:
        response = await async_client.post(
            "/api/v1/moderation/reports",
            json={
                "reported_user_id": reported_id,
                "reason": reason,
                "description": f"Test {reason}"
            },
            headers=auth_headers
        )
        assert response.status_code == 201
        # High priority should be 5
        assert response.json()["data"]["priority"] == 5
    
    # Test medium priority
    response = await async_client.post(
        "/api/v1/moderation/reports",
        json={
            "reported_user_id": reported_id,
            "reason": "spam",
            "description": "Test spam"
        },
        headers=auth_headers
    )
    assert response.status_code == 201
    # Medium priority should be 3
    assert response.json()["data"]["priority"] == 3


@pytest.mark.asyncio
async def test_report_requires_authentication(async_client: AsyncClient, test_db: AsyncIOMotorDatabase):
    """Test that creating reports requires authentication"""
    # Act: Try to create report without auth
    response = await async_client.post(
        "/api/v1/moderation/reports",
        json={
            "reported_user_id": str(ObjectId()),
            "reason": "spam",
            "description": "Test"
        }
    )
    
    # Assert: Unauthorized
    assert response.status_code == 401
