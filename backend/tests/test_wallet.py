"""Wallet API Tests"""
import pytest


class TestWalletEndpoints:
    """Test wallet-related endpoints"""

    @pytest.mark.asyncio
    async def test_get_wallet_balance_without_auth(self, client):
        """Test getting wallet balance without authentication"""
        response = await client.get("/api/v1/wallet/balance")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_add_money_without_auth(self, client):
        """Test adding money to wallet without authentication"""
        response = await client.post(
            "/api/v1/wallet/add",
            json={"amount": 500},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_add_money_invalid_amount(self, client):
        """Test adding negative/zero amount — should fail validation"""
        response = await client.post(
            "/api/v1/wallet/add",
            json={"amount": -100},
        )
        assert response.status_code in [401, 422]

    @pytest.mark.asyncio
    async def test_get_wallet_transactions_without_auth(self, client):
        """Test getting wallet transactions without auth"""
        response = await client.get("/api/v1/wallet/transactions")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_wallet_payment_verify_without_auth(self, client):
        """Test verifying wallet payment without authentication"""
        response = await client.post(
            "/api/v1/wallet/verify-payment",
            json={
                "razorpay_order_id": "order_test",
                "razorpay_payment_id": "pay_test",
                "razorpay_signature": "sig_test",
            },
        )
        assert response.status_code == 401
