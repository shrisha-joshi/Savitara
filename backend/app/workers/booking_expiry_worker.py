"""
Booking Expiry Worker
Auto-cancels stale bookings on a periodic schedule.

Rules (configurable via module-level constants):
  - REQUESTED bookings older than 48 hours  → auto-cancel
  - PENDING_PAYMENT bookings older than 30 minutes → auto-cancel

The worker is started as an asyncio background task from startup.py and
runs until the application shuts down.

SonarQube: S2095 - properly awaits all async resources.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

# ── Expiry thresholds ─────────────────────────────────────────────────────────
REQUESTED_TTL_HOURS        = 48    # auto-cancel requested bookings after 48 h
PENDING_PAYMENT_TTL_MINUTES = 30   # auto-cancel pending_payment after 30 min
POLL_INTERVAL_SECONDS       = 60   # how often the worker runs (once per minute)


async def expire_stale_bookings(db: AsyncIOMotorDatabase) -> int:
    """
    Find and auto-cancel all stale bookings.

    Returns
    -------
    int
        Number of bookings cancelled in this run.
    """
    from app.services.booking_state_machine import emit_booking_update  # noqa: PLC0415

    now = datetime.now(timezone.utc)
    cancelled_count = 0

    # Pairs of (status, cutoff_datetime, new_status, reason)
    expiry_rules = [
        (
            "requested",
            now - timedelta(hours=REQUESTED_TTL_HOURS),
            "cancelled",
            f"Auto-cancelled: no Acharya response within {REQUESTED_TTL_HOURS} hours.",
        ),
        (
            "pending_payment",
            now - timedelta(minutes=PENDING_PAYMENT_TTL_MINUTES),
            "failed",
            f"Auto-failed: payment not completed within {PENDING_PAYMENT_TTL_MINUTES} minutes.",
        ),
    ]

    for current_status, cutoff, new_status, reason in expiry_rules:
        cursor = db.bookings.find(
            {
                "status": current_status,
                "created_at": {"$lt": cutoff},
            },
            {"_id": 1, "grihasta_id": 1, "acharya_id": 1, "created_at": 1},
        )

        async for booking in cursor:
            booking_id = str(booking["_id"])
            try:
                result = await db.bookings.update_one(
                    {
                        "_id": booking["_id"],
                        "status": current_status,  # optimistic lock — only update if still same status
                    },
                    {
                        "$set": {
                            "status": new_status,
                            "cancellation_reason": reason,
                            "updated_at": now,
                        }
                    },
                )

                if result.modified_count == 0:
                    # Another process already updated it — skip
                    continue

                cancelled_count += 1
                logger.info(
                    "[expiry_worker] Booking %s transitioned %s → %s. Reason: %s",
                    booking_id,
                    current_status,
                    new_status,
                    reason,
                )

                await emit_booking_update(
                    db,
                    booking_id,
                    booking,
                    new_status,
                    extra={"reason": reason},
                )

            except Exception as exc:  # noqa: BLE001
                logger.error(
                    "[expiry_worker] Failed to expire booking %s: %s",
                    booking_id,
                    exc,
                    exc_info=True,
                )

    if cancelled_count:
        logger.info("[expiry_worker] Expired %d stale bookings.", cancelled_count)

    return cancelled_count


async def run_expiry_loop(db: AsyncIOMotorDatabase) -> None:
    """
    Infinite loop that calls expire_stale_bookings() every POLL_INTERVAL_SECONDS.
    Designed to be launched via asyncio.create_task().
    """
    logger.info(
        "[expiry_worker] Started (interval=%ds, requested_ttl=%dh, pending_payment_ttl=%dmin).",
        POLL_INTERVAL_SECONDS,
        REQUESTED_TTL_HOURS,
        PENDING_PAYMENT_TTL_MINUTES,
    )
    while True:
        try:
            await expire_stale_bookings(db)
        except Exception as exc:  # noqa: BLE001
            logger.error("[expiry_worker] Unexpected error in expiry loop: %s", exc)
        await asyncio.sleep(POLL_INTERVAL_SECONDS)


def start_expiry_worker(db: AsyncIOMotorDatabase) -> "asyncio.Task[Any]":
    """
    Convenience wrapper — creates and returns the background asyncio task.
    Call from startup.py after the DB connection is established.
    """
    return asyncio.create_task(run_expiry_loop(db), name="booking_expiry_worker")
