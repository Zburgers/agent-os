# Account Observability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use shipyard:shipyard-executing-plans to implement this plan task-by-task.

**Goal:** Add a live, owner-authenticated Accounts page that inventories owned platform access without exposing raw credential material.

**Architecture:** Add PostgreSQL-owned account and credential metadata tables, a reconciliation service that inspects only safe runtime presence signals and authoritative public wallet state, authenticated read/register routes, and a shared control-plane page backed by the API.

**Tech Stack:** TypeScript, Node.js HTTP server, PostgreSQL migrations, server-rendered HTML with the existing inline control-plane client, Node test runner.

---

### Task 1: Safe account inventory model and discovery

**Files:**
- Create: `db/migrations/031_owned_account_observability.sql`
- Create: `src/account-inventory.ts`
- Test: `test/account-inventory.test.ts`

**Step 1: Write the failing tests**

Cover runtime discovery using only boolean presence and safe identifiers, protected-file existence without reading file contents, partial credential status, and rejection of secret-bearing registration fields. Cover the response shape and assert it has no raw secret field.

**Step 2: Run the focused test to verify it fails**

Run: `node --test --experimental-strip-types test/account-inventory.test.ts`

Expected: FAIL because `src/account-inventory.ts` and its public inventory helpers do not exist.

**Step 3: Write the minimal implementation**

Add the constrained tables with no secret-value columns and audit backstops. Add documented public types and helpers for safe runtime discovery, metadata validation, and `AccountInventoryService` reconciliation/list/register behavior. Use parameterized SQL and never read protected credential file contents.

**Step 4: Run the focused test to verify it passes**

Run: `node --test --experimental-strip-types test/account-inventory.test.ts`

Expected: PASS with all inventory safety tests green.

**Step 5: Commit**

```bash
git add db/migrations/031_owned_account_observability.sql src/account-inventory.ts test/account-inventory.test.ts
git commit -m "feat: add safe owned account inventory"
```

### Task 2: Authenticated inventory API and registration wiring

**Files:**
- Modify: `src/server.ts`
- Modify: `test/account-inventory.test.ts`

**Step 1: Write the failing tests**

Add route-contract assertions for the `/accounts` page and `/api/owned-accounts` read/register endpoints, including owner/session authorization, CSRF for mutations, and metadata-only registration.

**Step 2: Run the focused test to verify it fails**

Run: `node --test --experimental-strip-types test/account-inventory.test.ts`

Expected: FAIL because the server route contract and route allowlist do not include account observability.

**Step 3: Write the minimal implementation**

Instantiate the service with the existing PostgreSQL pool. Add the authenticated GET route, owner/agent-authorized metadata-only POST route, authenticated redirect allowlist entry, and `/accounts` control-plane route. Keep existing token/session/CSRF behavior and never accept credential values.

**Step 4: Run the focused test to verify it passes**

Run: `node --test --experimental-strip-types test/account-inventory.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/server.ts test/account-inventory.test.ts
git commit -m "feat: expose owned account inventory API"
```

### Task 3: Owner-facing Accounts page

**Files:**
- Modify: `src/control-plane.ts`
- Modify: `test/overview-contract.test.ts`

**Step 1: Write the failing tests**

Assert that the shared navigation contains an active Accounts route, the page title and security explanation are present, the client loads `/api/owned-accounts`, and the UI contract contains loading, empty, error, refresh, and metadata-only credential states.

**Step 2: Run the focused test to verify it fails**

Run: `node --test --experimental-strip-types test/overview-contract.test.ts`

Expected: FAIL because the route and page renderer do not yet contain the Accounts surface.

**Step 3: Write the minimal implementation**

Add the Accounts route to the shared sidebar and client page loader. Render live summary metrics and a compact responsive account table with escaped account identifiers, platform/category/status, protected credential metadata, last-seen/source, and a raw-secret safety notice. Keep the existing restrained palette and mobile collapse rules.

**Step 4: Run the focused test to verify it passes**

Run: `node --test --experimental-strip-types test/overview-contract.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/control-plane.ts test/overview-contract.test.ts
git commit -m "feat: add owner accounts observability page"
```

### Task 4: Documentation and release gates

**Files:**
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `RUNBOOK.md`

**Step 1: Write the failing documentation checks**

Add assertions to the focused test that the public docs mention the Accounts page, metadata-only registry, and secret boundary.

**Step 2: Run the focused test to verify it fails**

Run: `node --test --experimental-strip-types test/account-inventory.test.ts test/overview-contract.test.ts`

Expected: FAIL until the docs describe the new operational surface.

**Step 3: Write the minimal documentation**

Document the route, reconciliation sources, registration endpoint contract, and operational limitation that raw secrets must remain in protected runtime injection.

**Step 4: Run the full verification suite**

Run: `npm test && npm run check && npm run build`

Expected: exit code 0, with no test failures or TypeScript/build errors. Run `npm audit --omit=dev` and record any pre-existing dependency findings without changing unrelated dependencies.

**Step 5: Commit**

```bash
git add README.md ARCHITECTURE.md RUNBOOK.md
git commit -m "docs: document account observability controls"
```

## Final Shipyard gates

Before merging, inspect `git diff --check`, run the full test/build commands,
review the changed code against OWASP access-control and data-exposure checks,
scan for secret literals, run the simplification review, and confirm that the
existing untracked owner file outside the feature worktree is not included.
