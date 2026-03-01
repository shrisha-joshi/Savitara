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

from typing import Optional
from fastapi import (
    FastAPI,
    Request,
    status,
    WebSocket,
    WebSocketDisconnect,
    HTTPException,
)
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
import logging
import sys
import time

from app.core.config import settings
from app.core.lifespan import lifespan          # extracted: async context manager
from app.core.middleware_config import register_middleware  # extracted: all middleware
from app.core.security import SecurityManager
from app.core.exceptions import SavitaraException
from app.db.connection import DatabaseManager
from app.middleware.rate_limit import handle_rate_limit_exceeded
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
    reactions,
    conversation_settings,
    voice,
    forwarding,
    moderation,
    group_admin,
    strategy_features,
    trust,  # Trust score and dispute resolution
    investor_metrics,  # Investor dashboard metrics
)

from slowapi.errors import RateLimitExceeded  # type: ignore
import sentry_sdk

# Configure logging
import os
_log_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "logs", "savitara.log")
_log_file = os.path.normpath(_log_file)
os.makedirs(os.path.dirname(_log_file), exist_ok=True)
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[  # noqa: E501
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(_log_file),
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


# Startup/shutdown logic lives in app.core.startup (SRP).
# Lifespan context manager lives in app.core.lifespan (SRP).


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    description="Spiritual platform connecting Grihastas with Acharyas",
    version=settings.API_VERSION,
    docs_url=API_DOCS_PATH if settings.DEBUG else None,
    redoc_url=API_REDOC_PATH if settings.DEBUG else None,
    lifespan=lifespan,
)


# All middleware registered in app.core.middleware_config (SRP).
register_middleware(app)


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
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
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


@app.get("/health/ws", tags=["Health"])
async def websocket_health():
    """WebSocket health probe: reports redis + active connection counts."""
    redis_status = "unconfigured" if not settings.REDIS_URL else "initializing"
    try:
        if manager.redis_client:
            await manager.redis_client.ping()
            redis_status = "healthy"
        elif settings.REDIS_URL:
            redis_status = "connecting"
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"WS health redis ping failed: {exc}")
        redis_status = "degraded"

    return {
        "status": "healthy" if redis_status in {"healthy", "unconfigured"} else "degraded",
        "redis": redis_status,
        "connections": len(manager.active_connections),
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
    gamification.router, prefix=API_V1_PREFIX + "/gamification", tags=["Gamification"]
)  # Gamification system
app.include_router(reactions.router, prefix=API_V1_PREFIX)  # Message reactions
app.include_router(
    conversation_settings.router, prefix=API_V1_PREFIX
)  # Conversation settings (pin/archive/mute)
app.include_router(voice.router, prefix=API_V1_PREFIX)  # Voice messages
app.include_router(forwarding.router, prefix=API_V1_PREFIX)  # Message forwarding
app.include_router(moderation.router, prefix=API_V1_PREFIX)  # User blocking and reporting
app.include_router(group_admin.router, prefix=API_V1_PREFIX)  # Group chat moderation
app.include_router(
    strategy_features.router, prefix=API_V1_PREFIX
)  # Strategy features (subscriptions, bundles, penalties, guarantee)
app.include_router(trust.router, prefix=API_V1_PREFIX)  # Trust scores, disputes, checkpoints
app.include_router(investor_metrics.router, prefix=API_V1_PREFIX)  # Investor metrics (CAC, LTV, GMV)

# Serve uploaded files (voice/images/documents) as static files
_uploads_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
os.makedirs(_uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_uploads_dir, html=False), name="uploads")


async def _authenticate_ws_ticket(ticket: str, user_id: str) -> bool:
    """Validate a one-time WebSocket ticket against Redis. Returns True if valid."""
    redis_url = settings.REDIS_URL or ""
    if not redis_url:
        logger.error("Redis not configured — cannot validate WS ticket")
        return False
    from redis.asyncio import from_url as _redis_from_url
    redis_client = _redis_from_url(redis_url, encoding="utf-8", decode_responses=True)
    try:
        stored_user_id = await redis_client.getdel(f"ws_ticket:{ticket}")
        return stored_user_id == user_id
    finally:
        await redis_client.aclose()


def _authenticate_ws_token(token: str, user_id: str) -> bool:
    """Validate a legacy JWT token for WebSocket auth (dev/staging only)."""
    try:
        payload = SecurityManager.verify_token(token)
        return payload.get("sub") == user_id
    except HTTPException:
        return False


def _ws_origin_allowed(origin: Optional[str]) -> bool:
    """Return True when origin is absent (non-browser) or in the allow-list."""
    return origin is None or origin in settings.ALLOWED_ORIGINS


# WebSocket endpoint for real-time communication
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    ticket: Optional[str] = None,
    token: Optional[str] = None,
):
    """
    WebSocket endpoint for real-time features:
    - Chat messages
    - Booking updates
    - Notifications
    - Online status
    - Typing indicators

    Preferred auth: 'ticket' query parameter (one-time, Redis-backed, 60 s TTL).
    Legacy fallback:  'token' query parameter (JWT) — accepted only in non-production.
    """
    # SECURITY: Validate origin header (CORS for WebSocket)
    origin = websocket.headers.get("origin")
    if not _ws_origin_allowed(origin):
        logger.warning(f"WebSocket blocked from origin: {origin}")
        await websocket.close(code=1008, reason="Invalid origin")
        return

    authenticated_user_id: Optional[str] = None

    # --- Ticket-based auth (preferred) ---
    if ticket:
        try:
            valid = await _authenticate_ws_ticket(ticket, user_id)
        except Exception as exc:
            logger.error(f"WS ticket validation error: {exc}")
            await websocket.close(code=1011, reason="Authentication error")
            return
        if not valid:
            logger.warning(f"Invalid or expired WS ticket for user {user_id}")
            await websocket.close(code=1008, reason="Invalid ticket")
            return
        authenticated_user_id = user_id

    # --- Token-based auth (legacy, blocked in production) ---
    elif token:
        if settings.is_production:
            logger.warning("JWT token in WS URL rejected in production")
            await websocket.close(code=1008, reason="Use /auth/ws-ticket")
            return
        if not _authenticate_ws_token(token, user_id):
            logger.warning(f"Invalid/mismatched token for WS user {user_id}")
            await websocket.close(code=1008, reason="Invalid token")
            return
        authenticated_user_id = user_id
    else:
        logger.warning(f"WebSocket connection without auth for user {user_id}")
        await websocket.close(code=1008, reason="Authentication required")
        return

    await manager.connect(authenticated_user_id, websocket)
    logger.info(f"WebSocket connected: user {authenticated_user_id} from origin {origin}")

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
        host=os.getenv("HOST", "0.0.0.0"),  # noqa: S104 — bind address configurable via env
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
