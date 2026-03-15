"""Unit tests for DB query budget guards."""

import pytest
from fastapi import HTTPException

from app.db.query_budget import (
    clear_query_budget,
    get_query_count,
    set_query_budget,
    wrap_database_with_query_budget,
)


class _DummyCollection:
    def __init__(self):
        self.calls = 0

    def find_one(self, *_args, **_kwargs):
        self.calls += 1
        return {"ok": True}


class _DummyDatabase:
    def __init__(self):
        self.users = _DummyCollection()

    def __getitem__(self, item):
        return getattr(self, item)


def test_query_budget_enforced():
    db = wrap_database_with_query_budget(_DummyDatabase())
    set_query_budget(1)

    try:
        assert db.users.find_one({"id": 1}) == {"ok": True}
        with pytest.raises(HTTPException) as exc:
            db.users.find_one({"id": 2})
        assert exc.value.status_code == 500
        assert exc.value.detail["error"]["code"] == "DB_002"
        assert get_query_count() == 2
    finally:
        clear_query_budget()


def test_query_budget_disabled_by_default():
    db = wrap_database_with_query_budget(_DummyDatabase())
    clear_query_budget()

    assert db.users.find_one({"id": 1}) == {"ok": True}
    assert db.users.find_one({"id": 2}) == {"ok": True}
