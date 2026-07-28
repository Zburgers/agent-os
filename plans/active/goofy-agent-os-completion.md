# Goofy Agent OS Completion Plan

Last updated: 2026-07-28

## Operating constraints

- PostgreSQL is authoritative for money, permissions, approvals, tasks, jobs, audit, and operational state. Mem0 is contextual only.
- Commercial lock remains enabled. No spending, outreach, payment collection, account creation, or contract acceptance is permitted until P0 readiness evidence passes and the owner approves a tranche.
- All owner and agent actions use the same audited backend. No autonomous operational work is allowed without a durable objective, ticket, experiment, job, or incident.

## Baseline evidence

- Existing implementation: Node/TypeScript HTTP service, PostgreSQL migrations, initial Command Centre, session auth, partial entity CRUD, immutable ledger/audit triggers, a policy-gated ledger service, a one-shot durable-job worker, and parser-only Telegram handling.
- `plans/active/agent-os-readiness.md` records the prior audit: all P0 areas are PARTIAL, FAIL, or unproven; revenue operations are **not ready**.
- Worktree was clean before this implementation sequence. No external commercial action has been taken.

## Milestones

| # | Milestone | Status | Acceptance criteria | Verification commands | Relevant files | Tests | Dependencies / blockers | Completion evidence | Next executable task |
|---|---|---|---|---|---|---|---|---|---|
| 0 | Governance, inventory, and live plan | Complete | Constitution read; repository and existing implementation inspected; this plan records every milestone and is updated per implementation milestone. | `git status --short`; `npm test`; `npm run check` | `AGENTS.md`, `AUTONOMOUS_REVENUE_MISSION.md`, `plans/active/*` | Existing unit suite | None | Mission and code inspection completed; verification pending current run. | Add missing durable domain fields and constraints migration. |
| 1 | Authoritative domain model and unified ticket system | In progress | Migrations model all required ticket fields/states, venture/opportunity/experiment links, approval relationships, artifacts, comments, and immutable activity; backend validates and audits owner/agent parity. | `npm run migrate`; migration clean-db test; CRUD integration test | `db/migrations/*`, `src/tickets.ts`, `src/entities.ts`, `src/server.ts`, `src/db.ts` | Ticket/approval unit tests; CRUD and migration integration tests pending | PostgreSQL required for integration tests | Migration 005 applied in Compose; shared services and authenticated routes added. | Add live API integration coverage and remaining ticket detail reads. |
| 2 | Command Centre and operational UI | Not started | Responsive accessible navigation, detail pages, tables, filtering/search/paging, forms, dialogs, confirmations, feedback, empty/loading/error states. Every displayed value links to a source record and comes from PostgreSQL. | `npm run build`; browser critical-path suite; visual checks | `src/dashboard.ts`, `src/server.ts` | Browser and visual regression tests | Milestone 1 APIs | None | Build data contract and routes after domain migration. |
| 3 | Ventures, opportunities, objectives, and experiments | Not started | Research register, scorecards, venture economics, controlled experiments, two-primary-experiment concurrency guard, declared kill criteria and decisions are durable and controllable. | API/integration tests; browser workflow | `src/entities.ts`, migrations, dashboard | Entity/experiment/concurrency tests | Milestone 1 | None | Expand venture and experiment CRUD. |
| 4 | Append-only financial operations | Partial | Ledger captures all required metadata; capital/reserves/budgets/receipts/reconciliation pages work; proposed-to-approved expense path is policy and approval gated; corrections append reversals only. | Finance integration tests; migration checks | `src/finance.ts`, migrations, server/dashboard | Ledger immutability, calculations, limits, reserve, idempotency tests | Milestone 1, approvals | Existing unit tests cover only selected policy cases. | Add missing ledger metadata and financial read APIs. |
| 5 | Approval inbox and Telegram owner control | In progress | Full request/approve/reject/modify/comment/expire/cancel/dedupe lifecycle with immutable decision history; precision escalation payload; strict Telegram allowlist and audited command/webhook handling. | Approval and Telegram integration tests | `src/approval-token.ts`, `src/telegram.ts`, `src/server.ts`, migrations | Lifecycle, expiry, owner restriction, idempotency tests | Milestone 1; Telegram credentials only for live delivery | Parser/token units exist; no lifecycle/transport. | Implement approval transition service. |
| 6 | Durable jobs and autonomous supervisor | Partial | Scheduler/worker claims and recovers durable runs; retry/dead-letter/pause/cancel/rerun/idempotency enforced; supervisor selects bounded evidence-backed work and resumes after restart without chat state. | Restart/retry/idempotency integration tests | `src/jobs.ts`, `src/worker.ts`, migrations | Job, recovery, duplicate-effect, policy tests | Milestones 1, 3–5 | One-shot internal worker exists; no supervisor/handlers. | Add schedules, run records, job controls, and handlers. |
| 7 | Memory, health, controls, backups, and security | Partial | Scoped Mem0 adapter with safe fallback/metadata/health; server-enforced pause/kill at every effect boundary; health views; backup scheduler and proven isolated restore; audit and redaction coverage. | Memory/health/backup/restore/security integration tests | `src/memory.ts`, `src/policy.ts`, scripts, compose, migrations | Scope, redaction, pause/kill, restore tests | Mem0 service/config for live provider | PostgreSQL fallback and basic policy/redaction units exist. | Define provider interface metadata and central side-effect guard. |
| 8 | End-to-end release verification | Not started | Lint/type check, unit/integration/migration/backup/restore/browser/visual suites pass; P0 report contains exact evidence and gaps. | Full CI command set in `package.json` | all | All required suites | Milestones 0–7 | None | Establish test harness and run baseline. |
| 9 | Revenue operations gate | Blocked by P0 | After P0 passes, create readiness report and approval for first operating tranche; Telegram duplicate request; wait for explicit approval. | Readiness report verification | approvals, Telegram, plans | Browser approval path | Explicit owner approval required | Commercial lock remains on. | Do not execute until milestone 8 passes. |
| 10 | Evidence-backed revenue operations | Blocked by milestone 9 | Inventory resources; research and score multiple lawful opportunities; select bounded experiment; operate through durable records and evaluate realised profit. | Experiment/ledger/audit evidence | ventures, experiments, jobs, ledger | End-to-end controlled experiment | P0 readiness + owner approval | No commercial operation initiated. | Await release gate. |

