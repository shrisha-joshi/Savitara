"""
Unit tests for Disintermediation Service
Tests NLP content analysis, ML fraud detection, phone masking
Target: 80% coverage
"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId

from app.services.disintermediation_service import DisintermediationService


@pytest.fixture
def mock_db():
    """Mock MongoDB database"""
    db = MagicMock()
    db.messages = MagicMock()
    db.bookings = MagicMock()
    db.users = MagicMock()
    db.message_content_analysis = MagicMock()
    db.offline_transaction_alerts = MagicMock()
    db.masked_phone_relays = MagicMock()
    return db


class TestContentAnalysis:
    """Test NLP-based message content filtering"""
    
    @pytest.mark.asyncio
    async def test_detect_phone_number(self, mock_db):
        """Test phone number detection in messages"""
        message_text = "Call me at 9876543210"
        
        result = await DisintermediationService.analyze_message_content(message_text)
        
        assert result["contains_phone_number"] is True
        assert result["risk_score"] >= 70
        assert "phone" in result["flagged_patterns"]
        
    @pytest.mark.asyncio
    async def test_detect_email(self, mock_db):
        """Test email detection"""
        message_text = "Email me at pandit.sharma@gmail.com for details"
        
        result = await DisintermediationService.analyze_message_content(message_text)
        
        assert result["contains_email"] is True
        assert result["risk_score"] >= 60
        
    @pytest.mark.asyncio
    async def test_detect_whatsapp(self, mock_db):
        """Test WhatsApp/social media detection"""
        message_text = "Message me on WhatsApp for faster response"
        
        result = await DisintermediationService.analyze_message_content(message_text)
        
        assert result["contains_social_media"] is True
        assert "whatsapp" in result["flagged_patterns"]
        
    @pytest.mark.asyncio
    async def test_detect_payment_request(self, mock_db):
        """Test payment request detection"""
        message_text = "Pay directly via UPI to save platform fees"
        
        result = await DisintermediationService.analyze_message_content(message_text)
        
        assert result["contains_payment_request"] is True
        assert result["risk_score"] >= 80
        
    @pytest.mark.asyncio
    async def test_detect_external_links(self, mock_db):
        """Test external link detection"""
        message_text = "Check my website at www.panditservices.com"
        
        result = await DisintermediationService.analyze_message_content(message_text)
        
        assert result["contains_external_links"] is True
        
    @pytest.mark.asyncio
    async def test_clean_message(self, mock_db):
        """Test that clean messages pass with low risk score"""
        message_text = "Looking forward to performing the pooja. What time should I arrive?"
        
        result = await DisintermediationService.analyze_message_content(message_text)
        
        assert result["risk_score"] < 30
        assert result["contains_phone_number"] is False
        assert result["contains_email"] is False
        
    @pytest.mark.asyncio
    async def test_multilingual_detection(self, mock_db):
        """Test Hindi phone number detection"""
        message_text = "मुझे ९८७६५४३२१० पर कॉल करें"
        
        result = await DisintermediationService.analyze_message_content(message_text)
        
        # Should detect Hindi numerals as phone number
        assert result["risk_score"] > 50


class TestOfflineTransactionDetection:
    """Test ML-based fraud detection"""
    
    @pytest.mark.asyncio
    async def test_detect_fraud_all_signals(self, mock_db):
        """Test fraud detection with all 5 signals triggered"""
        user_id = str(ObjectId())
        booking_id = str(ObjectId())
        
        # Mock data: User had 1 booking, then stopped
        mock_db.bookings.count_documents = AsyncMock(side_effect=[
            1,  # Total bookings
            0,  # Repeat bookings
            1,  # User-initiated cancellations
        ])
        
        mock_db.messages.aggregate = AsyncMock(return_value=AsyncMock(__aiter__=lambda x: iter([
            {"total_messages": 50}  # High chat activity
        ])))
        
        mock_db.message_content_analysis.find_one = AsyncMock(return_value={
            "risk_score": 85,  # Contact sharing detected
            "contains_phone_number": True
        })
        
        result = await DisintermediationService.detect_offline_transaction(
            mock_db, user_id, booking_id
        )
        
        assert result["fraud_confidence"] >= 70
        assert result["investigation_recommended"] is True
        assert len(result["fraud_signals"]) == 5
        
    @pytest.mark.asyncio
    async def test_no_fraud_legitimate_user(self, mock_db):
        """Test legitimate user (repeat bookings, no red flags)"""
        user_id = str(ObjectId())
        booking_id = str(ObjectId())
        
        # Mock data: User has 10 bookings, 5 repeats
        mock_db.bookings.count_documents = AsyncMock(side_effect=[
            10,  # Total bookings
            5,   # Repeat bookings
            0,   # No cancellations
        ])
        
        mock_db.messages.aggregate = AsyncMock(return_value=AsyncMock(__aiter__=lambda x: iter([
            {"total_messages": 8}  # Normal chat activity
        ])))
        
        mock_db.message_content_analysis.find_one = AsyncMock(return_value={
            "risk_score": 10,  # Clean messages
            "contains_phone_number": False
        })
        
        result = await DisintermediationService.detect_offline_transaction(
            mock_db, user_id, booking_id
        )
        
        assert result["fraud_confidence"] < 30
        assert result["investigation_recommended"] is False
        
    @pytest.mark.asyncio
    async def test_fraud_confidence_calculation(self, mock_db):
        """Test fraud confidence scoring (20% per signal)"""
        user_id = str(ObjectId())
        booking_id = str(ObjectId())
        
        # 3 signals = 60% confidence
        mock_db.bookings.count_documents = AsyncMock(side_effect=[
            1,  # Total (signal 1)
            0,  # Repeat (signal 2)
            0,  # No cancellation
        ])
        
        mock_db.messages.aggregate = AsyncMock(return_value=AsyncMock(__aiter__=lambda x: iter([
            {"total_messages": 45}  # High chat (signal 3)
        ])))
        
        mock_db.message_content_analysis.find_one = AsyncMock(return_value={
            "risk_score": 30,  # Low risk messages
            "contains_phone_number": False
        })
        
        result = await DisintermediationService.detect_offline_transaction(
            mock_db, user_id, booking_id
        )
        
        # Expect 60% confidence (3 signals × 20%)
        assert 50 <= result["fraud_confidence"] <= 70


class TestPhoneMasking:
    """Test phone number masking/relay"""
    
    @pytest.mark.asyncio
    async def test_create_masked_phone_relay(self, mock_db):
        """Test creating masked phone relay"""
        booking_id = str(ObjectId())
        
        mock_db.bookings.find_one = AsyncMock(return_value={
            "_id": ObjectId(booking_id),
            "grihasta_id": ObjectId(),
            "acharya_id": ObjectId(),
            "scheduled_time": datetime.now(timezone.utc) + timedelta(hours=2)
        })
        
        mock_db.users.find_one = AsyncMock(side_effect=[
            {"phone": "+919876543210"},  # Grihasta
            {"phone": "+919123456789"}   # Acharya
        ])
        
        mock_db.masked_phone_relays.insert_one = AsyncMock()
        
        with patch("app.services.disintermediation_service.allocate_relay_number") as mock_allocate:
            mock_allocate.return_value = "+911234567890"  # Relay number
            
            result = await DisintermediationService.create_masked_phone_relay(
                mock_db, booking_id
            )
        
        assert "relay_number" in result
        assert result["relay_number"] != "+919876543210"  # Not real number
        assert result["expires_at"] is not None
        
    @pytest.mark.asyncio
    async def test_relay_expiration(self, mock_db):
        """Test relay expiration (24 hours after booking)"""
        booking_id = str(ObjectId())
        scheduled_time = datetime.now(timezone.utc) + timedelta(hours=2)
        
        mock_db.bookings.find_one = AsyncMock(return_value={
            "_id": ObjectId(booking_id),
            "grihasta_id": ObjectId(),
            "acharya_id": ObjectId(),
            "scheduled_time": scheduled_time
        })
        
        mock_db.users.find_one = AsyncMock(side_effect=[
            {"phone": "+919876543210"},
            {"phone": "+919123456789"}
        ])
        
        mock_db.masked_phone_relays.insert_one = AsyncMock()
        
        with patch("app.services.disintermediation_service.allocate_relay_number") as mock_allocate:
            mock_allocate.return_value = "+911234567890"
            
            result = await DisintermediationService.create_masked_phone_relay(
                mock_db, booking_id
            )
        
        # Relay should expire 24h after booking
        expected_expiry = scheduled_time + timedelta(hours=24)
        assert abs((result["expires_at"] - expected_expiry).total_seconds()) < 60


class TestRankingPenalty:
    """Test marketplace ranking penalties"""
    
    @pytest.mark.asyncio
    async def test_apply_ranking_penalty(self, mock_db):
        """Test applying ranking penalty for disintermediation"""
        acharya_id = str(ObjectId())
        
        mock_db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId(acharya_id),
            "marketplace_rank": 100
        })
        
        mock_db.users.update_one = AsyncMock()
        
        result = await DisintermediationService.apply_acharya_rank_penalty(
            mock_db,
            acharya_id,
            "contact_sharing",
            penalty_points=20
        )
        
        assert result["new_rank"] == 80  # 100 - 20
        assert result["reason"] == "contact_sharing"
        
    @pytest.mark.asyncio
    async def test_penalty_cap_at_zero(self, mock_db):
        """Test that rank doesn't go below 0"""
        acharya_id = str(ObjectId())
        
        mock_db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId(acharya_id),
            "marketplace_rank": 15
        })
        
        mock_db.users.update_one = AsyncMock()
        
        result = await DisintermediationService.apply_acharya_rank_penalty(
            mock_db,
            acharya_id,
            "fraud_confirmed",
            penalty_points=50
        )
        
        assert result["new_rank"] == 0  # Capped at 0, not -35


class TestContentModeration:
    """Test auto-moderation of messages"""
    
    @pytest.mark.asyncio
    async def test_auto_block_high_risk_message(self, mock_db):
        """Test auto-blocking of high-risk messages (score >= 80)"""
        message_text = "Skip the app, call me at 9876543210 and pay via UPI"
        
        result = await DisintermediationService.analyze_message_content(message_text)
        
        assert result["risk_score"] >= 80
        assert result["auto_block_recommended"] is True
        
    @pytest.mark.asyncio
    async def test_flag_for_review(self, mock_db):
        """Test flagging medium-risk messages (50-80 score)"""
        message_text = "You can call me if needed: 9876543210"
        
        result = await DisintermediationService.analyze_message_content(message_text)
        
        assert 50 <= result["risk_score"] < 80
        assert result["flag_for_review"] is True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--cov=app.services.disintermediation_service"])
