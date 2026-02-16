"""
Advanced Rate Limiting Middleware
Implements sliding window rate limiting with Redis
"""
from fastapi import Request, HTTPException, status
from redis.asyncio import Redis
import time
import logging
from typing import Dict, Tuple, Optional
from functools import wraps

logger = logging.getLogger(__name__)


class AdvancedRateLimiter:
    """
    Advanced rate limiting with sliding window algorithm
    Supports per-endpoint, per-user, and per-IP rate limits
    """

    def __init__(self, redis_client: Redis):
        self.redis = redis_client

        # Rate limit configurations (requests, window_seconds)
        self.endpoint_limits: Dict[str, Tuple[int, int]] = {
            "/api/v1/auth/login": (5, 300),  # 5 per 5 minutes
            "/api/v1/auth/register": (3, 3600),  # 3 per hour
            "/api/v1/bookings": (20, 60),  # 20 per minute
            "/api/v1/payments/create": (10, 60),  # 10 per minute
            "/api/v1/users/acharyas/search": (60, 60),  # 60 per minute
            "/api/v1/chat/messages": (100, 60),  # 100 per minute
        }

        # Default rate limit for unlisted endpoints
        self.default_limit = (100, 60)  # 100 per minute

        # Burst limits (max requests in short burst)
        self.burst_limits: Dict[str, int] = {
            "/api/v1/auth/login": 10,
            "/api/v1/payments/create": 5,
        }

    async def check_rate_limit(
        self, key: str, limit: int, window: int, burst_limit: Optional[int] = None
    ) -> Tuple[bool, Dict[str, int]]:
        """
        Check if request exceeds rate limit using sliding window

        Args:
            key: Unique identifier for rate limit (e.g., "user:123:/api/bookings")
            limit: Max requests allowed in window
            window: Time window in seconds
            burst_limit: Max requests in a very short burst (optional)

        Returns:
            (allowed, metadata) tuple
        """
        current_time = int(time.time())
        window_start = current_time - window

        try:
            # Remove old entries outside the window
            await self.redis.zremrangebyscore(key, 0, window_start)

            # Count requests in current window
            request_count = await self.redis.zcard(key)

            # Check burst limit (requests in last 5 seconds)
            if burst_limit:
                burst_start = current_time - 5
                burst_count = await self.redis.zcount(key, burst_start, current_time)
                if burst_count >= burst_limit:
                    metadata = {
                        "limit": limit,
                        "remaining": 0,
                        "reset": current_time + 5,
                        "burst_exceeded": True,
                    }
                    return False, metadata

            # Check main rate limit
            if request_count >= limit:
                # Get oldest request timestamp to calculate reset time
                oldest = await self.redis.zrange(key, 0, 0, withscores=True)
                reset_time = (
                    int(oldest[0][1]) + window if oldest else current_time + window
                )

                metadata = {
                    "limit": limit,
                    "remaining": 0,
                    "reset": reset_time,
                    "retry_after": reset_time - current_time,
                }
                return False, metadata

            # Add current request
            await self.redis.zadd(key, {str(current_time): current_time})

            # Set expiry on the key
            await self.redis.expire(key, window)

            metadata = {
                "limit": limit,
                "remaining": limit - request_count - 1,
                "reset": current_time + window,
            }

            return True, metadata

        except Exception as e:
            logger.error(f"Rate limit check failed: {e}")
            # Fail open - allow request if Redis is down
            return True, {
                "limit": limit,
                "remaining": limit,
                "reset": current_time + window,
            }

    async def check_request(self, request: Request) -> Tuple[bool, Dict[str, int]]:
        """
        Check if incoming request should be rate limited

        Returns:
            (allowed, metadata) tuple
        """
        # Identify request
        client_ip = request.client.host
        endpoint = request.url.path
        user_id = getattr(request.state, "user_id", None)

        # Get rate limit for endpoint
        limit, window = self.endpoint_limits.get(endpoint, self.default_limit)
        burst_limit = self.burst_limits.get(endpoint)

        # Create rate limit key
        # Priority: user_id > IP address
        identifier = f"user:{user_id}" if user_id else f"ip:{client_ip}"
        rate_limit_key = f"rate_limit:{identifier}:{endpoint}"

        return await self.check_rate_limit(rate_limit_key, limit, window, burst_limit)

    def get_rate_limit_headers(self, metadata: Dict[str, int]) -> Dict[str, str]:
        """Generate rate limit response headers"""
        return {
            "X-RateLimit-Limit": str(metadata["limit"]),
            "X-RateLimit-Remaining": str(metadata["remaining"]),
            "X-RateLimit-Reset": str(metadata["reset"]),
        }


async def rate_limit_middleware(
    request: Request, call_next, rate_limiter: AdvancedRateLimiter
):
    """
    Middleware function to apply rate limiting to requests
    """
    # Check rate limit
    allowed, metadata = await rate_limiter.check_request(request)

    if not allowed:
        # Rate limit exceeded
        headers = rate_limiter.get_rate_limit_headers(metadata)

        if metadata.get("burst_exceeded"):
            detail = "Too many requests in a short time. Please slow down."
        else:
            retry_after = metadata.get("retry_after", 60)
            detail = f"Rate limit exceeded. Try again in {retry_after} seconds."

        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            headers=headers,
        )

    # Process request
    response = await call_next(request)

    # Add rate limit headers to response
    headers = rate_limiter.get_rate_limit_headers(metadata)
    for key, value in headers.items():
        response.headers[key] = value

    return response


def rate_limit(requests: int, window: int):
    """
    Decorator for applying rate limits to specific endpoints

    Usage:
        @app.get("/api/endpoint")
        @rate_limit(requests=10, window=60)
        async def my_endpoint():
            ...
    """

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get request from kwargs
            request = kwargs.get("request")
            if not request:
                # Try to find in args
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break

            if request and hasattr(request.app.state, "rate_limiter"):
                rate_limiter = request.app.state.rate_limiter
                endpoint = request.url.path
                client_ip = request.client.host
                user_id = getattr(request.state, "user_id", None)

                identifier = f"user:{user_id}" if user_id else f"ip:{client_ip}"
                key = f"rate_limit:{identifier}:{endpoint}"

                allowed, metadata = await rate_limiter.check_rate_limit(
                    key, requests, window
                )

                if not allowed:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=f"Rate limit exceeded. Try again in {metadata.get('retry_after', window)} seconds.",
                        headers=rate_limiter.get_rate_limit_headers(metadata),
                    )

            return await func(*args, **kwargs)

        return wrapper

    return decorator