## Decisions

1. Preserve the current server-rendered restrained dark Command Centre during control-plane work; do not replace it with a decorative frontend framework before authoritative routes and tests exist.
2. Treat the existing readiness audit as evidence of incompleteness, not proof of readiness. No commercial lock release is in scope.
3. Prioritise schema contracts and backend parity before dashboard expansion, because visual controls without durable, authorised operations would violate the mission.

## Current blockers

- No P0 release evidence exists; commercial lock must remain in effect.
- PostgreSQL/Mem0/Telegram runtime availability and browser-test tooling have not yet been verified in this implementation run.
- Live Telegram delivery and Mem0 provider testing will require configured services/credentials, but their absence does not block safe local implementation.

## Current completion evidence

- Complete mission read and baseline source/schema/test inspection performed on 2026-07-28.
- No code changes or external side effects before the plan was created.

## Next executable task

Create migration `005_unified_operations.sql` to extend the durable schema for ticket detail/dependencies/comments/activity, approval lifecycle, entity linkage, jobs, and operational health without weakening existing immutable financial/audit controls; then implement the matching validated backend operations and tests.
## Implementation update — 2026-07-28

- Added and applied migration `005_unified_operations.sql` inside the Compose application container. It extends ticket, approval, job, ledger-linkage, activity, and health records without altering immutable ledger/audit triggers.
- Added transactionally audited `ApprovalService` and `TicketService`, with unit tests. Server routes now expose authenticated owner ticket create/transition/comment/dependency operations and approval action transitions.
- `npm test`, `npm run check`, and `git diff --check` pass after the additions. Host-side migration remains intentionally unavailable because PostgreSQL has no host port; in-container migration succeeded.
- Remaining gap: routes need integration/browser coverage and dashboard controls; no readiness milestone is complete and commercial lock remains enforced.

