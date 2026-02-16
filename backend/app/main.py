"""
FastAPI Main Application
SonarQube: S4502 - CSRF protection
SonarQube: S5122 - CORS configuration
SonarQube: S4830 - Certificate validation
"""
import warnings
# Suppress bcrypt/passlib warnings before any imports
warnings.filterwarnings("ignore", message=".*error reading bcrypt.*")
warnings.filterwarnings("ignore", category=UserWarning, module="passlib")

from fastapi import (
    FastAPI,
    Request,
    status,
    WebSocket,
    WebSocketDisconnect,
    HTTPException,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
import logging
import sys
import time

from app.core.config import settings
from app.core.security import SecurityManager
from app.core.exceptions import SavitaraException
from app.db.connection import DatabaseManager
from app.middleware.rate_limit import rate_limiter, handle_rate_limit_exceeded
from app.services.cache_service import cache
from app.services.websocket_manager import manager, process_websocket_message

# Include API routers
from app.api.v1 import (
    auth,
    users,
    bookings,
    chat,
    reviews,
    admin,
    panchanga,
    wallet,
    analytics,
    payments,
    admin_auth,
    content,
    calendar,
    calls,
    services,
    admin_services,
    upload,
    gamification,
)

from app.middleware.advanced_rate_limit import AdvancedRateLimiter
from app.middleware.compression import CompressionMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.services.query_optimizer import QueryOptimizer
from app.services.audit_service import AuditService
from app.services.search_service import search_service
from slowapi.errors import RateLimitExceeded  # type: ignore
import sentry_sdk

# Configure logging
import os
os.makedirs(os.path.dirname(settings.LOG_FILE), exist_ok=True)
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(settings.LOG_FILE),
    ],
)

# Sentry Initialization (Monitoring)
if settings.is_production:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN, traces_sample_rate=1.0, environment=settings.APP_ENV
    )

logger = logging.getLogger(__name__)

# API Documentation paths - SonarQube: S1192
API_DOCS_PATH = "/api/docs"
API_REDOC_PATH = "/api/redoc"
DOCS_PATH = "/docs"


async def _connect_database():
    """Connect to MongoDB with error handling"""
    try:
        await DatabaseManager.connect_to_database()
    except Exception as e:
        logger.error(f"MongoDB connection failed: {e}")
        logger.warning(
            "Application starting without MongoDB - some features may not work"
        )


async def _connect_redis_services():
    """Connect Redis for rate limiting, caching, and WebSocket"""
    if not settings.REDIS_URL:
        logger.info("Redis services disabled (no REDIS_URL configured)")
        return

    try:
        await rate_limiter.connect_redis()
    except Exception as e:
        logger.warning(f"Redis rate limiter connection failed: {e}")

    try:
        await cache.connect()
    except Exception as e:
        logger.warning(f"Redis cache connection failed: {e}")

    try:
        await manager.connect_redis()
    except Exception as e:
        logger.warning(f"WebSocket Redis connection failed: {e}")


