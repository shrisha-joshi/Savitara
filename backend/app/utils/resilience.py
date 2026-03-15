"""Reusable resilience policies for external integrations.

Supports:
- bounded timeout per integration call
- retry with exponential backoff
- optional hedged execution for idempotent/readonly operations
"""

from __future__ import annotations

import logging
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, TimeoutError as FutureTimeoutError, wait
from dataclasses import dataclass
from typing import Callable, Optional, Tuple, TypeVar


T = TypeVar("T")


@dataclass(frozen=True)
class IntegrationResiliencePolicy:
    """Resilience controls for one external integration and operation class."""

    name: str
    timeout_seconds: float
    max_retries: int = 0
    initial_backoff_seconds: float = 0.25
    backoff_factor: float = 2.0
    hedging_enabled: bool = False
    hedging_delay_seconds: float = 0.2
    retry_exceptions: Tuple[type[Exception], ...] = (Exception,)


def _execute_with_timeout(operation: Callable[[], T], timeout_seconds: float) -> T:
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(operation)
        try:
            return future.result(timeout=timeout_seconds)
        except FutureTimeoutError as exc:
            future.cancel()
            raise TimeoutError(
                f"Operation timed out after {timeout_seconds:.2f}s"
            ) from exc


def _execute_with_hedging(operation: Callable[[], T], policy: IntegrationResiliencePolicy) -> T:
    with ThreadPoolExecutor(max_workers=2) as executor:
        primary = executor.submit(operation)
        done, _pending = wait({primary}, timeout=policy.hedging_delay_seconds)
        if done:
            return primary.result(timeout=policy.timeout_seconds)

        secondary = executor.submit(operation)
        done, pending = wait(
            {primary, secondary},
            timeout=policy.timeout_seconds,
            return_when=FIRST_COMPLETED,
        )

        if not done:
            for task in pending:
                task.cancel()
            raise TimeoutError(
                f"Hedged operation timed out after {policy.timeout_seconds:.2f}s"
            )

        winner = next(iter(done))
        for task in pending:
            task.cancel()
        return winner.result()


def execute_with_resilience(
    operation: Callable[[], T],
    policy: IntegrationResiliencePolicy,
    logger: Optional[logging.Logger] = None,
) -> T:
    """Run operation using configured timeout/retry/hedging policy."""
    active_logger = logger or logging.getLogger(__name__)
    attempt = 0
    backoff = policy.initial_backoff_seconds

    while True:
        try:
            if policy.hedging_enabled:
                return _execute_with_hedging(operation, policy)
            return _execute_with_timeout(operation, policy.timeout_seconds)
        except policy.retry_exceptions as exc:
            if attempt >= policy.max_retries:
                raise

            attempt += 1
            active_logger.warning(
                "Resilience retry %s/%s for %s after %s: %s",
                attempt,
                policy.max_retries,
                policy.name,
                type(exc).__name__,
                exc,
            )
            time.sleep(backoff)
            backoff *= policy.backoff_factor