## Next executable task

Rebuild Compose from the updated source, smoke-test the authenticated server routes against PostgreSQL, then add integration tests before expanding dashboard detail pages.

## Implementation update — runtime parity

- Added optional `AGENT_RUNTIME_TOKEN` plumbing to Compose and `.env.example`. When configured, it authenticates the durable backend as `goofy-runtime`; ticket activity/audit events then retain agent attribution. Owner session/bearer authentication remains unchanged.
- Approval state transitions remain owner/Telegram-only by service policy; an agent may not self-approve.
- The token is intentionally not generated, printed, or added to the active environment during this run. Agent-authenticated live-route verification therefore remains pending configuration.
- Current verification: `node --check src/*.ts`, `npm run check`, `npm test`, and `git diff --check` pass; Compose was healthy after migration 005 prior to this source/config increment.

## Next executable task

Rebuild Compose with the runtime parity changes, then implement PostgreSQL-backed overview/detail read APIs and dashboard links for tickets, approvals, finance, jobs, and activity before browser workflows.

## Implementation update — dashboard state correction

- The Command Centre overview now selects `blocked` and `waiting_for_owner` tickets, matching migration 005 instead of the removed legacy states.
- Milestone 0 is complete: mandatory mission, repository, schema, core runtime, and baseline test inspection were performed and the live plan was created before implementation.
- Milestones 1 and 5 remain in progress: their unit coverage passes, but PostgreSQL route integration, full CRUD/detail UI, Telegram transport, and browser verification are still missing.

## Next executable task

Rebuild the container for the ticket-state query correction, then implement authenticated paginated detail/read APIs (tickets, approvals, finance, jobs, activity) and cover them with PostgreSQL integration tests.

## Implementation update — PostgreSQL integration and read parity

- Added `test/postgres-integration.test.ts`: an opt-in test run against a fresh Compose database applies migrations 001–005, persists and transitions an agent ticket, verifies its immutable activity/audit records, verifies approval rejection and history, verifies agent self-approval is refused, verifies ledger immutability, and checks paginated ticket plus ticket/approval detail reads.
- First integration attempt exposed a real PostgreSQL placeholder type conflict in `TicketService.activity`; the binding was repaired and the clean-database test then passed.
- Added `src/records.ts` and authenticated API reads: `GET /api/tickets` supports status/search/limit/offset; `GET /api/tickets/:id` and `GET /api/approvals/:id` return linked durable details.
- The disposable `goofy_integration` database was deleted after the successful run. The operational Compose app and PostgreSQL service are healthy.

## Next executable task

Build the dashboard work-board and record-detail views from these APIs, with search/filter/pagination, accessible forms, activity timelines, and browser-level owner workflow coverage.

## Implementation update — shared dashboard ticket path

- Added `npm run test:integration`, which provisions, migrates, tests, and removes a disposable Compose PostgreSQL database. The command passed after verifying migrations 001–005 and durable ticket/approval/ledger behaviour.
- Dashboard creation now posts to `/api/tickets`, and its live work list refreshes from the paginated shared ticket API rather than the legacy task list. The ticket-state selector covers all nine required board states.
- Rebuilt Compose after this change; `/healthz` returned `200` with database health `ok`.
- This is still not browser-level verification: forms, pagination controls, ticket detail view, and dashboard financial/approval/job detail pages remain implementation work.

## Next executable task

Add a dashboard work-board with status/search filters, pagination, clickable ticket detail/audit view, and owner ticket transition/comment controls; then add browser-level coverage for the owner creates-venture/objective and Goofy-creates-ticket path.

## Implementation update — complete approval request envelope

- Replaced the raw approval insert route with `ApprovalRequestService`. It validates precise request fields, cost/exposure, currency, expiry, alternatives, evidence, default action, blocker, and related objective/venture/experiment/ticket identifiers.
- Requests and idempotent repeats now write immutable approval-event and audit records transactionally. The owner and configured runtime agent use this same route; only approval decisions remain restricted to owner/Telegram policy.
- Added unit coverage for valid requests, deduplication, and invalid expiry. Expanded the disposable PostgreSQL test to prove request persistence and deduplication.
- Verification after rebuilding: `npm run test:integration` passed, `npm test` passed (16 passed, 1 opt-in skipped), `npm run check` passed, `git diff --check` passed, and Compose is healthy.

