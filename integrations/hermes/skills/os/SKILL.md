---
name: os
description: Use when inspecting or operating Goofy Agent OS state, revenue work, dedicated or owner-linked wallets, autonomous signing, balances, profit, ventures, tasks, experiments, approvals, jobs, decisions, persistence, memory, controls, health, reports, or commercial-lock diagnosis.
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

## Wallet workflows

Distinguish the owner-linked MetaMask from the owner-authorized dedicated Goofy
wallet. Public addresses are operational metadata. Never request, store, display,
or use the owner's seed phrase, private key, recovery data, browser session, or
unrestricted signing permission. Never return any dedicated-wallet key or raw
signature through MCP, dashboard, PostgreSQL, Mem0, Markdown, logs, Telegram, or
model-visible output.

For the owner-linked MetaMask, use this strict order: inspect read-only status;
create an immutable Mainnet transaction draft; wait for the owner's durable
approval; the owner submits the exact envelope in the authenticated dashboard
and separately confirms in MetaMask; reconcile only by its returned hash. The
MCP may create a draft but may never link a wallet, approve, sign, submit, or
retry a transaction. Raw contract calldata remains a draft and requires the
owner's explicit dashboard warning acknowledgement.

The dedicated Goofy wallet is a separate least-privilege operational wallet
authorized by the owner on 2026-08-01. Its key exists only in the protected
runtime signer. On this Compose deployment, the mode-0600 host key is mounted
read-only and copied by the root entrypoint to a mode-0400, agent-owned,
ephemeral runtime location before privileges are dropped. PostgreSQL is authoritative for its public address, policy,
allowed chains/providers, operation hashes, outcomes, limits, effects, and
reconciliation. Read its public status and activity from the authenticated
`/api/agent-wallet/status` dashboard/API surface until matching MCP read tools
are available.

Autonomous EIP-191 message signing is currently permitted only for provider
`bountybook` and messages matching `bounty:<32 lowercase hex>:<10 digit
timestamp>`. Use `/api/agent-wallet/sign-message` with agent authentication and
a unique idempotency key. Check pause/kill, derived-address match, and durable
rate limit before every signature. Use the returned signature transiently for
the intended nonce verification, then discard it. Never persist a BountyBook
session token; keep it only in process memory for its one-hour lifetime.

Transaction signing for the dedicated wallet is disabled. Do not infer spending
authority from key custody. Before enabling a transaction path, require an
immutable effect, ledger attribution, reserve and spending-limit enforcement,
chain/recipient allowlists, simulation, idempotency, reconciliation, and any
approval required by the financial policy. Owner withdrawals must use that
visible transaction path; never expose the key as a withdrawal mechanism.

## PayPal and public callbacks

PayPal credentials are runtime secrets: never read them into chat, PostgreSQL,
Mem0, logs, Markdown, MCP output, or browser code. `PAYPAL_CLIENT_ID` may be
used only for PayPal's intended browser integration if added later; keep
`PAYPAL_SECRET` server-only. Before a Live payment is treated as settled,
require a verified webhook using `PAYPAL_WEBHOOK_ID`, preserve the original raw
request body for signature verification, deduplicate the provider event ID,
and reconcile the result into PostgreSQL. Creating an order remains a payment
effect and requires the existing approval/effect authorization; credentials do
not authorize orders, captures, refunds, payouts, or spending.

The dashboard stays tailnet-private at port 8443. The only permitted public
Tailscale Funnel route is `/webhooks/paypal` on port 443. Never Funnel the
dashboard, wallet, APIs, database, or an unauthenticated catch-all proxy. Check
`tailscale funnel status` and independently verify a valid publicly trusted
certificate and callback reachability before recording a PayPal webhook as
ready. A tailnet-local curl can resolve to a private path and is not proof of
public delivery.

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

## Dated Git autonomy amendment (2026-08-01)

Routine authenticated Git operations in the private repository are agent-authorized: ordinary branch, commit, push, tag, pull request, and audited memory/document changes require secret scanning, idempotency, and audit/effect evidence, not per-operation owner approval. Default-branch force-push or deletion, repository deletion, transfer or visibility changes, secret publication, security-control weakening, and legal acceptance remain denied.

## Bounded dedicated wallet autonomy — 2026-08-01

The dedicated Goofy wallet is separate from owner-linked MetaMask. Platform policy versions begin as `draft` and only an authenticated owner may activate or revoke them. In-policy operations still require immutable policy evaluation, effect/ledger/reserve, simulation, idempotency, pause/kill, nonce/fee, and reconciliation controls. Receiving funds is allowed; withdrawals use governed transactions. Never expose or persist private keys or raw signatures.
