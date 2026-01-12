"""
Pytest Configuration and Fixtures
"""
import pytest
import asyncio
from typing import AsyncGenerator, Generator
from fastapi.testclient import TestClient
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.main import app
from app.db.connection import MongoDB
from app.core.config import settings


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def test_db() -> AsyncGenerator[AsyncIOMotorDatabase, None]:
    """Create test database connection"""
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[f"{settings.MONGODB_DB_NAME}_test"]
    
    # Clean database before tests
    collections = await db.list_collection_names()
    for collection in collections:
        await db[collection].delete_many({})
    
    yield db
    
    # Clean database after tests
    collections = await db.list_collection_names()
    for collection in collections:
        await db[collection].delete_many({})
    
    client.close()


@pytest.fixture(scope="module")
def client() -> TestClient:
    """Create test client"""
    return TestClient(app)


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


@pytest.fixture
async def authenticated_token(client, mock_user_data, test_db):
    """Get authentication token for tests"""
    # Mock Google OAuth response
    response = client.post(
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
