"""Durable async job queue service for background computations."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError


class AsyncJobService:
    """Lifecycle helpers for enqueue/claim/complete/fail async jobs."""

    collection_name = "async_jobs"

    async def enqueue(
        self,
        db: AsyncIOMotorDatabase,
        *,
        kind: str,
        payload: Dict[str, Any],
        created_by: str,
        job_key: Optional[str] = None,
    ) -> str:
        now = datetime.now(timezone.utc)
        doc = {
            "kind": kind,
            "payload": payload,
            "status": "pending",
            "attempts": 0,
            "max_attempts": 5,
            "next_attempt_at": now,
            "created_at": now,
            "updated_at": now,
            "created_by": created_by,
            "job_key": job_key,
            "locked_at": None,
            "result": None,
            "last_error": None,
            "completed_at": None,
        }

        if job_key:
            existing = await db[self.collection_name].find_one(
                {
                    "job_key": job_key,
                    "status": {"$in": ["pending", "processing", "completed"]},
                },
                {"_id": 1},
            )
            if existing:
                return str(existing["_id"])

        try:
            inserted = await db[self.collection_name].insert_one(doc)
            return str(inserted.inserted_id)
        except DuplicateKeyError:
            existing = await db[self.collection_name].find_one({"job_key": job_key}, {"_id": 1})
            if existing:
                return str(existing["_id"])
            raise

    async def claim_batch(
        self,
        db: AsyncIOMotorDatabase,
        *,
        kind: str,
        batch_size: int = 5,
    ) -> List[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        lock_cutoff = now - timedelta(minutes=10)
        claimed: List[Dict[str, Any]] = []

        for _ in range(batch_size):
            job = await db[self.collection_name].find_one_and_update(
                {
                    "kind": kind,
                    "$or": [
                        {"status": "pending", "next_attempt_at": {"$lte": now}},
                        {"status": "processing", "locked_at": {"$lte": lock_cutoff}},
                    ],
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
            if not job:
                break
            claimed.append(job)

        return claimed

    async def mark_completed(
        self,
        db: AsyncIOMotorDatabase,
        job_id: ObjectId,
        *,
        result: Optional[Dict[str, Any]] = None,
    ) -> None:
        now = datetime.now(timezone.utc)
        await db[self.collection_name].update_one(
            {"_id": job_id},
            {
                "$set": {
                    "status": "completed",
                    "result": result or {},
                    "completed_at": now,
                    "updated_at": now,
                    "locked_at": None,
                    "last_error": None,
                }
            },
        )

    async def mark_failed(
        self,
        db: AsyncIOMotorDatabase,
        job_id: ObjectId,
        *,
        attempts: int,
        max_attempts: int,
        error: str,
    ) -> None:
        now = datetime.now(timezone.utc)
        terminal = attempts >= max_attempts
        next_retry = now + timedelta(seconds=min(900, 2 ** attempts))
        await db[self.collection_name].update_one(
            {"_id": job_id},
            {
                "$set": {
                    "status": "dead" if terminal else "pending",
                    "attempts": attempts,
                    "next_attempt_at": now if terminal else next_retry,
                    "last_error": error[:2000],
                    "updated_at": now,
                    "locked_at": None,
                }
            },
        )

    async def get_job(
        self,
        db: AsyncIOMotorDatabase,
        *,
        job_id: str,
    ) -> Optional[Dict[str, Any]]:
        if not ObjectId.is_valid(job_id):
            return None
        job = await db[self.collection_name].find_one({"_id": ObjectId(job_id)})
        if not job:
            return None
        job["_id"] = str(job["_id"])
        if job.get("created_at"):
            job["created_at"] = job["created_at"].isoformat()
        if job.get("updated_at"):
            job["updated_at"] = job["updated_at"].isoformat()
        if job.get("completed_at"):
            job["completed_at"] = job["completed_at"].isoformat()
        return job


async_job_service = AsyncJobService()
