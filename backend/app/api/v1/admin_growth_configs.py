"""Admin-managed growth configuration endpoints."""
from __future__ import annotations

from typing import Annotated, Any, Dict, Literal, Optional

from fastapi import APIRouter, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.core.exceptions import ResourceNotFoundError
from app.core.security import get_current_admin, get_current_user
from app.db.connection import get_db
from app.schemas.requests import StandardResponse
from app.services.growth_config_service import GrowthConfigService

router = APIRouter(prefix="/admin/growth-configs", tags=["Admin - Growth Configs"])
public_router = APIRouter(prefix="/growth-configs", tags=["Growth Configs"])


class GrowthConfigPayload(BaseModel):
    """Payload for admin-managed growth configuration upserts."""

    category: Optional[str] = Field(None, min_length=2, max_length=80)
    label: Optional[str] = Field(None, min_length=2, max_length=120)
    description: Optional[str] = Field(None, max_length=500)
    visibility: Optional[Literal["admin", "user", "both"]] = "both"
    is_active: Optional[bool] = True
    value: Any = Field(default_factory=dict)


@router.get("", response_model=StandardResponse, summary="List growth configurations")
async def list_growth_configs(
    current_admin: Annotated[Dict[str, Any], Depends(get_current_admin)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    configs = await GrowthConfigService.list_configs(db)
    return StandardResponse(success=True, data={"configs": configs, "count": len(configs)})


@router.get("/{config_key}", response_model=StandardResponse, summary="Get growth configuration")
async def get_growth_config(
    config_key: str,
    current_admin: Annotated[Dict[str, Any], Depends(get_current_admin)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    config = await GrowthConfigService.get_config(db, config_key)
    if not config:
        raise ResourceNotFoundError(message="Growth config not found", resource_id=config_key)
    return StandardResponse(success=True, data={"config": config})


@router.put("/{config_key}", response_model=StandardResponse, summary="Create or update growth configuration")
async def upsert_growth_config(
    config_key: str,
    payload: GrowthConfigPayload,
    current_admin: Annotated[Dict[str, Any], Depends(get_current_admin)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    saved = await GrowthConfigService.upsert_config(
        db,
        config_key,
        payload.model_dump(exclude_none=True),
        admin_id=str(current_admin.get("id") or current_admin.get("user_id") or "admin"),
    )
    return StandardResponse(success=True, data={"config": saved}, message="Growth configuration saved")


@router.delete("/{config_key}", response_model=StandardResponse, summary="Delete or reset growth configuration")
async def delete_growth_config(
    config_key: str,
    current_admin: Annotated[Dict[str, Any], Depends(get_current_admin)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    result = await GrowthConfigService.delete_or_reset_config(db, config_key)
    return StandardResponse(success=True, data=result, message="Growth configuration updated")


@public_router.get("/bootstrap", response_model=StandardResponse, summary="Get frontend growth config bootstrap")
async def get_growth_config_bootstrap(
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    _ = current_user
    payload = await GrowthConfigService.get_bootstrap_payload(db)
    return StandardResponse(success=True, data=payload)


@public_router.get("/{config_key}", response_model=StandardResponse, summary="Get single frontend-visible growth config")
async def get_public_growth_config(
    config_key: str,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    _ = current_user
    config = await GrowthConfigService.get_config(db, config_key)
    if not config or config.get("visibility") not in {"user", "both"}:
        raise ResourceNotFoundError(message="Growth config not found", resource_id=config_key)
    return StandardResponse(success=True, data={"config": config})
