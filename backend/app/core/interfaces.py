"""
Service Interface Abstractions (SOLID: Dependency Inversion + Interface Segregation)
All concrete service implementations must satisfy these contracts.
SonarQube: S1192 - No duplicated strings
"""
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List


# ---------------------------------------------------------------------------
# Payment Service Interface
# ---------------------------------------------------------------------------

class IPaymentService(ABC):
    """
    Abstract contract for payment gateway integrations.
    Allows swapping between Razorpay, Stripe, PayU, etc. without
    touching business logic.
    """

    @abstractmethod
    def create_order(
        self,
        amount: float,
        currency: str = "INR",
        receipt: Optional[str] = None,
        notes: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create a new payment order. Returns order details dict."""

    @abstractmethod
    def verify_payment_signature(
        self,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str,
    ) -> bool:
        """Verify cryptographic payment signature. Returns True if valid."""

    @abstractmethod
    def verify_webhook_signature(
        self, webhook_body: str, webhook_signature: str
    ) -> bool:
        """Verify webhook payload authenticity. Returns True if valid."""

    @abstractmethod
    def fetch_payment(self, payment_id: str) -> Dict[str, Any]:
        """Fetch payment details by ID."""

    @abstractmethod
    def fetch_order(self, order_id: str) -> Dict[str, Any]:
        """Fetch order details by ID."""

    @abstractmethod
    def initiate_refund(
        self,
        payment_id: str,
        amount: Optional[float] = None,
        notes: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Initiate full or partial refund. Returns refund details."""

    @abstractmethod
    def fetch_refund(self, payment_id: str, refund_id: str) -> Dict[str, Any]:
        """Fetch refund details by payment and refund IDs."""


# ---------------------------------------------------------------------------
# Notification Service Interface
# ---------------------------------------------------------------------------

class INotificationService(ABC):
    """
    Abstract contract for notification dispatch.
    Implementations: Firebase FCM, AWS SNS, Twilio, etc.
    """

    @abstractmethod
    def send_notification(
        self,
        token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
        image_url: Optional[str] = None,
    ) -> str:
        """
        Send push notification to a single device.
        Returns message_id on success.
        """

    @abstractmethod
    def send_multicast_notification(
        self,
        tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Send push notification to multiple devices.
        Returns dict with success_count, failure_count, responses.
        """

    @abstractmethod
    def send_topic_notification(
        self,
        topic: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
    ) -> str:
        """
        Send notification to a subscribed topic.
        Returns message_id on success.
        """

    @abstractmethod
    def subscribe_to_topic(self, tokens: List[str], topic: str) -> Dict[str, Any]:
        """Subscribe FCM tokens to a topic."""

    @abstractmethod
    def unsubscribe_from_topic(self, tokens: List[str], topic: str) -> Dict[str, Any]:
        """Unsubscribe FCM tokens from a topic."""


# ---------------------------------------------------------------------------
# Cache Service Interface
# ---------------------------------------------------------------------------

class ICacheService(ABC):
    """
    Abstract contract for caching layer.
    Implementations: Redis, Memcached, in-memory.
    """

    @abstractmethod
    async def connect(self) -> None:
        """Establish connection to the cache backend."""

    @abstractmethod
    async def disconnect(self) -> None:
        """Close connection to the cache backend."""

    @abstractmethod
    async def get(self, key: str) -> Optional[Any]:
        """Retrieve value by key. Returns None on miss."""

    @abstractmethod
    async def set(self, key: str, value: Any, expire: Optional[int] = None) -> bool:
        """
        Store value with optional TTL in seconds.
        Returns True on success.
        """

    @abstractmethod
    async def delete(self, key: str) -> bool:
        """Delete a key. Returns True if key existed."""

    @abstractmethod
    async def exists(self, key: str) -> bool:
        """Check whether a key exists in cache."""

    @abstractmethod
    async def clear_pattern(self, pattern: str) -> int:
        """Delete all keys matching a glob pattern. Returns count deleted."""

    @abstractmethod
    async def get_or_compute(
        self,
        key: str,
        compute_func: Any,
        expire: Optional[int] = None,
        use_l1_cache: bool = False,
        l1_expire: int = 5,
    ) -> Any:
        """
        Cache-aside pattern with thundering herd protection.
        Fetches from cache or calls compute_func and caches result.
        """


# ---------------------------------------------------------------------------
# Auth Service Interface
# ---------------------------------------------------------------------------

class IAuthService(ABC):
    """
    Abstract contract for authentication/authorization.
    Decouples token logic from route handlers.
    """

    @abstractmethod
    def create_access_token(
        self,
        data: Dict[str, Any],
        expires_delta: Optional[Any] = None,
    ) -> str:
        """Create a signed JWT access token."""

    @abstractmethod
    def create_refresh_token(self, data: Dict[str, Any]) -> str:
        """Create a signed JWT refresh token."""

    @abstractmethod
    def verify_token(self, token: str) -> Dict[str, Any]:
        """
        Decode and validate a JWT token.
        Raises HTTPException(401) on failure.
        """

    @abstractmethod
    def hash_password(self, password: str) -> str:
        """Hash a plaintext password using bcrypt."""

    @abstractmethod
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a plaintext password against its bcrypt hash."""

    @abstractmethod
    async def verify_google_token(self, google_token: str) -> Dict[str, Any]:
        """
        Verify Google OAuth ID token.
        Returns decoded payload on success.
        Raises HTTPException(401) on failure.
        """


# ---------------------------------------------------------------------------
# Database Connection Interface (Interface Segregation)
# ---------------------------------------------------------------------------

class IConnectionManager(ABC):
    """
    Minimal interface for database connection lifecycle.
    Consumers that only need a DB handle depend on this, not on
    the heavier IIndexManager.
    """

    @classmethod
    @abstractmethod
    async def connect_to_database(cls) -> None:
        """Establish database connection and store client/db on class."""

    @classmethod
    @abstractmethod
    async def close_database_connection(cls) -> None:
        """Gracefully close database connection."""


class IIndexManager(ABC):
    """
    Separated interface for database index management.
    Only startup code should depend on this — not request handlers.
    """

    @classmethod
    @abstractmethod
    async def create_indexes(cls) -> None:
        """Create all performance indexes on startup."""

    @classmethod
    @abstractmethod
    async def _create_index_safe(cls, collection: Any, *args: Any, **kwargs: Any) -> None:
        """Create a single index, silently ignoring duplicates."""
