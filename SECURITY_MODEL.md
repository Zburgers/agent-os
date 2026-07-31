# Security Model

## Trust boundaries
The dashboard, Telegram webhook, payment webhook, worker, database, and external providers are separate trust boundaries. Webhooks and all external content are untrusted.

## Required controls
- Authenticated owner-only access; configured Telegram user allowlist.
- Short-lived, signed approval tokens; expiry and decision audit records.
- CSRF protection for browser mutations, secure sessions/cookies in production, input validation, output encoding, rate limits.
- Runtime secrets only; no source, logs, audit payloads, dashboard, Telegram, or Mem0 exposure.
- The owner-authorized dedicated agent wallet (2026-08-01) uses a least-privilege runtime signer or mode-0600 key file owned by `goofy`. Only its public address, policy, hashes, outcomes, and external references enter PostgreSQL/dashboard. The owner wallet remains outside this boundary.
- Autonomous signing is default-deny: allowlisted provider, validated message format, durable rate limit, pause/kill check, derived-address verification, and audit event are required before each signature. Raw signatures are returned transiently and never persisted.
- Per-action kill/pause enforcement, approval enforcement, spending circuit breaker, domain allowlists where configured.
- Idempotency keys for financial records, webhooks, and side-effecting jobs.
- Least privilege service accounts; separate dev and production configuration.
- Dependency scanning, structured redacted logs, backups, restore verification, and incident response.

## Implemented production boundaries

- Migration `008_production_controls.sql` adds commercial lock, scoped hashed credential metadata, effect attribution/linkage, durable channel outbox, memory metadata, backup evidence, reservations, exchange rates, and mechanical readiness gates.
- All durable supervisor internal effects pass `authorizeEffect`; denied proposals persist with stable policy codes.
- Agent API authentication cannot mutate owner controls or decide approvals. `/api/v1` mutations require an idempotency key.
- Telegram webhook input requires a secret header, accepted and rejected identities are audited, and destructive commands require `confirm`.
- Owner approval notifications use one authorized effect and durable outbox row
  per allowlisted recipient. A shell-free host relay supplies text on stdin,
  records bounded outcomes, and treats timeout/termination/invalid receipts as
  reconciliation-required. Signed decisions are recipient-allowlisted,
  expiring, action-bound, replay-safe, and token-free in durable evidence.
- Migration 017 invalidates older inbound-only Telegram readiness evidence.
  Restoring PASS requires an executing exact canary-scoped deployment effect
  and independently verified delivered outbox/provider evidence through the
  authenticated readiness service; arbitrary agent claims and direct SQL are
  not accepted as release evidence.
Hermes supplies the gateway channels, hooks, MCP runtime, skills, and configured
Mem0 provider. Agent OS integrates them through a mode-0600 shared credential,
loopback-only API, native MCP registration, and a fail-closed tool hook; it does
not install duplicate infrastructure. See `docs/HERMES_INTEGRATION.md`.

Controlled end-to-end delivery-receipt acceptance remains a release evidence
gap until the exact deployment and owner-notification policy are approved. The
Telegram readiness gate must remain non-passing until that live canary succeeds.
