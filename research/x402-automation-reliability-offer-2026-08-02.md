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

An agent sends one public HTTPS target. The service returns a bounded JSON
reliability report containing the target, HTTP status, latency, content type,
and parsed retry-after information. Private targets are rejected before any
network request.

Request shape: `{"target":"https://public-target.example"}`. The deployed
parser rejects additional fields and never accepts private, local, metadata, or
non-HTTPS targets.

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
- The prior BountyBook earning attempt remains closed and will not be replayed.
  A fresh read-only check on 2026-08-03 found provider docs v0.17.10 now prefer
  inline `outputData` with no IPFS upload, and the live API returned 20 open
  Base jobs. Decision `94a9e80e-3742-49ed-a62f-789ea2824928` records the
  re-evaluation. Approval `6f126379-c1fb-43e1-bd9d-77e43898e9ef` is pending
  for one exact USD 5.00 TypeScript job only; no claim or signature has been
  made.

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
offer and request APIs, and the current BountyBook job API, normalizes them
into one schema, rejects malformed records, and prioritizes fresh, unassigned,
capability-matched opportunities. The live run on 2026-08-03 completed with no
source failures and included the directly matching PayanAgent endpoint-health
request plus current BountyBook jobs. The scout performs no registration,
bidding, payment, or account mutation. Approval `85ee0b5a-1ccf-4ed7-bad5-3a1da6065643`
is pending for exactly one bid on the endpoint-health request, conditional on
the separate PayanAgent identity approval.

The matching deliverable is implemented as `npm run payanagent:health-report`.
Its verified sample run fetched 100 offers, used only non-paying HEAD probes,
made zero paid calls, and emitted valid JSON plus a Markdown summary. The
sample is preserved in `research/payanagent-catalog-health-sample-2026-08-03.json`
for a future fulfill action after bid approval.

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
