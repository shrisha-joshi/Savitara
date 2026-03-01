"""
Unit tests for Trust API Endpoints
Tests REST API for trust scores, disputes, checkpoints, guarantees
Uses FastAPI TestClient
Target: 80% coverage
"""
import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId

from app.main import app
from app.core.security import create_access_token


@pytest.fixture
def client():
    """Test client for API requests"""
    return TestClient(app)


@pytest.fixture
def admin_token():
    """Generate admin JWT token"""
    payload = {
        "sub": str(ObjectId()),
        "email": "admin@savitara.com",
        "role": "admin"
    }
    return create_access_token(payload)


@pytest.fixture
def acharya_token():
    """Generate Acharya JWT token"""
    payload = {
        "sub": str(ObjectId()),
        "email": "acharya@example.com",
        "role": "acharya"
    }
    return create_access_token(payload)


@pytest.fixture
def grihasta_token():
    """Generate Grihasta JWT token"""
    payload = {
        "sub": str(ObjectId()),
        "email": "grihasta@example.com",
        "role": "grihasta"
    }
    return create_access_token(payload)


class TestTrustScoreAPI:
    """Test trust score endpoints"""
    
    def test_get_acharya_trust_score_success(self, client):
        """Test GET /trust/acharyas/{id}/trust-score"""
        acharya_id = str(ObjectId())
        
        with patch("app.services.trust_service.TrustService.calculate_acharya_trust_score") as mock_calc:
            mock_calc.return_value = {
                "trust_score": {
                    "overall_score": 85.5,
                    "components": {
                        "verification_score": 90,
                        "completion_rate_score": 85,
                        "response_time_score": 80,
                        "rebooking_rate_score": 85,
                        "review_quality_score": 88
                    }
                },
                "verification_level": "savitara_verified",
                "stats": {
                    "total_bookings": 120,
                    "completion_rate": 95.5
                }
            }
            
            response = client.get(f"/api/v1/trust/acharyas/{acharya_id}/trust-score")
        
        assert response.status_code == 200
        data = response.json()
        assert data["trust_score"]["overall_score"] == 85.5
        assert data["verification_level"] == "savitara_verified"
        
    def test_get_trust_score_invalid_acharya(self, client):
        """Test 404 for non-existent Acharya"""
        fake_id = str(ObjectId())
        
        with patch("app.services.trust_service.TrustService.calculate_acharya_trust_score") as mock_calc:
            mock_calc.side_effect = Exception("Acharya not found")
            
            response = client.get(f"/api/v1/trust/acharyas/{fake_id}/trust-score")
        
        assert response.status_code in [404, 500]


