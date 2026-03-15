"""
Middleware Registration
SonarQube: S5122 - Properly configured CORS
Extracted from main.py for Single Responsibility Principle (SRP).
All middleware is registered in one place via register_middleware().
"""
import logging
import re
import time
import uuid
from typing import Optional

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.security import SecurityManager
from app.core.tracing import resolve_trace_context
from app.services.kill_switch_service import DEFAULT_CONTROLS
from app.db.query_budget import (
    clear_query_budget,
    get_query_budget,
    get_query_count,
    set_query_budget,
)
from app.middleware.compression import CompressionMiddleware
from app.middleware.rate_limit import rate_limiter
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.utils.logging_config import (
    set_correlation_id,
    set_span_id,
    set_trace_id,
    set_user_id,
)

logger = logging.getLogger(__name__)

DEFAULT_SCHEMA_VERSION = "v1"
SUPPORTED_SCHEMA_VERSIONS = {"v1"}

try:
    from prometheus_client import Counter, Histogram

    API_REQUESTS_TOTAL = Counter(
        "savitara_api_requests_total",
        "Total backend API requests",
        ["method", "endpoint", "status"],
    )
    API_REQUEST_DURATION_SECONDS = Histogram(
        "savitara_api_request_duration_seconds",
        "Backend API request duration in seconds",
        ["method", "endpoint", "status"],
        buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10),
    )
    _API_METRICS_ENABLED = True
except Exception:  # pragma: no cover
    _API_METRICS_ENABLED = False


def _extract_user_id_from_bearer(request: Request) -> Optional[str]:
    """Best-effort extraction of user_id from bearer token for rate-limit bucketing."""
    authorization = request.headers.get("authorization", "")
    if not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        return None
    try:
        payload = SecurityManager.verify_token(token)
        sub = payload.get("sub")
        return str(sub) if sub else None
    except Exception:
        return None


def _device_fingerprint(request: Request) -> str:
    """Resolve device fingerprint from common headers with conservative fallback."""
    device = (
        request.headers.get("X-Device-Fingerprint")
        or request.headers.get("X-Device-Id")
        or request.headers.get("X-Client-Device")
        or "unknown-device"
    )
    return device[:128]


def _normalize_endpoint(path: str) -> str:
    """Reduce path cardinality for metrics labels."""
    normalized = re.sub(r"/[0-9a-fA-F]{24}(?=/|$)", "/:id", path)
    normalized = re.sub(r"/\d+(?=/|$)", "/:num", normalized)
    return normalized


def _cache_hint_for_request(request: Request) -> str:
    """Suggest cache strategy based on endpoint profile."""
    path = request.url.path
    if path.startswith("/api/v1/chat") or path.startswith("/api/v1/bookings"):
        return "short"
    if path.startswith("/api/v1/panchanga") or path.startswith("/api/v1/analytics"):
        return "medium"
    if path.startswith("/api/v1/services") or path.startswith("/api/v1/content"):
        return "long"
    return "bypass"


def _resolve_schema_version(request: Request) -> str:
    """Resolve requested schema version from header/query and validate support."""
    requested = (
        request.headers.get("X-API-Schema-Version")
        or request.query_params.get("schema_version")
        or DEFAULT_SCHEMA_VERSION
    )
    normalized = requested.strip().lower()
    request.state.schema_version = normalized
    if normalized not in SUPPORTED_SCHEMA_VERSIONS:
        from fastapi import HTTPException, status as http_status  # noqa: PLC0415

        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error": {
                    "code": "VAL_003",
                    "message": "Unsupported API schema version",
                    "details": {
                        "requested": normalized,
                        "supported": sorted(SUPPORTED_SCHEMA_VERSIONS),
                    },
                },
            },
        )
    return normalized


async def _resolve_kill_switch_controls(request: Request) -> dict:
    """Resolve global controls with safe defaults and graceful failure handling."""
    service = getattr(request.app.state, "kill_switch_service", None)
    if service is None:
        return dict(DEFAULT_CONTROLS)
    try:
        controls = dict(DEFAULT_CONTROLS)
        controls.update(await service.get_controls())
        return controls
    except Exception:
        return dict(DEFAULT_CONTROLS)


