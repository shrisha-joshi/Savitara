# Canary + Blue/Green Deployment Runbook

## Purpose
Reduce risk during backend releases with staged rollout and safe rollback.

## Strategy
1. **Blue/Green:** deploy new version to green environment.
2. **Canary:** route small traffic percentage to green.
3. **Promote:** move all traffic only if metrics remain healthy.

## Rollout Stages
- Stage 0: Green deployed, no user traffic
- Stage 1: 5% traffic for 10 minutes
- Stage 2: 25% traffic for 15 minutes
- Stage 3: 50% traffic for 15 minutes
- Stage 4: 100% traffic and blue drain

## Promotion Gates
- 5xx error rate below SLO threshold
- p95 latency under 2s
- No critical alerts firing
- No elevated auth/payment failures

## Abort Criteria (Immediate Rollback)
- Error budget fast-burn alert fires
- Payment verification failures spike
- Chat/WebSocket delivery degradation > 2x baseline

## Rollback Procedure
1. Route traffic back to blue.
2. Verify health checks and key endpoints.
3. Disable green from public ingress.
4. Capture incident timeline and root-cause notes.

## Verification Checklist
- [ ] Health endpoint green
- [ ] Booking create/read smoke test
- [ ] Payment order creation smoke test
- [ ] Trust/dispute read paths healthy
- [ ] Monitoring dashboards stable

## Communication
- Announce stage transitions in release channel
- Post final promote/rollback decision with timestamps
