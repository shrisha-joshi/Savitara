"""Outbox worker tests."""
import asyncio

from bson import ObjectId
import pytest


class TestOutboxWorker:
    """Validate durable outbox worker dispatch behavior."""

    @pytest.mark.asyncio
    async def test_process_outbox_once_marks_processed_on_success(self, monkeypatch):
        from app.workers import outbox_worker

        event_id = ObjectId()
        event = {
            "_id": event_id,
            "channel": "ws_personal",
            "payload": {"user_id": "u1", "message": {"type": "ping"}},
            "attempts": 0,
            "max_attempts": 5,
        }

        calls = {"processed": []}

        async def fake_claim_batch(_db, *, batch_size=25):
            await asyncio.sleep(0)
            return [event]

        async def fake_dispatch(_channel, _payload):
            await asyncio.sleep(0)
            return None

        async def fake_mark_processed(_db, e_id):
            await asyncio.sleep(0)
            calls["processed"].append(e_id)

        monkeypatch.setattr(outbox_worker.outbox_service, "claim_batch", fake_claim_batch)
        monkeypatch.setattr(outbox_worker, "_dispatch_event", fake_dispatch)
        monkeypatch.setattr(outbox_worker.outbox_service, "mark_processed", fake_mark_processed)

        processed = await outbox_worker.process_outbox_once(object(), batch_size=10)

        assert processed == 1
        assert calls["processed"] == [event_id]

    @pytest.mark.asyncio
    async def test_process_outbox_once_marks_failed_on_dispatch_error(self, monkeypatch):
        from app.workers import outbox_worker

        event_id = ObjectId()
        event = {
            "_id": event_id,
            "channel": "fcm_single",
            "payload": {
                "token": "token-1",
                "title": "T",
                "body": "B",
                "data": {},
            },
            "attempts": 1,
            "max_attempts": 5,
        }

        calls = {"failed": []}

        async def fake_claim_batch(_db, *, batch_size=25):
            await asyncio.sleep(0)
            return [event]

        async def fake_dispatch(_channel, _payload):
            raise RuntimeError("boom")

        async def fake_mark_failed(_db, e_id, *, attempts, max_attempts, error):
            await asyncio.sleep(0)
            calls["failed"].append((e_id, attempts, max_attempts, error))

        monkeypatch.setattr(outbox_worker.outbox_service, "claim_batch", fake_claim_batch)
        monkeypatch.setattr(outbox_worker, "_dispatch_event", fake_dispatch)
        monkeypatch.setattr(outbox_worker.outbox_service, "mark_failed", fake_mark_failed)

        processed = await outbox_worker.process_outbox_once(object(), batch_size=10)

        assert processed == 1
        assert len(calls["failed"]) == 1
        failed_event_id, attempts, max_attempts, error = calls["failed"][0]
        assert failed_event_id == event_id
        assert attempts == 2
        assert max_attempts == 5
        assert "boom" in error
