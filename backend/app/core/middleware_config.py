"""
Middleware Registration
SonarQube: S5122 - Properly configured CORS
Extracted from main.py for Single Responsibility Principle (SRP).
All middleware is registered in one place via register_middleware().
"""
import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.core.config import settings
from app.middleware.compression import CompressionMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.utils.logging_config import set_correlation_id

logger = logging.getLogger(__name__)


def register_middleware(app: FastAPI) -> None:
    """
    Register all application middleware in correct order.
    Order matters: last-added middleware runs first (LIFO for request phase).

        Registered (outermost → innermost):
            1. Compression      - gzip/brotli responses
            2. Security Headers - HSTS, CSP, X-Frame-Options, etc.
            3. TrustedHost      - production only: block unknown vhosts
            4. CORS             - cross-origin request handling (must be last add_middleware)
            5. Request ID / Timing - attach X-Request-ID + X-Process-Time
    """

    # 1. Compression (outermost, comes first in response pipeline)
    app.add_middleware(
        CompressionMiddleware,
        minimum_size=1024,      # Only compress responses > 1 KB
        compression_level=6,    # Balanced speed / size tradeoff
    )

    # 2. Security headers
    app.add_middleware(SecurityHeadersMiddleware)

    # 3. Trusted host (production only)
    if settings.is_production:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=["savitara.com", "*.savitara.com"],
        )

    # 4. CORS — SonarQube: S5122 — no wildcard origins in production
    # NOTE: Added after other add_middleware registrations by lint/security rule.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=[
            "X-Total-Count",
            "X-Request-ID",
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset",
            "X-Correlation-ID",
        ],
        max_age=86400,          # Cache preflight for 24 hours
    )

    # 5. Request ID + timing (innermost — runs for every request)
    @app.middleware("http")
    async def add_request_id_and_timing(request: Request, call_next):
        """
        Attach a unique request ID and measure end-to-end latency.
        Fixes Firebase Auth COOP header as well.
        SonarQube: Proper logging and monitoring
        """
        incoming_correlation_id = request.headers.get("X-Correlation-ID")
        correlation_id = incoming_correlation_id or str(uuid.uuid4())
        request_id = str(int(time.time() * 1000))
        request.state.request_id = request_id
        request.state.correlation_id = correlation_id
        set_correlation_id(correlation_id)

        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Correlation-ID"] = correlation_id
        response.headers["X-Process-Time"] = str(process_time)
        # Fix for Firebase Auth cross-origin popup
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"

        logger.info(
            "Request: %s %s — Status: %s — Duration: %.3fs — Request-ID: %s",
            request.method,
            request.url.path,
            response.status_code,
            process_time,
            request_id,
        )
        set_correlation_id("")

        return response
