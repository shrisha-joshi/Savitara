"""
Idempotency Service

Provides strict idempotent request handling for retry-prone endpoints.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hashlib
import json
import re
from typing import Any, Dict, Optional, Tuple

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.core.exceptions import ConflictError, InvalidInputError


_IDEMPOTENCY_KEY_PATTERN = re.compile(r"^[A-Za-z0-9_.:-]{8,128}$")
_TTL_HOURS = 24


@dataclass(frozen=True)
class IdempotencyContext:
    """Holds an acquired idempotency lock context."""

    record_id: str
    scope: str


class IdempotencyService:
    """Service encapsulating idempotency lifecycle operations."""

    collection_name = "idempotency_keys"

    @staticmethod
    def compute_request_hash(payload: Dict[str, Any]) -> str:
        """Create deterministic SHA-256 hash for request payload."""
        canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    @staticmethod
    def _validate_key(key: Optional[str]) -> str:
        if not key:
            raise InvalidInputError(
                message="X-Idempotency-Key header is required",
                field="X-Idempotency-Key",
            )
        normalized = key.strip()
        if not _IDEMPOTENCY_KEY_PATTERN.match(normalized):
            raise InvalidInputError(
                message=(
                    "Invalid X-Idempotency-Key format. Use 8-128 chars: "
                    "letters, numbers, underscore, dot, colon, hyphen"
                ),
                field="X-Idempotency-Key",
            )
        return normalized

    @staticmethod
    def _record_id(scope: str, user_id: str, key: str) -> str:
        material = f"{scope}:{user_id}:{key}"
        return hashlib.sha256(material.encode("utf-8")).hexdigest()

    async def begin(
        self,
        db: AsyncIOMotorDatabase,
        *,
        key: Optional[str],
        scope: str,
        user_id: str,
        request_hash: str,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[IdempotencyContext]]:
        """
        Start idempotent execution.

        Returns:
            (cached_response, context)
            - cached_response is non-None when an identical request already completed.
            - context is non-None when caller should execute and complete/fail later.
        """
        normalized_key = self._validate_key(key)
        record_id = self._record_id(scope=scope, user_id=user_id, key=normalized_key)
        now = datetime.now(timezone.utc)

        existing = await db[self.collection_name].find_one({"_id": record_id})
        if existing:
            if existing.get("request_hash") != request_hash:
                raise ConflictError(
                    message="Idempotency key reused with different request payload",
                    details={"scope": scope},
                )

            if existing.get("status") == "completed":
                response_payload = existing.get("response_payload")
                if isinstance(response_payload, dict):
                    return response_payload, None

            raise ConflictError(
                message="A request with this idempotency key is already in progress",
                details={"scope": scope},
            )

        expires_at = now + timedelta(hours=_TTL_HOURS)
        doc = {
            "_id": record_id,
            "scope": scope,
            "user_id": user_id,
            "key": normalized_key,
            "request_hash": request_hash,
            "status": "in_progress",
            "created_at": now,
            "updated_at": now,
            "expires_at": expires_at,
        }
        try:
            await db[self.collection_name].insert_one(doc)
            return None, IdempotencyContext(record_id=record_id, scope=scope)
        except DuplicateKeyError:
            # Concurrent duplicate submission race: re-check record.
            raced = await db[self.collection_name].find_one({"_id": record_id})
            if raced and raced.get("status") == "completed" and raced.get("request_hash") == request_hash:
                response_payload = raced.get("response_payload")
                if isinstance(response_payload, dict):
                    return response_payload, None
            raise ConflictError(
                message="A request with this idempotency key is already in progress",
                details={"scope": scope},
            )

    async def complete(
        self,
        db: AsyncIOMotorDatabase,
        *,
        context: Optional[IdempotencyContext],
        response_payload: Dict[str, Any],
        status_code: int,
    ) -> None:
        """Mark an idempotent request as completed and persist response snapshot."""
        if context is None:
            return
        await db[self.collection_name].update_one(
            {"_id": context.record_id},
            {
                "$set": {
                    "status": "completed",
                    "status_code": status_code,
                    "response_payload": response_payload,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

    async def fail(self, db: AsyncIOMotorDatabase, *, context: Optional[IdempotencyContext]) -> None:
        """Release lock for failed requests so caller can retry with same key."""
        if context is None:
            return
        await db[self.collection_name].delete_one({"_id": context.record_id})


idempotency_service = IdempotencyService()
