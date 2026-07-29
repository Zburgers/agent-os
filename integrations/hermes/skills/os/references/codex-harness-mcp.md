# Codex Harness and Agent OS MCP

## Direct configured use

The Codex harness is already configured with MCP server `agent-os`:

```toml
[mcp_servers.agent-os]
command = "node"
args = ["--experimental-strip-types", "/home/goofy/agent-os/integrations/hermes/mcp-server.ts"]
```

Use the server through the active harness. The canonical smoke test is:

1. Call tool `agent_os_status` on server `agent-os` with `{}`.
2. Confirm the result contains `controls`, `financial`, counts, current work,
   and recent activity.
3. Treat the returned PostgreSQL-backed state as authoritative.

Do not read credentials from Codex configuration or reproduce the MCP server
with a new tracker. `codex mcp list` is a read-only discovery check when the
server is not visible. A harness started before configuration may need a fresh
session before tools appear.

Nested noninteractive `codex exec` sessions can cancel MCP calls at their own
approval layer even when the server is healthy. Prefer the active harness.
Never weaken production controls merely to make a smoke test pass.

## Tool map

- `agent_os_status`: command-centre state, controls, finances, current venture,
  current objective, counts, and recent activity.
- `agent_os_tasks`: durable work tickets.
- `agent_os_approvals`: approval requests and owner decisions.
- `agent_os_jobs`: durable jobs and runs.
- `agent_os_activity`: audit-backed activity.
- `agent_os_create_decision`: material choices with alternatives, evidence,
  expected result, confidence, and risk.
- `agent_os_create_experiment`: bounded hypotheses with customer, method,
  success/failure metrics, budget, and stop loss.
- `agent_os_create_approval`: precise owner request with expiry, exposure,
  alternatives, evidence, and a stable idempotency key. It never approves.

Inspect the live tool schema before constructing mutations. If a required
mutation tool is absent, do not write PostgreSQL directly. Record the gap and
continue safe work that does not require the missing transition.

## Durable operating loop

1. Read status, relevant tasks, approvals, jobs, and recent activity.
2. Select or create one bounded experiment under the correct venture.
3. Perform internal/reversible work without manufacturing owner blockers.
4. Before an external effect, resolve the exact approval and effect
   authorization; include an idempotency key.
5. Store detailed reproducible artifacts in the repository and link them from
   Agent OS using stable IDs and SHA-256 checksums.
6. Record the decision, measured result, lesson, and next action before
   changing ventures or ending the work block.
7. Put only distilled non-secret context into Mem0. On degraded retrieval,
   continue from PostgreSQL and curated evidence.

## Commercial-lock diagnosis

Check these separately:

1. `controls.commercial_lock` from `agent_os_status`.
2. Every P0 readiness gate has authoritative `PASS` evidence.
3. The correct approval is approved, unexpired, scoped to the action, currency,
   cost, and exposure.
4. A tranche approval has a corresponding `operating_tranche_released` audit
   event and the released-capital state changed.
5. The commercial lock has its own authenticated release transition and audit
   event.
6. The intended external action has an authorized, unconsumed effect record.

No item substitutes for another. If approvals are complete but the lock remains
true, report a missing transition or implementation defect rather than asking
the owner to approve the same action again.

## Persistence and memory

Use this precedence:

1. PostgreSQL operational state.
2. Constitutional and governance documents.
3. Curated Markdown evidence.
4. Scoped Mem0 context.
5. Model inference.

Use PostgreSQL for work, money, approvals, effects, and control truth. Use files
for reproducible detail. Use Mem0 for concise preferences, lessons, hypotheses,
and continuity only. Never store passwords, tokens, OTPs, payment data, or
authorization claims in contextual memory.
