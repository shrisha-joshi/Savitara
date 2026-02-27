"""
Redis Async Dependency
SonarQube: S2095 - Resources are properly closed via generator dependency
Uses a module-level connection pool to avoid creating a new TCP connection per request.
"""
import logging
from typing import AsyncGenerator, Optional

from redis.asyncio import ConnectionPool, Redis, from_url

from app.core.config import settings

logger = logging.getLogger(__name__)

# Module-level connection pool — reused across all requests
_pool: Optional[ConnectionPool] = None


def _get_pool() -> Optional[ConnectionPool]:
    """Lazily initialise and return the shared Redis connection pool."""
    global _pool  # noqa: PLW0603
    if _pool is not None:
        return _pool
    if not settings.REDIS_URL:
        return None
    _pool = ConnectionPool.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
        max_connections=20,
    )
    return _pool


async def get_redis() -> AsyncGenerator[Optional[Redis], None]:
    """
    FastAPI dependency that yields an async Redis client backed by a shared
    connection pool.  Yields ``None`` if Redis is not configured so callers
    can gracefully degrade.

    Usage::

        redis: Optional[Redis] = Depends(get_redis)
    """
    pool = _get_pool()
    if pool is None:
        yield None
        return

    client = Redis(connection_pool=pool)
    try:
        yield client
    finally:
        await client.aclose()


async def close_pool() -> None:
    """Drain the shared pool on application shutdown."""
    global _pool  # noqa: PLW0603
    if _pool is not None:
        await _pool.disconnect()
        _pool = None


async def blacklist_token(redis: Redis, jti: str, expires_in_seconds: int) -> None:
    """Add a JWT ID to the token blacklist with automatic expiry."""
    await redis.setex(f"blacklist:{jti}", expires_in_seconds, "1")


async def is_token_blacklisted(redis: Redis, jti: str) -> bool:
    """Return True if the token JTI is on the blacklist."""
    return await redis.exists(f"blacklist:{jti}") == 1
