# Telegram Control Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use shipyard:shipyard-executing-plans to implement this plan task-by-task.

**Goal:** Deliver durable owner-only Telegram control notifications through Hermes and support signed, audited `/approve` and `/reject` decisions.

**Architecture:** Agent OS generates allowlisted redacted notices, authorizes one message effect per recipient, and owns a PostgreSQL outbox plus authenticated claim/result APIs. A least-complexity host relay uses the existing Agent OS bearer credential and Hermes CLI transport without receiving database or Telegram credentials.

**Tech Stack:** Node.js 22, TypeScript, PostgreSQL 16, Node test runner, Hermes CLI, Docker Compose, HMAC-SHA256.

---

### Task 1: Extend the durable channel outbox

<task id="1" name="Durable outbox schema">
  <description>Link every deliverable row to a message effect and add lease, update, and attempt constraints without deleting history.</description>
  <files>
    <create>db/migrations/017_telegram_outbox_delivery.sql</create>
    <test>test/postgres-integration.test.ts</test>
  </files>
  <steps>
    <step>Add an integration assertion for effect linkage, unique approval-recipient idempotency, three-attempt limit, and audit trigger.</step>
    <step>Run the focused integration script and observe the missing-column failure.</step>
    <step>Add nullable effect_intent_id, lease/update fields, max_attempts, constraints, indexes, and audit trigger refresh.</step>
    <step>Run the focused integration script and observe the new assertions pass.</step>
    <step>Commit only migration and test.</step>
  </steps>
  <verification>
    <command>scripts/test-postgres-integration.sh --test-name-pattern='telegram outbox schema'</command>
    <expected>1 passed, 0 failed for the focused assertion.</expected>
  </verification>
</task>

### Task 2: Generate and enqueue approval notices

<task id="2" name="Approval notification enqueue">
  <description>Create a structured, secret-redacted Telegram template with signed decision commands and transactionally enqueue it under the standing message policy.</description>
  <files>
    <create>src/approval-notifications.ts</create>
    <create>test/approval-notifications.test.ts</create>
    <modify>src/approval-requests.ts</modify>
    <modify>src/server.ts</modify>
  </files>
  <steps>
    <step>Write tests for allowlisted recipients, exact generated fields, 4096-byte cap, generic secret redaction, action-bound 30-minute tokens, deduplication, and fail-closed policy absence.</step>
    <step>Run the focused unit tests and observe module-not-found or missing-behavior failures.</step>
    <step>Implement the minimal generator/enqueuer using authorizeEffect and parameterized inserts in the approval transaction.</step>
    <step>Inject policy ID, owner IDs, and file-loaded approval-token secret at server startup.</step>
    <step>Run focused and full unit tests.</step>
    <step>Commit implementation and tests.</step>
  </steps>
  <verification>
    <command>npm test -- --test-name-pattern='approval notification'</command>
    <expected>All approval-notification tests pass and no token or secret is printed.</expected>
  </verification>
</task>

### Task 3: Add atomic outbox claim and result services

<task id="3" name="Outbox delivery state machine">
  <description>Claim one eligible notice, recheck controls, handle explicit failure backoff, and reconcile success or ambiguity atomically with its effect.</description>
  <files>
    <create>src/channel-outbox.ts</create>
    <create>test/channel-outbox.test.ts</create>
    <modify>src/server.ts</modify>
  </files>
  <steps>
    <step>Write tests for SKIP LOCKED single claim, kill/pause/commercial-lock denial, effect consumption, capped retries, success receipt, stale-lease ambiguity, and no replay after ambiguity.</step>
    <step>Run focused tests and observe the missing-service failure.</step>
    <step>Implement the minimal transactional service and agent-authenticated claim/result endpoints.</step>
    <step>Run focused tests, full unit tests, and PostgreSQL integration tests.</step>
    <step>Commit implementation and tests.</step>
  </steps>
  <verification>
    <command>npm test -- --test-name-pattern='channel outbox' &amp;&amp; scripts/test-postgres-integration.sh</command>
    <expected>All focused and integration assertions pass with zero failures.</expected>
  </verification>
</task>

### Task 4: Build the Hermes host relay

