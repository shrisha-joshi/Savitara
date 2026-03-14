"""Phase 3 chaos/failure-mode tests for core resilience paths."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from redis.exceptions import RedisError


@pytest.mark.asyncio
async def test_chaos_ws_redis_publish_failure_falls_back_to_local_delivery():
    """When Redis publish fails, WS manager should still try local socket delivery."""
    from app.services.websocket_manager import ConnectionManager

    mgr = ConnectionManager()
    user_id = "chaos-user-1"

    fake_ws = AsyncMock()
    mgr.active_connections[user_id] = fake_ws
    mgr.redis_client = object()  # force redis delivery path

    with patch.object(
        mgr._transport,
        "publish_user_message",
        new=AsyncMock(side_effect=RedisError("redis down")),
    ):
        result = await mgr.send_personal_message(user_id, {"type": "ping"})

    assert result == "local"
    fake_ws.send_json.assert_called_once_with({"type": "ping"})


def test_chaos_payment_circuit_open_rejects_create_order():
    """Payment service must fail fast when payment circuit is OPEN."""
    from app.services.payment_service import RazorpayService
    from app.utils.circuit_breaker import CircuitState, payment_circuit
    from app.core.exceptions import PaymentFailedError

    original_state = payment_circuit._state
    payment_circuit._state = CircuitState.OPEN

    try:
        with patch("app.services.payment_service.razorpay.Client", return_value=MagicMock()):
            service = RazorpayService()
            with pytest.raises(PaymentFailedError):
                service.create_order(amount=1000)
    finally:
        payment_circuit._state = original_state


def test_chaos_notification_circuit_open_rejects_multicast():
    """Notification service must fail fast when notification circuit is OPEN."""
    from app.services.notification_service import NotificationService
    from app.utils.circuit_breaker import CircuitState, notification_circuit
    from app.core.exceptions import ExternalServiceError

    original_state = notification_circuit._state
    notification_circuit._state = CircuitState.OPEN

    try:
        service = NotificationService()
        with pytest.raises(ExternalServiceError):
            service.send_multicast(
                tokens=["t1", "t2"],
                title="Chaos",
                body="Testing open circuit",
                data={"type": "chaos"},
            )
    finally:
        notification_circuit._state = original_state
