"""
Shared ID/ObjectId helpers.
Keeps ObjectId parsing and validation consistent across routers/services.
"""

from __future__ import annotations

from typing import Any, Optional, Tuple

from bson import ObjectId

from app.core.exceptions import InvalidInputError


def ensure_object_id(value: Any, field: str) -> ObjectId:
    """Return ObjectId for *value* or raise InvalidInputError(field=...)."""
    raw = str(value) if value is not None else ""
    if not ObjectId.is_valid(raw):
        raise InvalidInputError(message=f"Invalid {field} format", field=field)
    return ObjectId(raw)


def maybe_object_id(value: Any) -> Optional[ObjectId]:
    """Return ObjectId(value) when valid, else None."""
    if value is None:
        return None
    raw = str(value)
    return ObjectId(raw) if ObjectId.is_valid(raw) else None


def object_id_or_raw(value: Any) -> Any:
    """Return ObjectId(value) when valid, otherwise return value unchanged."""
    return maybe_object_id(value) or value


def object_id_and_string(value: Any) -> Tuple[Optional[ObjectId], str]:
    """Return both ObjectId(if valid) and its string representation."""
    raw = str(value) if value is not None else ""
    oid = ObjectId(raw) if ObjectId.is_valid(raw) else None
    return oid, raw
