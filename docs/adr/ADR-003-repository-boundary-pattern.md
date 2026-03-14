# ADR-003: Repository Boundary for Booking Data Access

- **Status:** Accepted
- **Date:** 2026-03-14
- **Context:** Route handlers contained direct Mongo queries and aggregation logic, increasing coupling and reducing testability.

## Decision
Introduce repository contracts and concrete implementations:
- `IBookingRepository` and `IUserRepository` in `backend/app/core/interfaces.py`
- `MongoBookingRepository` in `backend/app/repositories/booking_repository.py`

Move booking query responsibilities to repository methods:
- `find_for_user(...)`
- `find_with_details(...)`
- update helpers for status/attendance

## Consequences
- Clearer service/data boundaries
- Easier mocking in tests
- Query optimizations are centralized and reusable
