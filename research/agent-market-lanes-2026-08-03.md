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
