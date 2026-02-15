"""
Review API Endpoints
Handles reviews for Acharyas, Poojas, and Platform
Reviews are private by default, require admin approval
SonarQube: S5122 - Input validation with Pydantic
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime, timezone

from app.schemas.requests import (
    ReviewCreateRequest,
    ReviewResponse,
    StandardResponse
)
from app.core.constants import (
    MONGO_LOOKUP, MONGO_MATCH, MONGO_UNWIND, MONGO_GROUP, MONGO_AVG, MONGO_SUM,
    MONGO_COND, MONGO_EQ, FIELD_RATING, ERROR_FETCH_REVIEWS
)
from app.core.security import get_current_user, get_current_grihasta
from app.core.exceptions import (
    ResourceNotFoundError,
    InvalidInputError,
    PermissionDeniedError
)
from app.db.connection import get_db
from app.models.database import Review, BookingStatus, UserRole

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reviews", tags=["Reviews"])


@router.post(
    "",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit Review",
    description="Submit a review for Acharya, Pooja, or Platform (Grihasta only)"
)
async def create_review(
    review_data: ReviewCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_grihasta),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Create review
    
    Review types:
    - acharya: Rate Acharya's service
    - pooja: Rate specific Pooja quality
    - platform: Rate overall platform experience
    
    Reviews are private by default, require admin approval
    """
    try:
        grihasta_id = current_user["id"]
        
        # Verify booking exists and is completed
        booking = await db.bookings.find_one({"_id": review_data.booking_id})
        if not booking:
            raise ResourceNotFoundError(
                resource_type="Booking",
                resource_id=review_data.booking_id
            )
        
        # Verify ownership
        if booking["grihasta_id"] != grihasta_id:
            raise PermissionDeniedError(
                action="Review this booking",
                details={"message": "You can only review your own bookings"}
            )
        
        # Check booking is completed
        if booking["status"] != BookingStatus.COMPLETED.value:
            raise InvalidInputError(
                message="Can only review completed bookings",
                field="booking_id"
            )
        
        # Check if review already exists
        existing_review = await db.reviews.find_one({
            "booking_id": review_data.booking_id,
            "grihasta_id": grihasta_id,
            "review_type": review_data.review_type
        })
        
        if existing_review:
            raise InvalidInputError(
                message=f"You have already submitted a {review_data.review_type} review for this booking",
                field="booking_id"
            )
        
        # Create review
        review = Review(
            booking_id=review_data.booking_id,
            grihasta_id=grihasta_id,
            acharya_id=booking["acharya_id"],
            pooja_id=booking["pooja_id"],
            rating=review_data.rating,
            comment=review_data.comment,
            review_type=review_data.review_type,
            is_public=False  # Private by default
        )
        
        result = await db.reviews.insert_one(review.model_dump(by_alias=True))
        review.id = str(result.inserted_id)
        
        # Notify admin for review approval
        try:
            from app.services.notification_service import NotificationService
            notification_service = NotificationService()
            admin_users = await db.users.find({"role": UserRole.ADMIN.value}).to_list(None)
            admin_tokens = [u.get("fcm_token") for u in admin_users if u.get("fcm_token")]
            if admin_tokens:
                notification_service.send_multicast(
                    tokens=admin_tokens,
                    title="New Review for Moderation",
                    body=f"New {review_data.review_type} review submitted",
                    data={"type": "review_moderation", "review_id": str(review.id)}
                )
        except Exception as e:
            logger.warning(f"Failed to send admin notification: {e}")
        
        logger.info(f"Review submitted by {grihasta_id} for booking {review_data.booking_id}")
        
        return StandardResponse(
            success=True,
            data={
                "review_id": str(review.id),
                "status": "pending_approval",
                "message": "Review submitted successfully. It will be visible after admin approval."
            },
            message="Review submitted for approval"
        )
        
    except (ResourceNotFoundError, InvalidInputError, PermissionDeniedError):
        raise
    except Exception as e:
        logger.error(f"Create review error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit review"
        )


@router.get(
    "/my-reviews",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get My Reviews",
    description="Get all reviews submitted by current user"
)
async def get_my_reviews(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: Dict[str, Any] = Depends(get_current_grihasta),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get user's submitted reviews"""
    try:
        grihasta_id = current_user["id"]
        
        # Get reviews with booking details
        pipeline = [
            {MONGO_MATCH: {"grihasta_id": grihasta_id}},
            {
                MONGO_LOOKUP: {
                    "from": "bookings",
                    "localField": "booking_id",
                    "foreignField": "_id",
                    "as": "booking"
                }
            },
            {MONGO_UNWIND: "$booking"},
            {
                MONGO_LOOKUP: {
                    "from": "acharya_profiles",
                    "localField": "acharya_id",
                    "foreignField": "_id",
                    "as": "acharya"
                }
            },
            {"$unwind": "$acharya"},
            {"$sort": {"created_at": -1}},
            {"$skip": (page - 1) * limit},
            {"$limit": limit}
        ]
        
        reviews = await db.reviews.aggregate(pipeline).to_list(length=limit)
        
        # Get total count
        total_count = await db.reviews.count_documents({"grihasta_id": grihasta_id})
        
        return StandardResponse(
            success=True,
            data={
                "reviews": reviews,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "pages": (total_count + limit - 1) // limit
                }
            }
        )
        
    except Exception as e:
        logger.error(f"Get my reviews error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ERROR_FETCH_REVIEWS
        )


