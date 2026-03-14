"""Feature flags API tests."""
from datetime import datetime, timezone

import pytest
from bson import ObjectId


class TestFeatureFlagsApi:
    """Validate tenant/cohort feature-flag evaluation and admin upsert."""

    @pytest.mark.asyncio
    async def test_evaluate_my_feature_flags_matches_cohorts(self, client, test_db):
        from app.core.security import get_current_user
        from app.db.connection import get_db
        from app.main import app as fastapi_app

        user_oid = ObjectId()
        user_id = str(user_oid)

        await test_db.users.insert_one(
            {
                "_id": user_oid,
                "email": "grihasta@flags.test",
                "role": "grihasta",
                "preferred_language": "hi",
                "created_at": datetime.now(timezone.utc),
            }
        )
        await test_db.grihasta_profiles.insert_one(
            {
                "_id": ObjectId(),
                "user_id": user_oid,
                "name": "Test Grihasta",
                "parampara": "smartha",
                "location": {"city": "Mumbai", "state": "Maharashtra", "country": "India"},
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        )

        await test_db.feature_flags.insert_one(
            {
                "key": "new_checkout",
                "enabled": True,
                "is_active": True,
                "rollout_percentage": 100,
                "cohorts": {
                    "roles": ["grihasta"],
                    "languages": ["hi"],
                    "cities": ["mumbai"],
                    "regions": ["maharashtra"],
                    "tenants": ["tenant-mumbai"],
                },
                "updated_at": datetime.now(timezone.utc),
            }
        )

        fastapi_app.dependency_overrides[get_current_user] = lambda: {
            "id": user_id,
            "role": "grihasta",
            "email": "grihasta@flags.test",
        }
        fastapi_app.dependency_overrides[get_db] = lambda: test_db

        try:
            response = await client.get(
                "/api/v1/feature-flags/me",
                params=[("keys", "new_checkout")],
                headers={"X-Tenant-ID": "tenant-mumbai"},
            )
            assert response.status_code == 200
            body = response.json()
            assert body.get("success") is True
            flag = body.get("data", {}).get("flags", {}).get("new_checkout", {})
            assert flag.get("enabled") is True
            assert flag.get("reason") == "matched"
        finally:
            fastapi_app.dependency_overrides = {}

    @pytest.mark.asyncio
    async def test_evaluate_rollout_zero_returns_disabled(self, client, test_db):
        from app.core.security import get_current_user
        from app.db.connection import get_db
        from app.main import app as fastapi_app

        user_oid = ObjectId()
        await test_db.users.insert_one(
            {
                "_id": user_oid,
                "email": "rollout@flags.test",
                "role": "grihasta",
                "preferred_language": "en",
                "created_at": datetime.now(timezone.utc),
            }
        )

        await test_db.feature_flags.insert_one(
            {
                "key": "future_rollout",
                "enabled": True,
                "is_active": True,
                "rollout_percentage": 0,
                "cohorts": {},
                "updated_at": datetime.now(timezone.utc),
            }
        )

        fastapi_app.dependency_overrides[get_current_user] = lambda: {
            "id": str(user_oid),
            "role": "grihasta",
            "email": "rollout@flags.test",
        }
        fastapi_app.dependency_overrides[get_db] = lambda: test_db

        try:
            response = await client.get("/api/v1/feature-flags/me", params=[("keys", "future_rollout")])
            assert response.status_code == 200
            flag = response.json().get("data", {}).get("flags", {}).get("future_rollout", {})
            assert flag.get("enabled") is False
            assert flag.get("reason") == "rollout_excluded"
        finally:
            fastapi_app.dependency_overrides = {}

    @pytest.mark.asyncio
    async def test_admin_upsert_feature_flag(self, client, test_db):
        from app.core.security import get_current_admin
        from app.db.connection import get_db
        from app.main import app as fastapi_app

        admin_oid = ObjectId()
        fastapi_app.dependency_overrides[get_current_admin] = lambda: {
            "id": str(admin_oid),
            "role": "admin",
            "email": "admin@flags.test",
        }
        fastapi_app.dependency_overrides[get_db] = lambda: test_db

        try:
            response = await client.put(
                "/api/v1/feature-flags/admin/booking_sla_banner",
                json={
                    "enabled": True,
                    "is_active": True,
                    "variant": "v1",
                    "rollout_percentage": 100,
                    "description": "Enable SLA banner for Mumbai cohort",
                    "cohorts": {
                        "roles": ["grihasta"],
                        "cities": ["Mumbai"],
                        "regions": ["Maharashtra"],
                        "languages": ["hi"],
                        "tenants": ["tenant-mumbai"],
                    },
                },
            )
            assert response.status_code == 200
            body = response.json()
            assert body.get("success") is True
            assert body.get("data", {}).get("key") == "booking_sla_banner"

            saved = await test_db.feature_flags.find_one({"key": "booking_sla_banner"})
            assert saved is not None
            assert saved.get("enabled") is True
        finally:
            fastapi_app.dependency_overrides = {}
