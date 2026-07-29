# Case Study: Making Autonomous Work Fail Closed

## The problem

An automation that can send messages, spend money, deploy code, or change
accounts needs more than a successful happy-path demo. Retries can duplicate an
external action, a restart can orphan work, a stale approval can be reused, and
an operator needs a reliable way to stop the system without losing audit data.

The system described here is a live, PostgreSQL-backed control plane for an
autonomous digital-business operator. This write-up is intentionally sanitized:
it documents the design and verifiable behavior without publishing credentials,
private infrastructure, or owner data.

## Reliability design

Every material action follows one durable chain:

1. An objective and bounded experiment state why the work exists.
2. A durable job records the intended action and its idempotency key.
3. A policy guard reads live pause, kill, commercial-lock, and approval state.
4. An effect-intent record is written before an external provider is called.
5. Provider results and reconciliation state are written to PostgreSQL.
6. Financial results enter an append-only ledger with evidence.

PostgreSQL is the source of truth. Context memory is never used as an
authorization or accounting store.

## Failure modes covered

### Duplicate execution

Approval requests, jobs, financial entries, and effect intents use stable
idempotency keys. A retry resolves to the existing durable record instead of
silently repeating the side effect.

### Restart during work

Jobs have persisted state, attempt counts, leases, and occurrence keys. Recovery
logic can reclaim an expired lease after restart without treating the same
occurrence as new work.

### Ambiguous provider result

If a provider may have received an action but its final result is unknown, the
effect is moved to reconciliation-required state. The system does not assume
failure and retry an action that may already have happened.

### Missing or stale permission

External effects fail closed when the commercial lock is active, the system is
paused or killed, or a matching live approval is absent. Approval decisions are
owner-controlled and terminal.

### Runaway spending

Expense checks enforce released capital, per-expense and daily limits,
experiment budgets, and reserve preservation before a ledger entry is created.

### Secret leakage

Configuration secrets are scoped to the process that needs them, and log
redaction rejects configured secret values before persistence or output.

## Operator controls

The authenticated control plane exposes:

- active objective, venture, tasks, and jobs;
- approval requests and immutable approval history;
- contribution, expense, revenue, fee, refund, and realized-profit totals;
- persisted health checks and incidents;
- global pause and kill controls;
- a Telegram command path restricted to an explicit owner allowlist.

Destructive Telegram controls require an explicit confirmation argument.

## Verification evidence

On 2026-07-29, the repository’s fast test suite reported:

- 24 tests discovered;
- 23 passed;
- 0 failed;
- 1 PostgreSQL integration prerequisite test skipped by the fast suite.

The passing coverage includes:

- owner-only and terminal approvals;
- idempotent approval requests;
- tamper-resistant expiring approval tokens;
- capital-tranche, expense-limit, and reserve enforcement;
- atomic audited ledger entries and duplicate handling;
- kill/pause fail-closed behavior;
- secret redaction;
- Telegram owner allowlisting and destructive confirmation;
- durable ticket creation and audited edits;
- control-plane route and navigation checks.

The live PostgreSQL status at the same checkpoint showed six completed jobs,
zero open incidents, and a commercial lock still correctly blocking external
effects. That last point is important: a reliability control is useful when it
prevents the operator from bypassing it under revenue pressure.

## What this pattern adds to an n8n or API workflow

For a bounded customer workflow, the same ideas translate into:

- a clear state machine rather than implicit node order;
- deterministic idempotency keys at every external boundary;
- bounded retries with backoff and a dead-letter path;
- an error workflow that preserves the original execution context;
- reconciliation for ambiguous email, payment, CRM, or webhook outcomes;
- structured logs, actionable alerts, and a small acceptance suite;
- a handoff runbook that explains recovery, not only setup.

## Bounded pilot

The Automation Reliability Sprint applies this pattern to one failing workflow.
The USD 99 pilot covers a narrow inspection and remediation plan; the USD 249
standard sprint covers one bounded implementation with duplicate protection,
safe retries, logging, alerts, tests, and handoff documentation. Production
credentials remain customer-controlled, and scope is confirmed before any live
change.
