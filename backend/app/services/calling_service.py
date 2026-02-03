"""
Masked Calling Service using Twilio
This ensures users NEVER see each other's real phone numbers
"""
from twilio.rest import Client
from app.core.config import settings
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

class CallingService:
    def __init__(self):
        # Initialize only if credentials exist to avoid crashes in non-configured envs
        if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
            self.client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            self.proxy_number = settings.TWILIO_PROXY_NUMBER  # Your Twilio number
            self.enabled = True
        else:
            logger.warning("Twilio credentials missing. Calling service disabled.")
            self.enabled = False
    
    async def initiate_masked_call(
        self,
        caller_user_id: str,
        callee_user_id: str,
        booking_id: str,
        db
    ) -> dict:
        """
        Initiates a call where both parties see only the platform number
        
        Flow:
        1. Platform calls the Caller (Grihasta)
        2. When answered, platform calls the Callee (Acharya)
        3. Both calls are bridged together
        4. Neither party sees the other's real number
        """
        if not self.enabled:
            raise Exception("Calling service is not configured")

        # Get phone numbers from profiles (stored securely, never exposed)
        # Assuming caller is Grihasta and callee is Acharya for this example
        # But logic should be generic
        
        caller_profile = await db.grihasta_profiles.find_one({"user_id": caller_user_id})
        if not caller_profile:
             caller_profile = await db.acharya_profiles.find_one({"user_id": caller_user_id})
        
        callee_profile = await db.acharya_profiles.find_one({"user_id": callee_user_id})
        if not callee_profile:
             callee_profile = await db.grihasta_profiles.find_one({"user_id": callee_user_id})
             
        if not caller_profile or not callee_profile:
            raise ValueError("User profiles not found for call")

        # In production, use real numbers. For dev, ensure they are whitelisted if trial account
        to_number = caller_profile.get("phone")
        
        # Create call to the initiator first. 
        # When they answer, Twilio fetches TwiML from the url to know what to do next (call the other person)
        call = self.client.calls.create(
            to=to_number,
            from_=self.proxy_number,
            url=f"{settings.API_BASE_URL}/webhooks/twilio/connect/{booking_id}/{callee_user_id}",
            status_callback=f"{settings.API_BASE_URL}/webhooks/twilio/status/{booking_id}"
        )
        
        # Log call initiation
        await db.call_logs.insert_one({
            "booking_id": booking_id,
            "caller_id": caller_user_id,
            "callee_id": callee_user_id,
            "call_sid": call.sid,
            "status": "initiated",
            "started_at": datetime.now(timezone.utc)
        })
        
        return {"call_id": call.sid, "status": "connecting"}

calling_service = CallingService()
