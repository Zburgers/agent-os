# Telegram Control Notifications Design

## Objective and success criteria

Agent OS must deliver approval requests and urgent operational notices to both
its authenticated dashboard and the configured private owner Telegram chat. It
must also let the allowlisted owner approve or reject an exact pending approval
from Telegram using an authenticated, action-bound, short-lived,
tamper-resistant token. A successful implementation has durable PostgreSQL
outbox state, a matching authorized message effect, atomic claiming, bounded
delivery handling, provider evidence, restart recovery, immutable command and
decision audit, secret-safe generated templates, and pause/kill enforcement.

The first live end-to-end test must prove all of the following before the
`telegram_controls` readiness gate returns to `PASS`: one generated notice is
delivered to the configured owner chat through Hermes; the provider result is
reconciled to `delivered`; a tampered or expired decision token is rejected; an
allowlisted owner can decide an exact test approval once; a replay cannot decide
it again; and kill prevents a new delivery claim. Merely having an inbound
webhook, outbox table, or successful CLI command is insufficient.

## Approaches considered

### A. PostgreSQL outbox plus Hermes host relay — selected

Agent OS owns policy, generated content, effects, durable state, claiming, and
reconciliation. A small host relay calls authenticated loopback APIs, then uses
`hermes send` with argument-array process spawning. Hermes retains the existing
Telegram credential and home-channel configuration. This avoids copying the bot
token into the app, keeps PostgreSQL authoritative, and survives application or
relay restarts.

### B. Telegram Bot API inside the app — rejected

This is mechanically direct but duplicates Hermes transport and requires a
second injection path for the Telegram token. It expands secret exposure and
contradicts the current architecture in which Hermes owns configured messaging
transport.

### C. Agent-triggered ad hoc `hermes send` calls — rejected

This reuses Hermes but has no durable consumer, lease, provider reconciliation,
or restart recovery. It cannot prove that every required notice was attempted
exactly once from authoritative state.

## Authorization model

Operational notices are external messages and therefore cannot reuse a sales
outreach approval. Approval `ff5548d2-97a5-4ac2-b112-5e22aa9f6319` requests a
narrow standing policy for system-generated notices to configured owner chats
only. Each outbox item still receives its own `message` effect under that policy.
No outbox row is deliverable unless its effect is authorized and unconsumed.

The notification policy permits only enumerated mission events. It cannot carry
free-form marketing, customer replies, arbitrary recipients, credentials,
payment actions, or wallet operations. If the policy is missing, pending,
expired, or rejected, the business mutation remains visible in the dashboard
but the notification enqueue produces explicit fail-closed evidence and the
Telegram readiness gate remains non-passing. The policy request itself is the
unavoidable bootstrap exception: it is created in the dashboard before a valid
policy exists and cannot authorize its own notification.

The claim API rechecks `paused`, `killed`, and `commercial_lock` immediately
before moving a message effect from `authorized` to `executing`. Kill therefore
prevents new notice delivery, matching the mission. An already executing
ambiguous delivery is never silently replayed.

## Components and data flow

Migration `017_telegram_outbox_delivery.sql` links `channel_outbox` to
`effect_intents`, adds lease/update metadata and bounded-attempt constraints,
and preserves append-only/audit triggers. `approval-notifications.ts` accepts
only structured approval records and generates a Telegram payload capped below
the provider limit. The template includes approval ID, type, exact requested
action, cost/exposure, risk, recommendation, expiration, and a reminder to
review scope before deciding. Generic secret redaction is applied before
persistence; evidence arrays and credential values are never included.

For each configured owner ID, approval creation calls `authorizeEffect` inside
the same database transaction and inserts one uniquely keyed outbox row. The
message includes `/approve <token>` and `/reject <token>` commands whose HMAC
tokens are bound to approval ID, action, and the earlier of 30 minutes or the
approval expiry. The signing secret is loaded from a mode-0400 runtime file and
never enters PostgreSQL or output.

The authenticated claim endpoint locks one eligible row with
`FOR UPDATE SKIP LOCKED`, rechecks controls, consumes an authorized effect, and
returns only recipient, message text, outbox ID, and attempt number. The host
relay invokes `hermes send --to telegram:<owner-id> --json --file -` without a
shell. Its result endpoint stores a sanitized provider receipt. Explicit
failures retry with bounded backoff while the effect remains executing;
ambiguous or abandoned delivery enters reconciliation without replay; success
atomically marks both outbox and effect terminal.

## Telegram decisions

`/approve` and `/reject` are added to the strict command parser. The webhook
secret authenticates Telegram as the provider, the configured user allowlist
authenticates the owner identity, and the HMAC token authenticates the exact
approval/action/expiry tuple. The control service verifies all three before
calling the existing `ApprovalService` as actor type `telegram`. Invalid,
tampered, expired, action-mismatched, replayed, or already-decided commands
return a safe rejection and remain audited without leaking token contents.

No inline callback button is required for the first release. Text commands are
smaller, independently testable, and avoid callback-query handling. Modify and
cancel remain dashboard operations. Pause, resume, and kill keep their existing
explicit confirmation behavior.

## Failure handling and observability

The relay never logs message bodies, authorization headers, signing secrets, or
raw provider responses. Provider receipts retain only Telegram message/chat IDs,
provider status, attempt count, and timestamps. An explicit backend failure is
retried at most three times with capped backoff. A timeout, invalid provider
response after submission, or stale `delivering` lease is ambiguous and moves
the effect to `reconciliation_required`; it is not automatically replayed.

Health exposes counts and oldest age for pending, delivering, delivered, failed,
and reconciliation-required notices plus relay freshness. It never exposes
recipient IDs unmasked or payload text. A bounded live canary after deployment
is required before recording the gate as passing. Deployment itself remains a
separate approval/effect and cannot be inferred from source-code completion.

## Security invariants

- No Telegram bot token is copied into Agent OS; Hermes remains the transport.
- No signing secret, bearer token, raw decision token, or message body enters
  logs, audit payloads, health output, provider receipts, or error strings.
- Recipients come only from configured owner IDs, never request input.
- Templates are structured and allowlisted; untrusted free-form payloads are
  rejected.
- Database writes use parameterized queries and transactional row locks.
- Relay execution uses `spawn` argument arrays with `shell: false`.
- Every notification has a unique outbox key and matching message effect.
- Kill prevents claims; ambiguous delivery prevents replay.
- Approval decisions use existing immutable transitions and audit attribution.

