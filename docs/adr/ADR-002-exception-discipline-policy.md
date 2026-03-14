# ADR-002: Exception Discipline at API Boundaries

- **Status:** Accepted
- **Date:** 2026-03-14
- **Context:** Broad `except Exception` in inner logic obscures root causes and weakens static analysis.

## Decision
Adopt strict exception handling:
- Narrow exceptions in parsing/conversion logic (e.g., `ValueError`, `TypeError`)
- Allow broad exception catches only at explicit endpoint/service boundaries
- Annotate intentional boundary catches with rationale (`# noqa: BLE001`)
- Enforce with lint rulepack (`BLE` in Ruff)

## Consequences
- Improved debuggability and auditability
- Better lint signal quality
- Reduced accidental swallowing of programming errors
