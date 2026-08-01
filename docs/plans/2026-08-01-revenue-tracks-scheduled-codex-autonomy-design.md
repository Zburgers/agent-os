# Revenue Tracks, Scheduled Codex, and Autonomy Design

**Date:** 2026-08-01  
**Status:** Owner direction captured; ready for implementation planning

## Outcomes

1. The dashboard gains a dedicated **Revenue Paths** workspace that explains every money-making direction as a hierarchy of tracks, subtracks, ventures, experiments, objectives, tasks, assets, pipeline activity, costs, and outcomes.
2. The persisted Codex thread `019faa3e-b7af-7e13-8335-4f651c989e27` resumes every day at **09:00 Asia/Kolkata**, operates for at most one hour, and leaves a durable run summary visible in Agent OS.
3. Goofy may commit and push routine repository work without per-action owner approval.
4. The dedicated Goofy wallet may autonomously sign and transact within owner-approved platform policies. The owner's wallet remains separate and owner-controlled.

## Revenue Paths information model

Use a self-referencing `revenue_tracks` table. A top-level track describes a strategic route to revenue; child rows describe the workstreams within it. This avoids forcing every item into a venture and supports deeper nesting later without another schema redesign.

Initial top-level tracks should be editable, not hard-coded:

- **n8n / automation business**
  - Product and offer development
  - Buyer research and qualified outreach
  - Sales pipeline and follow-up
  - Delivery and reusable productization
- **Open-source leverage**
  - Contributions
  - Maintainer relationships
  - Sponsorship, support, and commercial upgrade opportunities
- **Software contracting**
  - Startup and agency opportunity discovery
  - Tailored applications/outreach
  - Owner handoff for interviews or identity-bound work
- **Bounties**
  - Discovery and qualification
  - Claiming
  - Building/submitting
  - Verification, payout, and postmortems

Each track stores owner, status, strategy, target customer, monetization model, current stage, confidence, priority, expected value, cost, revenue, next action, review date, success criteria, and kill criteria. Existing ventures, objectives, tasks, experiments, opportunities, leads, artifacts, decisions, jobs, and ledger entries receive an optional `track_id`. A track-detail query aggregates those records rather than duplicating their authoritative data.

The `/revenue-paths` dashboard page uses a compact tree/list on the left and a selected-path detail pane on the right. Each row shows stage, owner (`Goofy`, `Owner`, or joint), current action, progress signal, spend, settled revenue, and health. The detail pane answers: what is the thesis, what is happening now, what evidence exists, what is blocked, what gets handed to the owner, and what happens next. Filters cover active/paused/killed paths, owner-handoff items, venture, and stage. Empty paths are explicitly marked as proposed rather than displayed as active work.

## Scheduled Codex operating block

Use a user-level systemd timer, not raw cron. The host already supports user lingering and runs another user timer successfully. The timer uses `OnCalendar=*-*-* 09:00:00 Asia/Kolkata`, `Persistent=true`, and no random delay. A one-shot service invokes a checked-in TypeScript runner from `/home/goofy/agent-os`.

The runner must:

1. Acquire a non-blocking lock so manual and scheduled runs cannot overlap.
2. Check Agent OS pause/kill state and refuse to start when either is active.
3. Confirm the exact Codex session exists locally and matches the configured thread ID.
4. Create/claim an Agent OS job run before starting Codex.
5. invoke `codex exec resume 019faa3e-b7af-7e13-8335-4f651c989e27 <prompt> --json` using the `goofy` account and `/home/goofy/agent-os` as the working directory.
6. Give Codex roughly 58 minutes, send `SIGINT` for a graceful checkpoint, and reserve the remaining service time for summary/reconciliation. The systemd unit applies an absolute one-hour `RuntimeMaxSec` with a bounded forced-stop fallback.
7. Persist exit reason, timestamps, duration, Codex thread ID, structured event log location/checksum, last assistant message, Git before/after SHA, changed files, Agent OS activity IDs, cost/usage when available, and the next action. Never persist secrets or raw tool payloads.
8. Mark timeout as `timeboxed`, not failed, when the session checkpoint and summary were recorded successfully.

The scheduled prompt should explicitly say that this is the owner-authorized daily operating block; resume the existing goal; re-read authoritative Agent OS state; reconcile old blockers; continue the highest-value permitted work; use the dedicated wallet and Git under current standing policies; and persist a concise result/metric/lesson/next-action summary before the timebox ends.

The target thread was verified locally. Its goal was marked blocked on 2026-07-31 because approvals `ff5548d2-97a5-4ac2-b112-5e22aa9f6319` and `f51ca103-661d-496e-a8b2-906d44a393e3` were pending. Both are now approved and Agent OS reports no pending approvals, so the first scheduled prompt must tell the resumed session to reconcile current state instead of trusting the stale blocker.

Agent OS provides both a **Run now** action and **Pause schedule** action. Run now queues the same singleton job and never starts a second process. `/jobs` and the daily brief show the full daily result, timeout/failure reason, commits, track changes, money movement, approvals created, and next action.

## Dedicated wallet autonomy

The dedicated wallet becomes policy-autonomous rather than signature-by-signature owner-approved. The owner approves a platform policy once. A policy contains chain, provider/platform, allowed contract addresses or recipients, allowed operation/message types, function selectors where applicable, per-transaction value, daily value, total policy budget, gas ceiling, expiry/review date, and revocation state.

Within an active policy Goofy may authenticate, sign messages, sign transactions, submit, retry safely, and reconcile without another approval. Every operation still requires pause/kill checks, protected runtime signing, an immutable effect, idempotency, simulation for transactions, ledger/reserve attribution for value movement, policy/rate limits, and receipt reconciliation. Unknown platforms, chains, recipients, contracts, selectors, or value above policy limits require a new or amended platform policy. Receiving funds never requires approval. Owner withdrawals use the visible governed transaction path.

This grants broad control without granting access to the owner's MetaMask, bank, card, PayPal, recovery material, or signing session. It also does not allow key export, raw-signature persistence, speculative trading, gambling, leverage, sanctions evasion, contract acceptance, KYC impersonation, pause/kill bypass, or spending beyond durable financial limits.

## Repository autonomy

Goofy may create branches, edit files, commit, merge non-protected branches, push ordinary commits/tags, open/update pull requests, and maintain its own memory and documentation without owner approval. These actions remain audited and secret-scanned, but approval is not a prerequisite.

Force-pushing or deleting the default branch, deleting the repository, transferring ownership, changing repository visibility, weakening branch/security controls, publishing secrets, and accepting third-party legal terms remain outside routine repository authority. They require an explicit separately scoped owner action because they are irreversible, reputational, credential, or legal actions rather than ordinary Git work.

## Validation strategy

The scheduler is tested without contaminating the real conversation first: unit tests use a fake `codex` binary; integration tests use a disposable session fixture and short timeout; systemd units pass `systemd-analyze verify`; calendar behavior is checked with `systemd-analyze calendar`; overlap, pause, kill, timeout, restart, redaction, and reconciliation paths are exercised. After those pass, one owner-authorized live smoke run resumes the exact target thread with a tightly bounded prompt and verifies that a new turn lands on the same thread and observes the now-approved state. The smoke run must not be implemented as `codex resume` interactive mode.

Wallet changes require default-deny tests for every policy dimension, fork/local-node transaction simulation tests, duplicate submission tests, crash recovery, reserve enforcement, and explicit confirmation that owner-wallet endpoints remain unable to sign. Revenue Paths requires migration, aggregation, authorization, accessibility, responsive, and browser tests with real PostgreSQL-backed records.

