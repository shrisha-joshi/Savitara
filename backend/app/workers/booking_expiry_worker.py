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
from typing import Any, Dict, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.config import settings
from app.services.booking_discovery_service import BookingDiscoveryService
from app.services.outbox_dispatcher import (
    enqueue_email,
    enqueue_fcm_single,
    enqueue_sms,
    enqueue_ws_personal,
)

logger = logging.getLogger(__name__)

# ── Expiry thresholds ─────────────────────────────────────────────────────────
REQUESTED_TTL_HOURS        = 48    # auto-cancel requested bookings after 48 h
PENDING_PAYMENT_TTL_MINUTES = 30   # auto-cancel pending_payment after 30 min
POLL_INTERVAL_SECONDS       = 60   # how often the worker runs (once per minute)
SLA_AUTO_REJECT_REASON = "Auto-rejected: Acharya did not respond within SLA window."
MONGO_EXISTS = "$exists"
LEGACY_REQUEST_CANCEL_REASON = (
    f"Auto-cancelled: no Acharya response within {REQUESTED_TTL_HOURS} hours."
)
PENDING_PAYMENT_FAIL_REASON = (
    f"Auto-failed: payment not completed within {PENDING_PAYMENT_TTL_MINUTES} minutes."
)
PAYMENT_RECOVERY_SUBJECT = "Complete your Savitara booking payment"


def _coerce_utc_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    if isinstance(value, str):
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    return None


async def _resolve_acharya_notification_target(
    db: AsyncIOMotorDatabase,
    booking: Dict[str, Any],
) -> tuple[Optional[str], Optional[str]]:
    """Return (acharya_user_id, fcm_token) where resolvable."""
    acharya_ref = booking.get("acharya_id")
    acharya_profile = None

    if isinstance(acharya_ref, ObjectId):
        acharya_profile = await db.acharya_profiles.find_one(
            {"_id": acharya_ref}, {"user_id": 1}
        )
    elif isinstance(acharya_ref, str) and ObjectId.is_valid(acharya_ref):
        acharya_profile = await db.acharya_profiles.find_one(
            {"_id": ObjectId(acharya_ref)}, {"user_id": 1}
        )

    user_id = acharya_profile.get("user_id") if acharya_profile else None
    if user_id is None:
        user_id = acharya_ref

    if user_id is None:
        return None, None

    user_query = {"_id": user_id}
    if isinstance(user_id, str) and ObjectId.is_valid(user_id):
        user_query = {"_id": ObjectId(user_id)}

    user_doc = await db.users.find_one(user_query, {"fcm_token": 1})
    return str(user_id), (user_doc or {}).get("fcm_token")


async def _resolve_grihasta_notification_target(
    db: AsyncIOMotorDatabase,
    booking: Dict[str, Any],
) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """Return (grihasta_user_id, fcm_token, email, phone)."""
    grihasta_ref = booking.get("grihasta_id")
    if grihasta_ref is None:
        return None, None, None, None

    user_query = {"_id": grihasta_ref}
    if isinstance(grihasta_ref, str) and ObjectId.is_valid(grihasta_ref):
        user_query = {"_id": ObjectId(grihasta_ref)}

    user_doc = await db.users.find_one(
        user_query,
        {"fcm_token": 1, "email": 1, "phone": 1},
    )
    return (
        str(grihasta_ref),
        (user_doc or {}).get("fcm_token"),
        (user_doc or {}).get("email"),
        (user_doc or {}).get("phone"),
    )


def _build_sent_threshold_set(reminders_sent: Any) -> set[int]:
    sent_set: set[int] = set()
    for item in reminders_sent or []:
        if isinstance(item, int):
            sent_set.add(item)
        elif isinstance(item, str) and item.isdigit():
            sent_set.add(int(item))
    return sent_set


def _is_due_threshold(remaining_minutes_floor: int, threshold_min: int, sent_set: set[int]) -> bool:
    return threshold_min not in sent_set and remaining_minutes_floor <= threshold_min


async def _enqueue_sla_reminder(
    db: AsyncIOMotorDatabase,
    *,
    booking_id: str,
    threshold_min: int,
    expires_at: datetime,
    acharya_user_id: str,
    acharya_token: Optional[str],
) -> None:
    body = (
        f"Booking request expires in {threshold_min} minutes. "
        "Please accept or reject now."
    )

    await enqueue_ws_personal(
        db,
        user_id=acharya_user_id,
        message={
            "type": "booking_sla_reminder",
            "booking_id": booking_id,
            "remaining_minutes": threshold_min,
            "expires_at": expires_at.isoformat(),
        },
        dedupe_key=f"booking_sla_reminder:ws:{booking_id}:{acharya_user_id}:{threshold_min}",
    )

    if acharya_token:
        await enqueue_fcm_single(
            db,
            token=acharya_token,
            title="Booking request response reminder",
            body=body,
            data={
                "type": "booking_sla_reminder",
                "booking_id": booking_id,
                "remaining_minutes": str(threshold_min),
            },
            dedupe_key=f"booking_sla_reminder:fcm:{booking_id}:{acharya_token}:{threshold_min}",
        )