async def _enforce_rate_limit(request: Request, user_id: Optional[str]) -> None:
    """Apply composite distributed rate limiting for incoming request."""
    if not settings.ENABLE_RATE_LIMITING:
        return

    client_ip = request.client.host if request.client else "unknown-ip"
    device_fp = _device_fingerprint(request)
    path = request.url.path
    controls = await _resolve_kill_switch_controls(request)
    limit = (
        settings.RATE_LIMIT_AUTH_PER_MINUTE
        if path.startswith("/api/v1/auth")
        else settings.RATE_LIMIT_PER_MINUTE
    )
    if controls.get("incident_mode"):
        incident_multiplier = controls.get("incident_throttle_multiplier", 0.5)
        try:
            incident_multiplier = float(incident_multiplier)
        except (TypeError, ValueError):
            incident_multiplier = 0.5
        limit = max(5, int(limit * incident_multiplier))

    risk_policy_engine = getattr(request.app.state, "risk_policy_engine", None)
    if risk_policy_engine is not None:
        assessment = risk_policy_engine.assess_request(request, user_id)
        if assessment.blocked:
            from fastapi import HTTPException, status as http_status  # noqa: PLC0415

            raise HTTPException(
                status_code=http_status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "success": False,
                    "error": {
                        "code": "RATE_LIMIT_001",
                        "message": "Request blocked by risk policy.",
                        "details": {
                            "risk_level": assessment.level,
                            "risk_score": assessment.score,
                        },
                    },
                },
            )
        limit = max(5, int(limit * assessment.throttle_factor))

    principal = user_id or "anonymous"
    bucket_key = (
        f"rate:v2:u:{principal}:ip:{client_ip}:d:{device_fp}:"
        f"m:{request.method}:p:{path}"
    )

    allowed = await rate_limiter.check_rate_limit(bucket_key, limit=limit, window=60)
    if allowed:
        return

    from fastapi import HTTPException, status as http_status  # noqa: PLC0415

    raise HTTPException(
        status_code=http_status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "success": False,
            "error": {
                "code": "RATE_LIMIT_001",
                "message": "Too many requests. Please try again later.",
                "details": {
                    "limit": limit,
                    "window_seconds": 60,
                    "dimensions": ["user", "ip", "device", "method", "path"],
                },
            },
        },
    )


def _record_api_metrics(request: Request, response_status: int, process_time: float) -> None:
    """Emit per-endpoint request count/latency metrics for SLO dashboards."""
    if not (_API_METRICS_ENABLED and request.url.path.startswith("/api/")):
        return

    endpoint = _normalize_endpoint(request.url.path)
    status_code = str(response_status)
    API_REQUESTS_TOTAL.labels(
        method=request.method,
        endpoint=endpoint,
        status=status_code,
    ).inc()
    API_REQUEST_DURATION_SECONDS.labels(
        method=request.method,
        endpoint=endpoint,
        status=status_code,
    ).observe(process_time)


def _resolve_query_budget(request: Request) -> int:
    """Resolve request query budget guard to catch N+1-style query explosions."""
    path = request.url.path
    if path.startswith("/api/v1/admin/analytics") or path.startswith("/api/v1/admin/dashboard"):
        return 140
    if request.method == "GET":
        return 80
    return 100


def _build_schema_error_response(
    request_id: str,
    correlation_id: str,
    request: Request,
    exc: HTTPException,
    trace_context,
) -> JSONResponse:
    """Build consistent schema-validation error response and required headers."""
    content = exc.detail if isinstance(exc.detail, dict) else {
        "success": False,
        "error": {
            "code": "VAL_003",
            "message": str(exc.detail),
            "details": {},
        },
    }
    content.setdefault("timestamp", time.time())
    content.setdefault("request_id", request_id)
    content.setdefault("correlation_id", correlation_id)
    content.setdefault("schema_version", getattr(request.state, "schema_version", "v1"))

    response = JSONResponse(status_code=exc.status_code, content=content)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Correlation-ID"] = correlation_id
    response.headers["X-API-Schema-Version"] = getattr(request.state, "schema_version", "v1")
    response.headers["traceparent"] = trace_context.traceparent
    if trace_context.tracestate:
        response.headers["tracestate"] = trace_context.tracestate
    return response


def _build_kill_switch_response(
    message: str,
    request_id: str,
    correlation_id: str,
    schema_version: str,
    trace_context,
) -> JSONResponse:
    """Build standard 503 kill-switch response payload and invariant headers."""
    response = JSONResponse(
        status_code=503,
        content={
            "success": False,
            "error": {
                "code": "SERVICE_503",
                "message": message,
                "details": {},
            },
            "timestamp": time.time(),
            "request_id": request_id,
            "correlation_id": correlation_id,
            "schema_version": schema_version,
        },
    )
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Correlation-ID"] = correlation_id
    response.headers["X-API-Schema-Version"] = schema_version
    response.headers["traceparent"] = trace_context.traceparent
    if trace_context.tracestate:
        response.headers["tracestate"] = trace_context.tracestate
    return response


def _attach_success_response_headers(
    response,
    request_id: str,
    correlation_id: str,
    schema_version: str,
    process_time: float,
    request: Request,
    trace_context,
) -> None:
    """Attach canonical success response headers for observability and controls."""
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Correlation-ID"] = correlation_id
    response.headers["X-Process-Time"] = str(process_time)
    response.headers["X-API-Schema-Version"] = schema_version
    response.headers["X-Cache-Hint"] = _cache_hint_for_request(request)
    if get_query_budget() is not None:
        response.headers["X-DB-Query-Budget"] = str(get_query_budget())
        response.headers["X-DB-Query-Count"] = str(get_query_count())
    response.headers["traceparent"] = trace_context.traceparent
    if trace_context.tracestate:
        response.headers["tracestate"] = trace_context.tracestate
    # Fix for Firebase Auth cross-origin popup
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"


