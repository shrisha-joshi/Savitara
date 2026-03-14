# Incident Response Playbook (Backend)

## Severity
- **SEV1:** Full outage / critical payment failure
- **SEV2:** Major feature degradation
- **SEV3:** Partial degradation, workaround exists

## First 10 Minutes
1. Acknowledge alert and assign incident commander.
2. Confirm blast radius (APIs, chat, payments, auth).
3. Check SLO dashboards and active deploys.
4. Apply mitigation (rollback, traffic shift, circuit-open guard).

## Diagnostics
- Correlation IDs from failing requests
- Recent deployment diff
- External dependencies: Razorpay, Firebase, Redis, Mongo

## Common Mitigations
- Rollback to previous release
- Disable risky feature flags
- Shift traffic from canary to stable
- Temporarily degrade non-critical features

## Resolution and Recovery
- Validate service health and key user journeys
- Keep monitoring for 30 minutes post-fix
- Publish incident summary and RCA action items

## Postmortem Checklist
- [ ] Timeline documented
- [ ] Root cause identified
- [ ] Preventive actions tracked
- [ ] Runbook updates applied
