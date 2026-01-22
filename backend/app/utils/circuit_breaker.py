"""
Circuit Breaker Pattern Implementation
Provides resilience for external service calls
"""
import asyncio
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Callable, Any, Optional, Dict
from functools import wraps

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    """Circuit breaker states"""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject calls
    HALF_OPEN = "half_open"  # Testing if service recovered


class CircuitBreakerError(Exception):
    """Raised when circuit is open"""
    pass


class CircuitBreaker:
    """
    Circuit Breaker pattern implementation for external service calls
    
    Usage:
        circuit = CircuitBreaker("payment_gateway", failure_threshold=5)
        
        @circuit
        async def call_payment_api():
            return await payment_client.process()
    """
    
    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        success_threshold: int = 2,
        timeout: float = 30.0,
        reset_timeout: float = 60.0,
        excluded_exceptions: tuple = ()
    ):
        """
        Initialize circuit breaker
        
        Args:
            name: Name of the circuit (for logging/metrics)
            failure_threshold: Number of failures before opening circuit
            success_threshold: Successes needed in half-open to close
            timeout: Timeout for individual calls in seconds
            reset_timeout: Time in seconds before trying half-open
            excluded_exceptions: Exceptions that don't count as failures
        """
        self.name = name
        self.failure_threshold = failure_threshold
        self.success_threshold = success_threshold
        self.timeout = timeout
        self.reset_timeout = reset_timeout
        self.excluded_exceptions = excluded_exceptions
        
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time: Optional[datetime] = None
        self._last_success_time: Optional[datetime] = None
        
    @property
    def state(self) -> CircuitState:
        """Get current circuit state, checking for automatic transitions"""
        if self._state == CircuitState.OPEN:
            # Check if we should try half-open
            if self._last_failure_time:
                elapsed = (datetime.now(timezone.utc) - self._last_failure_time).total_seconds()
                if elapsed >= self.reset_timeout:
                    logger.info(f"Circuit '{self.name}' transitioning to HALF_OPEN")
                    self._state = CircuitState.HALF_OPEN
                    self._success_count = 0
        return self._state
    
    def _record_success(self):
        """Record a successful call"""
        self._last_success_time = datetime.now(timezone.utc)
        
        if self._state == CircuitState.HALF_OPEN:
            self._success_count += 1
            if self._success_count >= self.success_threshold:
                logger.info(f"Circuit '{self.name}' closing after {self._success_count} successes")
                self._state = CircuitState.CLOSED
                self._failure_count = 0
        else:
            # Reset failure count on success in closed state
            self._failure_count = 0
    
    def _record_failure(self, exception: Exception):
        """Record a failed call"""
        # Don't count excluded exceptions
        if isinstance(exception, self.excluded_exceptions):
            return
            
        self._failure_count += 1
        self._last_failure_time = datetime.now(timezone.utc)
        
        if self._state == CircuitState.HALF_OPEN:
            # Any failure in half-open immediately opens
            logger.warning(f"Circuit '{self.name}' re-opening after failure in half-open")
            self._state = CircuitState.OPEN
            self._success_count = 0
        elif self._failure_count >= self.failure_threshold:
            logger.warning(
                f"Circuit '{self.name}' opening after {self._failure_count} failures"
            )
            self._state = CircuitState.OPEN
    
    def __call__(self, func: Callable) -> Callable:
        """Decorator to wrap async functions with circuit breaker"""
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            return await self.call(func, *args, **kwargs)
        return wrapper
    
    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute a function through the circuit breaker
        
        Args:
            func: Async function to call
            *args, **kwargs: Arguments to pass to the function
            
        Returns:
            Result of the function call
            
        Raises:
            CircuitBreakerError: If circuit is open
        """
        current_state = self.state  # This may trigger state transition
        
        if current_state == CircuitState.OPEN:
            logger.warning(f"Circuit '{self.name}' is OPEN, rejecting call")
            raise CircuitBreakerError(
                f"Circuit '{self.name}' is open. Service unavailable."
            )
        
        try:
            # Add timeout to the call
            result = await asyncio.wait_for(
                func(*args, **kwargs),
                timeout=self.timeout
            )
            self._record_success()
            return result
            
        except asyncio.TimeoutError as e:
            logger.error(f"Circuit '{self.name}' call timed out after {self.timeout}s")
            self._record_failure(e)
            raise
            
        except Exception as e:
            logger.error(f"Circuit '{self.name}' call failed: {type(e).__name__}: {e}")
            self._record_failure(e)
            raise
    
    def get_stats(self) -> Dict[str, Any]:
        """Get circuit breaker statistics"""
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self._failure_count,
            "success_count": self._success_count,
            "failure_threshold": self.failure_threshold,
            "success_threshold": self.success_threshold,
            "last_failure": self._last_failure_time.isoformat() if self._last_failure_time else None,
            "last_success": self._last_success_time.isoformat() if self._last_success_time else None
        }
    
    def reset(self):
        """Manually reset the circuit breaker"""
        logger.info(f"Manually resetting circuit '{self.name}'")
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0


# Pre-configured circuit breakers for common services
payment_circuit = CircuitBreaker(
    name="payment_gateway",
    failure_threshold=3,
    reset_timeout=30.0,
    timeout=15.0
)

notification_circuit = CircuitBreaker(
    name="notification_service",
    failure_threshold=5,
    reset_timeout=60.0,
    timeout=10.0
)

email_circuit = CircuitBreaker(
    name="email_service",
    failure_threshold=5,
    reset_timeout=120.0,
    timeout=30.0
)

sms_circuit = CircuitBreaker(
    name="sms_service",
    failure_threshold=5,
    reset_timeout=60.0,
    timeout=10.0
)


async def with_retry(
    func: Callable,
    max_retries: int = 3,
    delay: float = 1.0,
    backoff_factor: float = 2.0,
    exceptions: tuple = (Exception,),
    *args,
    **kwargs
) -> Any:
    """
    Retry a function with exponential backoff
    
    Args:
        func: Async function to call
        max_retries: Maximum number of retry attempts
        delay: Initial delay between retries in seconds
        backoff_factor: Multiplier for delay after each retry
        exceptions: Tuple of exceptions to retry on
        *args, **kwargs: Arguments to pass to the function
        
    Returns:
        Result of the function call
    """
    last_exception = None
    current_delay = delay
    
    for attempt in range(max_retries + 1):
        try:
            return await func(*args, **kwargs)
        except exceptions as e:
            last_exception = e
            if attempt < max_retries:
                logger.warning(
                    f"Retry attempt {attempt + 1}/{max_retries} for {func.__name__} "
                    f"after {type(e).__name__}: {e}. Waiting {current_delay}s"
                )
                await asyncio.sleep(current_delay)
                current_delay *= backoff_factor
            else:
                logger.error(
                    f"All {max_retries} retries exhausted for {func.__name__}"
                )
    
    raise last_exception
