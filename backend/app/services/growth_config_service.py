"""Admin-managed growth configuration service.

Provides a dynamic configuration registry for booking/growth features so
frontends and APIs can be controlled by admins without code changes.
"""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


class GrowthConfigService:
    """Central configuration service for admin-managed growth features."""

    COLLECTION_NAME = "growth_feature_configs"
    DEFAULT_CONCIERGE_HOURS = "06:00-23:00 IST"

    DEFAULT_CONFIGS: Dict[str, Dict[str, Any]] = {
        "recurring_ritual_catalog": {
            "key": "recurring_ritual_catalog",
            "category": "booking_experience",
            "label": "Recurring Ritual Catalog",
            "description": "Admin-managed recurring ritual catalog shown in subscriptions and service journeys.",
            "visibility": "both",
            "is_active": True,
            "is_system": True,
            "value": {
                "rituals": [
                    {
                        "slug": "sankashta-chaturthi",
                        "label": "Sankashta Chaturthi",
                        "default_cadence": "lunar_monthly",
                        "sort_order": 1,
                        "is_active": True,
                    },
                    {
                        "slug": "monday-rudra-abhisheka",
                        "label": "Every Monday Rudra Abhisheka",
                        "default_cadence": "weekly",
                        "sort_order": 2,
                        "is_active": True,
                    },
                    {
                        "slug": "pournima-satyanarayana",
                        "label": "Every Pournima Satyanarayana Pooja",
                        "default_cadence": "lunar_monthly",
                        "sort_order": 3,
                        "is_active": True,
                    },
                ]
            },
        },
        "financing_rules": {
            "key": "financing_rules",
            "category": "booking_experience",
            "label": "Financing Rules",
            "description": "Eligibility threshold and installment plans for high-ticket rituals.",
            "visibility": "both",
            "is_active": True,
            "is_system": True,
            "value": {
                "minimum_amount": 5000,
                "plans": [
                    {"months": 3, "apr": 0.10, "is_active": True},
                    {"months": 6, "apr": 0.12, "is_active": True},
                    {"months": 9, "apr": 0.14, "is_active": True},
                ],
            },
        },
        "pricing_rules": {
            "key": "pricing_rules",
            "category": "booking_experience",
            "label": "Pricing Rules",
            "description": "Demand thresholds, seasonal multipliers, city overrides, and fairness guardrails.",
            "visibility": "both",
            "is_active": True,
            "is_system": True,
            "value": {
                "window_hours": 2,
                "demand_thresholds": [
                    {"min_count": 12, "multiplier": 1.2},
                    {"min_count": 6, "multiplier": 1.1},
                ],
                "seasonal_rules": [
                    {"months": [9, 10, 11], "multiplier": 1.15, "label": "Festival Season"}
                ],
                "city_multipliers": {},
                "fairness": {"min_ratio": 0.8, "max_ratio": 1.35},
            },
        },
        "timeline_stages": {
            "key": "timeline_stages",
            "category": "booking_experience",
            "label": "Ceremony Timeline Stages",
            "description": "Stage codes and labels used for ceremony progress tracking.",
            "visibility": "both",
            "is_active": True,
            "is_system": True,
            "value": {
                "stages": [
                    {"code": "prep", "label": "Preparation", "sort_order": 1, "is_active": True},
                    {"code": "travel", "label": "Travel", "sort_order": 2, "is_active": True},
                    {"code": "check_in", "label": "Check In", "sort_order": 3, "is_active": True},
                    {"code": "completion", "label": "Completion", "sort_order": 4, "is_active": True},
                ]
            },
        },
        "checkout_variants": {
            "key": "checkout_variants",
            "category": "booking_experience",
            "label": "Checkout Variants",
            "description": "Segment-aware checkout variant rules used by web and mobile clients.",
            "visibility": "both",
            "is_active": True,
            "is_system": True,
            "value": {
                "variants": [
                    {
                        "key": "guided_first_booking",
                        "label": "Guided First Booking",
                        "min_bookings": 0,
                        "max_bookings": 0,
                        "sort_order": 1,
                        "is_active": True,
                    },
                    {
                        "key": "trust_badge_focus",
                        "label": "Trust Badge Focus",
                        "min_bookings": 1,
                        "max_bookings": 4,
                        "sort_order": 2,
                        "is_active": True,
                    },
                    {
                        "key": "express_repeat_checkout",
                        "label": "Express Repeat Checkout",
                        "min_bookings": 5,
                        "max_bookings": None,
                        "sort_order": 3,
                        "is_active": True,
                    },
                ]
            },
        },
        "concierge_directory": {
            "key": "concierge_directory",
            "category": "booking_experience",
            "label": "Concierge Directory",
            "description": "City-wise escalation hotlines, fallback hotline, and support windows.",
            "visibility": "both",
            "is_active": True,
            "is_system": True,
            "value": {
                "default_hotline": "+91-120-6200-1085",
                "default_hours": DEFAULT_CONCIERGE_HOURS,
                "cities": [
                    {"city": "mumbai", "hotline": "+91-22-6200-1085", "available_hours": DEFAULT_CONCIERGE_HOURS, "is_active": True},
                    {"city": "bengaluru", "hotline": "+91-80-6200-1085", "available_hours": DEFAULT_CONCIERGE_HOURS, "is_active": True},
                    {"city": "delhi", "hotline": "+91-11-6200-1085", "available_hours": DEFAULT_CONCIERGE_HOURS, "is_active": True},
                    {"city": "chennai", "hotline": "+91-44-6200-1085", "available_hours": DEFAULT_CONCIERGE_HOURS, "is_active": True},
                    {"city": "pune", "hotline": "+91-20-6200-1085", "available_hours": DEFAULT_CONCIERGE_HOURS, "is_active": True},
                ],
            },
        },
        "nps_rescue_rules": {
            "key": "nps_rescue_rules",
            "category": "booking_experience",
            "label": "NPS Rescue Rules",
            "description": "Thresholds used to trigger rescue flows for unhappy bookings.",
            "visibility": "both",
            "is_active": True,
            "is_system": True,
            "value": {"rescue_threshold": 6, "high_priority_threshold": 3},
        },
        "payment_ui_content": {
            "key": "payment_ui_content",
            "category": "booking_experience",
            "label": "Payment UI Content",
            "description": "Configurable payment UX copy and trust badge display content for web/mobile.",
            "visibility": "both",
            "is_active": True,
            "is_system": True,
            "value": {
                "title": "Complete Payment",
                "secure_text": "Secured by Razorpay · 256-bit SSL encryption",
                "secure_footer": "Powered by Razorpay • 100% Secure Payment • SSL Encrypted",
                "refund_title": "100% Money-Back Guarantee",
                "refund_body": "Cancel up to 24 hours before booking for full refund. Payment held in escrow until session is confirmed by both parties.",
                "trust_badges": ["secure", "privacy-protected"],
                "pay_button_prefix": "Pay ₹",
            },
        },
        "admin_user_role_map": {
            "key": "admin_user_role_map",
            "category": "admin_experience",
            "label": "Admin User Role Map",
            "description": "Role labels/colors and filter visibility in admin users page.",
            "visibility": "admin",
            "is_active": True,
            "is_system": True,
            "value": {
                "map": {
                    "grihasta": {"label": "Grihasta", "color": "default", "show_in_filter": True},
                    "acharya": {"label": "Acharya", "color": "primary", "show_in_filter": True},
                    "admin": {"label": "Admin", "color": "secondary", "show_in_filter": True},
                }
            },
        },
        "admin_user_status_map": {
            "key": "admin_user_status_map",
            "category": "admin_experience",
            "label": "Admin User Status Map",
            "description": "Status labels/colors for admin users page.",
            "visibility": "admin",
            "is_active": True,
            "is_system": True,
            "value": {
                "map": {
                    "active": {"label": "Active", "color": "success"},
                    "pending": {"label": "Pending", "color": "warning"},
                    "suspended": {"label": "Suspended", "color": "error"},
                    "default": {"label": "Active", "color": "default"},
                }
            },
        },
        "admin_booking_status_map": {
            "key": "admin_booking_status_map",
            "category": "admin_experience",
            "label": "Admin Booking Status Map",
            "description": "Status labels, chip colors, icons and filter visibility in admin bookings page.",
            "visibility": "admin",
            "is_active": True,
            "is_system": True,
            "value": {
                "map": {
                    "requested": {"label": "Requested", "color": "info", "icon": "hourglass", "show_in_filter": True},
                    "pending": {"label": "Pending", "color": "warning", "icon": "hourglass", "show_in_filter": True},
                    "confirmed": {"label": "Confirmed", "color": "success", "icon": "check", "show_in_filter": True},
                    "in_progress": {"label": "In Progress", "color": "info", "icon": "progress", "show_in_filter": True},
                    "in-progress": {"label": "In Progress", "color": "info", "icon": "progress", "show_in_filter": True},
                    "completed": {"label": "Completed", "color": "primary", "icon": "check", "show_in_filter": True},
                    "cancelled": {"label": "Cancelled", "color": "error", "icon": "cancel", "show_in_filter": True},
                }
            },
        },
        "admin_coupon_tabs": {
            "key": "admin_coupon_tabs",
            "category": "admin_experience",
            "label": "Admin Coupon Tabs",
            "description": "Tab labels and filter keys used in coupon-management page.",
            "visibility": "admin",
            "is_active": True,
            "is_system": True,
            "value": {
                "tabs": [
                    {"key": "active", "label": "Active Coupons", "is_active": True},
                    {"key": "inactive", "label": "Inactive", "is_active": True},
                    {"key": "first_booking", "label": "First Booking Only", "is_active": True},
                    {"key": "all", "label": "All Coupons", "is_active": True},
                ]
            },
        },
        "admin_coupon_discount_type_map": {
            "key": "admin_coupon_discount_type_map",
            "category": "admin_experience",
            "label": "Admin Coupon Discount Type Map",
            "description": "Display labels for coupon discount type chips.",
            "visibility": "admin",
            "is_active": True,
            "is_system": True,
            "value": {
                "map": {
                    "percentage": {"label": "Percentage", "color": "default"},
                    "fixed": {"label": "Fixed Amount", "color": "default"},
                }
            },
        },
        "admin_coupon_status_map": {
            "key": "admin_coupon_status_map",
            "category": "admin_experience",
            "label": "Admin Coupon Status Map",
            "description": "Status labels and chip colors for coupon-management page.",
            "visibility": "admin",
            "is_active": True,
            "is_system": True,
            "value": {
                "map": {
                    "active": {"label": "Active", "color": "success"},
                    "inactive": {"label": "Inactive", "color": "default"},
                }
            },
        },
        "admin_dispute_status_map": {
            "key": "admin_dispute_status_map",
            "category": "admin_experience",
            "label": "Admin Dispute Status Map",
            "description": "Status labels and chip colors for dispute-management UI.",
            "visibility": "admin",
            "is_active": True,
            "is_system": True,
            "value": {
                "map": {
                    "open": {"color": "default", "label": "Open"},
                    "under_review": {"color": "info", "label": "Under Review"},
                    "evidence_requested": {"color": "warning", "label": "Evidence Requested"},
                    "pending_response": {"color": "warning", "label": "Pending Response"},
                    "mediation": {"color": "warning", "label": "Mediation"},
                    "resolved_refund": {"color": "success", "label": "Resolved (Refund)"},
                    "resolved_no_refund": {"color": "success", "label": "Resolved (No Refund)"},
                    "resolved_partial_refund": {"color": "success", "label": "Resolved (Partial)"},
                    "escalated": {"color": "error", "label": "Escalated"},
                    "closed": {"color": "default", "label": "Closed"},
                }
            },
        },
        "admin_dispute_category_map": {
            "key": "admin_dispute_category_map",
            "category": "admin_experience",
            "label": "Admin Dispute Category Map",
            "description": "Category labels and chip colors for dispute-management UI.",
            "visibility": "admin",
            "is_active": True,
            "is_system": True,
            "value": {
                "map": {
                    "poor_service_quality": {"color": "primary", "label": "Service Quality"},
                    "service_not_rendered": {"color": "secondary", "label": "Not Rendered"},
                    "incomplete_service": {"color": "secondary", "label": "Incomplete"},
                    "payment_issue": {"color": "secondary", "label": "Payment"},
                    "pricing_issue": {"color": "secondary", "label": "Pricing"},
                    "late_arrival": {"color": "warning", "label": "Late Arrival"},
                    "no_show_acharya": {"color": "error", "label": "No Show (Acharya)"},
                    "no_show_grihasta": {"color": "error", "label": "No Show (Grihasta)"},
                    "rude_behavior": {"color": "error", "label": "Harassment"},
                    "offline_payment_request": {"color": "warning", "label": "Offline Payment"},
                    "policy_violation": {"color": "error", "label": "Policy Violation"},
                    "other": {"color": "default", "label": "Other"},
                    "service_quality": {"color": "primary", "label": "Service Quality"},
                    "payment": {"color": "secondary", "label": "Payment"},
                    "cancellation": {"color": "warning", "label": "Cancellation"},
                    "harassment": {"color": "error", "label": "Harassment"},
                }
            },
        },
        "admin_fraud_status_map": {
            "key": "admin_fraud_status_map",
            "category": "admin_experience",
            "label": "Admin Fraud Status Map",
            "description": "Status labels and chip colors for fraud-alerts UI.",
            "visibility": "admin",
            "is_active": True,
            "is_system": True,
            "value": {
                "map": {
                    "pending": {"color": "warning", "label": "Pending Review"},
                    "investigating": {"color": "info", "label": "Investigating"},
                    "confirmed_fraud": {"color": "error", "label": "Confirmed Fraud"},
                    "false_positive": {"color": "success", "label": "False Positive"},
                    "resolved": {"color": "default", "label": "Resolved"},
                }
            },
        },
    }

    @classmethod
    def _collection(cls, db: AsyncIOMotorDatabase):
        return db[cls.COLLECTION_NAME]

    @classmethod
    def _normalize_key(cls, key: str) -> str:
        return str(key or "").strip().lower()

    @classmethod
    def _serialize_value(cls, value: Any) -> Any:
        if isinstance(value, ObjectId):
            return str(value)
        if isinstance(value, dict):
            return {k: cls._serialize_value(v) for k, v in value.items()}
        if isinstance(value, list):
            return [cls._serialize_value(item) for item in value]
        return value

    @classmethod
    def _serialize_doc(cls, doc: Dict[str, Any]) -> Dict[str, Any]:
        serialized = cls._serialize_value(deepcopy(doc))
        if isinstance(serialized, dict) and "_id" in serialized:
            serialized["_id"] = str(serialized["_id"])
            serialized.setdefault("id", serialized["_id"])
        return serialized

    @classmethod
    def _with_runtime_metadata(
        cls,
        config: Dict[str, Any],
        *,
        source: str,
        has_override: bool,
    ) -> Dict[str, Any]:
        enriched = cls._serialize_doc(config)
        enriched["source"] = source
        enriched["has_override"] = has_override
        return enriched

    @classmethod
    async def list_configs(
        cls,
        db: AsyncIOMotorDatabase,
        *,
        visibility: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        docs = await cls._collection(db).find({}).to_list(length=500)
        override_map = {cls._normalize_key(doc.get("key")): doc for doc in docs}
        configs: List[Dict[str, Any]] = []

        for key, default_config in cls.DEFAULT_CONFIGS.items():
            override = override_map.pop(key, None)
            merged = deepcopy(override) if override else deepcopy(default_config)
            configs.append(
                cls._with_runtime_metadata(
                    merged,
                    source="database" if override else "default",
                    has_override=override is not None,
                )
            )

        for extra in override_map.values():
            configs.append(
                cls._with_runtime_metadata(
                    extra,
                    source="database",
                    has_override=True,
                )
            )

        if visibility:
            allowed = {visibility, "both"}
            configs = [cfg for cfg in configs if cfg.get("visibility") in allowed]

        return sorted(configs, key=lambda item: (str(item.get("category", "")), str(item.get("label", item.get("key", "")))))

    @classmethod
    async def get_config(cls, db: AsyncIOMotorDatabase, key: str) -> Optional[Dict[str, Any]]:
        normalized_key = cls._normalize_key(key)
        stored = await cls._collection(db).find_one({"key": normalized_key})
        if stored:
            return cls._with_runtime_metadata(stored, source="database", has_override=True)
        default_config = cls.DEFAULT_CONFIGS.get(normalized_key)
        if default_config:
            return cls._with_runtime_metadata(default_config, source="default", has_override=False)
        return None

    @classmethod
    async def get_active_value(
        cls,
        db: AsyncIOMotorDatabase,
        key: str,
        *,
        fallback: Optional[Any] = None,
    ) -> Any:
        config = await cls.get_config(db, key)
        if not config or not config.get("is_active", True):
            return deepcopy(fallback)
        return deepcopy(config.get("value", fallback))

    @classmethod
    async def upsert_config(
        cls,
        db: AsyncIOMotorDatabase,
        key: str,
        payload: Dict[str, Any],
        *,
        admin_id: str,
    ) -> Dict[str, Any]:
        normalized_key = cls._normalize_key(key)
        now = datetime.now(timezone.utc)
        existing = await cls._collection(db).find_one({"key": normalized_key})
        default_config = deepcopy(cls.DEFAULT_CONFIGS.get(normalized_key))

        base = default_config or {}
        document = {
            "key": normalized_key,
            "category": payload.get("category", existing.get("category") if existing else base.get("category", "custom")),
            "label": payload.get("label", existing.get("label") if existing else base.get("label", normalized_key.replace("_", " ").title())),
            "description": payload.get("description", existing.get("description") if existing else base.get("description", "")),
            "visibility": payload.get("visibility", existing.get("visibility") if existing else base.get("visibility", "admin")),
            "is_active": payload.get("is_active", existing.get("is_active") if existing else base.get("is_active", True)),
            "is_system": bool(default_config),
            "value": payload.get("value", existing.get("value") if existing else base.get("value", {})),
            "updated_at": now,
            "updated_by": admin_id,
        }

        if existing:
            await cls._collection(db).update_one({"_id": existing["_id"]}, {"$set": document})
            saved = await cls._collection(db).find_one({"_id": existing["_id"]})
            return cls._with_runtime_metadata(saved, source="database", has_override=True)

        document["created_at"] = now
        document["created_by"] = admin_id
        result = await cls._collection(db).insert_one(document)
        saved = await cls._collection(db).find_one({"_id": result.inserted_id})
        return cls._with_runtime_metadata(saved, source="database", has_override=True)

    @classmethod
    async def delete_or_reset_config(cls, db: AsyncIOMotorDatabase, key: str) -> Dict[str, Any]:
        normalized_key = cls._normalize_key(key)
        existing = await cls._collection(db).find_one({"key": normalized_key})
        if not existing:
            return {"action": "noop", "key": normalized_key}

        await cls._collection(db).delete_one({"_id": existing["_id"]})
        if normalized_key in cls.DEFAULT_CONFIGS:
            return {"action": "reset_to_default", "key": normalized_key}
        return {"action": "deleted", "key": normalized_key}

    @classmethod
    async def get_bootstrap_payload(cls, db: AsyncIOMotorDatabase) -> Dict[str, Any]:
        configs = await cls.list_configs(db, visibility="user")
        active_configs = [config for config in configs if config.get("is_active", True)]
        return {
            "configs": active_configs,
            "config_map": {config["key"]: config.get("value") for config in active_configs},
        }
