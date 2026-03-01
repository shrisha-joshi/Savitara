import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import app
from app.core.config import settings
from app.core.security import SecurityManager
from app.services.websocket_manager import manager


class DummyWebSocket:
    def __init__(self):
        self.sent = []

    async def send_json(self, data):
        self.sent.append(data)


def _reset_connections():
    manager.active_connections.clear()


@pytest.fixture(autouse=True)
def reset_env(monkeypatch):
    # default to development for tests unless overridden
    monkeypatch.setattr(settings, "APP_ENV", "development")
    monkeypatch.setattr(settings, "DEBUG", True)
    _reset_connections()
    yield
    _reset_connections()


def test_ws_ping_pong_with_token_in_dev(monkeypatch):
    # Accept any token in dev for this test
    monkeypatch.setattr(SecurityManager, "verify_token", staticmethod(lambda token: {"sub": "user1"}))

    client = TestClient(app)
    with client.websocket_connect("/ws/user1?token=fake") as websocket:
        websocket.send_json({"type": "ping"})
        data = websocket.receive_json()
        assert data["type"] == "pong"
        assert "server_time" in data


def test_ws_token_blocked_in_production(monkeypatch):
    monkeypatch.setattr(settings, "APP_ENV", "production")
    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect) as excinfo:
        client.websocket_connect("/ws/user1?token=fake")
    assert excinfo.value.code == 1008


@pytest.mark.asyncio
async def test_send_personal_message_returns_local_when_no_redis():
    manager.redis_client = None
    ws = DummyWebSocket()
    manager.active_connections["u1"] = ws

    status = await manager.send_personal_message("u1", {"hello": "world"})

    assert status == "local"
    assert ws.sent[0]["hello"] == "world"
