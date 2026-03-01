"""
Booking API Tests
"""
import pytest
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from app.main import app

class TestBookingCreation:
    """Test booking creation"""
    
    @pytest.mark.asyncio
    async def test_create_booking_without_auth(self, client):
        """Test creating booking without authentication"""
        booking_data = {
            "acharya_id": "507f1f77bcf86cd799439011",
            "pooja_type": "Satyanarayan Puja",
            "date": "2026-02-15",
            "time": "10:00"
        }
        response = await client.post("/api/v1/bookings", json=booking_data)
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_create_booking_invalid_date(self, client):
        """Test creating booking with past date"""
        past_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        booking_data = {
            "acharya_id": "507f1f77bcf86cd799439011",
            "pooja_type": "Test Puja",
            "date": past_date,
            "time": "10:00"
        }
        response = await client.post("/api/v1/bookings", json=booking_data)
        assert response.status_code in [400, 401, 422]
    
    @pytest.mark.asyncio
    async def test_create_booking_invalid_acharya_id(self, client):
        """Test creating booking with invalid acharya ID"""
        booking_data = {
            "acharya_id": "invalid_id",
            "pooja_type": "Test Puja",
            "date": "2026-02-15",
            "time": "10:00"
        }
        response = await client.post("/api/v1/bookings", json=booking_data)
        assert response.status_code in [400, 401, 422]


class TestBookingRetrieval:
    """Test booking retrieval"""
    
    @pytest.mark.asyncio
    async def test_get_all_bookings_without_auth(self, client):
        """Test getting bookings without auth"""
        response = await client.get("/api/v1/bookings")
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_get_booking_by_id_without_auth(self, client):
        """Test getting specific booking without auth"""
        response = await client.get("/api/v1/bookings/507f1f77bcf86cd799439011")
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_get_booking_invalid_id(self, client):
        """Test getting booking with invalid ID"""
        response = await client.get("/api/v1/bookings/invalid_id")
        assert response.status_code in [400, 401, 422]


class TestBookingUpdates:
    """Test booking updates"""
    
    @pytest.mark.asyncio
    async def test_update_booking_status_without_auth(self, client):
        """Test updating booking status without auth"""
        response = await client.put(
            "/api/v1/bookings/507f1f77bcf86cd799439011/status",
            json={"status": "confirmed"}
        )
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_cancel_booking_without_auth(self, client):
        """Test canceling booking without auth"""
        response = await client.put("/api/v1/bookings/507f1f77bcf86cd799439011/cancel")
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_update_booking_invalid_status(self, client):
        """Test updating booking with invalid status"""
        response = await client.put(
            "/api/v1/bookings/507f1f77bcf86cd799439011/status",
            json={"status": "invalid_status"}
        )
        assert response.status_code in [400, 401, 422]


class TestAttendanceConfirmation:
    """Test two-factor attendance confirmation"""
    
    @pytest.mark.asyncio
    async def test_generate_otp_without_auth(self, client):
        """Test generating OTP without auth"""
        response = await client.post("/api/v1/bookings/507f1f77bcf86cd799439011/generate-otp")
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_verify_attendance_without_auth(self, client):
        """Test verifying attendance without auth"""
        response = await client.post(
            "/api/v1/bookings/507f1f77bcf86cd799439011/attendance/confirm",
            json={"otp": "1234"}
        )
        assert response.status_code == 401
    
    def test_verify_attendance_invalid_otp(self, client):
        """Test verifying attendance with invalid OTP"""
        # Without auth, the endpoint should reject the request before checking the OTP
        import asyncio
        loop = asyncio.get_event_loop()
        response = loop.run_until_complete(
            client.post(
                "/api/v1/bookings/507f1f77bcf86cd799439011/attendance/confirm",
                json={"otp": "0000"},
            )
        )
        assert response.status_code in [401, 400, 422]


