"""
Security Headers Middleware
Adds security headers to all responses to protect against common attacks.
SonarQube: S5122 - HTTP security headers
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from fastapi import Request

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to every response.
    Recommended by OWASP.
    """
    def __init__(self, app: ASGIApp):
        super().__init__(app)

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
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        # Control referrer information
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Content Security Policy (CSP)
        # This is a basic policy. In production, this should be tightened.
        # We allow scripts from self, unsafe-inline (needed for some frontend frameworks), and common CDNs.
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "img-src 'self' data: https:; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' data: https://fonts.gstatic.com; "
            "connect-src 'self' http://localhost:8000 ws://localhost:8000 https://*.googleapis.com;"
        )
        
        return response
