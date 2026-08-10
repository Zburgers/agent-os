# Goofy Agent OS

Goofy Agent OS is Neuratech's self-hosted control plane for reliable n8n,
API, and AI-agent operations. It keeps business state in PostgreSQL and puts
approval, idempotency, payment, wallet, pause, kill, and audit boundaries in
the service layer.

## Reliability case study

Read the evidence-backed implementation case study:

[`docs/CASE_STUDY_AUTOMATION_RELIABILITY.md`](docs/CASE_STUDY_AUTOMATION_RELIABILITY.md)

It describes the actual architecture and tests. It does not claim customer
results, uptime guarantees, compliance certification, or third-party audits.

## Bounded service

Neuratech offers a fixed-scope reliability audit for one n8n, API, or AI
workflow. A buyer provides a sanitized workflow export and two or three
sanitized execution examples. The deliverable is a dependency map, failure and
idempotency risks, prioritized fixes, and an implementation order. No
production credentials or live access are required.

The first audit is **$99**, delivered within 48 hours. A separate
implementation sprint can be scoped after the audit. Payment is issued only
through a verified buyer-specific checkout and settlement is reconciled before
delivery.

## Offline job notifications

The supervisor records each successful job occurrence in PostgreSQL and, when
its success criterion is reached, transactionally creates a redacted
`job_success` Telegram outbox message for the configured owner chats. The
Agent OS host relay owns the Telegram Bot API send and callback loop; the
poller never sends directly and never receives the Telegram bot credential.
Messages are deduplicated by job occurrence, governed by the approved Telegram
message policy, and fail closed if that policy or the owner recipient allowlist
is unavailable. The NEAR bid monitor only notifies on a meaningful non-pending
status transition so a five-minute poll does not become a notification stream.

See [`docs/adr/0005-job-success-telegram-notifications.md`](docs/adr/0005-job-success-telegram-notifications.md)
and the [runbook notification section](RUNBOOK.md#telegram-job-success-notifications)
for configuration and recovery details.

## Governance workspace

The authenticated [`/governance`](/governance) page exposes the fixed allowlist
of runtime laws and operating instructions directly in the control plane. The
owner can edit and save a known document from the page; saves are atomic,
optimistically concurrency-checked by SHA-256, and audit-recorded with only
document metadata. It is not an arbitrary file browser, and raw secrets are
never accepted or returned as document content.

## Account observability

The authenticated [`/accounts`](/accounts) page is a live, metadata-only
inventory of accounts owned or observed by Agent OS. It is backed by the
`owned_accounts` and `owned_account_credentials` PostgreSQL tables and is
reconciled from registered integrations and safe runtime signals on each
read. The page shows platform identity, account category, safe identifiers,
credential type/source/status metadata, and access health; raw secrets are
never stored, scanned, or returned. Registration workflows may use
`POST /api/owned-accounts`, but that endpoint accepts metadata-only payloads
and rejects secret-bearing fields.

## Development

```bash
npm ci
npm test
```

Production operation uses Docker Compose, PostgreSQL migrations, and the
documented private deployment runbook. Secrets belong in runtime injection;
never commit them or place them in memory or issue text.
