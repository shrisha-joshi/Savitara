"""
Razorpay Payment Service
Handles payment order creation, signature verification, and webhooks
SonarQube: S4502 - Proper webhook signature verification
"""
import razorpay  # type: ignore
import hmac
import hashlib
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from app.core.config import get_settings
from app.core.exceptions import PaymentFailedError
from app.core.interfaces import IPaymentService

logger = logging.getLogger(__name__)
settings = get_settings()


class RazorpayService(IPaymentService):
    """Razorpay payment integration service"""

    def __init__(self):
        """Initialize Razorpay client"""
        # SonarQube: S6437 - Credentials from environment
        self.client = razorpay.Client(
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
        )
        self.client.set_app_details(
            {"title": "Savitara", "version": settings.API_VERSION}
        )

    def create_order(
        self,
        amount: float,
        currency: str = "INR",
        receipt: Optional[str] = None,
        notes: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Create Razorpay payment order

        Args:
            amount: Amount in rupees (will be converted to paise)
            currency: Currency code (default: INR)
            receipt: Receipt ID/booking ID
            notes: Additional metadata

        Returns:
            Order details with order_id

        Raises:
            PaymentFailedError: If order creation fails
        """
        try:
            # Convert to paise (smallest currency unit)
            amount_paise = int(amount * 100)

            order_data = {
                "amount": amount_paise,
                "currency": currency,
                "payment_capture": 1,  # Auto-capture payment
            }

            if receipt:
                order_data["receipt"] = receipt

            if notes:
                order_data["notes"] = notes

            # Create order
            order = self.client.order.create(data=order_data)

            logger.info(f"Razorpay order created: {order['id']}")

            return {
                "order_id": order["id"],
                "amount": amount,
                "amount_paise": amount_paise,
                "currency": currency,
                "status": order["status"],
                "created_at": datetime.fromtimestamp(
                    order["created_at"], tz=timezone.utc
                ),
            }

        except razorpay.errors.BadRequestError as e:
            logger.error(f"Razorpay bad request: {e}")
            raise PaymentFailedError(
                order_id="", details={"error": str(e), "type": "bad_request"}
            )
        except Exception as e:
            logger.error(f"Razorpay order creation failed: {e}", exc_info=True)
            raise PaymentFailedError(order_id="", details={"error": str(e)})

    def verify_payment_signature(
        self, razorpay_order_id: str, razorpay_payment_id: str, razorpay_signature: str
    ) -> bool:
        """
        Verify Razorpay payment signature

        SonarQube: S4502 - Proper cryptographic signature verification

        Args:
            razorpay_order_id: Order ID from Razorpay
            razorpay_payment_id: Payment ID from Razorpay
            razorpay_signature: Signature from Razorpay

        Returns:
            True if signature is valid, False otherwise
        """
        try:
            # Generate expected signature
            message = f"{razorpay_order_id}|{razorpay_payment_id}"

            # SonarQube: Using HMAC-SHA256 for secure signature verification
            expected_signature = hmac.new(
                settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
                message.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()

            # Constant-time comparison to prevent timing attacks
            is_valid = hmac.compare_digest(expected_signature, razorpay_signature)

            if is_valid:
                logger.info(f"Payment signature verified: {razorpay_payment_id}")
            else:
                logger.warning(f"Invalid payment signature: {razorpay_payment_id}")

            return is_valid

        except Exception as e:
            logger.error(f"Signature verification error: {e}", exc_info=True)
            return False

    def verify_webhook_signature(
        self, webhook_body: str, webhook_signature: str
    ) -> bool:
        """
        Verify Razorpay webhook signature

        SonarQube: S4502 - Webhook signature verification prevents tampering

        Args:
            webhook_body: Raw webhook request body
            webhook_signature: X-Razorpay-Signature header

        Returns:
            True if webhook is authentic, False otherwise
        """
        try:
            # Generate expected signature
            expected_signature = hmac.new(
                settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
                webhook_body.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()

            # Constant-time comparison
            is_valid = hmac.compare_digest(expected_signature, webhook_signature)

            if not is_valid:
                logger.warning("Invalid webhook signature detected")

            return is_valid

        except Exception as e:
            logger.error(f"Webhook signature verification error: {e}", exc_info=True)
            return False

    def fetch_payment(self, payment_id: str) -> Dict[str, Any]:
        """
        Fetch payment details

        Args:
            payment_id: Razorpay payment ID

        Returns:
            Payment details
        """
        try:
            payment = self.client.payment.fetch(payment_id)

            return {
                "id": payment["id"],
                "order_id": payment.get("order_id"),
                "amount": payment["amount"] / 100,  # Convert from paise
                "currency": payment["currency"],
                "status": payment["status"],
                "method": payment.get("method"),
                "email": payment.get("email"),
                "contact": payment.get("contact"),
                "created_at": datetime.fromtimestamp(
                    payment["created_at"], tz=timezone.utc
                ),
                "captured": payment.get("captured", False),
            }

        except Exception as e:
            logger.error(f"Fetch payment error: {e}", exc_info=True)
            raise PaymentFailedError(order_id=payment_id, details={"error": str(e)})

    def fetch_order(self, order_id: str) -> Dict[str, Any]:
        """
        Fetch order details

        Args:
            order_id: Razorpay order ID

        Returns:
            Order details
        """
        try:
            order = self.client.order.fetch(order_id)

            return {
                "id": order["id"],
                "amount": order["amount"] / 100,  # Convert from paise
                "currency": order["currency"],
                "status": order["status"],
                "receipt": order.get("receipt"),
                "notes": order.get("notes", {}),
                "created_at": datetime.fromtimestamp(
                    order["created_at"], tz=timezone.utc
                ),
                "amount_paid": order.get("amount_paid", 0) / 100,
                "amount_due": order.get("amount_due", 0) / 100,
            }

        except Exception as e:
            logger.error(f"Fetch order error: {e}", exc_info=True)
            raise PaymentFailedError(order_id=order_id, details={"error": str(e)})

    def initiate_refund(
        self,
        payment_id: str,
        amount: Optional[float] = None,
        notes: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Initiate refund for a payment

        Args:
            payment_id: Razorpay payment ID
            amount: Refund amount (None for full refund)
            notes: Additional metadata

        Returns:
            Refund details
        """
        try:
            refund_data = {}

            if amount is not None:
                refund_data["amount"] = int(amount * 100)  # Convert to paise

            if notes:
                refund_data["notes"] = notes

            # Create refund
            refund = self.client.payment.refund(payment_id, refund_data)

            logger.info(f"Refund initiated: {refund['id']} for payment {payment_id}")

            return {
                "refund_id": refund["id"],
                "payment_id": refund["payment_id"],
                "amount": refund["amount"] / 100,
                "currency": refund["currency"],
                "status": refund["status"],
                "created_at": datetime.fromtimestamp(
                    refund["created_at"], tz=timezone.utc
                ),
            }

        except Exception as e:
            logger.error(f"Refund initiation failed: {e}", exc_info=True)
            raise PaymentFailedError(
                order_id=payment_id, details={"error": str(e), "type": "refund_failed"}
            )

    def fetch_refund(self, payment_id: str, refund_id: str) -> Dict[str, Any]:
        """
        Fetch refund details

        Args:
            payment_id: Razorpay payment ID
            refund_id: Razorpay refund ID

        Returns:
            Refund details
        """
        try:
            refund = self.client.payment.fetch_refund(payment_id, refund_id)

            return {
                "refund_id": refund["id"],
                "payment_id": refund["payment_id"],
                "amount": refund["amount"] / 100,
                "currency": refund["currency"],
                "status": refund["status"],
                "created_at": datetime.fromtimestamp(
                    refund["created_at"], tz=timezone.utc
                ),
                "speed_requested": refund.get("speed_requested", "normal"),
            }

        except Exception as e:
            logger.error(f"Fetch refund error: {e}", exc_info=True)
            raise PaymentFailedError(order_id=refund_id, details={"error": str(e)})


# Singleton instance
_razorpay_service: Optional[RazorpayService] = None


def get_razorpay_service() -> RazorpayService:
    """Get Razorpay service singleton instance"""
    global _razorpay_service
    if _razorpay_service is None:
        _razorpay_service = RazorpayService()
    return _razorpay_service
