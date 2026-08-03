# Agent-market revenue lanes — 2026-08-03

## Read-only scan

The current x402 provider surface is broader than n8n and PayanAgent. The
following public provider/distribution lanes were reachable during this scan:

- Agentic Market: provider marketplace for paid APIs settled in USDC.
- EndPoints: x402 pay-per-use API monetization with provider earnings.
- Agent402: API listing marketplace; the public landing page currently returns
  an HTTP 410, so it is not an actionable lane until its onboarding endpoint
  is confirmed.
- x402 Bazaar: x402 API marketplace and discovery surface.
- the402: provider onboarding, listing, fulfillment, webhooks, and payouts are
  documented; some agent-facing access supports a free API key or a small
  x402 payment.

## Current decision

Keep these as provider-distribution candidates for the existing x402
reliability checker. Do not create accounts, publish listings, fund wallets,
sign transactions, or pay for discovery under this read-only scan. The
existing bounded endpoint remains live at the current temporary tunnel URL,
but the tunnel is not production-grade and must be replaced with durable
hosting before any paid listing is approved.

## Selection criteria for the next bounded experiment

1. Free provider registration or a documented no-spend path.
2. No wallet funding or transaction signing required for onboarding.
3. A verifiable listing URL/API and clear payout/receipt semantics.
4. Ability to point at an existing truthful endpoint without creating a new
   product or promising unsupported uptime.
5. Separate owner approval for each account or listing effect.

## Evidence

- https://agentic.market/about
- https://www.endpoints.market/docs
- https://marketplace.agent402.app/
- https://www.x402bazaar.org/
- https://the402.ai/docs/

## Follow-up availability checks

- Agentic Market's public landing page is reachable, but the documented
  service-discovery path `https://api.agentic.market/v1/services/` returned
  HTTP 404 during the 2026-08-03 check. It remains research-only until a
  working catalog/provider onboarding route is documented.
- x402 Bazaar's landing page advertises a large catalog, but its exposed
  backend health endpoint was reachable while the observed catalog paths
  returned HTTP 500. No provider onboarding route was verified, so it is not
  selected for an account or listing attempt.
- Agent Bounty's public platform page was reachable, but no stable public
  provider API or onboarding contract was verified during this pass.
- TaskBounty documents a public task feed and USDC/ETH/BTC/USD payouts; its
  live public feed returned an empty `data` array, so it is now monitored but
  not actionable.
- Execution Market documents a public available-task endpoint with agent
  filtering and x402/EIP-3009 settlement. The live endpoint
  `https://api.execution.market/api/v1/tasks/available?target_executor_type=agent&min_bounty=1&limit=50`
  returned an empty task list. It is now included in the read-only recurring
  scout, with no account creation or bid attempted.
- Riner's public API is live at `https://api.riner.io/api/v1/tasks` and returned
  two currently published, unassigned tasks ($1 and $2 USDC). Agent
  self-registration requires a wallet nonce/signature, so no registration or
  application was attempted.

The recurring scout now checks eight public sources: SporeAgent, PayanAgent
offers and requests, BountyBook, the402, TaskBounty, Execution Market, and
Riner. Selection guarantees at least one result per source when a source has
an eligible result, preventing a large catalog from hiding smaller bounty
markets.
