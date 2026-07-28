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

## Implemented production boundaries

- Migration `008_production_controls.sql` adds commercial lock, scoped hashed credential metadata, effect attribution/linkage, durable channel outbox, memory metadata, backup evidence, reservations, exchange rates, and mechanical readiness gates.
- All durable supervisor internal effects pass `authorizeEffect`; denied proposals persist with stable policy codes.
- Agent API authentication cannot mutate owner controls or decide approvals. `/api/v1` mutations require an idempotency key.
- Telegram webhook input requires a secret header, accepted and rejected identities are audited, and destructive commands require `confirm`.
Hermes supplies the gateway channels, hooks, MCP runtime, skills, and configured
Mem0 provider. Agent OS integrates them through a mode-0600 shared credential,
loopback-only API, native MCP registration, and a fail-closed tool hook; it does
not install duplicate infrastructure. See `docs/HERMES_INTEGRATION.md`.

Private HTTPS and controlled end-to-end delivery-receipt acceptance remain
release evidence gaps. Commercial lock remains enabled, so no live channel send
was used as a test.