def _no_objectid(obj, path="root"):
    """Recursively assert that *obj* contains no raw ObjectId values."""
    if isinstance(obj, dict):
        for key, val in obj.items():
            assert not isinstance(val, ObjectId), (
                f"ObjectId found at {path}.{key}: {val!r} — expected str"
            )
            _no_objectid(val, path=f"{path}.{key}")
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            _no_objectid(item, path=f"{path}[{i}]")


class TestBookingIdSerialization:
    """Unit tests for the recursive ObjectId serializer and the detail endpoint."""

    def test_serialize_document_flat_booking(self):
        """_serialize_document converts top-level ObjectId fields to strings."""
        from app.api.v1.bookings import _serialize_document

        oid_id = ObjectId()
        oid_grihasta = ObjectId()
        oid_acharya = ObjectId()
        oid_pooja = ObjectId()

        doc = {
            "_id": oid_id,
            "grihasta_id": oid_grihasta,
            "acharya_id": oid_acharya,
            "pooja_id": oid_pooja,
            "notes": "some text",
            "amount": 500,
        }
        _serialize_document(doc)

        assert doc["_id"] == str(oid_id)
        assert doc["id"] == str(oid_id), "top-level _id must also populate doc['id']"
        assert doc["grihasta_id"] == str(oid_grihasta)
        assert doc["acharya_id"] == str(oid_acharya)
        assert doc["pooja_id"] == str(oid_pooja)
        assert doc["notes"] == "some text"   # non-ObjectId untouched
        _no_objectid(doc)

    def test_serialize_document_nested_subdocuments(self):
        """_serialize_document converts ObjectIds inside joined sub-documents
        (pooja, acharya, grihasta_user, acharya_user)."""
        from app.api.v1.bookings import _serialize_document

        oid_booking = ObjectId()
        oid_pooja = ObjectId()
        oid_acharya_profile = ObjectId()
        oid_grihasta_user = ObjectId()
        oid_acharya_user = ObjectId()
        oid_acharya_user_id = ObjectId()

        doc = {
            "_id": oid_booking,
            "grihasta_id": ObjectId(),
            "acharya_id": ObjectId(),
            "pooja": {
                "_id": oid_pooja,
                "name": "Satyanarayan Puja",
                "nested_ref": ObjectId(),
            },
            "acharya": {
                "_id": oid_acharya_profile,
                "user_id": oid_acharya_user_id,
                "name": "Pandit Sharma",
            },
            "grihasta_user": {
                "_id": oid_grihasta_user,
                "full_name": "Ram Kumar",
            },
            "acharya_user": {
                "_id": oid_acharya_user,
                "full_name": "Pandit Sharma",
            },
        }
        _serialize_document(doc)

        # Top level
        assert doc["_id"] == str(oid_booking)
        assert doc["id"] == str(oid_booking)
        # Nested — pooja
        assert doc["pooja"]["_id"] == str(oid_pooja)
        assert doc["pooja"]["id"] == str(oid_pooja)
        assert isinstance(doc["pooja"]["nested_ref"], str)
        # Nested — acharya
        assert doc["acharya"]["_id"] == str(oid_acharya_profile)
        assert doc["acharya"]["user_id"] == str(oid_acharya_user_id)
        # Nested — grihasta_user / acharya_user
        assert doc["grihasta_user"]["_id"] == str(oid_grihasta_user)
        assert doc["acharya_user"]["_id"] == str(oid_acharya_user)
        # No raw ObjectIds left anywhere
        _no_objectid(doc)

    def test_serialize_document_list_of_bookings(self):
        """_serialize_document handles a list at the top level."""
        from app.api.v1.bookings import _serialize_document

        docs = [
            {"_id": ObjectId(), "grihasta_id": ObjectId()},
            {"_id": ObjectId(), "acharya_id": ObjectId(), "sub": {"ref": ObjectId()}},
        ]
        result = _serialize_document(docs)
        _no_objectid(result)
        for item in result:
            assert isinstance(item["_id"], str)

    def test_serialize_document_idempotent_on_strings(self):
        """_serialize_document does not mutate already-serialised documents."""
        from app.api.v1.bookings import _serialize_document

        oid_str = str(ObjectId())
        doc = {"_id": oid_str, "grihasta_id": oid_str, "notes": "hello"}
        _serialize_document(doc)
        # Strings must remain strings
        assert doc["_id"] == oid_str
        assert doc["grihasta_id"] == oid_str

    @pytest.mark.asyncio
    async def test_get_booking_details_requires_auth(self, client):
        """GET /api/v1/bookings/{id} must require authentication."""
        response = await client.get("/api/v1/bookings/507f1f77bcf86cd799439011")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_booking_details_invalid_id_format(self, client):
        """GET /api/v1/bookings/{id} with non-ObjectId ID must return 400/422."""
        response = await client.get("/api/v1/bookings/not_a_valid_objectid")
        assert response.status_code in [400, 401, 422]


