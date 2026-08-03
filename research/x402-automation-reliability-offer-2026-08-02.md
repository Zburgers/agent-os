# x402 Automation Reliability Check — Offer Packet

Status: active bounded experiment `a415a834-2c75-4f29-b0f9-b777a28263f1`; public
zero-cost deployment verified on 2026-08-03.

## Live offer verification

- Public endpoint: `https://shirt-weekly-hudson-natural.trycloudflare.com/v1/check`
- Health check returned HTTP 200.
- An unpaid check returned HTTP 402 with a Base-USDC payment requirement.
- Payout address is the already linked public Goofy wallet address; no wallet
  signing or funding was used.
- Facilitator: PayAI's free-tier facilitator, using the official x402 SDK and
  its Base mainnet support. The paid route remains stateless and isolated from
  Agent OS.
- This quick tunnel is an experiment endpoint with no uptime guarantee. A
  named tunnel or managed host is required before treating it as production.

## Offer

An agent sends a webhook or automation endpoint plus a test payload. The service
returns a deterministic reliability report: DNS/TLS reachability, HTTP status,
latency, retry behavior, response shape, and a short remediation checklist.

Proposed launch price: **$0.25 USDC per check** (Base, x402). A batch of ten
checks can be priced at $1.50. No customer data is retained beyond the report
id and hash needed for reconciliation.

## Why this lane

- The existing Neuratech asset is an automation reliability sprint and already
  has demand-validation outreach.
- Tollbooth documents x402 per-call USDC settlement and a marketplace for
  services/automations: https://www.trytollbooth.com/
- This is a concrete, machine-readable deliverable rather than a generic agent
  profile or speculative token position.

## Guardrails

- Local proof first; no public bind, wallet connection, paid request, or account
  registration in this experiment.
- Reject private-network targets, localhost, link-local, cloud metadata, and
  arbitrary ports to prevent SSRF.
- Enforce request timeout, response-size limit, rate limit, and idempotency key.
- Never expose Agent OS, PostgreSQL, credentials, or the dashboard through the
  check endpoint.
- Public deployment and x402 settlement require a separate authorized effect,
  allowlisted recipient/payment policy, simulation, and reconciliation.

## Current distribution research

- [PayAI facilitator](https://docs.payai.network/x402/quickstart) provides a
  no-key starter path and lists Base mainnet support; the current service uses
  its official facilitator configuration.
- [Agent402](https://marketplace.agent402.app/) and [402.rest](https://www.402.rest/)
  are candidate discovery channels for a free listing, but registration and
  listing are separate external account effects and have not been performed.
- [SporeAgent](https://sporeagent.com/) exposes an agent task API and open task
  listings, but the currently visible tasks are stale and its registration/bid
  path has not been authorized.
- BountyBook remains excluded by the durable verifier kill decision; its latest
  target still fails the provider's IPFS verification path.

### 2026-08-03 non-n8n scan

- [PayanAgent](https://payanagent.com/) documents free provider registration,
  API-first offers, and x402 USDC settlement on Base. It is the first
  distribution target because its provider flow can publish one bounded offer
  without paid hosting or wallet funding.
- [Agent402](https://marketplace.agent402.app/) advertises free registration,
  discovery, and x402 settlement, but its ownership and identity flow needs a
  separate review before use.
- [402.rest](https://www.402.rest/) is a live x402 API directory with free
  browsing and a publish path; no account or listing was created.
- [NEAR Agent Market](https://market.near.ai/jobs) showed 79 open jobs, but the
  visible open listings were approximately 175--179 days old and heavily bid.
  Newer listings were already in progress, so no additional bid was placed.
- [SporeAgent](https://sporeagent.com/) returned HTTP 200 for its health and
  open-task APIs, with 12 open tasks. The best verified fit was task
  `95e8faa1-55f7-4b87-8e13-8fe9d3bded1c`, a USD 80 FastAPI/pytest suite with
  six existing bids and no assigned agent. It is an opportunity, not revenue:
  the task was posted in March and the provider's public API does not itself
  prove buyer funding or freshness.
- Approval `04f44d64-69a0-4695-b870-8ef00cbfbe3c` is pending for exactly one
  free PayanAgent provider identity and one offer listing. Until it is approved,
  the endpoint remains live but undiscoverable through that marketplace.
- Approval `0e8d0e41-34ed-4589-a7ff-def7f7819038` is pending for exactly one
  free SporeAgent identity and one capped bid on the verified pytest task. No
  registration, bid, contract, or delivery has been performed.

### Repeatable read-only scout

`npm run market:scout` now queries the public SporeAgent task API, PayanAgent
offer API, and PayanAgent request API, normalizes them into one schema, rejects
malformed records, and prioritizes fresh, unassigned, capability-matched
opportunities. The live request scan found a directly matching “Build a catalog
endpoint-health checker” request with a USD 0.04 maximum, plus a separate
security/x402 bug bounty. The scout performs no registration, bidding, payment,
or account mutation. Approval `85ee0b5a-1ccf-4ed7-bad5-3a1da6065643` is pending
for exactly one bid on the endpoint-health request, conditional on the
separate PayanAgent identity approval.

## Acceptance test

1. A local test endpoint accepts a safe public HTTPS URL and returns a stable
   report schema.
2. Replaying the same idempotency key does not perform a second check.
3. Unsafe targets are rejected before network access.
4. A marketplace-ready listing and a truthful example report are generated.

## Kill criteria

Stop if safe SSRF controls cannot be demonstrated, if settlement requires
unbounded wallet authority, or if no viable buyer/distribution path is found
after one bounded listing test.
