"""Immutable booking transition event stream (A14)."""

from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from typing import Any, Dict, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase


class BookingEventStreamService:
    """Appends immutable booking transition events using hash chaining."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.booking_event_stream

    async def append_transition(
        self,
        *,
        booking_id: str,
        from_status: str,
        to_status: str,
        actor_id: str,
        actor_role: str,
        metadata: Optional[Dict[str, Any]] = None,
        correlation_id: Optional[str] = None,
    ) -> str:
        last = await self.collection.find_one(
            {"booking_id": booking_id},
            sort=[("sequence", -1)],
            projection={"sequence": 1, "event_hash": 1},
        )
        sequence = int((last or {}).get("sequence", 0)) + 1
        previous_hash = (last or {}).get("event_hash", "")

        created_at = datetime.now(timezone.utc)
        raw = "|".join(
            [
                booking_id,
                str(sequence),
                from_status,
                to_status,
                actor_id,
                actor_role,
                created_at.isoformat(),
                previous_hash,
            ]
        )
        event_hash = sha256(raw.encode("utf-8")).hexdigest()

        event = {
            "booking_id": booking_id,
            "sequence": sequence,
            "event_type": "booking.status_transition",
            "from_status": from_status,
            "to_status": to_status,
            "actor_id": actor_id,
            "actor_role": actor_role,
            "metadata": metadata or {},
            "correlation_id": correlation_id,
            "created_at": created_at,
            "previous_hash": previous_hash,
            "event_hash": event_hash,
            "immutable": True,
        }
        result = await self.collection.insert_one(event)
        return str(result.inserted_id)
