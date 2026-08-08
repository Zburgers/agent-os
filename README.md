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
`job_success` Telegram outbox message for the configured owner chats. Hermes
delivers the outbox; the poller never sends directly and never receives the
Telegram bot credential. Messages are deduplicated by job occurrence, governed
by the approved Telegram message policy, and fail closed if that policy or the
owner recipient allowlist is unavailable. The NEAR bid monitor only notifies on
a meaningful non-pending status transition so a five-minute poll does not
become a notification stream.

See [`docs/adr/0005-job-success-telegram-notifications.md`](docs/adr/0005-job-success-telegram-notifications.md)
and the [runbook notification section](RUNBOOK.md#telegram-job-success-notifications)
for configuration and recovery details.

## Development

```bash
npm ci
npm test
```

Production operation uses Docker Compose, PostgreSQL migrations, and the
documented private deployment runbook. Secrets belong in runtime injection;
never commit them or place them in memory or issue text.
