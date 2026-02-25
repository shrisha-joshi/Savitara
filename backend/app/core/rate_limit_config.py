"""
Rate Limit Configuration (SOLID: Open-Closed Principle)
-----------------------------------------------------
All rate-limit rules are defined here, not embedded in middleware code.
To add or tune a limit, change this file only — no middleware changes needed.

Format:  endpoint path  → (max_requests, window_seconds, optional_burst)
"""
from typing import Dict, Tuple, Optional


# ---------------------------------------------------------------------------
# Type alias for readability
# (max_requests, window_seconds)
RateLimitRule = Tuple[int, int]

# ---------------------------------------------------------------------------
# Per-endpoint limits
# Overrides the global default for specific high-sensitivity paths.
ENDPOINT_LIMITS: Dict[str, RateLimitRule] = {
    # Auth — aggressively limited to prevent brute-force / credential stuffing
    "/api/v1/auth/login": (5, 300),          # 5 per 5 minutes
    "/api/v1/auth/register": (3, 3600),      # 3 per hour
    "/api/v1/auth/refresh": (10, 300),       # 10 per 5 minutes
    "/api/v1/auth/google": (10, 300),        # 10 per 5 minutes (OAuth)

    # Bookings — moderate, prevents spam booking creation
    "/api/v1/bookings": (20, 60),            # 20 per minute

    # Payments — strict to prevent fraud
    "/api/v1/payments/create": (10, 60),     # 10 per minute
    "/api/v1/payments/webhook": (200, 60),   # High — Razorpay can batch webhooks

    # Search — generous, but capped to prevent scraping
    "/api/v1/users/acharyas/search": (60, 60),  # 60 per minute

    # Chat — high throughput needed for real-time feel
    "/api/v1/chat/messages": (100, 60),      # 100 per minute
    "/api/v1/chat/send": (100, 60),          # 100 per minute

    # Admin — stricter than user-facing (admins don't need bulk)
    "/api/v1/admin": (50, 60),               # 50 per minute across admin routes

    # Upload — heavy operations
    "/api/v1/upload": (20, 60),              # 20 per minute
}

# ---------------------------------------------------------------------------
# Global default — applied to any path not listed above
DEFAULT_LIMIT: RateLimitRule = (100, 60)     # 100 per minute

# ---------------------------------------------------------------------------
# Burst limits — max requests allowed in a SHORT window (5 seconds)
# None means burst protection is disabled for that path.
BURST_LIMITS: Dict[str, int] = {
    "/api/v1/auth/login": 10,
    "/api/v1/payments/create": 5,
    "/api/v1/upload": 5,
}

# ---------------------------------------------------------------------------
# Helper functions (Open-Closed: callers extend via config, not code)

def get_endpoint_limit(path: str) -> RateLimitRule:
    """
    Return (max_requests, window_seconds) for the given endpoint path.
    Falls back to DEFAULT_LIMIT for unlisted paths.
    Uses prefix matching so e.g. '/api/v1/admin/users' hits '/api/v1/admin'.
    """
    # Exact match first
    if path in ENDPOINT_LIMITS:
        return ENDPOINT_LIMITS[path]

    # Prefix match (longest matching prefix wins)
    matched_prefix = ""
    for prefix, limit in ENDPOINT_LIMITS.items():
        if path.startswith(prefix) and len(prefix) > len(matched_prefix):
            matched_prefix = prefix

    return ENDPOINT_LIMITS[matched_prefix] if matched_prefix else DEFAULT_LIMIT


def get_burst_limit(path: str) -> Optional[int]:
    """
    Return burst limit for path, or None if burst protection is not configured.
    """
    if path in BURST_LIMITS:
        return BURST_LIMITS[path]

    # Prefix match
    for prefix, burst in BURST_LIMITS.items():
        if path.startswith(prefix):
            return burst

    return None
