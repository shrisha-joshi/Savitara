"""
User Profile API Endpoints
Handles profile management, onboarding, and user info
SonarQube: S5122 - Input validation with Pydantic
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Dict, Any, Optional
import logging
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
from app.core.constants import MONGO_REGEX, MONGO_OPTIONS

from app.schemas.requests import (
    GrihastaOnboardingRequest,
    AcharyaOnboardingRequest,
    ProfileUpdateRequest,
    StandardResponse,
    AcharyaSearchParams,
)
from app.services.cache_service import cache
from app.core.security import (
    get_current_user,
    get_current_grihasta,
    get_current_acharya,
)
from app.core.exceptions import (
    ResourceNotFoundError,
    InvalidInputError,
    PermissionDeniedError,
)
from app.db.connection import get_db
from app.models.database import GrihastaProfile, AcharyaProfile, UserRole, UserStatus
from app.models.moderation import BlockedUser

# Error message constants
NO_FIELDS_TO_UPDATE = "No fields to update"

# MongoDB Constants
RATINGS_AVERAGE = "ratings.average"
MATCH_OP = "$match"

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/users", tags=["Users"])


@router.post(
    "/grihasta/onboarding",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Complete Grihasta Onboarding",
    description="Complete onboarding questionnaire for Grihasta users",
)
async def grihasta_onboarding(
    onboarding_data: GrihastaOnboardingRequest,
    current_user: Dict[str, Any] = Depends(get_current_grihasta),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Complete Grihasta onboarding

    Updates user status to ACTIVE after successful onboarding
    Applies referral credits if referral code provided
    """
    try:
        user_id = current_user["id"]
        user_oid = ObjectId(user_id)  # Convert to ObjectId for MongoDB queries
        logger.info(f"Starting grihasta onboarding for user_id: {user_id}")

        # Check if profile already exists
        existing_profile = await db.grihasta_profiles.find_one({"user_id": user_id})
        if existing_profile:
            raise InvalidInputError(
                message="Onboarding already completed", field="user_id"
            )

        # Handle referral code
        referral_credits = 0
        if onboarding_data.referral_code:
            referrer = await db.users.find_one(
                {"referral_code": onboarding_data.referral_code}
            )
            if referrer:
                # Grant credits to both referrer and new user
                referral_credits = 50
                await db.users.update_one(
                    {"_id": referrer["_id"]}, {"$inc": {"credits": 50}}
                )

                # Create referral record
                from app.models.database import Referral

                referral = Referral(
                    referrer_id=str(referrer["_id"]),
                    referred_id=user_id,
                    credits_earned=50,
                )
                await db.referrals.insert_one(referral.model_dump(by_alias=True))

                logger.info(f"Referral applied: {onboarding_data.referral_code}")

        # Create Grihasta profile
        profile = GrihastaProfile(
            user_id=user_id,
            name=onboarding_data.name,
            phone=onboarding_data.phone,
            location=onboarding_data.location,
            parampara=onboarding_data.parampara,
            preferences=onboarding_data.preferences or {},
        )

        # Exclude _id from dict so MongoDB can auto-generate it
        profile_dict = profile.model_dump(by_alias=True, exclude_none=True)
        result = await db.grihasta_profiles.insert_one(profile_dict)
        profile_id = result.inserted_id

        # Update user status to ACTIVE and add referral credits
        update_data = {
            "status": UserStatus.ACTIVE.value,
            "updated_at": datetime.now(timezone.utc),
            "preferred_language": onboarding_data.preferred_language,
            "terms_accepted_at": datetime.now(timezone.utc)
            if onboarding_data.terms_accepted
            else None,
            "privacy_accepted_at": datetime.now(timezone.utc)
            if onboarding_data.privacy_accepted
            else None,
        }

        if referral_credits > 0:
            await db.users.update_one(
                {"_id": user_oid},
                {"$set": update_data, "$inc": {"credits": referral_credits}},
            )
        else:
            await db.users.update_one({"_id": user_oid}, {"$set": update_data})

        logger.info(f"Grihasta onboarding completed for user {user_id}")

        # Get updated user data
        updated_user = await db.users.find_one({"_id": user_oid})

        return StandardResponse(
            success=True,
            data={
                "profile_id": str(profile_id),
                "status": UserStatus.ACTIVE.value,
                "credits_earned": referral_credits,
                "user": {
                    "id": str(updated_user["_id"]),
                    "email": updated_user["email"],
                    "role": updated_user["role"],
                    "status": updated_user["status"],
                    "credits": updated_user["credits"],
                    "onboarded": True,
                    "onboarding_completed": True,
                },
            },
            message="Onboarding completed successfully",
        )

    except InvalidInputError:
        raise
    except Exception as e:
        logger.error(f"Grihasta onboarding error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Onboarding failed: {str(e)}",
        )


