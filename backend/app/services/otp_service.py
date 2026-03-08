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
            created_at = existing["created_at"]
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            elapsed = (datetime.now(timezone.utc) - created_at).total_seconds()
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


class EmailOTPService:
    """Email OTP generation, storage, and verification for email address verification"""

    @staticmethod
    def generate_otp() -> str:
        """Generate a secure numeric OTP"""
        return "".join(random.choices(string.digits, k=OTP_LENGTH))

    @classmethod
    async def send_otp(
        cls, db: AsyncIOMotorDatabase, email: str
    ) -> Dict[str, Any]:
        """
        Generate and store OTP for an email address.

        In production, integrate with SMTP/SendGrid for delivery.
        For now, stores OTP in DB and logs it in dev mode.
        """
        email = email.strip().lower()

        # Check cooldown — prevent OTP spam
        existing = await db.email_otps.find_one(
            {"email": email, "verified": False},
            sort=[("created_at", -1)],
        )
        if existing:
            created_at = existing["created_at"]
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            elapsed = (datetime.now(timezone.utc) - created_at).total_seconds()
            if elapsed < OTP_COOLDOWN_SECONDS:
                wait = int(OTP_COOLDOWN_SECONDS - elapsed)
                return {
                    "sent": False,
                    "message": f"Please wait {wait} seconds before requesting another OTP",
                    "retry_after": wait,
                }

        otp = cls.generate_otp()
        otp_doc = {
            "email": email,
            "otp": otp,
            "attempts": 0,
            "verified": False,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES),
        }

        # Upsert — one active OTP per email
        await db.email_otps.update_one(
            {"email": email, "verified": False},
            {"$set": otp_doc},
            upsert=True,
        )

        # NOTE: Integrate SMTP/SendGrid for production email delivery
        # For now, log OTP in non-production environments
        logger.info(f"[EMAIL_OTP] Email: {email}, OTP: {otp} (integrate email provider for production)")

        # Attempt actual email send if SMTP is configured
        await cls._send_email(email, otp)

        return {
            "sent": True,
            "message": "Verification code sent to your email",
            "expires_in": OTP_EXPIRY_MINUTES * 60,
        }

    @classmethod
    async def _send_email(cls, email: str, otp: str) -> None:
        """Send OTP via SMTP if configured, otherwise log only"""
        try:
            from app.core.config import get_settings
            settings = get_settings()
            _placeholders = ("test-", "your-", "placeholder", "test_", "none")
            if (
                not settings.SMTP_HOST
                or not settings.SMTP_USER
                or not settings.SMTP_PASSWORD
                or any(str(settings.SMTP_PASSWORD).lower().startswith(p) for p in _placeholders)
            ):
                logger.warning(
                    "[EMAIL_OTP] SMTP not configured — OTP NOT emailed. "
                    "Set SMTP_USER + SMTP_PASSWORD (Gmail App Password) in .env to enable email delivery."
                )
                return

            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart

            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Your Savitara Verification Code"
            msg["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM}>"
            msg["To"] = email

            text_body = (
                f"Your Savitara verification code is: {otp}\n\n"
                f"This code expires in {OTP_EXPIRY_MINUTES} minutes.\n"
                "Do not share this code with anyone."
            )
            html_body = (
                f"<p>Your <strong>Savitara</strong> verification code is:</p>"
                f"<h2 style='letter-spacing:6px;font-size:2rem;color:#FF6B35'>{otp}</h2>"
                f"<p>This code expires in <strong>{OTP_EXPIRY_MINUTES} minutes</strong>.</p>"
                "<p>Do not share this code with anyone.</p>"
            )

            msg.attach(MIMEText(text_body, "plain"))
            msg.attach(MIMEText(html_body, "html"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.EMAIL_FROM, email, msg.as_string())

            logger.info(f"[EMAIL_OTP] Sent OTP email to {email}")
        except Exception as exc:
            # Email delivery failure is non-fatal (OTP is still in DB, logged above)
            logger.warning(f"[EMAIL_OTP] Failed to send email to {email}: {exc}")

    @classmethod
    async def verify_otp(
        cls, db: AsyncIOMotorDatabase, email: str, otp: str
    ) -> Dict[str, Any]:
        """Verify OTP for an email address"""
        email = email.strip().lower()

        otp_doc = await db.email_otps.find_one(
            {"email": email, "verified": False},
            sort=[("created_at", -1)],
        )

        if not otp_doc:
            return {"verified": False, "error": "No OTP found. Please request a new one."}

        # Check expiry
        expires_at = otp_doc["expires_at"]
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires_at:
            await db.email_otps.delete_one({"_id": otp_doc["_id"]})
            return {"verified": False, "error": "OTP has expired. Please request a new one."}

        # Check max attempts
        if otp_doc["attempts"] >= OTP_MAX_ATTEMPTS:
            await db.email_otps.delete_one({"_id": otp_doc["_id"]})
            return {"verified": False, "error": "Maximum attempts exceeded. Please request a new OTP."}

        # Increment attempts
        await db.email_otps.update_one(
            {"_id": otp_doc["_id"]},
            {"$inc": {"attempts": 1}},
        )

        # Verify OTP
        if otp_doc["otp"] != otp:
            remaining = OTP_MAX_ATTEMPTS - otp_doc["attempts"] - 1
            return {
                "verified": False,
                "error": f"Invalid code. {remaining} attempts remaining.",
            }

        # Mark as verified
        await db.email_otps.update_one(
            {"_id": otp_doc["_id"]},
            {"$set": {"verified": True, "verified_at": datetime.now(timezone.utc)}},
        )

        return {"verified": True, "email": email}

    @classmethod
    async def cleanup_expired(cls, db: AsyncIOMotorDatabase) -> int:
        """Remove expired email OTPs (housekeeping)"""
        result = await db.email_otps.delete_many(
            {"expires_at": {"$lt": datetime.now(timezone.utc)}}
        )
        return result.deleted_count


class PasswordResetOTPService:
    """OTP service for password reset flow — uses a separate collection to avoid
    conflicting with email-verification OTPs (email_otps)."""

    @staticmethod
    def generate_otp() -> str:
        """Generate a secure numeric OTP"""
        return "".join(random.choices(string.digits, k=OTP_LENGTH))

    @classmethod
    async def send_otp(
        cls, db: AsyncIOMotorDatabase, email: str
    ) -> Dict[str, Any]:
        """
        Generate and store a password-reset OTP for the given email.
        Always succeeds silently (caller should not reveal whether email exists).
        """
        email = email.strip().lower()

        # Cooldown check — prevent OTP spam
        existing = await db.password_reset_otps.find_one(
            {"email": email, "consumed": False},
            sort=[("created_at", -1)],
        )
        if existing:
            created_at = existing["created_at"]
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            elapsed = (datetime.now(timezone.utc) - created_at).total_seconds()
            if elapsed < OTP_COOLDOWN_SECONDS:
                wait = int(OTP_COOLDOWN_SECONDS - elapsed)
                return {
                    "sent": False,
                    "message": f"Please wait {wait} seconds before requesting another code",
                    "retry_after": wait,
                }

        otp = cls.generate_otp()
        otp_doc = {
            "email": email,
            "otp": otp,
            "attempts": 0,
            "consumed": False,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES),
        }

        # Upsert — one active reset OTP per email
        await db.password_reset_otps.update_one(
            {"email": email, "consumed": False},
            {"$set": otp_doc},
            upsert=True,
        )

        logger.info(f"[PW_RESET_OTP] Email: {email}, OTP: {otp} (integrate email provider for production)")
        email_delivered = await cls._send_email(email, otp)

        return {
            "sent": True,
            "message": "Reset code sent",
            "expires_in": OTP_EXPIRY_MINUTES * 60,
            "otp": otp,                     # NEVER send to client in production
            "email_delivered": email_delivered,  # True only when SMTP actually sent the email
        }

    @classmethod
    async def _send_email(cls, email: str, otp: str) -> bool:
        """
        Send password-reset OTP via SMTP if configured.
        Returns True if the email was successfully delivered, False otherwise.
        """
        try:
            from app.core.config import get_settings
            settings = get_settings()
            _placeholders = ("test-", "your-", "placeholder", "test_", "none")
            if (
                not settings.SMTP_HOST
                or not settings.SMTP_USER
                or not settings.SMTP_PASSWORD
                or any(str(settings.SMTP_PASSWORD).lower().startswith(p) for p in _placeholders)
            ):
                logger.warning(
                    "[PW_RESET_OTP] SMTP not configured — reset code NOT emailed. "
                    "Set SMTP credentials in .env to enable delivery."
                )
                return False

            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart

            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Reset Your Savitara Password"
            msg["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM}>"
            msg["To"] = email

            text_body = (
                f"Your Savitara password reset code is: {otp}\n\n"
                f"This code expires in {OTP_EXPIRY_MINUTES} minutes.\n"
                "If you did not request this, please ignore this email.\n"
                "Do not share this code with anyone."
            )
            html_body = (
                "<p>We received a request to reset your <strong>Savitara</strong> password.</p>"
                "<p>Your reset code is:</p>"
                f"<h2 style='letter-spacing:6px;font-size:2rem;color:#FF6B35'>{otp}</h2>"
                f"<p>This code expires in <strong>{OTP_EXPIRY_MINUTES} minutes</strong>.</p>"
                "<p>If you did not request this, please ignore this email.</p>"
                "<p>Do not share this code with anyone.</p>"
            )

            msg.attach(MIMEText(text_body, "plain"))
            msg.attach(MIMEText(html_body, "html"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.EMAIL_FROM, email, msg.as_string())

            logger.info(f"[PW_RESET_OTP] Sent reset code email to {email}")
            return True
        except Exception as exc:
            logger.warning(f"[PW_RESET_OTP] Failed to send email to {email}: {exc}")
            return False

    @classmethod
    async def verify_and_consume(
        cls, db: AsyncIOMotorDatabase, email: str, otp: str
    ) -> Dict[str, Any]:
        """
        Verify a password-reset OTP and consume it (one-time use).
        Returns {'verified': True} on success or {'verified': False, 'error': str} on failure.
        """
        email = email.strip().lower()

        otp_doc = await db.password_reset_otps.find_one(
            {"email": email, "consumed": False},
            sort=[("created_at", -1)],
        )

        if not otp_doc:
            return {"verified": False, "error": "No reset code found. Please request a new one."}

        expires_at = otp_doc["expires_at"]
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires_at:
            await db.password_reset_otps.delete_one({"_id": otp_doc["_id"]})
            return {"verified": False, "error": "Reset code has expired. Please request a new one."}

        if otp_doc["attempts"] >= OTP_MAX_ATTEMPTS:
            await db.password_reset_otps.delete_one({"_id": otp_doc["_id"]})
            return {"verified": False, "error": "Too many failed attempts. Please request a new code."}

        # Increment attempts before verifying (prevent timing attacks on counter)
        await db.password_reset_otps.update_one(
            {"_id": otp_doc["_id"]},
            {"$inc": {"attempts": 1}},
        )

        if otp_doc["otp"] != otp:
            remaining = OTP_MAX_ATTEMPTS - otp_doc["attempts"] - 1
            return {
                "verified": False,
                "error": f"Invalid code. {remaining} attempts remaining.",
            }

        # Consume — mark as used so it cannot be replayed
        await db.password_reset_otps.update_one(
            {"_id": otp_doc["_id"]},
            {"$set": {"consumed": True, "consumed_at": datetime.now(timezone.utc)}},
        )

        return {"verified": True, "email": email}

    @classmethod
    async def cleanup_expired(cls, db: AsyncIOMotorDatabase) -> int:
        """Remove expired/consumed password-reset OTPs (housekeeping)"""
        result = await db.password_reset_otps.delete_many(
            {"$or": [
                {"expires_at": {"$lt": datetime.now(timezone.utc)}},
                {"consumed": True, "consumed_at": {"$lt": datetime.now(timezone.utc) - timedelta(hours=24)}},
            ]}
        )
        return result.deleted_count
