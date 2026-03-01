"""
Admin API Endpoints
Handles admin operations: Acharya verification, review moderation, analytics, user management
SonarQube: S5122 - Proper authorization checks
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Annotated, Dict, Any, Optional
import logging
import re
from datetime import datetime, timedelta, timezone
from bson import ObjectId

from app.schemas.requests import (
    AcharyaVerificationRequest,
    NotificationBroadcastRequest,
    StandardResponse,
)
from app.core.constants import (
    MONGO_LOOKUP,
    MONGO_MATCH,
    MONGO_UNWIND,
    MONGO_GROUP,
    MONGO_SORT,
    MONGO_SKIP,
    MONGO_LIMIT,
    MONGO_SUM,
)
from app.core.security import get_current_admin, get_current_user
from app.core.exceptions import ResourceNotFoundError, InvalidInputError
from app.db.connection import get_db
from app.models.database import UserStatus, Notification
from app.models.moderation import (
    UserReport,
    ReportReason,
    ReportStatus,
    ReportAction,
    UserWarning,
    UserSuspension,
)

# MongoDB query constants - SonarQube: S1192
MONGO_REGEX = "$regex"
MONGO_OPTIONS = "$options"
REGEX_CASE_INSENSITIVE = "i"
# M2 fix: Removed shadowed MONGO_MATCH — already imported from app.core.constants
ERROR_INVALID_USER_ID = "Invalid user ID format"

# Fields to strip from user documents before returning to admin (M15)
_SENSITIVE_USER_FIELDS = {"password_hash", "hashed_password", "password", "fcm_token", "refresh_token", "otp", "otp_secret"}


def _strip_sensitive_fields(user: dict) -> dict:
    """Remove sensitive fields before returning user data to admin endpoints."""
    return {k: v for k, v in user.items() if k not in _SENSITIVE_USER_FIELDS}

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get(
    "/dashboard/analytics",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Dashboard Analytics",
    description="Get comprehensive platform analytics for admin dashboard",
)
async def get_dashboard_analytics(
    current_user: Annotated[Dict[str, Any], Depends(get_current_admin)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Get dashboard analytics with key metrics"""
    try:
        # Total counts
        total_users = await db.users.count_documents({})
        total_grihastas = await db.users.count_documents({"role": "grihasta"})
        total_acharyas = await db.users.count_documents({"role": "acharya"})
        active_acharyas = await db.users.count_documents(
            {"role": "acharya", "status": UserStatus.ACTIVE.value}
        )
        pending_verifications = await db.users.count_documents(
            {"role": "acharya", "status": UserStatus.PENDING.value}
        )

        # Booking stats
        total_bookings = await db.bookings.count_documents({})
        completed_bookings = await db.bookings.count_documents({"status": "completed"})

        # Revenue calculation
        revenue_pipeline = [
            {MONGO_MATCH: {"status": "completed"}},
            {
                MONGO_GROUP: {
                    "_id": None,
                    "total_revenue": {"$sum": "$total_amount"},
                    "platform_fees": {"$sum": "$platform_fee"},
                }
            },
        ]
        revenue_data = await db.bookings.aggregate(revenue_pipeline).to_list(length=1)

        # User growth (last 30 days)
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        user_growth_pipeline = [
            {MONGO_MATCH: {"created_at": {"$gte": thirty_days_ago}}},
            {
                MONGO_GROUP: {
                    "_id": {
                        "date": {
                            "$dateToString": {
                                "format": "%Y-%m-%d",
                                "date": "$created_at",
                            }
                        },
                        "role": "$role",
                    },
                    "count": {MONGO_SUM: 1},
                }
            },
            {MONGO_SORT: {"_id.date": 1}},
        ]
        user_growth = await db.users.aggregate(user_growth_pipeline).to_list(
            length=None
        )

        # Revenue trend (last 30 days)
        revenue_trend_pipeline = [
            {
                MONGO_MATCH: {
                    "status": "completed",
                    "completed_at": {"$gte": thirty_days_ago},
                }
            },
            {
                MONGO_GROUP: {
                    "_id": {
                        "$dateToString": {"format": "%Y-%m-%d", "date": "$completed_at"}
                    },
                    "revenue": {MONGO_SUM: "$total_amount"},
                    "bookings": {MONGO_SUM: 1},
                }
            },
            {MONGO_SORT: {"_id": 1}},
        ]
        revenue_trend = await db.bookings.aggregate(revenue_trend_pipeline).to_list(
            length=None
        )

        # Pending reviews
        pending_reviews = await db.reviews.count_documents({"is_public": False})

        # Active conversations
        active_conversations = await db.conversations.count_documents(
            {"last_message_at": {"$gte": thirty_days_ago}}
        )

        return StandardResponse(
            success=True,
            data={
                "overview": {
                    "total_users": total_users,
                    "total_grihastas": total_grihastas,
                    "total_acharyas": total_acharyas,
                    "active_acharyas": active_acharyas,
                    "pending_verifications": pending_verifications,
                    "total_bookings": total_bookings,
                    "completed_bookings": completed_bookings,
                    "pending_reviews": pending_reviews,
                    "active_conversations": active_conversations,
                },
                "revenue": {
                    "total_revenue": revenue_data[0]["total_revenue"]
                    if revenue_data
                    else 0.0,
                    "platform_fees": revenue_data[0]["platform_fees"]
                    if revenue_data
                    else 0.0,
                },
                "user_growth": user_growth,
                "revenue_trend": revenue_trend,
            },
        )

    except Exception as e:
        logger.error(f"Get analytics error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch analytics",
        )


