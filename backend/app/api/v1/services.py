"""
Hindu Services API Endpoints
Complete CRUD + Booking operations
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Dict, Any, Optional
import logging
import re
from datetime import datetime, timezone
from bson import ObjectId
from pydantic import BaseModel

from app.core.security import get_current_user
from app.core.constants import MONGO_REGEX
from app.db.connection import get_db
from app.models.services import ServiceBookingType, Service
from app.schemas.requests import StandardResponse
from app.core.exceptions import ResourceNotFoundError, InvalidInputError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/services", tags=["Services"])


class BookingCreate(BaseModel):
    booking_type: str
    selected_date: datetime
    selected_time_slot: str
    acharya_id: Optional[str] = None
    venue_address: Optional[Dict[str, Any]] = None
    contact_number: str
    alternate_number: Optional[str] = None
    special_requests: Optional[str] = None
    muhurta_details: Optional[Dict[str, Any]] = {}


class CancellationRequest(BaseModel):
    cancellation_reason: str


@router.get(
    "",
    response_model=StandardResponse,
    summary="Get All Services",
    description="Retrieve all active spiritual services with optional filtering",
)
async def get_services(
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, le=100),
    skip: int = 0,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get all services with optional filtering"""
    try:
        query = {"is_active": True}

        if category:
            query["category"] = category

        if search:
            escaped_search = re.escape(search)
            regex_pattern = re.compile(escaped_search, re.IGNORECASE)
            query["$or"] = [
                {"name_english": {MONGO_REGEX: regex_pattern}},
                {"name_sanskrit": {MONGO_REGEX: regex_pattern}},
                {"short_description": {MONGO_REGEX: regex_pattern}},
            ]

        services = (
            await db.services.find(query)
            .sort("popularity_score", -1)
            .skip(skip)
            .limit(limit)
            .to_list(length=limit)
        )
        total = await db.services.count_documents(query)
        
        # Convert raw documents to Pydantic models to handle _id serialization
        services_list = [Service(**service) for service in services]

        return StandardResponse(
            success=True,
            data={"services": services_list, "total": total, "skip": skip, "limit": limit},
        )
    except Exception as e:
        logger.error(f"Error fetching services: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch services")


@router.get(
    "/categories",
    response_model=StandardResponse,
    summary="Get Service Categories",
    description="Get list of all service categories with counts",
)
async def get_categories(db: AsyncIOMotorDatabase = Depends(get_db)):
    """Get all service categories"""
    try:
        pipeline = [
            {"$match": {"is_active": True}},
            {
                "$group": {
                    "_id": "$category",
                    "count": {"$sum": 1},
                    "services": {
                        "$push": {
                            "id": {"$toString": "$_id"},
                            "name_english": "$name_english",
                            "icon": "$icon",
                        }
                    },
                }
            },
        ]

        categories = await db.services.aggregate(pipeline).to_list(length=None)

        return StandardResponse(success=True, data={"categories": categories})
    except Exception as e:
        logger.error(f"Error fetching categories: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch categories")


