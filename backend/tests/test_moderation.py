"""
Tests for User Moderation (Reports and Blocking)
"""
import pytest
from fastapi import status
from bson import ObjectId
from datetime import datetime, timezone


@pytest.mark.asyncio
async def test_create_user_report(test_client, auth_headers_grihasta, db):
    """Test creating a user report"""
    # Create a test user to report
    reported_user = await db.users.insert_one(
        {
            "email": "reporteduser@test.com",
            "role": "grihasta",
            "status": "active",
            "created_at": datetime.now(timezone.utc),
        }
    )

    response = test_client.post(
        "/api/v1/admin/reports",
        headers=auth_headers_grihasta,
        params={
            "reported_user_id": str(reported_user.inserted_id),
            "reason": "harassment",
            "description": "User sent inappropriate messages",
        },
    )

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["success"] is True
    assert "report_id" in data["data"]


@pytest.mark.asyncio
async def test_cannot_report_self(test_client, auth_headers_grihasta, current_user_id):
    """Test that user cannot report themselves"""
    response = test_client.post(
        "/api/v1/admin/reports",
        headers=auth_headers_grihasta,
        params={
            "reported_user_id": current_user_id,
            "reason": "spam",
        },
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.asyncio
async def test_block_user(test_client, auth_headers_grihasta, db):
    """Test blocking a user"""
    # Create a test user to block
    blocked_user = await db.users.insert_one(
        {
            "email": "blockeduser@test.com",
            "role": "acharya",
            "status": "active",
            "created_at": datetime.now(timezone.utc),
        }
    )

    response = test_client.post(
        "/api/v1/users/block",
        headers=auth_headers_grihasta,
        params={"blocked_user_id": str(blocked_user.inserted_id), "reason": "spam"},
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_get_blocked_users(test_client, auth_headers_grihasta):
    """Test getting list of blocked users"""
    response = test_client.get(
        "/api/v1/users/blocked", headers=auth_headers_grihasta
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["success"] is True
    assert "blocked_users" in data["data"]


@pytest.mark.asyncio
async def test_unblock_user(test_client, auth_headers_grihasta, db):
    """Test unblocking a user"""
    # First block a user
    blocked_user = await db.users.insert_one(
        {
            "email": "unblockuser@test.com",
            "role": "acharya",
            "status": "active",
            "created_at": datetime.now(timezone.utc),
        }
    )

    test_client.post(
        "/api/v1/users/block",
        headers=auth_headers_grihasta,
        params={"blocked_user_id": str(blocked_user.inserted_id)},
    )

    # Then unblock
    response = test_client.post(
        "/api/v1/users/unblock",
        headers=auth_headers_grihasta,
        params={"blocked_user_id": str(blocked_user.inserted_id)},
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_admin_get_all_reports(test_client, auth_headers_admin, db):
    """Test admin getting all reports"""
    response = test_client.get(
        "/api/v1/admin/reports", headers=auth_headers_admin
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["success"] is True
    assert "reports" in data["data"]
    assert "pagination" in data["data"]


@pytest.mark.asyncio
async def test_admin_review_report(test_client, auth_headers_admin, db):
    """Test admin reviewing a report"""
    # Create a test report
    report = await db.user_reports.insert_one(
        {
            "reporter_id": "test_reporter",
            "reported_user_id": "test_reported",
            "reason": "spam",
            "description": "Test report",
            "status": "pending",
            "priority": 1,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
    )

    response = test_client.post(
        f"/api/v1/admin/reports/{str(report.inserted_id)}/review",
        headers=auth_headers_admin,
        params={"action": "resolved", "admin_notes": "Investigated and resolved"},
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["success"] is True