## Next executable task

Implement owner ticket inspection and controls in the dashboard: status/search filters, pagination, ticket detail/activity panel, comment and transition actions; add browser-level coverage before calling the work-board milestone complete.

## Implementation update — durable ticket edit parity

- Added `TicketService.update`, the shared owner/agent operation for editing ticket title, description, parent and related records, priority/value/effort/cost fields, assignee/worker, blocker, acceptance and verification evidence. Every successful edit emits immutable activity and audit records in the same transaction.
- `PATCH /api/tickets/:id` now uses that edit operation when no state transition is requested; status transitions continue through the state-specific audited operation. This retains a single PostgreSQL-backed work model for owner and authorised agent callers.
- Added unit coverage for an agent edit and persistent PostgreSQL integration coverage for edit persistence; the integration suite confirms edited title, priority, actual effort, and activity timeline length after a fresh migration.
- Defined `npm run build` as the repository's artifactless TypeScript-runtime validation (`npm run check`). This project executes TypeScript directly with Node's stripping runtime; no bundler artifact exists.
- Verification on 2026-07-28: `npm test` passed 17 tests with 1 intentional opt-in integration skip; `npm run check` passed; `npm run build` passed; `npm run test:integration` passed after applying migrations `001`–`005` to a disposable PostgreSQL database.

## Next executable task

Implement the dashboard work-board controls already identified above (filters, pagination, detail/audit inspection, comments, transitions, and full edit form), then add browser-level authenticated owner/agent critical-path tests. The system remains not ready for revenue operations.

## Implementation update — current-run inspection (2026-07-28)

- Re-read the governing mission, constitution, financial, approval, memory, operating, security, runbook, incident, and existing readiness documents before changing implementation.
- Inspected the uncommitted control-plane worktree, migrations, server routes, shared ticket/approval services, dashboard, durable job worker, integration suite, and browser harness. The browser harness now exists but must be executed against its disposable PostgreSQL database before it can count as evidence.
- The worktree contains prior implementation changes; they are preserved. Commercial lock remains enabled and no external commercial effect has been initiated.

## Next executable task

Run the complete current verification baseline, including the disposable browser work-board workflow. Repair any failure before extending the next authoritative dashboard detail API/page.

## Implementation update — deployed work-board controls

- Added `src/workboard.ts` and mounted it in the restrained Command Centre. It reads the existing shared ticket API and supplies status/search filters, pagination, empty/error states, accessible ticket detail, edit form, comment form, activity timeline, and a confirmation before state changes.
- The component uses `GET /api/tickets`, `GET /api/tickets/:id`, `PATCH /api/tickets/:id`, and `POST /api/tickets/:id/comments`; it does not create an owner-only work path. Server-side authorisation, CSRF, and immutable ticket activity/audit records remain the enforcement boundary.
- A deployment rebuild initially failed because the new module lacked a closing brace. Direct module parsing exposed it; the brace was repaired. `npm run check` now parses every `src/*.ts` file individually instead of passing an unhelpful shell glob to one Node invocation.
- Added `test/workboard.test.ts` for the render contract. A local Chromium DevTools owner-session run against the deployed Compose service confirmed `work:true`, `filters:true`, `board:true`, and `page:true`. The container then served `/healthz` with `status: ok` and database health `ok`.
- Verification on 2026-07-28: `npm test` passed 18 tests with 1 intentional opt-in integration skip; `npm run check`, `npm run build`, `npm run test:integration`, and `git diff --check` passed. The clean integration database applied migrations `001`–`005` successfully.

## Next executable task

Add a repeatable browser workflow that performs ticket inspection/edit/comment/transition against an isolated database, then extend the Command Centre financial, approval, jobs, health, and controls pages with linked authoritative detail records. Revenue operations remain locked.

## Implementation update — operator identity and continuity

