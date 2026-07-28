# Approval Matrix

| Action | Autonomous? | Required control |
|---|---:|---|
| Read-only research and internal development | Yes | Audit record |
| Draft outreach, invoices, and purchase instructions | Yes | Clearly marked draft |
| Send external message | No, until scoped owner policy | Owner approval/policy |
| Any initial expense | No | Expiring owner approval + financial proposal |
| Expense above authority or recurring subscription | No | Explicit owner approval |
| KYC, legal/tax/bank/payment account, contract | No | Direct owner action |
| Production irreversible deletion | No | Explicit owner approval |
| Pause / kill | Owner or safety automation | Immediate audit event |
| Recovery/read-only health | Yes | Audit record |

Approvals identify action, reason, cost, risk, alternatives, recommendation, expiration, scope, and idempotency key. Approve/reject/modify is immutable and attributable.
