"""Admin control-plane APIs for reliability operations (A23/A27)."""

from __future__ import annotations

from typing import Any, Dict, Optional, Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.core.security import get_current_admin
from app.db.connection import get_db
from app.schemas.requests import StandardResponse
from app.services.command_bus_service import CommandBusService
from app.services.kill_switch_service import KillSwitchService

router = APIRouter(prefix="/reliability", tags=["Reliability Admin"])


class KillSwitchUpdateRequest(BaseModel):
    payments_enabled: Optional[bool] = None
    chat_enabled: Optional[bool] = None
    recommendations_enabled: Optional[bool] = None
    incident_mode: Optional[bool] = None
    incident_throttle_multiplier: Optional[float] = Field(default=None, gt=0.0, le=1.0)


class CommandRequest(BaseModel):
    command_type: str
    payload: Dict[str, Any] = {}


@router.get("/kill-switches", response_model=StandardResponse)
async def get_kill_switches(
    current_user: Annotated[Dict[str, Any], Depends(get_current_admin)],
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)],
):
    service = KillSwitchService(db)
    controls = await service.get_controls()
    return StandardResponse(success=True, data=controls)


@router.put("/kill-switches", response_model=StandardResponse)
async def update_kill_switches(
    body: KillSwitchUpdateRequest,
    current_user: Annotated[Dict[str, Any], Depends(get_current_admin)],
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)],
):
    service = KillSwitchService(db)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = await service.set_controls(updates, actor_id=current_user["id"])
    return StandardResponse(success=True, data=updated, message="Kill switches updated")


@router.post(
    "/commands",
    response_model=StandardResponse,
    responses={
        status.HTTP_400_BAD_REQUEST: {"description": "Invalid command payload"},
        status.HTTP_404_NOT_FOUND: {"description": "Resource not found"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"description": "Command enqueue failed"},
    },
)
async def enqueue_command(
    body: CommandRequest,
    current_user: Annotated[Dict[str, Any], Depends(get_current_admin)],
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)],
):
    bus = CommandBusService(db)
    try:
        command_id = await bus.enqueue(
            command_type=body.command_type,
            payload=body.payload,
            issued_by=current_user["id"],
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return StandardResponse(success=True, data={"command_id": command_id}, message="Command queued")