- Recorded the owner's current intent for Goofy: operate as a pragmatic, direct autonomous digital-business operator that tests lawful ways to make money from a very small budget, without fixating on one hustle and without pretending unverified progress is revenue.
- Added `GOOFY_IDENTITY.md` for stable operating identity, style, long-term goal, escalation posture, and identity boundaries.
- Added `OPERATOR_SCRATCHPAD.md` for durable cross-session context, current owner intent, likely future owner inputs, current readiness blocker, and next engineering action.
- Linked both files from `OPERATING_POLICY.md` and `RUNBOOK.md` while preserving `AGENT_CONSTITUTION.md` as non-editable constitutional control.
- Saved the owner's identity/goals/preferences to persistent Mem0 memory for future retrieval.
- Latest verification note: the broad baseline reached `npm test`, `npm run check`, and `npm run test:integration`, but `npm run test:browser` failed because disposable database `goofy_browser_workboard` was still being accessed by one session during cleanup. No commercial action occurred.

## Next executable task

Fix the browser workflow cleanup by terminating active disposable PostgreSQL sessions or closing application connections before `dropdb`; rerun `npm run test:browser`, then continue dashboard detail/control work. Revenue operations remain locked.

## Implementation update — AgentMail resource configured

- Added non-secret AgentMail operating notes at `docs/AGENTMAIL.md` with docs links, environment variable names, safe usage policy, and implementation TODOs.
- Added `AGENTMAIL_EMAIL` and `AGENTMAIL_API_KEY` placeholders to `.env.example`.
- Stored the provided AgentMail runtime secret in ignored `.env` with mode `0600`; the key was not written to tracked docs or Mem0.
- Verified AgentMail API reachability using `GET https://api.agentmail.to/v0/auth/me`; response was HTTP 200 and organization-scoped. Returned IDs were not recorded.
- Recorded that Telegram and Discord are already set up in the broader Goofy/Hermes environment, but external messaging still remains gated by the Agent OS approval/external-action policy.

## Next executable task

Add an AgentMail provider/health adapter that reads only runtime env vars, redacts failures, and exposes readiness status without send capability. Revenue operations and external email sending remain locked.

## Implementation update — browser workflow and CSRF repair (2026-07-28)

- Added the dashboard CSRF meta value consumed by the shared work-board client. This repaired a real owner mutation failure: the server correctly rejected ticket mutations when the client had no CSRF token.
- Hardened `scripts/test-browser-workboard.sh` to rebuild the current application image, verify authenticated session-to-DOM CSRF parity, wait for durable state rather than fixed delays, and prove ticket edit/comment/transition persistence plus owner-visible activity. It uses only a disposable database and container, both removed at exit.
- Verification: `npm test` (18 pass, 1 opt-in skip), `npm run check`, `npm run build`, `npm run test:integration`, `npm run test:browser`, and `git diff --check` passed. Browser result: `{ "title": "Browser work-board edited", "status": "validation", "comment": true, "activity": true }`.
- Milestones 1 and 2 remain in progress; finance, approvals, jobs, health, and controls lack linked detail pages. Commercial lock remains enforced.

## Next executable task

Add PostgreSQL-backed financial, approval, job, activity, and health record list/detail APIs with pagination and then expose the first linked authoritative dashboard detail page, with integration coverage before UI expansion.

## Implementation update — owner-requested AgentMail send test

- Owner explicitly requested a one-off email test to `ekagra7865@gmail.com` describing who Goofy is.
- Selected the configured `goofyboy@agentmail.to` inbox through AgentMail `GET /v0/inboxes`.
- Sent the test message through `POST /v0/inboxes/{inbox_id}/messages/send` with an idempotency key.
- Verification: AgentMail returned HTTP 200 with message and thread IDs. The API key was not printed or written to tracked files.
- This was a direct owner-requested test, not a general permission for autonomous outreach, signups, sales messages, or commercial email sends. Revenue operations remain locked.

## Implementation update — operations record APIs and dashboard panels (2026-07-28)

