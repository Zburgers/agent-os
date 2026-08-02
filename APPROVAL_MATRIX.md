# Approval Matrix

| Action | Autonomous? | Required control |
|---|---:|---|
| Read-only research and internal development | Yes | Audit record |
| Dedicated agent-wallet authentication message | Yes, for allowlisted providers and formats | Protected signer + pause/kill gate + durable audit; authorized 2026-08-01 |
| Dedicated agent-wallet transaction | Only within existing financial authority | Ledger/effect controls, simulation, limits, reconciliation, and any required approval |
| Owner-wallet message or transaction signature | No | Direct owner action |
| Draft outreach, invoices, and purchase instructions | Yes | Clearly marked draft |
| Send external message | No, until scoped owner policy | Owner approval/policy |
| Any initial expense | No | Expiring owner approval + financial proposal |
| Expense above authority or recurring subscription | No | Explicit owner approval |
| KYC, legal/tax/bank/payment account, contract | No | Direct owner action |
| Production irreversible deletion | No | Explicit owner approval |
| Pause / kill | Owner or safety automation | Immediate audit event |
| Recovery/read-only health | Yes | Audit record |

Approvals identify action, reason, cost, risk, alternatives, recommendation, expiration, scope, and idempotency key. Approve/reject/modify is immutable and attributable.

## Dated Git autonomy amendment (2026-08-01)

Routine branch, commit, push, tag, pull request, and audited memory/document changes are agent-authorized with authentication, secret scanning, idempotency, and audit/effect evidence; they do not require per-operation owner approval. Default-branch force-push or deletion, repository deletion, transfer or visibility changes, secret publication, security-control weakening, and legal acceptance remain denied.

## Bounded dedicated wallet amendment — 2026-08-01

Dedicated wallet platform policy versions are draft by default. The owner must authenticate to activate or revoke a version; agent operations inside an active policy need no per-operation approval but must pass immutable policy, effect, ledger, reserve, simulation, idempotency, pause/kill, and reconciliation controls. The owner wallet remains separate and owner-controlled. Receiving funds is allowed; withdrawals use governed transactions.