async def _enqueue_pending_payment_nudge(
    db: AsyncIOMotorDatabase,
    *,
    booking_id: str,
    threshold_min: int,
    deadline_at: datetime,
    grihasta_user_id: str,
    grihasta_token: Optional[str],
    grihasta_email: Optional[str],
    grihasta_phone: Optional[str],
) -> None:
    body = (
        f"Your booking payment is pending. Complete payment in {threshold_min} minutes "
        "to avoid auto-cancellation."
    )

    await enqueue_ws_personal(
        db,
        user_id=grihasta_user_id,
        message={
            "type": "pending_payment_recovery",
            "booking_id": booking_id,
            "remaining_minutes": threshold_min,
            "deadline_at": deadline_at.isoformat(),
        },
        dedupe_key=(
            f"pending_payment_recovery:ws:{booking_id}:{grihasta_user_id}:{threshold_min}"
        ),
    )

    if grihasta_token:
        await enqueue_fcm_single(
            db,
            token=grihasta_token,
            title="Complete your booking payment",
            body=body,
            data={
                "type": "pending_payment_recovery",
                "booking_id": booking_id,
                "remaining_minutes": str(threshold_min),
            },
            dedupe_key=(
                f"pending_payment_recovery:fcm:{booking_id}:{grihasta_token}:{threshold_min}"
            ),
        )

    if grihasta_email:
        await enqueue_email(
            db,
            to_email=grihasta_email,
            subject=PAYMENT_RECOVERY_SUBJECT,
            body=body,
            html_body=(
                "<p>Your booking payment is pending.</p>"
                f"<p>Please complete payment in <strong>{threshold_min} minutes</strong> "
                "to avoid auto-cancellation.</p>"
            ),
            dedupe_key=(
                f"pending_payment_recovery:email:{booking_id}:{grihasta_email}:{threshold_min}"
            ),
        )

    if grihasta_phone:
        await enqueue_sms(
            db,
            to_number=str(grihasta_phone),
            message=body,
            dedupe_key=(
                f"pending_payment_recovery:sms:{booking_id}:{grihasta_phone}:{threshold_min}"
            ),
        )


