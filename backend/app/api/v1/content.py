"""
Content Management API Endpoints
Handles testimonials, announcements, and site content management
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime, timezone
from bson import ObjectId
from pydantic import BaseModel, Field

from app.schemas.requests import StandardResponse
from app.core.security import get_current_admin
from app.db.connection import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/content", tags=["Content Management"])


# Pydantic models for content
class TestimonialCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    location: str = Field(..., min_length=1, max_length=100)
    avatar: Optional[str] = ""
    rating: int = Field(5, ge=1, le=5)
    text: str = Field(..., min_length=10, max_length=500)
    service: str = Field(..., min_length=1, max_length=50)
    is_active: bool = True


class TestimonialUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    avatar: Optional[str] = None
    rating: Optional[int] = Field(None, ge=1, le=5)
    text: Optional[str] = None
    service: Optional[str] = None
    is_active: Optional[bool] = None


class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1, max_length=1000)
    type: str = Field("info", pattern="^(info|warning|success|error)$")
    is_active: bool = True
    priority: int = Field(0, ge=0, le=10)


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    type: Optional[str] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None


class ToggleStatus(BaseModel):
    is_active: bool


# ==================== TESTIMONIALS ====================

@router.get(
    "/testimonials",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get All Testimonials",
    description="Get all testimonials for admin management"
)
async def get_testimonials(
    current_user: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get all testimonials"""
    try:
        testimonials = await db.testimonials.find().sort("created_at", -1).to_list(length=100)
        
        # Convert ObjectId to string
        for t in testimonials:
            t["_id"] = str(t["_id"])
        
        return StandardResponse(
            success=True,
            data=testimonials,
            message=f"Found {len(testimonials)} testimonials"
        )
    except Exception as e:
        logger.error(f"Get testimonials error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch testimonials"
        )


@router.post(
    "/testimonials",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Testimonial",
    description="Create a new testimonial"
)
async def create_testimonial(
    testimonial: TestimonialCreate,
    current_user: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Create a new testimonial"""
    try:
        testimonial_doc = {
            **testimonial.model_dump(),
            "created_at": datetime.now(timezone.utc),
            "created_by": current_user.get("id") or current_user.get("email"),
            "updated_at": datetime.now(timezone.utc)
        }
        
        result = await db.testimonials.insert_one(testimonial_doc)
        testimonial_doc["_id"] = str(result.inserted_id)
        
        logger.info(f"Testimonial created by {current_user.get('email')}")
        
        return StandardResponse(
            success=True,
            data=testimonial_doc,
            message="Testimonial created successfully"
        )
    except Exception as e:
        logger.error(f"Create testimonial error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create testimonial"
        )


@router.put(
    "/testimonials/{testimonial_id}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Testimonial",
    description="Update an existing testimonial"
)
async def update_testimonial(
    testimonial_id: str,
    testimonial: TestimonialUpdate,
    current_user: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Update a testimonial"""
    try:
        # Check if exists
        existing = await db.testimonials.find_one({"_id": ObjectId(testimonial_id)})
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Testimonial not found"
            )
        
        # Build update data
        update_data = {k: v for k, v in testimonial.model_dump().items() if v is not None}
        update_data["updated_at"] = datetime.now(timezone.utc)
        update_data["updated_by"] = current_user.get("id") or current_user.get("email")
        
        await db.testimonials.update_one(
            {"_id": ObjectId(testimonial_id)},
            {"$set": update_data}
        )
        
        logger.info(f"Testimonial {testimonial_id} updated by {current_user.get('email')}")
        
        return StandardResponse(
            success=True,
            message="Testimonial updated successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update testimonial error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update testimonial"
        )


