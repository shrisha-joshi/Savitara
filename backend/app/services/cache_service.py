"""
Redis Caching Service
"""
import redis.asyncio as redis
import json
import asyncio
import time
from typing import Optional, Any, List, Callable, Awaitable
from datetime import timedelta
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class CacheService:
    """
    Redis-based caching service for:
    - API responses
    - User sessions
    - Frequently accessed data
    - Rate limiting counters
    """
    
    def __init__(self):
        self.redis: Optional[redis.Redis] = None
        self.default_ttl = settings.CACHE_TTL
        self.l1_cache: dict = {}  # {key: (value, timestamp)}
    
    async def connect(self):
        """Initialize Redis connection"""
        try:
            self.redis = await redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
            await self.redis.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self.redis = None
    
    async def disconnect(self):
        """Close Redis connection"""
        if self.redis:
            await self.redis.close()
            logger.info("Redis connection closed")
            
    async def get_or_compute(
        self, 
        key: str, 
        compute_func: Callable[[], Awaitable[Any]], 
        expire: Optional[int] = None, 
        use_l1_cache: bool = False, 
        l1_expire: int = 5
    ) -> Any:
        """
        Get from cache or compute safely (Thundering Herd Protection).
        Includes L1 RAM cache support for Hot Keys.
        """
        if expire is None:
            expire = self.default_ttl

        # 1. Check L1 Cache (Hot Key Protection)
        if use_l1_cache and key in self.l1_cache:
            value, timestamp = self.l1_cache[key]
            if time.time() - timestamp < l1_expire:
                return value
            del self.l1_cache[key]

        # 2. Check Redis Cache
        value = await self.get(key)
        if value is not None:
             if use_l1_cache:
                  self.l1_cache[key] = (value, time.time())
             return value

        # 3. Compute with Locking (Thundering Herd Protection)
        return await self._compute_with_lock(key, compute_func, expire, use_l1_cache)

    async def _compute_with_lock(self, key, compute_func, expire, use_l1_cache):
        lock_key = f"lock:{key}"
        if not self.redis:
             return await compute_func()
        
        try:
             # Try to acquire lock
             acquired = await self.redis.set(lock_key, "1", nx=True, ex=10) # 10s lock timeout
             
             if acquired:
                  try:
                       result = await compute_func()
                       await self.set(key, result, expire)
                       if use_l1_cache:
                            self.l1_cache[key] = (result, time.time())
                       return result
                  finally:
                       await self.redis.delete(lock_key)
             else:
                  # Lock busy, wait and retry
                  for _ in range(20): # Try for 2 seconds (20 * 0.1s)
                       await asyncio.sleep(0.1)
                       value = await self.get(key)
                       if value is not None:
                            if use_l1_cache:
                                 self.l1_cache[key] = (value, time.time())
                            return value
                  
                  # If still no value, fallback to compute
                  return await compute_func()
        except Exception as e:
             logger.error(f"Error in get_or_compute: {e}")
             return await compute_func()
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if not self.redis:
            return None
        
        try:
            value = await self.redis.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.error(f"Cache get error for key {key}: {e}")
            return None
    
    async def set(
        self,
        key: str,
        value: Any,
        expire: Optional[int] = None
    ) -> bool:
        """Set value in cache"""
        if not self.redis:
            return False
        
        try:
            serialized = json.dumps(value, default=str)
            if expire is None:
                expire = self.default_ttl
            
            await self.redis.set(key, serialized, ex=expire)
            logger.debug(f"Cached key {key} with TTL {expire}s")
            return True
        except Exception as e:
            logger.error(f"Cache set error for key {key}: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete key from cache"""
        if not self.redis:
            return False
        
        try:
            await self.redis.delete(key)
            logger.debug(f"Deleted cache key {key}")
            return True
        except Exception as e:
            logger.error(f"Cache delete error for key {key}: {e}")
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern"""
        if not self.redis:
            return 0
        
        try:
            keys = []
            async for key in self.redis.scan_iter(match=pattern):
                keys.append(key)
            
            if keys:
                deleted = await self.redis.delete(*keys)
                logger.info(f"Deleted {deleted} keys matching pattern {pattern}")
                return deleted
            return 0
        except Exception as e:
            logger.error(f"Cache pattern delete error for {pattern}: {e}")
            return 0
    
    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        if not self.redis:
            return False
        
        try:
            return await self.redis.exists(key) > 0
        except Exception as e:
            logger.error(f"Cache exists error for key {key}: {e}")
            return False
    
    async def increment(self, key: str, amount: int = 1, expire: Optional[int] = None) -> int:
        """Increment counter (for rate limiting)"""
        if not self.redis:
            return 0
        
        try:
            value = await self.redis.incrby(key, amount)
            if expire and value == amount:  # First increment
                await self.redis.expire(key, expire)
            return value
        except Exception as e:
            logger.error(f"Cache increment error for key {key}: {e}")
            return 0
    
    async def get_many(self, keys: List[str]) -> List[Optional[Any]]:
        """Get multiple values"""
        if not self.redis:
            return [None] * len(keys)
        
        try:
            values = await self.redis.mget(keys)
            return [json.loads(v) if v else None for v in values]
        except Exception as e:
            logger.error(f"Cache get_many error: {e}")
            return [None] * len(keys)
    
    async def set_many(self, mapping: dict, expire: Optional[int] = None) -> bool:
        """Set multiple values"""
        if not self.redis:
            return False
        
        try:
            serialized = {k: json.dumps(v, default=str) for k, v in mapping.items()}
            await self.redis.mset(serialized)
            
            if expire:
                for key in mapping.keys():
                    await self.redis.expire(key, expire)
            
            logger.debug(f"Cached {len(mapping)} keys")
            return True
        except Exception as e:
            logger.error(f"Cache set_many error: {e}")
            return False
    
    async def clear_all(self) -> bool:
        """Clear all cache (use with caution)"""
        if not self.redis:
            return False
        
        try:
            await self.redis.flushdb()
            logger.warning("Cleared all cache")
            return True
        except Exception as e:
            logger.error(f"Cache clear error: {e}")
            return False
    
    # Helper methods for common caching patterns
    
    def user_cache_key(self, user_id: str) -> str:
        """Generate cache key for user"""
        return f"user:{user_id}"
    
    def acharya_cache_key(self, acharya_id: str) -> str:
        """Generate cache key for acharya"""
        return f"acharya:{acharya_id}"
    
    def booking_cache_key(self, booking_id: str) -> str:
        """Generate cache key for booking"""
        return f"booking:{booking_id}"
    
    def search_cache_key(self, query_params: dict) -> str:
        """Generate cache key for search results"""
        sorted_params = sorted(query_params.items())
        params_str = "_".join(f"{k}={v}" for k, v in sorted_params)
        return f"search:{params_str}"
    
    async def cache_user(self, user_id: str, user_data: dict, ttl: int = 600):
        """Cache user data (10 minutes default)"""
        await self.set(self.user_cache_key(user_id), user_data, expire=ttl)
    
    async def get_cached_user(self, user_id: str) -> Optional[dict]:
        """Get cached user data"""
        return await self.get(self.user_cache_key(user_id))
    
    async def invalidate_user(self, user_id: str):
        """Invalidate user cache"""
        await self.delete(self.user_cache_key(user_id))
        await self.delete_pattern(f"user:{user_id}:*")


# Global cache instance
cache = CacheService()


# Dependency for FastAPI
def get_cache() -> CacheService:
    """Get cache service instance"""
    return cache


async def get_cache_client():
    """Get the underlying Redis client for direct access"""
    if cache.redis is None:
        await cache.connect()
    return cache.redis