async def _emit_sla_reminder_if_due(
    db: AsyncIOMotorDatabase,
    booking: Dict[str, Any],
    now: datetime,
) -> int:
    """Emit due SLA reminders once (idempotent) for a single requested booking."""
    booking_id = str(booking.get("_id"))
    expires_at = _coerce_utc_datetime(booking.get("request_sla_expires_at"))
    if expires_at is None or now >= expires_at:
        return 0

    remaining_seconds = int((expires_at - now).total_seconds())
    remaining_minutes_floor = max(0, remaining_seconds // 60)

    sent_set = _build_sent_threshold_set(booking.get("request_sla_reminders_sent"))

    emitted = 0
    for threshold_min in settings.REQUEST_MODE_SLA_REMINDER_SCHEDULE:
        if not _is_due_threshold(remaining_minutes_floor, threshold_min, sent_set):
            continue

        mark_result = await db.bookings.update_one(
            {
                "_id": booking.get("_id"),
                "status": "requested",
                "request_sla_expires_at": {"$ne": None},
                "request_sla_reminders_sent": {"$ne": threshold_min},
            },
            {
                "$addToSet": {"request_sla_reminders_sent": threshold_min},
                "$set": {"updated_at": now},
            },
        )
        if mark_result.modified_count == 0:
            continue

        try:
            acharya_user_id, acharya_token = await _resolve_acharya_notification_target(db, booking)
            if not acharya_user_id:
                continue

            await _enqueue_sla_reminder(
                db,
                booking_id=booking_id,
                threshold_min=threshold_min,
                expires_at=expires_at,
                acharya_user_id=acharya_user_id,
                acharya_token=acharya_token,
            )
            emitted += 1
        except Exception:
            # Roll back reminder marker so the next run can retry safely.
            await db.bookings.update_one(
                {"_id": booking.get("_id")},
                {"$pull": {"request_sla_reminders_sent": threshold_min}},
            )
            raise

    return emitted


async def _emit_pending_payment_recovery_if_due(
    db: AsyncIOMotorDatabase,
    booking: Dict[str, Any],
    now: datetime,
) -> int:
    """Emit due payment recovery nudges once (idempotent) for pending payment bookings."""
    booking_id = str(booking.get("_id"))
    created_at = _coerce_utc_datetime(booking.get("created_at"))
    if created_at is None:
        return 0

    deadline_at = created_at + timedelta(minutes=PENDING_PAYMENT_TTL_MINUTES)
    if now >= deadline_at:
        return 0

    remaining_seconds = int((deadline_at - now).total_seconds())
    remaining_minutes_floor = max(0, remaining_seconds // 60)
    sent_set = _build_sent_threshold_set(
        booking.get("pending_payment_recovery_reminders_sent")
    )

    emitted = 0
    for threshold_min in settings.PENDING_PAYMENT_RECOVERY_REMINDER_SCHEDULE:
        if not _is_due_threshold(remaining_minutes_floor, threshold_min, sent_set):
            continue

        mark_result = await db.bookings.update_one(
            {
                "_id": booking.get("_id"),
                "status": "pending_payment",
                "pending_payment_recovery_reminders_sent": {"$ne": threshold_min},
            },
            {
                "$addToSet": {"pending_payment_recovery_reminders_sent": threshold_min},
                "$set": {"updated_at": now},
            },
        )
        if mark_result.modified_count == 0:
            continue

        try:
            grihasta_user_id, token, email, phone = await _resolve_grihasta_notification_target(
                db, booking
            )
            if not grihasta_user_id:
                continue

            await _enqueue_pending_payment_nudge(
                db,
                booking_id=booking_id,
                threshold_min=threshold_min,
                deadline_at=deadline_at,
                grihasta_user_id=grihasta_user_id,
                grihasta_token=token,
                grihasta_email=email,
                grihasta_phone=phone,
            )
            emitted += 1
        except Exception:
            await db.bookings.update_one(
                {"_id": booking.get("_id")},
                {"$pull": {"pending_payment_recovery_reminders_sent": threshold_min}},
            )
            raise

    return emitted


async def _process_sla_reminders(db: AsyncIOMotorDatabase, now: datetime) -> int:
    emitted_count = 0
    cursor = db.bookings.find(
        {
            "status": "requested",
            "request_sla_expires_at": {MONGO_EXISTS: True, "$ne": None},
        },
        {
            "_id": 1,
            "acharya_id": 1,
            "request_sla_expires_at": 1,
            "request_sla_reminders_sent": 1,
        },
    )

    async for booking in cursor:
        try:
            emitted_count += await _emit_sla_reminder_if_due(db, booking, now)
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "[expiry_worker] Failed SLA reminder processing for booking %s: %s",
                str(booking.get("_id")),
                exc,
                exc_info=True,
            )

    return emitted_count


async def _process_pending_payment_recovery_reminders(
    db: AsyncIOMotorDatabase,
    now: datetime,
) -> int:
    emitted_count = 0
    cursor = db.bookings.find(
        {
            "status": "pending_payment",
            "created_at": {MONGO_EXISTS: True, "$ne": None},
        },
        {
            "_id": 1,
            "grihasta_id": 1,
            "created_at": 1,
            "pending_payment_recovery_reminders_sent": 1,
        },
    )

    async for booking in cursor:
        try:
            emitted_count += await _emit_pending_payment_recovery_if_due(db, booking, now)
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "[expiry_worker] Failed pending payment recovery processing for booking %s: %s",
                str(booking.get("_id")),
                exc,
                exc_info=True,
            )

    return emitted_count


async def _transition_expired_requested_with_sla(
    db: AsyncIOMotorDatabase,
    now: datetime,
) -> int:
    from app.services.booking_state_machine import emit_booking_update  # noqa: PLC0415

    transitioned = 0
    cursor = db.bookings.find(
        {
            "status": "requested",
            "request_sla_expires_at": {MONGO_EXISTS: True, "$ne": None, "$lte": now},
        },
        {"_id": 1, "grihasta_id": 1, "acharya_id": 1},
    )

    async for booking in cursor:
        booking_id = str(booking.get("_id"))
        result = await db.bookings.update_one(
            {
                "_id": booking.get("_id"),
                "status": "requested",
                "request_sla_expires_at": {MONGO_EXISTS: True, "$ne": None, "$lte": now},
            },
            {
                "$set": {
                    "status": "rejected",
                    "cancellation_reason": SLA_AUTO_REJECT_REASON,
                    "updated_at": now,
                }
            },
        )
        if result.modified_count == 0:
            continue
        alternatives = await BookingDiscoveryService.find_alternative_acharyas(
            db,
            booking_like=booking,
            exclude_acharya_id=str(booking.get("acharya_id") or ""),
            limit=3,
        )
        if alternatives:
            await db.bookings.update_one(
                {"_id": booking.get("_id")},
                {"$set": {"alternative_acharya_suggestions": alternatives, "updated_at": now}},
            )
        transitioned += 1
        await emit_booking_update(
            booking_id,
            booking,
            "rejected",
            extra={
                "reason": SLA_AUTO_REJECT_REASON,
                "alternative_acharyas": alternatives,
            },
        )

    return transitioned