class TestCheckpointAPI:
    """Test booking checkpoint (OTP) endpoints"""
    
    def test_create_checkpoint_success(self, client, acharya_token):
        """Test POST /trust/bookings/{id}/checkpoints/check-in"""
        booking_id = str(ObjectId())
        
        payload = {
            "location": {
                "latitude": 19.0760,
                "longitude": 72.8777
            }
        }
        
        with patch("app.services.trust_service.TrustService.generate_booking_checkpoint_otp") as mock_gen:
            mock_gen.return_value = {
                "otp_code": "123456",
                "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5)
            }
            
            response = client.post(
                f"/api/v1/trust/bookings/{booking_id}/checkpoints/check-in",
                json=payload,
                headers={"Authorization": f"Bearer {acharya_token}"}
            )
        
        assert response.status_code == 200
        data = response.json()
        assert "otp_code" in data
        assert len(data["otp_code"]) == 6
        
    def test_create_checkpoint_unauthorized(self, client):
        """Test 401 when no auth token provided"""
        booking_id = str(ObjectId())
        
        payload = {
            "location": {"latitude": 19.0760, "longitude": 72.8777}
        }
        
        response = client.post(
            f"/api/v1/trust/bookings/{booking_id}/checkpoints/check-in",
            json=payload
        )
        
        assert response.status_code == 401
        
    def test_verify_checkpoint_success(self, client, grihasta_token):
        """Test POST /trust/bookings/{id}/checkpoints/verify"""
        booking_id = str(ObjectId())
        
        payload = {
            "otp_code": "123456",
            "location": {
                "latitude": 19.0760,
                "longitude": 72.8777
            }
        }
        
        with patch("app.services.trust_service.TrustService.verify_checkpoint_otp") as mock_verify:
            mock_verify.return_value = {
                "verified": True,
                "location_match": True
            }
            
            response = client.post(
                f"/api/v1/trust/bookings/{booking_id}/checkpoints/verify",
                json=payload,
                headers={"Authorization": f"Bearer {grihasta_token}"}
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["verified"] is True
        
    def test_verify_checkpoint_wrong_otp(self, client, grihasta_token):
        """Test OTP verification with wrong code"""
        booking_id = str(ObjectId())
        
        payload = {
            "otp_code": "999999",
            "location": {"latitude": 19.0760, "longitude": 72.8777}
        }
        
        with patch("app.services.trust_service.TrustService.verify_checkpoint_otp") as mock_verify:
            mock_verify.return_value = {
                "verified": False,
                "error": "Invalid OTP"
            }
            
            response = client.post(
                f"/api/v1/trust/bookings/{booking_id}/checkpoints/verify",
                json=payload,
                headers={"Authorization": f"Bearer {grihasta_token}"}
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["verified"] is False


class TestDisputeAPI:
    """Test dispute filing and resolution"""
    
    def test_file_dispute_success(self, client, grihasta_token):
        """Test POST /trust/disputes"""
        payload = {
            "booking_id": str(ObjectId()),
            "category": "service_quality",
            "description": "Pooja was not performed as expected",
            "evidence": []
        }
        
        with patch("app.services.trust_service.TrustService.file_dispute") as mock_file:
            mock_file.return_value = {
                "dispute_id": str(ObjectId()),
                "status": "mediation",
                "created_at": datetime.now(timezone.utc)
            }
            
            response = client.post(
                "/api/v1/trust/disputes",
                json=payload,
                headers={"Authorization": f"Bearer {grihasta_token}"}
            )
        
        assert response.status_code == 201
        data = response.json()
        assert "dispute_id" in data
        assert data["status"] == "mediation"
        
    def test_file_dispute_missing_fields(self, client, grihasta_token):
        """Test 422 validation error for missing fields"""
        payload = {
            "booking_id": str(ObjectId()),
            # Missing category and description
        }
        
        response = client.post(
            "/api/v1/trust/disputes",
            json=payload,
            headers={"Authorization": f"Bearer {grihasta_token}"}
        )
        
        assert response.status_code == 422
        
    def test_get_dispute_details(self, client, grihasta_token):
        """Test GET /trust/disputes/{id}"""
        dispute_id = str(ObjectId())
        
        with patch("app.db.connection.get_database") as mock_db:
            mock_db.return_value.disputes.find_one = AsyncMock(return_value={
                "_id": ObjectId(dispute_id),
                "booking_id": ObjectId(),
                "status": "mediation",
                "created_at": datetime.now(timezone.utc)
            })
            
            response = client.get(
                f"/api/v1/trust/disputes/{dispute_id}",
                headers={"Authorization": f"Bearer {grihasta_token}"}
            )
        
        assert response.status_code == 200
        
    def test_resolve_dispute_admin_only(self, client, admin_token, grihasta_token):
        """Test POST /trust/admin/disputes/{id}/resolve (Admin only)"""
        dispute_id = str(ObjectId())
        
        payload = {
            "resolution": "arbitration_refund",
            "refund_percentage": 50,
            "admin_notes": "Partial refund approved"
        }
        
        # Test with admin token (should succeed)
        with patch("app.services.trust_service.TrustService.resolve_dispute") as mock_resolve:
            mock_resolve.return_value = {
                "dispute_id": dispute_id,
                "status": "resolved",
                "refund_amount": 5000
            }
            
            response_admin = client.post(
                f"/api/v1/trust/admin/disputes/{dispute_id}/resolve",
                json=payload,
                headers={"Authorization": f"Bearer {admin_token}"}
            )
        
        assert response_admin.status_code == 200
        
        # Test with grihasta token (should fail - 403)
        response_user = client.post(
            f"/api/v1/trust/admin/disputes/{dispute_id}/resolve",
            json=payload,
            headers={"Authorization": f"Bearer {grihasta_token}"}
        )
        
        assert response_user.status_code == 403


class TestGuaranteeAPI:
    """Test service guarantee endpoints"""
    
    def test_claim_guarantee_success(self, client, grihasta_token):
        """Test POST /trust/guarantees/claim"""
        payload = {
            "booking_id": str(ObjectId()),
            "guarantee_type": "quality_guarantee",
            "description": "Service was not satisfactory"
        }
        
        with patch("app.services.trust_service.TrustService.process_service_guarantee") as mock_claim:
            mock_claim.return_value = {
                "claim_id": str(ObjectId()),
                "eligible": True,
                "refund_percentage": 100,
                "status": "pending_approval"
            }
            
            response = client.post(
                "/api/v1/trust/guarantees/claim",
                json=payload,
                headers={"Authorization": f"Bearer {grihasta_token}"}
            )
        
        assert response.status_code == 201
        data = response.json()
        assert data["eligible"] is True
        assert data["refund_percentage"] == 100
        
    def test_claim_guarantee_ineligible(self, client, grihasta_token):
        """Test claiming guarantee when not eligible"""
        payload = {
            "booking_id": str(ObjectId()),
            "guarantee_type": "time_guarantee",
            "description": "Acharya was late"
        }
        
        with patch("app.services.trust_service.TrustService.process_service_guarantee") as mock_claim:
            mock_claim.return_value = {
                "eligible": False,
                "reason": "Claim period expired (24 hours)"
            }
            
            response = client.post(
                "/api/v1/trust/guarantees/claim",
                json=payload,
                headers={"Authorization": f"Bearer {grihasta_token}"}
            )
        
        assert response.status_code in [200, 400]
        data = response.json()
        assert data["eligible"] is False
        
    def test_approve_guarantee_admin_only(self, client, admin_token):
        """Test POST /trust/admin/guarantees/{id}/approve"""
        claim_id = str(ObjectId())
        
        payload = {
            "approved": True,
            "admin_notes": "Valid claim, full refund approved"
        }
        
        with patch("app.services.trust_service.TrustService.approve_guarantee_claim") as mock_approve:
            mock_approve.return_value = {
                "claim_id": claim_id,
                "status": "approved",
                "refund_initiated": True
            }
            
            response = client.post(
                f"/api/v1/trust/admin/guarantees/{claim_id}/approve",
                json=payload,
                headers={"Authorization": f"Bearer {admin_token}"}
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"


class TestAuthorizationRoles:
    """Test role-based access control"""
    
    def test_admin_endpoint_requires_admin_role(self, client, acharya_token):
        """Test that admin endpoints reject non-admin users"""
        dispute_id = str(ObjectId())
        
        payload = {
            "resolution": "mediation_closed",
            "refund_percentage": 0
        }
        
        response = client.post(
            f"/api/v1/trust/admin/disputes/{dispute_id}/resolve",
            json=payload,
            headers={"Authorization": f"Bearer {acharya_token}"}
        )
        
        assert response.status_code == 403
        
    def test_public_endpoints_accessible_without_auth(self, client):
        """Test that public trust score is accessible without auth"""
        acharya_id = str(ObjectId())
        
        with patch("app.services.trust_service.TrustService.calculate_acharya_trust_score") as mock_calc:
            mock_calc.return_value = {
                "trust_score": {"overall_score": 85},
                "verification_level": "savitara_verified"
            }
            
            response = client.get(f"/api/v1/trust/acharyas/{acharya_id}/trust-score")
        
        # Should work without Authorization header
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--cov=app.api.v1.trust"])
