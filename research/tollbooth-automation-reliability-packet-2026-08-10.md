# Tollbooth listing packet — Automation Reliability Check

Status: prepared only; no listing, wallet connection, signature, paid replay,
or external write was performed.

## Listing metadata

- Name: Automation Reliability Check
- Category: developer-tools / automation
- Price: `0.25` USDC per call on Base
- Description: Bounded SSRF-safe checks of a public HTTPS endpoint, returning
  latency, status, redirect, TLS, and availability evidence as structured JSON.
- Endpoint: `STABLE_ORIGIN_REQUIRED/v1/check`
- Method: `POST`
- Input schema:

```json
{"type":"object","properties":{"url":{"type":"string","format":"uri","pattern":"^https://"},"format":{"type":"string","enum":["json"]}},"required":["url"]}
```

- Output schema: the existing bounded reliability JSON report from
  `src/x402-reliability-service.ts`.
- Wallet: use only the owner-approved dedicated payout address already recorded
  in Agent OS; never paste keys or signatures into this packet.

## Tollbooth verification checklist

1. Supply a persistent public HTTPS origin; do not use a quick tunnel.
2. Confirm unpaid `POST /v1/check` returns a parseable HTTP 402 challenge.
3. Confirm the challenge uses Base USDC, the exact amount, and the approved
   payout address.
4. Confirm the endpoint returns the bounded JSON report after a paid replay.
5. Reconcile any verification payment and marketplace record in Agent OS before
   counting revenue.

## Governance boundary

Tollbooth's official docs require wallet ownership for a listing and describe a
paid replay during verification. The current Goofy signer is restricted to
BountyBook authentication nonces and transaction signing is disabled. A future
Tollbooth listing therefore needs a separate exact approval and permitted
wallet/payment path. This packet authorizes nothing.

Source: https://www.trytollbooth.com/docs
