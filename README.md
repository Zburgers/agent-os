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

## Development

```bash
npm ci
npm test
```

Production operation uses Docker Compose, PostgreSQL migrations, and the
documented private deployment runbook. Secrets belong in runtime injection;
never commit them or place them in memory or issue text.

## Daily operations

Revenue Paths is available at `/revenue-paths`. The scheduled Codex operating
block resumes the exact configured thread at 09:00 Asia/Kolkata through the
checked-in systemd units. Read-only run evidence and owner controls are at
`/codex-operating-block`; wallet policy versions are visible at `/wallet`.

The timer remains disabled until `scripts/test-codex-resume-smoke.sh` and the
complete verification gate pass. Dedicated wallet policy versions begin as
draft and implementation/tests broadcast no public-network transaction.
