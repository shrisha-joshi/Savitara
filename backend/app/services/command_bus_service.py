"""Operational command bus for admin remediation actions (A27)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


ALLOWED_COMMANDS = {
    "booking.force_cancel",
    "payment.retry_reconciliation",
    "chat.force_unmute",
    "user.force_logout",
}


class CommandBusService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.operational_commands

    async def enqueue(
        self,
        *,
        command_type: str,
        payload: Dict[str, Any],
        issued_by: str,
        correlation_id: Optional[str] = None,
    ) -> str:
        if command_type not in ALLOWED_COMMANDS:
            raise ValueError(f"Unsupported command type: {command_type}")

        now = datetime.now(timezone.utc)
        doc = {
            "command_type": command_type,
            "payload": payload,
            "issued_by": issued_by,
            "correlation_id": correlation_id,
            "status": "queued",
            "created_at": now,
            "updated_at": now,
            "attempts": 0,
        }
        result = await self.collection.insert_one(doc)
        return str(result.inserted_id)

    async def claim_next(self) -> Optional[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        command = await self.collection.find_one_and_update(
            {"status": "queued"},
            {
                "$set": {"status": "running", "updated_at": now},
                "$inc": {"attempts": 1},
            },
            sort=[("created_at", 1)],
            return_document=True,
        )
        if command and "_id" in command:
            command["_id"] = str(command["_id"])
        return command

    async def complete(self, command_id: str, result: Dict[str, Any]) -> None:
        await self.collection.update_one(
            {"_id": ObjectId(command_id)},
            {
                "$set": {
                    "status": "completed",
                    "result": result,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

    async def fail(self, command_id: str, error: str) -> None:
        await self.collection.update_one(
            {"_id": ObjectId(command_id)},
            {
                "$set": {
                    "status": "failed",
                    "error": error,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
