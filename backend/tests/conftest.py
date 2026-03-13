"""
Pytest Configuration and Fixtures
"""
import pytest
import pytest_asyncio
import asyncio
import unittest.mock as unittest_mock
import os
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from _pytest.fixtures import FixtureDef
from app.main import app
from app.db.connection import DatabaseManager
from app.core.config import settings


if not hasattr(FixtureDef, "unittest"):
    FixtureDef.unittest = False

if not hasattr(pytest, "mock"):
    pytest.mock = unittest_mock


async def _list_collections_with_retry(db: AsyncIOMotorDatabase, retries: int = 3) -> list[str]:
    """Retry listing collections to handle transient DNS/network issues in CI/dev."""
    last_exc = None
    for attempt in range(retries):
        try:
            return await db.list_collection_names()
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if attempt < retries - 1:
                await asyncio.sleep(1)
    if last_exc:
        raise last_exc
    return []


@pytest_asyncio.fixture(scope="function")
async def test_db(monkeypatch) -> AsyncGenerator[AsyncIOMotorDatabase, None]:
    """Create test database connection"""
    # 1. Prevent real connection attempt during lifespan
    async def mock_connect():
        pass
    monkeypatch.setattr(DatabaseManager, "connect_to_database", mock_connect)
    
    # 2. Prevent real disconnect clearing our mock
    async def mock_close():
        pass
    monkeypatch.setattr(DatabaseManager, "close_database_connection", mock_close)

    mongo_url = settings.MONGODB_URL
    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
    db = client[f"{settings.MONGODB_DB_NAME}_test"]

    # Validate connectivity early; fallback to local Mongo if SRV DNS is unavailable.
    try:
        await _list_collections_with_retry(db, retries=2)
    except Exception:
        fallback_url = os.getenv("TEST_MONGODB_URL", "mongodb://localhost:27017")
        client.close()
        client = AsyncIOMotorClient(fallback_url, serverSelectionTimeoutMS=5000)
        db = client[f"{settings.MONGODB_DB_NAME}_test"]
        await _list_collections_with_retry(db, retries=2)
    
    # 3. Set the global state explicitly
    DatabaseManager.client = client
    DatabaseManager.db = db
    DatabaseManager._test_db = db  # Fallback for tests
    
    # 4. Patch get_database to ensure it returns our db
    monkeypatch.setattr(DatabaseManager, "get_database", lambda: db)
    
    # Clean database before tests
    collections = await _list_collections_with_retry(db)
    for collection in collections:
        await db[collection].delete_many({})
    
    yield db
    
    # Clean database after tests
    collections = await _list_collections_with_retry(db)
    for collection in collections:
        await db[collection].delete_many({})
    
    client.close()
    DatabaseManager.client = None
    DatabaseManager.db = None
    if hasattr(DatabaseManager, "_test_db"):
        del DatabaseManager._test_db




@pytest_asyncio.fixture(scope="function")
async def client(test_db):
    """Create async test client with overridden dependencies (replaces sync TestClient for httpx compatibility)"""
    from app.db.connection import get_db
    app.dependency_overrides[get_db] = lambda: test_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

    # Clear overrides
    app.dependency_overrides = {}


@pytest_asyncio.fixture(scope="function")
async def async_client(test_db):
    """Create async test client with overridden dependencies"""
    from app.db.connection import get_db
    app.dependency_overrides[get_db] = lambda: test_db
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    
    # Clear overrides
    app.dependency_overrides = {}


@pytest.fixture
def mock_user_data():
    """Mock user registration data"""
    return {
        "email": "test@example.com",
        "name": "Test User",
        "role": "grihasta",
        "phone": "9876543210"
    }


@pytest.fixture
def mock_acharya_data():
    """Mock acharya profile data"""
    return {
        "name": "Pandit Test",
        "email": "pandit@example.com",
        "phone": "9876543211",
        "role": "acharya",
        "specializations": ["Vedic Rituals", "Marriage Ceremonies"],
        "languages": ["Hindi", "Sanskrit", "English"],
        "experience_years": 15,
        "hourly_rate": 500,
        "parampara": "Smartha",
        "location": {
            "address": "123 Temple Street",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400001",
            "coordinates": {"type": "Point", "coordinates": [72.8777, 19.0760]}
        }
    }


@pytest.fixture
def mock_booking_data():
    """Mock booking data"""
    return {
        "pooja_type": "Satyanarayan Puja",
        "date": "2026-02-15",
        "time": "10:00",
        "duration_hours": 3,
        "location": {
            "address": "456 Home Street",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400002"
        },
        "booking_type": "with_samagri",
        "special_instructions": "Please bring all necessary items"
    }


@pytest_asyncio.fixture
async def authenticated_token(client, mock_user_data, test_db):
    """Get authentication token for tests"""
    # Mock Google OAuth response
    response = await client.post(
        "/api/v1/auth/google",
        json={
            "id_token": "mock_token",
            "role": "grihasta"
        }
    )

    if response.status_code == 200:
        return response.json()["data"]["access_token"]
    return None


@pytest.fixture
def auth_headers(authenticated_token):
    """Get authorization headers"""
    return {"Authorization": f"Bearer {authenticated_token}"}


# End of file

