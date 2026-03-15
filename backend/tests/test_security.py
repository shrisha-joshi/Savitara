"""Security Tests — headers, CORS, rate limiting, auth edge cases"""
import re

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

    @pytest.mark.asyncio
    async def test_correlation_id_echoed(self, client):
        """Incoming correlation ID should be echoed in response headers."""
        correlation_id = "corr-test-12345"
        response = await client.get("/health", headers={"X-Correlation-ID": correlation_id})
        assert response.status_code == 200
        assert response.headers.get("x-correlation-id") == correlation_id

    @pytest.mark.asyncio
    async def test_default_schema_version_header(self, client):
        """Responses should expose default schema version header."""
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.headers.get("x-api-schema-version") == "v1"

    @pytest.mark.asyncio
    async def test_supported_schema_version_header(self, client):
        """Supported schema version from request should be echoed back."""
        response = await client.get("/health", headers={"X-API-Schema-Version": "v1"})
        assert response.status_code == 200
        assert response.headers.get("x-api-schema-version") == "v1"

    @pytest.mark.asyncio
    async def test_unsupported_schema_version_rejected(self, client):
        """Unsupported schema version should return machine-readable 400 error."""
        response = await client.get("/health", headers={"X-API-Schema-Version": "v2"})
        assert response.status_code == 400
        body = response.json()
        assert body.get("success") is False
        assert body.get("error", {}).get("code") == "VAL_003"
        assert body.get("schema_version") == "v2"

    @pytest.mark.asyncio
    async def test_traceparent_is_continued_from_client(self, client):
        """Valid incoming traceparent should be continued with same trace-id and new span-id."""
        incoming_traceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
        incoming_tracestate = "rojo=00f067aa0ba902b7"

        response = await client.get(
            "/health",
            headers={
                "traceparent": incoming_traceparent,
                "tracestate": incoming_tracestate,
            },
        )

        assert response.status_code == 200
        response_traceparent = response.headers.get("traceparent")
        assert response_traceparent is not None
        match = re.match(
            r"^00-(?P<trace_id>[0-9a-f]{32})-(?P<span_id>[0-9a-f]{16})-(?P<flags>[0-9a-f]{2})$",
            response_traceparent,
        )
        assert match is not None
        assert match.group("trace_id") == "4bf92f3577b34da6a3ce929d0e0e4736"
        assert match.group("span_id") != "00f067aa0ba902b7"
        assert match.group("flags") == "01"
        assert response.headers.get("tracestate") == incoming_tracestate

    @pytest.mark.asyncio
    async def test_traceparent_is_generated_when_missing(self, client):
        """Middleware should generate a new traceparent when client header is absent."""
        response = await client.get("/health")
        assert response.status_code == 200
        response_traceparent = response.headers.get("traceparent")
        assert response_traceparent is not None
        assert re.match(
            r"^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$",
            response_traceparent,
        ) is not None


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

    @pytest.mark.asyncio
    async def test_http_error_taxonomy_shape(self, client):
        """HTTPException responses should include machine-readable error code + metadata."""
        response = await client.get("/api/v1/users/me")
        assert response.status_code == 401
        body = response.json()
        assert body.get("success") is False
        assert isinstance(body.get("error", {}).get("code"), str)
        assert isinstance(body.get("error", {}).get("message"), str)
        # request_id/correlation_id fields should exist in the standardized envelope
        assert "request_id" in body
        assert "correlation_id" in body
