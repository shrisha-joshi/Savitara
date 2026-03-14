"""Feature flags API (tenant + cohort aware)."""
from __future__ import annotations

from typing import Annotated, Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.core.security import get_current_admin, get_current_user
from app.db.connection import get_db
from app.schemas.requests import StandardResponse
from app.services.feature_flag_service import feature_flag_service

router = APIRouter(prefix="/feature-flags", tags=["Feature Flags"])


class FeatureFlagCohorts(BaseModel):
    """Cohort constraints for feature flag evaluation."""

    tenants: List[str] = Field(default_factory=list)
    regions: List[str] = Field(default_factory=list)
    languages: List[str] = Field(default_factory=list)
    roles: List[str] = Field(default_factory=list)
    cities: List[str] = Field(default_factory=list)


class FeatureFlagUpsertRequest(BaseModel):
    """Admin payload for creating/updating a feature flag."""

    enabled: bool = True
    variant: str = "on"
    rollout_percentage: int = Field(default=100, ge=0, le=100)
    is_active: bool = True
    description: Optional[str] = None
    cohorts: FeatureFlagCohorts = Field(default_factory=FeatureFlagCohorts)


def _to_user_obj_id(user_id: str) -> Optional[ObjectId]:
    return ObjectId(user_id) if ObjectId.is_valid(user_id) else None


async def _fetch_user_doc(db: AsyncIOMotorDatabase, user_id: str) -> Dict[str, Any]:
    user_obj_id = _to_user_obj_id(user_id)
    user_doc = await db.users.find_one(
        {"_id": user_obj_id} if user_obj_id else {"_id": user_id},
        {"preferred_language": 1, "tenant_id": 1},
    )
    return user_doc or {}


async def _fetch_profile_location(
    db: AsyncIOMotorDatabase,
    *,
    role: str,
    user_id: str,
) -> Dict[str, Optional[str]]:
    user_obj_id = _to_user_obj_id(user_id)
    projection = {"location.city": 1, "location.state": 1}

    if role == "acharya":
        profile = await db.acharya_profiles.find_one(
            {"user_id": user_obj_id or user_id},
            projection,
        )
    else:
        profile = await db.grihasta_profiles.find_one(
            {"user_id": user_obj_id or user_id},
            projection,
        )

    location = (profile or {}).get("location", {}) or {}
    return {
        "city": location.get("city"),
        "region": location.get("state"),
    }


async def _resolve_context(
    db: AsyncIOMotorDatabase,
    current_user: Dict[str, Any],
    tenant_header: Optional[str],
) -> Dict[str, Optional[str]]:
    user_id = str(current_user.get("id") or current_user.get("user_id") or "")
    role = str(current_user.get("role") or "")

    user_doc = await _fetch_user_doc(db, user_id)
    location = await _fetch_profile_location(db, role=role, user_id=user_id)
    tenant_id = tenant_header or user_doc.get("tenant_id")

    return {
        "user_id": user_id,
        "role": role,
        "language": user_doc.get("preferred_language"),
        "city": location.get("city"),
        "region": location.get("region"),
        "tenant": tenant_id,
    }


@router.get(
    "/me",
    response_model=StandardResponse,
    summary="Evaluate feature flags for current user",
)
async def evaluate_my_feature_flags(
    keys: Annotated[Optional[List[str]], Query(description="Optional set of keys to evaluate")] = None,
    tenant_id: Annotated[Optional[str], Header(alias="X-Tenant-ID")] = None,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    context = await _resolve_context(db, current_user, tenant_id)
    evaluated = await feature_flag_service.evaluate_many(
        db,
        context=context,
        keys=keys,
    )
    return StandardResponse(success=True, data={"context": context, "flags": evaluated})


@router.put(
    "/admin/{key}",
    response_model=StandardResponse,
    summary="Create or update a feature flag",
)
async def upsert_feature_flag(
    key: str,
    request: FeatureFlagUpsertRequest,
    current_user: Annotated[Dict[str, Any], Depends(get_current_admin)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    saved = await feature_flag_service.upsert_flag(
        db,
        key=key,
        payload=request.model_dump(mode="json"),
        updated_by=str(current_user.get("id") or current_user.get("user_id") or ""),
    )
    return StandardResponse(success=True, data=saved, message="Feature flag upserted")
