# Agent OS Readiness Audit

Last audited: 2026-07-29 16:03 IST
Scope: full mission/constitution/policy review, current worktree, live rootless Compose services, PostgreSQL migrations, source, and automated tests. A table, route, document, or passing unit test is not treated as proof of production readiness by itself.

## Executive decision

**READY FOR SCOPED REVENUE OPERATIONS.** All 18 P0 gates pass. Owner approval
`c029a613-495e-46c4-8301-eee8d0e3af01` released one ₹500 operating tranche
through the audited, idempotent reconciler. Authoritative live state is
`commercial_lock=false`, `released_operating_minor=50000`, `paused=false`, and
`killed=false`. Every external effect still requires its own active scoped
approval and one-time effect claim.

What is working now:

- Rootless Compose app and PostgreSQL are healthy; `GET /healthz` returned `{"status":"ok","database":"ok","memory_provider":"postgres_scoped_fallback"}` on port 9999.
- `npm test`: 19 passed, 1 intentional opt-in integration skip.
- `npm run check`, `npm run build`, and `git diff --check`: passed.
- `npm run test:integration`: passed against a disposable PostgreSQL database; migrations 001–005 applied and ticket, approval, ledger, jobs, health, incident, activity reads were exercised.
- `npm run test:browser`: passed with authenticated session, CSRF parity, ticket creation, edit, comment, transition, and visible activity evidence.
- The dashboard is PostgreSQL-backed, responsive in the tested work-board path, and auto-refreshes visible state.

