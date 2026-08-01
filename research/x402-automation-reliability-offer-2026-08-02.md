# x402 Automation Reliability Check — Offer Packet

Status: bounded zero-spend experiment `a415a834-2c75-4f29-b0f9-b777a28263f1`.

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

