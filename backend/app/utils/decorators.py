"""
Service Utility Decorators
--------------------------
DRY principle: Eliminates 30+ duplicate try/except blocks across all services.
SonarQube: S1143 - Avoid returning/throwing inside finally blocks

Usage::

    from app.utils.decorators import handle_service_errors

    class WalletService:
        @handle_service_errors("get_balance")
        async def get_balance(self, user_id: str) -> Dict[str, Any]:
            ...   # No try/except needed

    # Or stand-alone async functions:
    @handle_service_errors("track_event")
    async def track_event(db, event_name, user_id):
        ...
"""
import asyncio
import functools
import logging
import time
from typing import Any, Callable, Optional, Type, Tuple

from fastapi import HTTPException, status

from app.core.exceptions import SavitaraException

_logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Private helpers (extracted to keep outer decorator complexity ≤ 15)
# ---------------------------------------------------------------------------

def _log_and_maybe_reraise(
    operation_name: str,
    elapsed: float,
    exc: Exception,
    log: Callable,
    reraise_as_http: bool,
    default_return: Any,
) -> Any:
    """Log a caught exception and either re-raise as HTTP 500 or swallow it."""
    log(
        "%s failed after %.3fs: %s — %s",
        operation_name,
        elapsed,
        type(exc).__name__,
        exc,
        exc_info=True,
    )
    if reraise_as_http:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Service error in {operation_name}. "
                   "Please try again or contact support.",
        ) from exc
    return default_return


def _make_async_wrapper(
    func: Callable,
    operation_name: str,
    log_fn_name: str,
    reraise_as_http: bool,
    default_return: Any,
    extra_exceptions: tuple,
) -> Callable:
    """Build the async version of the wrapper."""
    @functools.wraps(func)
    async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
        start = time.monotonic()
        log = getattr(_logger, log_fn_name, _logger.error)
        try:
            result = await func(*args, **kwargs)
            _logger.debug("%s completed in %.3fs", operation_name, time.monotonic() - start)
            return result
        except (SavitaraException, HTTPException):
            raise
        except (*extra_exceptions, Exception) as exc:  # type: ignore[misc]
            return _log_and_maybe_reraise(
                operation_name, time.monotonic() - start,
                exc, log, reraise_as_http, default_return,
            )
    return async_wrapper


def _make_sync_wrapper(
    func: Callable,
    operation_name: str,
    log_fn_name: str,
    reraise_as_http: bool,
    default_return: Any,
    extra_exceptions: tuple,
) -> Callable:
    """Build the sync version of the wrapper."""
    @functools.wraps(func)
    def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
        start = time.monotonic()
        log = getattr(_logger, log_fn_name, _logger.error)
        try:
            result = func(*args, **kwargs)
            _logger.debug("%s completed in %.3fs", operation_name, time.monotonic() - start)
            return result
        except (SavitaraException, HTTPException):
            raise
        except (*extra_exceptions, Exception) as exc:  # type: ignore[misc]
            return _log_and_maybe_reraise(
                operation_name, time.monotonic() - start,
                exc, log, reraise_as_http, default_return,
            )
    return sync_wrapper


def handle_service_errors(
    operation_name: str,
    *,
    reraise_as_http: bool = True,
    default_return: Any = None,
    extra_exceptions: Tuple[Type[Exception], ...] = (),
    log_level: str = "error",
) -> Callable:
    """
    Decorator: wraps async/sync service methods with uniform error handling.

    Args:
        operation_name: Label used in log messages.
        reraise_as_http: Re-raise unknown exceptions as HTTP 500 when True.
        default_return: Returned on swallowed errors (reraise_as_http=False).
        extra_exceptions: Additional exception types to catch silently.
        log_level: "error" | "warning" | "info".
    """
    log_fn_name = log_level.lower()
    _extra = extra_exceptions  # local alias avoids closure cell issue

    def decorator(func: Callable) -> Callable:
        if asyncio.iscoroutinefunction(func):
            return _make_async_wrapper(
                func, operation_name, log_fn_name,
                reraise_as_http, default_return, _extra,
            )
        return _make_sync_wrapper(
            func, operation_name, log_fn_name,
            reraise_as_http, default_return, _extra,
        )

    return decorator


def fire_and_forget(operation_name: str) -> Callable:
    """
    Convenience shorthand for analytics / audit methods that must NEVER
    bubble up errors to the caller.

    Equivalent to::
        @handle_service_errors(name, reraise_as_http=False, log_level="warning")
    """
    return handle_service_errors(
        operation_name,
        reraise_as_http=False,
        log_level="warning",
    )
