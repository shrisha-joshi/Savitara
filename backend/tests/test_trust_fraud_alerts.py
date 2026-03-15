"""Admin fraud-alert API integration tests."""
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from bson import ObjectId


class TestTrustFraudAlertsApi:
    """Validate fraud-alert list/stats/detail/action endpoints for admin users."""

    @pytest.mark.asyncio
    async def test_admin_can_list_and_review_fraud_alert(self, client, test_db):
        from app.core.security import get_current_admin
        from app.db.connection import get_db
        from app.main import app as fastapi_app

        admin_oid = ObjectId()
        user_oid = ObjectId()
        alert_oid = ObjectId()

        await test_db.users.insert_one(
            {
                "_id": user_oid,
                "full_name": "Risky User",
                "email": "risky.user@test.com",
                "role": "grihasta",
                "created_at": datetime.now(timezone.utc),
            }
        )
        await test_db.offline_transaction_detections.insert_one(
            {
                "_id": alert_oid,
                "user_id": str(user_oid),
                "booking_id": str(ObjectId()),
                "detection_signals": {
                    "no_repeat_bookings": True,
                    "contact_sharing_detected": True,
                },
                "ml_confidence_score": 80,
                "investigation_status": "pending",
                "detected_at": datetime.now(timezone.utc),
            }
        )

        fastapi_app.dependency_overrides[get_current_admin] = lambda: SimpleNamespace(
            id=str(admin_oid),
            role="admin",
            email="admin@risk.test",
        )
        fastapi_app.dependency_overrides[get_db] = lambda: test_db

        try:
            list_response = await client.get("/api/v1/trust/admin/fraud-alerts", params={"status": "pending"})
            assert list_response.status_code == 200
            list_payload = list_response.json()
            assert isinstance(list_payload, list)
            assert len(list_payload) == 1
            assert list_payload[0].get("_id") == str(alert_oid)
            assert list_payload[0].get("fraud_confidence") == 80
            assert list_payload[0].get("investigation_status") == "pending"

            stats_response = await client.get("/api/v1/trust/admin/fraud-alerts/stats")
            assert stats_response.status_code == 200
            stats_payload = stats_response.json()
            assert stats_payload.get("total_alerts") == 1
            assert stats_payload.get("pending") == 1

            detail_response = await client.get(f"/api/v1/trust/admin/fraud-alerts/{alert_oid}")
            assert detail_response.status_code == 200
            detail_payload = detail_response.json()
            assert detail_payload.get("_id") == str(alert_oid)
            assert detail_payload.get("user_name") == "Risky User"

            action_response = await client.post(
                f"/api/v1/trust/admin/fraud-alerts/{alert_oid}/action",
                json={"action": "investigating", "notes": "Escalated for manual review"},
            )
            assert action_response.status_code == 200
            action_payload = action_response.json()
            assert action_payload.get("alert", {}).get("investigation_status") == "investigating"

            saved = await test_db.offline_transaction_detections.find_one({"_id": alert_oid})
            assert saved is not None
            assert saved.get("investigation_status") == "investigating"
        finally:
            fastapi_app.dependency_overrides = {}
