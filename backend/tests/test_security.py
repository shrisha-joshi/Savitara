"""Security Tests — headers, CORS, rate limiting, auth edge cases"""
import pytest


class TestSecurityHeaders:
    """Verify security-related HTTP headers"""

    @pytest.mark.asyncio
    async def test_health_returns_security_headers(self, client):
        """Test that /health endpoint returns security headers from middleware"""
        response = await client.get("/health")
        assert response.status_code == 200
        headers = response.headers
        # Expect at least X-Content-Type-Options from security headers middleware
        assert headers.get("x-content-type-options") == "nosniff"

    @pytest.mark.asyncio
    async def test_cors_preflight(self, client):
        """Test CORS preflight response"""
        response = await client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type,Authorization",
            },
        )
        # FastAPI CORS middleware should return 200 with proper headers
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_no_server_version_leak(self, client):
        """Ensure server header does not expose version info"""
        response = await client.get("/health")
        server_header = response.headers.get("server", "")
        # Should not contain version numbers
        assert "uvicorn" not in server_header.lower() or "0." not in server_header


class TestAuthEdgeCases:
    """Edge-case authentication tests"""

    @pytest.mark.asyncio
    async def test_sql_injection_in_login(self, client):
        """Test that SQL/NoSQL injection payloads are rejected"""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": {"$gt": ""},
                "password": {"$gt": ""},
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_jwt_none_algorithm_attack(self, client):
        """Test that 'none' algorithm JWT is rejected"""
        # Header: {"alg":"none","typ":"JWT"}, Payload: {"sub":"admin"}
        fake_token = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiJ9."
        response = await client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {fake_token}"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_empty_bearer_token(self, client):
        """Test request with empty bearer token"""
        response = await client.get(
            "/api/v1/users/me",
            headers={"Authorization": "Bearer "},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_extremely_long_token(self, client):
        """Test request with excessively long token"""
        long_token = "x" * 10000
        response = await client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {long_token}"},
        )
        assert response.status_code == 401