Historical blockers resolved by the P0 release:

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
| Process restart and abandoned-run recovery | PASS | `npm run test:restart` inserts an abandoned running job, sends SIGKILL to the live supervisor, recreates it, and proves exactly one recovered completed run/effect. | Continue running the restart acceptance test after supervisor changes. | P0 |
| Authentication and authorization | PASS | DB-backed expiry/revocation acceptance, Bearer/Basic/agent separation, CSRF, audited failed login, independent login rate limit, Secure/HttpOnly/SameSite cookie, and private Tailscale HTTPS | Continue running integration/browser acceptance after auth changes. | P0 |
| PostgreSQL migrations | PASS | `npm run test:integration` applies migrations 001–010 to a disposable database, runs the migrator a second time, and startup verifies SHA-256 checksums for every historical migration. Live PostgreSQL records every checksum. | Continue running the same acceptance command before release changes. | P0 |
| Live dashboard data | PASS | Authenticated SQL-backed seven-route owner console; browser acceptance loads every route and captures desktop, tablet, and mobile renderings without overflow; approval and work-board mutations persist | Continue browser acceptance after UI changes. | P0 |
| Tasks and ventures CRUD | PASS | Validated ticket create/edit/comment/transition plus venture create/update are persisted with immutable application and DB-backstop audit evidence in disposable PostgreSQL/browser tests | Extend the same contract when new domain mutations are added. | P0 |
| Jobs persist and execute | PASS | Durable supervisor, occurrence keys, leases, bounded retries/dead-letter, scheduling, pause/cancel/rerun functions, SIGKILL/recreate recovery, and exactly one recovered internal effect | Continue restart and integration acceptance after supervisor changes. | P0 |
| Exactly-once side effects | PASS | Effect authorization API, one-time execution claim, post-result endpoint, provider idempotency, and real HTTP crash/reconciliation acceptance pass. `hermes hooks doctor` verifies the pre/post hooks are allowlisted, unchanged, executable, and healthy. | Continue crash and hook acceptance after effect-boundary changes. | P0 |
| Append-only financial ledger | PASS | Immutable ledger and audit triggers, DB arithmetic/metadata/reversal-link enforcement, transactional service, reversals, reconciliation fields, and verified opening entries; capital remains excluded from revenue | Continue finance negative integration tests after schema changes. | P0 |
| Spending and reserve enforcement | PASS | Commercial lock, pause/kill, approval, released-tranche, per-charge/day/experiment limits, and reserve preservation execute transactionally; direct incomplete expense inserts are rejected by PostgreSQL | No tranche may be released without all P0 PASS plus owner approval. | P0 |
| Approval lifecycle | PASS | Durable request, deduplication, transition/audit history, expiry, and browser approval workflow pass. The supervisor expires pending approvals every minute; authenticated dashboard approval actions are verified in `npm run test:browser`. | Continue running the browser and unit lifecycle suites after approval changes. | P0 |
| Telegram owner controls | PASS | Hermes Telegram gateway is connected; Agent OS has owner allowlist, authenticated commands, confirmation-gated pause/resume/kill, shared transactional controls, and immutable command audits. The owner received the live SQL-backed `/os status` response on Telegram and supplied its exact operational output. | Re-run a live read-only status check after gateway or owner-allowlist changes. | P0 |
| Pause and kill | PASS | Dashboard and Telegram share one locked transaction; pause/kill stop queued and in-flight jobs, invalidate leases, finish active runs, cancel unstarted effects, audit atomically, and block every new effect. Kill cannot be resumed through ordinary controls. | Continue negative integration acceptance after control changes. | P0 |
| Scoped memory | PASS | `npm run test:mem0` passed on 2026-07-29 using the configured Mem0 Cloud credential and a disposable owner/scope: asynchronous add event completion, scoped retrieval, cross-owner/cross-scope update/delete denial, update/delete cleanup, PostgreSQL provider-ID provenance, and immutable audit evidence. The hybrid unit, integration-migration, backup, restore, and temporary-provider recovery tests also pass. This is the existing scoped-memory P0 gate, not a new one. | Re-run `npm run test:mem0` after provider credential, API, scope, or runtime changes. | P0 |
| Secret safety | PASS | `.env` is ignored and mode 0600; secret redaction and memory canary rejection pass; tracked-file secret scan is clean; private HTTPS and secure cookies are configured; `npm audit --audit-level=high` reports zero vulnerabilities | Repeat scans after dependency, auth, or logging changes. | P0 |
| Audit preservation | PASS | Immutable audit/approval/activity tables plus migration 011 DB audit backstops cover auth sessions, domain CRUD, finance, jobs/runs, effects, approvals, controls, reservations, and channel outbox; bypass and mutation negatives pass | Continue checking that new mutable authoritative tables receive an audit backstop. | P0 |
| Backup existence | PASS | Mode-restricted PostgreSQL and curated-Markdown archive with independent SHA-256 manifest checks; systemd user timer is enabled daily and a successful run persists `backup_runs` plus `system_health_checks` evidence. | Monitor the scheduled run and retain the existing restore gate separately. | P0 |
| Restore verification | PASS | `npm run test:restore` verifies both archive checksums, restores into an isolated replacement database and private Markdown directory, checks immutable/control invariants, and compares ledger, audit, contextual-reference, and curated-memory record counts captured in the manifest. | Continue running the same disposable restore test after backup or schema changes. | P0 |
| Operations documentation | PARTIAL | Governance documents, runbook, deployment record, active plans exist | Reconcile stale port wording and prove clean-state runbook/rollback procedures | P1 |
| Complete internal experiment | PASS | `src/internal-experiment.ts` creates and links a zero-cost objective, venture, task, job/run, internal effect, checksummed artifact, result, lesson, and decision; repeated execution is idempotent. | Continue running this internal proof after workflow changes. | P0 |

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

## Commercial release evidence — 2026-07-29

- Migration 012 adds an append-only `operating_tranche_releases` record linked
  uniquely to the owner approval.
- The supervisor reconciles approved, unexpired tranche decisions
  transactionally and idempotently; it cannot derive the amount from caller
  input.
- Live PostgreSQL verification returned commercial lock `false`, released
  authority `50000` paise, one release row, and one matching release audit
  event.
