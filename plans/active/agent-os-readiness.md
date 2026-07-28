# Agent OS Readiness Audit

Last audited: 2026-07-29
Scope: full mission/constitution/policy review, current worktree, live rootless Compose services, PostgreSQL migrations, source, and automated tests. A table, route, document, or passing unit test is not treated as proof of production readiness by itself.

## Executive decision

**NOT READY FOR REVENUE OPERATIONS.** The control plane is a working local foundation, not yet a non-blocking production gate. No spending, outreach, payment collection, account creation, contract acceptance, or public deployment is authorized. The ₹500 operating tranche remains locked pending P0 evidence and explicit owner approval.

What is working now:

- Rootless Compose app and PostgreSQL are healthy; `GET /healthz` returned `{"status":"ok","database":"ok","memory_provider":"postgres_scoped_fallback"}` on port 9999.
- `npm test`: 19 passed, 1 intentional opt-in integration skip.
- `npm run check`, `npm run build`, and `git diff --check`: passed.
- `npm run test:integration`: passed against a disposable PostgreSQL database; migrations 001–005 applied and ticket, approval, ledger, jobs, health, incident, activity reads were exercised.
- `npm run test:browser`: passed with authenticated session, CSRF parity, ticket creation, edit, comment, transition, and visible activity evidence.
- The dashboard is PostgreSQL-backed, responsive in the tested work-board path, and auto-refreshes visible state.

What still blocks revenue work:

1. No durable always-on supervisor or restart-recovery proof for a running job; `src/worker.ts` is a one-shot worker.
2. Financial policy is tested in a service/unit harness but is not yet proven as the only path for all real financial/payment effects; reversal, reconciliation, and backup/restore evidence are incomplete.
3. Telegram is parser-only: no Bot API transport, webhook authentication, persistence, notifications, or command-to-control integration.
4. Mem0 is not integrated; only a limited PostgreSQL fallback exists and lacks full metadata, mutation operations, provider health, and scope tests.
5. Pause/kill are not centrally enforced at every side-effect boundary, and kill recovery semantics are incomplete.
6. Backup defaults to `/backups`, there is no scheduled/health-recorded backup, and restore has not been tested in an isolated replacement database.
7. A complete internal experiment cannot yet be created, executed, evaluated, and linked to a decision end-to-end.
8. Entity CRUD and dashboard detail/control coverage are partial; the browser evidence currently covers the work board, not the full command centre.

## Definition of Agent OS Ready

| Requirement | Status | Evidence now | Missing proof/work | Priority |
|---|---|---|---|---|
| Process restart and abandoned-run recovery | PARTIAL | Compose restart/health and durable schema exist | Always-on supervisor plus automated running-job restart test proving one completion | P0 |
| Authentication and authorization | PARTIAL | Short-lived DB-backed owner sessions, Bearer/Basic auth, CSRF, logout route | Integration coverage for expiry/revocation/rate limits; TLS/secure production policy; complete security audit coverage | P0 |
| PostgreSQL migrations | PARTIAL | Fresh disposable DB applied 001–005 successfully | Explicit second-run/idempotency and migration checksum discipline test | P0 |
| Live dashboard data | PARTIAL | SQL-backed Command Centre and passing authenticated browser work-board flow | Full financial/approval/job/health UI workflows, desktop/mobile visual checks | P0 |
| Tasks and ventures CRUD | PARTIAL | Authenticated create/update routes and durable ticket edit/comment/transition path | Complete validated CRUD/detail flows for all required entities with persistent audit integration tests | P0 |
| Jobs persist and execute | PARTIAL | Always-on Compose supervisor, durable heartbeat, worker-attributed claims, bounded retry/dead-letter, graceful shutdown, abandoned-run recovery integration test | Scheduled handlers, pause/cancel/rerun controls, process-kill restart test | P0 |
| Exactly-once side effects | PARTIAL | Internal journal plus durable effect intent states, provider idempotency keys, matching approval enforcement, and ambiguous-call reconciliation integration test | Route every producer through the boundary and add real provider crash-boundary tests | P0 |
| Append-only financial ledger | PARTIAL | DB immutability trigger, transactional `LedgerService`, and verified opening entries: ₹5,000 capital, ₹2,000 fixed expense, ₹3,000 cash; capital is excluded from revenue | Required metadata enforcement in DB/service, reversal/adjustment and reconciliation workflow | P0 |
| Spending and reserve enforcement | PARTIAL | Unit policy tests and transactional approved-expense gate | PostgreSQL integration and proof every charge path is gated; owner tranche-release workflow | P0 |
| Approval lifecycle | PARTIAL | Durable request, deduplication, approve/reject/modify/comment/cancel/expiry service and integration coverage | Expiry job, dashboard detail/modify UX, short-lived token delivery and complete audit coverage | P0 |
| Telegram owner controls | FAIL | Allowlist parser unit test only | Authenticated webhook/Bot API transport, command handlers, notifications, audit, kill/pause path | P0 |
| Pause and kill | PARTIAL | Policy function and worker gate unit tests; dashboard control route | One central guard at every effect boundary plus immediate cancellation/recovery tests | P0 |
| Scoped Mem0 | FAIL | PostgreSQL `owner_id/scope_key` text fallback only | Replaceable Mem0 adapter, scoped add/search/update/delete, secret screening, health/backup/retrieval tests | P0 |
| Secret safety | PARTIAL | `.env` is ignored/0600 and redaction unit test passes | Structured audit redaction, canary scan, TLS/session hardening, dependency/security scan | P0 |
| Audit preservation | PARTIAL | Immutable audit/approval/activity triggers and several transactional events | Central event policy and coverage for auth, CRUD, finance, jobs, memory, Telegram, and controls | P0 |
| Backup existence | PARTIAL | `scripts/backup.sh` exists | Home-scoped default, retention, scheduler, health record, permissions and evidence | P0 |
| Restore verification | FAIL | `scripts/restore.sh` exists | Isolated replacement-DB restore and state comparison test | P0 |
| Operations documentation | PARTIAL | Governance documents, runbook, deployment record, active plans exist | Reconcile stale port wording and prove clean-state runbook/rollback procedures | P1 |
| Complete internal experiment | FAIL | Experiment schema and partial CRUD fields exist | Zero-cost internal handler, evaluation/lesson/decision linkage, end-to-end test | P0 |

