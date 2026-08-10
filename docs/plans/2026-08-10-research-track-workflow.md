# Research Track Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use shipyard:shipyard-executing-plans to implement this plan task-by-task.

**Goal:** Make incomplete revenue research easy to hand off, audit, and close without confusing research notes with Agent OS authorization.

**Architecture:** `RESEARCH_TRACK.md` remains the append-only queue; detailed evidence stays under `research/`; durable financial and approval truth remains in Agent OS PostgreSQL. `AGENTS.md` documents the handoff contract for every future operator.

**Tech Stack:** Markdown, Git, Agent OS MCP.

---

### Task 1: Document the queue contract

**Files:**
- Modify: `RESEARCH_TRACK.md`
- Modify: `AGENTS.md`
- Create: `research/README.md`

**Steps:**
1. Add a compact entry template, ownership/handoff rules, and close criteria.
2. Document the directory layout and the requirement to reconcile material results in Agent OS and the daily log.
3. Keep secrets and authorization claims out of the queue.

**Verification:** `git diff --check` and manual review of the rendered Markdown.

### Task 2: Record today’s account boundary and research candidates

**Files:**
- Modify: `RESEARCH_TRACK.md`
- Modify: `research/daily-revenue-log-2026-08-10.md`
- Modify: `CHANGELOG.md`

**Steps:**
1. Record the AuditPal terms-acceptance blocker and the exact configured inbox without storing credentials.
2. Record the read-only inbox reconciliation and current no-revenue result.
3. Preserve existing marketplace paths and do not create duplicate writes.

**Verification:** Agent OS status/approvals remain authoritative; no secrets appear in the diff.

### Task 3: Verify and publish

**Steps:**
1. Run `git diff --check`.
2. Run `npm run check` and `npm test`.
3. Commit and push the documentation-only change to `main`.

**Expected:** All checks pass, working tree is clean, and the pushed commit is reported in the daily log.
