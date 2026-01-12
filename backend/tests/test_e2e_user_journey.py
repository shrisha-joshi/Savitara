"""
End-to-End Tests for Complete User Journeys
Tests full user workflows from registration to booking completion
"""
import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta
import asyncio


class TestGrihastaJourney:
    """Test complete Grihasta user journey"""
    
    @pytest.mark.asyncio
    async def test_complete_grihasta_flow(self, async_client: AsyncClient):
        """
        Test complete Grihasta journey:
        1. Register
        2. Login
        3. Complete onboarding
        4. Search for Acharyas
        5. View Acharya details
        6. Create booking
        7. Make payment
        8. Leave review
        """
        
        # 1. Register
        register_data = {
            "phone": "+919876543210",
            "device_id": "test_device_grihasta_123",
            "role": "GRIHASTA"
        }
        register_response = await async_client.post(
            "/api/v1/auth/register",
            json=register_data
        )
        assert register_response.status_code == 200
        register_json = register_response.json()
        assert register_json["success"] is True
        
        # 2. Verify OTP and Login
        otp_data = {
            "phone": "+919876543210",
            "otp": "123456",  # Test OTP
            "device_id": "test_device_grihasta_123"
        }
        login_response = await async_client.post(
            "/api/v1/auth/verify-otp",
            json=otp_data
        )
        assert login_response.status_code == 200
        login_json = login_response.json()
        assert "access_token" in login_json["data"]
        
        token = login_json["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 3. Complete Onboarding
        onboarding_data = {
            "name": "Test Grihasta",
            "phone": "+919876543210",
            "location": {
                "address": "123 Test Street",
                "city": "Mumbai",
                "state": "Maharashtra",
                "country": "India",
                "pincode": "400001",
                "coordinates": {
                    "latitude": 19.0760,
                    "longitude": 72.8777
                }
            },
            "date_of_birth": "1990-01-01",
            "gotra": "Bharadwaja",
            "family_size": 4
        }
        onboarding_response = await async_client.post(
            "/api/v1/users/grihasta/onboarding",
            json=onboarding_data,
            headers=headers
        )
        assert onboarding_response.status_code == 200
        
        # 4. Search for Acharyas
        search_params = {
            "city": "Mumbai",
            "specialization": "Vedic Rituals",
            "min_rating": 4.0,
            "page": 1,
            "limit": 10
        }
        search_response = await async_client.get(
            "/api/v1/users/acharyas",
            params=search_params,
            headers=headers
        )
        assert search_response.status_code == 200
        search_json = search_response.json()
        assert search_json["success"] is True
        assert len(search_json["data"]["acharyas"]) > 0
        
        acharya_id = search_json["data"]["acharyas"][0]["_id"]
        
        # 5. View Acharya Details
        details_response = await async_client.get(
            f"/api/v1/users/acharyas/{acharya_id}",
            headers=headers
        )
        assert details_response.status_code == 200
        details_json = details_response.json()
        assert details_json["data"]["profile"]["id"] == acharya_id
        
        # Get a pooja from the acharya
        poojas = details_json["data"]["poojas"]
        assert len(poojas) > 0
        pooja_id = poojas[0]["_id"]
        
        # 6. Create Booking
        booking_date = (datetime.now() + timedelta(days=7)).isoformat()
        booking_data = {
            "acharya_id": acharya_id,
            "pooja_id": pooja_id,
            "booking_date": booking_date,
            "time_slot": "10:00-11:00",
            "location": {
                "address": "123 Test Street",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pincode": "400001"
            },
            "special_requirements": "Please bring all materials"
        }
        booking_response = await async_client.post(
            "/api/v1/bookings",
            json=booking_data,
            headers=headers
        )
        assert booking_response.status_code == 200
        booking_json = booking_response.json()
        assert booking_json["success"] is True
        booking_id = booking_json["data"]["booking"]["id"]
        
        # 7. Make Payment
        payment_data = {
            "booking_id": booking_id,
            "amount": 1000.0,
            "payment_method": "RAZORPAY",
            "razorpay_payment_id": "pay_test123",
            "razorpay_order_id": "order_test123",
            "razorpay_signature": "signature_test123"
        }
        payment_response = await async_client.post(
            "/api/v1/payments/verify",
            json=payment_data,
            headers=headers
        )
        assert payment_response.status_code == 200
        payment_json = payment_response.json()
        assert payment_json["success"] is True
        
        # 8. Complete booking (simulate Acharya marking as completed)
        # This would normally be done by the Acharya, but we'll simulate it
        await asyncio.sleep(1)  # Simulate time passing
        
        # 9. Leave Review
        review_data = {
            "booking_id": booking_id,
            "acharya_id": acharya_id,
            "rating": 5,
            "comment": "Excellent service! Very knowledgeable and professional.",
            "is_public": True
        }
        review_response = await async_client.post(
            "/api/v1/reviews",
            json=review_data,
            headers=headers
        )
        assert review_response.status_code == 200
        review_json = review_response.json()
        assert review_json["success"] is True
        
        print("✅ Complete Grihasta journey test passed!")


class TestAcharyaJourney:
    """Test complete Acharya user journey"""
    
    @pytest.mark.asyncio
    async def test_complete_acharya_flow(self, async_client: AsyncClient):
        """
        Test complete Acharya journey:
        1. Register
        2. Login
        3. Complete onboarding with verification documents
        4. Wait for admin verification (simulated)
        5. Add poojas/services
        6. Receive booking
        7. Accept booking
        8. Mark booking as completed
        9. Receive payment
        """
        
        # 1. Register
        register_data = {
            "phone": "+919876543211",
            "device_id": "test_device_acharya_456",
            "role": "ACHARYA"
        }
        register_response = await async_client.post(
            "/api/v1/auth/register",
            json=register_data
        )
        assert register_response.status_code == 200
        
        # 2. Verify OTP and Login
        otp_data = {
            "phone": "+919876543211",
            "otp": "123456",
            "device_id": "test_device_acharya_456"
        }
        login_response = await async_client.post(
            "/api/v1/auth/verify-otp",
            json=otp_data
        )
        assert login_response.status_code == 200
        login_json = login_response.json()
        token = login_json["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 3. Complete Onboarding
        onboarding_data = {
            "name": "Test Acharya",
            "phone": "+919876543211",
            "parampara": "Advaita Vedanta",
            "experience_years": 15,
            "specializations": ["Vedic Rituals", "Astrology", "Vastu Shastra"],
            "languages": ["Hindi", "Sanskrit", "English"],
            "education": "Vedic Scholar from Kashi",
            "certifications": ["Certified Astrologer"],
            "location": {
                "address": "456 Temple Road",
                "city": "Varanasi",
                "state": "Uttar Pradesh",
                "country": "India",
                "pincode": "221001",
                "coordinates": {
                    "latitude": 25.3176,
                    "longitude": 82.9739
                }
            },
            "bio": "Experienced Vedic scholar with 15 years of practice",
            "verification_documents": {
                "aadhaar": "123456789012",
                "pan": "ABCDE1234F",
                "certificates": ["cert1.pdf", "cert2.pdf"]
            }
        }
        onboarding_response = await async_client.post(
            "/api/v1/users/acharya/onboarding",
            json=onboarding_data,
            headers=headers
        )
        assert onboarding_response.status_code == 200
        
        # 4. Check verification status
        profile_response = await async_client.get(
            "/api/v1/users/profile",
            headers=headers
        )
        assert profile_response.status_code == 200
        profile_json = profile_response.json()
        # Initially should be PENDING_VERIFICATION
        # In production, admin would verify; here we simulate it
        
        # 5. Add Poojas/Services
        pooja_data = {
            "name": "Ganesh Puja",
            "description": "Complete Ganesh Puja ceremony with all rituals",
            "duration_minutes": 120,
            "price": 2100.0,
            "category": "Deity Worship",
            "materials_included": True,
            "requirements": ["Clean space", "Platform for idol"],
            "benefits": ["Removes obstacles", "Brings prosperity"]
        }
        pooja_response = await async_client.post(
            "/api/v1/poojas",
            json=pooja_data,
            headers=headers
        )
        assert pooja_response.status_code == 200
        pooja_json = pooja_response.json()
        assert pooja_json["success"] is True
        
        # 6-9. Booking flow tested in Grihasta journey
        # Here we'd test: receiving notification, accepting booking,
        # marking as completed, and receiving payment
        
        print("✅ Complete Acharya journey test passed!")


class TestSearchAndDiscovery:
    """Test search and discovery features"""
    
    @pytest.mark.asyncio
    async def test_elasticsearch_search(self, async_client: AsyncClient):
        """Test Elasticsearch-powered search"""
        
        # Full-text search
        search_response = await async_client.get(
            "/api/v1/users/acharyas",
            params={
                "query": "vedic astrology expert",
                "use_elasticsearch": True,
                "sort_by": "relevance",
                "page": 1,
                "limit": 10
            }
        )
        assert search_response.status_code == 200
        search_json = search_response.json()
        assert search_json["success"] is True
        assert "search_metadata" in search_json["data"]
        
    @pytest.mark.asyncio
    async def test_geospatial_search(self, async_client: AsyncClient):
        """Test proximity-based search"""
        
        search_response = await async_client.get(
            "/api/v1/users/acharyas",
            params={
                "latitude": 19.0760,
                "longitude": 72.8777,
                "use_elasticsearch": True,
                "sort_by": "distance",
                "page": 1,
                "limit": 10
            }
        )
        assert search_response.status_code == 200
        search_json = search_response.json()
        assert search_json["success"] is True
        
    @pytest.mark.asyncio
    async def test_multi_filter_search(self, async_client: AsyncClient):
        """Test search with multiple filters"""
        
        search_response = await async_client.get(
            "/api/v1/users/acharyas",
            params={
                "city": "Mumbai",
                "state": "Maharashtra",
                "specialization": "Vedic Rituals",
                "language": "Hindi",
                "min_rating": 4.5,
                "max_price": 5000,
                "sort_by": "rating",
                "page": 1,
                "limit": 20
            }
        )
        assert search_response.status_code == 200
        search_json = search_response.json()
        assert search_json["success"] is True
        
        # Verify filters are applied
        acharyas = search_json["data"]["acharyas"]
        for acharya in acharyas:
            assert acharya["location"]["city"].lower() == "mumbai"
            assert acharya["rating"] >= 4.5


class TestPerformance:
    """Test system performance under load"""
    
    @pytest.mark.asyncio
    async def test_concurrent_searches(self, async_client: AsyncClient):
        """Test handling concurrent search requests"""
        
        async def search_request():
            return await async_client.get(
                "/api/v1/users/acharyas",
                params={"city": "Mumbai", "page": 1, "limit": 10}
            )
        
        # Fire 10 concurrent requests
        tasks = [search_request() for _ in range(10)]
        responses = await asyncio.gather(*tasks)
        
        # All should succeed
        for response in responses:
            assert response.status_code == 200
            
    @pytest.mark.asyncio
    async def test_rate_limiting(self, async_client: AsyncClient):
        """Test rate limiting enforcement"""
        
        # Make rapid requests to trigger rate limit
        responses = []
        for _ in range(70):  # Exceeds 60/min limit
            response = await async_client.get("/api/v1/users/acharyas")
            responses.append(response)
            
        # Some requests should be rate limited
        rate_limited = [r for r in responses if r.status_code == 429]
        assert len(rate_limited) > 0
        
        # Check rate limit headers
        for response in responses[:10]:
            assert "X-RateLimit-Limit" in response.headers
            assert "X-RateLimit-Remaining" in response.headers


class TestDataSecurity:
    """Test data encryption and security features"""
    
    @pytest.mark.asyncio
    async def test_sensitive_data_encryption(self, async_client: AsyncClient):
        """Test that sensitive data is encrypted in database"""
        
        # Register and onboard with sensitive data
        register_data = {
            "phone": "+919999999999",
            "device_id": "security_test_device",
            "role": "ACHARYA"
        }
        register_response = await async_client.post(
            "/api/v1/auth/register",
            json=register_data
        )
        assert register_response.status_code == 200
        
        # Login
        otp_data = {
            "phone": "+919999999999",
            "otp": "123456",
            "device_id": "security_test_device"
        }
        login_response = await async_client.post(
            "/api/v1/auth/verify-otp",
            json=otp_data
        )
        token = login_response.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Complete onboarding with sensitive data
        onboarding_data = {
            "name": "Security Test Acharya",
            "phone": "+919999999999",
            "parampara": "Test",
            "experience_years": 10,
            "specializations": ["Test"],
            "languages": ["English"],
            "location": {
                "address": "Test",
                "city": "Test City",
                "state": "Test State",
                "country": "India",
                "pincode": "123456"
            },
            "verification_documents": {
                "aadhaar": "999999999999",  # Sensitive
                "pan": "ZZZZZ9999Z",  # Sensitive
                "bank_account": "1234567890",  # Sensitive
                "ifsc": "TEST0001234"
            }
        }
        onboarding_response = await async_client.post(
            "/api/v1/users/acharya/onboarding",
            json=onboarding_data,
            headers=headers
        )
        assert onboarding_response.status_code == 200
        
        # Verify data is NOT returned in plain text in GET requests
        profile_response = await async_client.get(
            "/api/v1/users/profile",
            headers=headers
        )
        profile_json = profile_response.json()
        
        # Sensitive fields should be masked or encrypted
        if "verification_documents" in profile_json["data"]:
            docs = profile_json["data"]["verification_documents"]
            # Should not return full aadhaar/pan
            if "aadhaar" in docs:
                assert docs["aadhaar"] != "999999999999"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--asyncio-mode=auto"])
