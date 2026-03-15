"""Write-ahead audit logging for financial and trust-critical actions (A13)."""

from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from typing import Any, Dict, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase


class WriteAheadAuditService:
    """Durable write-ahead audit log with intent/commit/abort semantics."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.write_ahead_audit_logs

    async def log_intent(
        self,
        *,
        actor_id: str,
        action: str,
        resource_type: str,
        resource_id: str,
        payload: Optional[Dict[str, Any]] = None,
        correlation_id: Optional[str] = None,
    ) -> str:
        last = await self.collection.find_one(sort=[("created_at", -1)], projection={"chain_hash": 1})
        prev_hash = (last or {}).get("chain_hash", "")

        created_at = datetime.now(timezone.utc)
        material = "|".join(
            [actor_id, action, resource_type, resource_id, created_at.isoformat(), prev_hash]
        )
        chain_hash = sha256(material.encode("utf-8")).hexdigest()

        doc = {
            "actor_id": actor_id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "payload": payload or {},
            "correlation_id": correlation_id,
            "status": "intent",
            "created_at": created_at,
            "updated_at": created_at,
            "previous_hash": prev_hash,
            "chain_hash": chain_hash,
        }
        result = await self.collection.insert_one(doc)
        return str(result.inserted_id)

    async def mark_committed(
        self,
        intent_id: str,
        *,
        commit_payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        from bson import ObjectId

        await self.collection.update_one(
            {"_id": ObjectId(intent_id)},
            {
                "$set": {
                    "status": "committed",
                    "commit_payload": commit_payload or {},
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

    async def mark_aborted(self, intent_id: str, *, reason: str) -> None:
        from bson import ObjectId

        await self.collection.update_one(
            {"_id": ObjectId(intent_id)},
            {
                "$set": {
                    "status": "aborted",
                    "abort_reason": reason,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
