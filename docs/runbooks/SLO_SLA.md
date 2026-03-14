# SLO/SLA Definition – Savitara Backend

## Scope
Applies to customer-facing backend APIs under `/api/v1/*` and chat WebSocket reliability.

## Service Level Indicators (SLIs)
- **Availability SLI (HTTP):** ratio of non-5xx responses over total responses.
- **Latency SLI (HTTP):** p95 request latency from `http_request_duration_seconds_bucket`.
- **WebSocket Delivery SLI:** successful WS deliveries vs delivery attempts.

## Service Level Objectives (SLOs)
- **Availability:** 99.9% monthly for API endpoints.
- **Latency (p95):** < 2s over 5m windows for steady-state traffic.
- **WS Delivery:** >= 99.5% successful direct/local deliveries over 24h.

## SLA Mapping
- External customer SLA can map to 99.5% availability monthly.
- Internal ops target remains stricter (99.9%) to preserve error budget.

## Error Budget Policy
For 99.9% monthly target:
- Monthly error budget ≈ 43m 49s downtime equivalent.
- Freeze risky deployments when burn rate exceeds thresholds.

## Alerting Expectations
- **Fast burn:** >14x budget burn over short window (5m).
- **Slow burn:** >6x budget burn over longer window (30m).
- **Latency breach:** p95 > 2s for 5m.

## Ownership
- Primary: Backend team
- Secondary: Platform/DevOps

## Review Cadence
- Weekly SLO review in ops sync
- Monthly SLA compliance report
