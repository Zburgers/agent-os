# Hermes integration

Agent OS extends the installed Hermes runtime; it does not install a second
gateway, channel adapter, plugin marketplace, skill registry, or Mem0 service.

## Installed boundary

- Hermes MCP server: `integrations/hermes/mcp-server.ts`
- Hermes `pre_tool_call` guard: `integrations/hermes/pre-tool-guard.mjs`
- Shared `/os` guidance: `integrations/hermes/skills/os/SKILL.md`
- Runtime credential: `/home/goofy/.hermes/agent-os-token` (mode `0600`,
  outside Git and containers except as a read-only Compose secret)
- Loopback API: `http://127.0.0.1:9999/api/v1`

The MCP server exposes read-only status/tasks/approvals/jobs/activity tools and
scoped proposal/decision/experiment mutations. It cannot approve requests,
release money, resume after kill, or bypass the effect boundary.

The shell hook guards terminal, browser, messaging, deployment, purchase, and
payment tool calls. Risky calls are rejected while commercial lock, pause, or
kill is active. After a future unlock, an external call must carry an
authorized Agent OS effect ID of the matching kind. The hook fails closed when
the control plane cannot be reached.

Hermes remains responsible for Telegram/Discord transport and durable gateway
operation. Agent OS remains authoritative for owner identity, approval,
controls, effects, finance, audit, and channel delivery records. Bot tokens
never enter Agent OS containers.

Hermes' configured Mem0 provider remains the single contextual-memory provider.
Agent OS stores scoped, policy-screened memory references and never treats
Mem0 as an authorization, accounting, approval, or audit store. The PostgreSQL
memory implementation is a safe degraded fallback, not a second Mem0 service.

## Verification

```sh
hermes mcp test agent-os
hermes hooks doctor
hermes skills list
node integrations/hermes/pre-tool-guard.mjs < test/fixtures/hermes-risky-tool.json
hermes gateway status
```

The risky fixture must return a block with `commercial_lock`. Do not test
channel delivery by sending a real message while the commercial lock is active.

## Upstream contracts researched

- MCP: https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp
- Messaging gateway: https://hermes-agent.nousresearch.com/docs/user-guide/messaging
- Telegram: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/telegram
- Discord: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord/
- Memory providers: https://hermes-agent.nousresearch.com/docs/user-guide/features/memory-providers/

Local installed source and documentation were also checked because they are the
authoritative contract for this deployed Hermes version.
