"""
Pagination Utility
"""
from typing import TypeVar, Generic, List
from pydantic import BaseModel, ConfigDict
from math import ceil

T = TypeVar("T")


class PaginationParams(BaseModel):
    """Pagination request parameters"""

    page: int = 1
    limit: int = 20

    @property
    def skip(self) -> int:
        """Calculate skip value for database query"""
        return (self.page - 1) * self.limit

    model_config = ConfigDict(frozen=True)


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response"""

    items: List[T]
    total: int
    page: int
    limit: int
    pages: int
    has_next: bool
    has_prev: bool

    model_config = ConfigDict(arbitrary_types_allowed=True)


def paginate(items: List[T], total: int, page: int, limit: int) -> PaginatedResponse[T]:
    """Create paginated response"""
    pages = ceil(total / limit) if limit > 0 else 0

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1,
    )


def get_pagination_params(page: int = 1, limit: int = 20) -> PaginationParams:
    """Get validated pagination parameters"""
    # Ensure values are within acceptable ranges
    page = max(1, page)
    limit = max(1, min(100, limit))  # Max 100 items per page

    return PaginationParams(page=page, limit=limit)
