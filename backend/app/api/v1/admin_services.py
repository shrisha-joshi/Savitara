"""
Admin Services Management API
CRUD operations for services catalog
"""
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Dict, Any, Optional, List
import logging
from datetime import datetime, timezone
from bson import ObjectId
from pydantic import BaseModel, Field, validator
from enum import Enum

from app.core.security import get_current_admin
from app.db.connection import get_db
from app.schemas.requests import StandardResponse
from app.core.exceptions import ResourceNotFoundError, InvalidInputError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/services", tags=["Admin - Services"])

class ServiceCreate(BaseModel):
    name_english: str = Field(..., min_length=3)
    name_sanskrit: Optional[str] = None
    description: str = Field(..., min_length=10)
    category_id: str
    icon: Optional[str] = None
    muhurta_consultation_price: float = Field(..., gt=0)
    full_service_base_price: float = Field(..., gt=0)
    custom_acharya_base_price: float = Field(..., gt=0)
    included_items: List[str] = []
    requirements_from_user: List[str] = []
    duration_minutes: int = Field(..., gt=0)
    is_active: bool = True
    
    @validator('category_id')
    def validate_category_id(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError('Invalid category_id format')
        return v

class ServiceUpdate(BaseModel):
    name_english: Optional[str] = Field(None, min_length=3)
    name_sanskrit: Optional[str] = None
    description: Optional[str] = Field(None, min_length=10)
    category_id: Optional[str] = None
    icon: Optional[str] = None
    muhurta_consultation_price: Optional[float] = Field(None, gt=0)
    full_service_base_price: Optional[float] = Field(None, gt=0)
    custom_acharya_base_price: Optional[float] = Field(None, gt=0)
    included_items: Optional[List[str]] = None
    requirements_from_user: Optional[List[str]] = None
    duration_minutes: Optional[int] = Field(None, gt=0)
    is_active: Optional[bool] = None
    
    @validator('category_id')
    def validate_category_id(cls, v):
        if v and not ObjectId.is_valid(v):
            raise ValueError('Invalid category_id format')
        return v

class BookingStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed" 
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REJECTED = "rejected"

class BookingStatusUpdate(BaseModel):
    status: BookingStatus
    notes: Optional[str] = None


@router.post(
    "",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create New Service",
    description="Admin: Create a new spiritual service"
)
async def create_service(
    service_in: ServiceCreate,
    current_admin: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Create new service"""
    try:
        service_data = service_in.model_dump()
        service_data["category_id"] = ObjectId(service_data["category_id"])
        service_data["created_by"] = ObjectId(current_admin["id"])
        service_data["updated_by"] = ObjectId(current_admin["id"])
        service_data["created_at"] = datetime.now(timezone.utc)
        service_data["updated_at"] = datetime.now(timezone.utc)
        service_data["popularity_score"] = 0
        service_data["total_bookings"] = 0
        service_data["average_rating"] = 0.0
        
        result = await db.services.insert_one(service_data)
        
        logger.info(f"Service created: {result.inserted_id} by admin {current_admin['id']}")
        
        return StandardResponse(
            success=True,
            data={"service_id": str(result.inserted_id)},
            message="Service created successfully"
        )
    except Exception as e:
        logger.error(f"Error creating service: {e}")
        raise HTTPException(status_code=500, detail="Failed to create service")


@router.put(
    "/{service_id}",
    response_model=StandardResponse,
    summary="Update Service",
    description="Admin: Update existing service"
)
async def update_service(
    service_id: str,
    service_in: ServiceUpdate,
    current_admin: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Update service"""
    try:
        service = await db.services.find_one({"_id": ObjectId(service_id)})
        if not service:
            raise ResourceNotFoundError(resource_type="Service", resource_id=service_id)
        
        update_data = service_in.model_dump(exclude_unset=True)
        
        if "category_id" in update_data:
             update_data["category_id"] = ObjectId(update_data["category_id"])
             
        update_data["updated_by"] = ObjectId(current_admin["id"])
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        await db.services.update_one(
            {"_id": ObjectId(service_id)},
            {"$set": update_data}
        )
        
        logger.info(f"Service updated: {service_id} by admin {current_admin['id']}")
        
        return StandardResponse(
            success=True,
            message="Service updated successfully"
        )
    except ResourceNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error updating service: {e}")
        raise HTTPException(status_code=500, detail="Failed to update service")


@router.delete(
    "/{service_id}",
    response_model=StandardResponse,
    summary="Delete Service",
    description="Admin: Soft delete a service (set inactive)"
)
async def delete_service(
    service_id: str,
    current_admin: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Soft delete service"""
    try:
        service = await db.services.find_one({"_id": ObjectId(service_id)})
        if not service:
            raise ResourceNotFoundError(resource_type="Service", resource_id=service_id)
        
        await db.services.update_one(
            {"_id": ObjectId(service_id)},
            {
                "$set": {
                    "is_active": False,
                    "updated_by": ObjectId(current_admin["id"]),
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        logger.info(f"Service deleted: {service_id} by admin {current_admin['id']}")
        
        return StandardResponse(
            success=True,
            message="Service deleted successfully"
        )
    except ResourceNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error deleting service: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete service")


@router.get(
    "/bookings/all",
    response_model=StandardResponse,
    summary="Get All Service Bookings",
    description="Admin: View all service bookings with filtering"
)
async def get_all_service_bookings(
    status_filter: str = None,
    booking_type: str = None,
    limit: int = 100,
    skip: int = 0,
    current_admin: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get all service bookings"""
    try:
        query = {}
        if status_filter:
            query["status"] = status_filter
        if booking_type:
            query["booking_type"] = booking_type
        
        bookings = await db.service_bookings.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
        total = await db.service_bookings.count_documents(query)
        
        # Enrich with user and service details
        for booking in bookings:
            user = await db.users.find_one({"_id": booking["user_id"]})
            service = await db.services.find_one({"_id": booking["service_id"]})
            
            if user:
                booking["user_name"] = user.get("full_name")
                booking["user_phone"] = user.get("phone")
            
            if service:
                booking["service_name"] = service.get("name_english")
        
        return StandardResponse(
            success=True,
            data={
                "bookings": bookings,
                "total": total,
                "skip": skip,
                "limit": limit
            }
        )
    except Exception as e:
        logger.error(f"Error fetching bookings: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch bookings")


@router.patch(
    "/bookings/{booking_id}/status",
    response_model=StandardResponse,
    summary="Update Booking Status",
    description="Admin: Update service booking status"
)
async def update_booking_status(
    booking_id: str,
    status_update: BookingStatusUpdate,
    current_admin: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Update booking status"""
    try:
        booking = await db.service_bookings.find_one({"_id": ObjectId(booking_id)})
        if not booking:
            raise ResourceNotFoundError(resource_type="Booking", resource_id=booking_id)
        
        new_status = status_update.status.value
        
        update_data = {
            "status": new_status,
            "updated_at": datetime.now(timezone.utc)
        }
        
        if status_update.notes:
            update_data["admin_notes"] = status_update.notes
        
        if new_status == BookingStatus.CONFIRMED.value:
            update_data["confirmed_at"] = datetime.now(timezone.utc)
        elif new_status == BookingStatus.COMPLETED.value:
            update_data["completed_at"] = datetime.now(timezone.utc)
        elif new_status == BookingStatus.CANCELLED.value:
            update_data["cancelled_at"] = datetime.now(timezone.utc)
            if status_update.notes:
                 update_data["cancellation_reason"] = status_update.notes
        
        await db.service_bookings.update_one(
            {"_id": ObjectId(booking_id)},
            {"$set": update_data}
        )
        
        logger.info(f"Booking status updated: {booking_id} to {new_status} by admin {current_admin['id']}")
        
        return StandardResponse(
            success=True,
            message=f"Booking status updated to {new_status}"
        )
    except ResourceNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error updating booking status: {e}")
        raise HTTPException(status_code=500, detail="Failed to update booking status")


@router.post(
    "/bookings/{booking_id}/assign-acharya",
    response_model=StandardResponse,
    summary="Assign Acharya to Booking",
    description="Admin: Assign an Acharya to a service booking"
)
async def assign_acharya_to_booking(
    booking_id: str,
    acharya_id: str,
    current_admin: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Assign Acharya to booking"""
    try:
        booking = await db.service_bookings.find_one({"_id": ObjectId(booking_id)})
        if not booking:
            raise ResourceNotFoundError(resource_type="Booking", resource_id=booking_id)
        
        # Verify Acharya exists
        acharya = await db.users.find_one({"_id": ObjectId(acharya_id), "role": "acharya"})
        if not acharya:
            raise ResourceNotFoundError(resource_type="Acharya", resource_id=acharya_id)
        
        await db.service_bookings.update_one(
            {"_id": ObjectId(booking_id)},
            {
                "$set": {
                    "acharya_id": ObjectId(acharya_id),
                    "is_platform_assigned": True,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        logger.info(f"Acharya assigned to booking: {booking_id} -> {acharya_id}")
        
        return StandardResponse(
            success=True,
            message="Acharya assigned successfully"
        )
    except ResourceNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error assigning Acharya: {e}")
        raise HTTPException(status_code=500, detail="Failed to assign Acharya")
