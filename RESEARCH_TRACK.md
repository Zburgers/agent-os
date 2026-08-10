# Revenue research track

> Operating rule: append only incomplete, money-relevant paths here. Each entry
> must have an owner, status, evidence, and one next action. Research is not
> permission to spend, contact, bid, create accounts, or bypass Agent OS
> approvals. Move a path to the durable daily log and remove it only after the
> path is exhausted, intentionally utilized, or reaches a documented dead end.
> Keep secrets, credentials, OTPs, private keys, raw signatures, and payment
> data out of this file.

> Handoff rule: put dated source notes and artifacts in `research/`, reconcile
> every material result through Agent OS PostgreSQL/MCP, and leave one concrete
> safe next action. A fresh operator must be able to resume without guessing
> whether an external write already happened. See `research/README.md`.

Status vocabulary: `queued`, `researching`, `ready_for_approval`, `active`,
`blocked`, `dead_end`, `exhausted`.

## Open paths

### Outreach conversion and deliverability

- Status: `active`
- Owner: Goofy
- Evidence: research packet `research/outreach-conversion-and-deliverability-2026-08-10.md`;
  FTC CAN-SPAM, UK ICO B2B/PECR guidance, Google sender guidance, AgentMail
  header support, and Gong's 85-million-email analysis. Public-route OSINT is
  recorded in `research/osint-public-contact-routes-2026-08-10.md`; it found
  published company inboxes for two already-contacted prospects plus the
  already-contacted Synergy Effect route (`info@s-e.lt`), while no direct
  corporate route exists for the third. The Best 5 Minute Wine Podcast also has
  no published business email and is already contacted through the forum. The
  second ten-contact message approval is
  approved but intentionally paused until sender/legal readiness is verified.
  The 2026-08-10 13:19 UTC market-scout/public-route checkpoint found no new
  duplicate-free executable buyer route.
- Revenue hypothesis: a trigger-based, prospect-focused fixed-price reliability
  offer can convert better than generic capability pitches while preserving
  sender reputation.
- Next action: obtain the NeuraTech postal address, verify sender/authentication
  and unsubscribe readiness, then re-rank and draft the ten messages without
  sending. Any send remains effect-linked and bounded by approval
  `a3cb2726-7b5b-43e7-98a7-ac3e5607d550`.

### Agent402 x402 index distribution

- Status: `active`
- Owner: Goofy
- Evidence: historical approved effect `4aecdc3a-89b3-4649-950c-b05075a38e29`
  registered the origin as `Goofy Automation Reliability Check`; complete
  pagination now finds it on public index page 24 with one tool, health `1`,
  and `routable=true`. A later first-page-only preflight missed that low-rank
  entry and one additional guarded POST was attempted under effect
  `3e1963dd-213e-4bdb-bd78-10b3f1a12362`; its postcondition was marked failed.
  No further replay is permitted.
- Revenue hypothesis: index routing can expose the $0.25 Base-USDC check to
  buyer agents without a listing fee.
- Next action: read-only pagination and paid-attempt monitoring only; revisit
  after a stable origin exists. Never submit another registration for this
  origin.

### PayAPI Market provider listing

- Status: `blocked`
- Owner: Goofy
- Evidence: prior approved listing `20662e63-c7a1-41c4-8d60-a71076ff5e43`
  remains `pending_review` with payment verification false and the current
  ephemeral origin. Provider research says a stable host is required before
  review can complete; no duplicate listing or Featured placement is allowed.
- Revenue hypothesis: a second machine-readable directory could generate
  paid checks after stable-host verification.
- Next action: deploy or verify one persistent public origin under its exact
  approval, then use provider read-only status. Do not resubmit the listing.

### Tollbooth service listing recovery

- Status: `blocked`
- Owner: Goofy
- Evidence: the one approved listing effect
  `142526e8-9d6e-4a37-bdbc-3a5e44832c39` returned provider HTTP 422. No listing,
  payment, wallet signature, or verification spend was performed, and the POST
  must not be replayed or guessed with alternate schemas.
- Revenue hypothesis: Tollbooth could route Base-USDC buyers to the existing
  $0.25 reliability check once its provider contract and stable-host rules are
  satisfied.
- Next action: obtain a stable origin and authoritative provider validation
  contract before requesting any new one-shot listing approval.

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

### AuditPal defensive security lane

- Status: `blocked`
- Owner: Goofy
- Evidence: approved effect `4268c9db-b2d4-4c6d-9225-0931e06a3983` received
  HTTP 201 with `success=true` and a `data` object, but no documented API
  credential was recoverable from the response. No protected secret was
  persisted and no authenticated discovery or report was attempted. The owner
  approved one recovery attempt (`ed0799eb-211f-4184-88ec-b0d9fbb05da4`), but
  the official login page requires checking the Privacy Policy, Terms of
  Service, and Acceptable Use Policy before sending a magic link. That legal
  acceptance is human-only and has not been performed.
- Revenue hypothesis: active USDC programs with historical accepted reports
  could support high-value defensive findings after eligibility and proof are
  verified.
- Next action: owner accepts the three linked AuditPal policies and sends the
  magic link for the possible existing Neuratech account using the configured
  inbox; then Goofy may perform the one approved transient login and read-only
  discovery. Never replay registration, guess credential fields, test live
  targets, or submit a report without a new exact approval.

### PayanAgent buyer acceptance

- Status: `active`
- Owner: Goofy
- Evidence: request `ks76vc9pzpz3qfgf8aawjckn5n8bezhf` remains open with escrow;
  two existing Goofy bids (`jd70q0qe5ky5xz6t97c0rz858h8bsdwk` and
  `jd7aqjve84tnccvxdhtavh9f1d8c7r5e`) are pending; the live $0.25 offer is
  active after effect `9df0006c-d967-4593-8eae-b3a38c521e97` corrected its
  input schema. No third bid was sent.
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
  has arrived; the first paid pilot remains the objective. A second bounded
  message approval `a3cb2726-7b5b-43e7-98a7-ac3e5607d550` is pending for up to
  ten one-to-one messages to existing qualified prospects.
- Revenue hypothesis: tailored, bounded reliability audits convert better than
  passive marketplace listings.
- Next action: wait for that exact approval, then reconcile inbox read-only and
  send only its non-duplicative messages; stop on opt-out, provider warning, or
  ambiguous delivery.
