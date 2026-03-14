"""Phase 3 E2E hardening tests for payment + dispute flows."""

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from bson import ObjectId


@pytest.mark.asyncio
async def test_e2e_cancel_booking_succeeds_even_if_refund_gateway_fails(client, test_db):
    """
    Critical path: paid booking cancellation should succeed even when refund call fails.
    """
    from app.core.security import get_current_user
    from app.db.connection import get_db
    from app.main import app as fastapi_app

    booking_id = ObjectId()
    grihasta_id = ObjectId()
    acharya_id = ObjectId()

    await test_db.bookings.insert_one(
        {
            "_id": booking_id,
            "grihasta_id": grihasta_id,
            "acharya_id": acharya_id,
            "status": "confirmed",
            "payment_status": "completed",
            "razorpay_payment_id": "pay_test_failure_path",
            "total_amount": 1500,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
    )

    fastapi_app.dependency_overrides[get_db] = lambda: test_db
    fastapi_app.dependency_overrides[get_current_user] = lambda: {
        "id": str(grihasta_id),
        "role": "grihasta",
        "email": "grihasta@test.com",
    }

    try:
        with patch(
            "app.services.payment_service.RazorpayService.initiate_refund",
            side_effect=RuntimeError("gateway timeout"),
        ):
            response = await client.put(f"/api/v1/bookings/{booking_id}/cancel")

        assert response.status_code == 200
        payload = response.json()
        assert payload.get("success") is True

        booking = await test_db.bookings.find_one({"_id": booking_id})
        assert booking["status"] == "cancelled"
    finally:
        fastapi_app.dependency_overrides = {}


@pytest.mark.asyncio
async def test_e2e_dispute_resolution_survives_refund_and_notify_failures(client, test_db):
    """
    Admin dispute resolution endpoint must still succeed when downstream side-effects fail.
    """
    from app.api.v1 import trust as trust_api
    from app.core.security import get_current_admin
    from app.db.connection import get_db
    from app.main import app as fastapi_app

    dispute_id = ObjectId()
    booking_id = ObjectId()

    await test_db.bookings.insert_one(
        {
            "_id": booking_id,
            "total_amount": 2000,
            "razorpay_payment_id": "pay_dispute_123",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
    )
    await test_db.dispute_resolutions.insert_one(
        {
            "_id": dispute_id,
            "booking_id": str(booking_id),
            "filed_by_id": str(ObjectId()),
            "respondent_id": str(ObjectId()),
            "status": "mediation",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
    )

    # trust.resolve_dispute expects attribute access (current_user.id)
    admin_user = SimpleNamespace(id=str(ObjectId()), role="admin", email="admin@test.com")

    fastapi_app.dependency_overrides[get_db] = lambda: test_db
    fastapi_app.dependency_overrides[get_current_admin] = lambda: admin_user

    try:
        with patch.object(
            trust_api,
            "_trigger_dispute_refund",
            new=AsyncMock(side_effect=RuntimeError("refund failure")),
        ), patch.object(
            trust_api,
            "_notify_dispute_parties",
            new=AsyncMock(side_effect=RuntimeError("notify failure")),
        ), patch(
            "app.services.audit_service.AuditService.log_action",
            new=AsyncMock(return_value=None),
        ):
            response = await client.post(
                f"/api/v1/trust/admin/disputes/{dispute_id}/resolve",
                json={
                    "resolution": "resolved_partial_refund",
                    "refund_percentage": 50,
                    "admin_notes": "Partial refund approved",
                },
            )

        assert response.status_code == 200
        payload = response.json()
        assert payload.get("dispute_id") == str(dispute_id)
        assert payload.get("resolution") == "resolved_partial_refund"

        saved = await test_db.dispute_resolutions.find_one({"_id": dispute_id})
        assert saved["status"] == "resolved_partial_refund"
        assert saved.get("compensation_amount") == 50
    finally:
        fastapi_app.dependency_overrides = {}
