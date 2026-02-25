"""
Application Startup & Shutdown Logic
SonarQube: S2095 - Proper resource management
Extracted from main.py for Single Responsibility Principle (SRP).
"""
import logging

from app.core.config import settings
from app.db.connection import DatabaseManager
from app.middleware.rate_limit import rate_limiter
from app.services.cache_service import cache
from app.services.websocket_manager import manager
from app.services.search_service import search_service
from app.services.query_optimizer import QueryOptimizer
from app.services.audit_service import AuditService
from app.middleware.advanced_rate_limit import AdvancedRateLimiter

logger = logging.getLogger(__name__)


async def _connect_database() -> None:
    """Connect to MongoDB with graceful error handling."""
    try:
        await DatabaseManager.connect_to_database()
    except Exception as e:
        logger.error(f"MongoDB connection failed: {e}")
        logger.warning(
            "Application starting without MongoDB - some features may not work"
        )


async def _connect_redis_services() -> None:
    """Connect Redis for rate limiting, caching and WebSocket Pub/Sub."""
    if not settings.REDIS_URL:
        logger.info("Redis services disabled (no REDIS_URL configured)")
        return

    for name, coro in [
        ("rate limiter", rate_limiter.connect_redis()),
        ("cache", cache.connect()),
        ("websocket pub/sub", manager.connect_redis()),
    ]:
        try:
            await coro
        except Exception as e:
            logger.warning(f"Redis {name} connection failed: {e}")


async def _initialize_search() -> None:
    """Initialize Elasticsearch; disabled by default, degrades gracefully."""
    if not settings.ENABLE_ELASTICSEARCH:
        logger.info("Search service disabled")
        return

    try:
        await search_service.create_index()
        logger.info("Search service initialized")
    except Exception as e:
        logger.warning(f"Search service initialization failed: {e}")


async def _create_db_indexes() -> None:
    """Create MongoDB performance indexes; skipped if DB is unavailable."""
    if DatabaseManager.client is None or DatabaseManager.db is None:
        logger.warning("Skipping index creation - database not connected")
        return

    try:
        db = DatabaseManager.db
        optimizer = QueryOptimizer(db)
        await optimizer.create_all_indexes()
        logger.info("Database indexes created")
    except Exception as e:
        logger.warning(f"Index creation failed: {e}")


async def _initialize_services_collection() -> None:
    """Seed services collection with default data on first run."""
    if DatabaseManager.db is None:
        return

    try:
        from app.db.init_services import initialize_services_collection  # type: ignore
        await initialize_services_collection(DatabaseManager.db)
    except ImportError:
        logger.warning("Services initialization module not found - skipping")
    except Exception as e:
        logger.warning(f"Services initialization failed: {e}")


async def startup(app) -> None:
    """
    Execute all startup tasks in order.
    Called from the lifespan context manager.
    """
    logger.info("Starting Savitara application...")

    await _connect_database()
    await _connect_redis_services()
    await _initialize_search()

    # Attach search service to app state for use in endpoints
    app.state.search_service = search_service

    await _create_db_indexes()
    await _initialize_services_collection()

    # Advanced rate limiter (requires Redis client reference)
    redis_client = getattr(rate_limiter, "redis_client", None)
    app.state.rate_limiter = AdvancedRateLimiter(redis_client)

    # Audit service (requires live DB)
    if DatabaseManager.db is not None:
        app.state.audit_service = AuditService(DatabaseManager.db)
    else:
        app.state.audit_service = None
        logger.warning("Audit service not initialized - database unavailable")

    logger.info("Application startup complete")


async def shutdown(app) -> None:  # noqa: ARG001 - app reserved for future use
    """
    Execute all shutdown tasks in reverse dependency order.
    Called from the lifespan context manager.
    """
    logger.info("Shutting down Savitara application...")

    await DatabaseManager.close_database_connection()
    await rate_limiter.close()
    await cache.disconnect()

    try:
        await search_service.close()
    except Exception as e:
        logger.error(f"Search service shutdown failed: {e}")

    logger.info("Application shutdown complete")
