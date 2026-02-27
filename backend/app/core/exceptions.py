"""
Custom Exception Classes
SonarQube: S112 - Use specific exceptions
SonarQube: S1192 - No duplicated strings
"""
from typing import Optional, Dict, Any
from fastapi import HTTPException, status


class SavitaraException(Exception):
    """Base exception for Savitara application"""

    def __init__(
        self,
        message: str,
        error_code: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


# Authentication Exceptions
class AuthenticationError(SavitaraException):
    """Authentication failed"""

    def __init__(
        self, message: str = "Authentication failed", details: Optional[Dict] = None
    ):
        super().__init__(
            message=message,
            error_code="AUTH_001",
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=details,
        )


class InvalidTokenError(SavitaraException):
    """Invalid or expired token"""

    def __init__(self, message: str = "Invalid or expired token"):
        super().__init__(
            message=message,
            error_code="AUTH_002",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


class InsufficientPermissionsError(SavitaraException):
    """User lacks required permissions"""

    def __init__(
        self,
        message: str = "Insufficient permissions",
        required_role: Optional[str] = None,
    ):
        details = {"required_role": required_role} if required_role else {}
        super().__init__(
            message=message,
            error_code="AUTH_003",
            status_code=status.HTTP_403_FORBIDDEN,
            details=details,
        )


class PermissionDeniedError(SavitaraException):
    """Permission denied"""

    def __init__(self, message: str = "Permission denied"):
        super().__init__(
            message=message,
            error_code="AUTH_004",
            status_code=status.HTTP_403_FORBIDDEN,
        )


class ResourceNotFoundError(SavitaraException):
    """Resource not found"""

    def __init__(
        self, message: str = "Resource not found", resource_id: Optional[str] = None
    ):
        details = {"resource_id": resource_id} if resource_id else {}
        super().__init__(
            message=message,
            error_code="RES_001",
            status_code=status.HTTP_404_NOT_FOUND,
            details=details,
        )


# Booking Exceptions
class SlotUnavailableError(SavitaraException):
    """Requested slot is unavailable"""

    def __init__(self, message: str = "Requested slot is unavailable"):
        super().__init__(
            message=message, error_code="BKG_001", status_code=status.HTTP_409_CONFLICT
        )


class InvalidDateTimeError(SavitaraException):
    """Invalid date or time"""

    def __init__(self, message: str = "Invalid date or time format"):
        super().__init__(
            message=message,
            error_code="BKG_002",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


class PaymentFailedError(SavitaraException):
    """Payment processing failed"""

    def __init__(
        self, message: str = "Payment processing failed", details: Optional[Dict] = None
    ):
        super().__init__(
            message=message,
            error_code="BKG_003",
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            details=details,
        )


# User Exceptions
class UserNotFoundError(SavitaraException):
    """User not found"""

    def __init__(self, message: str = "User not found", user_id: Optional[str] = None):
        details = {"user_id": user_id} if user_id else {}
        super().__init__(
            message=message,
            error_code="USER_001",
            status_code=status.HTTP_404_NOT_FOUND,
            details=details,
        )


class UserAlreadyExistsError(SavitaraException):
    """User already exists"""

    def __init__(
        self, message: str = "User already exists", email: Optional[str] = None
    ):
        details = {"email": email} if email else {}
        super().__init__(
            message=message,
            error_code="USER_002",
            status_code=status.HTTP_409_CONFLICT,
            details=details,
        )


class AcharyaNotVerifiedError(SavitaraException):
    """Acharya is not verified yet"""

    def __init__(self, message: str = "Acharya profile is pending verification"):
        super().__init__(
            message=message,
            error_code="USER_003",
            status_code=status.HTTP_403_FORBIDDEN,
        )


class InsufficientCreditsError(SavitaraException):
    """Insufficient credits/balance"""

    def __init__(
        self, required: float, available: float, message: str = "Insufficient balance"
    ):
        self.required = required
        self.available = available
        super().__init__(
            message=message,
            error_code="WALLET_001",
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            details={"required": required, "available": available},
        )


# Chat Exceptions
class ConversationNotFoundError(SavitaraException):
    """Conversation not found"""

    def __init__(self, message: str = "Conversation not found"):
        super().__init__(
            message=message, error_code="CHT_001", status_code=status.HTTP_404_NOT_FOUND
        )


class MessageSendFailedError(SavitaraException):
    """Failed to send message"""

    def __init__(
        self, message: str = "Failed to send message", details: Optional[Dict] = None
    ):
        super().__init__(
            message=message,
            error_code="CHT_002",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details=details,
        )


# Validation Exceptions
class InvalidInputError(SavitaraException):
    """Invalid input provided"""

    def __init__(
        self,
        message: str = "Invalid input provided",
        field: Optional[str] = None,
        details: Optional[Dict] = None,
    ):
        _details = details or {}
        if field:
            _details["field"] = field
        super().__init__(
            message=message,
            error_code="VAL_003",
            status_code=status.HTTP_400_BAD_REQUEST,
            details=_details,
        )


class ValidationError(SavitaraException):
    """Data validation failed"""

    def __init__(self, message: str = "Validation failed", field: Optional[str] = None):
        details = {"field": field} if field else {}
        super().__init__(
            message=message,
            error_code="VAL_001",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details=details,
        )


class RequiredFieldMissingError(SavitaraException):
    """Required field is missing"""

    def __init__(self, field: str):
        super().__init__(
            message=f"Required field missing: {field}",
            error_code="VAL_002",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details={"field": field},
        )


# Database Exceptions
class DatabaseError(SavitaraException):
    """Database operation failed"""

    def __init__(
        self, message: str = "Database operation failed", details: Optional[Dict] = None
    ):
        super().__init__(
            message=message,
            error_code="DB_001",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details=details,
        )


# External Service Exceptions
class ExternalServiceError(SavitaraException):
    """External service error"""

    def __init__(self, service: str, message: str = "External service error"):
        super().__init__(
            message=message,
            error_code="EXT_001",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details={"service": service},
        )


def create_http_exception(exc: SavitaraException) -> HTTPException:
    """
    Convert Savitara exception to HTTPException
    SonarQube: Proper exception handling
    """
    return HTTPException(
        status_code=exc.status_code,
        detail={
            "success": False,
            "error": {
                "code": exc.error_code,
                "message": exc.message,
                "details": exc.details,
            },
        },
    )


# Aliases for compatibility with other modules
NotFoundException = ResourceNotFoundError
ForbiddenException = PermissionDeniedError
ValidationException = ValidationError
