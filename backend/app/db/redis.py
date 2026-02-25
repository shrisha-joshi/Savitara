"""
Redis Async Dependency
SonarQube: S2095 - Resources are properly closed via generator dependency
"""
from typing import AsyncGenerator, Optional

from redis.asyncio import Redis, from_url

from app.core.config import settings


async def get_redis() -> AsyncGenerator[Optional[Redis], None]:
    """
    FastAPI dependency that yields an async Redis client and closes it afterwards.
    Yields None if Redis is not configured (REDIS_URL unset) so callers can
    gracefully degrade instead of raising a connection error.

    Usage:
        redis: Optional[Redis] = Depends(get_redis)
    """
    if not settings.REDIS_URL:
        yield None
        return

    client: Redis = from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
    )
    try:
        yield client
    finally:
        await client.aclose()


async def blacklist_token(redis: Redis, jti: str, expires_in_seconds: int) -> None:
    """Add a JWT ID to the token blacklist with automatic expiry."""
    await redis.setex(f"blacklist:{jti}", expires_in_seconds, "1")


async def is_token_blacklisted(redis: Redis, jti: str) -> bool:
    """Return True if the token JTI is on the blacklist."""
    return await redis.exists(f"blacklist:{jti}") == 1
