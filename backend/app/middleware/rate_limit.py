"""
Rate Limiting Middleware
SonarQube: S4790 - Protect against DoS attacks
"""
from fastapi import Request, HTTPException, status
from slowapi import Limiter  # type: ignore
from slowapi.util import get_remote_address  # type: ignore
from slowapi.errors import RateLimitExceeded  # type: ignore
import redis.asyncio as redis
from typing import Optional
import logging
import time
import uuid

from app.core.config import settings

logger = logging.getLogger(__name__)

# Lua script for atomic sliding-window rate limiting.
# KEYS[1] = the rate-limit key
# ARGV[1] = window_start (oldest allowed timestamp)
# ARGV[2] = now (current timestamp, used as score)
# ARGV[3] = unique member id
# ARGV[4] = window TTL in seconds
# ARGV[5] = limit
# Returns 1 (allowed) or 0 (rate-limited)
_SLIDING_WINDOW_LUA = """
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1])
local count = redis.call('ZCARD', KEYS[1])
if count < tonumber(ARGV[5]) then
    redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))
    return 1
end
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))
return 0
"""


# Initialize rate limiter
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"],
)


class RateLimitMiddleware:
    """
    Custom rate limiting middleware with Redis backend
    SonarQube: S4790 - DoS protection
    """

    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self._lua_sha: Optional[str] = None

    async def connect_redis(self):
        """Connect to Redis for distributed rate limiting"""
        try:
            self.redis_client = redis.from_url(
                settings.REDIS_URL, encoding="utf-8", decode_responses=True
            )
            await self.redis_client.ping()
            # Pre-load the Lua script so each call uses EVALSHA (faster)
            self._lua_sha = await self.redis_client.script_load(_SLIDING_WINDOW_LUA)
            logger.info("Connected to Redis for rate limiting")
        except Exception as e:
            logger.warning(f"Redis connection failed, using in-memory: {e}")
            self.redis_client = None
            self._lua_sha = None

    async def check_rate_limit(self, key: str, limit: int, window: int = 60) -> bool:
        """
        Atomic sliding-window rate limit check using a server-side Lua script.

        Args:
            key: Unique identifier (IP or user ID)
            limit: Maximum requests allowed
            window: Time window in seconds

        Returns:
            True if allowed, False if rate limit exceeded
        """
        if not self.redis_client:
            # Fallback to allowing request if Redis unavailable
            return True

        try:
            now = int(time.time())
            window_start = now - window
            member_id = f"{now}:{uuid.uuid4().hex[:8]}"

            if self._lua_sha:
                result = await self.redis_client.evalsha(
                    self._lua_sha,
                    1,
                    key,
                    str(window_start),
                    str(now),
                    member_id,
                    str(window),
                    str(limit),
                )
            else:
                # Fallback: load script on the fly
                result = await self.redis_client.eval(
                    _SLIDING_WINDOW_LUA,
                    1,
                    key,
                    str(window_start),
                    str(now),
                    member_id,
                    str(window),
                    str(limit),
                )

            return result == 1

        except Exception as e:
            logger.error(f"Rate limit check failed: {e}")
            return True  # Allow on error

    async def close(self):
        """Close Redis connection"""
        if self.redis_client:
            await self.redis_client.close()


# Global rate limiter instance
rate_limiter = RateLimitMiddleware()


def get_rate_limiter() -> RateLimitMiddleware:
    """Dependency to get rate limiter"""
    return rate_limiter


def handle_rate_limit_exceeded(request: Request, exc: RateLimitExceeded):
    """
    Handle rate limit exceeded
    SonarQube: Proper error response
    """
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "success": False,
            "error": {
                "code": "RATE_LIMIT_001",
                "message": "Too many requests. Please try again later.",
                "details": {"retry_after": 60},
            },
        },
    )
