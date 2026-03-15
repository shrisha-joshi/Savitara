"""Global emergency kill switches and incident controls (A23/A24)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict

from motor.motor_asyncio import AsyncIOMotorDatabase


DEFAULT_CONTROLS: Dict[str, Any] = {
    "payments_enabled": True,
    "chat_enabled": True,
    "recommendations_enabled": True,
    "incident_mode": False,
    "incident_throttle_multiplier": 0.5,
}


class KillSwitchService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.global_controls

    async def get_controls(self) -> Dict[str, Any]:
        doc = await self.collection.find_one({"_id": "global"})
        if not doc:
            return dict(DEFAULT_CONTROLS)
        controls = dict(DEFAULT_CONTROLS)
        controls.update(doc.get("controls", {}))
        return controls

    async def set_controls(self, controls: Dict[str, Any], actor_id: str) -> Dict[str, Any]:
        current = await self.get_controls()
        current.update(controls)
        await self.collection.update_one(
            {"_id": "global"},
            {
                "$set": {
                    "controls": current,
                    "updated_by": actor_id,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )
        return current