## P0 release sequence

1. Implement a durable supervisor and prove restart, lease recovery, bounded retries, dead-lettering, pause, and kill.
2. Complete central side-effect policy enforcement and financial/approval integration so no real effect can bypass the gates.
3. Implement Telegram transport and owner-only command/approval controls.
4. Implement scoped Mem0 provider abstraction, metadata/safety checks, health, backup, and retrieval tests.
5. Make backup/restore home-scoped, scheduled, and repeatably verified.
6. Complete the zero-cost internal experiment loop and full dashboard workflows.
7. Run the full release matrix, update this report with exact evidence, then request the owner’s explicit first-tranche approval. Do not unlock the tranche before that point.

## Verification commands

```text
npm test
npm run check
npm run build
npm run test:integration
npm run test:browser
git diff --check
docker compose ps
curl -fsS http://127.0.0.1:9999/healthz
```

## Commercial gate

Until every P0 row is PASS with reproducible evidence and the owner explicitly approves a bounded tranche, Goofy may only perform internal development, read-only research, drafting, and other permitted control-plane work. It must not spend, send external messages, collect payment, create accounts, accept contracts, or publish material commercial claims.

## Production-hardening update — 2026-07-29

The release remains **NOT READY FOR REVENUE OPERATIONS**, but the following previously missing evidence now passes:

- `npm test`: 22 pass, one intentional opt-in integration skip.
- `npm run check`, `npm run build`, `npm run test:integration`, and `npm run test:browser`: pass.
- `npm audit --audit-level=high`: zero vulnerabilities.
- `npm run test:restart`: actual supervisor SIGKILL/recreate, abandoned-run recovery, one completed run and one completed internal effect.
- `npm run test:restore`: mode-restricted backup, SHA-256 manifest, isolated replacement database restore, immutable-trigger/control/opening-finance checks.
- `npm run experiment:internal`: complete ₹0 internal experiment with linked objective, venture, task, job/run, effect, checksummed artifact, activity, result, lesson, and decision.
- Live Compose app/PostgreSQL/supervisor are healthy. `commercial_lock=true`, `released_operating_minor=0`, required reserve is ₹2,000, and settled revenue remains ₹0.
- Central effects now persist denied proposals and apply kill, pause, commercial lock, actor scope, approval scope, idempotency, and reconciliation controls in one locked transaction. Internal supervisor effects use this path.

Still P0-blocking and therefore not marked PASS:

1. Live owner-credentialed Telegram relay and Discord alert-only delivery receipts.
2. Authenticated self-hosted Mem0 provider/restore evidence; the safe PostgreSQL scoped fallback is not Mem0.
3. A real external provider crash-after-acceptance harness beyond the durable simulated reconciliation path.
4. Private HTTPS/Tailscale and the requested routed React/Vite frontend with desktop/tablet/mobile visual suite.
5. Credentialed Hermes-to-Agent-OS live command/MCP proof using Hermes' existing integration facilities.

No tranche approval was created because the mechanical P0 matrix is not all PASS.

## Hermes integration evidence — 2026-07-29

- Hermes gateway is active and supervises the Agent OS stdio MCP process.
- `hermes mcp test agent-os` connects and discovers all eight enabled tools.
- `hermes hooks doctor` passes; the risky tool fixture is denied with
  `commercial_lock`.
- The native `/os` skill passes `quick_validate.py` and is enabled in both
  Hermes and Codex through symlinks to the repository source.
- `hermes memory status` reports the existing Mem0 plugin installed, available,
  and active. No duplicate Mem0 or plugin infrastructure was created.
- Agent OS and Hermes share only a mode-0600 credential; the API is loopback,
  bot/provider credentials remain outside Agent OS, and PostgreSQL remains the
  authority store.

The Hermes MCP/hook/skill/provider wiring row is now PASS. Hermes currently
reports Mem0 `mode: platform`, so the constitution's separate self-hosted Mem0
deployment/restore requirement is not marked PASS. Revenue release is also
blocked by private HTTPS, controlled channel delivery-receipt acceptance (the
configured Telegram home chat currently reports `Chat not found`), a real
external-provider crash-after-acceptance acceptance test, and the broader
command-centre visual workflow matrix. Commercial lock remains on.
