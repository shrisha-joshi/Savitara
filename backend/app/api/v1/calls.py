"""
Calls API Endpoints
Handles masked voice calls and video call tokens
"""
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Annotated, Dict, Any
import logging
from bson import ObjectId

from app.core.security import get_current_user
from app.db.connection import get_db
from app.services.calling_service import calling_service
from app.core.exceptions import ResourceNotFoundError, PermissionDeniedError
from app.schemas.requests import StandardResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/calls", tags=["Calls"])


@router.post(
    "/voice/initiate",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Initiate Masked Voice Call",
    description="Start a masked voice call between Grihasta and Acharya",
)
async def initiate_voice_call(
    booking_id: str,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    try:
        user_id = current_user["id"]

        # Verify booking exists and user is part of it
        booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
        if not booking:
            raise ResourceNotFoundError(resource_type="Booking", resource_id=booking_id)

        grihasta_id = str(booking["grihasta_id"])
        acharya_id = str(booking["acharya_id"])

        if user_id != grihasta_id and user_id != acharya_id:
            raise PermissionDeniedError(
                message="You are not a participant in this booking"
            )

        # Determine caller and callee
        # If current user is Grihasta, they are calling Acharya
        if user_id == grihasta_id:
            callee_id = acharya_id
        else:
            callee_id = grihasta_id

        result = await calling_service.initiate_masked_call(
            caller_user_id=user_id,
            callee_user_id=callee_id,
            booking_id=booking_id,
            db=db,
        )

        return StandardResponse(
            success=True, data=result, message="Call initiated successfully"
        )
    except Exception as e:
        logger.error(f"Voice call initiation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )
