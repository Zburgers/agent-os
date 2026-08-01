# Revenue Tracks, Scheduled Codex, and Autonomy Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use shipyard:shipyard-executing-plans to implement this plan task-by-task.

**Goal:** Add a clear hierarchical revenue-path workspace, a verified daily 09:00 IST one-hour Codex goal runner, autonomous routine Git authority, and allowlisted dedicated-wallet transaction autonomy.

**Architecture:** PostgreSQL remains authoritative. A self-referencing track hierarchy links existing business records without duplicating them. A user-level systemd timer launches a singleton, audited Codex runner which resumes one exact thread and reconciles results into Agent OS. Wallet and Git autonomy are standing policies enforced outside the model.

**Tech Stack:** Node.js/TypeScript, PostgreSQL migrations, existing server-rendered dashboard, Codex CLI 0.146.0, systemd user services/timers, Node test runner, Docker Compose integration tests.

---

## Binding implementation decisions

These decisions are part of the specification. Do not substitute a different architecture without asking the owner first.

1. **Runnable artifact:** this file is the runnable plan. The companion design document is context, not a second plan.
2. **Execution branch:** create `feat/revenue-paths-codex-autonomy` from current `main` in an isolated worktree. Preserve unrelated changes; never rewrite history.
3. **Migration order:** use `018`, `019`, and `020` exactly as assigned. If any number is already used, stop and ask the owner instead of silently renumbering.
4. **Scheduling authority:** systemd is the only clock/trigger. PostgreSQL is authoritative for configuration, occurrences, run state, results, and audit. Do not add a second interval scheduler.
5. **Configured thread:** store `019faa3e-b7af-7e13-8335-4f651c989e27` once in PostgreSQL job configuration. Environment override is test-only.
6. **Timebox:** start at 09:00:00 Asia/Kolkata; send the child `SIGINT` at 58 minutes; allow 60 seconds to exit; reconcile afterward. systemd uses `RuntimeMaxSec=1h`, `TimeoutStopSec=30s`, and `KillMode=mixed`. No child may survive the unit.
7. **Missed run:** `Persistent=true` permits one catch-up after downtime. The scheduled occurrence key is the intended IST date, so one date deduplicates. Manual Run now uses a UUID occurrence key. Only one block may run at once.
8. **Collision:** a colliding scheduled occurrence becomes `skipped/already_running`; a colliding manual request returns HTTP 409 and starts no process.
9. **Controls:** global pause/kill produces `skipped/control_paused` or `skipped/control_killed`. Schedule pause affects only future starts. Kill during execution interrupts the child within a maximum five-second polling interval.
10. **Codex command:** use an absolute preflight-resolved executable and an argument array equivalent to `codex exec resume <thread-id> <prompt> --json -o <mode-0600-file>`. Never use interactive resume, shell command construction, dangerous bypass flags, `--ignore-rules`, or `--ignore-user-config`.
11. **Logs:** raw JSONL belongs in an owner-only mode-0700 directory outside Git. PostgreSQL stores its path/checksum plus redacted bounded metadata. Never store raw tool arguments, environment variables, credentials, signatures, private keys, or model reasoning.
12. **Track vocabulary:** `status` is exactly `proposed | active | paused | completed | killed`; `owner_kind` is exactly `agent | owner | joint`; computed `health` is `on_track | at_risk | blocked | inactive`; `stage` is free text limited to 80 characters.
13. **Track money:** never persist derived spend/revenue/profit on tracks. Compute them from settled linked ledger entries.
14. **Track lifecycle:** archive via status; provide no destructive delete API. Reparenting must reject cycles and cross-scope parents.
15. **Initial mapping:** create the exact four top-level paths/children in the design. Link `Automation Reliability Sprint` only to `n8n / automation business`; link existing bounty experiments only to `Bounties`; leave uncertain records unlinked and report them.
16. **Wallet activation:** code and migrations create no active value-bearing policy. New policies default to `draft`; the authenticated owner explicitly activates the first policy. Receiving funds remains allowed.
17. **Wallet mutation:** policies are immutable versions. Editing creates a superseding draft. Owner-authenticated activation/revocation is audited. Agent operations inside an active policy require no per-operation approval.
18. **Git authority:** routine commit/push/branch/tag/PR operations are autonomous and audited. Repository deletion/transfer/visibility changes, default-branch force-push/deletion, secret publication, security-control weakening, and legal acceptance remain excluded.
19. **Smoke authorization:** the owner authorizes one non-side-effecting live resume smoke turn. It may not message, spend, deploy, create accounts, sign, transact, or change external state. Enable the timer only after it passes.
20. **Ambiguity:** inspect local code, tests, migrations, Git history, Codex help, and Agent OS state first. If uncertainty remains and a choice changes security boundaries, financial authority, external effects, migration semantics, public behavior, or owner-wallet separation, stop before that task and ask the owner one explicit question. Never guess. Ordinary internal details consistent with this spec do not require confirmation.