async def _initialize_search():
    """Initialize Elasticsearch search service"""
    if not settings.ENABLE_ELASTICSEARCH:
        logger.info("Search service disabled")
        return

    try:
        await search_service.create_index()
        logger.info("Search service initialized")
    except Exception as e:
        logger.warning(f"Search service initialization failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan events
    SonarQube: S2095 - Proper resource management
    """
    # Startup
    logger.info("Starting Savitara application...")

    try:
        await _connect_database()
        await _connect_redis_services()
        await _initialize_search()
        app.search_service = search_service

        # Create database indexes for performance (non-blocking)
        try:
            # Check db connection before index creation
            if DatabaseManager.client is not None and DatabaseManager.db is not None:
                db = DatabaseManager.db
                optimizer = QueryOptimizer(db)
                await optimizer.create_all_indexes()
                logger.info("Database indexes created")

                # Initialize services collection with default data
                try:
                    from app.db.init_services import initialize_services_collection

                    await initialize_services_collection(db)
                except ImportError:
                    logger.warning(
                        "Services initialization module not found - skipping"
                    )
                except Exception as svc_error:
                    logger.warning(f"Services initialization failed: {svc_error}")
        except Exception as e:
            logger.warning(f"Index creation failed: {e}")

        # Initialize advanced rate limiter
        redis_client = None
        if hasattr(rate_limiter, "redis_client"):
            redis_client = rate_limiter.redis_client
        advanced_rate_limiter = AdvancedRateLimiter(redis_client)
        app.state.rate_limiter = advanced_rate_limiter

        # Initialize audit service (only if DB is available)
        if DatabaseManager.db is not None:
            app.state.audit_service = AuditService(DatabaseManager.db)
        else:
            app.state.audit_service = None
            logger.warning("Audit service not initialized - database unavailable")

        logger.info("Application startup complete")

        yield

    finally:
        # Shutdown
        logger.info("Shutting down Savitara application...")

        # Close MongoDB connection
        await DatabaseManager.close_database_connection()

        # Close Redis connection
        await rate_limiter.close()

        # Close cache Redis connection
        await cache.disconnect()

        # Close search service connection
        try:
            await search_service.close()
        except Exception as e:
            logger.error(f"Search service shutdown failed: {e}")

        logger.info("Application shutdown complete")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    description="Spiritual platform connecting Grihastas with Acharyas",
    version=settings.API_VERSION,
    docs_url=API_DOCS_PATH if settings.DEBUG else None,
    redoc_url=API_REDOC_PATH if settings.DEBUG else None,
    lifespan=lifespan,
)


# Compression Middleware - Compress responses for faster transfer
app.add_middleware(
    CompressionMiddleware,
    minimum_size=1024,  # Only compress responses > 1KB
    compression_level=6,  # Balanced compression
)

# Security Headers Middleware - SonarQube: S5122
app.add_middleware(SecurityHeadersMiddleware)

# CORS Middleware - SonarQube: S5122 - Properly configured
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
    expose_headers=[
        "X-Total-Count",
        "X-Request-ID",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
    ],
)


# Trusted Host Middleware - SonarQube: Security
if settings.is_production:
    app.add_middleware(
        TrustedHostMiddleware, allowed_hosts=["savitara.com", "*.savitara.com"]
    )


# Request ID and timing middleware
@app.middleware("http")
async def add_request_id_and_timing(request: Request, call_next):
    """
    Add request ID and measure response time
    SonarQube: Proper logging and monitoring
    """
    # Generate request ID
    request_id = f"{int(time.time() * 1000)}"
    request.state.request_id = request_id

    # Measure time
    start_time = time.time()

    # Process request
    response = await call_next(request)

    # Calculate duration
    process_time = time.time() - start_time

    # Add headers
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = str(process_time)

    # Fix for Firebase Auth COOP
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"

    # Log
    logger.info(
        f"Request: {request.method} {request.url.path} - "
        f"Status: {response.status_code} - "
        f"Duration: {process_time:.3f}s - "
        f"Request-ID: {request_id}"
    )

    return response


def get_cors_origin(request: Request) -> str:
    """Get the appropriate CORS origin from request"""
    origin = request.headers.get("origin", "")
    allowed = settings.ALLOWED_ORIGINS
    if isinstance(allowed, list):
        if origin in allowed:
            return origin
        return allowed[0] if allowed else "*"
    return origin if origin else "*"


def add_cors_headers(response: JSONResponse, request: Request) -> JSONResponse:
    """Add CORS headers to error responses"""
    response.headers["Access-Control-Allow-Origin"] = get_cors_origin(request)
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
    return response


# Exception Handlers
@app.exception_handler(SavitaraException)
async def savitara_exception_handler(request: Request, exc: SavitaraException):
    """Handle custom Savitara exceptions"""
    logger.error(f"Savitara Exception: {exc.error_code} - {exc.message}")
    response = JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.error_code,
                "message": exc.message,
                "details": exc.details,
            },
            "timestamp": time.time(),
            "request_id": getattr(request.state, "request_id", None),
        },
    )
    return add_cors_headers(response, request)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handle validation errors
    SonarQube: Proper input validation
    """
    logger.warning(f"Validation Error: {exc.errors()}")
    response = JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={
            "success": False,
            "error": {
                "code": "VAL_001",
                "message": "Validation failed",
                "details": exc.errors(),
            },
            "timestamp": time.time(),
            "request_id": getattr(request.state, "request_id", None),
        },
    )
    return add_cors_headers(response, request)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Handle rate limit exceeded"""
    return handle_rate_limit_exceeded(request, exc)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with CORS headers"""
    # Handle structured detail from get_db()
    if isinstance(exc.detail, dict):
        content = exc.detail
    else:
        content = {
            "success": False,
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": exc.detail,
                "details": {},
            },
            "timestamp": time.time(),
            "request_id": getattr(request.state, "request_id", None),
        }

    response = JSONResponse(status_code=exc.status_code, content=content)
    return add_cors_headers(response, request)


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """
    Handle unexpected exceptions
    SonarQube: S1181 - Catch specific exceptions
    """
    logger.error(f"Unhandled Exception: {str(exc)}", exc_info=True)

    # Check if it's a database-related RuntimeError
    error_message = str(exc)
    if "Database" in error_message or "database" in error_message:
        response = JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "success": False,
                "error": {
                    "code": "DB_001",
                    "message": "Database service unavailable. Please try again later.",
                    "details": {},
                },
                "timestamp": time.time(),
                "request_id": getattr(request.state, "request_id", None),
            },
        )
    else:
        response = JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": {
                    "code": "SERVER_001",
                    "message": "Internal server error"
                    if settings.is_production
                    else str(exc),
                    "details": {},
                },
                "timestamp": time.time(),
                "request_id": getattr(request.state, "request_id", None),
            },
        )

    return add_cors_headers(response, request)


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint - Always returns healthy for Railway deployment
    Database status is informational only
    SonarQube: Required for monitoring
    """
    db_status = "initializing"
    try:
        # Check database connection (non-blocking)
        if DatabaseManager.db is not None:
            await DatabaseManager.db.command("ping")
            db_status = "healthy"
    except Exception as e:
        logger.warning(f"Database health check: {e}")
        db_status = "connecting"

    # Always return healthy status for Railway healthcheck
    # Database can be connecting in background
    return {
        "status": "healthy",
        "version": settings.API_VERSION,
        "environment": settings.APP_ENV,
        "components": {"database": db_status, "api": "healthy"},
    }


# Temporary test endpoint for debugging database connection
@app.get("/test-db", tags=["Debug"])
async def test_database_connection():
    """
    Test database connection - TEMPORARY ENDPOINT FOR DEBUGGING
    Remove this endpoint after fixing deployment issues
    """
    try:
        if DatabaseManager.client is None:
            return {
                "status": "error",
                "message": "Database client not initialized",
                "mongodb_url": settings.MONGODB_URL[:50] + "..." if settings.MONGODB_URL else None
            }

        # Test connection
        await DatabaseManager.client.admin.command("ping")

        # Test database access
        db = DatabaseManager.db
        if db is None:
            return {"status": "error", "message": "Database not initialized"}

        # Get collection count
        collections = await db.list_collection_names()
        user_count = await db.users.count_documents({})

        return {
            "status": "success",
            "message": "Database connection successful",
            "database": settings.MONGODB_DB_NAME,
            "collections": len(collections),
            "user_count": user_count,
            "mongodb_url": settings.MONGODB_URL[:50] + "..." if settings.MONGODB_URL else None
        }

    except Exception as e:
        logger.error(f"Database test failed: {e}", exc_info=True)
        return {
            "status": "error",
            "message": f"Database connection failed: {str(e)}",
            "mongodb_url": settings.MONGODB_URL[:50] + "..." if settings.MONGODB_URL else None
        }


# Simple readiness probe for Railway
@app.get("/", tags=["Root"], status_code=200)
async def root():
    """Root endpoint - always returns 200 OK"""
    return {
        "message": "Savitara API is running",
        "status": "ok",
        "version": settings.API_VERSION,
        "docs": API_DOCS_PATH if settings.DEBUG else DOCS_PATH,
    }


# API Info endpoint
@app.get("/api", tags=["Root"])
async def api_info():
    """API information endpoint"""
    return {
        "message": "Welcome to Savitara API",
        "version": settings.API_VERSION,
        "docs": API_DOCS_PATH if settings.DEBUG else None,
    }

API_V1_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_V1_PREFIX)
app.include_router(users.router, prefix=API_V1_PREFIX)
app.include_router(bookings.router, prefix=API_V1_PREFIX)
app.include_router(chat.router, prefix=API_V1_PREFIX)
app.include_router(calls.router, prefix=API_V1_PREFIX)  # Added Calls Router
app.include_router(reviews.router, prefix=API_V1_PREFIX)
app.include_router(admin.router, prefix=API_V1_PREFIX)
app.include_router(admin_auth.router, prefix=API_V1_PREFIX)  # Admin email/password auth
app.include_router(panchanga.router, prefix=API_V1_PREFIX)
app.include_router(calendar.router, prefix=API_V1_PREFIX)  # Calendar and scheduling
app.include_router(wallet.router, prefix=API_V1_PREFIX)
app.include_router(payments.router, prefix=API_V1_PREFIX)
app.include_router(analytics.router, prefix=API_V1_PREFIX)
app.include_router(content.router, prefix=API_V1_PREFIX)  # Admin content management
app.include_router(
    content.public_router, prefix=API_V1_PREFIX
)  # Public content endpoints
app.include_router(services.router, prefix=API_V1_PREFIX)  # Services catalog
app.include_router(
    admin_services.router, prefix=API_V1_PREFIX
)  # Admin services management
app.include_router(
    upload.router, prefix=API_V1_PREFIX, tags=["Upload"]
)  # File upload endpoints
app.include_router(
    gamification.router, prefix=API_V1_PREFIX, tags=["Gamification"]
)  # Gamification system


# WebSocket endpoint for real-time communication
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, token: str = None):
    """
    WebSocket endpoint for real-time features:
    - Chat messages
    - Booking updates
    - Notifications
    - Online status

    Requires 'token' query parameter for authentication.
    """
    # Verify token before connecting
    try:
        if not token:
            logger.warning(
                f"WebSocket connection attempt without token for user {user_id}"
            )
            await websocket.close(code=1008, reason="Token required")
            return

        # Verify JWT token
        # Note: We catch the HTTPException from verify_token as we need to close the socket gracefully
        try:
            payload = SecurityManager.verify_token(token)
        except HTTPException:
            logger.warning(f"Invalid token for WebSocket connection user {user_id}")
            await websocket.close(code=1008, reason="Invalid token")
            return

        # Verify user_id matches token subject
        token_sub = payload.get("sub")
        if not token_sub or token_sub != user_id:
            logger.warning(
                f"Token user mismatch: token={token_sub}, requested={user_id}"
            )
            await websocket.close(code=1008, reason="User mismatch")
            return

    except Exception as e:
        logger.error(f"WebSocket auth error: {e}")
        try:
            await websocket.close(code=1011, reason="Authentication error")
        except RuntimeError:
            pass  # Socket might be already closed
        return

    await manager.connect(user_id, websocket)

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()

            # Process message
            await process_websocket_message(user_id, data)

    except WebSocketDisconnect:
        manager.disconnect(user_id)
        logger.info(f"User {user_id} disconnected from WebSocket")
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        manager.disconnect(user_id)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
