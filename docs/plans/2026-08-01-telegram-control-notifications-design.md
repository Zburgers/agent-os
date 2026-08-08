# Telegram Control Notifications Design

> Historical baseline. ADR 0006 supersedes the Hermes-only Telegram transport
> choice for native approval buttons: Agent OS now owns the host Bot API relay,
> while the durable outbox and authorization model below remain authoritative.

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
delivered to the configured owner chat through the Agent OS Telegram relay; the provider result is
reconciled to `delivered`; a tampered or expired decision token is rejected; an
allowlisted owner can decide an exact test approval once; a replay cannot decide
it again; and kill prevents a new delivery claim. Merely having an inbound
webhook, outbox table, or successful CLI command is insufficient.

## Approaches considered

### A. PostgreSQL outbox plus Hermes host relay — historical baseline

Agent OS owns policy, generated content, effects, durable state, claiming, and
reconciliation. A small host relay calls authenticated loopback APIs, then uses
the provider relay. This avoided copying the bot token into the app, kept
PostgreSQL authoritative, and survived application or relay restarts. ADR 0006
supersedes this transport choice for native approval buttons.

### B. Telegram Bot API inside the app — rejected for the application container

This remains rejected inside the application container. The shipped design
uses the Bot API only in the host relay, where the token is protected and the
application receives only authenticated, bounded update fields.

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
message includes native Approve and Reject buttons with bounded hidden
`ao1:<action>:<approval-uuid>` callback data. The visible text contains only a
short reference. The legacy signed command path remains separately available;
its signing secret is loaded from a mode-0400 runtime file and never enters
PostgreSQL or output.

The authenticated claim endpoint locks one eligible row with
`FOR UPDATE SKIP LOCKED`, rechecks controls, consumes an authorized effect, and
returns only recipient, message text, optional inline keyboard, outbox ID, and
attempt number. The host relay invokes the official Telegram Bot API and stores
a sanitized provider receipt. Explicit failures retry with bounded backoff while the effect remains executing;
ambiguous or abandoned delivery enters reconciliation without replay; success
atomically marks both outbox and effect terminal.

## Telegram decisions

Native callback queries carry the Telegram user and private chat identity to
the authenticated Agent OS update endpoint. The configured owner allowlist
authenticates the owner identity and chat, and the control service invokes the
existing `ApprovalService` as actor type `telegram`. Invalid, expired,
action-mismatched, replayed, or already-decided callbacks return a safe
rejection and remain audited. The legacy signed `/approve` and `/reject`
commands keep their HMAC verification for explicit manual use.

Modify and cancel remain dashboard operations. Pause, resume, and kill keep
their existing explicit confirmation behavior. Only one process may poll a
Telegram bot token; Hermes's same-bot Telegram lane must be disabled before
the Agent OS relay starts.

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

- No Telegram bot token enters Agent OS containers; the protected host relay is
  the Telegram transport.
- No signing secret, bearer token, raw decision token, or message body enters
  logs, audit payloads, health output, provider receipts, or error strings.
- Recipients come only from configured owner IDs, never request input.
- Templates are structured and allowlisted; untrusted free-form payloads are
  rejected.
- Database writes use parameterized queries and transactional row locks.
- Relay execution uses direct HTTPS JSON requests and never shells out.
- Every notification has a unique outbox key and matching message effect.
- Kill prevents claims; ambiguous delivery prevents replay.
- Approval decisions use existing immutable transitions and audit attribution.
