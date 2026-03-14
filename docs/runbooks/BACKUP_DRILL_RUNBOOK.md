# Backup & Restore Drill Runbook

## Purpose
Validate that MongoDB data can be backed up and restored within recovery objectives.

## Targets
- **RPO:** <= 15 minutes
- **RTO:** <= 60 minutes

## Preconditions
- Access to backup storage bucket/location
- Access to target MongoDB test/restore cluster
- Verified credentials in secure secrets manager

## Drill Steps
1. **Announce drill window** in engineering channel.
2. **Trigger backup snapshot/export** (or verify latest automated snapshot timestamp).
3. **Restore to isolated target environment** (never production directly).
4. **Run integrity checks:**
   - collection counts
   - key booking/payment documents presence
   - critical indexes present
5. **Run smoke tests** against restored environment:
   - auth endpoint healthy
   - booking read path
   - trust/dispute read path
6. **Record timings:**
   - backup completion timestamp
   - restore completion timestamp
   - validation completion timestamp
7. **Document findings** and remediation tasks.

## Validation Checklist
- [ ] Backup artefact exists and is readable
- [ ] Restore completed without errors
- [ ] Indexes recreated/validated
- [ ] Smoke checks pass
- [ ] RPO/RTO met

## Rollback/Safety
- Abort if restore target is not isolated.
- Never overwrite production data during drill.

## Escalation
- Primary: Platform on-call
- Secondary: Backend lead

## Post-Drill
- Publish report in `#ops` and attach evidence links
- Open tracked tickets for any gaps