@router.patch(
    "/testimonials/{testimonial_id}/toggle",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Toggle Testimonial Status",
    description="Toggle testimonial visibility"
)
async def toggle_testimonial(
    testimonial_id: str,
    toggle: ToggleStatus,
    current_user: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Toggle testimonial active status"""
    try:
        result = await db.testimonials.update_one(
            {"_id": ObjectId(testimonial_id)},
            {
                "$set": {
                    "is_active": toggle.is_active,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Testimonial not found"
            )
        
        return StandardResponse(
            success=True,
            message=f"Testimonial {'activated' if toggle.is_active else 'deactivated'}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Toggle testimonial error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to toggle testimonial"
        )


@router.delete(
    "/testimonials/{testimonial_id}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete Testimonial",
    description="Delete a testimonial"
)
async def delete_testimonial(
    testimonial_id: str,
    current_user: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Delete a testimonial"""
    try:
        result = await db.testimonials.delete_one({"_id": ObjectId(testimonial_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Testimonial not found"
            )
        
        logger.info(f"Testimonial {testimonial_id} deleted by {current_user.get('email')}")
        
        return StandardResponse(
            success=True,
            message="Testimonial deleted successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete testimonial error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete testimonial"
        )


# ==================== ANNOUNCEMENTS ====================

@router.get(
    "/announcements",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get All Announcements",
    description="Get all announcements for admin management"
)
async def get_announcements(
    current_user: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get all announcements"""
    try:
        announcements = await db.announcements.find().sort([("priority", -1), ("created_at", -1)]).to_list(length=100)
        
        for a in announcements:
            a["_id"] = str(a["_id"])
        
        return StandardResponse(
            success=True,
            data=announcements,
            message=f"Found {len(announcements)} announcements"
        )
    except Exception as e:
        logger.error(f"Get announcements error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch announcements"
        )


@router.post(
    "/announcements",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Announcement",
    description="Create a new announcement"
)
async def create_announcement(
    announcement: AnnouncementCreate,
    current_user: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Create a new announcement"""
    try:
        announcement_doc = {
            **announcement.model_dump(),
            "created_at": datetime.now(timezone.utc),
            "created_by": current_user.get("id") or current_user.get("email"),
            "updated_at": datetime.now(timezone.utc)
        }
        
        result = await db.announcements.insert_one(announcement_doc)
        announcement_doc["_id"] = str(result.inserted_id)
        
        logger.info(f"Announcement created by {current_user.get('email')}")
        
        return StandardResponse(
            success=True,
            data=announcement_doc,
            message="Announcement created successfully"
        )
    except Exception as e:
        logger.error(f"Create announcement error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create announcement"
        )


@router.put(
    "/announcements/{announcement_id}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Announcement",
    description="Update an existing announcement"
)
async def update_announcement(
    announcement_id: str,
    announcement: AnnouncementUpdate,
    current_user: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Update an announcement"""
    try:
        existing = await db.announcements.find_one({"_id": ObjectId(announcement_id)})
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Announcement not found"
            )
        
        update_data = {k: v for k, v in announcement.model_dump().items() if v is not None}
        update_data["updated_at"] = datetime.now(timezone.utc)
        update_data["updated_by"] = current_user.get("id") or current_user.get("email")
        
        await db.announcements.update_one(
            {"_id": ObjectId(announcement_id)},
            {"$set": update_data}
        )
        
        logger.info(f"Announcement {announcement_id} updated by {current_user.get('email')}")
        
        return StandardResponse(
            success=True,
            message="Announcement updated successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update announcement error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update announcement"
        )


@router.delete(
    "/announcements/{announcement_id}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete Announcement",
    description="Delete an announcement"
)
async def delete_announcement(
    announcement_id: str,
    current_user: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Delete an announcement"""
    try:
        result = await db.announcements.delete_one({"_id": ObjectId(announcement_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Announcement not found"
            )
        
        logger.info(f"Announcement {announcement_id} deleted by {current_user.get('email')}")
        
        return StandardResponse(
            success=True,
            message="Announcement deleted successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete announcement error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete announcement"
        )


# ==================== NOTIFICATION HISTORY ====================

@router.get(
    "/notifications/history",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Notification History",
    description="Get broadcast notification history"
)
async def get_notification_history(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get notification history"""
    try:
        skip = (page - 1) * limit
        
        notifications = await db.notification_history.find().sort("sent_at", -1).skip(skip).limit(limit).to_list(length=limit)
        
        for n in notifications:
            n["_id"] = str(n["_id"])
        
        total = await db.notification_history.count_documents({})
        
        return StandardResponse(
            success=True,
            data=notifications,
            message=f"Found {len(notifications)} notifications"
        )
    except Exception as e:
        logger.error(f"Get notification history error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch notification history"
        )


# ==================== PUBLIC ENDPOINTS (for user website) ====================

# Create a separate router for public content endpoints
public_router = APIRouter(prefix="/content", tags=["Public Content"])


@public_router.get(
    "/testimonials",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Active Testimonials",
    description="Get active testimonials for public display"
)
async def get_public_testimonials(
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get active testimonials for public display"""
    try:
        testimonials = await db.testimonials.find(
            {"is_active": True}
        ).sort("created_at", -1).limit(10).to_list(length=10)
        
        for t in testimonials:
            t["_id"] = str(t["_id"])
            # Remove internal fields
            t.pop("created_by", None)
            t.pop("updated_by", None)
        
        return StandardResponse(
            success=True,
            data=testimonials
        )
    except Exception as e:
        logger.error(f"Get public testimonials error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch testimonials"
        )


@public_router.get(
    "/announcements",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Active Announcements",
    description="Get active announcements for public display"
)
async def get_public_announcements(
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get active announcements for public display"""
    try:
        announcements = await db.announcements.find(
            {"is_active": True}
        ).sort([("priority", -1), ("created_at", -1)]).limit(5).to_list(length=5)
        
        for a in announcements:
            a["_id"] = str(a["_id"])
            a.pop("created_by", None)
            a.pop("updated_by", None)
        
        return StandardResponse(
            success=True,
            data=announcements
        )
    except Exception as e:
        logger.error(f"Get public announcements error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch announcements"
        )
