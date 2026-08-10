# the402 Buyer-Postings Scout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use shipyard:shipyard-executing-plans to implement this plan task-by-task.

**Goal:** Detect public the402 buyer postings in the existing revenue scout without treating seller services as buyer work.

**Architecture:** Add a pure normalizer for the public /v1/postings payload, preserving open/unassigned postings as marketplace opportunities. Add the endpoint as a read-only scout source; failures remain isolated by the existing Promise.allSettled behavior.

**Tech Stack:** TypeScript, Node test runner, public HTTPS JSON APIs.

---

### Task 1: Normalize buyer postings

**Files:**
- Modify: `src/market-scout.ts`
- Test: `test/market-scout.test.ts`

**Steps:**
1. Add a failing test for an open posting with budget, category, and requirements.
2. Run the focused test and verify it fails because no normalizer exists.
3. Implement the smallest pure normalizer, excluding closed/awarded postings and converting budget fields to USD.
4. Run the focused test and verify it passes.

**Verification:** `node --test --experimental-strip-types test/market-scout.test.ts`

### Task 2: Include the402 postings in the scout

**Files:**
- Modify: `src/revenue-market-scout.ts`
- Test: `test/revenue-market-scout.test.ts`

**Steps:**
1. Add a failing test asserting the postings endpoint is fetched and normalized.
2. Run the focused test and verify it fails.
3. Add the source fetch and source label with no external writes.
4. Run focused and full tests.
5. Append evidence to the daily revenue log/changelog and commit/push.

**Verification:** `npm test` (or the repository's full Node test command) passes.
