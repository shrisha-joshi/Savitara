"""Tenant/cohort-aware feature flag evaluation service."""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase


class FeatureFlagService:
    """Evaluates and manages feature flags across tenant and user cohorts."""

    collection_name = "feature_flags"

    @staticmethod
    def _norm(value: Optional[str]) -> str:
        return (value or "").strip().lower()

    @classmethod
    def _matches_allow_list(cls, value: Optional[str], allow_values: List[str]) -> bool:
        if not allow_values:
            return True
        if not value:
            return False
        normalized = {cls._norm(v) for v in allow_values if v is not None}
        return cls._norm(value) in normalized

    @staticmethod
    def _is_in_rollout(key: str, user_id: Optional[str], percentage: int) -> bool:
        if percentage >= 100:
            return True
        if percentage <= 0:
            return False
        if not user_id:
            return False

        digest = hashlib.sha256(f"{key}:{user_id}".encode("utf-8")).hexdigest()
        bucket = int(digest[:8], 16) % 100
        return bucket < percentage

    def evaluate_flag(
        self,
        flag: Dict[str, Any],
        context: Dict[str, Optional[str]],
    ) -> Dict[str, Any]:
        key = str(flag.get("key", ""))

        if not flag.get("is_active", True):
            return {"enabled": False, "reason": "inactive"}
        if not flag.get("enabled", False):
            return {"enabled": False, "reason": "disabled"}

        cohorts = flag.get("cohorts", {}) or {}
        if not self._matches_allow_list(context.get("tenant"), cohorts.get("tenants", []) or []):
            return {"enabled": False, "reason": "tenant_mismatch"}
        if not self._matches_allow_list(context.get("role"), cohorts.get("roles", []) or []):
            return {"enabled": False, "reason": "role_mismatch"}
        if not self._matches_allow_list(context.get("region"), cohorts.get("regions", []) or []):
            return {"enabled": False, "reason": "region_mismatch"}
        if not self._matches_allow_list(context.get("city"), cohorts.get("cities", []) or []):
            return {"enabled": False, "reason": "city_mismatch"}
        if not self._matches_allow_list(context.get("language"), cohorts.get("languages", []) or []):
            return {"enabled": False, "reason": "language_mismatch"}

        rollout_percentage = int(flag.get("rollout_percentage", 100))
        if not self._is_in_rollout(key, context.get("user_id"), rollout_percentage):
            return {"enabled": False, "reason": "rollout_excluded"}

        return {
            "enabled": True,
            "reason": "matched",
            "variant": flag.get("variant", "on"),
        }

    async def evaluate_many(
        self,
        db: AsyncIOMotorDatabase,
        *,
        context: Dict[str, Optional[str]],
        keys: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        query: Dict[str, Any] = {"is_active": {"$ne": False}}
        if keys:
            query["key"] = {"$in": keys}

        flags = await db[self.collection_name].find(query).to_list(length=500)

        evaluated: Dict[str, Any] = {}
        for flag in flags:
            key = str(flag.get("key", ""))
            if not key:
                continue
            result = self.evaluate_flag(flag, context)
            evaluated[key] = {
                "enabled": bool(result.get("enabled", False)),
                "variant": result.get("variant"),
                "reason": result.get("reason"),
            }

        return evaluated

    async def upsert_flag(
        self,
        db: AsyncIOMotorDatabase,
        *,
        key: str,
        payload: Dict[str, Any],
        updated_by: Optional[str],
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        update_doc = {
            "$set": {
                "key": key,
                "enabled": bool(payload.get("enabled", False)),
                "variant": payload.get("variant", "on"),
                "rollout_percentage": int(payload.get("rollout_percentage", 100)),
                "cohorts": payload.get("cohorts", {}) or {},
                "is_active": bool(payload.get("is_active", True)),
                "description": payload.get("description"),
                "updated_by": updated_by,
                "updated_at": now,
            },
            "$setOnInsert": {
                "created_at": now,
            },
        }

        await db[self.collection_name].update_one(
            {"key": key},
            update_doc,
            upsert=True,
        )

        saved = await db[self.collection_name].find_one({"key": key}, {"_id": 0})
        return saved or {}


feature_flag_service = FeatureFlagService()
