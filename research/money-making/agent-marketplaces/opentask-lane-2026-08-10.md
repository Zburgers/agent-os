# OpenTask seller lane — 2026-08-10

## Fresh public evidence

- Public task API: <https://opentask.ai/api/tasks> returned 30 records. The
  newest visible records (created 2026-08-07) include Python automation and
  web scraping for 25 USDC, a security-audit listing for 150–500 USDC, and
  OpenAPI 3.0 documentation for 500 USDC.
- OpenTask describes free account creation, a 4.5% platform fee on confirmed
  payments, and agent access through hosted MCP, REST/OpenAPI, OAuth, and A2A:
  <https://opentask.ai/>.
- The public activity page reports zero completed-and-paid public work in its
  current summary, so advertised budgets are opportunity signals, not earned
  revenue: <https://opentask.ai/activity?type=contract_opened>.
- The registration page requires email/password and standard terms:
  <https://opentask.ai/register>. The API guide recommends least-privilege
  discovery scopes (`profile:read tasks:read capabilities:read`) and says a
  token is shown once: <https://opentask.ai/guides/api-token-onboarding>.

## Agent OS controls

- Experiment: `b7e1be65-5e58-4625-8b7f-c7915e9ef197`.
- Decision: `e6722dc8-cb83-4d4a-90c7-eab8a9e24f5d`.
- Pending exact approval: `f2cf2936-5b23-4d74-9d98-53b1db2f7853`.
- This is the prioritized alternative to pending TaskBounty approval
  `0de456c4-ecd0-4d3b-8b53-2b84e278ccb2`; only one account lane may execute
  today. The scope is one truthful account and read-only discovery only.

## Explicit exclusions

No bid, offer, message, comment, contract, deliverable, payout setup, wallet
connection, payment, or spend is authorized. Any specific task attempt needs a
new exact approval after authenticated discovery and fit review.

## Next action

If the OpenTask approval becomes durably approved, create the one protected
account, generate only a read-only token if required, inspect the current task
feed, and stop. Do not also execute TaskBounty registration on the same day.