@router.get(
    "/acharya/{acharya_id}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Acharya Reviews",
    description="Get all public reviews for a specific Acharya"
)
async def get_acharya_reviews(
    acharya_id: str,
    review_type: Optional[str] = Query(None, pattern="^(acharya|pooja)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get public reviews for Acharya"""
    try:
        # Build query filter
        query = {
            "acharya_id": acharya_id,
            "is_public": True
        }
        
        if review_type:
            query["review_type"] = review_type
        
        # Get reviews with Grihasta info
        pipeline = [
            {MONGO_MATCH: query},
            {
                MONGO_LOOKUP: {
                    "from": "grihasta_profiles",
                    "localField": "grihasta_id",
                    "foreignField": "user_id",
                    "as": "grihasta"
                }
            },
            {
                "$project": {
                    "_id": 1,
                    "rating": 1,
                    "comment": 1,
                    "review_type": 1,
                    "created_at": 1,
                    "grihasta_name": {"$arrayElemAt": ["$grihasta.name", 0]}
                }
            },
            {"$sort": {"created_at": -1}},
            {"$skip": (page - 1) * limit},
            {"$limit": limit}
        ]
        
        reviews = await db.reviews.aggregate(pipeline).to_list(length=limit)
        
        # Get total count and average rating
        total_count = await db.reviews.count_documents(query)
        
        # Calculate average rating
        rating_pipeline = [
            {MONGO_MATCH: query},
            {
                MONGO_GROUP: {
                    "_id": None,
                    "average_rating": {MONGO_AVG: FIELD_RATING},
                    "total_reviews": {MONGO_SUM: 1}
                }
            }
        ]
        
        rating_stats = await db.reviews.aggregate(rating_pipeline).to_list(length=1)
        
        return StandardResponse(
            success=True,
            data={
                "reviews": reviews,
                "stats": {
                    "average_rating": round(rating_stats[0]["average_rating"], 2) if rating_stats else 0.0,
                    "total_reviews": rating_stats[0]["total_reviews"] if rating_stats else 0
                },
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "pages": (total_count + limit - 1) // limit
                }
            }
        )
        
    except Exception as e:
        logger.error(f"Get Acharya reviews error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch reviews"
        )


@router.get(
    "/pooja/{pooja_id}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Pooja Reviews",
    description="Get all public reviews for a specific Pooja"
)
async def get_pooja_reviews(
    pooja_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get public reviews for specific Pooja"""
    try:
        # Get reviews
        query = {
            "pooja_id": pooja_id,
            "review_type": "pooja",
            "is_public": True
        }
        
        reviews = await db.reviews.find(query).sort("created_at", -1).skip(
            (page - 1) * limit
        ).limit(limit).to_list(length=limit)
        
        # Get stats
        total_count = await db.reviews.count_documents(query)
        
        rating_pipeline = [
            {MONGO_MATCH: query},
            {
                MONGO_GROUP: {
                    "_id": None,
                    "average_rating": {MONGO_AVG: FIELD_RATING},
                    "total_reviews": {MONGO_SUM: 1}
                }
            }
        ]
        
        rating_stats = await db.reviews.aggregate(rating_pipeline).to_list(length=1)
        
        return StandardResponse(
            success=True,
            data={
                "reviews": reviews,
                "stats": {
                    "average_rating": round(rating_stats[0]["average_rating"], 2) if rating_stats else 0.0,
                    "total_reviews": rating_stats[0]["total_reviews"] if rating_stats else 0
                },
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "pages": (total_count + limit - 1) // limit
                }
            }
        )
        
    except Exception as e:
        logger.error(f"Get Pooja reviews error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch reviews"
        )


@router.put(
    "/{review_id}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Review",
    description="Update review rating and comment (before admin approval)"
)
async def update_review(
    review_id: str,
    rating: Optional[int] = Query(None, ge=1, le=5),
    comment: Optional[str] = Query(None, max_length=1000),
    current_user: Dict[str, Any] = Depends(get_current_grihasta),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Update review (only if not yet approved)"""
    try:
        grihasta_id = current_user["id"]
        
        # Get review
        review = await db.reviews.find_one({"_id": review_id})
        if not review:
            raise ResourceNotFoundError(
                resource_type="Review",
                resource_id=review_id
            )
        
        # Verify ownership
        if review["grihasta_id"] != grihasta_id:
            raise PermissionDeniedError(
                action="Update review",
                details={"message": "You can only update your own reviews"}
            )
        
        # Check if already public (approved)
        if review["is_public"]:
            raise InvalidInputError(
                message="Cannot update review after admin approval",
                field="review_id"
            )
        
        # Build update
        update_fields = {}
        if rating is not None:
            update_fields["rating"] = rating
        if comment is not None:
            update_fields["comment"] = comment
        
        if not update_fields:
            raise InvalidInputError(
                message="No fields to update",
                field="body"
            )
        
        update_fields["updated_at"] = datetime.now(timezone.utc)
        
        # Update review
        await db.reviews.update_one(
            {"_id": review_id},
            {"$set": update_fields}
        )
        
        logger.info(f"Review {review_id} updated by {grihasta_id}")
        
        return StandardResponse(
            success=True,
            message="Review updated successfully"
        )
        
    except (ResourceNotFoundError, InvalidInputError, PermissionDeniedError):
        raise
    except Exception as e:
        logger.error(f"Update review error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update review"
        )


@router.delete(
    "/{review_id}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete Review",
    description="Delete review (before admin approval only)"
)
async def delete_review(
    review_id: str,
    current_user: Dict[str, Any] = Depends(get_current_grihasta),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Delete review (only if not yet approved)"""
    try:
        grihasta_id = current_user["id"]
        
        # Get review
        review = await db.reviews.find_one({"_id": review_id})
        if not review:
            raise ResourceNotFoundError(
                resource_type="Review",
                resource_id=review_id
            )
        
        # Verify ownership
        if review["grihasta_id"] != grihasta_id:
            raise PermissionDeniedError(
                action="Delete review",
                details={"message": "You can only delete your own reviews"}
            )
        
        # Check if already public
        if review["is_public"]:
            raise InvalidInputError(
                message="Cannot delete review after admin approval. Contact support.",
                field="review_id"
            )
        
        # Delete review
        await db.reviews.delete_one({"_id": review_id})
        
        logger.info(f"Review {review_id} deleted by {grihasta_id}")
        
        return StandardResponse(
            success=True,
            message="Review deleted successfully"
        )
        
    except (ResourceNotFoundError, InvalidInputError, PermissionDeniedError):
        raise
    except Exception as e:
        logger.error(f"Delete review error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete review"
        )


@router.get(
    "/stats/platform",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Platform Review Stats",
    description="Get overall platform review statistics"
)
async def get_platform_stats(
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get platform-wide review statistics"""
    try:
        # Platform reviews stats
        platform_pipeline = [
            {
                "$match": {
                    "review_type": "platform",
                    "is_public": True
                }
            },
            {
                MONGO_GROUP: {
                    "_id": None,
                    "average_rating": {MONGO_AVG: FIELD_RATING},
                    "total_reviews": {MONGO_SUM: 1},
                    "rating_1": {MONGO_SUM: {MONGO_COND: [{MONGO_EQ: [FIELD_RATING, 1]}, 1, 0]}},
                    "rating_2": {MONGO_SUM: {MONGO_COND: [{MONGO_EQ: [FIELD_RATING, 2]}, 1, 0]}},
                    "rating_3": {MONGO_SUM: {MONGO_COND: [{MONGO_EQ: [FIELD_RATING, 3]}, 1, 0]}},
                    "rating_4": {MONGO_SUM: {MONGO_COND: [{MONGO_EQ: [FIELD_RATING, 4]}, 1, 0]}},
                    "rating_5": {MONGO_SUM: {MONGO_COND: [{MONGO_EQ: [FIELD_RATING, 5]}, 1, 0]}}
                }
            }
        ]
        
        platform_stats = await db.reviews.aggregate(platform_pipeline).to_list(length=1)
        
        # Overall stats (all review types)
        overall_stats = await db.reviews.aggregate([
            {"$match": {"is_public": True}},
            {
                "$group": {
                    "_id": None,
                    "total_reviews": {"$sum": 1},
                    "average_rating": {"$avg": "$rating"}
                }
            }
        ]).to_list(length=1)
        
        return StandardResponse(
            success=True,
            data={
                "platform_reviews": platform_stats[0] if platform_stats else {
                    "average_rating": 0.0,
                    "total_reviews": 0,
                    "rating_distribution": {
                        "1": 0, "2": 0, "3": 0, "4": 0, "5": 0
                    }
                },
                "overall_stats": {
                    "total_reviews": overall_stats[0]["total_reviews"] if overall_stats else 0,
                    "average_rating": round(overall_stats[0]["average_rating"], 2) if overall_stats else 0.0
                }
            }
        )
        
    except Exception as e:
        logger.error(f"Get platform stats error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch platform stats"
        )
