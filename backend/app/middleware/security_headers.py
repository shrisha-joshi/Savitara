"""
Security Headers Middleware
Adds security headers to all responses to protect against common attacks.
SonarQube: S5122 - HTTP security headers
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from fastapi import Request

from app.core.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to every response.
    Recommended by OWASP.
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)
        # Build connect-src from configured ALLOWED_ORIGINS so we never hardcode
        # localhost in production (SEC-05).
        allowed = settings.ALLOWED_ORIGINS if isinstance(settings.ALLOWED_ORIGINS, list) else [settings.ALLOWED_ORIGINS]
        ws_origins = [
            o.replace("https://", "wss://").replace("http://", "ws://")
            for o in allowed
        ]
        connect_origins = " ".join(allowed + ws_origins)
        self._csp_connect_src = (
            f"'self' {connect_origins} "
            "https://*.googleapis.com https://api.razorpay.com"
        )

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Prevent MIME-sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking (allow from same origin if needed, but DENY is safer)
        # We might need to change this if we embed in iframes, but for now DENY is best.
        response.headers["X-Frame-Options"] = "DENY"

        # Enable XSS filtering in browsers that support it
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Force HTTPS (HSTS) - 1 year
        # Only effective if served over HTTPS, but good to have
        response.headers[
            "Strict-Transport-Security"
        ] = "max-age=31536000; includeSubDomains"

        # Control referrer information
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Content Security Policy (CSP) — SonarQube: S5122
        # connect-src is built from settings.ALLOWED_ORIGINS (no hardcoded localhost).
        # 'unsafe-inline' kept for style compatibility;
        # migrate to nonce-based CSP when frontend supports it.
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "img-src 'self' data: https:; "
            "script-src 'self' https://apis.google.com https://checkout.razorpay.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' data: https://fonts.gstatic.com; "
            f"connect-src {self._csp_connect_src}; "
            "frame-src 'self' https://api.razorpay.com;"
        )

        return response
