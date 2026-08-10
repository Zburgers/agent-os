# Revenue research track

> Operating rule: append only incomplete, money-relevant paths here. Each entry
> must have an owner, status, evidence, and one next action. Research is not
> permission to spend, contact, bid, create accounts, or bypass Agent OS
> approvals. Move a path to the durable daily log and remove it only after the
> path is exhausted, intentionally utilized, or reaches a documented dead end.
> Keep secrets, credentials, OTPs, private keys, raw signatures, and payment
> data out of this file.

Status vocabulary: `queued`, `researching`, `ready_for_approval`, `active`,
`blocked`, `dead_end`, `exhausted`.

## Open paths

### OpenTask read-only seller lane

- Status: `blocked`
- Owner: Goofy
- Evidence: approval `f2cf2936-5b23-4d74-9d98-53b1db2f7853`; effect
  `7e9fd76f-beca-4d25-9ba6-3816d469c14e`; account reached onboarding through
  passwordless email; follow-up authentication returned provider HTTP 429.
- Revenue hypothesis: fresh high-value Python automation, security-audit, and
  OpenAPI work can become a paid seller channel after authenticated discovery.
- Next action: wait for a provider-safe retry window, then obtain a new bounded
  approval before profile completion or read-only API discovery. No bids,
  messages, contracts, payout, wallet, or spend.

### PayanAgent buyer acceptance

- Status: `active`
- Owner: Goofy
- Evidence: request `ks76vc9pzpz3qfgf8aawjckn5n8bezhf` remains open with escrow;
  Goofy bids are pending; the live $0.25 offer is active after effect
  `9df0006c-d967-4593-8eae-b3a38c521e97` corrected its input schema.
- Revenue hypothesis: a buyer acceptance can produce the first settled service
  payment without paid acquisition.
- Next action: read-only monitor only; fulfill only after an accepted bid and a
  separately authorized effect.

### x402/Tollbooth stable distribution

- Status: `blocked`
- Owner: Goofy
- Evidence: local SSRF-safe proof and public 402 challenge pass; current origin
  is an ephemeral tunnel and stable-host approval remains the gating item.
- Revenue hypothesis: $0.25-per-call reliability checks can compound through
  agent-native discovery if the endpoint has durable reachability.
- Next action: verify stable host and deploy only under the exact deployment
  approval; never Funnel the private dashboard or make a paid call.

### BountyBook provider recovery

- Status: `researching`
- Owner: Goofy
- Evidence: latest sampled jobs continue to show provider-side verifier/IPFS
  failures; prior claims and submissions are closed and must not be replayed.
- Revenue hypothesis: a healthy verifier may reopen small crypto bounties with
  positive expected value.
- Next action: sample independent fresh jobs read-only and kill the lane after
  the documented failure threshold; no claim or submission without exact scope.

### PoolTogether / Base maintenance economics

- Status: `researching`
- Owner: Goofy
- Evidence: signer-free observations show stale public winner data and no
  conservative positive-net opportunity; no wallet transaction has been made.
- Revenue hypothesis: only demonstrably profitable permissionless maintenance
  could justify a tightly bounded funded experiment.
- Next action: continue read-only observations; do not fund, sign, or broadcast.

### SporeAgent documented MCP recovery

- Status: `blocked`
- Owner: Goofy
- Evidence: the documented `https://sporeagent.com/mcp` endpoint returns 404;
  the public task feed is not a substitute for an approved undocumented write.
- Revenue hypothesis: a functioning agent-native API could expose higher-value
  FastAPI/pytest work.
- Next action: recheck official docs/status; remove as `dead_end` if the
  documented protocol remains unavailable after the next review window.

### NeuraTech reliability outreach

- Status: `active`
- Owner: Goofy
- Evidence: guarded outreach is effect-linked, but no buyer reply or payment
  has arrived; the first paid pilot remains the objective.
- Revenue hypothesis: tailored, bounded reliability audits convert better than
  passive marketplace listings.
- Next action: reconcile inbox read-only and send only separately approved,
  non-duplicative messages to qualified prospects.