def _enforce_route_kill_switches(
    request: Request,
    controls: dict,
    request_id: str,
    correlation_id: str,
    schema_version: str,
    trace_context,
) -> Optional[JSONResponse]:
    """Return a 503 response when route-level kill switches disable a capability."""
    path = request.url.path

    if path.startswith("/api/v1/payments") and not controls.get("payments_enabled", True):
        response = _build_kill_switch_response(
            "Payments are temporarily disabled",
            request_id,
            correlation_id,
            schema_version,
            trace_context,
        )
    elif path.startswith("/api/v1/chat") and not controls.get("chat_enabled", True):
        response = _build_kill_switch_response(
            "Chat is temporarily disabled",
            request_id,
            correlation_id,
            schema_version,
            trace_context,
        )
    else:
        return None

    response.headers["X-Cache-Hint"] = _cache_hint_for_request(request)
    if get_query_budget() is not None:
        response.headers["X-DB-Query-Budget"] = str(get_query_budget())
        response.headers["X-DB-Query-Count"] = str(get_query_count())
    return response


def register_middleware(app: FastAPI) -> None:
    """
    Register all application middleware in correct order.
    Order matters: last-added middleware runs first (LIFO for request phase).

        Registered (outermost → innermost):
            1. Compression      - gzip/brotli responses
            2. Security Headers - HSTS, CSP, X-Frame-Options, etc.
            3. TrustedHost      - production only: block unknown vhosts
            4. CORS             - cross-origin request handling (must be last add_middleware)
            5. Request ID / Timing - attach X-Request-ID + X-Process-Time
    """

    # 1. Compression (outermost, comes first in response pipeline)
    app.add_middleware(
        CompressionMiddleware,
        minimum_size=1024,      # Only compress responses > 1 KB
        compression_level=6,    # Balanced speed / size tradeoff
    )

    # 2. Security headers
    app.add_middleware(SecurityHeadersMiddleware)

    # 3. Trusted host (production only)
    if settings.is_production:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=["savitara.com", "*.savitara.com"],
        )

    # 4. CORS — SonarQube: S5122 — no wildcard origins in production
    # NOTE: Added after other add_middleware registrations by lint/security rule.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=[
            "X-Total-Count",
            "X-Request-ID",
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset",
            "X-Correlation-ID",
            "X-API-Schema-Version",
            "X-DB-Query-Budget",
            "X-DB-Query-Count",
            "X-Cache-Hint",
            "traceparent",
            "tracestate",
        ],
        max_age=86400,          # Cache preflight for 24 hours
    )

    # 5. Request ID + timing (innermost — runs for every request)
    @app.middleware("http")
    async def add_request_id_and_timing(request: Request, call_next):
        """
        Attach a unique request ID and measure end-to-end latency.
        Fixes Firebase Auth COOP header as well.
        SonarQube: Proper logging and monitoring
        """
        incoming_correlation_id = request.headers.get("X-Correlation-ID")
        correlation_id = incoming_correlation_id or str(uuid.uuid4())
        trace_context = resolve_trace_context(
            request.headers.get("traceparent"),
            request.headers.get("tracestate"),
        )
        request_id = str(int(time.time() * 1000))
        try:
            schema_version = _resolve_schema_version(request)
        except HTTPException as exc:
            return _build_schema_error_response(
                request_id,
                correlation_id,
                request,
                exc,
                trace_context,
            )
        request.state.request_id = request_id
        request.state.correlation_id = correlation_id
        request.state.schema_version = schema_version
        request.state.trace_id = trace_context.trace_id
        request.state.span_id = trace_context.span_id
        request.state.parent_span_id = trace_context.parent_span_id
        query_budget_limit = _resolve_query_budget(request)
        request.state.query_budget = query_budget_limit
        set_query_budget(query_budget_limit)
        set_correlation_id(correlation_id)
        set_trace_id(trace_context.trace_id)
        set_span_id(trace_context.span_id)

        user_id = _extract_user_id_from_bearer(request)
        request.state.user_id = user_id
        set_user_id(user_id or "")
        await _enforce_rate_limit(request, user_id)

        controls = await _resolve_kill_switch_controls(request)
        kill_switch_response = _enforce_route_kill_switches(
            request,
            controls,
            request_id,
            correlation_id,
            schema_version,
            trace_context,
        )
        if kill_switch_response is not None:
            return kill_switch_response

        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time

        _attach_success_response_headers(
            response,
            request_id,
            correlation_id,
            schema_version,
            process_time,
            request,
            trace_context,
        )

        _record_api_metrics(request, response.status_code, process_time)

        logger.info(
            "Request: %s %s — Status: %s — Duration: %.3fs — Request-ID: %s",
            request.method,
            request.url.path,
            response.status_code,
            process_time,
            request_id,
        )
        set_correlation_id("")
        set_trace_id("")
        set_span_id("")
        set_user_id("")
        clear_query_budget()

        return response
