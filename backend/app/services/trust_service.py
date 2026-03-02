"""
Trust Score Calculation Service
Enterprise-grade trust scoring, verification badges, dispute resolution, service guarantees
"""
import math
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.models.trust import (
    TrustScoreComponent,
    AcharyaTrustScore,
    VerificationLevel,
    Dispute,
    RefundRequest,
    AttendanceCheckpoint,
    AuditLog,
)
from app.core.exceptions import ResourceNotFoundError, ValidationError
from app.core.constants import MONGO_MATCH, MONGO_GROUP, MONGO_ADD_FIELDS


def utcnow():
    return datetime.now(timezone.utc)


class TrustScoreService:
    """
    Trust score calculation and management
    
    Key Functions:
    - Calculate weighted composite trust scores
    - Award/revoke verification badges
    - Process service guarantees
    - Manage dispute lifecycle
    """
    
    # Scoring Weights (must sum to 1.0)
    WEIGHT_VERIFICATION = 0.30
    WEIGHT_COMPLETION = 0.25
    WEIGHT_RESPONSE_TIME = 0.15
    WEIGHT_REBOOKING = 0.20
    WEIGHT_REVIEW_QUALITY = 0.10
    
    @staticmethod
    async def calculate_acharya_trust_score(
        db: AsyncIOMotorDatabase,
        acharya_id: str
    ) -> AcharyaTrustScore:
        """
        Calculate comprehensive trust score for an Acharya
        
        Components:
        1. Verification Level (30%): KYC status, document verification
        2. Completion Rate (25%): Completed bookings / Total bookings
        3. Response Time (15%): Avg hours to accept booking
        4. Rebooking Rate (20%): % of Grihastas who book again
        5. Review Quality (10%): Weighted average star rating
        
        Returns:
            AcharyaTrustScore with composite score (0-100)
        """
        # Fetch Acharya
        acharya = await db.users.find_one({"_id": ObjectId(acharya_id), "role": "acharya"})
        if not acharya:
            raise ResourceNotFoundError(f"Acharya {acharya_id} not found")
        
        # 1. Verification Level Score (0-30)
        verification_score = await TrustScoreService._calculate_verification_score(db, acharya)
        
        # 2. Completion Rate Score (0-25)
        completion_score = await TrustScoreService._calculate_completion_score(db, acharya_id)
        
        # 3. Response Time Score (0-15)
        response_time_score = await TrustScoreService._calculate_response_time_score(db, acharya_id)
        
        # 4. Rebooking Rate Score (0-20)
        rebooking_score = await TrustScoreService._calculate_rebooking_score(db, acharya_id)
        
        # 5. Review Quality Score (0-10)
        review_score = await TrustScoreService._calculate_review_quality_score(db, acharya_id)
        
        # Create TrustScoreComponent
        trust_component = TrustScoreComponent(
            verification_level=verification_score,
            completion_rate=completion_score,
            response_time_score=response_time_score,
            rebooking_rate=rebooking_score,
            review_quality_score=review_score
        )
        
        # Determine verification badge
        verification_badge = await TrustScoreService._determine_verification_badge(db, acharya, completion_score)
        
        # Get guarantee & dispute stats
        guarantees_honored = await db.service_guarantees.count_documents({
            "acharya_id": acharya_id,
            "status": "approved"
        })
        
        disputes_resolved = await db.dispute_resolutions.count_documents({
            "respondent_id": acharya_id,
            "status": {"$regex": "^RESOLVED"}
        })
        
        # Construct AcharyaTrustScore
        trust_score = AcharyaTrustScore(
            acharya_id=acharya_id,
            trust_score=trust_component,
            verification_badge=verification_badge,
            is_verified_provider=(verification_badge != "BASIC"),
            total_guarantees_honored=guarantees_honored,
            total_disputes_resolved=disputes_resolved,
            last_score_update=utcnow()
        )
        
        # Store in database
        await db.acharya_trust_scores.update_one(
            {"acharya_id": acharya_id},
            {"$set": trust_score.model_dump(by_alias=True, exclude={"id"})},
            upsert=True
        )
        
        return trust_score
    
    @staticmethod
    async def _calculate_verification_score(
        db: AsyncIOMotorDatabase,
        acharya: Dict
    ) -> float:
        """
        Verification Level Score (0-30)
        
        Scoring:
        - BASIC (pending verification): 10
        - SAVITARA_VERIFIED (admin approved): 20
        - PREMIUM_VERIFIED (background check + 50+ bookings): 30
        """
        # Check existing trust score for badge
        existing = await db.acharya_trust_scores.find_one({"acharya_id": str(acharya["_id"])})
        badge = existing.get("verification_badge", "BASIC") if existing else "BASIC"
        
        if badge == "PREMIUM_VERIFIED":
            return 30.0
        elif badge == "SAVITARA_VERIFIED":
            return 20.0
        else:
            return 10.0
    
    @staticmethod
    async def _calculate_completion_score(
        db: AsyncIOMotorDatabase,
        acharya_id: str
    ) -> float:
        """
        Completion Rate Score (0-25)
        
        Formula: (completed_bookings / total_bookings) * 25
        
        Edge Cases:
        - New Acharyas (<5 bookings): Score = 12.5 (neutral)
        - 100% completion: Score = 25
        """
        total_bookings = await db.bookings.count_documents({"acharya_id": acharya_id})
        
        if total_bookings < 5:
            return 12.5  # Neutral score for new Acharyas
        
        completed_bookings = await db.bookings.count_documents({
            "acharya_id": acharya_id,
            "status": "completed"
        })
        
        completion_rate = completed_bookings / total_bookings
        return completion_rate * 25.0
    
    @staticmethod
    async def _calculate_response_time_score(
        db: AsyncIOMotorDatabase,
        acharya_id: str
    ) -> float:
        """
        Response Time Score (0-15)
        
        Measures: Avg time (hours) from booking request → acceptance
        
        Scoring:
        - < 1 hour: 15
        - 1-3 hours: 12
        - 3-6 hours: 9
        - 6-12 hours: 6
        - 12-24 hours: 3
        - > 24 hours: 0
        """
        pipeline = [
            {MONGO_MATCH: {"acharya_id": acharya_id, "status": {"$in": ["accepted", "completed"]}}},
            {MONGO_ADD_FIELDS: {
                "response_time_hours": {
                    "$divide": [
                        {"$subtract": ["$accepted_at", "$created_at"]},
                        3600000  # Convert ms to hours
                    ]
                }
            }},
            {MONGO_GROUP: {
                "_id": None,
                "avg_response_hours": {"$avg": "$response_time_hours"}
            }}
        ]
        
        result = await db.bookings.aggregate(pipeline).to_list(1)
        
        if not result:
            return 7.5  # Neutral for no data
        
        avg_hours = result[0]["avg_response_hours"]
        
        if avg_hours < 1:
            return 15.0
        elif avg_hours < 3:
            return 12.0
        elif avg_hours < 6:
            return 9.0
        elif avg_hours < 12:
            return 6.0
        elif avg_hours < 24:
            return 3.0
        else:
            return 0.0
    
    @staticmethod
    async def _calculate_rebooking_score(
        db: AsyncIOMotorDatabase,
        acharya_id: str
    ) -> float:
        """
        Rebooking Rate Score (0-20)
        
        Formula: (Unique Grihastas with 2+ bookings / Total unique Grihastas) * 20
        
        Measures customer loyalty
        """
        pipeline = [
            {MONGO_MATCH: {"acharya_id": acharya_id, "status": "completed"}},
            {MONGO_GROUP: {
                "_id": "$user_id",
                "booking_count": {"$sum": 1}
            }},
            {MONGO_GROUP: {
                "_id": None,
                "total_grihastas": {"$sum": 1},
                "repeat_grihastas": {
                    "$sum": {"$cond": [{"$gte": ["$booking_count", 2]}, 1, 0]}
                }
            }}
        ]
        
        result = await db.bookings.aggregate(pipeline).to_list(1)
        
        if not result or result[0]["total_grihastas"] < 3:
            return 10.0  # Neutral for insufficient data
        
        total = result[0]["total_grihastas"]
        repeat = result[0]["repeat_grihastas"]
        
        rebooking_rate = repeat / total
        return rebooking_rate * 20.0
    
    @staticmethod
    async def _calculate_review_quality_score(
        db: AsyncIOMotorDatabase,
        acharya_id: str
    ) -> float:
        """
        Review Quality Score (0-10)
        
        Weighted average star rating: (avg_rating / 5) * 10
        
        Weight recent reviews more heavily (time decay)
        """
        pipeline = [
            {MONGO_MATCH: {"acharya_id": acharya_id}},
            {MONGO_ADD_FIELDS: {
                # Time decay factor (last 90 days = weight 1.0, older = exponential decay)
                "days_ago": {
                    "$divide": [
                        {"$subtract": [datetime.now(timezone.utc), "$created_at"]},
                        86400000  # ms to days
                    ]
                }
            }},
            {MONGO_ADD_FIELDS: {
                "time_weight": {
                    "$cond": [
                        {"$lte": ["$days_ago", 90]},
                        1.0,
                        {"$exp": {"$multiply": [-0.01, "$days_ago"]}}  # Exponential decay
                    ]
                }
            }},
            {MONGO_GROUP: {
                "_id": None,
                "weighted_sum": {"$sum": {"$multiply": ["$rating", "$time_weight"]}},
                "total_weight": {"$sum": "$time_weight"}
            }}
        ]
        
        result = await db.reviews.aggregate(pipeline).to_list(1)
        
        if not result or result[0]["total_weight"] == 0:
            return 5.0  # Neutral for no reviews
        
        weighted_avg = result[0]["weighted_sum"] / result[0]["total_weight"]
        return (weighted_avg / 5.0) * 10.0
    
    @staticmethod
    async def _determine_verification_badge(
        db: AsyncIOMotorDatabase,
        acharya: Dict,
        completion_score: float
    ) -> str:
        """
        Determine verification badge level
        
        BASIC: Default (docs submitted)
        SAVITARA_VERIFIED: KYC approved + ID verified
        PREMIUM_VERIFIED: Background check + 50+ completed bookings + 4.5+ rating
        """
        kyc_status = acharya.get("kyc_status", "pending")
        
        # Auto-upgrade to PREMIUM if eligible
        completed_bookings = await db.bookings.count_documents({
            "acharya_id": str(acharya["_id"]),
            "status": "completed"
        })
        
        avg_rating_result = await db.reviews.aggregate([
            {MONGO_MATCH: {"acharya_id": str(acharya["_id"])}},
            {MONGO_GROUP: {"_id": None, "avg_rating": {"$avg": "$rating"}}}
        ]).to_list(1)
        
        avg_rating = avg_rating_result[0]["avg_rating"] if avg_rating_result else 0.0
        
        # Check for PREMIUM eligibility
        if (
            kyc_status == "verified"
            and completed_bookings >= 50
            and avg_rating >= 4.5
            and acharya.get("background_check_status") == "cleared"
        ):
            return "PREMIUM_VERIFIED"
        
        # Check for SAVITARA_VERIFIED eligibility
        if kyc_status == "verified":
            return "SAVITARA_VERIFIED"
        
        return "BASIC"
    
    @staticmethod
    async def process_service_guarantee(
        db: AsyncIOMotorDatabase,
        booking_id: str,
        guarantee_type: str,
        claim_reason: str
    ) -> RefundRequest:
        """
        Process service guarantee claim
        
        Auto-refund workflow:
        1. Validate claim eligibility
        2. Create guarantee record
        3. Trigger admin review
        4. If approved → initiate refund
        
        Guarantee Types:
        - QUALITY_GUARANTEE: Service not satisfactory
        - TIME_GUARANTEE: Acharya late/no-show
        - CANCELLATION_PROTECTION: Last-minute cancellation by Acharya
        """
        # Fetch booking
        booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
        if not booking:
            raise ResourceNotFoundError(f"Booking {booking_id} not found")
        
        # Check if already claimed
        existing = await db.service_guarantees.find_one({"booking_id": booking_id})
        if existing:
            raise ValidationError("Service guarantee already claimed for this booking")
        
        # Determine eligibility
        eligibility_criteria = {
            "booking_status": booking["status"],
            "booking_completed_at": booking.get("completed_at"),
            "claim_within_hours": 48,  # Must claim within 48h of completion
        }
        
        # Time check
        if booking.get("completed_at"):
            hours_since = (utcnow() - booking["completed_at"]).total_seconds() / 3600
            if hours_since > 48:
                raise ValidationError("Guarantee claim window expired (48 hours)")
        
        # Determine refund percentage
        refund_percentage = 100 if guarantee_type == "TIME_GUARANTEE" else 50
        
        # Create guarantee
        guarantee = RefundRequest(
            booking_id=booking_id,
            grihasta_id=str(booking["user_id"]),
            acharya_id=str(booking["acharya_id"]),
            guarantee_type=guarantee_type,
            claim_reason=claim_reason,
            eligibility_criteria=eligibility_criteria,
            refund_percentage=refund_percentage,
            status="PENDING",
            claimed_at=utcnow()
        )
        
        result = await db.service_guarantees.insert_one(
            guarantee.model_dump(by_alias=True, exclude={"id"})
        )
        guarantee.id = str(result.inserted_id)
        
        # TODO: Trigger admin notification
        # await notification_service.notify_admin_guarantee_claim(guarantee.id)
        
        return guarantee
    
    @staticmethod
    async def file_dispute(
        db: AsyncIOMotorDatabase,
        booking_id: str,
        filed_by_id: str,
        filed_by_role: str,
        category: str,
        description: str
    ) -> Dispute:
        """
        File a dispute
        
        Categories:
        - SERVICE_QUALITY
        - PAYMENT
        - CANCELLATION
        - HARASSMENT
        - OTHER
        """
        # Fetch booking
        booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
        if not booking:
            raise ResourceNotFoundError(f"Booking {booking_id} not found")
        
        # Determine respondent
        respondent_id = (
            str(booking["acharya_id"]) 
            if filed_by_role == "grihasta" 
            else str(booking["user_id"])
        )
        
        # Create dispute
        dispute = Dispute(
            booking_id=booking_id,
            filed_by_id=filed_by_id,
            filed_by_role=filed_by_role,
            respondent_id=respondent_id,
            dispute_category=category,
            description=description,
            status="FILED",
            filed_at=utcnow()
        )
        
        result = await db.dispute_resolutions.insert_one(
            dispute.model_dump(by_alias=True, exclude={"id"})
        )
        dispute.id = str(result.inserted_id)
        
        # TODO: Notify respondent
        
        return dispute
    
    @staticmethod
    async def generate_booking_checkpoint_otp(
        db: AsyncIOMotorDatabase,
        booking_id: str,
        checkpoint_type: str
    ) -> AttendanceCheckpoint:
        """
        Generate OTP for check-in/check-out
        
        OTP:
        - 6 digits
        - Valid for 5 minutes
        - Sent to Grihasta via SMS
        """
        import secrets
        
        # Generate 6-digit OTP
        otp_code = f"{secrets.randbelow(1000000):06d}"
        
        checkpoint = AttendanceCheckpoint(
            booking_id=booking_id,
            checkpoint_type=checkpoint_type,
            otp_code=otp_code,
            otp_expires_at=utcnow() + timedelta(minutes=5),
            created_at=utcnow()
        )
        
        result = await db.booking_checkpoints.insert_one(
            checkpoint.model_dump(by_alias=True, exclude={"id"})
        )
        checkpoint.id = str(result.inserted_id)
        
        # TODO: Send OTP via SMS
        # await sms_service.send_otp(grihasta_phone, otp_code)
        
        return checkpoint
    
    @staticmethod
    async def verify_checkpoint_otp(
        db: AsyncIOMotorDatabase,
        checkpoint_id: str,
        otp_code: str,
        location_coords: Optional[Dict[str, float]] = None
    ) -> AttendanceCheckpoint:
        """
        Verify OTP and complete checkpoint
        
        Validation:
        - OTP matches
        - OTP not expired
        - Location within 150m (if provided)
        """
        checkpoint = await db.booking_checkpoints.find_one({"_id": ObjectId(checkpoint_id)})
        if not checkpoint:
            raise ResourceNotFoundError("Checkpoint not found")
        
        # Check expiry
        if utcnow() > checkpoint["otp_expires_at"]:
            raise ValidationError("OTP expired")
        
        # Verify OTP
        if checkpoint["otp_code"] != otp_code:
            raise ValidationError("Invalid OTP")
        
        # Verify location (if provided)
        location_verified = False
        distance_m = None
        
        if location_coords:
            booking = await db.bookings.find_one({"_id": ObjectId(checkpoint["booking_id"])})
            if booking and booking.get("location"):
                from app.services.booking_service import haversine_distance
                distance_m = haversine_distance(
                    location_coords["latitude"],
                    location_coords["longitude"],
                    booking["location"]["coordinates"][1],
                    booking["location"]["coordinates"][0]
                )
                location_verified = distance_m <= 150
        
        # Update checkpoint
        await db.booking_checkpoints.update_one(
            {"_id": ObjectId(checkpoint_id)},
            {"$set": {
                "verified_at": utcnow(),
                "location_verified": location_verified,
                "distance_from_booking_location_m": distance_m
            }}
        )
        
        # Update checkpoint object
        checkpoint["verified_at"] = utcnow()
        checkpoint["location_verified"] = location_verified
        checkpoint["distance_from_booking_location_m"] = distance_m
        
        return AttendanceCheckpoint(**checkpoint)