@router.post(
    "/acharya/onboarding",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Complete Acharya Onboarding",
    description="Complete onboarding questionnaire for Acharya users (requires admin verification)",
)
async def acharya_onboarding(
    onboarding_data: AcharyaOnboardingRequest,
    current_user: Dict[str, Any] = Depends(get_current_acharya),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Complete Acharya onboarding

    Status remains PENDING until admin verification
    """
    try:
        user_id = current_user["id"]
        user_oid = ObjectId(user_id)  # Convert to ObjectId for MongoDB queries

        # Check if profile already exists
        existing_profile = await db.acharya_profiles.find_one({"user_id": user_id})
        if existing_profile:
            raise InvalidInputError(
                message="Onboarding already completed", field="user_id"
            )

        # Create Acharya profile
        profile = AcharyaProfile(
            user_id=user_id,
            name=onboarding_data.name,
            phone=onboarding_data.phone,
            parampara=onboarding_data.parampara,
            gotra=onboarding_data.gotra,
            experience_years=onboarding_data.experience_years,
            study_place=onboarding_data.study_place,
            specializations=onboarding_data.specializations,
            languages=onboarding_data.languages,
            location=onboarding_data.location,
            bio=onboarding_data.bio,
            rating=0.0,
            total_bookings=0,
            availability=[],
            poojas=[],
        )

        # Exclude _id from dict so MongoDB can auto-generate it
        profile_dict = profile.model_dump(by_alias=True, exclude_none=True)
        result = await db.acharya_profiles.insert_one(profile_dict)
        profile_id = result.inserted_id

        # Update user updated_at and terms acceptance
        await db.users.update_one(
            {"_id": user_oid},
            {
                "$set": {
                    "updated_at": datetime.now(timezone.utc),
                    "preferred_language": onboarding_data.preferred_language,
                    "terms_accepted_at": datetime.now(timezone.utc)
                    if onboarding_data.terms_accepted
                    else None,
                    "privacy_accepted_at": datetime.now(timezone.utc)
                    if onboarding_data.privacy_accepted
                    else None,
                    "acharya_agreement_accepted_at": datetime.now(timezone.utc)
                    if onboarding_data.acharya_agreement_accepted
                    else None,
                }
            },
        )

        # Send notification to admin for verification
        try:
            from app.services.notification_service import NotificationService

            notification_service = NotificationService()
            admin_users = await db.users.find({"role": UserRole.ADMIN.value}).to_list(
                None
            )
            admin_tokens = [
                u.get("fcm_token") for u in admin_users if u.get("fcm_token")
            ]
            if admin_tokens:
                notification_service.send_multicast(
                    tokens=admin_tokens,
                    title="New Acharya Verification Request",
                    body="User submitted profile for verification",
                    data={"type": "acharya_verification", "acharya_id": str(user_id)},
                )
        except Exception as e:
            logger.warning(f"Failed to send admin notification: {e}")

        logger.info(
            f"Acharya onboarding completed for user {user_id}, pending verification"
        )

        # Get updated user data
        updated_user = await db.users.find_one({"_id": user_oid})

        return StandardResponse(
            success=True,
            data={
                "profile_id": str(profile_id),
                "status": UserStatus.PENDING.value,
                "message": "Your profile is under review. You'll be notified once verified.",
                "user": {
                    "id": str(updated_user["_id"]),
                    "email": updated_user["email"],
                    "role": updated_user["role"],
                    "status": updated_user["status"],
                    "credits": updated_user["credits"],
                    # Profile exists, so onboarding is complete (even if pending verification)
                    "onboarded": True,
                    "onboarding_completed": True,
                },
            },
            message="Onboarding submitted for verification",
        )

    except InvalidInputError:
        raise
    except Exception as e:
        logger.error(f"Acharya onboarding error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Onboarding failed",
        )


@router.get(
    "/profile",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get User Profile",
    description="Get current user's complete profile",
)
async def get_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get complete user profile based on role"""
    try:
        user_id = current_user["id"]
        user_oid = ObjectId(user_id)  # Convert to ObjectId for MongoDB queries
        role = current_user["role"]

        # Get base user info
        user_doc = await db.users.find_one({"_id": user_oid})
        if not user_doc:
            raise ResourceNotFoundError(message="User not found", resource_id=user_id)

        user_data = {
            "id": str(user_doc["_id"]),
            "email": user_doc["email"],
            "role": user_doc["role"],
            "status": user_doc["status"],
            "credits": user_doc["credits"],
            "profile_picture": user_doc.get("profile_picture"),
            "referral_code": user_doc.get("referral_code"),
            "created_at": user_doc["created_at"],
        }

        # Get role-specific profile
        if role == UserRole.GRIHASTA.value:
            profile_doc = await db.grihasta_profiles.find_one({"user_id": user_id})
            if profile_doc:
                user_data["profile"] = {
                    "name": profile_doc.get("name"),
                    "phone": profile_doc.get("phone"),
                    "location": profile_doc.get("location"),
                    "parampara": profile_doc.get("parampara"),
                    "preferences": profile_doc.get("preferences", {}),
                }
            # Add onboarding status based on whether profile exists
            user_data["onboarded"] = profile_doc is not None
            user_data["onboarding_completed"] = profile_doc is not None

        elif role == UserRole.ACHARYA.value:
            profile_doc = await db.acharya_profiles.find_one({"user_id": user_id})
            if profile_doc:
                user_data["profile"] = {
                    "name": profile_doc.get("name"),
                    "phone": profile_doc.get("phone"),
                    "parampara": profile_doc.get("parampara"),
                    "gotra": profile_doc.get("gotra"),
                    "experience_years": profile_doc.get("experience_years"),
                    "study_place": profile_doc.get("study_place"),
                    "specializations": profile_doc.get("specializations", []),
                    "languages": profile_doc.get("languages", []),
                    "location": profile_doc.get("location"),
                    "bio": profile_doc.get("bio"),
                    "rating": profile_doc.get("rating", 0.0),
                    "total_bookings": profile_doc.get("total_bookings", 0),
                    "verification_status": user_doc.get("status"),
                }
            # Add onboarding status based on whether profile exists
            user_data["onboarded"] = profile_doc is not None
            user_data["onboarding_completed"] = profile_doc is not None

        else:
            # Admin users don't need onboarding
            user_data["onboarded"] = True
            user_data["onboarding_completed"] = True

        return StandardResponse(success=True, data=user_data)

    except ResourceNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Get profile error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch profile",
        )


