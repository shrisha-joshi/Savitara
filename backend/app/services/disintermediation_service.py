"""
Disintermediation Defense Service
Phone masking, NLP content filtering, offline transaction detection, loyalty incentives
"""
import re
import inspect
import random
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple, Union
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.models.disintermediation import (
    MaskedPhoneRelay,
    CallLog,
    MessageContentAnalysis,
    OfflineTransactionDetection,
    LoyaltyIncentive,
)
from app.core.exceptions import NotFoundError, ValidationError


def utcnow():
    return datetime.now(timezone.utc)


async def allocate_relay_number(db: AsyncIOMotorDatabase) -> str:
    """Allocate a unique relay phone number for masked communication.

    Checks against active relays in the DB to guarantee uniqueness.
    Retries up to 10 times before raising an error.
    In production replace with a telephony provider SDK call.
    """
    for _ in range(10):
        candidate = f"+91{random.randint(7000000000, 9999999999)}"
        existing = await db.masked_phone_relays.find_one(
            {"masked_phone_number": candidate, "relay_active": True}
        )
        if not existing:
            return candidate
    raise RuntimeError("Unable to allocate a unique relay number after 10 attempts")


class DisintermediationService:
    """
    Prevent offline transactions and protect platform revenue
    
    Key Functions:
    - Phone number masking for calls
    - NLP-based contact info detection in messages
    - ML-based offline transaction detection
    - Loyalty incentives to discourage bypassing platform
    """
    
    # Regex Patterns for Contact Info
    PHONE_PATTERN = re.compile(r'(?:\+91[\s-]?)?[6-9]\d{9}')  # Indian mobile
    EMAIL_PATTERN = re.compile(r'[\w\.-]+@[\w\.-]+\.\w+')
    SOCIAL_PATTERN = re.compile(
        r'(?:facebook\.com/|instagram\.com/|twitter\.com/|@)[\w\.-]+',
        re.IGNORECASE
    )
    PAYMENT_PATTERN = re.compile(
        r'\b(?:paytm|gpay|google\s*pay|phonepe|whatsapp\s*pay|upi|bhim)\b',
        re.IGNORECASE
    )
    LINK_PATTERN = re.compile(
        r'(?:https?://|www\.)[\w.]+(?:-[\w.]+)*\.\w+[^\s]*'
    )
    
    @staticmethod
    async def create_masked_phone_relay(
        db: AsyncIOMotorDatabase,
        booking_id: str
    ) -> Dict[str, Any]:
        """
        Create temporary phone relay for in-app calling

        Returns dict with relay_number, expires_at, booking_id.
        """
        # Fetch booking
        booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
        if not booking:
            raise NotFoundError(f"Booking {booking_id} not found")

        # Support both user_id/grihasta_id field names
        grihasta_ref = booking.get("user_id") or booking.get("grihasta_id")
        acharya_ref = booking.get("acharya_id")

        # Fetch user details
        grihasta = await db.users.find_one({"_id": ObjectId(str(grihasta_ref))}) if grihasta_ref else None
        acharya = await db.users.find_one({"_id": ObjectId(str(acharya_ref))}) if acharya_ref else None

        if not grihasta or not acharya:
            raise NotFoundError("User details not found")

        # Encrypt phone numbers
        grihasta_phone = DisintermediationService._encrypt_phone(
            grihasta.get("phone", "")
        )
        acharya_phone = DisintermediationService._encrypt_phone(
            acharya.get("phone", "")
        )

        # Allocate masked relay number via provider
        masked_number = await allocate_relay_number(db)

        # Calculate expiry (24h after booking scheduled time)
        booking_end = booking.get("scheduled_end_time") or booking.get("scheduled_time")
        if isinstance(booking_end, datetime):
            expires_at = booking_end + timedelta(hours=24)
        elif isinstance(booking_end, str):
            try:
                booking_end = datetime.fromisoformat(booking_end.replace('Z', '+00:00'))
                expires_at = booking_end + timedelta(hours=24)
            except (ValueError, TypeError):
                expires_at = utcnow() + timedelta(days=1)
        else:
            expires_at = utcnow() + timedelta(days=1)

        # Create relay
        relay = MaskedPhoneRelay(
            booking_id=booking_id,
            acharya_real_phone=acharya_phone,
            grihasta_real_phone=grihasta_phone,
            # For now, use the same relay number in both directions.
            # Provider integrations can later map directional virtual numbers.
            acharya_masked_number=masked_number,
            grihasta_masked_number=masked_number,
            expires_at=expires_at,
            created_at=utcnow(),
        )

        result = await db.masked_phone_relays.insert_one(
            relay.model_dump(by_alias=True, exclude={"id"})
        )
        relay.id = str(result.inserted_id)

        return {
            "relay_number": masked_number,
            "expires_at": expires_at,
            "booking_id": booking_id,
            "relay_id": relay.id,
        }
    
    @staticmethod
    def _encrypt_phone(phone: str) -> str:
        """
        Encrypt phone number using SHA-256 (one-way hash for privacy)
        
        For reversible encryption, use cryptography.fernet
        """
        return hashlib.sha256(phone.encode()).hexdigest()
    
    @staticmethod
    async def log_call(
        db: AsyncIOMotorDatabase,
        relay_id: str,
        caller_id: str,
        receiver_id: str,
        duration_seconds: int,
        recording_url: Optional[str] = None
    ) -> CallLog:
        """
        Log in-app call for analytics and fraud detection
        
        Flags:
        - Calls >30 min (potential offline discussion)
        - Multiple calls in short period
        - Calls after booking completion
        """
        call_log = CallLog(
            relay_id=relay_id,
            caller_id=caller_id,
            receiver_id=receiver_id,
            call_duration_seconds=duration_seconds,
            call_recording_url=recording_url,
            flagged_for_review=(duration_seconds > 1800),  # >30 min
            call_started_at=utcnow()
        )
        
        result = await db.call_logs.insert_one(
            call_log.model_dump(by_alias=True, exclude={"id"})
        )
        call_log.id = str(result.inserted_id)
        
        # Update relay stats
        await db.masked_phone_relays.update_one(
            {"_id": ObjectId(relay_id)},
            {
                "$inc": {
                    "total_calls": 1,
                    "total_minutes": duration_seconds / 60.0
                }
            }
        )
        
        return call_log

    @staticmethod
    def _get_flagged_patterns(flags: Dict[str, bool]) -> List[str]:
        """Map content detection flags to pattern label list."""
        mapping = [
            ("contains_phone_number", "phone"),
            ("contains_email", "email"),
            ("contains_social_media", "social"),
            ("contains_payment_request", "payment"),
            ("contains_external_links", "link"),
        ]
        return [label for key, label in mapping if flags.get(key)]

    @staticmethod
    def _normalize_digits(text: str) -> str:
        """Normalize Indic digits to ASCII for regex matching."""
        return text.translate(str.maketrans("०१२३४५६७८९", "0123456789"))

    @staticmethod
    async def analyze_message_content(
        db_or_content,
        message_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        sender_id: Optional[str] = None,
        content: Optional[str] = None
    ) -> Union[Dict[str, Any], "MessageContentAnalysis"]:
        """
        NLP-based content analysis.  Supports two calling conventions:

        Simple (tests): await analyze_message_content("message text")
        Full: await analyze_message_content(db, msg_id, conv_id, sender_id, content)
        """
        # --- Simple text-only mode ---
        if isinstance(db_or_content, str):
            text = db_or_content
            normalized_text = DisintermediationService._normalize_digits(text)
            flags = {
                "contains_phone_number": bool(DisintermediationService.PHONE_PATTERN.search(normalized_text)),
                "contains_email": bool(DisintermediationService.EMAIL_PATTERN.search(normalized_text)),
                "contains_social_media": bool(
                    DisintermediationService.SOCIAL_PATTERN.search(normalized_text)
                    or re.search(r'\bwhatsapp\b', normalized_text, re.IGNORECASE)
                ),
                "contains_payment_request": bool(DisintermediationService.PAYMENT_PATTERN.search(normalized_text)),
                "contains_external_links": bool(DisintermediationService.LINK_PATTERN.search(normalized_text)),
            }
            flagged_patterns: List[str] = DisintermediationService._get_flagged_patterns(flags)
            if re.search(r'\bwhatsapp\b', normalized_text, re.IGNORECASE):
                flagged_patterns.append("whatsapp")

            # Calculate risk using same weight logic
            score_flags = {
                "contains_phone_number": flags["contains_phone_number"],
                "contains_email": flags["contains_email"],
                "contains_social_media_handle": flags["contains_social_media"],
                "contains_payment_request": flags["contains_payment_request"],
                "contains_external_link": flags["contains_external_links"],
            }
            risk_score = DisintermediationService._calculate_message_risk_score(score_flags)
            return {
                **flags,
                "risk_score": risk_score,
                "flagged_patterns": flagged_patterns,
                "auto_block_recommended": risk_score >= 80,
                "flag_for_review": 50 <= risk_score < 80,
            }

        # --- Full DB mode ---
        db: AsyncIOMotorDatabase = db_or_content
        if content is None:
            raise ValueError("content is required in full DB mode")
        return await DisintermediationService._analyze_message_content_full(
            db, message_id or "", conversation_id or "", sender_id or "", content
        )

    @staticmethod
    async def _analyze_message_content_full(
        db: AsyncIOMotorDatabase,
        message_id: str,
        conversation_id: str,
        sender_id: str,
        content: str
    ) -> MessageContentAnalysis:
        """
        NLP-based content analysis for contact info sharing
        
        Detects:
        - Phone numbers (Indian mobile format)
        - Email addresses
        - Social media handles
        - Payment app mentions
        - External links
        
        Actions:
        - Auto-warn on first violation
        - Auto-block message on repeated violations
        - Flag user account for manual review
        """
        # Hash content for privacy
        content_hash = hashlib.sha256(content.encode()).hexdigest()

        # Extract flags
        flags = {
            "contains_phone_number": bool(DisintermediationService.PHONE_PATTERN.search(content)),
            "contains_email": bool(DisintermediationService.EMAIL_PATTERN.search(content)),
            "contains_social_media_handle": bool(DisintermediationService.SOCIAL_PATTERN.search(content)),
            "contains_payment_request": bool(DisintermediationService.PAYMENT_PATTERN.search(content)),
            "contains_external_link": bool(DisintermediationService.LINK_PATTERN.search(content)),
        }
        
        # Calculate risk score (0-100)
        risk_score = DisintermediationService._calculate_message_risk_score(flags)

        # Determine action
        action_taken = None
        if risk_score >= 80:
            action_taken = "MESSAGE_BLOCKED"
        elif risk_score >= 50:
            action_taken = "WARNING_SENT"

        if risk_score >= 80 and sender_id:
            # Flag user account
            await db.users.update_one(
                {"_id": ObjectId(sender_id)},
                {
                    "$inc": {"disintermediation_violations": 1},
                    "$set": {"last_violation_at": utcnow()}
                }
            )
            action_taken = "ACCOUNT_FLAGGED"

        # Create analysis
        analysis = MessageContentAnalysis(
            message_id=message_id,
            conversation_id=conversation_id,
            sender_id=sender_id,
            content_hash=content_hash,
            flags=flags,
            risk_score=risk_score,
            action_taken=action_taken,
            analyzed_at=utcnow()
        )

        result = await db.message_content_analyses.insert_one(
            analysis.model_dump(by_alias=True, exclude={"id"})
        )
        analysis.id = str(result.inserted_id)

        return analysis
    
    @staticmethod
    def _calculate_message_risk_score(flags: Dict[str, bool]) -> float:
        """
        Risk scoring based on flags
        
        Weights:
        - Phone: 70
        - Email: 60
        - Payment app: 80
        - Social media: 10
        - External link: 15
        """
        score = 0.0

        if flags.get("contains_phone_number"):
            score += 70.0
        if flags.get("contains_email"):
            score += 60.0
        if flags.get("contains_payment_request"):
            score += 80.0
        if flags.get("contains_social_media_handle"):
            score += 10.0
        if flags.get("contains_external_link"):
            score += 15.0
        
        return min(score, 100.0)

    @staticmethod
    def _extract_risk_score(analysis: Any) -> float:
        """Safely read numeric risk score from analysis payload."""
        if not analysis:
            return 0.0

        candidate_score = (
            analysis.get("risk_score", 0)
            if isinstance(analysis, dict)
            else getattr(analysis, "risk_score", 0)
        )
        try:
            return float(candidate_score)
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    async def _get_latest_content_analysis(
        db: AsyncIOMotorDatabase,
        booking_id: Optional[str],
    ) -> Any:
        """Fetch latest content-analysis document, supporting legacy collection naming."""
        if not booking_id:
            return None

        analysis_collection = getattr(
            db,
            "message_content_analysis",
            getattr(db, "message_content_analyses", None),
        )
        if analysis_collection is None:
            return None

        latest_result = analysis_collection.find_one(
            {"booking_id": booking_id},
            sort=[("analyzed_at", -1)],
        )
        return await latest_result if inspect.isawaitable(latest_result) else latest_result
    
    @staticmethod
    async def detect_offline_transaction(
        db: AsyncIOMotorDatabase,
        user_id: str,
        booking_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        ML-based offline transaction detection.

        Returns dict with fraud_confidence, fraud_signals, investigation_recommended.
        """
        # --- Booking history signals ---
        total_bookings = await db.bookings.count_documents({"user_id": user_id})
        repeat_bookings = await db.bookings.count_documents({
            "user_id": user_id,
            "status": "completed",
        })
        user_cancellations = await db.bookings.count_documents({
            "user_id": user_id,
            "status": "cancelled",
            "cancelled_by": "grihasta",
        })

        # --- Chat activity signal (aggregate total messages) ---
        total_messages = 0
        if booking_id:
            agg_cursor = db.messages.aggregate([
                {"$match": {"booking_id": booking_id}},
                {"$count": "total_messages"},
            ])
            agg_results: list = await agg_cursor.to_list(1)
            if agg_results:
                total_messages = agg_results[0].get("total_messages", 0)

        # --- Contact sharing signal ---
        latest_analysis = await DisintermediationService._get_latest_content_analysis(
            db, booking_id
        )

        # --- Evaluate signals ---
        fraud_signals: List[str] = []
        if total_bookings <= 1 and repeat_bookings <= 0:
            fraud_signals.append("no_repeat_bookings")
        if total_bookings <= 1:
            fraud_signals.append("single_booking_user")
        if total_messages > 30:
            fraud_signals.append("high_chat_activity")
        if DisintermediationService._extract_risk_score(latest_analysis) >= 50:
            fraud_signals.append("contact_sharing_detected")
        if user_cancellations >= 1:
            fraud_signals.append("user_cancellations_present")

        fraud_confidence = len(fraud_signals) * 20.0

        # Persist detection record
        detection = OfflineTransactionDetection(
            user_id=user_id,
            booking_id=booking_id,
            detection_signals={
                "no_repeat_bookings": "no_repeat_bookings" in fraud_signals,
                "single_booking_user": "single_booking_user" in fraud_signals,
                "high_chat_activity": "high_chat_activity" in fraud_signals,
                "contact_sharing_detected": "contact_sharing_detected" in fraud_signals,
                "user_cancellations_present": "user_cancellations_present" in fraud_signals,
            },
            ml_confidence_score=fraud_confidence,
            investigation_status="PENDING" if fraud_confidence > 70 else "FALSE_POSITIVE",
            detected_at=utcnow()
        )
        result = await db.offline_transaction_detections.insert_one(
            detection.model_dump(by_alias=True, exclude={"id"})
        )
        detection.id = str(result.inserted_id)

        return {
            "fraud_confidence": fraud_confidence,
            "fraud_signals": fraud_signals,
            "investigation_recommended": fraud_confidence > 70,
            "detection_id": detection.id,
        }
    
    @staticmethod
    def _calculate_offline_detection_score(signals: Dict[str, bool]) -> float:
        """
        ML confidence score based on signals
        
        Weights (sum to 100):
        - Sudden drop: 35
        - No repeat: 20
        - High chat pre-booking: 15
        - Contact sharing: 25
        - Cancellation: 5
        """
        score = 0.0
        
        if signals.get("sudden_booking_drop_after_first"):
            score += 35.0
        if signals.get("no_repeat_bookings"):
            score += 20.0
        if signals.get("high_chat_activity_pre_booking"):
            score += 15.0
        if signals.get("contact_sharing_detected"):
            score += 25.0
        if signals.get("user_requested_cancellation"):
            score += 5.0
        
        return score
    
    @staticmethod
    async def create_loyalty_incentive(
        db: AsyncIOMotorDatabase,
        user_id: str,
        incentive_type: str,
        trigger_event: str,
        value_amount: float,
        redemption_conditions: Dict[str, Any]
    ) -> LoyaltyIncentive:
        """
        Create loyalty incentive to encourage repeat bookings
        
        Types:
        - REPEAT_BOOKING_DISCOUNT: 10% off on 2nd booking
        - REFERRAL_BONUS: 100 credits for referring friend
        - TIER_UPGRADE: Unlock premium benefits after 5 bookings
        
        Redemption Conditions:
        - min_booking_value: 500
        - valid_until: 30 days
        - applicable_services: ["all"]
        """
        incentive = LoyaltyIncentive(
            user_id=user_id,
            incentive_type=incentive_type,
            trigger_event=trigger_event,
            value_amount=value_amount,
            redemption_conditions=redemption_conditions,
            redeemed=False,
            expires_at=utcnow() + timedelta(days=30),
            created_at=utcnow()
        )
        
        result = await db.loyalty_incentives.insert_one(
            incentive.model_dump(by_alias=True, exclude={"id"})
        )
        incentive.id = str(result.inserted_id)
        
        # Send notification to user
        try:
            from app.services.notification_service import NotificationService
            ns = NotificationService()
            user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
            if user_doc and user_doc.get("fcm_token"):
                await ns.send_notification_async(
                    token=user_doc["fcm_token"],
                    title="Loyalty Reward Earned!",
                    body=f"You earned {incentive.coins_reward} coins. Keep booking to earn more!",
                    data={"type": "incentive_earned", "incentive_id": str(incentive.id)},
                )
        except Exception:
            pass
        
        return incentive
    
    @staticmethod
    async def apply_acharya_rank_penalty(
        db: AsyncIOMotorDatabase,
        acharya_id: str,
        reason: str,
        penalty_points: int
    ):
        """
        Apply marketplace ranking penalty for offline behavior
        
        Penalties:
        - Contact sharing detected: -50 points
        - Confirmed offline transaction: -100 points
        - Multiple violations: Account suspension
        
        Impact:
        - Lower search ranking
        - Excluded from "Top Acharyas" lists
        - Delayed verification badge
        """
        # Fetch current penalty score
        acharya = await db.users.find_one({"_id": ObjectId(acharya_id)})
        if not acharya:
            raise NotFoundError(f"Acharya {acharya_id} not found")
        
        current_penalty = acharya.get("rank_penalty_points", 0)
        new_penalty = current_penalty + penalty_points
        
        # Update penalty
        await db.users.update_one(
            {"_id": ObjectId(acharya_id)},
            {
                "$set": {
                    "rank_penalty_points": new_penalty,
                    "last_penalty_at": utcnow(),
                    "last_penalty_reason": reason
                }
            }
        )
        
        # Suspend if penalty >200
        if new_penalty > 200:
            await db.users.update_one(
                {"_id": ObjectId(acharya_id)},
                {
                    "$set": {
                        "account_status": "suspended",
                        "suspension_reason": "Repeated disintermediation violations"
                    }
                }
            )
            # Send suspension notice
            try:
                from app.services.notification_service import NotificationService
                ns = NotificationService()
                acharya_doc = await db.users.find_one({"_id": ObjectId(acharya_id)})
                if acharya_doc and acharya_doc.get("fcm_token"):
                    await ns.send_notification_async(
                        token=acharya_doc["fcm_token"],
                        title="Account Suspended",
                        body="Your account has been suspended due to repeated policy violations. Contact support.",
                        data={"type": "account_suspended", "reason": "disintermediation"},
                    )
            except Exception:
                pass
        
        current_rank = acharya.get("marketplace_rank", 100)
        new_rank = max(0, current_rank - penalty_points)

        acharya["marketplace_rank"] = new_rank
        await db.users.update_one(
            {"_id": ObjectId(acharya_id)},
            {"$set": {"marketplace_rank": new_rank}},
        )

        return {
            "new_rank": new_rank,
            "reason": reason,
            "penalty_applied": penalty_points,
            "total_penalty": new_penalty,
        }
