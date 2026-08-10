# Agent OS Architecture

## MVP
A TypeScript control-plane service and static server-rendered operations dashboard use PostgreSQL as the durable source of truth. Docker Compose runs the API/dashboard and PostgreSQL. A database migration establishes immutable financial/audit structures, control state, work queue, approvals, ventures, tasks, experiments, decisions, opportunities, and memory references.

## Components
- `app`: authenticated API/dashboard, policy gate, health endpoint, backup/restore commands.
- `supervisor`: always-on, transactionally claims durable jobs; uses occurrence keys, leases, bounded retries, dead-letter state, central effect intents, pause/kill gate, recurring advancement, and restart recovery.
- `postgres`: source of truth with migration constraints and append-only triggers.
- `Hermes bridge`: native Hermes MCP registration, `/os` skill, and fail-closed
  `pre_tool_call` guard over the authenticated loopback Agent OS API. Hermes'
  installed gateway owns Telegram/Discord transport and its configured Mem0
  provider; Agent OS does not duplicate those facilities.
- `telegram controls`: secret-authenticated webhook, strict owner allowlist,
  audited commands, destructive confirmation, owner-only pause/resume/kill,
  and action-bound signed approval decisions through the shared approval state
  machine.
- `owner notification outbox`: fixed redacted templates authorize one message
  effect per recipient; PostgreSQL leases and caps delivery attempts. A
  least-privilege host relay calls loopback Agent OS and shell-free Hermes,
  recording only sanitized receipts or reconciliation state.
- `readiness evidence`: deployment-scoped service promotes Telegram controls
  from PARTIAL to PASS only after locking live controls and joining the exact
  executing deployment approval to a succeeded message effect, approved notice
  policy, delivered outbox row, and matching sanitized provider receipt.
- `contextual memory`: PostgreSQL keeps provider provenance and mutation audit
  evidence while remaining authoritative for operations. Mem0 Cloud is scoped
  semantic retrieval; `memory/` is an explicit, curated Markdown promotion
  layer. Precedence is PostgreSQL operational state, governance documents,
  curated Markdown, Mem0, then model inference. Mem0 remains contextual and
  is never an authority store.
- `effect boundary`: persists proposals (including denials), locks live controls, verifies credential scope and exact approval scope, and records provider idempotency/reconciliation state.
- `account observability`: reconciles safe runtime and database signals into the authenticated `/accounts` dashboard and `/api/owned-accounts` metadata API. It records credential presence and lifecycle metadata in `owned_account_credentials`; raw secrets are never read, stored, or returned.
- `governance workspace`: exposes a fixed allowlist of runtime-law and operating-instruction files through authenticated `/governance` and `/api/operator-documents` routes. Saves use an atomic rename, SHA-256 conflict detection, and audit metadata; arbitrary paths and secret-shaped content are rejected.

## Invariants
No external effect, financial operation, deployment, payment action, or account modification is permitted when commercially locked, killed, paused, unapproved, duplicate, incorrectly scoped, or beyond enforced budget. Denied proposals remain durable evidence. Dashboard metrics are SQL-derived from stored records, never fabricated. Deployment is local Docker Compose until a configured owner-controlled host exists.

Commercial operations are stored in PostgreSQL and exposed through the
authenticated `/commercial` workspace. Prospect stages, products, customers,
follow-ups, messages, and delivery/reply events are data-backed. Outbound
message records require an existing approval plus an executed or
reconciliation-required message effect; the CRM is an observer of the external
effect lifecycle, not an alternate sending path. See
`docs/COMMERCIAL_OPERATIONS.md`.

The account inventory is an observability layer, not a secret vault. Protected
runtime credential files are checked for existence and restrictive permissions,
but their contents are never read. Future registration workflows must submit
metadata-only fields through the authenticated account API.

Governance documents remain file-backed so the instructions read by the runtime
and the owner-facing editor share one source of truth. Compose mounts only the
allowlisted document files back to the owner workspace so saves persist across
image refreshes; PostgreSQL stores the audit evidence, not document text.
