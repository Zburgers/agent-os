# ADR 0005: Durable Telegram notifications for successful jobs

## Status

Accepted — 2026-08-09.

## Context

The supervisor can execute jobs while the owner is offline, but the owner
cannot observe a useful result without opening Agent OS. Sending directly from
the poller would bypass the existing durable channel boundary, make restart
recovery ambiguous, and expand Telegram credential exposure.

## Decision

Use the existing PostgreSQL channel outbox and governed Telegram host relay for
all job-success notices. The relay transport ownership is defined by ADR 0006.
`executeInternalJob` evaluates the job result and, in the same transaction as the completed run, authorizes a `message` effect under
`TELEGRAM_NOTIFICATION_POLICY_APPROVAL_ID` and inserts one `job_success` row
per configured `OWNER_TELEGRAM_IDS` recipient.

Idempotency is keyed by `job ID + current occurrence key + Telegram recipient`.
The default criterion is a successful job completion. Jobs can set
`payload.notify_on_success=false`; the NEAR bid monitor uses its existing
meaningful non-pending status transition criterion to avoid five-minute poll
spam. Messages are short, allowlisted, and redacted; no raw job output,
credentials, budget tokens, or provider payloads are sent.

The enqueue is wrapped in a PostgreSQL savepoint. Missing or expired policy,
invalid recipients, and expected authorization denials fail closed and remain
audited. An unexpected outbox failure rolls back only notification work and is
audited after the job commits; it cannot turn a successful job into a failed
job. The existing relay still rechecks pause, kill, commercial lock, leases,
bounded retries, and ambiguity rules before transport.

## Consequences

The owner receives useful success signals while offline, with the same
governance, deduplication, and recovery guarantees as approval notices. A
working notification requires the standing message approval, owner recipient
configuration in both app and supervisor, and a healthy Hermes relay. A
notification outage is visible in job output/audit state without blocking
business job completion.

This decision does not authorize a production deployment or a real Telegram
canary; those remain separate governed operational actions.
