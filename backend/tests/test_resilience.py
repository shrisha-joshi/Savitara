"""Unit tests for integration resilience policies."""
import time

import pytest

from app.utils.resilience import IntegrationResiliencePolicy, execute_with_resilience


def test_resilience_retries_then_succeeds():
    attempts = {"count": 0}

    def flaky_operation():
        attempts["count"] += 1
        if attempts["count"] < 3:
            raise RuntimeError("temporary failure")
        return "ok"

    policy = IntegrationResiliencePolicy(
        name="unit.retry",
        timeout_seconds=1.0,
        max_retries=3,
        initial_backoff_seconds=0.01,
        backoff_factor=1.0,
        hedging_enabled=False,
        retry_exceptions=(RuntimeError,),
    )

    result = execute_with_resilience(flaky_operation, policy=policy)
    assert result == "ok"
    assert attempts["count"] == 3


def test_resilience_timeout_raises():
    def slow_operation():
        time.sleep(0.2)
        return "late"

    policy = IntegrationResiliencePolicy(
        name="unit.timeout",
        timeout_seconds=0.05,
        max_retries=0,
        hedging_enabled=False,
        retry_exceptions=(TimeoutError,),
    )

    with pytest.raises(TimeoutError):
        execute_with_resilience(slow_operation, policy=policy)


def test_resilience_hedging_returns_fastest_result():
    attempts = {"count": 0}

    def operation_with_slow_primary_then_fast_hedge():
        attempts["count"] += 1
        if attempts["count"] == 1:
            time.sleep(0.3)
            return "slow-primary"
        time.sleep(0.01)
        return "fast-hedge"

    policy = IntegrationResiliencePolicy(
        name="unit.hedging",
        timeout_seconds=1.0,
        max_retries=0,
        hedging_enabled=True,
        hedging_delay_seconds=0.02,
    )

    result = execute_with_resilience(operation_with_slow_primary_then_fast_hedge, policy=policy)
    assert result == "fast-hedge"
    assert attempts["count"] >= 2
