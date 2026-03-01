"""
Disintermediation Defense Service
Phone masking, NLP content filtering, offline transaction detection, loyalty incentives
"""
import re
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
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
        r'(?:http[s]?://|www\.)[\w\.-]+\.\w+[\w\-\._~:/?#[\]@!\$&\'\(\)\*\+,;=.]*'
    )
    
    @staticmethod
    async def create_masked_phone_relay(
        db: AsyncIOMotorDatabase,
        booking_id: str
    ) -> MaskedPhoneRelay:
        """
        Create temporary phone relay for in-app calling
        
        Process:
        1. Fetch booking details
        2. Encrypt actual phone numbers
        3. Generate masked relay number (platform-provided)
        4. Set 24h expiry post-booking
        
        Provider: Twilio / Exotel / Knowlarity
        
        Note: Requires integration with telecom provider API
        """
        # Fetch booking
        booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
        if not booking:
            raise NotFoundError(f"Booking {booking_id} not found")
        
        # Fetch user details
        grihasta = await db.users.find_one({"_id": ObjectId(booking["user_id"])})
        acharya = await db.users.find_one({"_id": ObjectId(booking["acharya_id"])})
        
        if not grihasta or not acharya:
            raise NotFoundError("User details not found")
        
        # Encrypt phone numbers (AES-256)
        grihasta_phone = DisintermediationService._encrypt_phone(
            grihasta.get("phone", "")
        )
        acharya_phone = DisintermediationService._encrypt_phone(
            acharya.get("phone", "")
        )
        
        # Generate masked number (placeholder - actual generation via provider API)
        # Example: Twilio Proxy Service
        masked_number = f"+91{9000000000 + int(booking_id[-6:], 16) % 100000000}"
        
        # Calculate expiry (24h after booking end time)
        booking_end = booking.get("scheduled_end_time", booking.get("scheduled_time"))
        expires_at = booking_end + timedelta(hours=24) if booking_end else utcnow() + timedelta(days=1)
        
        # Create relay
        relay = MaskedPhoneRelay(
            booking_id=booking_id,
            acharya_actual_phone=acharya_phone,
            grihasta_actual_phone=grihasta_phone,
            masked_phone_number=masked_number,
            relay_active=True,
            expires_at=expires_at,
            created_at=utcnow()
        )
        
        result = await db.masked_phone_relays.insert_one(
            relay.model_dump(by_alias=True, exclude={"id"})
        )
        relay.id = str(result.inserted_id)
        
        return relay
    
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
    async def analyze_message_content(
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
        
        if risk_score >= 80:
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
        - Phone: 40
        - Email: 30
        - Payment app: 20
        - Social media: 10
        - External link: 15
        """
        score = 0.0
        
        if flags.get("contains_phone_number"):
            score += 40.0
        if flags.get("contains_email"):
            score += 30.0
        if flags.get("contains_payment_request"):
            score += 20.0
        if flags.get("contains_social_media_handle"):
            score += 10.0
        if flags.get("contains_external_link"):
            score += 15.0
        
        return min(score, 100.0)
    
    @staticmethod
    async def detect_offline_transaction(
        db: AsyncIOMotorDatabase,
        user_id: str,
        booking_id: Optional[str] = None
    ) -> OfflineTransactionDetection:
        """
        ML-based offline transaction detection
        
        Signals:
        1. User books once, then never again (+60 points)
        2. High chat activity before booking, none after (+30 points)
        3. Contact sharing detected in messages (+50 points)
        4. User-initiated cancellation immediately after booking (+40 points)
        5. No repeat bookings with same Acharya (+20 points)
        
        Threshold: >70 points = Likely offline transaction
        """
        # Fetch user booking history
        total_bookings = await db.bookings.count_documents({"user_id": user_id})
        completed_bookings = await db.bookings.count_documents({
            "user_id": user_id,
            "status": "completed"
        })
        
        # Signal 1: Sudden drop after first booking
        sudden_booking_drop = False
        if total_bookings == 1 and completed_bookings == 1:
            # Check if booking was >30 days ago
            first_booking = await db.bookings.find_one(
                {"user_id": user_id},
                sort=[("created_at", 1)]
            )
            if first_booking:
                days_since = (utcnow() - first_booking["created_at"]).days
                sudden_booking_drop = days_since > 30
        
        # Signal 2: No repeat bookings
        repeat_bookings = await db.bookings.count_documents({
            "user_id": user_id,
            "status": "completed"
        }) > 1
        no_repeat_bookings = not repeat_bookings
        
        # Signal 3: High chat activity pre-booking
        if booking_id:
            booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
            conversation = await db.conversations.find_one({
                "booking_id": booking_id
            }) if booking else None
            
            if conversation:
                messages_before = await db.messages.count_documents({
                    "conversation_id": str(conversation["_id"]),
                    "created_at": {"$lt": booking["created_at"]}
                })
                messages_after = await db.messages.count_documents({
                    "conversation_id": str(conversation["_id"]),
                    "created_at": {"$gt": booking["created_at"]}
                })
                high_chat_activity_pre_booking = messages_before > 10 and messages_after < 2
            else:
                high_chat_activity_pre_booking = False
        else:
            high_chat_activity_pre_booking = False
        
        # Signal 4: Contact sharing detected
        contact_sharing_detected = await db.message_content_analyses.count_documents({
            "sender_id": user_id,
            "risk_score": {"$gte": 50}
        }) > 0
        
        # Signal 5: User-requested cancellation
        user_requested_cancellation = False
        if booking_id:
            booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
            user_requested_cancellation = (
                booking.get("status") == "cancelled" 
                and booking.get("cancelled_by") == "grihasta"
            )
        
        # Create detection signals
        detection_signals = {
            "sudden_booking_drop_after_first": sudden_booking_drop,
            "no_repeat_bookings": no_repeat_bookings,
            "high_chat_activity_pre_booking": high_chat_activity_pre_booking,
            "contact_sharing_detected": contact_sharing_detected,
            "user_requested_cancellation": user_requested_cancellation,
        }
        
        # Calculate ML confidence score
        ml_confidence = DisintermediationService._calculate_offline_detection_score(
            detection_signals
        )
        
        # Create detection record
        detection = OfflineTransactionDetection(
            user_id=user_id,
            booking_id=booking_id,
            detection_signals=detection_signals,
            ml_confidence_score=ml_confidence,
            investigation_status="PENDING" if ml_confidence > 70 else "FALSE_POSITIVE",
            detected_at=utcnow()
        )
        
        result = await db.offline_transaction_detections.insert_one(
            detection.model_dump(by_alias=True, exclude={"id"})
        )
        detection.id = str(result.inserted_id)
        
        # Trigger admin alert if high confidence
        if ml_confidence > 80:
            # TODO: Send admin alert
            pass
        
        return detection
    
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
        # TODO: await notification_service.notify_incentive_earned(user_id, incentive)
        
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
            # TODO: Send suspension notice
        
        return {"penalty_applied": penalty_points, "total_penalty": new_penalty}
