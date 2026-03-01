"""
Booking Service - Handles booking business logic
Includes location-based attendance verification
"""
from typing import Dict, Tuple
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
import math
import logging

from app.core.exceptions import ValidationError, NotFoundError
from app.models.database import BookingStatus, AttendanceConfirmation
from app.services.websocket_manager import ConnectionManager

logger = logging.getLogger(__name__)


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points on Earth using the Haversine formula.
    
    Args:
        lat1, lon1: Coordinates of first point (in degrees)
        lat2, lon2: Coordinates of second point (in degrees)
    
    Returns:
        Distance in meters
    
    Reference: https://en.wikipedia.org/wiki/Haversine_formula
    """
    # Earth's radius in meters
    EARTH_RADIUS_M = 6371000
    
    # Convert degrees to radians
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    # Haversine formula
    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    )
    c = 2 * math.asin(math.sqrt(a))
    
    distance = EARTH_RADIUS_M * c
    return distance


async def verify_location_and_mark_arrival(
    db: AsyncIOMotorDatabase,
    booking_id: str,
    acharya_id: str,
    current_coords: Dict[str, float],
    websocket_manager: ConnectionManager,
) -> Dict[str, any]:
    """
    Verify Acharya's location and mark arrival for a booking.
    
    Implements event-driven attendance verification:
    1. Validates the Acharya's current location is within 150m of booking location
    2. Updates booking attendance status to "present"
    3. Broadcasts arrival notification to the Grihasta via WebSocket
    
    Args:
        db: MongoDB database instance
        booking_id: The booking ID to verify
        acharya_id: The Acharya attempting to mark arrival
        current_coords: Dict with 'lat' and 'lng' keys (Acharya's current position)
        websocket_manager: WebSocket manager for real-time notifications
    
    Returns:
        Updated booking document
    
    Raises:
        NotFoundError: If booking not found
        ValidationError: If Acharya is outside the 150m radius (code: BKG_004)
        ValidationError: If Acharya ID doesn't match booking
    
    Example:
        >>> await verify_location_and_mark_arrival(
        ...     db, 
        ...     "507f1f77bcf86cd799439011",
        ...     "507f1f77bcf86cd799439012",
        ...     {"lat": 12.9716, "lng": 77.5946},
        ...     websocket_manager
        ... )
    """
    # Validate input coordinates
    if not current_coords or "lat" not in current_coords or "lng" not in current_coords:
        raise ValidationError(
            message="Invalid coordinates format. Expected {'lat': float, 'lng': float}",
            error_code="BKG_005",
        )
    
    try:
        booking_oid = ObjectId(booking_id)
    except Exception:
        raise ValidationError(
            message="Invalid booking ID format",
            error_code="BKG_001",
        )
    
    # Fetch the booking
    booking = await db.bookings.find_one({"_id": booking_oid})
    if not booking:
        raise NotFoundError(
            message=f"Booking {booking_id} not found",
            error_code="BKG_002",
        )
    
    # Verify the Acharya is assigned to this booking
    if str(booking["acharya_id"]) != acharya_id:
        raise ValidationError(
            message="You are not authorized to mark arrival for this booking",
            error_code="BKG_003",
        )
    
    # Extract booking location coordinates
    location = booking.get("location")
    if not location or not location.get("latitude") or not location.get("longitude"):
        raise ValidationError(
            message="Booking location coordinates not available",
            error_code="BKG_006",
        )
    
    booking_lat = location["latitude"]
    booking_lng = location["longitude"]
    current_lat = current_coords["lat"]
    current_lng = current_coords["lng"]
    
    # Calculate distance using Haversine formula
    distance_meters = haversine_distance(
        booking_lat, booking_lng, current_lat, current_lng
    )
    
    # Validate 150m radius requirement
    RADIUS_THRESHOLD_M = 150
    if distance_meters > RADIUS_THRESHOLD_M:
        logger.warning(
            f"Acharya {acharya_id} attempted arrival for booking {booking_id} "
            f"but is {distance_meters:.1f}m away (threshold: {RADIUS_THRESHOLD_M}m)"
        )
        raise ValidationError(
            message=f"You are {distance_meters:.0f}m away from the booking location. "
                    f"Please arrive within {RADIUS_THRESHOLD_M}m to mark your arrival.",
            error_code="BKG_004",
        )
    
    # Update booking with attendance confirmation
    current_time = datetime.now(timezone.utc)
    
    update_result = await db.bookings.update_one(
        {"_id": booking_oid},
        {
            "$set": {
                "attendance.acharya_confirmed": True,
                "attendance.acharya_timestamp": current_time,
                "status": BookingStatus.IN_PROGRESS.value,
                "started_at": current_time,
                "updated_at": current_time,
            }
        },
    )
    
    if update_result.modified_count == 0:
        logger.error(f"Failed to update booking {booking_id} attendance")
        raise ValidationError(
            message="Failed to mark arrival. Please try again.",
            error_code="BKG_007",
        )
    
    logger.info(
        f"Acharya {acharya_id} marked arrival for booking {booking_id} "
        f"(distance: {distance_meters:.1f}m)"
    )
    
    # Broadcast real-time notification to Grihasta
    grihasta_id = str(booking["grihasta_id"])
    await websocket_manager.send_personal_message(
        grihasta_id,
        {
            "type": "acharya_arrived",
            "booking_id": booking_id,
            "message": "Your Acharya has arrived at the location",
            "timestamp": current_time.isoformat(),
            "distance_meters": round(distance_meters, 1),
        },
    )
    
    # Fetch and return updated booking
    updated_booking = await db.bookings.find_one({"_id": booking_oid})
    return updated_booking
