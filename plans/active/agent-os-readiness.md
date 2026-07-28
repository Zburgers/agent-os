# Agent OS Readiness Audit

Last audited: 2026-07-28
Scope: runtime rootless Compose deployment, PostgreSQL state, source code, and automated tests. A requirement is not complete solely because a table, route, document, or label exists.

## Verification baseline

- Rootless Compose services restarted; PostgreSQL health endpoint returned 200 and dashboard owner authentication returned 200.
- `.env` is mode `0600`; `.env` is ignored by Git and not tracked. `.env.example` is tracked and contains only placeholders.
- Existing automated suite passes, but it is unit-only and does not exercise most persistent behaviour.
- No commercial activity, spending, outreach, payment collection, account creation, or public deployment is enabled.

## Definition of Agent OS Ready

| Requirement | Status | Current evidence | Files | Tests | Missing work | Priority | Verification method |
|---|---|---|---|---|---|---|---|
| Survives a process restart | PARTIAL | Compose restarts services and PostgreSQL persists via bind mount; a manual restart restored health. Pending jobs, sessions, and worker continuity are not proven. | `compose.yaml`, `src/worker.ts` | None | Automated restart-recovery integration test, durable supervisor service. | P0 | Create queued/running work, restart app and worker, prove single completion and preserved state. |
| Authentication works | PARTIAL | Owner token supports Bearer and browser Basic authentication; rate limiter is in memory. | `src/server.ts` | None | Short-lived signed sessions, logout, CSRF protection, secure cookie/TLS deployment policy, auth audit events. | P0 | Login, expiry, invalid token, CSRF, logout, and authorization integration tests. |
| PostgreSQL migrations work | PARTIAL | Fresh migration bootstrap was repaired; startup invokes migration. Existing populated database migration only was exercised. | `src/migrate.ts`, `db/migrations/001_initial.sql` | None | Clean-database migration test and migration checksum/version discipline. | P0 | Start an empty PostgreSQL instance; migrate twice; verify schema and idempotency. |
| Dashboard displays live data | PARTIAL | Overview SQL queries live tables, but the UI renders raw JSON only. | `src/server.ts` | None | Operational interface, navigation, loading/error/empty states, accessible formatters. | P0 | Seed controlled records and assert visible metric and timeline values. |
| Tasks and ventures can be created and updated | FAIL | Tables exist; there are no authenticated CRUD routes or UI workflows. | `db/migrations/001_initial.sql` | None | Validated create/read/update workflows with audit events. | P0 | Create and update through UI/API; verify durable state and audit records. |
| Jobs execute and persist results | PARTIAL | Worker claims one queued job and writes a synthetic completion result. No service, scheduling, action executor, or logs interface. | `src/worker.ts` | None | Long-running worker, schedules, real handlers, durable output/logs, failures. | P0 | Queue a safe internal job and prove durable run records after restart. |
| Duplicate jobs do not duplicate external effects | FAIL | Unique job idempotency key exists, but execution has no external-effect idempotency store or test. | `db/migrations/001_initial.sql`, `src/worker.ts` | None | External action journal and exactly-once/idempotent handler boundary. | P0 | Submit duplicate work and simulated handler retries; assert one effect record. |
| Financial entries are append-only | PARTIAL | Ledger update/delete trigger exists. No financial write service verifies required evidence and no adjustment workflow exists. | `db/migrations/001_initial.sql` | None | Validated ledger service, immutable audit linkage, reversal workflow. | P0 | Insert entry, reject update/delete, create reversal, verify balances. |
| Spending limits are automatically enforced | FAIL | Pure `evaluateExpense` unit function is not connected to ledger or any expense endpoint. | `src/finance.ts` | `test/finance.test.ts` | Transactional financial policy gate before any expense action. | P0 | Attempt each limit breach through service; verify no ledger/effect mutation. |
| Reserve cannot be spent accidentally | FAIL | Reserve is an unused function input and optional account flag. | `src/finance.ts`, schema | `test/finance.test.ts` | Locked-reserve calculation and transactional balance enforcement. | P0 | Fund contribution/reserve and reject expense that reduces locked reserve. |
| Approval requests work | PARTIAL | Request insertion is authenticated and idempotent. No approve/reject/modify/expiry actions or decision audit flow. | `src/server.ts`, schema | `test/approval-token.test.ts` | Expiry sweeper, immutable decisions, modification lineage, owner action UI. | P0 | Create, duplicate, expire, approve, reject, modify and audit each state. |
| Telegram owner restrictions work | PARTIAL | Parser rejects an unlisted ID. No Bot API transport, webhook verification, persistence, or approval actions. | `src/telegram.ts` | `test/telegram.test.ts` | Configured integration, webhook validation, command execution, secret-safe notifications. | P0 | Simulate allowed and denied webhook commands and approval actions. |
| Pause works | PARTIAL | Pure policy check and worker gate exist. Dashboard changes controls but does not enforce every side-effect path. | `src/policy.ts`, `src/worker.ts`, `src/server.ts` | `test/policy.test.ts` | Central policy gate used by jobs, financial writes, messages, deployment/account actions. | P0 | Pause then attempt every side-effect category; assert no effect. |
| Kill works | PARTIAL | Pure policy check and dashboard control exist. System-wide enforcement and immediate worker cancellation are unverified. | `src/policy.ts`, `src/server.ts` | `test/policy.test.ts` | Global guard and tests for all side-effect boundaries. | P0 | Kill then exercise jobs, expenses, messages, deployments, payment and account actions. |
| Mem0 retrieval is scoped and tested | FAIL | PostgreSQL text-search fallback scopes owner and key. Mem0 is not integrated, metadata is incomplete, and no scope tests exist. | `src/memory.ts`, schema | None | Mem0 adapter, secret screening, scoped add/search/update/delete, health and backup. | P0 | Cross-scope retrieval test and provider failure test. |
| Secrets are not exposed | PARTIAL | `.env` permissions and Git exclusion verified; basic string redaction test exists. Runtime values can still enter arbitrary audit payloads, errors, tests, and HTTP Basic is cleartext on LAN. | `.gitignore`, `src/redaction.ts`, `src/server.ts` | `test/redaction.test.ts` | Structured redaction boundary, secret scanner, TLS/reverse-proxy policy, session controls. | P0 | Scan logs/audit outputs; inject canary secret; prove redaction and Git exclusion. |
| Audit events are preserved | PARTIAL | Immutable database trigger exists and some actions emit events. CRUD, approvals, worker failure, auth, Telegram, finance and memory events are incomplete. | `db/migrations/001_initial.sql`, `src/db.ts` | None | Central audit service and coverage for every material action. | P0 | Exercise material workflows and reject audit update/delete. |
| Backups exist | PARTIAL | `pg_dump` script exists, but default `/backups` violates home-data policy and no scheduler/health exists. | `scripts/backup.sh` | None | Home-scoped backup path, retention, metadata, health record. | P0 | Run backup into `/home/goofy`, verify readable dump and audit record. |
| Restore has been tested | FAIL | Restore script exists; no controlled restoration test. | `scripts/restore.sh` | None | Isolated restore test and documented evidence. | P0 | Backup data, restore into replacement database, compare required state. |
| Setup and operations documentation exists | PARTIAL | Governance files and runbook exist but contain stale port 999 reference and unverified procedures. | `RUNBOOK.md`, `DEPLOYMENT.md` | None | Correct runbook, recovery and credential handling procedures tied to tests. | P1 | Follow runbook from clean state and record evidence. |
| Complete internal experiment can be created, executed, evaluated | FAIL | Experiment table only. No CRUD, scheduler handler, result workflow, decision linkage, or dashboard path. | schema, `src/worker.ts` | None | Internal safe experiment workflow with evaluation and audit trail. | P0 | Run a zero-cost internal experiment end-to-end and verify result/lesson/decision. |

## Required P0 sequence

1. Replace static Basic-only browser authentication with short-lived server-side sessions, CSRF protection for mutations, logout, and durable security audit events. Keep Bearer support for automation.
2. Build the Command Centre as a data-backed interface with a clear sidebar, metric hierarchy, states for no data/failure/loading, and authenticated APIs.
3. Add validated, audited CRUD workflows for ventures, opportunities, objectives, tasks, experiments, and decisions.
4. Implement transactional ledger, reserves, policy-gated expenses, approval lifecycle, durable jobs, activity/audit, and health endpoints.
5. Add Telegram transport behind its allowlist, scoped Mem0 provider, backup/restore and restart recovery integration tests.

## Current release decision

**NOT READY FOR REVENUE OPERATIONS.** The ₹500 operating tranche remains locked. No action may unlock or spend it without an explicit owner approval after all P0 requirements above are verified.
