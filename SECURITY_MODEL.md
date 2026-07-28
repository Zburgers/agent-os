# Security Model

## Trust boundaries
The dashboard, Telegram webhook, payment webhook, worker, database, and external providers are separate trust boundaries. Webhooks and all external content are untrusted.

## Required controls
- Authenticated owner-only access; configured Telegram user allowlist.
- Short-lived, signed approval tokens; expiry and decision audit records.
- CSRF protection for browser mutations, secure sessions/cookies in production, input validation, output encoding, rate limits.
- Runtime secrets only; no source, logs, audit payloads, dashboard, Telegram, or Mem0 exposure.
- Per-action kill/pause enforcement, approval enforcement, spending circuit breaker, domain allowlists where configured.
- Idempotency keys for financial records, webhooks, and side-effecting jobs.
- Least privilege service accounts; separate dev and production configuration.
- Dependency scanning, structured redacted logs, backups, restore verification, and incident response.