## Task 0 — Preflight and baseline

**Files:**
- Read only: `AGENTS.md`, `AUTONOMOUS_REVENUE_MISSION.md`, all governance files, relevant source/tests/migrations, and both plan documents

**Steps:**
1. Read governing instructions completely. Inspect Git state/history, migration numbers, package scripts, Codex version/help, systemd user/linger state, Agent OS controls/jobs/approvals/tasks/activity, and target-session metadata without printing sensitive conversation content.
2. Confirm migrations `018`–`020` are unused, `codex exec resume` is supported, the exact session exists, controls are not paused/killed, and the historical blockers are no longer pending.
3. Create `feat/revenue-paths-codex-autonomy` in an isolated worktree. If the baseline is dirty or tests fail, stop and report evidence before editing.
4. Run `npm test`, `npm run build`, `npm run test:integration`, `npm run test:browser`, `npm run test:restart`, and `npm run test:restore`. Record exact results and do not blame pre-existing failures on this work.
5. Commit nothing during preflight.

## Phase 1 — Revenue Paths

### Task 1: Add the hierarchical track schema

**Files:**
- Create: `db/migrations/018_revenue_tracks.sql`
- Modify: `src/entities.ts`
- Test: `test/postgres-integration.test.ts`

**Steps:**
1. Add a failing PostgreSQL test covering parent/child tracks, cycle prevention, optional links from existing operational tables, indexes, and audit triggers.
2. Run `npm run test:integration` and confirm the new assertions fail because `revenue_tracks` does not exist.
3. Add `revenue_tracks` with `parent_track_id`, business metadata, status/stage constraints, owner kind, financial/reporting fields, review/kill criteria, timestamps, and a recursive cycle-prevention trigger. Add nullable indexed `track_id` foreign keys to ventures, objectives, tasks, experiments, opportunities, leads, artifacts, decisions, jobs, and ledger entries.
4. Add TypeScript entity types without creating a second source of truth for aggregate metrics.
5. Run `npm run test:integration`; expect all PostgreSQL integration tests to pass.
6. Commit: `feat: add hierarchical revenue track model`.

### Task 2: Add track queries and mutation services

**Files:**
- Create: `src/revenue-tracks.ts`
- Modify: `src/records.ts`
- Test: `test/revenue-tracks.test.ts`

**Steps:**
1. Write failing tests for create/update/reparent/archive, cycle rejection, tree ordering, selected-track aggregation, owner handoff counts, and settled financial totals.
2. Run `node --test --experimental-strip-types test/revenue-tracks.test.ts`; expect module/import failure.
3. Implement parameterized service methods with actor attribution, validation, transactions, and audit events. Compute metrics from linked authoritative tables.
4. Re-run the targeted test; expect pass.
5. Commit: `feat: add audited revenue track services`.

### Task 3: Expose authenticated Revenue Paths APIs

**Files:**
- Modify: `src/server.ts`
- Modify: `src/auth.ts`
- Test: `test/revenue-tracks-api.test.ts`

**Steps:**
1. Add failing tests for authenticated owner reads, agent-scoped mutations, idempotency, invalid parents, and unauthorized access.
2. Run the targeted test and confirm failure on missing routes.
3. Add `/api/revenue-tracks`, `/api/revenue-tracks/:id`, and scoped mutation routes using the new service and existing actor/idempotency conventions.
4. Re-run the targeted test; expect pass.
5. Commit: `feat: expose revenue paths api`.

### Task 4: Build the Revenue Paths dashboard

**Files:**
- Create: `src/revenue-paths-page.ts`
- Modify: `src/dashboard.ts`
- Modify: `src/server.ts`
- Test: `test/revenue-paths-page.test.ts`
- Test: `test/browser-revenue-paths.test.ts`

**Steps:**
1. Add failing contract and browser tests for hierarchy, filters, selected-path detail, owner handoff, live metrics, empty/proposed state, keyboard navigation, and mobile layout.
2. Run targeted tests; expect missing page/route failures.
3. Implement `/revenue-paths` with compact tree/list navigation and detail pane. Render only real stored data and distinguish proposed from active paths.
4. Re-run targeted tests and visual/browser checks; expect pass.
5. Commit: `feat: add revenue paths workspace`.

### Task 5: Seed current paths from authoritative work

**Files:**
- Create: `scripts/bootstrap-revenue-tracks.mjs`
- Test: `test/revenue-track-bootstrap.test.ts`

**Steps:**
1. Add a failing idempotency test using current venture/task fixtures.
2. Implement a repeatable bootstrap that creates the four agreed top-level paths and subpaths, then links existing records by explicit stable mapping; never infer or overwrite an existing link silently.
3. Run the script twice against disposable PostgreSQL and assert identical state.
4. Emit a machine-readable report of linked and deliberately unlinked record IDs; assert uncertain records remain unlinked.
5. Commit: `data: organize current work into revenue paths`.

## Phase 2 — Daily Codex Goal Runner

### Task 6: Add scheduled-run persistence

**Files:**
- Create: `db/migrations/019_codex_operating_blocks.sql`
- Modify: `src/entities.ts`
- Test: `test/postgres-integration.test.ts`

**Steps:**
1. Add failing tests for one run per occurrence, allowed terminal states (`completed`, `timeboxed`, `failed`, `skipped`, `cancelled`), thread ID, timestamps, checksums, Git SHAs, redacted summary, and links to the Agent OS job/run.
2. Apply the migration with append-only completed-run evidence and uniqueness constraints.
3. Run `npm run test:integration`; expect pass.
4. Commit: `feat: persist codex operating blocks`.

### Task 7: Implement the singleton Codex runner

**Files:**
- Create: `scripts/run-codex-operating-block.mjs`
- Create: `src/codex-operating-block.ts`
- Test: `test/codex-operating-block.test.ts`
- Test: `test/fixtures/fake-codex.mjs`

**Steps:**
1. Write failing tests for exact session selection, non-interactive `exec resume`, prompt construction, working directory, lock contention, pause/kill skip, approved-stale-blocker reconciliation text, JSONL redaction, graceful 58-minute timeout, hard-stop fallback, exit mapping, and result persistence.
2. Confirm failure because the runner is absent.
3. Implement with `spawn` argument arrays (no shell), a non-blocking lock, an allowlisted absolute executable, bounded environment inheritance, a mode-0700 log directory, mode-0600 files, streamed JSONL parsing, secret redaction, checksums, five-second control polling, process-group cleanup, and signal/exception handlers.
4. Re-run targeted tests; expect pass.
5. Commit: `feat: add audited codex goal runner`.

### Task 8: Add the 09:00 IST systemd schedule

**Files:**
- Create: `systemd/goofy-agent-os-codex-goal.service`
- Create: `systemd/goofy-agent-os-codex-goal.timer`
- Modify: `RUNBOOK.md`
- Test: `test/codex-systemd.test.ts`

**Steps:**
1. Add failing static tests requiring `Type=oneshot`, exact `WorkingDirectory`, `RuntimeMaxSec=1h`, safe kill behavior, resource limits, `OnCalendar=*-*-* 09:00:00 Asia/Kolkata`, `Persistent=true`, and zero randomized delay.
2. Add hardened user units with the exact timebox/control values in the binding decisions and without dangerous bypass or ignore flags.
3. Run `systemd-analyze verify systemd/goofy-agent-os-codex-goal.service systemd/goofy-agent-os-codex-goal.timer`; expect no errors.
4. Run `systemd-analyze calendar '*-*-* 09:00:00 Asia/Kolkata'`; verify the next occurrence is 09:00 IST.
5. Commit: `ops: schedule daily codex goal at 09:00 IST`.

