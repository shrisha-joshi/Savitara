"""
Booking State Machine
Centralises all booking status transition logic.

Rules:
- VALID_TRANSITIONS declares legal moves between statuses.
- ROLE_ALLOWED_TRANSITIONS further restricts which user roles may trigger each move.
- validate_transition() raises InvalidInputError with a human-readable message on failure.
- emit_booking_update() broadcasts a WebSocket booking_update event to both parties.

SonarQube: S3776 - low cognitive complexity; S1192 - string constants extracted.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.database import BookingStatus, UserRole
from app.core.exceptions import InvalidInputError

logger = logging.getLogger(__name__)

# ── Status value shortcuts ────────────────────────────────────────────────────
_PENDING  = BookingStatus.PENDING_PAYMENT.value   # "pending_payment"
_REQ      = BookingStatus.REQUESTED.value          # "requested"
_CONF     = BookingStatus.CONFIRMED.value          # "confirmed"
_IP       = BookingStatus.IN_PROGRESS.value        # "in_progress"
_DONE     = BookingStatus.COMPLETED.value          # "completed"
_CANCEL   = BookingStatus.CANCELLED.value          # "cancelled"
_REJECT   = BookingStatus.REJECTED.value           # "rejected"
_FAIL     = BookingStatus.FAILED.value             # "failed"

# Role shortcuts
_GR    = UserRole.GRIHASTA.value   # "grihasta"
_AC    = UserRole.ACHARYA.value    # "acharya"
_ADM   = UserRole.ADMIN.value      # "admin"
_SYS   = "system"                  # internal/automated transitions

# ── Canonical transition table ────────────────────────────────────────────────
# Maps current_status → list of valid next statuses (regardless of role).
VALID_TRANSITIONS: Dict[str, list[str]] = {
    _PENDING: [_CONF, _CANCEL, _FAIL],
    _REQ:     [_CONF, _REJECT, _CANCEL],
    _CONF:    [_IP, _CANCEL],
    _IP:      [_DONE, _CANCEL],
    _DONE:    [],
    _CANCEL:  [],
    _REJECT:  [],
    _FAIL:    [],
}

# ── Per-transition role allowlist ─────────────────────────────────────────────
# Maps (current_status, new_status) → roles that are allowed to make the move.
ROLE_ALLOWED_TRANSITIONS: Dict[tuple[str, str], list[str]] = {
    (_PENDING, _CONF):   [_GR, _ADM, _SYS],      # payment verified
    (_PENDING, _CANCEL): [_GR, _AC, _ADM, _SYS],  # any party cancels
    (_PENDING, _FAIL):   [_SYS, _ADM],            # TTL expiry
    (_REQ,  _CONF):      [_AC, _ADM],             # acharya accepts
    (_REQ,  _REJECT):    [_AC, _ADM],             # acharya rejects
    (_REQ,  _CANCEL):    [_GR, _AC, _ADM, _SYS],  # any party cancels
    (_CONF, _IP):        [_AC, _ADM],             # start booking (OTP)
    (_CONF, _CANCEL):    [_GR, _AC, _ADM],        # cancel confirmed booking
    (_IP,   _DONE):      [_SYS, _ADM],            # both attendance confirmations
    (_IP,   _CANCEL):    [_ADM, _SYS],            # admin-only mid-session cancel
}

# ── Human-readable error messages per transition ──────────────────────────────
_TRANSITION_ERRORS: Dict[tuple[str, str], str] = {
    (_PENDING, _IP):   "Cannot start a booking that hasn't been confirmed/paid yet.",
    (_PENDING, _DONE): "Cannot complete a booking that is still awaiting payment.",
    (_REQ,  _IP):      "Cannot start a booking that hasn't been confirmed yet.",
    (_REQ,  _DONE):    "Cannot complete a booking that hasn't been confirmed.",
    (_CONF, _DONE):    "Cannot complete a booking that hasn't been started.",
    (_CONF, _REJECT):  "Cannot reject a booking that is already confirmed.",
    (_IP,   _REJECT):  "Cannot reject a booking that is already in progress.",
    (_IP,   _CONF):    "Cannot re-confirm a booking that is already in progress.",
    (_DONE, _CANCEL):  "Cannot cancel a completed booking.",
    (_CANCEL, _CONF):  "Cannot confirm a cancelled booking.",
    (_REJECT, _CONF):  "Cannot confirm a rejected booking.",
}

_GENERIC_ROLE_ERROR = (
    "Your role ({role}) is not permitted to change booking status "
    "from '{current}' to '{new}'."
)


def validate_transition(
    current_status: str,
    new_status: str,
    user_role: str,
) -> None:
    """
    Validate that *current_status → new_status* is a legal move for *user_role*.

    Raises
    ------
    InvalidInputError
        If the transition is illegal or the user's role is not allowed to make it.
    """
    # No-op if status hasn't changed (idempotency-friendly)
    if current_status == new_status:
        return

    # 1. Check whether the transition exists at all
    allowed_next = VALID_TRANSITIONS.get(current_status, [])
    if new_status not in allowed_next:
        msg = _TRANSITION_ERRORS.get(
            (current_status, new_status),
            f"Cannot transition booking from '{current_status}' to '{new_status}'.",
        )
        raise InvalidInputError(
            message=msg,
            field="status",
        )

    # 2. Check whether the caller's role is permitted to perform this transition
    allowed_roles = ROLE_ALLOWED_TRANSITIONS.get((current_status, new_status), [])
    if user_role not in allowed_roles:
        raise InvalidInputError(
            message=_GENERIC_ROLE_ERROR.format(
                role=user_role,
                current=current_status,
                new=new_status,
            ),
            field="status",
        )


async def emit_booking_update(
    db: AsyncIOMotorDatabase,
    booking_id: str,
    booking_doc: Dict[str, Any],
    new_status: str,
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Broadcast a *booking_update* WebSocket event to both booking participants.

    Parameters
    ----------
    booking_doc : original booking document (before update)
    new_status  : the status the booking has just been moved to
    extra       : optional extra fields merged into the WebSocket payload
    """
    try:
        from app.services.websocket_manager import manager  # noqa: PLC0415

        grihasta_id = str(booking_doc.get("grihasta_id", ""))
        acharya_id  = str(booking_doc.get("acharya_id", ""))

        payload: Dict[str, Any] = {
            "type": "booking_update",
            "booking_id": booking_id,
            "status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "message": _status_message(new_status),
        }
        if extra:
            payload.update(extra)

        for uid in {grihasta_id, acharya_id}:
            if uid:
                await manager.send_personal_message(uid, payload)

        logger.debug(
            "booking_update WS emitted: booking=%s status=%s", booking_id, new_status
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Failed to emit booking_update WebSocket event: %s", exc
        )


def _status_message(status: str) -> str:
    """Return a user-facing message for a given booking status."""
    _msgs = {
        _CONF:   "Your booking has been confirmed.",
        _REJECT: "Your booking request was declined.",
        _CANCEL: "Your booking has been cancelled.",
        _IP:     "Your booking session has started.",
        _DONE:   "Your booking has been completed. Thank you!",
        _FAIL:   "Your booking has expired due to payment timeout.",
        _PENDING: "Payment is required to confirm your booking.",
        _REQ:    "Your booking request has been submitted.",
    }
    return _msgs.get(status, f"Booking status updated to '{status}'.")
