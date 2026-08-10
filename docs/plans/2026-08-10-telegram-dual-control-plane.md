# Telegram Dual Control Plane Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use shipyard:shipyard-executing-plans to implement this plan task-by-task.

**Goal:** Keep Agent OS approval notifications and native decision buttons reliable while restoring Hermes Telegram agent control without competing Telegram pollers.

**Architecture:** Agent OS remains the sole owner of its Bot API token, approval outbox, inline-button callbacks, and approval authorization. Hermes receives a separately provisioned bot token through a protected mode-0600 host file and a small launcher that injects it only into the Hermes process environment. Startup validation and documentation make the one-bot/one-poller boundary explicit.

**Tech Stack:** Node.js, TypeScript, Python Hermes gateway, systemd user services, PostgreSQL-backed Agent OS outbox, Node test runner.

---

### Task 1: Make Hermes Telegram credential injection explicit and secret-safe

**Files:**
- Create: `scripts/run-hermes-gateway-with-telegram.mjs`
- Modify: `deploy/hermes-gateway.service`
- Test: `test/hermes-telegram-service.test.ts`

**Step 1: Write the failing test**

Test that the launcher requires an absolute protected token-file path, rejects missing or weak Telegram tokens, passes the token only through the child environment, and never places the token in argv or logs. Test that the service points at the launcher and a distinct Hermes token-file path.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test test/hermes-telegram-service.test.ts`
Expected: FAIL because the launcher and service contract do not exist.

**Step 3: Write minimal implementation**

Add a launcher that reads `/home/goofy/.hermes/hermes-telegram-bot-token` (or an explicit absolute `HERMES_TELEGRAM_BOT_TOKEN_FILE`), verifies mode-0600-or-stricter permissions and Bot API token shape, then spawns `python -m hermes_cli.main gateway run` with `TELEGRAM_BOT_TOKEN` in the child environment. Add the tracked systemd unit with the launcher and no shared Agent OS token.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test test/hermes-telegram-service.test.ts`
Expected: PASS with zero failures.

**Step 5: Commit**

```bash
git add scripts/run-hermes-gateway-with-telegram.mjs deploy/hermes-gateway.service test/hermes-telegram-service.test.ts
git commit -m "fix: isolate Hermes Telegram bot credential"
```

### Task 2: Fail closed when approval notification policy configuration is invalid

**Files:**
- Modify: `src/approval-notifications.ts`
- Test: `test/approval-notifications.test.ts`

**Step 1: Write the failing test**

Add a behavior test showing that a notification policy approval ID which is missing or not approved produces a durable audited denial without attempting an effect insert, and that a valid policy still enqueues one redacted native-button notice per owner recipient.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test test/approval-notifications.test.ts`
Expected: FAIL because the notifier currently relies on a database foreign-key error for an invalid policy ID.

**Step 3: Write minimal implementation**

Validate the policy approval inside the transaction before authorizing the message effect. Return a bounded reason and audit event on invalid policy state, preserving the approval request transaction and avoiding an opaque 500/FK failure.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test test/approval-notifications.test.ts`
Expected: PASS with zero failures.

**Step 5: Commit**

```bash
git add src/approval-notifications.ts test/approval-notifications.test.ts
git commit -m "fix: fail closed on invalid notification policy"
```

### Task 3: Document and verify the live two-bot operational boundary

**Files:**
- Modify: `docs/HERMES_INTEGRATION.md`
- Modify: `RUNBOOK.md`
- Modify: `.env.example`
- Test: `test/telegram-native-relay.test.ts`

**Step 1: Write the failing test**

Add static checks that Agent OS and Hermes use distinct token-file variables/paths, approval callbacks remain Agent OS-owned, and no service configuration uses the same polling token for both processes.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test test/telegram-native-relay.test.ts`
Expected: FAIL until the deployment contract and runbook are updated.

**Step 3: Write minimal implementation**

Document the current diagnosis, the protected token-file setup, BotFather provisioning as the only owner action required, restart commands, and checks for `getMe`, `getWebhookInfo`, Hermes gateway status, Agent OS relay heartbeat, approval delivery, and button callback audit.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test test/telegram-native-relay.test.ts`
Expected: PASS with zero failures.

**Step 5: Commit**

```bash
git add docs/HERMES_INTEGRATION.md RUNBOOK.md .env.example test/telegram-native-relay.test.ts
git commit -m "docs: define dual Telegram control-plane setup"
```

### Task 4: Full verification and delivery

**Files:**
- No additional source files.

**Step 1: Run focused tests**

Run: `node --experimental-strip-types --test test/approval-notifications.test.ts test/telegram-native-relay.test.ts test/channel-relay.test.ts test/telegram.test.ts`
Expected: PASS with zero failures.

**Step 2: Run repository verification**

Run: `npm test` and `npm run build`
Expected: exit 0 with no test failures and a successful build.

**Step 3: Run security and deployment checks**

Run: `git diff --check`; scan tracked files for secrets; inspect systemd unit permissions; verify Agent OS relay health and Telegram Bot API identity without printing credentials.

**Step 4: Reconcile all workspace changes**

Review every tracked and untracked path, preserve intended existing work, commit the remaining intended records, and verify `git status --short` is empty.

**Step 5: Push**

Run: `git push origin main`
Expected: remote accepts all commits; verify `git status --short --branch` is clean and synchronized.
