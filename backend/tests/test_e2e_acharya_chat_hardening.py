"""
Strict E2E hardening tests for Acharya booking lifecycle and chat isolation.
"""

from datetime import datetime, timezone

import pytest
from bson import ObjectId


@pytest.mark.asyncio
async def test_e2e_acharya_request_to_completion_flow(client, test_db):
    """
    requested -> confirmed -> create payment order -> start -> attendance confirm -> completed
    """
    from app.main import app as fastapi_app
    from app.db.connection import get_db
    from app.core.security import (
        get_current_user as gcu,
        get_current_grihasta,
        get_current_acharya,
    )

    grihasta_oid = ObjectId()
    acharya_user_oid = ObjectId()
    acharya_profile_oid = ObjectId()
    booking_oid = ObjectId()

    await test_db.users.insert_many(
        [
            {"_id": grihasta_oid, "role": "grihasta", "email": "g@test.com"},
            {"_id": acharya_user_oid, "role": "acharya", "email": "a@test.com"},
        ]
    )
    await test_db.acharya_profiles.insert_one(
        {
            "_id": acharya_profile_oid,
            "user_id": acharya_user_oid,
            "name": "Pandit Flow",
        }
    )
    await test_db.bookings.insert_one(
        {
            "_id": booking_oid,
            "grihasta_id": grihasta_oid,
            "acharya_id": acharya_profile_oid,
            "status": "requested",
            "booking_mode": "request",
            "payment_status": "not_required",
            "total_amount": 0,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
    )

    grihasta_user = {"id": str(grihasta_oid), "role": "grihasta", "email": "g@test.com"}
    acharya_user = {"id": str(acharya_user_oid), "role": "acharya", "email": "a@test.com"}

    fastapi_app.dependency_overrides[get_db] = lambda: test_db

    try:
        # 1) Acharya confirms requested booking with amount
        fastapi_app.dependency_overrides[gcu] = lambda: acharya_user
        resp_confirm = await client.put(
            f"/api/v1/bookings/{booking_oid}/status",
            json={"status": "confirmed", "amount": 1500.0},
        )
        assert resp_confirm.status_code == 200
        assert resp_confirm.json()["success"] is True

        updated = await test_db.bookings.find_one({"_id": booking_oid})
        assert updated["status"] == "confirmed"
        assert updated["payment_status"] == "pending"
        assert updated.get("start_otp")

        # 2) Grihasta creates payment order (request-mode flow)
        fastapi_app.dependency_overrides[get_current_grihasta] = lambda: grihasta_user
        resp_order = await client.post(f"/api/v1/bookings/{booking_oid}/create-payment-order")
        assert resp_order.status_code == 200
        order_body = resp_order.json()
        assert order_body["success"] is True
        assert order_body["data"].get("razorpay_order_id")

        # 3) Acharya starts booking using generated OTP
        updated = await test_db.bookings.find_one({"_id": booking_oid})
        start_otp = updated.get("start_otp")
        assert start_otp

        fastapi_app.dependency_overrides[get_current_acharya] = lambda: acharya_user
        resp_start = await client.post(
            f"/api/v1/bookings/{booking_oid}/start",
            json={"otp": start_otp},
        )
        assert resp_start.status_code == 200
        assert resp_start.json()["success"] is True

        # 4) Attendance confirmations by both users => completed
        fastapi_app.dependency_overrides[gcu] = lambda: grihasta_user
        resp_att_g = await client.post(
            f"/api/v1/bookings/{booking_oid}/attendance/confirm",
            json={"confirmed": True},
        )
        assert resp_att_g.status_code == 200

        fastapi_app.dependency_overrides[gcu] = lambda: acharya_user
        resp_att_a = await client.post(
            f"/api/v1/bookings/{booking_oid}/attendance/confirm",
            json={"confirmed": True},
        )
        assert resp_att_a.status_code == 200

        final_doc = await test_db.bookings.find_one({"_id": booking_oid})
        assert final_doc["status"] == "completed"

    finally:
        fastapi_app.dependency_overrides = {}


@pytest.mark.asyncio
async def test_e2e_chat_conversation_isolation(client, test_db):
    """
    Ensure message fetch for a conversation returns only that conversation's messages,
    not global/shared data.
    """
    from app.main import app as fastapi_app
    from app.db.connection import get_db
    from app.core.security import get_current_user as gcu

    user_a = ObjectId()
    user_b = ObjectId()
    user_c = ObjectId()
    conv_ab = ObjectId()
    conv_ac = ObjectId()

    await test_db.users.insert_many(
        [
            {"_id": user_a, "role": "grihasta", "email": "a@test.com"},
            {"_id": user_b, "role": "acharya", "email": "b@test.com"},
            {"_id": user_c, "role": "acharya", "email": "c@test.com"},
        ]
    )

    await test_db.conversations.insert_many(
        [
            {
                "_id": conv_ab,
                "participants": [user_a, user_b],
                "is_open_chat": False,
                "last_message_at": datetime.now(timezone.utc),
            },
            {
                "_id": conv_ac,
                "participants": [user_a, user_c],
                "is_open_chat": False,
                "last_message_at": datetime.now(timezone.utc),
            },
        ]
    )

    await test_db.messages.insert_many(
        [
            {
                "_id": ObjectId(),
                "conversation_id": conv_ab,
                "sender_id": user_a,
                "receiver_id": user_b,
                "content": "AB-message-1",
                "read": False,
                "deleted": False,
                "created_at": datetime.now(timezone.utc),
            },
            {
                "_id": ObjectId(),
                "conversation_id": conv_ab,
                "sender_id": user_b,
                "receiver_id": user_a,
                "content": "AB-message-2",
                "read": False,
                "deleted": False,
                "created_at": datetime.now(timezone.utc),
            },
            {
                "_id": ObjectId(),
                "conversation_id": conv_ac,
                "sender_id": user_a,
                "receiver_id": user_c,
                "content": "AC-message-1",
                "read": False,
                "deleted": False,
                "created_at": datetime.now(timezone.utc),
            },
        ]
    )

    fastapi_app.dependency_overrides[get_db] = lambda: test_db
    fastapi_app.dependency_overrides[gcu] = lambda: {
        "id": str(user_a),
        "role": "grihasta",
        "email": "a@test.com",
    }

    try:
        resp = await client.get(f"/api/v1/chat/conversations/{conv_ab}/messages")
        assert resp.status_code == 200
        payload = resp.json()
        assert payload["success"] is True

        contents = [m.get("content") for m in payload["data"]["messages"]]
        assert "AB-message-1" in contents
        assert "AB-message-2" in contents
        assert "AC-message-1" not in contents

    finally:
        fastapi_app.dependency_overrides = {}