# ---------------------------------------------------------------------------
# TestBookingStateMachine
# ---------------------------------------------------------------------------

class TestBookingStateMachine:
    """Unit tests for the central booking state-machine logic."""

    def test_booking_state_machine_invalid_transition(self):
        """Attempting pending_payment → in_progress must raise InvalidInputError."""
        from app.services.booking_state_machine import validate_transition
        from app.core.exceptions import InvalidInputError

        with pytest.raises(InvalidInputError) as exc_info:
            validate_transition("pending_payment", "in_progress", "acharya")
        error_msg = str(exc_info.value).lower()
        assert any(kw in error_msg for kw in ("confirmed", "paid", "cannot", "invalid")), (
            f"Expected meaningful error message, got: {exc_info.value!r}"
        )

    def test_booking_state_machine_valid_flow(self):
        """All canonical booking transitions must pass without raising."""
        from app.services.booking_state_machine import validate_transition

        # acharya accepts a requested booking
        validate_transition("requested", "confirmed", "acharya")
        # acharya starts the session
        validate_transition("confirmed", "in_progress", "acharya")
        # system marks completed after both attendance confirmations
        validate_transition("in_progress", "completed", "system")
        # grihasta pays → booking confirmed
        validate_transition("pending_payment", "confirmed", "grihasta")


# ---------------------------------------------------------------------------
# TestPaymentIdempotency
# ---------------------------------------------------------------------------

class TestPaymentIdempotency:
    """POST /api/v1/bookings/{id}/payment/verify — idempotency guard."""

    @pytest.mark.asyncio
    async def test_verify_payment_idempotency(self, client, test_db):
        """Calling verify_payment on an already-confirmed booking returns 200 without re-processing."""
        from app.core.security import get_current_grihasta
        from app.db.connection import get_db
        from app.main import app as fastapi_app

        grihasta_oid = ObjectId()
        grihasta_id = str(grihasta_oid)
        grihasta_user = {
            "id": grihasta_id,
            "_id": grihasta_oid,
            "role": "grihasta",
            "email": "grihasta@example.com",
        }

        # Booking already in confirmed + payment completed state
        booking_oid = ObjectId()
        await test_db.bookings.insert_one({
            "_id": booking_oid,
            "grihasta_id": grihasta_oid,
            "acharya_id": ObjectId(),
            "status": "confirmed",
            "payment_status": "completed",
            "razorpay_order_id": "order_test_123",
            "razorpay_payment_id": "pay_test_123",
            "start_otp": "987654",
            "total_amount": 1500.0,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })
        booking_id = str(booking_oid)

        fastapi_app.dependency_overrides[get_current_grihasta] = lambda: grihasta_user
        fastapi_app.dependency_overrides[get_db] = lambda: test_db

        try:
            response = await client.post(
                f"/api/v1/bookings/{booking_id}/payment/verify",
                json={
                    "razorpay_payment_id": "pay_test_123",
                    "razorpay_signature": "sig_duplicate",
                },
            )
            assert response.status_code == 200
            body = response.json()
            assert body["success"] is True
            msg = body.get("message", "").lower()
            data_status = body.get("data", {}).get("status", "")
            assert "already" in msg or data_status == "confirmed", (
                f"Expected idempotency guard message or confirmed status, got: {body!r}"
            )
        finally:
            fastapi_app.dependency_overrides = {}