<task id="4" name="Hermes relay">
  <description>Poll the loopback claim API and deliver with Hermes using shell-free spawning and sanitized receipts.</description>
  <files>
    <create>scripts/relay-channel-outbox.mjs</create>
    <create>test/channel-relay.test.ts</create>
    <create>deploy/goofy-agent-os-channel-relay.service</create>
  </files>
  <steps>
    <step>Write tests around injected fetch/spawn behavior for argument safety, stdin delivery, no body logging, success receipt sanitization, explicit failure, timeout ambiguity, and graceful shutdown.</step>
    <step>Run the focused test and observe the missing-relay failure.</step>
    <step>Implement minimal polling relay and user-service unit with loopback URL and existing mode-0600 Agent OS token file.</step>
    <step>Run focused tests and inspect the service with systemd-analyze verify where available.</step>
    <step>Commit relay, service unit, and tests.</step>
  </steps>
  <verification>
    <command>npm test -- --test-name-pattern='channel relay' &amp;&amp; systemd-analyze verify deploy/goofy-agent-os-channel-relay.service</command>
    <expected>Relay tests pass; service unit verifies without errors.</expected>
  </verification>
</task>

### Task 5: Add signed Telegram approval decisions

<task id="5" name="Telegram approve and reject">
  <description>Verify short-lived action-bound tokens from allowlisted Telegram users and invoke the existing immutable approval state machine.</description>
  <files>
    <modify>src/telegram.ts</modify>
    <modify>src/telegram-controls.ts</modify>
    <modify>src/server.ts</modify>
    <modify>test/telegram.test.ts</modify>
    <modify>test/postgres-integration.test.ts</modify>
  </files>
  <steps>
    <step>Write failing tests for supported commands, tampered/expired/action-mismatched token rejection, allowlist enforcement, one successful decision, and replay rejection.</step>
    <step>Run focused tests and observe unsupported-command failures.</step>
    <step>Add approve/reject parsing, token verification, and ApprovalService transition with telegram actor attribution.</step>
    <step>Run focused, full unit, and PostgreSQL integration suites.</step>
    <step>Commit implementation and tests.</step>
  </steps>
  <verification>
    <command>npm test -- --test-name-pattern='Telegram|approval token' &amp;&amp; scripts/test-postgres-integration.sh</command>
    <expected>Tampered and replayed commands are rejected; one exact approval transition succeeds and is audited.</expected>
  </verification>
</task>

### Task 6: Add observability and operator documentation

<task id="6" name="Outbox health and docs">
  <description>Expose secret-safe delivery health, document configuration and recovery, and keep the readiness gate non-passing until a live canary succeeds.</description>
  <files>
    <modify>src/server.ts</modify>
    <modify>src/records.ts</modify>
    <modify>src/control-plane.ts</modify>
    <modify>docs/HERMES_INTEGRATION.md</modify>
    <modify>RUNBOOK.md</modify>
    <modify>SECURITY_MODEL.md</modify>
    <modify>ARCHITECTURE.md</modify>
    <modify>compose.yaml</modify>
    <modify>.env.example</modify>
  </files>
  <steps>
    <step>Write a failing contract test for masked outbox counts, oldest pending age, reconciliation count, and relay freshness.</step>
    <step>Run the focused test and observe missing health fields.</step>
    <step>Add secret-safe health and dashboard data, runtime secret-file configuration, and operational recovery documentation.</step>
    <step>Run all tests, build, dependency audit, secret scan, and diff check.</step>
    <step>Commit implementation, docs, and tests.</step>
  </steps>
  <verification>
    <command>npm test &amp;&amp; npm run build &amp;&amp; npm audit --audit-level=high &amp;&amp; git diff --check</command>
    <expected>Zero test/build/high-audit failures and no secret values in tracked files.</expected>
  </verification>
</task>

### Task 7: Controlled deployment and live canary

<task id="7" name="Deploy and prove Telegram readiness">
  <description>After explicit deployment and notification-policy approval, provision runtime-only signing material, deploy exact reviewed commits, start relay, backfill current pending notices, and run one bounded canary.</description>
  <files>
    <modify>Agent OS PostgreSQL runtime state and deployment evidence only; no source edits expected</modify>
  </files>
  <steps>
    <step>Create an exact deployment approval after the final commit hash exists.</step>
    <step>Wait for both deployment approval and ff5548d2-97a5-4ac2-b112-5e22aa9f6319 to be approved.</step>
    <step>Generate the approval-token signing secret directly into mode-0600 runtime storage without displaying it.</step>
    <step>Deploy migration/app/relay under one guarded effect and verify private health.</step>
    <step>Backfill only still-pending approval notices under one effect each.</step>
    <step>Deliver one owner-only canary, reconcile its provider receipt, verify tamper/replay/kill behavior, and record evidence.</step>
    <step>Set telegram_controls to PASS only if every end-to-end condition is proven.</step>
  </steps>
  <verification>
    <command>Authenticated runtime health, outbox detail, effect detail, audit history, Telegram provider receipt, and readiness-gate evidence inspection</command>
    <expected>One delivered and reconciled canary; signed decision checks proven; kill claim denial proven; no secret exposure; gate PASS only with linked evidence.</expected>
  </verification>
</task>