@router.get(
    "/bookings/my-bookings",
    response_model=StandardResponse,
    summary="Get User's Service Bookings",
    description="Retrieve all service bookings for current user",
)
async def get_my_service_bookings(
    status_filter: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get user's service bookings"""
    try:
        query = {"user_id": ObjectId(current_user["id"])}

        if status_filter:
            query["status"] = status_filter

        bookings = (
            await db.service_bookings.find(query)
            .sort("created_at", -1)
            .to_list(length=100)
        )

        # Enrich with service details
        for booking in bookings:
            service = await db.services.find_one({"_id": booking["service_id"]})
            if service:
                booking["service_name"] = service.get("name_english")
                booking["service_icon"] = service.get("icon")

        return StandardResponse(success=True, data={"bookings": bookings})
    except Exception as e:
        logger.error(f"Error fetching user bookings: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch bookings")


@router.get(
    "/{service_id}",
    response_model=StandardResponse,
    summary="Get Service Details",
    description="Get complete details of a specific service",
)
async def get_service(service_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Get service by ID"""
    try:
        if not ObjectId.is_valid(service_id):
            raise HTTPException(status_code=400, detail="Invalid service ID format")

        service = await db.services.find_one({"_id": ObjectId(service_id)})

        if not service:
            raise ResourceNotFoundError(resource_type="Service", resource_id=service_id)

        # Increment view count
        await db.services.update_one(
            {"_id": ObjectId(service_id)}, {"$inc": {"popularity_score": 1}}
        )

        return StandardResponse(success=True, data={"service": service})
    except ResourceNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error fetching service: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch service")


@router.post(
    "/{service_id}/booking",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Service Booking",
    description="Book a service with selected options",
)
async def create_service_booking(
    service_id: str,
    booking_request: BookingCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Create a service booking"""
    try:
        # Validate service exists
        service = await db.services.find_one({"_id": ObjectId(service_id)})
        if not service:
            raise ResourceNotFoundError(resource_type="Service", resource_id=service_id)

        # Validate booking type
        if booking_request.booking_type not in [bt.value for bt in ServiceBookingType]:
            raise InvalidInputError(
                message="Invalid booking type", field="booking_type"
            )

        # Calculate pricing based on booking type
        if (
            booking_request.booking_type
            == ServiceBookingType.MUHURTA_CONSULTATION.value
        ):
            base_price = service.get("muhurta_consultation_price", 99.0)
        elif booking_request.booking_type == ServiceBookingType.FULL_SERVICE.value:
            base_price = service.get("full_service_base_price", 2100.0)
        else:  # CUSTOM_ACHARYA
            base_price = service.get("custom_acharya_base_price", 1500.0)

        platform_fee = base_price * 0.1  # 10% platform fee
        taxes = (base_price + platform_fee) * 0.18  # 18% GST
        total_amount = base_price + platform_fee + taxes

        # Create booking document
        booking = {
            "service_id": ObjectId(service_id),
            "user_id": ObjectId(current_user["id"]),
            "booking_type": booking_request.booking_type,
            "selected_date": booking_request.selected_date,
            "selected_time_slot": booking_request.selected_time_slot,
            "muhurta_details": booking_request.muhurta_details.dict()
            if booking_request.muhurta_details
            else {},
            "acharya_id": ObjectId(booking_request.acharya_id)
            if booking_request.acharya_id
            else None,
            "is_platform_assigned": booking_request.acharya_id is None,
            "venue_address": booking_request.venue_address.dict()
            if booking_request.venue_address
            else {},
            "contact_number": booking_request.contact_number,
            "alternate_number": booking_request.alternate_number,
            "base_price": base_price,
            "platform_fee": platform_fee,
            "taxes": taxes,
            "total_amount": total_amount,
            "payment_status": "pending",
            "status": "pending",
            "special_requests": booking_request.special_requests,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }

        result = await db.service_bookings.insert_one(booking)
        booking["_id"] = str(result.inserted_id)

        # Update service booking count
        await db.services.update_one(
            {"_id": ObjectId(service_id)}, {"$inc": {"total_bookings": 1}}
        )

        logger.info(
            f"Service booking created: {result.inserted_id} by user {current_user['id']}"
        )

        return StandardResponse(
            success=True,
            data={
                "booking_id": str(result.inserted_id),
                "total_amount": total_amount,
                "status": "pending",
            },
            message="Booking created successfully. Proceed to payment.",
        )

    except (ResourceNotFoundError, InvalidInputError):
        raise
    except Exception as e:
        logger.error(f"Error creating service booking: {e}")
        raise HTTPException(status_code=500, detail="Failed to create booking")


@router.get(
    "/bookings/{booking_id}",
    response_model=StandardResponse,
    summary="Get Service Booking Details",
    description="Get complete details of a service booking",
)
async def get_service_booking(
    booking_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get booking details"""
    try:
        booking = await db.service_bookings.find_one({"_id": ObjectId(booking_id)})

        if not booking:
            raise ResourceNotFoundError(resource_type="Booking", resource_id=booking_id)

        # Check authorization
        if (
            str(booking["user_id"]) != current_user["id"]
            and current_user["role"] != "admin"
        ):
            raise HTTPException(
                status_code=403, detail="Not authorized to view this booking"
            )

        # Enrich with service and acharya details
        service = await db.services.find_one({"_id": booking["service_id"]})
        if service:
            booking["service_details"] = service

        if booking.get("acharya_id"):
            acharya = await db.users.find_one({"_id": booking["acharya_id"]})
            if acharya:
                booking["acharya_details"] = {
                    "name": acharya.get("full_name"),
                    "photo": acharya.get("profile_photo"),
                }

        return StandardResponse(success=True, data={"booking": booking})
    except ResourceNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error fetching booking: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch booking")


@router.post(
    "/bookings/{booking_id}/cancel",
    response_model=StandardResponse,
    summary="Cancel Service Booking",
    description="Cancel a service booking",
)
async def cancel_service_booking(
    booking_id: str,
    request: CancellationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Cancel a service booking"""
    try:
        booking = await db.service_bookings.find_one({"_id": ObjectId(booking_id)})

        if not booking:
            raise ResourceNotFoundError(resource_type="Booking", resource_id=booking_id)

        # Check authorization
        if str(booking["user_id"]) != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")

        # Check if cancellable
        if booking["status"] in ["completed", "cancelled"]:
            raise InvalidInputError(
                message="Cannot cancel this booking", field="status"
            )

        # Update booking
        await db.service_bookings.update_one(
            {"_id": ObjectId(booking_id)},
            {
                "$set": {
                    "status": "cancelled",
                    "cancelled_at": datetime.now(timezone.utc),
                    "cancellation_reason": request.reason,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

        logger.info(f"Service booking cancelled: {booking_id}")

        return StandardResponse(success=True, message="Booking cancelled successfully")
    except (ResourceNotFoundError, InvalidInputError):
        raise
    except Exception as e:
        logger.error(f"Error cancelling booking: {e}")
        raise HTTPException(status_code=500, detail="Failed to cancel booking")