@router.get(
    "/acharyas/pending",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Pending Acharya Verifications",
    description="Get list of Acharyas awaiting verification",
)
async def get_pending_acharyas(
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    current_user: Annotated[Dict[str, Any], Depends(get_current_admin)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Get Acharyas pending verification"""
    try:
        # Get pending Acharya users with profiles
        pipeline = [
            {MONGO_MATCH: {"role": "acharya", "status": UserStatus.PENDING.value}},
            {
                MONGO_LOOKUP: {
                    "from": "acharya_profiles",
                    "localField": "_id",
                    "foreignField": "user_id",
                    "as": "profile",
                }
            },
            {MONGO_UNWIND: "$profile"},
            {MONGO_SORT: {"created_at": 1}},  # Oldest first
            {MONGO_SKIP: (page - 1) * limit},
            {MONGO_LIMIT: limit},
        ]

        acharyas = await db.users.aggregate(pipeline).to_list(length=limit)

        # Serialize ObjectIds to strings
        for acharya in acharyas:
            if "_id" in acharya:
                acharya["_id"] = str(acharya["_id"])
            if "profile" in acharya and "_id" in acharya["profile"]:
                acharya["profile"]["_id"] = str(acharya["profile"]["_id"])
            # Convert user_id in profile to string if it's ObjectId
            if "profile" in acharya and "user_id" in acharya["profile"]:
                if isinstance(acharya["profile"]["user_id"], ObjectId):
                    acharya["profile"]["user_id"] = str(acharya["profile"]["user_id"])

        # Get total count
        total_count = await db.users.count_documents(
            {"role": "acharya", "status": UserStatus.PENDING.value}
        )

        return StandardResponse(
            success=True,
            data={
                "acharyas": acharyas,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "pages": (total_count + limit - 1) // limit,
                },
            },
        )

    except Exception as e:
        logger.error(f"Get pending Acharyas error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch pending Acharyas",
        )


def _create_verification_notification_message(action: str, notes: str = None) -> str:
    """Create notification message based on verification action"""
    if action == "approve":
        return "Congratulations! Your Acharya profile has been verified. You can now start receiving bookings."
    return f"Your Acharya verification has been declined. Reason: {notes or 'Not specified'}"


def _send_verification_push_notification(
    acharya_doc: dict, action: str, reason: str = None
):
    """Send push notification for verification status"""
    if not acharya_doc or not acharya_doc.get("fcm_token"):
        return

    try:
        from app.services.notification_service import NotificationService

        notification_service = NotificationService()
        title = "Profile Verified!" if action == "approve" else "Verification Update"
        body = (
            "Congratulations! Your profile is verified."
            if action == "approve"
            else f"Verification denied: {reason or 'Please contact support'}"
        )
        notification_service.send_notification(
            token=acharya_doc["fcm_token"],
            title=title,
            body=body,
            data={"type": "verification_update", "status": action},
        )
    except Exception as e:
        logger.warning(f"Failed to send verification notification: {e}")


@router.post(
    "/acharyas/{acharya_id}/verify",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify Acharya",
    description="Approve or reject Acharya profile verification",
)
async def verify_acharya(  # noqa: C901
    acharya_id: str,
    verification: AcharyaVerificationRequest,
    current_user: Annotated[Dict[str, Any], Depends(get_current_admin)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Approve or reject Acharya verification"""
    try:
        admin_id = current_user["id"]

        # Convert string ID to ObjectId
        try:
            acharya_oid = ObjectId(acharya_id)
        except (ValueError, TypeError) as e:
            raise InvalidInputError(
                message="Invalid acharya ID format", field="acharya_id"
            ) from e

        # Get Acharya user
        acharya = await db.users.find_one({"_id": acharya_oid, "role": "acharya"})
        if not acharya:
            raise ResourceNotFoundError(resource_type="Acharya", resource_id=acharya_id)

        # Check if already verified
        if acharya["status"] == UserStatus.ACTIVE.value:
            raise InvalidInputError(
                message="Acharya is already verified", field="acharya_id"
            )

        # Update status
        new_status = (
            UserStatus.ACTIVE
            if verification.action == "approve"
            else UserStatus.SUSPENDED
        )

        await db.users.update_one(
            {"_id": acharya_oid},
            {
                "$set": {
                    "status": new_status.value,
                    "verified_by": admin_id,
                    "verified_at": datetime.now(timezone.utc),
                    "verification_notes": verification.notes,
                }
            },
        )

        # Create notification for Acharya
        notification_message = _create_verification_notification_message(
            verification.action, verification.notes
        )
        notification = Notification(
            user_id=acharya_id,
            title="Verification Status Update",
            body=notification_message,
            notification_type="verification",
            data={"action": verification.action},
        )
        notification_doc = notification.model_dump(by_alias=True, exclude_none=True)
        await db.notifications.insert_one(notification_doc)

        # Send push notification
        acharya_doc = await db.users.find_one({"_id": ObjectId(acharya_id)})
        _send_verification_push_notification(
            acharya_doc, verification.action, verification.notes
        )

        logger.info(
            f"Acharya {acharya_id} verification: {verification.action} by admin {admin_id}"
        )

        return StandardResponse(
            success=True,
            message=f"Acharya {'approved' if verification.action == 'approve' else 'rejected'} successfully",
        )

    except (ResourceNotFoundError, InvalidInputError):
        raise
    except Exception as e:
        logger.error(f"Verify Acharya error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify Acharya",
        )


@router.get(
    "/reviews/pending",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Pending Reviews",
    description="Get reviews awaiting moderation",
)
async def get_pending_reviews(
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    current_user: Annotated[Dict[str, Any], Depends(get_current_admin)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Get reviews pending approval"""
    try:
        # Get pending reviews with user details
        pipeline = [
            {MONGO_MATCH: {"is_public": False}},
            {
                MONGO_LOOKUP: {
                    "from": "grihasta_profiles",
                    "localField": "grihasta_id",
                    "foreignField": "user_id",
                    "as": "grihasta",
                }
            },
            {MONGO_UNWIND: "$grihasta"},
            {
                MONGO_LOOKUP: {
                    "from": "acharya_profiles",
                    "localField": "acharya_id",
                    "foreignField": "_id",
                    "as": "acharya",
                }
            },
            {MONGO_UNWIND: "$acharya"},
            {
                MONGO_LOOKUP: {
                    "from": "bookings",
                    "localField": "booking_id",
                    "foreignField": "_id",
                    "as": "booking",
                }
            },
            {MONGO_UNWIND: "$booking"},
            {"$sort": {"created_at": 1}},  # Oldest first
            {"$skip": (page - 1) * limit},
            {"$limit": limit},
        ]

        reviews = await db.reviews.aggregate(pipeline).to_list(length=limit)

        # Get total count
        total_count = await db.reviews.count_documents({"is_public": False})

        return StandardResponse(
            success=True,
            data={
                "reviews": reviews,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "pages": (total_count + limit - 1) // limit,
                },
            },
        )

    except Exception as e:
        logger.error(f"Get pending reviews error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch pending reviews",
        )


@router.post(
    "/reviews/{review_id}/moderate",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Moderate Review",
    description="Approve or reject review",
)
async def moderate_review(
    review_id: str,
    action: Annotated[str, Query(..., pattern="^(approve|reject)$")],
    notes: Annotated[Optional[str], Query(max_length=500)] = None,
    current_user: Annotated[Dict[str, Any], Depends(get_current_admin)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Approve or reject review"""
    try:
        admin_id = current_user["id"]

        # Get review
        review = await db.reviews.find_one({"_id": ObjectId(review_id)})
        if not review:
            raise ResourceNotFoundError(resource_type="Review", resource_id=review_id)

        if action == "approve":
            # Make review public
            await db.reviews.update_one(
                {"_id": ObjectId(review_id)},
                {
                    "$set": {
                        "is_public": True,
                        "moderated_by": admin_id,
                        "moderated_at": datetime.now(timezone.utc),
                    }
                },
            )

            # Update Acharya rating if it's an Acharya review
            if review["review_type"] == "acharya":
                await update_acharya_rating(review["acharya_id"], db)

            message = "Review approved and published"
        else:
            # Reject review (keep private, add admin notes)
            await db.reviews.update_one(
                {"_id": ObjectId(review_id)},
                {
                    "$set": {
                        "moderated_by": admin_id,
                        "moderated_at": datetime.now(timezone.utc),
                        "rejection_reason": notes,
                    }
                },
            )

            message = "Review rejected"

        # Notify Grihasta
        notification = Notification(
            user_id=review["grihasta_id"],
            title="Review Moderation Update",
            body=f"Your review has been {'approved and published' if action == 'approve' else 'rejected'}.",
            notification_type="review_moderation",
            data={"review_id": review_id, "action": action},
        )
        await db.notifications.insert_one(
            notification.model_dump(by_alias=True, exclude_none=True)
        )

        logger.info(f"Review {review_id} {action}ed by admin {admin_id}")

        return StandardResponse(success=True, message=message)

    except (ResourceNotFoundError, InvalidInputError):
        raise
    except Exception as e:
        logger.error(f"Moderate review error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to moderate review",
        )


async def update_acharya_rating(acharya_id: str, db: AsyncIOMotorDatabase):
    """Recalculate Acharya's average rating"""
    pipeline = [
        {
            MONGO_MATCH: {
                "acharya_id": acharya_id,
                "review_type": "acharya",
                "is_public": True,
            }
        },
        {
            "$group": {
                "_id": None,
                "average_rating": {"$avg": "$rating"},
                "total_reviews": {"$sum": 1},
            }
        },
    ]

    rating_data = await db.reviews.aggregate(pipeline).to_list(length=1)

    if rating_data:
        await db.acharya_profiles.update_one(
            {"user_id": acharya_id},
            {
                "$set": {
                    "rating": round(rating_data[0]["average_rating"], 2),
                    "total_reviews": rating_data[0]["total_reviews"],
                }
            },
        )


def _build_acharya_query(kyc_status: Optional[str]) -> dict:
    """Build MongoDB query filter for Acharya listing"""
    query = {"role": "acharya"}
    if kyc_status:
        status_mapping = {
            "pending": "pending",
            "verified": "active",
            "rejected": "suspended",
        }
        query["status"] = status_mapping.get(kyc_status.lower(), kyc_status.lower())
    return query


def _serialize_acharya_doc(acharya: dict) -> dict:
    """Convert ObjectId fields to strings for JSON serialization"""
    if "_id" in acharya:
        acharya["_id"] = str(acharya["_id"])
    profile = acharya.get("acharya_profile")
    if profile:
        if "_id" in profile:
            profile["_id"] = str(profile["_id"])
        if isinstance(profile.get("user_id"), ObjectId):
            profile["user_id"] = str(profile["user_id"])
    return acharya


@router.get(
    "/acharyas",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get All Acharyas",
    description="Get list of all Acharyas",
)
async def get_acharyas(
    kyc_status: Annotated[Optional[str], Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=1000)] = 20,
    current_user: Annotated[Dict[str, Any], Depends(get_current_admin)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Get all Acharyas"""
    try:
        query = _build_acharya_query(kyc_status)
        logger.info(f"Fetching acharyas with query: {query}")

        pipeline = [
            {MONGO_MATCH: query},
            {
                MONGO_LOOKUP: {
                    "from": "acharya_profiles",
                    "localField": "_id",
                    "foreignField": "user_id",
                    "as": "acharya_profile",
                }
            },
            {
                MONGO_UNWIND: {
                    "path": "$acharya_profile",
                    "preserveNullAndEmptyArrays": True,
                }
            },
            {MONGO_SKIP: (page - 1) * limit},
            {MONGO_LIMIT: limit},
        ]

        acharyas = await db.users.aggregate(pipeline).to_list(length=limit)
        serialized = [_serialize_acharya_doc(a) for a in acharyas]
        total = await db.users.count_documents(query)

        return StandardResponse(
            success=True,
            data={
                "acharyas": serialized,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total,
                    "pages": (total + limit - 1) // limit,
                },
            },
        )
    except Exception as e:
        logger.error(f"Get acharyas error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch acharyas",
        )


@router.get(
    "/users/{user_id}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get User Details",
    description="Get detailed information about a specific user",
)
async def get_user_by_id(
    user_id: str,
    current_user: Annotated[Dict[str, Any], Depends(get_current_admin)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Get user by ID"""
    try:
        # Try to find user by ObjectId or string ID
        try:
            user = await db.users.find_one({"_id": ObjectId(user_id)})
        except (ValueError, TypeError):
            user = await db.users.find_one({"_id": user_id})

        if not user:
            raise ResourceNotFoundError(resource_type="User", resource_id=user_id)

        # Convert ObjectId to string
        if "_id" in user:
            user["_id"] = str(user["_id"])

        return StandardResponse(success=True, data=_strip_sensitive_fields(user))
    except ResourceNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Get user by ID error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user details",
        )


@router.get(
    "/users/search",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Search Users",
    description="Search users by email, role, or status",
)
async def search_users(
    email: Annotated[Optional[str], Query()] = None,
    role: Annotated[Optional[str], Query()] = None,
    status_filter: Annotated[Optional[str], Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=1000)] = 20,
    current_user: Annotated[Dict[str, Any], Depends(get_current_admin)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Search users with filters"""
    try:
        # Build query
        query = {}
        if email:
            query["email"] = {MONGO_REGEX: re.escape(email), MONGO_OPTIONS: REGEX_CASE_INSENSITIVE}
        if role and role.lower() != "all":
            query["role"] = {
                MONGO_REGEX: f"^{re.escape(role)}$",
                MONGO_OPTIONS: REGEX_CASE_INSENSITIVE,
            }
        if status_filter and status_filter.lower() != "all":
            query["status"] = {
                MONGO_REGEX: f"^{re.escape(status_filter)}$",
                MONGO_OPTIONS: REGEX_CASE_INSENSITIVE,
            }

        # Get users
        users = (
            await db.users.find(query)
            .sort("created_at", -1)
            .skip((page - 1) * limit)
            .limit(limit)
            .to_list(length=limit)
        )

        # Convert ObjectId to string for serialization + strip sensitive fields (M15)
        for i, user in enumerate(users):
            if "_id" in user:
                user["_id"] = str(user["_id"])
            users[i] = _strip_sensitive_fields(user)

        # Get total count
        total_count = await db.users.count_documents(query)

        return StandardResponse(
            success=True,
            data={
                "users": users,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "pages": (total_count + limit - 1) // limit,
                },
            },
        )

    except Exception as e:
        logger.error(f"Search users error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search users",
        )


@router.post(
    "/users/{user_id}/suspend",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Suspend User",
    description="Suspend user account",
)
async def suspend_user(
    user_id: str,
    reason: Annotated[str, Query(..., max_length=500)],
    current_user: Annotated[Dict[str, Any], Depends(get_current_admin)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Suspend user account"""
    try:
        admin_id = current_user["id"]

        # Convert string ID to ObjectId
        try:
            user_oid = ObjectId(user_id)
        except (ValueError, TypeError) as e:
            raise InvalidInputError(
                message=ERROR_INVALID_USER_ID, field="user_id"
            ) from e

        # Get user
        user = await db.users.find_one({"_id": user_oid})
        if not user:
            raise ResourceNotFoundError(resource_type="User", resource_id=user_id)

        # Can't suspend admin
        if user["role"] == "admin":
            raise InvalidInputError(
                message="Cannot suspend admin users", field="user_id"
            )

        # Update status
        await db.users.update_one(
            {"_id": user_oid},
            {
                "$set": {
                    "status": UserStatus.SUSPENDED.value,
                    "suspended_by": admin_id,
                    "suspended_at": datetime.now(timezone.utc),
                    "suspension_reason": reason,
                }
            },
        )

        # Notify user
        notification = Notification(
            user_id=user_id,
            title="Account Suspended",
            body=f"Your account has been suspended. Reason: {reason}",
            notification_type="account_status",
            data={"action": "suspended"},
        )
        await db.notifications.insert_one(
            notification.model_dump(by_alias=True, exclude_none=True)
        )

        logger.info(f"User {user_id} suspended by admin {admin_id}")

        return StandardResponse(success=True, message="User suspended successfully")

    except (ResourceNotFoundError, InvalidInputError):
        raise
    except Exception as e:
        logger.error(f"Suspend user error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to suspend user",
        )


@router.post(
    "/users/{user_id}/activate",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Activate User",
    description="Reactivate suspended user account",
)
async def activate_user(
    user_id: str,
    current_user: Annotated[Dict[str, Any], Depends(get_current_admin)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Reactivate user account"""
    try:
        # Convert string ID to ObjectId
        try:
            user_oid = ObjectId(user_id)
        except (ValueError, TypeError) as e:
            raise InvalidInputError(
                message=ERROR_INVALID_USER_ID, field="user_id"
            ) from e

        # Get user
        user = await db.users.find_one({"_id": user_oid})
        if not user:
            raise ResourceNotFoundError(resource_type="User", resource_id=user_id)

        # Update status
        await db.users.update_one(
            {"_id": user_oid},
            {
                "$set": {
                    "status": UserStatus.ACTIVE.value,
                    "activated_at": datetime.now(timezone.utc),
                },
                "$unset": {
                    "suspended_by": "",
                    "suspended_at": "",
                    "suspension_reason": "",
                },
            },
        )

        # Notify user
        notification = Notification(
            user_id=user_id,
            title="Account Reactivated",
            body="Your account has been reactivated. You can now use the platform.",
            notification_type="account_status",
            data={"action": "activated"},
        )
        await db.notifications.insert_one(
            notification.model_dump(by_alias=True, exclude_none=True)
        )

        logger.info(f"User {user_id} activated by admin {current_user['id']}")

        return StandardResponse(success=True, message="User activated successfully")

    except ResourceNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Activate user error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to activate user",
        )


@router.post(
    "/notifications/broadcast",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Broadcast Notification",
    description="Send notification to all users or specific role",
)
async def broadcast_notification(
    notification_data: NotificationBroadcastRequest,
    current_user: Annotated[Dict[str, Any], Depends(get_current_admin)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Broadcast notification to users"""
    try:
        # Build user query
        query = {}
        if notification_data.target_role and notification_data.target_role != "all":
            query["role"] = notification_data.target_role

        query["status"] = UserStatus.ACTIVE.value  # Only active users

        # Get target users
        users = await db.users.find(query, {"_id": 1}).to_list(length=None)
        user_ids = [str(user["_id"]) for user in users]

        # Create notifications
        notifications = [
            Notification(
                user_id=user_id,
                title=notification_data.title,
                body=notification_data.body,
                notification_type="broadcast",
                data=notification_data.data or {},
            ).model_dump(by_alias=True, exclude_none=True)
            for user_id in user_ids
        ]

        if notifications:
            await db.notifications.insert_many(notifications)

        # Log notification to history
        notification_history = {
            "title": notification_data.title,
            "body": notification_data.body,
            "recipient_type": notification_data.target_role or "all",
            "recipients_count": len(user_ids),
            "sent_by": current_user.get("id") or current_user.get("email"),
            "sent_at": datetime.now(timezone.utc),
            "status": "sent",
            "data": notification_data.data or {},
        }
        await db.notification_history.insert_one(notification_history)

        # Send push notifications via Firebase
        try:
            from app.services.notification_service import NotificationService

            notification_service = NotificationService()

            # Get FCM tokens for target users
            users = await db.users.find(
                {"_id": {"$in": [ObjectId(uid) for uid in user_ids]}}
            ).to_list(None)
            fcm_tokens = [u.get("fcm_token") for u in users if u.get("fcm_token")]

            if fcm_tokens:
                # Send in batches (Firebase limit: 500 tokens per request)
                batch_size = 500
                for i in range(0, len(fcm_tokens), batch_size):
                    batch_tokens = fcm_tokens[i : i + batch_size]
                    notification_service.send_multicast(
                        tokens=batch_tokens,
                        title=notification_data.title,
                        body=notification_data.body,
                        data=notification_data.data or {},
                    )
                logger.info(f"Sent push notifications to {len(fcm_tokens)} devices")
        except Exception as e:
            logger.warning(f"Failed to send broadcast push notifications: {e}")

        logger.info(
            f"Broadcast notification sent to {len(user_ids)} users by admin {current_user['id']}"
        )

        return StandardResponse(
            success=True,
            data={"recipients_count": len(user_ids)},
            message=f"Notification broadcast to {len(user_ids)} users",
        )

    except Exception as e:
        logger.error(f"Broadcast notification error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to broadcast notification",
        )


@router.get(
    "/notifications/history",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Notification History",
    description="Get broadcast notification history",
)
async def get_notification_history(
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    current_user: Annotated[Dict[str, Any], Depends(get_current_admin)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Get notification history"""
    try:
        skip = (page - 1) * limit

        notifications = (
            await db.notification_history.find()
            .sort("sent_at", -1)
            .skip(skip)
            .limit(limit)
            .to_list(length=limit)
        )

        for n in notifications:
            n["_id"] = str(n["_id"])

        return StandardResponse(
            success=True,
            data=notifications,
            message=f"Found {len(notifications)} notifications",
        )
    except Exception as e:
        logger.error(f"Get notification history error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch notification history",
        )


@router.get(
    "/bookings",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get All Bookings",
    description="Get all bookings with filters",
)
async def get_all_bookings(
    status_filter: Annotated[Optional[str], Query()] = None,
    start_date: Annotated[Optional[str], Query()] = None,
    end_date: Annotated[Optional[str], Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    current_user: Annotated[Dict[str, Any], Depends(get_current_admin)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Get all bookings for admin review"""
    try:
        # Build query
        query = {}
        if status_filter:
            query["status"] = status_filter

        if start_date:
            query["date_time"] = {"$gte": datetime.fromisoformat(start_date)}
        if end_date:
            if "date_time" not in query:
                query["date_time"] = {}
            query["date_time"]["$lte"] = datetime.fromisoformat(end_date)

        # Get bookings with details
        pipeline = [
            {MONGO_MATCH: query},
            {
                "$lookup": {
                    "from": "grihasta_profiles",
                    "localField": "grihasta_id",
                    "foreignField": "user_id",
                    "as": "grihasta",
                }
            },
            {"$unwind": "$grihasta"},
            {
                "$lookup": {
                    "from": "acharya_profiles",
                    "localField": "acharya_id",
                    "foreignField": "_id",
                    "as": "acharya",
                }
            },
            {"$unwind": "$acharya"},
            {"$sort": {"created_at": -1}},
            {"$skip": (page - 1) * limit},
            {"$limit": limit},
        ]

        bookings = await db.bookings.aggregate(pipeline).to_list(length=limit)

        # Get total count
        total_count = await db.bookings.count_documents(query)

        return StandardResponse(
            success=True,
            data={
                "bookings": bookings,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "pages": (total_count + limit - 1) // limit,
                },
            },
        )

    except Exception as e:
        logger.error(f"Get all bookings error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch bookings",
        )


@router.get(
    "/bookings/stats",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Booking Statistics",
    description="Aggregate booking counts and revenue across ALL bookings (not just the current page).",
)
async def get_booking_stats(
    current_user: Annotated[Dict[str, Any], Depends(get_current_admin)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Return per-status booking counts and total completed revenue."""
    try:
        pipeline = [
            {
                "$group": {
                    "_id": "$status",
                    "count": {"$sum": 1},
                    "revenue": {
                        "$sum": {
                            "$cond": [
                                {"$eq": ["$status", "completed"]},
                                {"$ifNull": ["$total_amount", 0]},
                                0,
                            ]
                        }
                    },
                }
            }
        ]
        results = await db.bookings.aggregate(pipeline).to_list(length=50)

        counts: Dict[str, int] = {}
        total_revenue: float = 0.0
        for row in results:
            key = row["_id"] or "unknown"
            counts[key] = row["count"]
            total_revenue += float(row.get("revenue") or 0)

        pending = (
            counts.get("pending", 0)
            + counts.get("requested", 0)
            + counts.get("pending_payment", 0)
        )

        return StandardResponse(
            success=True,
            data={
                "total": sum(counts.values()),
                "pending": pending,
                "confirmed": counts.get("confirmed", 0),
                "in_progress": counts.get("in_progress", 0),
                "completed": counts.get("completed", 0),
                "cancelled": counts.get("cancelled", 0),
                "rejected": counts.get("rejected", 0),
                "failed": counts.get("failed", 0),
                "revenue": round(total_revenue, 2),
            },
        )

    except Exception as e:
        logger.error(f"Get booking stats error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch booking statistics",
        )


@router.get(
    "/audit-logs",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Audit Logs",
    description="Get system audit logs for admin review",
)
async def get_audit_logs(
    action: Annotated[Optional[str], Query(description="Filter by action type")] = None,
    user_id: Annotated[Optional[str], Query(description="Filter by user ID")] = None,
    start_date: Annotated[Optional[str], Query(description="Start date filter")] = None,
    end_date: Annotated[Optional[str], Query(description="End date filter")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    current_user: Annotated[Dict[str, Any], Depends(get_current_admin)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Get audit logs with filtering"""
    try:
        # Build query
        query = {}
        if action:
            query["action"] = {
                MONGO_REGEX: re.escape(action),
                MONGO_OPTIONS: REGEX_CASE_INSENSITIVE,
            }
        if user_id:
            query["user_id"] = user_id

        if start_date:
            query["timestamp"] = {"$gte": datetime.fromisoformat(start_date)}
        if end_date:
            if "timestamp" not in query:
                query["timestamp"] = {}
            query["timestamp"]["$lte"] = datetime.fromisoformat(end_date)

        skip = (page - 1) * limit

        # Get audit logs
        logs = (
            await db.audit_logs.find(query)
            .sort("timestamp", -1)
            .skip(skip)
            .limit(limit)
            .to_list(length=limit)
        )

        # Convert ObjectIds to strings
        for log in logs:
            log["_id"] = str(log["_id"])
            log["id"] = log["_id"]

        # Get total count
        total_count = await db.audit_logs.count_documents(query)

        # Get stats for today
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        stats = {
            "totalToday": await db.audit_logs.count_documents(
                {"timestamp": {"$gte": today_start}}
            ),
            "authEvents": await db.audit_logs.count_documents(
                {
                    "action": {
                        MONGO_REGEX: "auth",
                        MONGO_OPTIONS: REGEX_CASE_INSENSITIVE,
                    },
                    "timestamp": {"$gte": today_start},
                }
            ),
            "adminActions": await db.audit_logs.count_documents(
                {
                    "action": {
                        MONGO_REGEX: "admin",
                        MONGO_OPTIONS: REGEX_CASE_INSENSITIVE,
                    },
                    "timestamp": {"$gte": today_start},
                }
            ),
            "failedEvents": await db.audit_logs.count_documents(
                {"success": False, "timestamp": {"$gte": today_start}}
            ),
        }

        return StandardResponse(
            success=True,
            data={
                "logs": logs,
                "total": total_count,
                "stats": stats,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "pages": (total_count + limit - 1) // limit,
                },
            },
        )

    except Exception as e:
        logger.error(f"Get audit logs error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch audit logs",
        )


# ==================== User Reporting & Moderation Endpoints ====================


@router.post(
    "/reports",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit User Report",
    description="Report another user for inappropriate behavior",
)
async def create_user_report(
    reported_user_id: str,
    reason: str,
    description: Optional[str] = None,
    context: Optional[str] = None,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Create a user report"""
    try:
        reporter_id = str(current_user.get("_id") or current_user.get("id"))

        # Validate reported user exists
        try:
            reported_oid = ObjectId(reported_user_id)
        except (ValueError, TypeError) as e:
            raise InvalidInputError(
                message=ERROR_INVALID_USER_ID, field="reported_user_id"
            ) from e

        reported_user = await db.users.find_one({"_id": reported_oid})
        if not reported_user:
            raise ResourceNotFoundError(
                resource_type="User", resource_id=reported_user_id
            )

        # Can't report yourself
        if reporter_id == reported_user_id:
            raise InvalidInputError(
                message="Cannot report yourself", field="reported_user_id"
            )

        # Create report
        report = UserReport(
            reporter_id=reporter_id,
            reported_user_id=reported_user_id,
            reason=reason,
            description=description or "",
            context=context or "",
            status=ReportStatus.PENDING,
            priority=3 if reason in ["harassment", "violence", "scam"] else 1,
        )

        report_dict = report.model_dump(by_alias=True, exclude={"id"})
        result = await db.user_reports.insert_one(report_dict)

        # Notify admins about new report
        admins = await db.users.find({"role": "admin"}).to_list(None)
        admin_notifications = [
            Notification(
                user_id=str(admin["_id"]),
                title="New User Report",
                body=f"User reported for {reason}",
                notification_type="admin_alert",
                data={"report_id": str(result.inserted_id), "reason": reason},
            ).model_dump(by_alias=True, exclude_none=True)
            for admin in admins
        ]

        if admin_notifications:
            await db.notifications.insert_many(admin_notifications)

        logger.info(
            f"User {reporter_id} reported user {reported_user_id} for {reason}"
        )

        return StandardResponse(
            success=True,
            data={"report_id": str(result.inserted_id)},
            message="Report submitted successfully. Our team will review it shortly.",
        )

    except (ResourceNotFoundError, InvalidInputError):
        raise
    except Exception as e:
        logger.error(f"Create report error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit report",
        )


@router.get(
    "/reports",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get All Reports",
    description="Get all user reports (Admin only)",
)
async def get_all_reports(
    status_filter: Annotated[Optional[str], Query(description="Filter by status")] = None,
    priority: Annotated[Optional[int], Query(ge=1, le=5, description="Filter by priority")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    current_user: Annotated[Dict[str, Any], Depends(get_current_admin)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Get all user reports with details"""
    try:
        # Build query
        query = {}
        if status_filter:
            query["status"] = status_filter
        if priority:
            query["priority"] = priority

        # Get reports with user details
        pipeline = [
            {MONGO_MATCH: query},
            {
                MONGO_LOOKUP: {
                    "from": "users",
                    "let": {"reporter": {"$toObjectId": "$reporter_id"}},
                    "pipeline": [
                        {MONGO_MATCH: {"$expr": {"$eq": ["$_id", "$$reporter"]}}},
                        {"$project": {"email": 1, "role": 1}},
                    ],
                    "as": "reporter",
                }
            },
            {MONGO_UNWIND: {"path": "$reporter", "preserveNullAndEmptyArrays": True}},
            {
                MONGO_LOOKUP: {
                    "from": "users",
                    "let": {"reported": {"$toObjectId": "$reported_user_id"}},
                    "pipeline": [
                        {MONGO_MATCH: {"$expr": {"$eq": ["$_id", "$$reported"]}}},
                        {"$project": {"email": 1, "role": 1, "status": 1}},
                    ],
                    "as": "reported_user",
                }
            },
            {
                MONGO_UNWIND: {
                    "path": "$reported_user",
                    "preserveNullAndEmptyArrays": True,
                }
            },
            {MONGO_SORT: {"priority": -1, "created_at": -1}},
            {MONGO_SKIP: (page - 1) * limit},
            {MONGO_LIMIT: limit},
        ]

        reports = await db.user_reports.aggregate(pipeline).to_list(length=limit)

        # Serialize ObjectIds
        for report in reports:
            if "_id" in report:
                report["_id"] = str(report["_id"])
            if "reporter" in report and "_id" in report["reporter"]:
                report["reporter"]["_id"] = str(report["reporter"]["_id"])
            if "reported_user" in report and "_id" in report["reported_user"]:
                report["reported_user"]["_id"] = str(report["reported_user"]["_id"])

        # Get total count
        total_count = await db.user_reports.count_documents(query)

        return StandardResponse(
            success=True,
            data={
                "reports": reports,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "pages": (total_count + limit - 1) // limit,
                },
            },
        )

    except Exception as e:
        logger.error(f"Get reports error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch reports",
        )


@router.post(
    "/reports/{report_id}/review",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Review Report",
    description="Review and take action on a user report (Admin only)",
)
async def review_report(
    report_id: str,
    action: Annotated[str, Query(..., description="resolved|dismissed|action_taken", pattern="^(resolved|dismissed|action_taken)$")],
    action_taken: Annotated[Optional[str], Query(
        description="warning_sent|user_suspended|user_banned|content_removed",
        pattern="^(warning_sent|user_suspended|user_banned|content_removed)$",
    )] = None,
    admin_notes: Optional[str] = None,
    current_user: Annotated[Dict[str, Any], Depends(get_current_admin)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Review a user report and take action"""
    try:
        admin_id = str(current_user.get("_id") or current_user.get("id"))

        # Get report
        try:
            report_oid = ObjectId(report_id)
        except (ValueError, TypeError) as e:
            raise InvalidInputError(
                message="Invalid report ID format", field="report_id"
            ) from e

        report = await db.user_reports.find_one({"_id": report_oid})
        if not report:
            raise ResourceNotFoundError(resource_type="Report", resource_id=report_id)

        # Update report
        update_data = {
            "status": action,
            "reviewed_by": admin_id,
            "reviewed_at": datetime.now(timezone.utc),
            "admin_notes": admin_notes or "",
            "updated_at": datetime.now(timezone.utc),
        }

        if action_taken:
            update_data["action_taken"] = action_taken

        await db.user_reports.update_one({"_id": report_oid}, {"$set": update_data})

        # Take action on reported user if needed
        if action_taken == "user_suspended":
            await db.users.update_one(
                {"_id": ObjectId(report["reported_user_id"])},
                {
                    "$set": {
                        "status": UserStatus.SUSPENDED.value,
                        "suspended_by": admin_id,
                        "suspended_at": datetime.now(timezone.utc),
                        "suspension_reason": f"Report: {report['reason']}",
                    }
                },
            )

            # Create suspension record
            suspension = UserSuspension(
                user_id=report["reported_user_id"],
                suspended_by=admin_id,
                reason=f"Report: {report['reason']} - {admin_notes or ''}",
                report_ids=[report_id],
            )
            await db.user_suspensions.insert_one(
                suspension.model_dump(by_alias=True, exclude={"id"})
            )

            # Notify user
            await db.notifications.insert_one(
                Notification(
                    user_id=report["reported_user_id"],
                    title="Account Suspended",
                    body="Your account has been suspended due to a report. Contact support for details.",
                    notification_type="account_status",
                    data={"action": "suspended"},
                ).model_dump(by_alias=True, exclude_none=True)
            )

        elif action_taken == "warning_sent":
            # Create warning
            warning = UserWarning(
                user_id=report["reported_user_id"],
                issued_by=admin_id,
                reason=f"Report: {report['reason']}",
                severity=report.get("priority", 1),
                report_id=report_id,
            )
            await db.user_warnings.insert_one(
                warning.model_dump(by_alias=True, exclude={"id"})
            )

            # Notify user
            await db.notifications.insert_one(
                Notification(
                    user_id=report["reported_user_id"],
                    title="Warning Issued",
                    body=f"You have received a warning: {report['reason']}. Please review our community guidelines.",
                    notification_type="warning",
                    data={"warning_id": str(report_id)},
                ).model_dump(by_alias=True, exclude_none=True)
            )

        # Notify reporter
        await db.notifications.insert_one(
            Notification(
                user_id=report["reporter_id"],
                title="Report Reviewed",
                body=f"Your report has been reviewed. Action: {action.replace('_', ' ').title()}",
                notification_type="report_update",
                data={"report_id": report_id, "action": action},
            ).model_dump(by_alias=True, exclude_none=True)
        )

        logger.info(f"Admin {admin_id} reviewed report {report_id}: {action}")

        return StandardResponse(
            success=True, message=f"Report {action.replace('_', ' ')} successfully"
        )

    except (ResourceNotFoundError, InvalidInputError):
        raise
    except Exception as e:
        logger.error(f"Review report error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to review report",
        )


@router.get(
    "/analytics/hotspots",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Pooja Hotspots",
    description="Get demand density hotspots for city managers with Redis caching (TTL 3600s)",
)
async def get_pooja_hotspots(
    city: str = Query(default="Bangalore", description="City to analyze"),
    days: int = Query(default=30, ge=1, le=90, description="Number of days to analyze"),
    current_user: Annotated[Dict[str, Any], Depends(get_current_admin)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """
    Get "Pooja Hotspots" - residential clusters with high booking density.
    
    Implements Prompt 4: Real-Time Admin Dashboard Analytics Aggregation
    
    Uses MongoDB geospatial aggregation to identify demand hotspots:
    - Groups completed bookings by geographic clusters
    - Calculates total revenue and booking count
    - Sorts by popularity score
    - Results cached in Redis for 1 hour (3600s TTL)
    
    Args:
        city: City name to filter (default: Bangalore)
        days: Number of days to look back (1-90, default: 30)
    
    Returns:
        List of hotspot clusters with booking stats
    
    Example:
        GET /api/v1/admin/analytics/hotspots?city=Bangalore&days=30
    """
    try:
        # Import here to avoid circular dependency
        from app.db.aggregations.analytics_agg import get_pooja_hotspots as fetch_hotspots
        from app.db.redis import get_redis
        from redis.asyncio import Redis
        import json
        
        # Create cache key
        cache_key = f"analytics:hotspots:{city}:{days}"
        
        # Try to get from Redis cache
        redis_client: Optional[Redis] = None
        try:
            # Get Redis dependency manually since we're already in an endpoint
            async for r in get_redis():
                redis_client = r
                break
            
            if redis_client:
                cached_data = await redis_client.get(cache_key)
                if cached_data:
                    logger.info(f"Cache hit for hotspots: {cache_key}")
                    hotspots = json.loads(cached_data)
                    return StandardResponse(
                        success=True,
                        data={
                            "city": city,
                            "days": days,
                            "hotspots": hotspots,
                            "total_clusters": len(hotspots),
                            "cached": True,
                        },
                        message=f"Found {len(hotspots)} hotspot clusters (cached)",
                    )
        except Exception as e:
            logger.warning(f"Redis cache read failed: {e}")
            # Continue without cache if Redis fails
        
        # Cache miss or no Redis - fetch from MongoDB
        logger.info(f"Cache miss for hotspots: {cache_key}, fetching from DB")
        hotspots = await fetch_hotspots(db, city=city, days=days)
        
        # Try to cache results in Redis (TTL: 3600s = 1 hour)
        if redis_client:
            try:
                await redis_client.setex(
                    cache_key,
                    3600,  # TTL: 1 hour
                    json.dumps(hotspots, default=str)  # Convert ObjectId/datetime to str
                )
                logger.info(f"Cached hotspots data: {cache_key}")
            except Exception as e:
                logger.warning(f"Redis cache write failed: {e}")
        
        return StandardResponse(
            success=True,
            data={
                "city": city,
                "days": days,
                "hotspots": hotspots,
                "total_clusters": len(hotspots),
                "cached": False,
            },
            message=f"Found {len(hotspots)} hotspot clusters",
        )
    
    except Exception as e:
        logger.error(f"Get pooja hotspots error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch hotspots analytics",
        )
