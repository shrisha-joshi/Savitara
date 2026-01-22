"""
User Profile API Endpoints
Handles profile management, onboarding, and user info
SonarQube: S5122 - Input validation with Pydantic
"""
from dataclasses import dataclass
from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime, timezone
from app.core.constants import MONGO_REGEX, MONGO_OPTIONS

from app.schemas.requests import (
    GrihastaOnboardingRequest,
    AcharyaOnboardingRequest,
    ProfileUpdateRequest,
    StandardResponse
)
from app.services.cache_service import cache
from app.core.security import (
    get_current_user,
    get_current_grihasta,
    get_current_acharya
)
from app.core.exceptions import (
    ResourceNotFoundError,
    InvalidInputError,
    PermissionDeniedError
)
from app.db.connection import get_db
from app.models.database import (
    User,
    GrihastaProfile,
    AcharyaProfile,
    UserRole,
    UserStatus
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/users", tags=["Users"])


@dataclass
class AcharyaSearchFilters:
    """Search filters for acharya search to reduce parameter count"""
    query: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    specialization: Optional[str] = None
    language: Optional[str] = None
    min_rating: float = 0.0
    max_price: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    use_elasticsearch: bool = True
    sort_by: str = "relevance"
    page: int = 1
    limit: int = 20


@router.post(
    "/grihasta/onboarding",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Complete Grihasta Onboarding",
    description="Complete onboarding questionnaire for Grihasta users"
)
async def grihasta_onboarding(
    onboarding_data: GrihastaOnboardingRequest,
    current_user: Dict[str, Any] = Depends(get_current_grihasta),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Complete Grihasta onboarding
    
    Updates user status to ACTIVE after successful onboarding
    Applies referral credits if referral code provided
    """
    try:
        user_id = current_user["id"]
        
        # Check if profile already exists
        existing_profile = await db.grihasta_profiles.find_one({"user_id": user_id})
        if existing_profile:
            raise InvalidInputError(
                message="Onboarding already completed",
                field="user_id"
            )
        
        # Handle referral code
        referral_credits = 0
        if onboarding_data.referral_code:
            referrer = await db.users.find_one({"referral_code": onboarding_data.referral_code})
            if referrer:
                # Grant credits to both referrer and new user
                referral_credits = 50
                await db.users.update_one(
                    {"_id": referrer["_id"]},
                    {"$inc": {"credits": 50}}
                )
                
                # Create referral record
                from app.models.database import Referral
                referral = Referral(
                    referrer_id=str(referrer["_id"]),
                    referred_id=user_id,
                    credits_earned=50
                )
                await db.referrals.insert_one(referral.dict(by_alias=True))
                
                logger.info(f"Referral applied: {onboarding_data.referral_code}")
        
        # Create Grihasta profile
        profile = GrihastaProfile(
            user_id=user_id,
            name=onboarding_data.name,
            phone=onboarding_data.phone,
            location=onboarding_data.location,
            parampara=onboarding_data.parampara,
            preferences=onboarding_data.preferences or {}
        )
        
        await db.grihasta_profiles.insert_one(profile.dict(by_alias=True))
        
        # Update user status to ACTIVE, set onboarded=True, and add referral credits
        update_data = {
            "status": UserStatus.ACTIVE.value,
            "onboarded": True,
            "updated_at": datetime.now(timezone.utc)
        }
        
        update_operations = {"$set": update_data}
        if referral_credits > 0:
            update_operations["$inc"] = {"credits": referral_credits}
        
        await db.users.update_one(
            {"_id": user_id},
            update_operations
        )
        
        logger.info(f"Grihasta onboarding completed for user {user_id}")
        
        # Get updated user data
        updated_user = await db.users.find_one({"_id": user_id})
        
        return StandardResponse(
            success=True,
            data={
                "profile_id": str(profile.id),
                "status": UserStatus.ACTIVE.value,
                "credits_earned": referral_credits,
                "user": {
                    "id": str(updated_user["_id"]),
                    "email": updated_user["email"],
                    "role": updated_user["role"],
                    "status": updated_user["status"],
                    "credits": updated_user["credits"],
                    "onboarded": True
                }
            },
            message="Onboarding completed successfully"
        )
        
    except InvalidInputError:
        raise
    except Exception as e:
        logger.error(f"Grihasta onboarding error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Onboarding failed"
        )


@router.post(
    "/acharya/onboarding",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Complete Acharya Onboarding",
    description="Complete onboarding questionnaire for Acharya users (requires admin verification)"
)
async def acharya_onboarding(
    onboarding_data: AcharyaOnboardingRequest,
    current_user: Dict[str, Any] = Depends(get_current_acharya),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Complete Acharya onboarding
    
    Status remains PENDING until admin verification
    """
    try:
        user_id = current_user["id"]
        
        # Check if profile already exists
        existing_profile = await db.acharya_profiles.find_one({"user_id": user_id})
        if existing_profile:
            raise InvalidInputError(
                message="Onboarding already completed",
                field="user_id"
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
            availability={},
            poojas=[]
        )
        
        await db.acharya_profiles.insert_one(profile.dict(by_alias=True))
        
        # Update user - set onboarded=True, Acharya remains PENDING until admin verification
        await db.users.update_one(
            {"_id": user_id},
            {"$set": {
                "onboarded": True,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        # Send notification to admin for verification
        try:
            from app.services.notification_service import NotificationService
            notification_service = NotificationService()
            admin_users = await db.users.find({"role": UserRole.ADMIN.value}).to_list(None)
            admin_tokens = [u.get("fcm_token") for u in admin_users if u.get("fcm_token")]
            if admin_tokens:
                await notification_service.send_multicast(
                    tokens=admin_tokens,
                    title="New Acharya Verification Request",
                    body=f"{current_user['full_name']} submitted profile for verification",
                    data={"type": "acharya_verification", "acharya_id": str(user_id)}
                )
        except Exception as e:
            logger.warning(f"Failed to send admin notification: {e}")
        
        logger.info(f"Acharya onboarding completed for user {user_id}, pending verification")
        
        # Get updated user data
        updated_user = await db.users.find_one({"_id": user_id})
        
        return StandardResponse(
            success=True,
            data={
                "profile_id": str(profile.id),
                "status": UserStatus.PENDING.value,
                "message": "Your profile is under review. You'll be notified once verified.",
                "user": {
                    "id": str(updated_user["_id"]),
                    "email": updated_user["email"],
                    "role": updated_user["role"],
                    "status": updated_user["status"],
                    "credits": updated_user["credits"],
                    "onboarded": updated_user["status"] in [UserStatus.ACTIVE.value, UserStatus.VERIFIED.value]
                }
            },
            message="Onboarding submitted for verification"
        )
        
    except InvalidInputError:
        raise
    except Exception as e:
        logger.error(f"Acharya onboarding error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Onboarding failed"
        )


@router.get(
    "/profile",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get User Profile",
    description="Get current user's complete profile"
)
async def get_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get complete user profile based on role"""
    try:
        user_id = current_user["id"]
        role = current_user["role"]
        
        # Get base user info
        user_doc = await db.users.find_one({"_id": user_id})
        if not user_doc:
            raise ResourceNotFoundError(resource_type="User", resource_id=user_id)
        
        user_data = {
            "id": str(user_doc["_id"]),
            "email": user_doc["email"],
            "role": user_doc["role"],
            "status": user_doc["status"],
            "credits": user_doc["credits"],
            "profile_picture": user_doc.get("profile_picture"),
            "referral_code": user_doc.get("referral_code"),
            "created_at": user_doc["created_at"]
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
                    "preferences": profile_doc.get("preferences", {})
                }
        
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
                    "verification_status": user_doc.get("status")
                }
        
        return StandardResponse(
            success=True,
            data=user_data
        )
        
    except ResourceNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Get profile error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch profile"
        )


@router.put(
    "/profile",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Profile",
    description="Update user profile information"
)
async def update_profile(
    update_data: ProfileUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Update user profile"""
    try:
        user_id = current_user["id"]
        role = current_user["role"]
        
        # Build update dict (only non-None fields)
        update_fields = dict(update_data.dict(exclude_none=True))
        
        if not update_fields:
            raise InvalidInputError(
                message="No fields to update",
                field="body"
            )
        
        update_fields["updated_at"] = datetime.now(timezone.utc)
        
        # Update appropriate profile collection
        if role == UserRole.GRIHASTA.value:
            result = await db.grihasta_profiles.update_one(
                {"user_id": user_id},
                {"$set": update_fields}
            )
        elif role == UserRole.ACHARYA.value:
            result = await db.acharya_profiles.update_one(
                {"user_id": user_id},
                {"$set": update_fields}
            )
        else:
            raise PermissionDeniedError(action="Update profile")
        
        if result.matched_count == 0:
            raise ResourceNotFoundError(resource_type="Profile", resource_id=user_id)
        
        logger.info(f"Profile updated for user {user_id}")
        
        return StandardResponse(
            success=True,
            message="Profile updated successfully"
        )
        
    except (InvalidInputError, ResourceNotFoundError, PermissionDeniedError):
        raise
    except Exception as e:
        logger.error(f"Update profile error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile"
        )


@router.get(
    "/acharyas",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Search Acharyas",
    description="Search and filter Acharyas by location, specialization, language, etc."
)
async def search_acharyas(
    filters: AcharyaSearchFilters = Depends(),
    db: AsyncIOMotorDatabase = Depends(get_db)
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
        cache_key = (
            f"search:{filters.query}:{filters.city}:{filters.state}:"
            f"{filters.specialization}:{filters.language}:{filters.min_rating}:"
            f"{filters.max_price}:{filters.latitude}:{filters.longitude}:"
            f"{filters.sort_by}:{filters.page}:{filters.limit}"
        )
        cached_result = await cache.get(cache_key)
        if cached_result:
            return cached_result

        # Use Elasticsearch if enabled and search service is available
        if filters.use_elasticsearch and hasattr(db.app, 'search_service'):
            from app.services.search_service import SearchService
            search_service: SearchService = db.app.search_service
            
            search_filters = {
                "city": filters.city,
                "state": filters.state,
                "specialization": filters.specialization,
                "language": filters.language,
                "min_rating": filters.min_rating,
                "max_price": filters.max_price
            }
            
            result = await search_service.search_acharyas(
                query=filters.query or "",
                filters=search_filters,
                latitude=filters.latitude,
                longitude=filters.longitude,
                sort_by=filters.sort_by,
                page=filters.page,
                limit=filters.limit
            )
            
            response = StandardResponse(
                success=True,
                data={
                    "acharyas": result["hits"],
                    "pagination": {
                        "page": filters.page,
                        "limit": filters.limit,
                        "total": result["total"],
                        "pages": (result["total"] + filters.limit - 1) // filters.limit
                    },
                    "search_metadata": {
                        "query": filters.query,
                        "took_ms": result.get("took_ms"),
                        "max_score": result.get("max_score")
                    }
                }
            )
            
            # Cache Result
            await cache.set(cache_key, response.dict(), expire=300)
            return response

        # Fallback to MongoDB search
        # Build query filter
        query_filter = {"rating": {"$gte": filters.min_rating}}
        
        if filters.city:
            query_filter["location.city"] = {MONGO_REGEX: filters.city, MONGO_OPTIONS: "i"}
        if filters.state:
            query_filter["location.state"] = {MONGO_REGEX: filters.state, MONGO_OPTIONS: "i"}
        if filters.specialization:
            query_filter["specializations"] = {MONGO_REGEX: filters.specialization, MONGO_OPTIONS: "i"}
        if filters.language:
            query_filter["languages"] = {MONGO_REGEX: filters.language, MONGO_OPTIONS: "i"}
        
        # Get only ACTIVE acharyas
        # Join with users collection to check status
        pipeline = [
            {"$match": query_filter},
            {
                "$lookup": {
                    "from": "users",
                    "localField": "user_id",
                    "foreignField": "_id",
                    "as": "user"
                }
            },
            {"$unwind": "$user"},
            {"$match": {"user.status": UserStatus.ACTIVE.value}},
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
                    "rating": 1,
                    "total_bookings": 1,
                    "profile_picture": "$user.profile_picture"
                }
            },
            {"$sort": {"rating": -1, "total_bookings": -1}},
            {"$skip": (filters.page - 1) * filters.limit},
            {"$limit": filters.limit}
        ]
        
        acharyas = await db.acharya_profiles.aggregate(pipeline).to_list(length=filters.limit)
        
        # Get total count
        count_pipeline = pipeline[:4]  # Up to status filter
        total_count = len(await db.acharya_profiles.aggregate(count_pipeline).to_list(length=None))
        
        response = StandardResponse(
            success=True,
            data={
                "acharyas": acharyas,
                "pagination": {
                    "page": filters.page,
                    "limit": filters.limit,
                    "total": total_count,
                    "pages": (total_count + filters.limit - 1) // filters.limit
                }
            }
        )
        
        # Cache Result
        await cache.set(cache_key, response.dict(), expire=300)
        
        return response
        
    except Exception as e:
        logger.error(f"Search Acharyas error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Search failed"
        )


@router.get(
    "/acharyas/{acharya_id}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Acharya Details",
    description="Get detailed information about a specific Acharya"
)
async def get_acharya_details(
    acharya_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get Acharya public profile with reviews and poojas"""
    try:
        # Get Acharya profile
        profile_doc = await db.acharya_profiles.find_one({"_id": acharya_id})
        if not profile_doc:
            raise ResourceNotFoundError(resource_type="Acharya", resource_id=acharya_id)
        
        # Check if Acharya is active
        user_doc = await db.users.find_one({"_id": profile_doc["user_id"]})
        if not user_doc or user_doc["status"] != UserStatus.ACTIVE.value:
            raise ResourceNotFoundError(resource_type="Acharya", resource_id=acharya_id)
        
        # Get public reviews
        reviews = await db.reviews.find({
            "acharya_id": acharya_id,
            "is_public": True
        }).sort("created_at", -1).limit(10).to_list(length=10)
        
        # Get poojas offered
        poojas = await db.poojas.find({
            "acharya_id": acharya_id,
            "is_active": True
        }).to_list(length=None)
        
        return StandardResponse(
            success=True,
            data={
                "profile": {
                    "id": str(profile_doc["_id"]),
                    "name": profile_doc["name"],
                    "parampara": profile_doc["parampara"],
                    "experience_years": profile_doc["experience_years"],
                    "specializations": profile_doc["specializations"],
                    "languages": profile_doc["languages"],
                    "location": profile_doc["location"],
                    "bio": profile_doc.get("bio"),
                    "rating": profile_doc["rating"],
                    "total_bookings": profile_doc["total_bookings"],
                    "profile_picture": user_doc.get("profile_picture")
                },
                "reviews": reviews,
                "poojas": poojas
            }
        )
        
    except ResourceNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Get Acharya details error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch Acharya details"
        )
