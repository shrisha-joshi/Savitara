"""MongoDB booking repository implementation."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.constants import (
    FIELD_POOJA_NAME,
    FIELD_SERVICE_NAME,
    MONGO_IF_NULL,
    MONGO_LIMIT,
    MONGO_LOOKUP,
    MONGO_MATCH,
    MONGO_SKIP,
    MONGO_SORT,
    MONGO_UNWIND,
)
from app.core.exceptions import PermissionDeniedError
from app.core.interfaces import IBookingRepository
from app.models.database import UserRole
from app.utils.id_utils import ensure_object_id

logger = logging.getLogger(__name__)


class MongoBookingRepository(IBookingRepository):
    """MongoDB-backed repository for booking queries and updates."""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    async def find_by_id(self, booking_id: str) -> Optional[Dict[str, Any]]:
        booking_oid = ensure_object_id(booking_id, "booking_id")
        return await self.db.bookings.find_one({"_id": booking_oid})

    async def find_for_user(
        self,
        user_id: str,
        role: str,
        status_filter: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[Dict[str, Any]], int]:
        query = await self._build_user_booking_query(user_id, role, status_filter)
        pipeline = self._build_my_bookings_pipeline(query, page, limit)
        bookings = await self.db.bookings.aggregate(pipeline).to_list(length=limit)
        total_count = await self.db.bookings.count_documents(query)
        return bookings, total_count

    async def update_status(
        self,
        booking_id: str,
        status: str,
        extra_fields: Optional[Dict[str, Any]] = None,
    ) -> bool:
        booking_oid = ensure_object_id(booking_id, "booking_id")
        update_doc = {
            "status": status,
            "updated_at": datetime.now(timezone.utc),
        }
        if extra_fields:
            update_doc.update(extra_fields)

        result = await self.db.bookings.update_one(
            {"_id": booking_oid},
            {"$set": update_doc},
        )
        return result.matched_count > 0

    async def update_attendance(
        self,
        booking_id: str,
        attendance: Dict[str, Any],
    ) -> bool:
        booking_oid = ensure_object_id(booking_id, "booking_id")
        result = await self.db.bookings.update_one(
            {"_id": booking_oid},
            {
                "$set": {
                    "attendance": attendance,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        return result.matched_count > 0

    async def find_with_details(self, booking_id: str) -> Optional[Dict[str, Any]]:
        pipeline = [
            {MONGO_MATCH: {"_id": ensure_object_id(booking_id, "booking_id")}},
            {
                MONGO_LOOKUP: {
                    "from": "poojas",
                    "localField": "pooja_id",
                    "foreignField": "_id",
                    "as": "pooja",
                }
            },
            {MONGO_UNWIND: {"path": "$pooja", "preserveNullAndEmptyArrays": True}},
            {
                MONGO_LOOKUP: {
                    "from": "acharya_profiles",
                    "localField": "acharya_id",
                    "foreignField": "_id",
                    "as": "acharya",
                }
            },
            {MONGO_UNWIND: {"path": "$acharya", "preserveNullAndEmptyArrays": True}},
            {
                MONGO_LOOKUP: {
                    "from": "users",
                    "localField": "grihasta_id",
                    "foreignField": "_id",
                    "as": "grihasta_user",
                }
            },
            {MONGO_UNWIND: {"path": "$grihasta_user", "preserveNullAndEmptyArrays": True}},
            {
                MONGO_LOOKUP: {
                    "from": "users",
                    "localField": "acharya.user_id",
                    "foreignField": "_id",
                    "as": "acharya_user",
                }
            },
            {MONGO_UNWIND: {"path": "$acharya_user", "preserveNullAndEmptyArrays": True}},
            {
                "$addFields": {
                    "pooja_name": {MONGO_IF_NULL: [FIELD_POOJA_NAME, FIELD_SERVICE_NAME]},
                    "acharya_user_id": "$acharya.user_id",
                    "pooja_type": {MONGO_IF_NULL: [FIELD_POOJA_NAME, FIELD_SERVICE_NAME]},
                    "grihasta_name": {
                        MONGO_IF_NULL: [
                            "$grihasta_user.full_name",
                            "$grihasta_user.name",
                        ]
                    },
                    "acharya_name": {
                        MONGO_IF_NULL: [
                            "$acharya.name",
                            "$acharya_user.full_name",
                            "$acharya_user.name",
                        ]
                    },
                    "scheduled_datetime": "$date_time",
                }
            },
        ]

        bookings = await self.db.bookings.aggregate(pipeline).to_list(length=1)
        return bookings[0] if bookings else None

    @staticmethod
    def _safe_object_id(user_id: str) -> Optional[ObjectId]:
        try:
            return ObjectId(user_id)
        except (InvalidId, ValueError, TypeError):
            logger.warning("Could not convert user_id to ObjectId: %s", user_id)
            return None

    @staticmethod
    def _dedupe_candidates(candidates: List[Any]) -> List[Any]:
        deduped: List[Any] = []
        seen: set[str] = set()
        for candidate in candidates:
            key = f"{type(candidate).__name__}:{candidate}"
            if key in seen:
                continue
            seen.add(key)
            deduped.append(candidate)
        return deduped

    @staticmethod
    def _build_grihasta_query(user_id: str, user_obj_id: Optional[ObjectId]) -> Dict[str, Any]:
        candidates: List[Any] = [user_id]
        if user_obj_id:
            candidates.append(user_obj_id)
        return {"grihasta_id": {"$in": MongoBookingRepository._dedupe_candidates(candidates)}}

    @staticmethod
    def _build_acharya_profile_lookup(
        user_id: str,
        user_obj_id: Optional[ObjectId],
    ) -> Dict[str, Any]:
        if user_obj_id:
            return {"$or": [{"user_id": user_obj_id}, {"user_id": user_id}]}
        return {"user_id": user_id}

    async def _build_acharya_query(
        self,
        user_id: str,
        user_obj_id: Optional[ObjectId],
    ) -> Dict[str, Any]:
        acharya_profile_lookup = self._build_acharya_profile_lookup(user_id, user_obj_id)
        acharya_profile = await self.db.acharya_profiles.find_one(
            acharya_profile_lookup,
            {"_id": 1},
        )
        acharya_profile_id = acharya_profile.get("_id") if acharya_profile else None

        candidates: List[Any] = [user_id]
        if user_obj_id:
            candidates.append(user_obj_id)
        if acharya_profile_id is not None:
            candidates.append(acharya_profile_id)
            candidates.append(str(acharya_profile_id))

        return {"acharya_id": {"$in": self._dedupe_candidates(candidates)}}

    async def _build_user_booking_query(
        self,
        user_id: str,
        role: str,
        status_filter: Optional[str],
    ) -> Dict[str, Any]:
        user_obj_id = self._safe_object_id(user_id)

        if role == UserRole.GRIHASTA.value:
            query = self._build_grihasta_query(user_id, user_obj_id)
        elif role == UserRole.ACHARYA.value:
            query = await self._build_acharya_query(user_id, user_obj_id)
        else:
            raise PermissionDeniedError(action="View bookings")

        if status_filter:
            query["status"] = status_filter
        return query

    @staticmethod
    def _build_my_bookings_pipeline(
        query: Dict[str, Any], page: int, limit: int
    ) -> List[Dict[str, Any]]:
        return [
            {MONGO_MATCH: query},
            {
                MONGO_LOOKUP: {
                    "from": "poojas",
                    "localField": "pooja_id",
                    "foreignField": "_id",
                    "as": "pooja",
                }
            },
            {MONGO_UNWIND: {"path": "$pooja", "preserveNullAndEmptyArrays": True}},
            {
                MONGO_LOOKUP: {
                    "from": "acharya_profiles",
                    "localField": "acharya_id",
                    "foreignField": "_id",
                    "as": "acharya",
                }
            },
            {MONGO_UNWIND: {"path": "$acharya", "preserveNullAndEmptyArrays": True}},
            {
                MONGO_LOOKUP: {
                    "from": "users",
                    "localField": "grihasta_id",
                    "foreignField": "_id",
                    "as": "grihasta_user",
                }
            },
            {MONGO_UNWIND: {"path": "$grihasta_user", "preserveNullAndEmptyArrays": True}},
            {
                MONGO_LOOKUP: {
                    "from": "users",
                    "localField": "acharya.user_id",
                    "foreignField": "_id",
                    "as": "acharya_user",
                }
            },
            {MONGO_UNWIND: {"path": "$acharya_user", "preserveNullAndEmptyArrays": True}},
            {
                "$addFields": {
                    "pooja_name": {MONGO_IF_NULL: [FIELD_POOJA_NAME, FIELD_SERVICE_NAME]},
                    "acharya_user_id": "$acharya.user_id",
                    "pooja_type": {MONGO_IF_NULL: [FIELD_POOJA_NAME, FIELD_SERVICE_NAME]},
                    "grihasta_name": {
                        MONGO_IF_NULL: [
                            "$grihasta_user.full_name",
                            "$grihasta_user.name",
                        ]
                    },
                    "acharya_name": {
                        MONGO_IF_NULL: [
                            "$acharya.name",
                            "$acharya_user.full_name",
                            "$acharya_user.name",
                        ]
                    },
                    "scheduled_datetime": "$date_time",
                }
            },
            {MONGO_SORT: {"created_at": -1}},
            {MONGO_SKIP: (page - 1) * limit},
            {MONGO_LIMIT: limit},
        ]
