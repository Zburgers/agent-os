---
name: os
description: Inspect and operate the Goofy Agent OS through its authoritative MCP tools and durable approval/effect boundaries. Use for /os status, balance, profit, ventures, tasks, approvals, jobs, decisions, pause, resume, kill, health, report, and any Agent OS operational request.
---

# Agent OS

Use the `agent_os_*` MCP tools. PostgreSQL—not chat or contextual memory—is authoritative for money, approvals, permissions, tasks, jobs, effects, audit records, readiness gates, and control state.

Map status, balance, profit, ventures, tasks, approvals, jobs, decisions, health,
and report requests to read tools. Create approvals, decisions, and experiments
only with complete durable context and idempotency.

Never decide an owner approval, release capital, resume after kill, or bypass a
denied tool guard. Every external message, expense, deployment, payment,
purchase, or account change requires a matching Agent OS effect authorization.
Commercial lock, pause, and kill fail closed.

## Contextual memory

Use contextual memory only to recall relevant non-authoritative background. If
sources conflict, use this fixed precedence: PostgreSQL operational state,
governance documents, curated Markdown under `memory/`, Mem0 Cloud scoped
context, then model inference.

Scope every contextual request by owner and scope key; never retrieve across an
owner, venture, customer, or other scope boundary. Mem0 Cloud is an optional
semantic retrieval layer. If it is unavailable, continue with PostgreSQL and
curated Markdown and never relax an authorization or financial control.

Before writing either Mem0 or Markdown, apply secret screening and check future
value, evidence, duplication, staleness, sensitivity, and epistemic type. Do
not write secrets, credentials, OTPs, payment data, or unnecessary personal
data. Automated memory operations must never edit constitutional, financial,
approval, or security policy documents, including `GOOFY_IDENTITY.md` and
`OPERATOR_SCRATCHPAD.md`.

Do not mirror Mem0 records into Markdown. Explicitly promote only stable,
high-value durable knowledge (such as a verified lesson, venture brief,
decision summary, or experiment summary) to `memory/`. Promotion must retain
the prescribed frontmatter, related PostgreSQL IDs, provenance, and audit
evidence. Treat curated Markdown mutation as a durable, audited operation.

For pause, resume, or kill, require the owner to use the authenticated dashboard
or Telegram control and confirm the destructive action. Do not simulate success.
