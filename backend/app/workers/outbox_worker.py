"""Background worker for processing durable outbox events."""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services.notification_service import NotificationService
from app.services.outbox_service import outbox_service
from app.services.websocket_manager import manager

logger = logging.getLogger(__name__)


async def _dispatch_event(channel: str, payload: Dict[str, Any]) -> None:
    if channel == "fcm_single":
        await NotificationService().send_notification_async(
            token=payload["token"],
            title=payload["title"],
            body=payload["body"],
            data=payload.get("data"),
            image_url=payload.get("image_url"),
        )
        return

    if channel == "fcm_multicast":
        await NotificationService().send_multicast_async(
            tokens=payload["tokens"],
            title=payload["title"],
            body=payload["body"],
            data=payload.get("data"),
            image_url=payload.get("image_url"),
        )
        return

    if channel == "ws_personal":
        await manager.send_personal_message(payload["user_id"], payload["message"])
        return

    raise ValueError(f"Unsupported outbox channel: {channel}")


async def process_outbox_once(db: AsyncIOMotorDatabase, *, batch_size: int = 25) -> int:
    """Process one outbox batch; returns processed+attempted count."""
    events = await outbox_service.claim_batch(db, batch_size=batch_size)
    if not events:
        return 0

    for event in events:
        event_id = event.get("_id")
        event_oid = ObjectId(event_id) if not isinstance(event_id, ObjectId) else event_id
        attempts = int(event.get("attempts", 0)) + 1
        max_attempts = int(event.get("max_attempts", 5))
        channel = event.get("channel")
        payload = event.get("payload") or {}

        try:
            await _dispatch_event(channel, payload)
            await outbox_service.mark_processed(db, event_oid)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Outbox dispatch failed id=%s channel=%s attempts=%s error=%s",
                str(event_id),
                channel,
                attempts,
                exc,
            )
            await outbox_service.mark_failed(
                db,
                event_oid,
                attempts=attempts,
                max_attempts=max_attempts,
                error=str(exc),
            )

    return len(events)


async def _outbox_loop(db: AsyncIOMotorDatabase, *, poll_interval_seconds: float = 1.0) -> None:
    """Continuously process outbox events in small batches."""
    logger.info("Outbox worker loop started")
    while True:
        try:
            processed = await process_outbox_once(db, batch_size=50)
            if processed == 0:
                await asyncio.sleep(poll_interval_seconds)
        except asyncio.CancelledError:
            logger.info("Outbox worker cancelled")
            raise
        except Exception as exc:  # noqa: BLE001
            logger.error("Outbox worker loop error: %s", exc, exc_info=True)
            await asyncio.sleep(2)


def start_outbox_worker(db: AsyncIOMotorDatabase) -> asyncio.Task:
    """Start outbox worker background task."""
    return asyncio.create_task(_outbox_loop(db), name="outbox-worker")