# ---------------------------------------------------------------------------
# TestBookingDetailsEndpoint
# ---------------------------------------------------------------------------

class TestBookingDetailsEndpoint:
    """GET /api/v1/bookings/{id} — ObjectId serialization at the HTTP layer."""

    @pytest.mark.asyncio
    async def test_get_booking_details_serializes_ids(self, client, test_db):
        """All ObjectId fields in the booking detail response must be JSON strings."""
        from app.core.security import get_current_user as gcu
        from app.db.connection import get_db
        from app.main import app as fastapi_app

        grihasta_oid = ObjectId()
        grihasta_id = str(grihasta_oid)
        user = {
            "id": grihasta_id,
            "_id": grihasta_oid,
            "role": "grihasta",
            "email": "test@example.com",
        }

        booking_oid = ObjectId()
        await test_db.bookings.insert_one({
            "_id": booking_oid,
            "grihasta_id": grihasta_oid,
            "acharya_id": ObjectId(),
            "pooja_id": ObjectId(),
            "status": "requested",
            "total_amount": 500.0,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })
        booking_id = str(booking_oid)

        fastapi_app.dependency_overrides[gcu] = lambda: user
        fastapi_app.dependency_overrides[get_db] = lambda: test_db

        try:
            response = await client.get(f"/api/v1/bookings/{booking_id}")
            # Must not 500 — either found (200) or not found (404) after pipeline
            assert response.status_code in [200, 404]
            if response.status_code == 200:
                raw_json = response.text
                assert "ObjectId" not in raw_json, (
                    "Raw ObjectId must not appear in JSON response"
                )
                booking_data = response.json().get("data", {}).get("booking", {})
                for key, val in booking_data.items():
                    if "id" in key.lower() and val is not None:
                        assert isinstance(val, str), (
                            f"Field {key!r} must be a string in the response, got {type(val)}"
                        )
        finally:
            fastapi_app.dependency_overrides = {}


# ---------------------------------------------------------------------------
# TestPriceEstimateEndpoint
# ---------------------------------------------------------------------------