async def _transition_legacy_requested_fallback(
    db: AsyncIOMotorDatabase,
    now: datetime,
) -> int:
    from app.services.booking_state_machine import emit_booking_update  # noqa: PLC0415

    cutoff = now - timedelta(hours=REQUESTED_TTL_HOURS)
    transitioned = 0
    cursor = db.bookings.find(
        {
            "status": "requested",
            "created_at": {"$lt": cutoff},
            "$or": [
                {"request_sla_expires_at": {MONGO_EXISTS: False}},
                {"request_sla_expires_at": None},
            ],
        },
        {"_id": 1, "grihasta_id": 1, "acharya_id": 1},
    )

    async for booking in cursor:
        booking_id = str(booking.get("_id"))
        result = await db.bookings.update_one(
            {
                "_id": booking.get("_id"),
                "status": "requested",
                "$or": [
                    {"request_sla_expires_at": {MONGO_EXISTS: False}},
                    {"request_sla_expires_at": None},
                ],
            },
            {
                "$set": {
                    "status": "cancelled",
                    "cancellation_reason": LEGACY_REQUEST_CANCEL_REASON,
                    "updated_at": now,
                }
            },
        )
        if result.modified_count == 0:
            continue
        transitioned += 1
        await emit_booking_update(
            booking_id,
            booking,
            "cancelled",
            extra={"reason": LEGACY_REQUEST_CANCEL_REASON},
        )

    return transitioned


async def _transition_stale_pending_payment(
    db: AsyncIOMotorDatabase,
    now: datetime,
) -> int:
    from app.services.booking_state_machine import emit_booking_update  # noqa: PLC0415

    cutoff = now - timedelta(minutes=PENDING_PAYMENT_TTL_MINUTES)
    transitioned = 0
    cursor = db.bookings.find(
        {
            "status": "pending_payment",
            "created_at": {"$lt": cutoff},
        },
        {"_id": 1, "grihasta_id": 1, "acharya_id": 1},
    )

    async for booking in cursor:
        booking_id = str(booking.get("_id"))
        result = await db.bookings.update_one(
            {
                "_id": booking.get("_id"),
                "status": "pending_payment",
            },
            {
                "$set": {
                    "status": "failed",
                    "cancellation_reason": PENDING_PAYMENT_FAIL_REASON,
                    "updated_at": now,
                }
            },
        )
        if result.modified_count == 0:
            continue
        transitioned += 1
        await emit_booking_update(
            booking_id,
            booking,
            "failed",
            extra={"reason": PENDING_PAYMENT_FAIL_REASON},
        )

    return transitioned


async def expire_stale_bookings(db: AsyncIOMotorDatabase) -> int:
    """
    Find and auto-cancel all stale bookings.

    Returns
    -------
    int
        Number of bookings cancelled in this run.
    """
    now = datetime.now(timezone.utc)
    reminder_emissions = await _process_sla_reminders(db, now)
    payment_recovery_emissions = await _process_pending_payment_recovery_reminders(db, now)
    auto_rejected_count = await _transition_expired_requested_with_sla(db, now)
    legacy_cancelled_count = await _transition_legacy_requested_fallback(db, now)
    pending_failed_count = await _transition_stale_pending_payment(db, now)

    transitioned_count = (
        auto_rejected_count + legacy_cancelled_count + pending_failed_count
    )

    if reminder_emissions:
        logger.info("[expiry_worker] Emitted %d SLA reminder notifications.", reminder_emissions)

    if payment_recovery_emissions:
        logger.info(
            "[expiry_worker] Emitted %d pending-payment recovery nudges.",
            payment_recovery_emissions,
        )

    if transitioned_count:
        logger.info(
            "[expiry_worker] Transitioned bookings: auto_rejected=%d legacy_cancelled=%d pending_failed=%d",
            auto_rejected_count,
            legacy_cancelled_count,
            pending_failed_count,
        )

    return transitioned_count


async def run_expiry_loop(db: AsyncIOMotorDatabase) -> None:
    """
    Infinite loop that calls expire_stale_bookings() every POLL_INTERVAL_SECONDS.
    Designed to be launched via asyncio.create_task().
    """
    logger.info(
        "[expiry_worker] Started (interval=%ds, requested_ttl=%dh, pending_payment_ttl=%dmin, request_sla=%dmin, reminder_schedule=%s).",
        POLL_INTERVAL_SECONDS,
        REQUESTED_TTL_HOURS,
        PENDING_PAYMENT_TTL_MINUTES,
        settings.REQUEST_MODE_SLA_MINUTES,
        settings.REQUEST_MODE_SLA_REMINDER_SCHEDULE,
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
