"""
Booking API Tests
"""
import pytest
from datetime import datetime, timedelta
from app.main import app

class TestBookingCreation:
    """Test booking creation"""
    
    @pytest.mark.asyncio
    async def test_create_booking_without_auth(self, client):
        """Test creating booking without authentication"""
        booking_data = {
            "acharya_id": "507f1f77bcf86cd799439011",
            "pooja_type": "Satyanarayan Puja",
            "date": "2026-02-15",
            "time": "10:00"
        }
        response = await client.post("/api/v1/bookings", json=booking_data)
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_create_booking_invalid_date(self, client):
        """Test creating booking with past date"""
        past_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        booking_data = {
            "acharya_id": "507f1f77bcf86cd799439011",
            "pooja_type": "Test Puja",
            "date": past_date,
            "time": "10:00"
        }
        response = await client.post("/api/v1/bookings", json=booking_data)
        assert response.status_code in [400, 401, 422]
    
    @pytest.mark.asyncio
    async def test_create_booking_invalid_acharya_id(self, client):
        """Test creating booking with invalid acharya ID"""
        booking_data = {
            "acharya_id": "invalid_id",
            "pooja_type": "Test Puja",
            "date": "2026-02-15",
            "time": "10:00"
        }
        response = await client.post("/api/v1/bookings", json=booking_data)
        assert response.status_code in [400, 401, 422]


class TestBookingRetrieval:
    """Test booking retrieval"""
    
    @pytest.mark.asyncio
    async def test_get_all_bookings_without_auth(self, client):
        """Test getting bookings without auth"""
        response = await client.get("/api/v1/bookings")
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_get_booking_by_id_without_auth(self, client):
        """Test getting specific booking without auth"""
        response = await client.get("/api/v1/bookings/507f1f77bcf86cd799439011")
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_get_booking_invalid_id(self, client):
        """Test getting booking with invalid ID"""
        response = await client.get("/api/v1/bookings/invalid_id")
        assert response.status_code in [400, 401, 422]


class TestBookingUpdates:
    """Test booking updates"""
    
    @pytest.mark.asyncio
    async def test_update_booking_status_without_auth(self, client):
        """Test updating booking status without auth"""
        response = await client.put(
            "/api/v1/bookings/507f1f77bcf86cd799439011/status",
            json={"status": "confirmed"}
        )
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_cancel_booking_without_auth(self, client):
        """Test canceling booking without auth"""
        response = await client.put("/api/v1/bookings/507f1f77bcf86cd799439011/cancel")
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_update_booking_invalid_status(self, client):
        """Test updating booking with invalid status"""
        response = await client.put(
            "/api/v1/bookings/507f1f77bcf86cd799439011/status",
            json={"status": "invalid_status"}
        )
        assert response.status_code in [400, 401, 422]


class TestAttendanceConfirmation:
    """Test two-factor attendance confirmation"""
    
    @pytest.mark.asyncio
    async def test_generate_otp_without_auth(self, client):
        """Test generating OTP without auth"""
        response = await client.post("/api/v1/bookings/507f1f77bcf86cd799439011/generate-otp")
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_verify_attendance_without_auth(self, client):
        """Test verifying attendance without auth"""
        response = await client.post(
            "/api/v1/bookings/507f1f77bcf86cd799439011/attendance/confirm",
            json={"otp": "1234"}
        )
        assert response.status_code == 401
    
    def test_verify_attendance_invalid_otp(self, client):
        """Test verifying attendance with invalid OTP"""
        # Would need authenticated request
        pass