- Added authenticated read-only PostgreSQL record APIs for approval lists, ledger list/detail, job list/detail including runs/effects/logs, global activity, persisted health checks, and incidents. Existing ticket and approval detail APIs remain shared owner/agent control-plane reads.
- Added the Command Centre “Operations records” panel. It loads finance, approvals, jobs, health checks, incidents, and activity from those APIs and links ledger, approval, and job records to authoritative JSON detail endpoints. These are visibility/control-plane records only; no spending, outreach, payment collection, or commercial action was initiated.
- Extended the PostgreSQL integration suite to prove the new record APIs against a freshly migrated disposable database with fixtures for ledger, approvals, jobs, job runs/logs, health checks, incidents, and activity.
- Hardened `scripts/test-browser-workboard.sh` so the browser/CDP client closes cleanly and cleanup terminates lingering disposable database sessions before `dropdb`.
- Verification: `npm test` passed 19 tests with 1 intentional opt-in skip; `npm run check` passed; `npm run build` passed before the script-only cleanup fix; `npm run test:integration` passed against migrations 001–005; `npm run test:browser` passed with `{ "title": "Browser work-board edited", "status": "validation", "comment": true, "activity": true }`; `git diff --check` passed.

## Next executable task

Build first-class owner workflow pages/controllers for approvals, finance, jobs, and health controls: searchable list/detail UI, approve/reject/modify controls from the inbox, pause/cancel/rerun job controls, health/incident actions, and browser coverage for owner approval → exactly-once execution → ledger visibility. Commercial operations remain locked until P0 readiness is complete and explicitly approved.

## Implementation update — approval inbox controls (2026-07-28)

- Added owner-visible approval actions in the Command Centre operations panel for pending/modified approvals: approve, reject, and comment. They use the existing CSRF-protected `/api/approvals/:id/:action` backend, so approval decisions continue through the audited PostgreSQL approval state machine.
- Added render coverage proving pending approvals expose action controls. This is a dashboard control-plane improvement only; it does not autonomously approve spending or execute commercial effects.
- Verification after this increment: `npm test` passed 19 tests with 1 intentional opt-in skip; `npm run check` passed; `npm run test:browser` passed; `git diff --check` passed.

## Next executable task

Implement the first exactly-once execution path after approval: create a pending approval fixture tied to a controlled internal job/ledger proposal, approve it through the dashboard, execute one idempotent internal effect, append/link the resulting ledger record only through policy gates, and prove the full owner approval → exactly-once execution → ledger visibility browser path.

## Implementation update — full current-run audit and verification (2026-07-28T19:03Z)

- Re-read the complete `AUTONOMOUS_REVENUE_MISSION.md` and the constitution, approval, financial, memory, operating, security, runbook, incident, and readiness documents before assessing release status.
- Verified the live rootless Compose deployment: app and PostgreSQL are healthy; `curl http://127.0.0.1:9999/healthz` returned status `ok`, database `ok`, and the PostgreSQL-scoped memory fallback.
- Verified `npm test` passed 19 tests with 1 intentional opt-in integration skip; `npm run check`, `npm run build`, and `git diff --check` passed.
- Verified `npm run test:integration` passed against a disposable database with migrations 001–005 and persistent ticket, approval, ledger immutability, jobs, health, incidents, and activity assertions.
- Verified `npm run test:browser` passed with authenticated session creation, CSRF parity, ticket create/edit/comment/transition, and visible activity evidence.
- Updated `plans/active/agent-os-readiness.md` with the evidence-backed release matrix. The matrix remains P0 `PARTIAL`/`FAIL` across all required gates; this is not a revenue-ready release.
- Confirmed no commercial side effect was initiated by this audit. The operating tranche remains locked.

## Current status by business-readiness layer

- Local runtime foundation: **working**.
- PostgreSQL migration and durable-record foundation: **working in tested paths**.
- Owner session and work-board critical path: **working in tested paths**.
- Approval request/lifecycle backend: **partially working; not yet connected to a complete exactly-once financial effect path**.
- Financial policy: **partially working; not released for real spending**.
- Autonomous supervisor/restart recovery: **not complete**.
- Telegram controls: **not complete**.
- Mem0: **not complete**.
- Backup/restore: **not verified**.
- Complete internal experiment loop: **not complete**.
- Revenue operations: **blocked by P0 readiness and explicit owner tranche approval**.

