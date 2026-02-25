"""
Tests for Gamification (Streaks, Achievements, Rewards)
"""
import pytest
from fastapi import status
from datetime import datetime, timezone, timedelta


@pytest.mark.asyncio
async def test_get_my_streak(test_client, auth_headers_grihasta, db):
    """Test getting user's current streak"""
    response = test_client.get(
        "/api/v1/gamification/streaks/my", headers=auth_headers_grihasta
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "current_streak" in data
    assert "longest_streak" in data


@pytest.mark.asyncio
async def test_daily_checkin(test_client, auth_headers_grihasta, db):
    """Test daily check-in"""
    response = test_client.post(
        "/api/v1/gamification/streaks/checkin", headers=auth_headers_grihasta
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["success"] is True
    assert "current_streak" in data
    assert "coins_awarded" in data


@pytest.mark.asyncio
async def test_get_streak_leaderboard(test_client):
    """Test getting streak leaderboard"""
    response = test_client.get("/api/v1/gamification/streaks/leaderboard")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "leaderboard" in data


@pytest.mark.asyncio
async def test_get_my_achievements(test_client, auth_headers_grihasta):
    """Test getting user's achievements"""
    response = test_client.get(
        "/api/v1/gamification/achievements/my", headers=auth_headers_grihasta
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "milestones" in data
    assert "achievements" in data
    assert "next_milestones" in data


@pytest.mark.asyncio
async def test_get_available_achievements(test_client, auth_headers_grihasta):
    """Test getting available achievements"""
    response = test_client.get(
        "/api/v1/gamification/achievements/available", headers=auth_headers_grihasta
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "grihasta" in data or "acharya" in data


@pytest.mark.asyncio
async def test_get_daily_rewards(test_client, auth_headers_grihasta):
    """Test getting daily rewards calendar"""
    response = test_client.get(
        "/api/v1/gamification/rewards/daily", headers=auth_headers_grihasta
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "rewards" in data
    assert "current_streak" in data
    assert len(data["rewards"]) == 7  # 7-day calendar


@pytest.mark.asyncio
async def test_get_coins_balance(test_client, auth_headers_grihasta):
    """Test getting user's coin balance"""
    response = test_client.get(
        "/api/v1/gamification/coins/balance", headers=auth_headers_grihasta
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "current_balance" in data


@pytest.mark.asyncio
async def test_get_loyalty_status(test_client, auth_headers_grihasta):
    """Test getting user's loyalty tier and benefits"""
    response = test_client.get(
        "/api/v1/gamification/loyalty/status", headers=auth_headers_grihasta
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "current_tier" in data


@pytest.mark.asyncio
async def test_get_my_vouchers(test_client, auth_headers_grihasta):
    """Test getting user's vouchers"""
    response = test_client.get(
        "/api/v1/gamification/vouchers/my", headers=auth_headers_grihasta
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "vouchers" in data


@pytest.mark.asyncio
async def test_get_available_coupons(test_client, auth_headers_grihasta):
    """Test getting available coupons"""
    response = test_client.get(
        "/api/v1/gamification/coupons/available", headers=auth_headers_grihasta
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "coupons" in data


@pytest.mark.asyncio
async def test_validate_coupon(test_client, auth_headers_grihasta, db):
    """Test validating a coupon"""
    # Create a test coupon
    await db.coupons.insert_one(
        {
            "code": "TEST50",
            "name": "Test Coupon",
            "description": "50% off",
            "discount_type": "percentage",
            "discount_value": 50,
            "min_booking_amount": 0,
            "valid_from": datetime.now(timezone.utc) - timedelta(days=1),
            "valid_until": datetime.now(timezone.utc) + timedelta(days=30),
            "is_active": True,
            "usage_limit": None,
            "used_count": 0,
            "per_user_limit": 1,
            "applicable_for": ["all"],
            "applicable_services": ["all"],
            "first_booking_only": False,
            "can_combine_offers": False,
            "terms_conditions": [],
            "created_by": "admin",
            "created_at": datetime.now(timezone.utc),
        }
    )

    response = test_client.post(
        "/api/v1/gamification/coupons/validate",
        headers=auth_headers_grihasta,
        json={"code": "TEST50", "booking_amount": 1000},
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["valid"] is True


@pytest.mark.asyncio
async def test_get_referral_code(test_client, auth_headers_grihasta):
    """Test getting or generating referral code"""
    response = test_client.get(
        "/api/v1/gamification/referral/my-code", headers=auth_headers_grihasta
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "referral_code" in data
    assert "referral_link" in data
    assert "stats" in data


@pytest.mark.asyncio
async def test_calculate_price(test_client, auth_headers_grihasta):
    """Test calculating price with discounts"""
    response = test_client.post(
        "/api/v1/gamification/pricing/calculate",
        headers=auth_headers_grihasta,
        json={"base_amount": 1000, "use_coins": 0},
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "base_price" in data
    assert "final_price" in data


@pytest.mark.asyncio
async def test_gamification_overview(test_client, auth_headers_grihasta):
    """Test getting gamification overview"""
    response = test_client.get(
        "/api/v1/gamification/stats/overview", headers=auth_headers_grihasta
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "coins" in data
    assert "loyalty" in data
    assert "vouchers" in data
    assert "referral" in data