- Unit, PostgreSQL integration, browser, supervisor restart, isolated restore,
  dependency audit, Compose validation, and diff checks pass.
- The first approved zero-cost outreach effect
  `c870b24b-8b37-42ec-8d94-75d10519cde6` completed through Agent OS and
  AgentMail with a durable provider receipt. This release does not authorize
  unscoped spending, bulk outreach, account creation, contract acceptance, or
  payment collection.

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
2. The requested routed React/Vite frontend with desktop/tablet/mobile visual suite.
3. Credentialed Hermes-to-Agent-OS live command/MCP proof using Hermes' existing integration facilities.

All 18 mechanical P0 rows are now PASS. The reviewed Hermes completion hook is
allowlisted and healthy, and the owner supplied the exact live Telegram
Agent OS status response. The first bounded operating-tranche request may now
be created, but commercial lock and released authority remain unchanged until
the owner explicitly approves that request.

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
reports Mem0 `mode: platform`; ADR 0004 adopts Mem0 Cloud plus curated Markdown
for this initial release, but no owner-scoped Cloud acceptance evidence exists
yet. Revenue release is also blocked by private HTTPS, controlled channel delivery-receipt acceptance (the
configured Telegram home chat currently reports `Chat not found`) and the
broader command-centre visual workflow matrix. Commercial lock remains on.

## Hybrid contextual-memory evidence — 2026-07-29

- The initial release architecture is now PostgreSQL authoritative state, Mem0
  Cloud scoped semantic context, and explicitly promoted curated Markdown.
  ADR 0004 records why this replaces the older preferred self-hosted-Mem0
  deployment for the initial release.
- `npm test` passes with 30 tests and one intentional opt-in integration skip:
  it proves mode-0600 Markdown records under mode-0700 directories, required
  frontmatter, PostgreSQL mutation audit/provenance, cross-owner and
  cross-scope denial, de-duplication, Cloud-outage degradation, and disposable
  archive recovery into a temporary semantic provider.
- `npm run test:integration` applies migrations 001–009 in a disposable
  PostgreSQL database. `npm run test:restore` verifies PostgreSQL and curated
  Markdown archive checksums, restores the latter privately, and validates the
  isolated replacement database.
- `npm run test:mem0` now passes using the configured secret injection and a
  disposable owner/scope. It proves async event completion, scoped CRUD,
  cross-owner/cross-scope denial, cleanup, provider-ID provenance in
  PostgreSQL, and immutable mutation audit evidence. The scoped-memory row is
  **PASS**. Semantic memory remains contextual only and cannot alter
  authorization, approval, financial, effect, or control decisions. No new
  readiness gate was created.

## Private dashboard access evidence — 2026-07-29

- Agent OS now binds only to `127.0.0.1:9999`; PostgreSQL remains unexposed.
- Tailscale Serve privately terminates HTTPS at
  `https://razor-crest.tail4792a2.ts.net:8443/` and proxies only to the
  loopback dashboard. No public Funnel route is configured.
- A Tailscale-addressed HTTPS health probe and authenticated dashboard request
  both returned successfully. The broader routed React/Vite responsive visual
  suite remains separate missing evidence, so no P0 row is marked PASS.

## External-effect crash-boundary evidence — 2026-07-29

- `npm run test:integration` now runs a disposable local HTTP provider with
  provider-side idempotency. A child process commits the effect as `executing`,
  receives the provider acceptance, and is forcibly terminated with `SIGKILL`
  before it can persist a result.
- Recovery performs provider lookup only: it records the provider receipt,
  transitions the durable effect to `succeeded`, writes
  `external_effect_reconciled` audit evidence, and proves the provider accepted
  exactly one request. No real customer, payment, account, or message provider
  is contacted.
- The P0 row remains **PARTIAL** until all real production-provider callers use
  the same executor and have their own acceptance evidence.
