# Agent OS Architecture

## MVP
A TypeScript control-plane service and static server-rendered operations dashboard use PostgreSQL as the durable source of truth. Docker Compose runs the API/dashboard and PostgreSQL. A database migration establishes immutable financial/audit structures, control state, work queue, approvals, ventures, tasks, experiments, decisions, opportunities, and memory references.

## Components
- `app`: authenticated API/dashboard, policy gate, health endpoint, backup/restore commands.
- `worker`: transactionally claims durable jobs; uses leases, retries, dead-letter state, idempotency records, pause/kill gate, and restart recovery.
- `postgres`: source of truth with migration constraints and append-only triggers.
- `telegram adapter`: owner allowlist and command parser; transport is disabled without configured credentials.
- `memory provider`: interface with scoped PostgreSQL fallback and audit events; can be replaced with self-hosted Mem0.

## Invariants
No external effect, financial operation, deployment, payment action, or account modification is permitted when killed, paused, unapproved, duplicate, or beyond enforced budget. Dashboard metrics are SQL-derived from stored records, never fabricated. Deployment is local Docker Compose until a configured owner-controlled host exists.
