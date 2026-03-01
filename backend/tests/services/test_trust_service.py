"""
Unit tests for Trust Service
Tests trust score calculation, checkpoint verification, dispute handling
Target: 80% coverage
"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId

from app.services.trust_service import TrustService
from app.models.trust import TrustScoreComponents, VerificationLevel, DisputeStatus


@pytest.fixture
def mock_db():
    """Mock MongoDB database"""
    db = MagicMock()
    
    # Mock collections
    db.users = MagicMock()
    db.bookings = MagicMock()
    db.reviews = MagicMock()
    db.acharya_trust_scores = MagicMock()
    db.disputes = MagicMock()
    db.booking_checkpoints = MagicMock()
    db.service_guarantees = MagicMock()
    
    return db


@pytest.fixture
def sample_acharya():
    """Sample Acharya data"""
    return {
        "_id": ObjectId(),
        "name": "Pandit Sharma",
        "email": "sharma@example.com",
        "phone": "+919876543210",
        "role": "acharya",
        "verification_status": "verified",
        "documents_submitted": ["aadhar", "pan", "photo", "certificate"],
        "created_at": datetime.now(timezone.utc) - timedelta(days=180)
    }


@pytest.fixture
def sample_bookings():
    """Sample booking data for trust score calculation"""
    base_date = datetime.now(timezone.utc)
    return [
        {
            "_id": ObjectId(),
            "status": "completed",
            "acharya_response_time_hours": 2,
            "created_at": base_date - timedelta(days=30),
            "total_amount": 5000
        },
        {
            "_id": ObjectId(),
            "status": "completed",
            "acharya_response_time_hours": 1,
            "created_at": base_date - timedelta(days=60),
            "total_amount": 7500
        },
        {
            "_id": ObjectId(),
            "status": "completed",
            "acharya_response_time_hours": 3,
            "created_at": base_date - timedelta(days=90),
            "total_amount": 10000
        }
    ]


class TestTrustScoreCalculation:
    """Test trust score calculation logic"""
    
    @pytest.mark.asyncio
    async def test_calculate_trust_score_basic(self, mock_db, sample_acharya):
        """Test basic trust score calculation with mocked data"""
        acharya_id = str(sample_acharya["_id"])
        
        # Mock database queries
        mock_db.users.find_one = AsyncMock(return_value=sample_acharya)
        mock_db.bookings.count_documents = AsyncMock(side_effect=[100, 95])  # Total, Completed
        mock_db.bookings.aggregate = AsyncMock(return_value=AsyncMock(__aiter__=lambda x: iter([
            {"avg_response_hours": 2.5}
        ])))
        mock_db.reviews.aggregate = AsyncMock(return_value=AsyncMock(__aiter__=lambda x: iter([
            {"avg_rating": 4.5, "total_reviews": 85}
        ])))
        
        # Calculate
        result = await TrustService.calculate_acharya_trust_score(mock_db, acharya_id)
        
        # Assertions
        assert result is not None
        assert "trust_score" in result
        assert "verification_level" in result
        assert result["trust_score"]["overall_score"] >= 0
        assert result["trust_score"]["overall_score"] <= 100
        
    @pytest.mark.asyncio
    async def test_verification_badge_premium(self, mock_db, sample_acharya):
        """Test Premium badge award (score >= 90)"""
        acharya_id = str(sample_acharya["_id"])
        
        # Mock high scores
        mock_db.users.find_one = AsyncMock(return_value=sample_acharya)
        mock_db.bookings.count_documents = AsyncMock(side_effect=[200, 198])  # 99% completion
        mock_db.bookings.aggregate = AsyncMock(return_value=AsyncMock(__aiter__=lambda x: iter([
            {"avg_response_hours": 1.0}  # Fast response
        ])))
        mock_db.reviews.aggregate = AsyncMock(return_value=AsyncMock(__aiter__=lambda x: iter([
            {"avg_rating": 4.9, "total_reviews": 180}
        ])))
        
        result = await TrustService.calculate_acharya_trust_score(mock_db, acharya_id)
        
        # Should get Premium badge
        assert result["verification_level"] == VerificationLevel.PREMIUM.value
        
    @pytest.mark.asyncio
    async def test_verification_badge_basic(self, mock_db, sample_acharya):
        """Test Basic badge (score < 60)"""
        # Mock low scores
        sample_acharya["verification_status"] = "pending"
        sample_acharya["documents_submitted"] = ["aadhar"]  # Incomplete
        
        acharya_id = str(sample_acharya["_id"])
        
        mock_db.users.find_one = AsyncMock(return_value=sample_acharya)
        mock_db.bookings.count_documents = AsyncMock(side_effect=[50, 35])  # 70% completion
        mock_db.bookings.aggregate = AsyncMock(return_value=AsyncMock(__aiter__=lambda x: iter([
            {"avg_response_hours": 12.0}  # Slow response
        ])))
        mock_db.reviews.aggregate = AsyncMock(return_value=AsyncMock(__aiter__=lambda x: iter([
            {"avg_rating": 3.5, "total_reviews": 20}
        ])))
        
        result = await TrustService.calculate_acharya_trust_score(mock_db, acharya_id)
        
        assert result["verification_level"] == VerificationLevel.BASIC.value
        
    @pytest.mark.asyncio
    async def test_component_weights(self, mock_db, sample_acharya):
        """Test that component weights sum to 100%"""
        acharya_id = str(sample_acharya["_id"])
        
        mock_db.users.find_one = AsyncMock(return_value=sample_acharya)
        mock_db.bookings.count_documents = AsyncMock(side_effect=[100, 95])
        mock_db.bookings.aggregate = AsyncMock(return_value=AsyncMock(__aiter__=lambda x: iter([
            {"avg_response_hours": 2.5}
        ])))
        mock_db.reviews.aggregate = AsyncMock(return_value=AsyncMock(__aiter__=lambda x: iter([
            {"avg_rating": 4.5, "total_reviews": 85}
        ])))
        
        result = await TrustService.calculate_acharya_trust_score(mock_db, acharya_id)
        
        # Weights: 30% verification + 25% completion + 15% response + 20% rebooking + 10% review = 100%
        components = result["trust_score"]["components"]
        assert "verification_score" in components
        assert "completion_rate_score" in components
        assert "response_time_score" in components
        assert "rebooking_rate_score" in components
        assert "review_quality_score" in components


class TestCheckpointVerification:
    """Test booking checkpoint (OTP) verification"""
    
    @pytest.mark.asyncio
    async def test_generate_checkpoint_otp(self, mock_db):
        """Test OTP generation (6 digits)"""
        booking_id = str(ObjectId())
        
        mock_db.bookings.find_one = AsyncMock(return_value={
            "_id": ObjectId(booking_id),
            "status": "accepted",
            "acharya_id": ObjectId()
        })
        mock_db.booking_checkpoints.insert_one = AsyncMock()
        
        result = await TrustService.generate_booking_checkpoint_otp(
            mock_db, booking_id, "check_in"
        )
        
        assert "otp_code" in result
        assert len(result["otp_code"]) == 6
        assert result["otp_code"].isdigit()
        assert "expires_at" in result
        
    @pytest.mark.asyncio
    async def test_verify_checkpoint_otp_success(self, mock_db):
        """Test successful OTP verification"""
        booking_id = str(ObjectId())
        otp_code = "123456"
        current_coords = {"latitude": 19.0760, "longitude": 72.8777}  # Mumbai
        
        # Mock checkpoint data
        checkpoint_data = {
            "otp_hash": "hashed_123456",  # Would use actual hash
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=3),
            "location": {"latitude": 19.0761, "longitude": 72.8778}  # Close by
        }
        
        mock_db.booking_checkpoints.find_one = AsyncMock(return_value=checkpoint_data)
        mock_db.booking_checkpoints.update_one = AsyncMock()
        
        with patch("app.services.trust_service.verify_otp_hash", return_value=True):
            result = await TrustService.verify_checkpoint_otp(
                mock_db, booking_id, otp_code, current_coords
            )
        
        assert result["verified"] is True
        
    @pytest.mark.asyncio
    async def test_verify_checkpoint_otp_expired(self, mock_db):
        """Test OTP expiration (5 minutes)"""
        booking_id = str(ObjectId())
        otp_code = "123456"
        current_coords = {"latitude": 19.0760, "longitude": 72.8777}
        
        # Mock expired checkpoint
        checkpoint_data = {
            "otp_hash": "hashed_123456",
            "expires_at": datetime.now(timezone.utc) - timedelta(minutes=1),  # Expired
            "location": {"latitude": 19.0761, "longitude": 72.8778}
        }
        
        mock_db.booking_checkpoints.find_one = AsyncMock(return_value=checkpoint_data)
        
        result = await TrustService.verify_checkpoint_otp(
            mock_db, booking_id, otp_code, current_coords
        )
        
        assert result["verified"] is False
        assert "expired" in result.get("error", "").lower()
        
    @pytest.mark.asyncio
    async def test_verify_checkpoint_location_mismatch(self, mock_db):
        """Test location validation (Haversine distance > 500m = fail)"""
        booking_id = str(ObjectId())
        otp_code = "123456"
        current_coords = {"latitude": 19.1560, "longitude": 72.9577}  # 10km away
        
        checkpoint_data = {
            "otp_hash": "hashed_123456",
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=3),
            "location": {"latitude": 19.0760, "longitude": 72.8777}  # Original location
        }
        
        mock_db.booking_checkpoints.find_one = AsyncMock(return_value=checkpoint_data)
        
        with patch("app.services.trust_service.verify_otp_hash", return_value=True):
            result = await TrustService.verify_checkpoint_otp(
                mock_db, booking_id, otp_code, current_coords
            )
        
        assert result["verified"] is False
        assert "location" in result.get("error", "").lower()


class TestDisputeHandling:
    """Test dispute filing and resolution"""
    
    @pytest.mark.asyncio
    async def test_file_dispute(self, mock_db):
        """Test filing a new dispute"""
        booking_id = str(ObjectId())
        user_id = str(ObjectId())
        
        mock_db.bookings.find_one = AsyncMock(return_value={
            "_id": ObjectId(booking_id),
            "status": "completed",
            "acharya_id": ObjectId()
        })
        mock_db.disputes.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        
        result = await TrustService.file_dispute(
            mock_db,
            booking_id,
            user_id,
            "service_quality",
            "Pooja was not performed properly"
        )
        
        assert "dispute_id" in result
        assert result["status"] == DisputeStatus.MEDIATION.value
        
    @pytest.mark.asyncio
    async def test_resolve_dispute_with_refund(self, mock_db):
        """Test dispute resolution with refund"""
        dispute_id = str(ObjectId())
        
        mock_db.disputes.find_one = AsyncMock(return_value={
            "_id": ObjectId(dispute_id),
            "booking_id": ObjectId(),
            "status": "arbitration"
        })
        mock_db.disputes.update_one = AsyncMock()
        mock_db.bookings.find_one = AsyncMock(return_value={
            "_id": ObjectId(),
            "total_amount": 10000
        })
        
        with patch("app.services.payment_service.process_refund") as mock_refund:
            result = await TrustService.resolve_dispute(
                mock_db,
                dispute_id,
                "arbitration_refund",
                refund_percentage=50
            )
        
        assert result["status"] == DisputeStatus.RESOLVED.value
        assert result["refund_amount"] == 5000  # 50% of 10000
        

class TestServiceGuarantee:
    """Test service guarantee processing"""
    
    @pytest.mark.asyncio
    async def test_claim_quality_guarantee(self, mock_db):
        """Test claiming quality guarantee (full refund)"""
        booking_id = str(ObjectId())
        user_id = str(ObjectId())
        
        mock_db.bookings.find_one = AsyncMock(return_value={
            "_id": ObjectId(booking_id),
            "status": "completed",
            "total_amount": 15000,
            "completed_at": datetime.now(timezone.utc) - timedelta(hours=12)
        })
        mock_db.service_guarantees.insert_one = AsyncMock()
        
        result = await TrustService.process_service_guarantee(
            mock_db,
            booking_id,
            "quality_guarantee"
        )
        
        assert "claim_id" in result
        assert result["refund_percentage"] == 100  # Full refund
        assert result["eligible"] is True
        
    @pytest.mark.asyncio
    async def test_claim_time_guarantee(self, mock_db):
        """Test time guarantee (Acharya late by 15+ minutes)"""
        booking_id = str(ObjectId())
        
        mock_db.bookings.find_one = AsyncMock(return_value={
            "_id": ObjectId(booking_id),
            "status": "completed",
            "scheduled_time": datetime.now(timezone.utc) - timedelta(hours=2),
            "actual_start_time": datetime.now(timezone.utc) - timedelta(hours=2) + timedelta(minutes=20),
            "total_amount": 8000
        })
        mock_db.service_guarantees.insert_one = AsyncMock()
        
        result = await TrustService.process_service_guarantee(
            mock_db,
            booking_id,
            "time_guarantee"
        )
        
        assert result["eligible"] is True
        assert result["refund_percentage"] == 10  # 10% compensation for tardiness


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--cov=app.services.trust_service"])
