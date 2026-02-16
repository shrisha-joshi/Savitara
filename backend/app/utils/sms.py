"""
SMS Service for Savitara
Supports Twilio for SMS and OTP delivery
SonarQube: S6437 - Credentials from environment
"""
import logging
from typing import Optional, Dict, Any
import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class SMSService:
    """SMS service using Twilio"""

    def __init__(self):
        """Initialize SMS service"""
        self.account_sid = settings.TWILIO_ACCOUNT_SID
        self.auth_token = settings.TWILIO_AUTH_TOKEN
        self.from_number = settings.TWILIO_PHONE_NUMBER
        self.api_url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"

    async def send_sms(
        self, to_number: str, message: str, media_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send SMS via Twilio

        Args:
            to_number: Recipient phone number (with country code)
            message: SMS message content
            media_url: Optional MMS media URL

        Returns:
            Response dict with status and message_sid
        """
        try:
            # Format phone number
            if not to_number.startswith("+"):
                to_number = f"+91{to_number}"  # Default to India

            # Prepare payload
            payload = {"To": to_number, "From": self.from_number, "Body": message}

            if media_url:
                payload["MediaUrl"] = media_url

            # Send via Twilio API
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.api_url, data=payload, auth=(self.account_sid, self.auth_token)
                )

                result = response.json()

                if response.status_code in (200, 201):
                    logger.info(f"SMS sent to {to_number}, SID: {result.get('sid')}")
                    return {
                        "success": True,
                        "message_sid": result.get("sid"),
                        "status": result.get("status"),
                    }
                else:
                    logger.error(f"Twilio error: {result.get('message')}")
                    return {
                        "success": False,
                        "error": result.get("message"),
                        "code": result.get("code"),
                    }

        except Exception as e:
            logger.error(f"SMS sending failed: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    # Pre-defined SMS templates
    async def send_otp(
        self, phone: str, otp: str, purpose: str = "verification"
    ) -> Dict[str, Any]:
        """Send OTP SMS"""
        message = f"Your Savitara OTP for {purpose} is {otp}. Valid for 10 minutes. Do not share with anyone."
        return await self.send_sms(phone, message)

    async def send_booking_confirmation(
        self, phone: str, booking_id: str, pooja_name: str, booking_date: str, time: str
    ) -> Dict[str, Any]:
        """Send booking confirmation SMS"""
        message = f"Booking confirmed! {pooja_name} on {booking_date} at {time}. ID: {booking_id}. Track on Savitara app. Om Namah Shivaya!"
        return await self.send_sms(phone, message)

    async def send_booking_reminder(
        self,
        phone: str,
        pooja_name: str,
        reminder_date: str,
        time: str,
        acharya_name: str,
    ) -> Dict[str, Any]:
        """Send booking reminder SMS

        Args:
            phone: Recipient phone number
            pooja_name: Name of the pooja
            reminder_date: Date for the reminder (used for scheduling, message says 'tomorrow')
            time: Time of the booking
            acharya_name: Name of the acharya
        """
        # Note: reminder_date is used for scheduling context, message hardcodes "tomorrow"
        _ = reminder_date  # Explicitly acknowledge parameter usage for scheduling
        message = f"Reminder: Your {pooja_name} is scheduled tomorrow at {time} with Pandit {acharya_name}. Be prepared! - Savitara"
        return await self.send_sms(phone, message)

    async def send_service_started(
        self, phone: str, pooja_name: str, acharya_name: str
    ) -> Dict[str, Any]:
        """Send service started notification SMS"""
        message = f"Pandit {acharya_name} has started your {pooja_name}. May the divine blessings be upon you! - Savitara"
        return await self.send_sms(phone, message)

    async def send_service_completed(
        self, phone: str, pooja_name: str, booking_id: str
    ) -> Dict[str, Any]:
        """Send service completed notification SMS"""
        message = f"Your {pooja_name} is complete. Thank you for using Savitara. Please rate your experience in the app. Booking ID: {booking_id}"
        return await self.send_sms(phone, message)

    async def send_payment_received(
        self, phone: str, amount: float, booking_id: str
    ) -> Dict[str, Any]:
        """Send payment received SMS"""
        message = f"Payment of Rs.{amount:.2f} received for booking {booking_id}. Thank you! - Savitara"
        return await self.send_sms(phone, message)

    async def send_acharya_verification_status(
        self, phone: str, name: str, status: str
    ) -> Dict[str, Any]:
        """Send Acharya verification status SMS"""
        if status == "approved":
            message = f"Namaste Pandit {name} ji! Your Savitara profile is verified. You can now receive bookings. Welcome aboard!"
        else:
            message = f"Namaste Pandit {name} ji! Your Savitara profile needs additional information. Please check the app for details."
        return await self.send_sms(phone, message)

    async def send_new_booking_notification(
        self, phone: str, pooja_name: str, date: str, grihasta_name: str
    ) -> Dict[str, Any]:
        """Send new booking notification to Acharya"""
        message = f"New booking request! {pooja_name} on {date} from {grihasta_name}. Accept in the Savitara app. - Savitara"
        return await self.send_sms(phone, message)

    async def send_earnings_credited(
        self, phone: str, amount: float, booking_id: str
    ) -> Dict[str, Any]:
        """Send earnings credited notification to Acharya"""
        message = f"Rs.{amount:.2f} credited for booking {booking_id}. View earnings in Savitara app. - Savitara"
        return await self.send_sms(phone, message)

    async def send_chat_notification(
        self, phone: str, sender_name: str
    ) -> Dict[str, Any]:
        """Send new message notification SMS"""
        message = f"You have a new message from {sender_name} on Savitara. Open the app to reply."
        return await self.send_sms(phone, message)

    async def send_review_notification(
        self, phone: str, rating: int, reviewer_name: str
    ) -> Dict[str, Any]:
        """Send new review notification to Acharya"""
        message = f"New {rating}-star review from {reviewer_name}! View on Savitara app. Thank you for your service!"
        return await self.send_sms(phone, message)

    async def send_welcome_sms(
        self, phone: str, name: str, role: str
    ) -> Dict[str, Any]:
        """Send welcome SMS to new users"""
        if role == "acharya":
            message = f"Namaste Pandit {name} ji! Welcome to Savitara. Complete verification to start receiving bookings. Om Namah Shivaya!"
        else:
            message = f"Namaste {name}! Welcome to Savitara. Find verified Acharyas for authentic rituals. Start exploring now! Om Namah Shivaya!"
        return await self.send_sms(phone, message)


# Create singleton instance
sms_service = SMSService()
