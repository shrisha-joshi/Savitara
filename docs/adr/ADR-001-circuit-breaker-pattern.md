# ADR-001: Circuit Breaker Pattern for External Services

- **Status:** Accepted
- **Date:** 2026-03-14
- **Context:** Payment gateway and push notification failures can cascade into API latency spikes and poor user experience.

## Decision
Use explicit circuit-breaker guards around external integrations:
- `RazorpayService.create_order`
- `NotificationService.send_notification`
- `NotificationService.send_multicast`

Circuit behavior:
- Fail fast when circuit is `OPEN`
- Record success/failure on each external call
- Avoid penalizing known client-side token errors (e.g., unregistered FCM token)

## Consequences
- Better resilience during provider incidents
- Faster failure response at API boundary
- More deterministic behavior under degradation