@router.put(
    "/me",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Profile",
    description="Update user profile information",
)
@router.put(
    "/profile",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Profile",
    description="Update user profile information",
)
async def update_profile(
    update_data: ProfileUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Update user profile"""
    try:
        user_id = current_user["id"]
        role = current_user["role"]

        # Build update dict (only non-None fields)
        update_fields = dict(update_data.model_dump(exclude_none=True))

        if not update_fields:
            raise InvalidInputError(message=NO_FIELDS_TO_UPDATE, field="body")

        update_fields["updated_at"] = datetime.now(timezone.utc)

        # Update appropriate profile collection
        if role == UserRole.GRIHASTA.value:
            result = await db.grihasta_profiles.update_one(
                {"user_id": user_id}, {"$set": update_fields}
            )
        elif role == UserRole.ACHARYA.value:
            result = await db.acharya_profiles.update_one(
                {"user_id": user_id}, {"$set": update_fields}
            )
        else:
            raise PermissionDeniedError(action="Update profile")

        if result.matched_count == 0:
            raise ResourceNotFoundError(
                message="Profile not found", resource_id=user_id
            )

        logger.info(f"Profile updated for user {user_id}")

        return StandardResponse(success=True, message="Profile updated successfully")

    except (InvalidInputError, ResourceNotFoundError, PermissionDeniedError):
        raise
    except Exception as e:
        logger.error(f"Update profile error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile",
        )


@router.put(
    "/grihasta/profile",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Grihasta Profile",
    description="Update Grihasta profile information",
)
async def update_grihasta_profile(
    update_data: ProfileUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_grihasta),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Update Grihasta profile with specific validation"""
    try:
        user_id = current_user["id"]

        # Build update dict (only non-None fields)
        update_fields = dict(update_data.model_dump(exclude_none=True))

        if not update_fields:
            raise InvalidInputError(message=NO_FIELDS_TO_UPDATE, field="body")

        update_fields["updated_at"] = datetime.now(timezone.utc)

        # Update grihasta profile
        result = await db.grihasta_profiles.update_one(
            {"user_id": user_id}, {"$set": update_fields}
        )

        if result.matched_count == 0:
            raise ResourceNotFoundError(
                message="Grihasta profile not found", resource_id=user_id
            )

        logger.info(f"Grihasta profile updated for user {user_id}")

        return StandardResponse(
            success=True, message="Grihasta profile updated successfully"
        )

    except (InvalidInputError, ResourceNotFoundError):
        raise
    except Exception as e:
        logger.error(f"Update grihasta profile error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update grihasta profile",
        )

# ==================== Block/Unblock User Endpoints ====================


@router.post(
    "/block",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Block User",
    description="Block another user from contacting you",
)
async def block_user(
    blocked_user_id: str,
    reason: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Block a user"""
    try:
        blocker_id = str(current_user.get("_id") or current_user.get("id"))

        # Validate blocked user exists
        try:
            blocked_oid = ObjectId(blocked_user_id)
        except (ValueError, TypeError) as e:
            raise InvalidInputError(
                message="Invalid user ID format", field="blocked_user_id"
            ) from e

        blocked_user = await db.users.find_one({"_id": blocked_oid})
        if not blocked_user:
            raise ResourceNotFoundError(
                resource_type="User", resource_id=blocked_user_id
            )

        # Can't block yourself
        if blocker_id == blocked_user_id:
            raise InvalidInputError(
                message="Cannot block yourself", field="blocked_user_id"
            )

        # Check if already blocked
        existing_block = await db.blocked_users.find_one(
            {"blocker_id": blocker_id, "blocked_user_id": blocked_user_id}
        )

        if existing_block:
            return StandardResponse(
                success=True, message="User already blocked", data={"already_blocked": True}
            )

        # Check if mutual block
        reverse_block = await db.blocked_users.find_one(
            {"blocker_id": blocked_user_id, "blocked_user_id": blocker_id}
        )

        is_mutual = reverse_block is not None

        # Create block
        block = BlockedUser(
            blocker_id=blocker_id,
            blocked_user_id=blocked_user_id,
            reason=reason,
            is_mutual=is_mutual,
        )

        block_dict = block.model_dump(by_alias=True, exclude={"id"})
        await db.blocked_users.insert_one(block_dict)

        # Update mutual flag on reverse block if exists
        if is_mutual:
            await db.blocked_users.update_one(
                {"blocker_id": blocked_user_id, "blocked_user_id": blocker_id},
                {"$set": {"is_mutual": True}},
            )

        logger.info(f"User {blocker_id} blocked user {blocked_user_id}")

        return StandardResponse(success=True, message="User blocked successfully")

    except (ResourceNotFoundError, InvalidInputError):
        raise
    except Exception as e:
        logger.error(f"Block user error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to block user",
        )


@router.post(
    "/unblock",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Unblock User",
    description="Unblock a previously blocked user",
)
async def unblock_user(
    blocked_user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Unblock a user"""
    try:
        blocker_id = str(current_user.get("_id") or current_user.get("id"))

        # Delete block
        result = await db.blocked_users.delete_one(
            {"blocker_id": blocker_id, "blocked_user_id": blocked_user_id}
        )

        if result.deleted_count == 0:
            return StandardResponse(
                success=True, message="User was not blocked", data={"was_blocked": False}
            )

        # Update mutual flag on reverse block if exists
        reverse_block = await db.blocked_users.find_one(
            {"blocker_id": blocked_user_id, "blocked_user_id": blocker_id}
        )

        if reverse_block:
            await db.blocked_users.update_one(
                {"blocker_id": blocked_user_id, "blocked_user_id": blocker_id},
                {"$set": {"is_mutual": False}},
            )

        logger.info(f"User {blocker_id} unblocked user {blocked_user_id}")

        return StandardResponse(success=True, message="User unblocked successfully")

    except Exception as e:
        logger.error(f"Unblock user error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to unblock user",
        )


@router.get(
    "/blocked",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Blocked Users",
    description="Get list of users you have blocked",
)
async def get_blocked_users(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get list of blocked users"""
    try:
        blocker_id = str(current_user.get("_id") or current_user.get("id"))

        # Get blocked users with their details
        pipeline = [
            {MATCH_OP: {"blocker_id": blocker_id}},
            {
                "$lookup": {
                    "from": "users",
                    "let": {"blocked_id": {"$toObjectId": "$blocked_user_id"}},
                    "pipeline": [
                        {"$match": {"$expr": {"$eq": ["$_id", "$$blocked_id"]}}},
                        {"$project": {"email": 1, "role": 1, "status": 1}},
                    ],
                    "as": "blocked_user",
                }
            },
            {"$unwind": {"path": "$blocked_user", "preserveNullAndEmptyArrays": True}},
            {"$sort": {"created_at": -1}},
        ]

        blocked_list = await db.blocked_users.aggregate(pipeline).to_list(None)

        # Serialize ObjectIds
        for item in blocked_list:
            if "_id" in item:
                item["_id"] = str(item["_id"])
            if "blocked_user" in item and "_id" in item["blocked_user"]:
                item["blocked_user"]["_id"] = str(item["blocked_user"]["_id"])

        return StandardResponse(
            success=True, data={"blocked_users": blocked_list, "count": len(blocked_list)}
        )

    except Exception as e:
        logger.error(f"Get blocked users error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch blocked users",
        )

@router.put(
    "/acharya/profile",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Acharya Profile",
    description="Update Acharya profile information",
)
async def update_acharya_profile(
    update_data: ProfileUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_acharya),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Update Acharya profile with specific validation"""
    try:
        user_id = current_user["id"]

        # Build update dict (only non-None fields)
        update_fields = dict(update_data.model_dump(exclude_none=True))

        if not update_fields:
            raise InvalidInputError(message=NO_FIELDS_TO_UPDATE, field="body")

        update_fields["updated_at"] = datetime.now(timezone.utc)

        # Update acharya profile
        result = await db.acharya_profiles.update_one(
            {"user_id": user_id}, {"$set": update_fields}
        )

        if result.matched_count == 0:
            raise ResourceNotFoundError(
                message="Acharya profile not found", resource_id=user_id
            )

        logger.info(f"Acharya profile updated for user {user_id}")

        return StandardResponse(
            success=True, message="Acharya profile updated successfully"
        )

    except (InvalidInputError, ResourceNotFoundError):
        raise
    except Exception as e:
        logger.error(f"Update acharya profile error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update acharya profile",
        )


# Helper functions for search to reduce cognitive complexity
async def _search_with_elasticsearch(
    search_service, params: AcharyaSearchParams
) -> StandardResponse:
    """Execute Elasticsearch search and return formatted response"""
    # Prepare location dict if latitude and longitude are provided
    location = None
    if params.latitude is not None and params.longitude is not None:
        location = {
            "lat": params.latitude,
            "lon": params.longitude,
            "distance": "50km",  # Default search radius
        }

    result = await search_service.search_acharyas(
        query=params.query or "",
        filters=params.get_filter_dict(),
        location=location,
        sort_by=params.sort_by,
        page=params.page,
        limit=params.limit,
    )

    # Check if search returned an error (ES connection failure)
    if result.get("error"):
        raise ConnectionError(f"Elasticsearch search failed: {result['error']}")

    # search_service returns 'results' key, not 'hits'
    acharyas_list = result.get("results", result.get("hits", []))
    pagination_data = result.get("pagination", {})
    total = pagination_data.get("total", 0)

    return StandardResponse(
        success=True,
        data={
            "acharyas": acharyas_list,
            "pagination": {
                "page": params.page,
                "limit": params.limit,
                "total": total,
                "pages": (total + params.limit - 1) // params.limit,
            },
            "search_metadata": {
                "query": params.query,
                "took_ms": result.get("took_ms"),
                "max_score": result.get("max_score"),
            },
        },
    )


def _build_mongodb_query_filter(params: AcharyaSearchParams) -> dict:
    """Build MongoDB query filter from search parameters"""
    query_filter = {RATINGS_AVERAGE: {"$gte": params.min_rating}}

    if params.city:
        query_filter["location.city"] = {MONGO_REGEX: params.city, MONGO_OPTIONS: "i"}
    if params.state:
        query_filter["location.state"] = {MONGO_REGEX: params.state, MONGO_OPTIONS: "i"}
    if params.specialization:
        query_filter["specializations"] = {
            MONGO_REGEX: params.specialization,
            MONGO_OPTIONS: "i",
        }
    if params.language:
        query_filter["languages"] = {MONGO_REGEX: params.language, MONGO_OPTIONS: "i"}

    return query_filter


async def _search_with_mongodb(
    db: AsyncIOMotorDatabase, params: AcharyaSearchParams
) -> StandardResponse:
    """Execute MongoDB search and return formatted response"""
    # Build query filter without ratings check since MongoDB Atlas may have issues
    query_filter = {}

    # Add other filters if provided
    if params.city:
        query_filter["location.city"] = {MONGO_REGEX: params.city, MONGO_OPTIONS: "i"}
    if params.state:
        query_filter["location.state"] = {MONGO_REGEX: params.state, MONGO_OPTIONS: "i"}
    if params.specialization:
        query_filter["specializations"] = {
            MONGO_REGEX: params.specialization,
            MONGO_OPTIONS: "i",
        }
    if params.language:
        query_filter["languages"] = {MONGO_REGEX: params.language, MONGO_OPTIONS: "i"}

    # Apply rating filter after initial match if needed
    logger.info(f"MongoDB search query_filter: {query_filter}")

    pipeline = [
        {MATCH_OP: query_filter},
        # Convert string user_id to ObjectId for lookup
        {"$addFields": {"user_id_obj": {"$toObjectId": "$user_id"}}},
        {
            "$lookup": {
                "from": "users",
                "localField": "user_id_obj",  # Use converted ObjectId
                "foreignField": "_id",
                "as": "user",
            }
        },
        {"$unwind": "$user"},
        {MATCH_OP: {"user.status": UserStatus.ACTIVE.value}},
        # Apply rating filter after lookup
        {MATCH_OP: {RATINGS_AVERAGE: {"$gte": params.min_rating}}},
        {
            "$project": {
                "_id": 1,
                "user_id": 1,
                "name": 1,
                "parampara": 1,
                "experience_years": 1,
                "specializations": 1,
                "languages": 1,
                "location": 1,
                "bio": 1,
                "ratings": 1,
                "total_bookings": 1,
                "profile_picture": "$user.profile_picture",
            }
        },
        {"$sort": {RATINGS_AVERAGE: -1, "total_bookings": -1}},
        {"$skip": (params.page - 1) * params.limit},
        {"$limit": params.limit},
    ]

    acharyas = await db.acharya_profiles.aggregate(pipeline).to_list(
        length=params.limit
    )

    logger.info(f"MongoDB aggregation returned {len(acharyas)} results")

    # Convert ObjectId fields to strings for JSON serialization
    for acharya in acharyas:
        if "_id" in acharya:
            acharya["_id"] = str(acharya["_id"])
        if "user_id" in acharya and isinstance(acharya["user_id"], ObjectId):
            acharya["user_id"] = str(acharya["user_id"])

    # Get total count
    count_pipeline = pipeline[:6]  # Up to and including rating filter
    total_count = len(
        await db.acharya_profiles.aggregate(count_pipeline).to_list(length=None)
    )

    return StandardResponse(
        success=True,
        data={
            "acharyas": acharyas,
            "pagination": {
                "page": params.page,
                "limit": params.limit,
                "total": total_count,
                "pages": (total_count + params.limit - 1) // params.limit,
            },
        },
    )


@router.get(
    "/acharyas",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Search Acharyas",
    description="Search and filter Acharyas by location, specialization, language, etc.",
)
async def search_acharyas(
    params: AcharyaSearchParams = Depends(),
    db: AsyncIOMotorDatabase = Depends(get_db),
    request: Request = None,
):
    """
    Search Acharyas with advanced filters

    Supports:
    - Full-text search with Elasticsearch (when use_elasticsearch=true)
    - Geospatial proximity search (requires latitude/longitude)
    - Multiple filters: city, state, specialization, language, rating, price
    - Flexible sorting options

    Returns only verified (ACTIVE) Acharyas
    """
    try:
        # Try Cache First
        cache_key = params.get_cache_key()
        cached_result = await cache.get(cache_key)
        if cached_result:
            return cached_result

        # Check if search service is available
        has_search_service = False
        if request is not None:
            try:
                app_instance = getattr(request, "app", None)
                if app_instance and hasattr(app_instance, "search_service"):
                    has_search_service = True
            except AttributeError:
                # Request object doesn't have expected attributes
                pass

        # Use Elasticsearch if enabled and available, with MongoDB fallback
        response = None
        if params.use_elasticsearch and has_search_service:
            try:
                from app.services.search_service import SearchService

                search_service: SearchService = request.app.search_service
                response = await _search_with_elasticsearch(search_service, params)
            except Exception as es_error:
                logger.warning(
                    f"Elasticsearch search failed, falling back to MongoDB: {es_error}"
                )
                response = None

        if response is None:
            # Fallback to MongoDB search
            response = await _search_with_mongodb(db, params)

        # Cache Result
        await cache.set(cache_key, response.model_dump(), expire=300)
        return response

    except Exception as e:
        logger.error(f"Search Acharyas error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Search failed"
        )


@router.get(
    "/acharyas/{acharya_id}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Acharya Details",
    description="Get detailed information about a specific Acharya",
)
async def get_acharya_details(
    acharya_id: str, db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get Acharya public profile with reviews and poojas"""
    try:
        # Convert ID to ObjectId for MongoDB query
        try:
            acharya_oid = ObjectId(acharya_id)
        except (ValueError, TypeError, InvalidId):
            # If exact string match fails, maybe it IS a string ID (rare but possible) or invalid
            acharya_oid = acharya_id

        # Try to find by multiple criteria:
        # 1. user_id string (legacy/standard)
        # 2. _id (ObjectId) - Profile ID passed instead of user_id

        criteria = [{"user_id": str(acharya_oid)}, {"user_id": acharya_id}]

        # If it's a valid ObjectId, try finding by _id as well
        if isinstance(acharya_oid, ObjectId):
            criteria.append({"_id": acharya_oid})

        # Get Acharya profile by criteria
        profile_doc = await db.acharya_profiles.find_one({"$or": criteria})

        if not profile_doc:
            raise ResourceNotFoundError(
                message="Acharya not found", resource_id=acharya_id
            )

        # Check if Acharya is active
        # Ensure user_id is handled correctly (it is stored as string in profile, but ObjectId in user)
        user_identifier = profile_doc["user_id"]
        try:
            user_oid = ObjectId(user_identifier)
        except (ValueError, TypeError):
            user_oid = user_identifier

        user_doc = await db.users.find_one({"_id": user_oid})
        if not user_doc or user_doc.get("status") != UserStatus.ACTIVE.value:
            raise ResourceNotFoundError(
                message="Acharya not found or inactive", resource_id=acharya_id
            )

        # Get public reviews
        reviews = (
            await db.reviews.find({"acharya_id": acharya_id, "is_public": True})
            .sort("created_at", -1)
            .limit(10)
            .to_list(length=10)
        )

        # Get poojas offered
        poojas = await db.poojas.find(
            {"acharya_id": acharya_id, "is_active": True}
        ).to_list(length=None)

        return StandardResponse(
            success=True,
            data={
                "profile": {
                    "id": str(profile_doc["_id"]),
                    "name": profile_doc["name"],
                    "parampara": profile_doc["parampara"],
                    "experience_years": profile_doc["experience_years"],
                    "specializations": profile_doc["specializations"],
                    "languages": profile_doc.get("languages", []),
                    "location": profile_doc.get("location", {}),
                    "bio": profile_doc.get("bio", ""),
                    "rating": profile_doc.get("ratings", {}).get("average", 0),
                    "total_bookings": profile_doc.get("total_bookings", 0),
                    "profile_picture": user_doc.get("profile_picture"),
                },
                "reviews": reviews,
                "poojas": poojas,
            },
        )

    except ResourceNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Get Acharya details error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch Acharya details: {str(e)}",
        )


# Alias /me to /profile for compatibility with tests and standard expectation
@router.get("/me", include_in_schema=False)
async def get_me(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Get current user profile (Alias for /profile)
    """
    return await get_profile(current_user, db)


# Alias /grihasta/profile to /grihasta/onboarding
@router.post("/grihasta/profile", include_in_schema=False)
async def create_grihasta_profile_alias(
    onboarding_data: GrihastaOnboardingRequest,
    current_user: Dict[str, Any] = Depends(get_current_grihasta),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    return await grihasta_onboarding(onboarding_data, current_user, db)


# Alias /acharya/profile to /acharya/onboarding
@router.post("/acharya/profile", include_in_schema=False)
async def create_acharya_profile_alias(
    onboarding_data: AcharyaOnboardingRequest,
    current_user: Dict[str, Any] = Depends(get_current_acharya),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    return await acharya_onboarding(onboarding_data, current_user, db)


# Alias /search to /acharyas
@router.get("/search", include_in_schema=False)
async def search_users_alias(
    params: AcharyaSearchParams = Depends(), db: AsyncIOMotorDatabase = Depends(get_db)
):
    return await search_acharyas(params=params, db=db)
