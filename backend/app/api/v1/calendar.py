"""
Calendar API Endpoints
Manages Acharya schedules, Grihasta calendars, and availability
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime, timedelta
from bson import ObjectId

from app.schemas.requests import StandardResponse
from app.schemas.calendar import (
    AcharyaScheduleUpdate,
    BlockDatesRequest,
    CalendarEventCreate,
    CalendarEventUpdate,
    AvailabilityCheckRequest
)
from app.core.security import get_current_user, get_current_acharya, get_current_grihasta
from app.db.connection import get_db
from app.models.database import AcharyaSchedule, GrihastaCalendarEvent, ScheduleSlot

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/calendar", tags=["Calendar"])


# ============================================================================
# ACHARYA CALENDAR ENDPOINTS
# ============================================================================

@router.get(
    "/acharya/{acharya_id}/schedule",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Acharya Schedule",
    description="Get Acharya's schedule for a specific month"
)
async def get_acharya_schedule(
    acharya_id: str,
    year: int = Query(..., ge=2020, le=2050),
    month: int = Query(..., ge=1, le=12),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get Acharya's schedule for a month"""
    try:
        # Validate acharya_id
        if not ObjectId.is_valid(acharya_id):
            raise HTTPException(status_code=400, detail="Invalid acharya_id")
        
        # Calculate date range for month
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        
        # Fetch schedule from database
        schedules = await db.acharya_schedules.find({
            "acharya_id": ObjectId(acharya_id),
            "date": {"$gte": start_date, "$lt": end_date}
        }).to_list(None)
        
        return StandardResponse(
            success=True,
            message=f"Schedule for {year}-{month:02d} retrieved successfully",
            data={
                "acharya_id": acharya_id,
                "year": year,
                "month": month,
                "schedules": schedules
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching Acharya schedule: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch schedule: {str(e)}")


@router.post(
    "/acharya/{acharya_id}/schedule",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Update Acharya Schedule",
    description="Create or update Acharya's schedule for a day"
)
async def update_acharya_schedule(
    acharya_id: str,
    schedule_data: AcharyaScheduleUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_acharya)
):
    """Update Acharya's schedule"""
    try:
        # Verify user is updating their own schedule or is admin
        if str(current_user.get("_id")) != acharya_id and current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Not authorized to update this schedule")
        
        # Validate acharya_id
        if not ObjectId.is_valid(acharya_id):
            raise HTTPException(status_code=400, detail="Invalid acharya_id")
        
        # Prepare schedule document
        schedule_doc = {
            "acharya_id": ObjectId(acharya_id),
            "date": schedule_data.date.replace(hour=0, minute=0, second=0, microsecond=0),
            "region": current_user.get("region", "IN-KA"),
            "slots": [slot.dict() for slot in schedule_data.slots],
            "working_hours": schedule_data.working_hours,
            "is_day_blocked": schedule_data.is_day_blocked,
            "blocked_reason": schedule_data.blocked_reason,
            "updated_at": datetime.utcnow()
        }
        
        # Upsert schedule
        result = await db.acharya_schedules.update_one(
            {
                "acharya_id": ObjectId(acharya_id),
                "date": schedule_data.date.replace(hour=0, minute=0, second=0, microsecond=0)
            },
            {
                "$set": schedule_doc,
                "$setOnInsert": {"created_at": datetime.utcnow()}
            },
            upsert=True
        )
        
        return StandardResponse(
            success=True,
            message="Schedule updated successfully",
            data={
                "acharya_id": acharya_id,
                "date": schedule_data.date.isoformat(),
                "modified_count": result.modified_count,
                "upserted": result.upserted_id is not None
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating Acharya schedule: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update schedule: {str(e)}")


@router.post(
    "/acharya/{acharya_id}/block-dates",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Block Multiple Dates",
    description="Block multiple dates at once for an Acharya"
)
async def block_dates(
    acharya_id: str,
    block_request: BlockDatesRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_acharya)
):
    """Block multiple dates"""
    try:
        # Verify authorization
        if str(current_user.get("_id")) != acharya_id and current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Not authorized")
        
        if not ObjectId.is_valid(acharya_id):
            raise HTTPException(status_code=400, detail="Invalid acharya_id")
        
        blocked_count = 0
        for date in block_request.dates:
            schedule_doc = {
                "acharya_id": ObjectId(acharya_id),
                "date": date.replace(hour=0, minute=0, second=0, microsecond=0),
                "is_day_blocked": True,
                "blocked_reason": block_request.reason,
                "slots": [],
                "updated_at": datetime.utcnow()
            }
            
            await db.acharya_schedules.update_one(
                {
                    "acharya_id": ObjectId(acharya_id),
                    "date": date.replace(hour=0, minute=0, second=0, microsecond=0)
                },
                {
                    "$set": schedule_doc,
                    "$setOnInsert": {"created_at": datetime.utcnow()}
                },
                upsert=True
            )
            blocked_count += 1
        
        return StandardResponse(
            success=True,
            message=f"Successfully blocked {blocked_count} dates",
            data={
                "acharya_id": acharya_id,
                "blocked_dates": [d.isoformat() for d in block_request.dates],
                "reason": block_request.reason
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error blocking dates: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to block dates: {str(e)}")


@router.get(
    "/acharya/{acharya_id}/availability",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Check Acharya Availability",
    description="Check if Acharya is available on a specific date"
)
async def check_acharya_availability(
    acharya_id: str,
    date: datetime = Query(..., description="Date to check availability"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Check Acharya's availability for a date"""
    try:
        if not ObjectId.is_valid(acharya_id):
            raise HTTPException(status_code=400, detail="Invalid acharya_id")
        
        # Get schedule for date
        schedule = await db.acharya_schedules.find_one({
            "acharya_id": ObjectId(acharya_id),
            "date": date.replace(hour=0, minute=0, second=0, microsecond=0)
        })
        
        if not schedule:
            # No schedule means available (default behavior)
            return StandardResponse(
                success=True,
                message="No schedule found, assuming available",
                data={
                    "acharya_id": acharya_id,
                    "date": date.isoformat(),
                    "is_available": True,
                    "available_slots": [],
                    "message": "Acharya has not set schedule for this date"
                }
            )
        
        # Check if day is blocked
        if schedule.get("is_day_blocked"):
            return StandardResponse(
                success=True,
                message="Day is blocked",
                data={
                    "acharya_id": acharya_id,
                    "date": date.isoformat(),
                    "is_available": False,
                    "blocked_reason": schedule.get("blocked_reason", ""),
                    "available_slots": []
                }
            )
        
        # Get available slots
        available_slots = [
            slot for slot in schedule.get("slots", [])
            if slot.get("status") == "available"
        ]
        
        return StandardResponse(
            success=True,
            message="Availability retrieved successfully",
            data={
                "acharya_id": acharya_id,
                "date": date.isoformat(),
                "is_available": len(available_slots) > 0,
                "available_slots": available_slots,
                "working_hours": schedule.get("working_hours", {"start": "09:00", "end": "18:00"})
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking availability: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to check availability: {str(e)}")


# ============================================================================
# GRIHASTA CALENDAR ENDPOINTS
# ============================================================================

@router.get(
    "/grihasta/events",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Grihasta Calendar Events",
    description="Get all calendar events for logged-in Grihasta"
)
async def get_grihasta_events(
    year: int = Query(..., ge=2020, le=2050),
    month: int = Query(..., ge=1, le=12),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_grihasta)
):
    """Get Grihasta's calendar events"""
    try:
        user_id = current_user.get("_id")
        
        # Calculate date range
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        
        # Fetch events
        events = await db.grihasta_calendar_events.find({
            "user_id": ObjectId(user_id),
            "date": {"$gte": start_date, "$lt": end_date}
        }).to_list(None)
        
        return StandardResponse(
            success=True,
            message=f"Events for {year}-{month:02d} retrieved successfully",
            data={
                "user_id": str(user_id),
                "year": year,
                "month": month,
                "events": events,
                "count": len(events)
            }
        )
        
    except Exception as e:
        logger.error(f"Error fetching Grihasta events: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch events: {str(e)}")


@router.post(
    "/grihasta/events",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Calendar Event",
    description="Create a new calendar event for Grihasta"
)
async def create_grihasta_event(
    event_data: CalendarEventCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_grihasta)
):
    """Create new calendar event"""
    try:
        user_id = current_user.get("_id")
        
        # Prepare event document
        event_doc = {
            "user_id": ObjectId(user_id),
            "event_type": event_data.event_type,
            "title": event_data.title,
            "description": event_data.description,
            "date": event_data.date.replace(hour=0, minute=0, second=0, microsecond=0),
            "start_time": event_data.start_time,
            "end_time": event_data.end_time,
            "booking_id": ObjectId(event_data.booking_id) if event_data.booking_id else None,
            "panchanga_info": {},  # To be filled from Panchanga service
            "reminder_before": event_data.reminder_before,
            "reminder_sent": False,
            "color": event_data.color,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # Insert event
        result = await db.grihasta_calendar_events.insert_one(event_doc)
        
        return StandardResponse(
            success=True,
            message="Event created successfully",
            data={
                "event_id": str(result.inserted_id),
                "title": event_data.title,
                "date": event_data.date.isoformat()
            }
        )
        
    except Exception as e:
        logger.error(f"Error creating event: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create event: {str(e)}")


@router.put(
    "/grihasta/events/{event_id}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Calendar Event",
    description="Update an existing calendar event"
)
async def update_grihasta_event(
    event_id: str,
    event_data: CalendarEventUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_grihasta)
):
    """Update calendar event"""
    try:
        if not ObjectId.is_valid(event_id):
            raise HTTPException(status_code=400, detail="Invalid event_id")
        
        user_id = current_user.get("_id")
        
        # Build update document
        update_doc = {
            "updated_at": datetime.utcnow()
        }
        
        if event_data.title is not None:
            update_doc["title"] = event_data.title
        if event_data.description is not None:
            update_doc["description"] = event_data.description
        if event_data.start_time is not None:
            update_doc["start_time"] = event_data.start_time
        if event_data.end_time is not None:
            update_doc["end_time"] = event_data.end_time
        if event_data.reminder_before is not None:
            update_doc["reminder_before"] = event_data.reminder_before
        if event_data.color is not None:
            update_doc["color"] = event_data.color
        
        # Update event (only if owned by user)
        result = await db.grihasta_calendar_events.update_one(
            {
                "_id": ObjectId(event_id),
                "user_id": ObjectId(user_id)
            },
            {"$set": update_doc}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Event not found or not authorized")
        
        return StandardResponse(
            success=True,
            message="Event updated successfully",
            data={
                "event_id": event_id,
                "modified": result.modified_count > 0
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating event: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update event: {str(e)}")


@router.delete(
    "/grihasta/events/{event_id}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete Calendar Event",
    description="Delete a calendar event"
)
async def delete_grihasta_event(
    event_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_grihasta)
):
    """Delete calendar event"""
    try:
        if not ObjectId.is_valid(event_id):
            raise HTTPException(status_code=400, detail="Invalid event_id")
        
        user_id = current_user.get("_id")
        
        # Delete event (only if owned by user)
        result = await db.grihasta_calendar_events.delete_one({
            "_id": ObjectId(event_id),
            "user_id": ObjectId(user_id)
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Event not found or not authorized")
        
        return StandardResponse(
            success=True,
            message="Event deleted successfully",
            data={"event_id": event_id}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting event: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete event: {str(e)}")


@router.get(
    "/grihasta/upcoming",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Upcoming Events",
    description="Get upcoming events for Grihasta"
)
async def get_upcoming_events(
    days: int = Query(30, ge=1, le=365, description="Number of days to look ahead"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_grihasta)
):
    """Get upcoming events"""
    try:
        user_id = current_user.get("_id")
        
        # Calculate date range
        start_date = datetime.now()
        end_date = start_date + timedelta(days=days)
        
        # Fetch upcoming events
        events = await db.grihasta_calendar_events.find({
            "user_id": ObjectId(user_id),
            "date": {"$gte": start_date, "$lte": end_date}
        }).sort("date", 1).to_list(100)
        
        return StandardResponse(
            success=True,
            message=f"Upcoming events for next {days} days retrieved",
            data={
                "events": events,
                "count": len(events),
                "period_days": days
            }
        )
        
    except Exception as e:
        logger.error(f"Error fetching upcoming events: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch upcoming events: {str(e)}")
