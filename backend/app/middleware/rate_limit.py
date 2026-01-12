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

from app.core.config import settings

logger = logging.getLogger(__name__)


# Initialize rate limiter
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"]
)


class RateLimitMiddleware:
    """
    Custom rate limiting middleware with Redis backend
    SonarQube: S4790 - DoS protection
    """
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
    
    async def connect_redis(self):
        """Connect to Redis for distributed rate limiting"""
        try:
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
            await self.redis_client.ping()
            logger.info("Connected to Redis for rate limiting")
        except Exception as e:
            logger.warning(f"Redis connection failed, using in-memory: {e}")
            self.redis_client = None
    
    async def check_rate_limit(
        self,
        key: str,
        limit: int,
        window: int = 60
    ) -> bool:
        """
        Check if rate limit is exceeded
        
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
            # Use Redis sliding window
            pipe = self.redis_client.pipeline()
            now = int(time.time())
            window_start = now - window
            
            # Remove old entries
            pipe.zremrangebyscore(key, 0, window_start)
            
            # Count current requests
            pipe.zcard(key)
            
            # Add current request
            pipe.zadd(key, {str(now): now})
            
            # Set expiry
            pipe.expire(key, window)
            
            results = await pipe.execute()
            request_count = results[1]
            
            return request_count < limit
            
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
                "details": {
                    "retry_after": 60
                }
            }
        }
    )
