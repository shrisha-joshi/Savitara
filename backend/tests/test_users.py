"""
User API Tests
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestUserProfile:
    """Test user profile endpoints"""
    
    def test_get_profile_without_auth(self):
        """Test getting profile without authentication"""
        response = client.get("/api/v1/users/me")
        assert response.status_code == 401
    
    def test_update_profile_without_auth(self):
        """Test updating profile without authentication"""
        response = client.put("/api/v1/users/me", json={"name": "New Name"})
        assert response.status_code == 401
    
    def test_get_user_by_id_invalid_id(self):
        """Test getting user with invalid ID"""
        response = client.get("/api/v1/users/invalid_id")
        assert response.status_code in [400, 404, 422]


class TestGrihastaProfile:
    """Test Grihasta profile endpoints"""
    
    def test_create_grihasta_profile_without_auth(self):
        """Test creating grihasta profile without auth"""
        profile_data = {
            "location": {
                "address": "123 Test St",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pincode": "400001"
            }
        }
        response = client.post("/api/v1/users/grihasta/profile", json=profile_data)
        assert response.status_code == 401


class TestAcharyaProfile:
    """Test Acharya profile endpoints"""
    
    def test_get_acharyas_list(self):
        """Test getting list of acharyas"""
        response = client.get("/api/v1/users/acharyas")
        assert response.status_code == 200
        assert "data" in response.json()
    
    def test_get_acharya_by_id_invalid(self):
        """Test getting acharya with invalid ID"""
        response = client.get("/api/v1/users/acharyas/invalid_id")
        assert response.status_code in [400, 404, 422]
    
    def test_create_acharya_profile_validation(self):
        """Test acharya profile creation with missing fields"""
        response = client.post("/api/v1/users/acharya/profile", json={})
        assert response.status_code in [401, 422]


class TestUserSearch:
    """Test user search functionality"""
    
    def test_search_users_without_query(self):
        """Test search without query parameter"""
        response = client.get("/api/v1/users/search")
        assert response.status_code in [200, 422]
    
    def test_search_users_with_query(self):
        """Test search with query parameter"""
        response = client.get("/api/v1/users/search?q=test")
        assert response.status_code == 200
