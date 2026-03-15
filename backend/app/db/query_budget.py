"""Request-scoped MongoDB query budget guards.

Prevents accidental N+1 query explosions by enforcing per-request query limits.
"""

from __future__ import annotations

import contextvars
from typing import Any, Callable, Optional

from fastapi import HTTPException


_query_budget: contextvars.ContextVar[Optional[int]] = contextvars.ContextVar(
    "query_budget", default=None
)
_query_count: contextvars.ContextVar[int] = contextvars.ContextVar(
    "query_count", default=0
)

_COLLECTION_OPS = {
    "find",
    "find_one",
    "aggregate",
    "count_documents",
    "distinct",
    "insert_one",
    "insert_many",
    "update_one",
    "update_many",
    "replace_one",
    "delete_one",
    "delete_many",
    "find_one_and_update",
    "find_one_and_replace",
    "find_one_and_delete",
    "bulk_write",
}


def set_query_budget(limit: Optional[int]) -> None:
    _query_budget.set(limit)
    _query_count.set(0)


def clear_query_budget() -> None:
    _query_budget.set(None)
    _query_count.set(0)


def get_query_budget() -> Optional[int]:
    return _query_budget.get()


def get_query_count() -> int:
    return _query_count.get()


def consume_query_budget(collection_name: str, operation: str) -> None:
    budget = _query_budget.get()
    if budget is None:
        return

    current = _query_count.get() + 1
    _query_count.set(current)

    if current <= budget:
        return

    raise HTTPException(
        status_code=500,
        detail={
            "success": False,
            "error": {
                "code": "DB_002",
                "message": "Database query budget exceeded for this request",
                "details": {
                    "budget": budget,
                    "query_count": current,
                    "collection": collection_name,
                    "operation": operation,
                },
            },
        },
    )


class QueryBudgetCollectionProxy:
    """Proxy around a Mongo collection that tracks query-consuming operations."""

    def __init__(self, collection: Any, collection_name: str):
        self._collection = collection
        self._collection_name = collection_name

    def __getattr__(self, item: str) -> Any:
        target = getattr(self._collection, item)
        if item not in _COLLECTION_OPS or not callable(target):
            return target

        def _wrapped(*args: Any, **kwargs: Any) -> Any:
            consume_query_budget(self._collection_name, item)
            return target(*args, **kwargs)

        return _wrapped


class QueryBudgetDatabaseProxy:
    """Proxy around a Mongo database that returns budget-aware collections."""

    def __init__(self, db: Any):
        self._db = db

    def __getattr__(self, item: str) -> Any:
        attr = getattr(self._db, item)
        if hasattr(attr, "find_one") and callable(getattr(attr, "find_one", None)):
            return QueryBudgetCollectionProxy(attr, item)
        return attr

    def __getitem__(self, item: str) -> Any:
        collection = self._db[item]
        return QueryBudgetCollectionProxy(collection, item)


def wrap_database_with_query_budget(db: Any) -> Any:
    return QueryBudgetDatabaseProxy(db)