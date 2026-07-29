---
name: os
description: Inspect and operate the Goofy Agent OS through its authoritative configured MCP server, durable dashboard records, contextual-memory discipline, and approval/effect boundaries. Use for /os status, balance, profit, ventures, tasks, experiments, approvals, jobs, decisions, persistence, memory, pause, resume, kill, health, report, commercial-lock diagnosis, and any Agent OS operational request.
---

# Agent OS

Use the already-configured Codex MCP server named `agent-os` and its
`agent_os_*` tools. Call these tools directly from the active Codex harness;
do not create a parallel tracker or use direct database writes as a substitute.
Read [references/codex-harness-mcp.md](references/codex-harness-mcp.md) when
tool discovery, invocation, persistence, or commercial-lock diagnosis is
needed.

PostgreSQL—not chat or contextual memory—is authoritative for money,
approvals, permissions, tasks, experiments, jobs, effects, audit records,
readiness gates, and control state.

Map status, balance, profit, ventures, tasks, approvals, jobs, decisions, health,
and report requests to read tools. Create approvals, decisions, and experiments
only with complete durable context and idempotency.

At the start of every operating block, read status plus the relevant tasks,
approvals, jobs, and recent activity. Persist every material revenue initiative
as a bounded experiment, every consequential choice as a decision, and every
reproducible result as evidence linked by stable IDs or checksums. Before ending
or switching work, record the result, metric, lesson, and next action so a fresh
session can resume from the dashboard.

Never decide an owner approval, release capital, resume after kill, or bypass a
denied tool guard. Every external message, expense, deployment, payment,
purchase, or account change requires a matching Agent OS effect authorization.
Commercial lock, pause, and kill fail closed.

Treat approval, tranche release, effect authorization, and commercial-lock
release as distinct durable transitions. An approved request alone does not
prove that capital was released, an effect was authorized, or the commercial
lock changed. Diagnose each transition from authoritative state and audit
evidence; never infer it from owner intent or an approval label.

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