### Task 9: Add Run now, pause, and daily results UI

**Files:**
- Modify: `src/jobs.ts`
- Modify: `src/server.ts`
- Modify: `src/dashboard.ts`
- Modify: `src/daily-brief.ts`
- Test: `test/codex-operating-block-api.test.ts`
- Test: `test/codex-operating-block-page.test.ts`

**Steps:**
1. Add failing tests for singleton queueing, Run now, pause/resume schedule, active-run display, latest results, timeout labeling, commits/track/money/approval summaries, and authorization.
2. Implement APIs and dashboard panels using Agent OS job/effect conventions.
3. Run targeted tests; expect pass.
4. Commit: `feat: control and inspect codex operating blocks`.

### Task 10: Prove exact-thread resumption safely

**Files:**
- Create: `scripts/test-codex-resume-smoke.sh`
- Modify: `RUNBOOK.md`

**Steps:**
1. Pass all fake-binary, integration, redaction, systemd, pause/kill, overlap, and timeout tests first.
2. Validate locally that the target rollout file exists and its thread ID equals `019faa3e-b7af-7e13-8335-4f651c989e27` without printing conversation content.
3. Run one bounded live smoke turn with this exact prompt: `Owner-authorized scheduler smoke test. Resume this exact existing thread and inspect current authoritative Agent OS goal/control/approval state. Confirm whether the previously blocked goal can now resume. Do not modify files, Git, database state, services, accounts, wallets, deployments, or external systems; do not send messages or spend. Return only a concise state summary and next permitted action.` Cap at two minutes.
4. Verify the new event is appended to the same rollout/thread, no new session ID is created for the work, and Agent OS contains exactly one smoke run record.
5. Only after the smoke passes, install/enable the timer with `systemctl --user enable --now goofy-agent-os-codex-goal.timer` and verify it appears at 09:00 IST.
6. Commit: `test: verify exact codex goal resumption`.

## Phase 3 — Standing Autonomy Policies

### Task 11: Amend governance for routine Git autonomy

**Files:**
- Modify: `AUTONOMOUS_REVENUE_MISSION.md`
- Modify: `AGENT_CONSTITUTION.md`
- Modify: `OPERATING_POLICY.md`
- Modify: `APPROVAL_MATRIX.md`
- Modify: `SECURITY_MODEL.md`
- Modify: `integrations/hermes/skills/os/SKILL.md`
- Test: `test/policy.test.ts`
- Test: `test/hermes-git-policy.test.ts`

**Steps:**
1. Add failing policy tests establishing no owner approval for ordinary branch/commit/push/tag/PR/memory changes while retaining default denial for default-branch force-push/deletion, repository deletion/transfer/visibility change, secret publication, security-control weakening, and legal acceptance.
2. Add one dated owner-authorized amendment consistently across canonical governance and the OS skill. Require audit/effect records but no per-commit/per-push owner approval.
3. Update the Hermes pre-tool guard to recognize routine Git operations as agent-authorized effects with audit/idempotency but no approval ID.
4. Run targeted policy/guard tests; expect pass.
5. Commit: `policy: authorize autonomous repository operations`.

### Task 12: Add standing dedicated-wallet platform policies

**Files:**
- Create: `db/migrations/020_agent_wallet_platform_policies.sql`
- Modify: `src/agent-wallet.ts`
- Modify: `src/policy.ts`
- Test: `test/agent-wallet-policy.test.ts`
- Test: `test/postgres-integration.test.ts`

**Steps:**
1. Add failing default-deny tests for chain, provider, recipient/contract, message type, selector, transaction value, gas, daily/total budget, expiry, revocation, pause/kill, and idempotency.
2. Add immutable/versioned platform policies and operation-to-policy attribution. New versions default to `draft`; only authenticated owner action activates or revokes them.
3. Implement policy evaluation independent of model instructions. Unknown dimensions must deny with a stable policy code.
4. Run targeted and PostgreSQL tests; expect pass.
5. Commit: `feat: add standing agent wallet policies`.