## Revised next executable sequence

1. Build the durable supervisor and restart-recovery integration test; keep the worker from being a one-shot process.
2. Implement the controlled internal approval → idempotent effect → policy-gated ledger path and test it through PostgreSQL and the browser.
3. Add central pause/kill enforcement at every side-effect boundary and prove it with negative tests.
4. Implement Telegram transport and owner-only control/notification handling.
5. Implement scoped Mem0 provider operations plus backup/restore verification.
6. Re-run the full release matrix and request explicit owner approval only if every P0 requirement is PASS.

Do not start revenue experiments, external outreach, payment collection, account creation, or spending while these gates remain incomplete.

## Implementation update — durable supervisor, effect intents, and opening finance (2026-07-29)

- Added migrations `006_effect_intents_and_supervisor.sql` and `007_opening_capital_baseline.sql`.
- Compose now runs an always-on supervisor with durable heartbeats, worker-attributed claims, bounded retries, graceful shutdown, abandoned-run recovery, and an actual database-backed health check.
- Added the shared `authorizeEffect` transaction boundary and durable effect states: `proposed`, `authorized`, `executing`, `succeeded`, `failed`, `reconciliation_required`, and `cancelled`. External effects require an unexpired approval of the matching kind, receive a stable provider idempotency key, and ambiguous call outcomes cannot be retried blindly.
- Recorded the owner-confirmed opening position as historical entries with explicitly unknown original transaction dates: INR 5,000 capital contribution, INR 2,000 settled fixed Codex infrastructure expense, INR 3,000 current cash, INR 2,000 reserve, and INR 0 released authority. Capital remains excluded from revenue.
- Clean-database integration coverage proves the opening calculations, lease recovery, one internal effect, idempotent duplicate authorization, approval denial, and ambiguous external reconciliation. The deployed app, PostgreSQL, and supervisor are healthy.

## Next executable task

Route all remaining effect producers through `authorizeEffect`, add an approved internal effect-to-ledger workflow and crash-boundary restart test, then implement Telegram owner controls. Commercial operations remain locked.

## Implementation update — production-hardening pass (2026-07-29)

- Added migration 008 and the shared actor context. Denied effects are durable; commercial lock and credential scope are checked in the locked authorization transaction.
- Routed supervisor internal work through the effect boundary and added recurring occurrence keys plus owner-only cancel/pause/rerun controls.
- Added owner-only, secret-authenticated Telegram webhook controls with allowlist audit and destructive confirmation; live relay delivery still needs owner-managed credentials.
- Added scoped memory CRUD, complete metadata fields, scope-enforced update/delete, expiry, soft delete, health, audit, and secret rejection. Self-hosted Mem0 remains unproven.
- Added checksummed, retained, restrictive backups and refusal-safe isolated restore verification.
- Executed the complete zero-cost internal experiment successfully.
- Confirmed Hermes already supplies channels, hooks, MCP, skills, and Mem0. Removed the temporary duplicate plugin scaffold and retained only Agent OS-side integration boundaries.
- Full local unit/build/integration/browser/restart/restore/dependency/Compose checks pass. Commercial lock, ₹0 released authority, ₹2,000 reserve, and ₹0 revenue are unchanged.

## Hermes integration completion — 2026-07-29

- Registered the authenticated Agent OS MCP server through Hermes' existing MCP
  configuration; all eight tools are live and discoverable.
- Installed a fail-closed native Hermes `pre_tool_call` guard. The production
  commercial lock blocks risky terminal/browser/message/deployment/payment
  calls before provider execution.
- Added and validated the native `/os` operational skill without creating a
  plugin or marketplace.
- Reused Hermes' active Mem0 provider and existing Telegram/Discord gateway.
  Agent OS keeps PostgreSQL authority and scoped memory-reference policy.
- Restarted the Hermes gateway and verified its MCP child, hook health, skill,
  and active Mem0 status.

Remaining human/environment acceptance work is private HTTPS and correction of
the configured Telegram home-chat target before a controlled delivery-receipt
test. A live message was deliberately not sent as a test. External commercial
effects remain locked and no tranche request exists.
