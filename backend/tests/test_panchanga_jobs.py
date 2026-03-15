"""Tests for async Panchanga precompute job queue endpoints."""
from datetime import datetime, timezone

import pytest


class TestPanchangaAsyncJobs:
    @pytest.mark.asyncio
    async def test_queue_yearly_precompute_job(self, client, test_db):
        from app.core.security import get_current_admin
        from app.db.connection import get_db
        from app.main import app as fastapi_app

        fastapi_app.dependency_overrides[get_current_admin] = lambda: {
            "id": "admin-1",
            "role": "admin",
        }
        fastapi_app.dependency_overrides[get_db] = lambda: test_db

        try:
            response = await client.post(
                "/api/v1/panchanga/precompute/yearly",
                json={
                    "year": 2027,
                    "latitude": 19.076,
                    "longitude": 72.8777,
                    "panchanga_type": "lunar",
                },
            )
            assert response.status_code == 202
            body = response.json()
            assert body.get("success") is True
            job_id = body.get("data", {}).get("job_id")
            assert isinstance(job_id, str) and len(job_id) > 10

            job = await test_db.async_jobs.find_one({"_id": {"$exists": True}})
            assert job is not None
            assert job.get("kind") == "panchanga.yearly_precompute"
            assert job.get("status") == "pending"
        finally:
            fastapi_app.dependency_overrides = {}

    @pytest.mark.asyncio
    async def test_get_precompute_job_status_owner_access(self, client, test_db):
        from bson import ObjectId
        from app.core.security import get_current_user
        from app.db.connection import get_db
        from app.main import app as fastapi_app

        job_id = ObjectId()
        await test_db.async_jobs.insert_one(
            {
                "_id": job_id,
                "kind": "panchanga.yearly_precompute",
                "status": "completed",
                "payload": {"year": 2027},
                "created_by": "user-123",
                "result": {"computed_days": 365},
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "next_attempt_at": datetime.now(timezone.utc),
                "attempts": 1,
                "max_attempts": 5,
            }
        )

        fastapi_app.dependency_overrides[get_current_user] = lambda: {
            "id": "user-123",
            "role": "grihasta",
        }
        fastapi_app.dependency_overrides[get_db] = lambda: test_db

        try:
            response = await client.get(f"/api/v1/panchanga/precompute/jobs/{job_id}")
            assert response.status_code == 200
            body = response.json()
            assert body.get("success") is True
            assert body.get("data", {}).get("_id") == str(job_id)
            assert body.get("data", {}).get("status") == "completed"
        finally:
            fastapi_app.dependency_overrides = {}
