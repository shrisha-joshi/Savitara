import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_ws_health_endpoint(client):
    resp = client.get('/health/ws')
    assert resp.status_code == 200
    data = resp.json()
    assert 'status' in data
    assert 'redis' in data
    assert 'connections' in data
    assert isinstance(data['connections'], int)
    assert data['status'] in {'healthy', 'degraded'}
