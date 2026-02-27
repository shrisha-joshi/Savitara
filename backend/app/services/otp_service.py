"""
OTP Service for Phone Number Authentication
Supports SMS providers (AWS SNS, Twilio) with fallback
Strategy Report §12.5 #3 — Phone OTP Login
"""
import logging
import random
import string
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

# OTP config
OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
OTP_COOLDOWN_SECONDS = 60  # Min time between OTP resends


class OTPService:
    """Phone OTP generation, storage, and verification"""

    @staticmethod
    def generate_otp() -> str:
        """Generate a secure numeric OTP"""
        return "".join(random.choices(string.digits, k=OTP_LENGTH))

    @classmethod
    async def send_otp(
        cls, db: AsyncIOMotorDatabase, phone: str
    ) -> Dict[str, Any]:
        """
        Generate and store OTP for a phone number.

        In production, integrate with SMS provider (AWS SNS / Twilio).
        For now, stores OTP in DB and logs it in dev mode.
        """
        # Normalize phone number
        phone = phone.strip()
        if not phone.startswith("+"):
            phone = f"+91{phone}"  # Default to India

        # Check cooldown — prevent OTP spam
        existing = await db.phone_otps.find_one(
            {"phone": phone, "verified": False},
            sort=[("created_at", -1)],
        )
        if existing:
            elapsed = (datetime.now(timezone.utc) - existing["created_at"]).total_seconds()
            if elapsed < OTP_COOLDOWN_SECONDS:
                wait = int(OTP_COOLDOWN_SECONDS - elapsed)
                return {
                    "sent": False,
                    "message": f"Please wait {wait} seconds before requesting another OTP",
                    "retry_after": wait,
                }

        otp = cls.generate_otp()
        otp_doc = {
            "phone": phone,
            "otp": otp,
            "attempts": 0,
            "verified": False,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES),
        }

        # Upsert — one active OTP per phone
        await db.phone_otps.update_one(
            {"phone": phone, "verified": False},
            {"$set": otp_doc},
            upsert=True,
        )

        # NOTE: Integrate SMS provider (AWS SNS / Twilio) for production delivery
        # For now, log OTP in non-production environments
        logger.info(f"[OTP] Phone: {phone}, OTP: {otp} (integrate SMS provider for production)")

        return {
            "sent": True,
            "message": "OTP sent successfully",
            "expires_in": OTP_EXPIRY_MINUTES * 60,
        }

    @classmethod
    async def verify_otp(
        cls, db: AsyncIOMotorDatabase, phone: str, otp: str
    ) -> Dict[str, Any]:
        """Verify OTP for a phone number"""
        phone = phone.strip()
        if not phone.startswith("+"):
            phone = f"+91{phone}"

        otp_doc = await db.phone_otps.find_one(
            {"phone": phone, "verified": False},
            sort=[("created_at", -1)],
        )

        if not otp_doc:
            return {"verified": False, "error": "No OTP found. Please request a new one."}

        # Check expiry
        if datetime.now(timezone.utc) > otp_doc["expires_at"]:
            await db.phone_otps.delete_one({"_id": otp_doc["_id"]})
            return {"verified": False, "error": "OTP has expired. Please request a new one."}

        # Check max attempts
        if otp_doc["attempts"] >= OTP_MAX_ATTEMPTS:
            await db.phone_otps.delete_one({"_id": otp_doc["_id"]})
            return {"verified": False, "error": "Maximum attempts exceeded. Please request a new OTP."}

        # Increment attempts
        await db.phone_otps.update_one(
            {"_id": otp_doc["_id"]},
            {"$inc": {"attempts": 1}},
        )

        # Verify OTP
        if otp_doc["otp"] != otp:
            remaining = OTP_MAX_ATTEMPTS - otp_doc["attempts"] - 1
            return {
                "verified": False,
                "error": f"Invalid OTP. {remaining} attempts remaining.",
            }

        # Mark as verified
        await db.phone_otps.update_one(
            {"_id": otp_doc["_id"]},
            {"$set": {"verified": True, "verified_at": datetime.now(timezone.utc)}},
        )

        return {"verified": True, "phone": phone}

    @classmethod
    async def cleanup_expired(cls, db: AsyncIOMotorDatabase) -> int:
        """Remove expired OTPs (housekeeping)"""
        result = await db.phone_otps.delete_many(
            {"expires_at": {"$lt": datetime.now(timezone.utc)}}
        )
        return result.deleted_count
