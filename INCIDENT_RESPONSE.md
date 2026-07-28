# Incident Response

1. Detect and record an incident with timestamp, severity, evidence, and affected boundary.
2. For suspected financial, credential, external-side-effect, or integrity incidents, activate kill state first.
3. Preserve append-only audit evidence and avoid destructive remediation.
4. Contain credentials and network access using owner-managed secret rotation where needed; never copy secret values into tickets or logs.
5. Diagnose, patch, test, deploy with rollback readiness, and verify recovery.
6. Record root cause, impact, corrective actions, and follow-up review. Notify the owner through the approval/Telegram channel for material incidents.
