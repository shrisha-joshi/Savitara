# ADR-004: Correlation ID Tracing Across Request Flows

- **Status:** Accepted
- **Date:** 2026-03-14
- **Context:** Multi-step booking/payment/chat flows require traceability across logs and async boundaries.

## Decision
Use `X-Correlation-ID` propagation for request tracing:
- Read incoming correlation header when present
- Generate one when absent
- Include correlation ID in response headers and structured logs
- Preserve ID through service and notification/event pathways where feasible

## Consequences
- Faster incident triage and root-cause analysis
- Better observability in distributed interactions
- Improved supportability for production issues
