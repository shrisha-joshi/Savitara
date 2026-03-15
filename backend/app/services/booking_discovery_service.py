"""
Booking Discovery Service
Supports booking conversion and discovery features:
- slot confidence scoring
- response-time badges
- best-value bundles
- personalized package recommendations
- waitlist auto-match
- alternative Acharya suggestions
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services.pricing_service import PricingService


class BookingDiscoveryService:
    """Pure application service for discovery-oriented booking helpers."""

    RESPONSE_BADGES = (
        (15, "lightning_fast", "Lightning Fast"),
        (60, "quick_responder", "Quick Responder"),
        (180, "same_day_responder", "Same-day Responder"),
        (720, "steady_responder", "Steady Responder"),
    )

    @staticmethod
    def _safe_object_id(value: Any) -> Any:
        if isinstance(value, ObjectId):
            return value
        if isinstance(value, str) and ObjectId.is_valid(value):
            return ObjectId(value)
        return value

    @staticmethod
    def _normalize_datetime(value: Any) -> Optional[datetime]:
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

    @staticmethod
    def _resolve_acharya_identifiers(acharya_profile: Dict[str, Any]) -> List[str]:
        identifiers: List[str] = []
        for value in (acharya_profile.get("_id"), acharya_profile.get("user_id")):
            if value is None:
                continue
            normalized = str(value)
            if normalized not in identifiers:
                identifiers.append(normalized)
        return identifiers

    @staticmethod
    async def _get_daily_booking_load(
        db: AsyncIOMotorDatabase,
        acharya_ids: List[str],
        day_start: datetime,
        day_end: datetime,
    ) -> int:
        return await db.bookings.count_documents(
            {
                "acharya_id": {"$in": acharya_ids},
                "date_time": {"$gte": day_start, "$lt": day_end},
                "status": {"$in": ["confirmed", "pending_payment", "in_progress", "requested"]},
            }
        )

    @staticmethod
    def _apply_load_adjustment(score: float, daily_load: int, factors: List[str]) -> float:
        if daily_load >= 6:
            factors.append("High booking load on requested day")
            return score - 12.0
        if daily_load >= 3:
            factors.append("Moderate booking load on requested day")
            return score - 6.0
        factors.append("Light booking load on requested day")
        return score

    @staticmethod
    def _apply_lead_time_adjustment(
        score: float,
        requested_start: datetime,
        factors: List[str],
    ) -> float:
        hours_until_slot = max(
            0.0,
            (requested_start - datetime.now(timezone.utc)).total_seconds() / 3600,
        )
        if hours_until_slot <= 6:
            factors.append("Very short notice booking")
            return score - 10.0
        if hours_until_slot <= 24:
            factors.append("Short notice booking")
            return score - 4.0
        factors.append("Plenty of lead time before booking")
        return score

    @staticmethod
    async def _slot_has_calendar_support(
        db: AsyncIOMotorDatabase,
        *,
        acharya_ids: List[str],
        day_start: datetime,
        day_end: datetime,
        requested_start: datetime,
        requested_end: datetime,
    ) -> Optional[bool]:
        schedule = await db.acharya_schedules.find_one(
            {
                "acharya_id": {"$in": [BookingDiscoveryService._safe_object_id(value) for value in acharya_ids]},
                "date": {"$gte": day_start, "$lt": day_end},
            },
            {"slots": 1},
        )
        if not schedule:
            return None

        for slot in schedule.get("slots", []):
            slot_start = BookingDiscoveryService._normalize_datetime(slot.get("start_time"))
            slot_end = BookingDiscoveryService._normalize_datetime(slot.get("end_time"))
            if (
                slot.get("status") == "available"
                and slot_start is not None
                and slot_end is not None
                and slot_start <= requested_start
                and slot_end >= requested_end
            ):
                return True
        return False

    @staticmethod
    def _apply_calendar_adjustment(
        score: float,
        calendar_support: Optional[bool],
        factors: List[str],
    ) -> tuple[float, bool]:
        if calendar_support is None:
            factors.append("No calendar block found; confidence based on live bookings")
            return score, False
        if calendar_support:
            factors.append("Acharya calendar explicitly marks this slot available")
            return score + 5.0, True
        factors.append("Requested slot is outside declared availability blocks")
        return score - 8.0, False

    @staticmethod
    def _confidence_tier(score: float) -> str:
        if score >= 80:
            return "high"
        if score >= 60:
            return "medium"
        return "low"

    @staticmethod
    async def calculate_slot_confidence(
        db: AsyncIOMotorDatabase,
        *,
        acharya_profile: Dict[str, Any],
        requested_start: datetime,
        requested_end: datetime,
        conflicts: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Estimate confidence that a slot remains bookable and operationally safe."""
        score = 92.0 if not conflicts else max(18.0, 52.0 - (len(conflicts) * 12.0))
        factors: List[str] = []

        day_start = requested_start.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        acharya_ids = BookingDiscoveryService._resolve_acharya_identifiers(acharya_profile)
        daily_load = await BookingDiscoveryService._get_daily_booking_load(
            db,
            acharya_ids,
            day_start,
            day_end,
        )
        score = BookingDiscoveryService._apply_load_adjustment(score, daily_load, factors)
        score = BookingDiscoveryService._apply_lead_time_adjustment(score, requested_start, factors)
        calendar_support = await BookingDiscoveryService._slot_has_calendar_support(
            db,
            acharya_ids=acharya_ids,
            day_start=day_start,
            day_end=day_end,
            requested_start=requested_start,
            requested_end=requested_end,
        )
        score, schedule_bonus = BookingDiscoveryService._apply_calendar_adjustment(
            score,
            calendar_support,
            factors,
        )

        if conflicts:
            factors.append(f"{len(conflicts)} overlapping booking conflict(s) detected")
        else:
            factors.append("No overlapping active bookings detected")

        score = round(max(1.0, min(score, 99.0)), 1)
        tier = BookingDiscoveryService._confidence_tier(score)

        return {
            "score": score,
            "tier": tier,
            "factors": factors,
            "daily_booking_load": daily_load,
            "calendar_backed": schedule_bonus,
        }

    @staticmethod
    async def get_response_time_badge(
        db: AsyncIOMotorDatabase,
        acharya_profile: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Return a listing-friendly response-time badge for an Acharya."""
        if db is None:
            return {
                "code": "unavailable",
                "label": "Badge unavailable",
                "avg_response_minutes": None,
                "response_time_score": 0.0,
                "sample_size": 0,
                "eligible": False,
            }
        identifiers = BookingDiscoveryService._resolve_acharya_identifiers(acharya_profile)
        bookings = await db.bookings.find(
            {
                "acharya_id": {"$in": identifiers},
                "status": {"$in": ["confirmed", "completed", "rejected"]},
            },
            {"created_at": 1, "updated_at": 1, "accepted_at": 1},
        ).sort("created_at", -1).to_list(length=30)

        response_minutes: List[float] = []
        for booking in bookings:
            created_at = BookingDiscoveryService._normalize_datetime(booking.get("created_at"))
            responded_at = BookingDiscoveryService._normalize_datetime(
                booking.get("accepted_at") or booking.get("updated_at")
            )
            if created_at is None or responded_at is None or responded_at < created_at:
                continue
            response_minutes.append((responded_at - created_at).total_seconds() / 60)

        if not response_minutes:
            return {
                "code": "new_responder",
                "label": "New Responder",
                "avg_response_minutes": None,
                "response_time_score": 50.0,
                "sample_size": 0,
                "eligible": False,
            }

        avg_minutes = round(sum(response_minutes) / len(response_minutes), 1)
        badge_code = "deliberate_responder"
        badge_label = "Deliberate Responder"
        for threshold, code, label in BookingDiscoveryService.RESPONSE_BADGES:
            if avg_minutes <= threshold:
                badge_code = code
                badge_label = label
                break

        if avg_minutes <= 15:
            score = 100.0
        elif avg_minutes <= 60:
            score = 90.0
        elif avg_minutes <= 180:
            score = 75.0
        elif avg_minutes <= 720:
            score = 60.0
        else:
            score = 35.0

        return {
            "code": badge_code,
            "label": badge_label,
            "avg_response_minutes": avg_minutes,
            "response_time_score": score,
            "sample_size": len(response_minutes),
            "eligible": len(response_minutes) >= 3,
        }

    @staticmethod
    async def _fetch_service_docs(
        db: AsyncIOMotorDatabase,
        service_ids: Iterable[str],
    ) -> List[Dict[str, Any]]:
        docs: List[Dict[str, Any]] = []
        object_ids = [ObjectId(service_id) for service_id in service_ids if ObjectId.is_valid(service_id)]
        if object_ids:
            docs.extend(await db.services.find({"_id": {"$in": object_ids}}).to_list(length=len(object_ids)))
            docs.extend(await db.poojas.find({"_id": {"$in": object_ids}}).to_list(length=len(object_ids)))

        deduped: Dict[str, Dict[str, Any]] = {}
        for doc in docs:
            deduped[str(doc.get("_id"))] = doc
        return list(deduped.values())

    @staticmethod
    def _service_price(service_doc: Dict[str, Any]) -> float:
        return float(service_doc.get("base_price") or service_doc.get("price") or 500.0)

    @staticmethod
    async def _load_anchor_bundle_docs(
        db: AsyncIOMotorDatabase,
        *,
        user_id: str,
        service_ids: List[str],
    ) -> List[Dict[str, Any]]:
        anchor_docs = await BookingDiscoveryService._fetch_service_docs(db, service_ids)
        if anchor_docs:
            return anchor_docs

        recent = await db.bookings.find(
            {"grihasta_id": user_id, "pooja_id": {"$ne": None}},
            {"pooja_id": 1},
        ).sort("created_at", -1).to_list(length=3)
        return await BookingDiscoveryService._fetch_service_docs(
            db,
            [str(item.get("pooja_id")) for item in recent if item.get("pooja_id")],
        )

    @staticmethod
    async def _build_bundle_candidate_pool(
        db: AsyncIOMotorDatabase,
        anchor_docs: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        categories = {doc.get("category") for doc in anchor_docs if doc.get("category")}
        names = {doc.get("name") for doc in anchor_docs if doc.get("name")}

        candidate_query: Dict[str, Any] = {"is_active": {"$ne": False}}
        if categories:
            candidate_query["category"] = {"$in": list(categories)}

        candidates = await db.services.find(candidate_query).limit(12).to_list(length=12)
        candidates.extend(
            await db.poojas.find({"name": {"$nin": list(names)}}).limit(12).to_list(length=12)
        )

        deduped_candidates: Dict[str, Dict[str, Any]] = {}
        for doc in [*anchor_docs, *candidates]:
            deduped_candidates.setdefault(str(doc.get("_id")), doc)
        return list(deduped_candidates.values())[:8]

    @staticmethod
    def _build_bundle_payload(
        anchor_docs: List[Dict[str, Any]],
        extra_doc: Dict[str, Any],
        anchor_ids: set[str],
    ) -> Optional[Dict[str, Any]]:
        bundle_docs = [*anchor_docs]
        if str(extra_doc.get("_id")) not in anchor_ids:
            bundle_docs.append(extra_doc)
        if len(bundle_docs) < 2:
            return None

        subtotal = sum(BookingDiscoveryService._service_price(doc) for doc in bundle_docs)
        discount_pct = 0.10 if len(bundle_docs) >= 3 else 0.05
        savings = round(subtotal * discount_pct, 2)
        total = round(subtotal - savings, 2)
        bundle_key = tuple(sorted(str(doc.get("_id")) for doc in bundle_docs))

        return {
            "bundle_key": "-".join(bundle_key),
            "services": [
                {
                    "id": str(doc.get("_id")),
                    "name": doc.get("name", "Unknown Service"),
                    "category": doc.get("category"),
                    "base_price": BookingDiscoveryService._service_price(doc),
                }
                for doc in bundle_docs
            ],
            "service_count": len(bundle_docs),
            "subtotal": round(subtotal, 2),
            "bundle_discount_pct": int(discount_pct * 100),
            "savings": savings,
            "total": total,
            "recommended_reason": "Best value combo based on selected ritual mix",
        }

    @staticmethod
    def _dedupe_sorted_bundles(
        bundles: List[Dict[str, Any]],
        limit: int,
    ) -> List[Dict[str, Any]]:
        bundles.sort(key=lambda item: (-item["savings"], -item["service_count"], item["total"]))
        unique_bundles: List[Dict[str, Any]] = []
        seen_keys = set()
        for bundle in bundles:
            if bundle["bundle_key"] in seen_keys:
                continue
            seen_keys.add(bundle["bundle_key"])
            unique_bundles.append(bundle)
            if len(unique_bundles) >= limit:
                break
        return unique_bundles

    @staticmethod
    async def get_best_value_bundles(
        db: AsyncIOMotorDatabase,
        *,
        user_id: str,
        service_ids: List[str],
        limit: int = 3,
    ) -> List[Dict[str, Any]]:
        """Recommend bundle combinations with transparent savings."""
        anchor_docs = await BookingDiscoveryService._load_anchor_bundle_docs(
            db,
            user_id=user_id,
            service_ids=service_ids,
        )
        if not anchor_docs:
            return []

        pool = await BookingDiscoveryService._build_bundle_candidate_pool(db, anchor_docs)
        anchor_ids = {str(doc.get("_id")) for doc in anchor_docs}
        bundles: List[Dict[str, Any]] = []

        for extra_doc in pool:
            bundle = BookingDiscoveryService._build_bundle_payload(anchor_docs, extra_doc, anchor_ids)
            if bundle is not None:
                bundles.append(bundle)

        return BookingDiscoveryService._dedupe_sorted_bundles(bundles, limit)

    @staticmethod
    async def get_personalized_packages(
        db: AsyncIOMotorDatabase,
        *,
        user_id: str,
        limit: int = 3,
    ) -> List[Dict[str, Any]]:
        """Recommend ritual packages using booking history and service affinity."""
        recent_bookings = await db.bookings.find(
            {"grihasta_id": user_id},
            {"pooja_id": 1, "service_name": 1},
        ).sort("created_at", -1).to_list(length=20)

        service_docs = await BookingDiscoveryService._fetch_service_docs(
            db,
            [str(booking.get("pooja_id")) for booking in recent_bookings if booking.get("pooja_id")],
        )
        category_counts = Counter(
            doc.get("category") for doc in service_docs if doc.get("category")
        )
        top_categories = [category for category, _ in category_counts.most_common(3)]

        if not top_categories:
            trending = await db.services.find({"is_active": {"$ne": False}}).limit(limit * 3).to_list(length=limit * 3)
        else:
            trending = await db.services.find(
                {"category": {"$in": top_categories}, "is_active": {"$ne": False}}
            ).limit(limit * 4).to_list(length=limit * 4)

        packages: List[Dict[str, Any]] = []
        for category in top_categories or [None]:
            docs = [doc for doc in trending if category is None or doc.get("category") == category][:3]
            if not docs:
                continue
            subtotal = sum(BookingDiscoveryService._service_price(doc) for doc in docs)
            pricing = PricingService.calculate_price(
                base_price=subtotal,
                booking_datetime=datetime.now(timezone.utc),
                has_samagri=False,
                duration_hours=max(1, len(docs)),
            )
            packages.append(
                {
                    "package_name": f"{(category or 'Recommended').title()} Ritual Package",
                    "category": category,
                    "services": [
                        {
                            "id": str(doc.get("_id")),
                            "name": doc.get("name", "Unknown Service"),
                            "base_price": BookingDiscoveryService._service_price(doc),
                        }
                        for doc in docs
                    ],
                    "price_estimate": round(pricing.get("total", subtotal), 2),
                    "match_reason": (
                        f"Inspired by your recent interest in {category} rituals"
                        if category
                        else "Popular package for first-time devotees"
                    ),
                }
            )
            if len(packages) >= limit:
                break

        return packages[:limit]

    @staticmethod
    async def _candidate_is_available(
        db: AsyncIOMotorDatabase,
        *,
        acharya_id_values: List[str],
        requested_start: datetime,
        requested_end: datetime,
    ) -> bool:
        candidates = await db.bookings.find(
            {
                "acharya_id": {"$in": acharya_id_values},
                "status": {"$in": ["confirmed", "pending_payment", "in_progress"]},
                "date_time": {
                    "$gte": requested_start - timedelta(hours=6),
                    "$lt": requested_end + timedelta(hours=6),
                },
            },
            {"date_time": 1, "end_time": 1},
        ).to_list(length=20)

        for booking in candidates:
            booking_start = BookingDiscoveryService._normalize_datetime(booking.get("date_time"))
            booking_end = BookingDiscoveryService._normalize_datetime(booking.get("end_time"))
            if booking_start is None:
                continue
            if booking_end is None:
                booking_end = booking_start + timedelta(hours=2)
            if booking_start < requested_end and booking_end > requested_start:
                return False
        return True

    @staticmethod
    def _resolve_request_window(booking_like: Dict[str, Any]) -> tuple[Optional[datetime], Optional[datetime]]:
        requested_start = BookingDiscoveryService._normalize_datetime(
            booking_like.get("date_time") or booking_like.get("scheduled_datetime")
        )
        requested_end = BookingDiscoveryService._normalize_datetime(booking_like.get("end_time"))
        if requested_start is not None and requested_end is None:
            duration_hours = int(booking_like.get("duration_hours") or 2)
            requested_end = requested_start + timedelta(hours=duration_hours)
        return requested_start, requested_end

    @staticmethod
    async def _load_original_profile(
        db: AsyncIOMotorDatabase,
        original_acharya_id: str,
    ) -> Optional[Dict[str, Any]]:
        if not original_acharya_id:
            return None
        return await db.acharya_profiles.find_one(
            {
                "$or": [
                    {"_id": BookingDiscoveryService._safe_object_id(original_acharya_id)},
                    {"user_id": original_acharya_id},
                ]
            }
        )

    @staticmethod
    def _build_alternative_query(
        booking_like: Dict[str, Any],
        original_profile: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        city = (
            booking_like.get("location", {}).get("city")
            or (original_profile or {}).get("location", {}).get("city")
        )
        specializations = (original_profile or {}).get("specializations", [])

        query: Dict[str, Any] = {"status": {"$in": ["verified", "active"]}}
        if city:
            query["location.city"] = city
        if specializations:
            query["specializations"] = {"$in": specializations}
        return query

    @staticmethod
    async def _build_alternative_payload(
        db: AsyncIOMotorDatabase,
        *,
        profile: Dict[str, Any],
        requested_start: Optional[datetime],
        requested_end: Optional[datetime],
    ) -> Dict[str, Any]:
        identifiers = BookingDiscoveryService._resolve_acharya_identifiers(profile)
        available = True
        if requested_start is not None and requested_end is not None:
            available = await BookingDiscoveryService._candidate_is_available(
                db,
                acharya_id_values=identifiers,
                requested_start=requested_start,
                requested_end=requested_end,
            )
        badge = await BookingDiscoveryService.get_response_time_badge(db, profile)
        return {
            "acharya_id": str(profile.get("_id")),
            "name": profile.get("name"),
            "city": profile.get("location", {}).get("city"),
            "specializations": profile.get("specializations", []),
            "rating": (profile.get("ratings") or {}).get("average", 0.0),
            "response_time_badge": badge,
            "available_for_requested_slot": available,
            "recommendation_reason": "Same city and compatible specialization",
        }

    @staticmethod
    async def find_alternative_acharyas(
        db: AsyncIOMotorDatabase,
        *,
        booking_like: Dict[str, Any],
        exclude_acharya_id: Optional[str] = None,
        limit: int = 3,
    ) -> List[Dict[str, Any]]:
        """Find backup alternatives for a declined or timed-out booking."""
        requested_start, requested_end = BookingDiscoveryService._resolve_request_window(booking_like)
        original_acharya_id = exclude_acharya_id or str(booking_like.get("acharya_id") or "")
        original_profile = await BookingDiscoveryService._load_original_profile(db, original_acharya_id)
        query = BookingDiscoveryService._build_alternative_query(booking_like, original_profile)
        profiles = await db.acharya_profiles.find(query).sort("ratings.average", -1).to_list(length=20)
        alternatives: List[Dict[str, Any]] = []
        for profile in profiles:
            identifiers = BookingDiscoveryService._resolve_acharya_identifiers(profile)
            if original_acharya_id and original_acharya_id in identifiers:
                continue
            alternatives.append(
                await BookingDiscoveryService._build_alternative_payload(
                    db,
                    profile=profile,
                    requested_start=requested_start,
                    requested_end=requested_end,
                )
            )

        alternatives.sort(
            key=lambda item: (
                not item["available_for_requested_slot"],
                -(item.get("rating") or 0.0),
                item.get("response_time_badge", {}).get("avg_response_minutes") or 99999,
            )
        )
        return alternatives[:limit]

    @staticmethod
    async def create_waitlist_entry(
        db: AsyncIOMotorDatabase,
        *,
        user_id: str,
        request_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Create or refresh a waitlist entry and attach immediate matches."""
        desired_start = BookingDiscoveryService._normalize_datetime(request_data.get("desired_datetime"))
        duration_hours = int(request_data.get("duration_hours") or 2)
        desired_end = desired_start + timedelta(hours=duration_hours) if desired_start else None

        booking_like = {
            "acharya_id": request_data.get("acharya_id"),
            "date_time": desired_start,
            "end_time": desired_end,
            "location": request_data.get("location") or {},
        }
        matches = await BookingDiscoveryService.find_alternative_acharyas(
            db,
            booking_like=booking_like,
            exclude_acharya_id=request_data.get("acharya_id"),
            limit=5,
        )

        filter_doc = {
            "user_id": user_id,
            "status": {"$in": ["open", "matched"]},
            "desired_datetime": desired_start,
            "acharya_id": request_data.get("acharya_id"),
            "service_name": request_data.get("service_name"),
        }
        doc = {
            "user_id": user_id,
            "acharya_id": request_data.get("acharya_id"),
            "pooja_id": request_data.get("pooja_id"),
            "service_name": request_data.get("service_name"),
            "desired_datetime": desired_start,
            "duration_hours": duration_hours,
            "location": request_data.get("location"),
            "status": "matched" if matches else "open",
            "auto_match_candidates": matches,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }

        existing = await db.waitlist_entries.find_one(filter_doc)
        if existing:
            await db.waitlist_entries.update_one(
                {"_id": existing["_id"]},
                {"$set": {**doc, "created_at": existing.get("created_at", doc["created_at"]) }},
            )
            saved = await db.waitlist_entries.find_one({"_id": existing["_id"]})
        else:
            result = await db.waitlist_entries.insert_one(doc)
            saved = await db.waitlist_entries.find_one({"_id": result.inserted_id})

        saved["id"] = str(saved["_id"])
        saved["_id"] = str(saved["_id"])
        if isinstance(saved.get("desired_datetime"), datetime):
            saved["desired_datetime"] = saved["desired_datetime"].isoformat()
        return saved