class TestPriceEstimateEndpoint:
    """GET /api/v1/bookings/price-estimate — weekend surcharge."""

    @pytest.mark.asyncio
    async def test_price_estimate_endpoint(self, client, test_db):
        """Price estimate for a Saturday booking must include a weekend surcharge (1.5×)."""
        from app.core.security import get_current_user as gcu
        from app.db.connection import get_db
        from app.main import app as fastapi_app

        user_oid = ObjectId()
        user = {
            "id": str(user_oid),
            "_id": user_oid,
            "role": "grihasta",
            "email": "test@example.com",
        }

        acharya_oid = ObjectId()
        await test_db.acharya_profiles.insert_one({
            "_id": acharya_oid,
            "name": "Pandit Test",
            "hourly_rate": 500.0,
            "user_id": ObjectId(),
        })
        acharya_id = str(acharya_oid)

        # 2026-03-07 is a Saturday — weekend surcharge must apply
        saturday_dt = "2026-03-07T10:00:00"

        fastapi_app.dependency_overrides[gcu] = lambda: user
        fastapi_app.dependency_overrides[get_db] = lambda: test_db

        try:
            response = await client.get(
                "/api/v1/bookings/price-estimate",
                params={
                    "acharya_id": acharya_id,
                    "date_time": saturday_dt,
                    "duration_hours": 2,
                    "booking_type": "only",
                },
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            estimate = data["data"]
            weekend_surcharge = estimate.get("weekend_surcharge", 0)
            assert weekend_surcharge > 0, (
                f"Expected weekend_surcharge > 0 for a Saturday booking, got {weekend_surcharge}"
            )
        finally:
            fastapi_app.dependency_overrides = {}


# ---------------------------------------------------------------------------
# TestBookingAutoExpire
# ---------------------------------------------------------------------------

class TestBookingAutoExpire:
    """booking_expiry_worker.expire_stale_bookings() — TTL enforcement."""

    @pytest.mark.asyncio
    async def test_booking_auto_expire(self, test_db):
        """A pending_payment booking older than the 30-minute TTL is auto-transitioned to 'failed'."""
        from app.workers.booking_expiry_worker import expire_stale_bookings

        stale_oid = ObjectId()
        await test_db.bookings.insert_one({
            "_id": stale_oid,
            "grihasta_id": ObjectId(),
            "acharya_id": ObjectId(),
            "status": "pending_payment",
            "payment_status": "pending",
            "total_amount": 500.0,
            "created_at": datetime.now(timezone.utc) - timedelta(minutes=31),
            "updated_at": datetime.now(timezone.utc) - timedelta(minutes=31),
        })

        expired_count = await expire_stale_bookings(test_db)
        assert expired_count >= 1, "At least one stale booking should have been expired"

        updated = await test_db.bookings.find_one({"_id": stale_oid})
        assert updated["status"] == "failed", (
            f"Expected status 'failed' after expiry, got {updated['status']!r}"
        )


# ---------------------------------------------------------------------------
# TestAttendanceConfirmationBothParties
# ---------------------------------------------------------------------------

class TestAttendanceConfirmationBothParties:
    """POST /api/v1/bookings/{id}/attendance/confirm — two-party attendance flow."""

    @pytest.mark.asyncio
    async def test_attendance_confirmation_both_parties(self, client, test_db):
        """When both grihasta and acharya confirm attendance, booking status becomes 'completed'."""
        from app.core.security import get_current_user as gcu
        from app.db.connection import get_db
        from app.main import app as fastapi_app

        grihasta_oid = ObjectId()
        acharya_oid = ObjectId()
        grihasta_id = str(grihasta_oid)
        acharya_id = str(acharya_oid)

        booking_oid = ObjectId()
        await test_db.bookings.insert_one({
            "_id": booking_oid,
            "grihasta_id": grihasta_oid,
            "acharya_id": acharya_oid,
            "status": "in_progress",
            "payment_status": "completed",
            "total_amount": 1000.0,
            "attendance": {},
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })
        booking_id = str(booking_oid)

        grihasta_user = {"id": grihasta_id, "role": "grihasta", "email": "g@test.com"}
        acharya_user = {"id": acharya_id, "role": "acharya", "email": "a@test.com"}

        fastapi_app.dependency_overrides[get_db] = lambda: test_db

        try:
            # ── Step 1: Grihasta confirms ─────────────────────────────────
            fastapi_app.dependency_overrides[gcu] = lambda: grihasta_user
            resp1 = await client.post(
                f"/api/v1/bookings/{booking_id}/attendance/confirm",
                json={"confirmed": True},
            )
            assert resp1.status_code == 200
            msg1 = resp1.json().get("message", "").lower()
            assert "waiting" in msg1 or "confirmed" in msg1, (
                f"Expected waiting/confirmed message after grihasta confirms, got: {msg1!r}"
            )

            # ── Step 2: Acharya confirms ──────────────────────────────────
            fastapi_app.dependency_overrides[gcu] = lambda: acharya_user
            resp2 = await client.post(
                f"/api/v1/bookings/{booking_id}/attendance/confirm",
                json={"confirmed": True},
            )
            assert resp2.status_code == 200
            msg2 = resp2.json().get("message", "").lower()
            assert "completed" in msg2 or "success" in msg2, (
                f"Expected completed/success message after acharya confirms, got: {msg2!r}"
            )

            # ── Verify DB state ───────────────────────────────────────────
            fastapi_app.dependency_overrides.pop(gcu, None)
            final = await test_db.bookings.find_one({"_id": booking_oid})
            assert final["status"] == "completed", (
                f"Booking must be completed after both parties confirm, got {final['status']!r}"
            )
        finally:
            fastapi_app.dependency_overrides = {}
