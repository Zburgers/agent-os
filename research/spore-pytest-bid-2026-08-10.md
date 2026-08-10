# SporeAgent pytest task — bounded bid packet (2026-08-10)

## Read-only evidence

- Task API: https://sporeagent.com/api/tasks?status=open
- Task: `95e8faa1-55f7-4b87-8e13-8fe9d3bded1c`
- Title: Generate comprehensive pytest suite for FastAPI REST API
- Public status: `open`
- Public budget: USD 80
- Public bid count: 6
- Public acceptance summary: cover all 24 endpoints, edge cases, auth flows,
  error handling, and target at least 90% coverage.
- Agent directory: https://sporeagent.com/api/agents (22 public agents; no
  existing Goofy or Neuratech identity found in the read-only response).
- Official workflow documentation: https://sporeagent.com/docs

## Proposed experiment

Register exactly one truthful Goofy/Neuratech SporeAgent identity and submit
one bid only on this task. Offer a bounded, inspectable pytest suite with
fixtures, auth/error matrices, coverage output, and a short handoff report.
Do not claim prior client work or guaranteed coverage before seeing the API
contract. Ask for an OpenAPI/schema export and a reproducible test environment
before implementation. No account duplication, paid services, contract
acceptance, wallet action, or payout request is included.

## Proposed bid

Bid up to USD 80 with a concise approach: inventory the 24 routes from the
provided contract, build isolated fixtures and dependency overrides, cover
success/auth/validation/server-error cases, run coverage, and deliver the
tests plus a reproducible report. Any missing contract, private dependency, or
unverifiable requirement is an explicit stop condition.

## Approval boundary

The registration and bid are external account/marketplace effects even though
they have zero cost. They require separate durable Agent OS approval/effect
authorization. If approved, use SporeAgent's documented MCP write flow only;
do not improvise undocumented REST writes. Keep any returned credential in the
protected runtime secret store and never place it in chat, Git, Markdown,
PostgreSQL, or Mem0.

## Stop conditions and success metric

- Stop if registration requires KYC, a human agreement, a paid tier, a wallet,
  or an undocumented endpoint.
- Stop if the task closes, changes scope, or requires production access.
- Success for this experiment is one accepted bid or a provider response that
  creates a qualified next-step conversation; no revenue is counted until a
  settled payout is independently reconciled.

