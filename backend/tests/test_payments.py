"""
Payment Tests
"""
import pytest
from app.main import app

class TestPaymentInitiation:
    """Test payment initiation"""
    
    def test_initiate_payment_without_auth(self, client):
        """Test initiating payment without authentication"""
        response = client.post(
            "/api/v1/payments/initiate",
            json={"booking_id": "507f1f77bcf86cd799439011", "amount": 1000}
        )
        assert response.status_code == 401
    
    def test_initiate_payment_invalid_amount(self, client):
        """Test initiating payment with invalid amount"""
        response = client.post(
            "/api/v1/payments/initiate",
            json={"booking_id": "507f1f77bcf86cd799439011", "amount": -100}
        )
        assert response.status_code in [400, 401, 422]
    
    def test_initiate_payment_missing_booking_id(self, client):
        """Test initiating payment without booking ID"""
        response = client.post(
            "/api/v1/payments/initiate",
            json={"amount": 1000}
        )
        assert response.status_code in [401, 422]


class TestPaymentVerification:
    """Test payment verification"""
    
    def test_verify_payment_without_signature(self, client):
        """Test verifying payment without signature"""
        response = client.post(
            "/api/v1/payments/verify",
            json={
                "razorpay_order_id": "order_123",
                "razorpay_payment_id": "pay_123"
            }
        )
        assert response.status_code in [400, 401, 422]
    
    def test_verify_payment_invalid_signature(self, client):
        """Test verifying payment with invalid signature"""
        response = client.post(
            "/api/v1/payments/verify",
            json={
                "razorpay_order_id": "order_123",
                "razorpay_payment_id": "pay_123",
                "razorpay_signature": "invalid_signature"
            }
        )
        assert response.status_code in [400, 401, 422]


class TestRefunds:
    """Test refund functionality"""
    
    def test_initiate_refund_without_auth(self, client):
        """Test initiating refund without authentication"""
        response = client.post(
            "/api/v1/payments/507f1f77bcf86cd799439011/refund"
        )
        assert response.status_code == 401
    
    def test_get_refund_status_without_auth(self, client):
        """Test getting refund status without auth"""
        response = client.get("/api/v1/payments/refunds/rfnd_123")
        assert response.status_code == 401


class TestPaymentHistory:
    """Test payment history"""
    
    def test_get_payment_history_without_auth(self, client):
        """Test getting payment history without auth"""
        response = client.get("/api/v1/payments/history")
        assert response.status_code == 401
    
    def test_get_payment_by_id_without_auth(self, client):
        """Test getting payment details without auth"""
        response = client.get("/api/v1/payments/507f1f77bcf86cd799439011")
        assert response.status_code == 401
