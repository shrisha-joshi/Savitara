"""
Structured JSON Logging Configuration
Provides consistent, searchable logs for ELK stack / CloudWatch / GCP Logging
SonarQube: S4784 - Proper logging without sensitive data
"""
import logging
import sys
import contextvars
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pythonjsonlogger import jsonlogger

from app.core.config import get_settings

settings = get_settings()


class SavitaraJsonFormatter(jsonlogger.JsonFormatter):
    """
    Custom JSON formatter for structured logging
    Adds context like service name, environment, correlation ID
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.service_name = "savitara-backend"
        self.environment = (
            settings.ENVIRONMENT if hasattr(settings, "ENVIRONMENT") else "development"
        )

    def add_fields(
        self,
        log_record: Dict[str, Any],
        record: logging.LogRecord,
        message_dict: Dict[str, Any],
    ) -> None:
        """Add custom fields to every log entry"""
        super().add_fields(log_record, record, message_dict)

        # Timestamp in ISO format with timezone
        log_record["timestamp"] = datetime.now(timezone.utc).isoformat()

        # Service metadata
        log_record["service"] = self.service_name
        log_record["environment"] = self.environment

        # Log level info
        log_record["level"] = record.levelname
        log_record["level_num"] = record.levelno

        # Source information
        log_record["logger"] = record.name
        log_record["module"] = record.module
        log_record["function"] = record.funcName
        log_record["line"] = record.lineno

        # Process/thread info for debugging
        log_record["process_id"] = record.process
        log_record["thread_id"] = record.thread

        # Exception info if present
        if record.exc_info:
            log_record["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": self.formatException(record.exc_info),
            }


class RequestContextFilter(logging.Filter):
    """
    Logging filter that adds request context (correlation ID, user ID, etc.)
    Use with contextvars for async support
    """

    def filter(self, record: logging.LogRecord) -> bool:
        """Add request context to log record"""
        # These will be set by middleware via contextvars
        record.correlation_id = (
            getattr(record, "correlation_id", None) or get_correlation_id()
        )
        record.user_id = getattr(record, "user_id", None) or get_user_id()
        record.request_path = getattr(record, "request_path", None)
        record.request_method = getattr(record, "request_method", None)
        return True


# Context variables for request tracking

_correlation_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "correlation_id", default=None
)
_user_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "user_id", default=None
)
_request_path: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "request_path", default=None
)


def set_correlation_id(correlation_id: str) -> None:
    """Set correlation ID for current request context"""
    _correlation_id.set(correlation_id)


def get_correlation_id() -> Optional[str]:
    """Get correlation ID for current request context"""
    return _correlation_id.get()


def set_user_id(user_id: str) -> None:
    """Set user ID for current request context"""
    _user_id.set(user_id)


def get_user_id() -> Optional[str]:
    """Get user ID for current request context"""
    return _user_id.get()


def set_request_path(path: str) -> None:
    """Set request path for current request context"""
    _request_path.set(path)


def setup_logging(
    level: str = "INFO", json_format: bool = True, log_file: Optional[str] = None
) -> None:
    """
    Configure structured logging for the application

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        json_format: If True, output JSON; if False, human-readable format
        log_file: Optional file path for file logging
    """
    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Create formatter
    if json_format:
        formatter = SavitaraJsonFormatter(
            "%(timestamp)s %(level)s %(name)s %(message)s", timestamp=True
        )
    else:
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - [%(correlation_id)s] - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.addFilter(RequestContextFilter())
    root_logger.addHandler(console_handler)

    # File handler (optional)
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        file_handler.addFilter(RequestContextFilter())
        root_logger.addHandler(file_handler)

    # Set log levels for noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("motor").setLevel(logging.WARNING)
    logging.getLogger("aioredis").setLevel(logging.WARNING)
    logging.getLogger("elasticsearch").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)

    root_logger.info(
        "Logging configured",
        extra={"log_level": level, "json_format": json_format, "log_file": log_file},
    )


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger with the given name

    Args:
        name: Logger name (typically __name__)

    Returns:
        Configured logger instance
    """
    return logging.getLogger(name)


class LogContext:
    """
    Context manager for adding temporary context to logs

    Usage:
        with LogContext(user_id="123", action="payment"):
            logger.info("Processing payment")  # Includes user_id and action
    """

    def __init__(self, **kwargs):
        self.context = kwargs
        self.old_values = {}

    def __enter__(self):
        # Store old values and set new ones
        for key, value in self.context.items():
            if key == "correlation_id":
                self.old_values[key] = get_correlation_id()
                set_correlation_id(value)
            elif key == "user_id":
                self.old_values[key] = get_user_id()
                set_user_id(value)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Restore old values
        for key, value in self.old_values.items():
            if key == "correlation_id":
                set_correlation_id(value)
            elif key == "user_id":
                set_user_id(value)
        return False


# Sensitive data patterns to redact from logs
SENSITIVE_PATTERNS = [
    "password",
    "secret",
    "token",
    "api_key",
    "apikey",
    "authorization",
    "credit_card",
    "card_number",
    "cvv",
    "ssn",
    "social_security",
]


def sanitize_log_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Remove or mask sensitive data from log entries
    SonarQube: S5131 - Don't log sensitive data

    Args:
        data: Dictionary that may contain sensitive data

    Returns:
        Sanitized dictionary safe for logging
    """
    if not isinstance(data, dict):
        return data

    sanitized = {}
    for key, value in data.items():
        key_lower = key.lower()

        # Check if key matches sensitive pattern
        if any(pattern in key_lower for pattern in SENSITIVE_PATTERNS):
            sanitized[key] = "[REDACTED]"
        elif isinstance(value, dict):
            sanitized[key] = sanitize_log_data(value)
        elif isinstance(value, list):
            sanitized[key] = [
                sanitize_log_data(item) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            sanitized[key] = value

    return sanitized


def log_audit_event(
    logger: logging.Logger,
    action: str,
    user_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    success: bool = True,
) -> None:
    """
    Log an audit event for compliance tracking

    Args:
        logger: Logger instance
        action: Action performed (e.g., "user.login", "booking.create")
        user_id: ID of user performing action
        resource_type: Type of resource affected
        resource_id: ID of resource affected
        details: Additional details (will be sanitized)
        success: Whether action succeeded
    """
    audit_data = {
        "audit_event": True,
        "action": action,
        "user_id": user_id or get_user_id(),
        "resource_type": resource_type,
        "resource_id": resource_id,
        "success": success,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if details:
        audit_data["details"] = sanitize_log_data(details)

    if success:
        logger.info(f"Audit: {action}", extra=audit_data)
    else:
        logger.warning(f"Audit (failed): {action}", extra=audit_data)
