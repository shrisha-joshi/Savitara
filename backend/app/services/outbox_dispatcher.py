"""Helpers for enqueueing side-effects into the durable outbox."""
from __future__ import annotations

from typing import Any, Dict, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services.outbox_service import outbox_service


async def enqueue_fcm_single(
    db: AsyncIOMotorDatabase,
    *,
    token: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
    image_url: Optional[str] = None,
    dedupe_key: Optional[str] = None,
) -> str:
    return await outbox_service.enqueue(
        db,
        channel="fcm_single",
        payload={
            "token": token,
            "title": title,
            "body": body,
            "data": data or {},
            "image_url": image_url,
        },
        dedupe_key=dedupe_key,
    )


async def enqueue_ws_personal(
    db: AsyncIOMotorDatabase,
    *,
    user_id: str,
    message: Dict[str, Any],
    dedupe_key: Optional[str] = None,
) -> str:
    return await outbox_service.enqueue(
        db,
        channel="ws_personal",
        payload={
            "user_id": user_id,
            "message": message,
        },
        dedupe_key=dedupe_key,
    )


async def enqueue_email(
    db: AsyncIOMotorDatabase,
    *,
    to_email: str,
    subject: str,
    body: str,
    html_body: Optional[str] = None,
    dedupe_key: Optional[str] = None,
) -> str:
    return await outbox_service.enqueue(
        db,
        channel="email",
        payload={
            "to_email": to_email,
            "subject": subject,
            "body": body,
            "html_body": html_body,
        },
        dedupe_key=dedupe_key,
    )


async def enqueue_sms(
    db: AsyncIOMotorDatabase,
    *,
    to_number: str,
    message: str,
    dedupe_key: Optional[str] = None,
) -> str:
    return await outbox_service.enqueue(
        db,
        channel="sms",
        payload={
            "to_number": to_number,
            "message": message,
        },
        dedupe_key=dedupe_key,
    )
