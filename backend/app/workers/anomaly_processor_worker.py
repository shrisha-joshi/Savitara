"""Real-time fraud/anomaly processor worker (A25 baseline)."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


async def process_anomalies_once(db: AsyncIOMotorDatabase) -> int:
    """Derive simple anomaly signals and persist to anomaly_events."""
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=15)

    refund_spike = await db.payments.count_documents(
        {
            "status": "refunded",
            "refund_processed_at": {"$gte": window_start, "$lte": now},
        }
    )

    if refund_spike >= 10:
        await db.anomaly_events.insert_one(
            {
                "kind": "refund_spike",
                "severity": "high",
                "count": refund_spike,
                "window_start": window_start,
                "window_end": now,
                "created_at": now,
            }
        )
        return 1

    return 0


async def anomaly_worker_loop(db: AsyncIOMotorDatabase, poll_seconds: int = 30) -> None:
    logger.info("Anomaly processor worker started")
    while True:
        try:
            created = await process_anomalies_once(db)
            if created:
                logger.warning("Anomaly event generated: %s", created)
        except Exception as exc:  # noqa: BLE001
            logger.error("anomaly worker error: %s", exc, exc_info=True)
        await asyncio.sleep(poll_seconds)


def start_anomaly_worker(db: AsyncIOMotorDatabase) -> asyncio.Task:
    return asyncio.create_task(anomaly_worker_loop(db), name="anomaly_processor_worker")
