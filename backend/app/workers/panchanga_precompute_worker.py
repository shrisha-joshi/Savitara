"""Background worker for heavy Panchanga yearly precompute jobs."""
from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services.async_job_service import async_job_service
from app.services.panchanga_service import panchanga_service

logger = logging.getLogger(__name__)

JOB_KIND = "panchanga.yearly_precompute"


async def _process_yearly_precompute(db: AsyncIOMotorDatabase, payload: Dict[str, Any]) -> Dict[str, Any]:
    year = int(payload["year"])
    latitude = float(payload.get("latitude", 28.6139))
    longitude = float(payload.get("longitude", 77.2090))
    panchanga_type = str(payload.get("panchanga_type", "lunar"))

    start = date(year, 1, 1)
    end = date(year, 12, 31)
    current = start
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=30)

    computed = 0
    while current <= end:
        data = panchanga_service.get_daily_panchanga(
            current,
            latitude,
            longitude,
            panchanga_type,
        )
        await db.panchanga_cache.update_one(
            {
                "date": datetime(current.year, current.month, current.day, tzinfo=timezone.utc),
                "latitude": latitude,
                "longitude": longitude,
                "sampradaya": panchanga_type,
            },
            {
                "$set": {
                    "date": datetime(current.year, current.month, current.day, tzinfo=timezone.utc),
                    "region": data.get("meta", {}).get("timezone", "Asia/Kolkata"),
                    "latitude": latitude,
                    "longitude": longitude,
                    "sampradaya": panchanga_type,
                    "panchanga_data": data,
                    "created_at": now,
                    "expires_at": expires_at,
                }
            },
            upsert=True,
        )
        computed += 1
        current += timedelta(days=1)

    return {
        "year": year,
        "computed_days": computed,
        "latitude": latitude,
        "longitude": longitude,
        "panchanga_type": panchanga_type,
    }


async def process_precompute_once(db: AsyncIOMotorDatabase, *, batch_size: int = 1) -> int:
    jobs = await async_job_service.claim_batch(db, kind=JOB_KIND, batch_size=batch_size)
    if not jobs:
        return 0

    for job in jobs:
        job_id = job.get("_id")
        job_oid = ObjectId(job_id) if not isinstance(job_id, ObjectId) else job_id
        attempts = int(job.get("attempts", 0)) + 1
        max_attempts = int(job.get("max_attempts", 5))
        payload = job.get("payload") or {}

        try:
            result = await _process_yearly_precompute(db, payload)
            await async_job_service.mark_completed(db, job_oid, result=result)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Panchanga precompute failed id=%s err=%s", str(job_oid), exc)
            await async_job_service.mark_failed(
                db,
                job_oid,
                attempts=attempts,
                max_attempts=max_attempts,
                error=str(exc),
            )

    return len(jobs)


async def _worker_loop(db: AsyncIOMotorDatabase, *, poll_interval_seconds: float = 2.0) -> None:
    logger.info("Panchanga precompute worker started")
    while True:
        try:
            processed = await process_precompute_once(db, batch_size=1)
            if processed == 0:
                await asyncio.sleep(poll_interval_seconds)
        except asyncio.CancelledError:
            logger.info("Panchanga precompute worker cancelled")
            raise
        except Exception as exc:  # noqa: BLE001
            logger.error("Panchanga precompute loop error: %s", exc, exc_info=True)
            await asyncio.sleep(2)


def start_panchanga_precompute_worker(db: AsyncIOMotorDatabase) -> asyncio.Task:
    return asyncio.create_task(_worker_loop(db), name="panchanga-precompute-worker")
