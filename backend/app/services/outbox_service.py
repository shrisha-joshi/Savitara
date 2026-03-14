"""Durable outbox service for side-effect delivery with retries."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError


class OutboxService:
    """Handles enqueue/claim/ack/fail lifecycle for outbox events."""

    collection_name = "outbox_events"

    async def enqueue(
        self,
        db: AsyncIOMotorDatabase,
        *,
        channel: str,
        payload: Dict[str, Any],
        dedupe_key: Optional[str] = None,
    ) -> str:
        now = datetime.now(timezone.utc)
        event = {
            "channel": channel,
            "payload": payload,
            "status": "pending",
            "attempts": 0,
            "max_attempts": 5,
            "next_attempt_at": now,
            "created_at": now,
            "updated_at": now,
            "dedupe_key": dedupe_key,
            "last_error": None,
            "processed_at": None,
            "locked_at": None,
        }

        if dedupe_key:
            existing = await db[self.collection_name].find_one(
                {"dedupe_key": dedupe_key},
                {"_id": 1},
            )
            if existing:
                return str(existing["_id"])

        try:
            result = await db[self.collection_name].insert_one(event)
        except DuplicateKeyError:
            # Dedupe race protection for concurrent enqueue attempts.
            if not dedupe_key:
                raise
            existing = await db[self.collection_name].find_one(
                {"dedupe_key": dedupe_key},
                {"_id": 1},
            )
            if existing:
                return str(existing["_id"])
            raise
        return str(result.inserted_id)

    async def claim_batch(
        self,
        db: AsyncIOMotorDatabase,
        *,
        batch_size: int = 50,
    ) -> List[Dict[str, Any]]:
        """Atomically claim a batch of pending events ready for delivery."""
        now = datetime.now(timezone.utc)
        lock_cutoff = now - timedelta(minutes=5)
        events: List[Dict[str, Any]] = []

        for _ in range(batch_size):
            claimed = await db[self.collection_name].find_one_and_update(
                {
                    "$or": [
                        {
                            "status": "pending",
                            "next_attempt_at": {"$lte": now},
                        },
                        {
                            "status": "processing",
                            "locked_at": {"$lte": lock_cutoff},
                        },
                    ]
                },
                {
                    "$set": {
                        "status": "processing",
                        "locked_at": now,
                        "updated_at": now,
                    }
                },
                sort=[("next_attempt_at", 1), ("created_at", 1)],
                return_document=True,
            )
            if not claimed:
                break
            events.append(claimed)

        return events

    async def mark_processed(self, db: AsyncIOMotorDatabase, event_id: ObjectId) -> None:
        now = datetime.now(timezone.utc)
        await db[self.collection_name].update_one(
            {"_id": event_id},
            {
                "$set": {
                    "status": "processed",
                    "processed_at": now,
                    "updated_at": now,
                    "locked_at": None,
                }
            },
        )

    async def mark_failed(
        self,
        db: AsyncIOMotorDatabase,
        event_id: ObjectId,
        *,
        attempts: int,
        max_attempts: int,
        error: str,
    ) -> None:
        now = datetime.now(timezone.utc)
        terminal = attempts >= max_attempts
        next_retry = now + timedelta(seconds=min(300, 2 ** attempts))
        await db[self.collection_name].update_one(
            {"_id": event_id},
            {
                "$set": {
                    "status": "dead" if terminal else "pending",
                    "attempts": attempts,
                    "next_attempt_at": now if terminal else next_retry,
                    "last_error": error[:1000],
                    "updated_at": now,
                    "locked_at": None,
                }
            },
        )


outbox_service = OutboxService()
