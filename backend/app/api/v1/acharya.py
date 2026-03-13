"""
Acharya API Endpoints
Provides acharya-specific protected routes.
"""
from typing import Annotated, Any, Dict

from fastapi import APIRouter, Depends, status

from app.core.security import get_current_acharya


router = APIRouter(prefix="/acharya", tags=["Acharya"])


@router.get(
    "/dashboard",
    status_code=status.HTTP_200_OK,
    summary="Get Acharya dashboard",
    description="Fetch basic acharya dashboard information for authenticated acharya users.",
)
async def get_acharya_dashboard(
    current_user: Annotated[Dict[str, Any], Depends(get_current_acharya)] = None,
):
    """Return minimal dashboard payload for acharya users."""
    return {
        "success": True,
        "data": {
            "user_id": current_user["id"],
            "role": current_user.get("role"),
        },
        "message": "Acharya dashboard fetched successfully",
    }
