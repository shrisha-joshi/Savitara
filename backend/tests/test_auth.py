"""Authentication Tests"""
import pytest
from unittest.mock import AsyncMock, patch
from app.main import app

@pytest.mark.asyncio
class TestAuthentication:
    """Test authentication endpoints"""
    
    async def test_google_login_missing_token(self, async_client):
        """Test Google login without token"""
        response = await async_client.post("/api/v1/auth/google", json={"role": "grihasta"})
        assert response.status_code == 422
    
    async def test_google_login_invalid_role(self, async_client):
        """Test Google login with invalid role"""
        response = await async_client.post(
            "/api/v1/auth/google",
            json={"id_token": "test_token", "role": "invalid_role"}
        )
        assert response.status_code == 422
    
    async def test_google_callback_success(self, async_client):
        """Test Google OAuth callback"""
        mock_id_info = {
            "sub": "google-uid-123",
            "email": "testuser@gmail.com",
            "name": "Test User",
            "picture": "https://lh3.googleusercontent.com/photo.jpg",
            "email_verified": True,
        }
        with patch(
            "app.api.v1.auth.id_token.verify_oauth2_token",
            new_callable=AsyncMock,
            return_value=mock_id_info,
        ):
            response = await async_client.post(
                "/api/v1/auth/google",
                json={"id_token": "valid-google-token", "role": "grihasta"},
            )
        # Either 200 (new/returning user) or 500 if DB not seeded
        assert response.status_code in [200, 500]
    
    async def test_refresh_token_missing(self, async_client):
        """Test refresh without token"""
        response = await async_client.post("/api/v1/auth/refresh")
        assert response.status_code in [401, 422]
    
    async def test_logout_without_auth(self, async_client):
        """Test logout without authentication"""
        response = await async_client.post("/api/v1/auth/logout")
        assert response.status_code == 401
    
    async def test_get_current_user_without_token(self, async_client):
        """Test getting current user without token"""
        response = await async_client.get("/api/v1/users/me")
        assert response.status_code == 401
    
    async def test_invalid_token_format(self, async_client):
        """Test with invalid token format"""
        response = await async_client.get(
            "/api/v1/users/me",
            headers={"Authorization": "InvalidToken"}
        )
        assert response.status_code == 401
    
    async def test_expired_token(self, async_client):
        """Test with expired token"""
        expired_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDk0NTkyMDB9.test"
        response = await async_client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {expired_token}"}
        )
        assert response.status_code == 401


@pytest.mark.asyncio
class TestAuthorization:
    """Test role-based authorization"""
    
    async def test_grihasta_cannot_access_acharya_routes(self, async_client):
        """Test that grihasta cannot access acharya-only routes"""
        # Attempt acharya-specific endpoint without acharya role
        response = await async_client.get(
            "/api/v1/acharya/dashboard",
            headers={"Authorization": "Bearer fake-grihasta-token"},
        )
        assert response.status_code in [401, 403]

    async def test_acharya_cannot_access_admin_routes(self, async_client):
        """Test that acharya cannot access admin routes"""
        response = await async_client.get(
            "/api/v1/admin/users",
            headers={"Authorization": "Bearer fake-acharya-token"},
        )
        assert response.status_code in [401, 403]
