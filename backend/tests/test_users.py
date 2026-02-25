"""
User API Tests
"""
import pytest
from app.main import app

@pytest.mark.asyncio
class TestUserProfile:
    """Test user profile endpoints"""
    
    async def test_get_profile_without_auth(self, async_client):
        """Test getting profile without authentication"""
        response = await async_client.get("/api/v1/users/me")
        assert response.status_code == 401
    
    async def test_update_profile_without_auth(self, async_client):
        """Test updating profile without authentication"""
        response = await async_client.put("/api/v1/users/me", json={"name": "New Name"})
        assert response.status_code == 401
    
    async def test_get_user_by_id_invalid_id(self, async_client):
        """Test getting user with invalid ID"""
        response = await async_client.get("/api/v1/users/invalid_id")
        assert response.status_code in [400, 404, 422]


@pytest.mark.asyncio
class TestGrihastaProfile:
    """Test Grihasta profile endpoints"""
    
    async def test_create_grihasta_profile_without_auth(self, async_client):
        """Test creating grihasta profile without auth"""
        profile_data = {
            "location": {
                "address": "123 Test St",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pincode": "400001"
            }
        }
        response = await async_client.post("/api/v1/users/grihasta/profile", json=profile_data)
        assert response.status_code == 401


@pytest.mark.asyncio
class TestAcharyaProfile:
    """Test Acharya profile endpoints"""
    
    async def test_get_acharyas_list(self, async_client):
        """Test getting list of acharyas"""
        response = await async_client.get("/api/v1/users/acharyas")
        assert response.status_code == 200
        assert "data" in response.json()
    
    async def test_get_acharya_by_id_invalid(self, async_client):
        """Test getting acharya with invalid ID"""
        response = await async_client.get("/api/v1/users/acharyas/invalid_id")
        assert response.status_code in [400, 404, 422]
    
    # This one might not need DB if it fails auth first, but consistency is good
    async def test_create_acharya_profile_validation(self, async_client):
        """Test acharya profile creation with missing fields"""
        response = await async_client.post("/api/v1/users/acharya/profile", json={})
        assert response.status_code in [401, 422]


@pytest.mark.asyncio
class TestUserSearch:
    """Test user search functionality"""
    
    async def test_search_users_without_query(self, async_client):
        """Test search without query parameter"""
        response = await async_client.get("/api/v1/users/search")
        assert response.status_code in [200, 422]
    
    async def test_search_users_with_query(self, async_client):
        """Test search with query parameter"""
        response = await async_client.get("/api/v1/users/search?q=test")
        assert response.status_code == 200