### Task 13: Implement simulated wallet transaction execution

**Files:**
- Create: `src/agent-wallet-transactions.ts`
- Modify: `src/agent-wallet.ts`
- Modify: `src/server.ts`
- Test: `test/agent-wallet-transactions.test.ts`
- Test: `test/wallet-browser.test.ts`

**Steps:**
1. Add failing tests requiring immutable effect authorization, simulation, nonce handling, fee ceiling, ledger/reserve attribution, protected signer use, broadcast receipt, idempotent retry, ambiguous-outcome reconciliation, and raw-key/signature non-persistence.
2. Implement transaction draft, simulation, signing, submission, and reconciliation as explicit durable states. Do not broadcast publicly during tests or implementation without both an active owner-created policy and separate explicit live-test authorization.
3. Keep owner-wallet endpoints draft-only and prove they cannot call the dedicated signer.
4. Run targeted wallet tests; expect pass.
5. Commit: `feat: execute policy-authorized agent transactions`.

### Task 14: Amend wallet governance and dashboard controls

**Files:**
- Modify: `AUTONOMOUS_REVENUE_MISSION.md`
- Modify: `AGENT_CONSTITUTION.md`
- Modify: `FINANCIAL_POLICY.md`
- Modify: `APPROVAL_MATRIX.md`
- Modify: `SECURITY_MODEL.md`
- Modify: `MEMORY_POLICY.md`
- Modify: `docs/WALLET_PAYPAL_TAILSCALE.md`
- Modify: `integrations/hermes/skills/os/SKILL.md`
- Modify: `src/wallet-page.ts`
- Test: `test/agent-wallet-page.test.ts`
- Test: `test/policy.test.ts`

**Steps:**
1. Add failing tests for the dated owner amendment, separation from owner wallet, first-platform approval, autonomous in-policy operation, receiving funds, withdrawals through governed paths, revocation, and immutable audit history.
2. Update every canonical policy/document/skill consistently; do not introduce `COMPLETE autonomy` wording without its enforceable policy bounds.
3. Add owner UI for policy creation/versioning/revocation and agent-wallet operations/history.
4. Run policy and UI tests; expect pass.
5. Commit: `policy: authorize bounded dedicated wallet autonomy`.

## Phase 4 — System verification and delivery

### Task 15: Run the complete verification gate

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `ARCHITECTURE.md`
- Modify: `RUNBOOK.md`
- Modify: `README.md`

**Steps:**
1. Run `npm test`; expect zero failures.
2. Run `npm run build`; expect exit 0.
3. Run `npm run test:integration`; expect zero failures.
4. Run `npm run test:browser`, `npm run test:restart`, `npm run test:restore`, targeted redaction tests, and wallet simulation suites; expect zero failures.
5. Run `npm audit --audit-level=high`; expect no high/critical findings.
6. Run `systemd-analyze verify` for all checked-in units and verify the 09:00 IST calendar.
7. Run `git diff --check` and the repository secret scan; expect clean output.
8. Capture sanitized screenshots of `/revenue-paths`, the scheduled run detail, and the wallet-policy page. Include no session token, signature, secret, raw wallet operation, or customer personal data.
9. Update architecture, operations, and changelog documentation with verified behavior and rollback steps.
10. Commit: `docs: document revenue paths and autonomous operations`.

## Delivery order and safety gates

Implement in this order: Revenue Paths, scheduled runner with fake tests, exact-thread smoke test, routine Git policy, wallet policy engine, wallet transactions, final verification. Do not enable the live timer until exact-thread smoke validation succeeds. Do not enable value-bearing wallet transactions until simulation, ledger/reserve, effect, reconciliation, pause/kill, and owner-wallet-separation tests pass.

## Completion contract

Complete means: every task has an atomic commit; Task 15 commands pass freshly; the smoke test proves same-thread resumption; the enabled timer shows its next trigger at 09:00 IST; no duplicate scheduler exists; Run now collision behavior is proven; Revenue Paths uses live PostgreSQL data; routine Git no longer requests approval; no value-bearing wallet policy was silently activated; owner-wallet signing remains impossible; and tested rollback instructions exist. If any item is unproven, report the implementation as incomplete with exact evidence.
