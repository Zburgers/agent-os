# Changelog

## 2026-08-10 — stable-host revenue checkpoint

- Added the durable Agent OS experiment `6feb9fae-550c-4892-bead-846192c67f25`
  and decision `84a3a8c5-2fa8-4d56-b98c-afc0b4d0294f` selecting a persistent
  accepted HTTPS origin as the next x402 revenue test.
- Added pending approval `aaade397-babb-4669-898f-de535ed6f967` for one
  zero-cost stable-host deployment; it does not authorize spending, duplicate
  listings, outreach, wallet actions, or public dashboard/database exposure.
- Reconciled the approved BountyBook, SporeAgent, Agent402, and PayanAgent
  paths without replaying exhausted or still-pending external effects.
- Recorded the402 provider research decision
  `daff8337-e0a0-4e58-aafd-528cecfab266`: defer onboarding until the stable
  host and owner-account boundary are resolved; no paid registration or wallet
  creation was attempted.
- Added the inert Tollbooth listing packet
  `research/tollbooth-automation-reliability-packet-2026-08-10.md` and durable
  decision `85fbf857-b9d3-48dc-850c-4a0a696540c4`. No wallet connection,
  listing, signature, paid replay, or external write was performed.

## 2026-08-10

- Executed the single approved BountyBook vector-database JSON attempt for job
  `0773e126-08fb-4b80-a3f7-ed67e2261cdf` using effect
  `f71ad032-a674-40ad-95dd-67bad3f52d3f`. The inline payload was accepted but
  the provider verifier failed in its `ipfs_fetch` fallback and reopened the
  job; payout status is `none`, so revenue remains zero. Recorded decision
  `2e49aa5a-b370-4fdd-aeba-c4316ec4c36b` and closed this lane without replay.

## 2026-08-10

- Closed the BountyBook AVL lane after its final approved attempt failed in the
  provider IPFS fallback, and staged a validated structured vector-database
  JSON candidate for job `0773e126-08fb-4b80-a3f7-ed67e2261cdf` (USD 5.00).
  Created experiment `f7a5fe44-86ad-45cf-896d-9b180a3fe1e9` and pending
  approval `389f9ac3-b995-4c4d-8847-627fef0accd7` for one claim and submission.

## 2026-08-10

- Executed the one approved AVL retry with a files-only payload. BountyBook
  again rejected it as zero lines and reopened the job; no payout occurred.
  Recorded effect `69a42b86-ed92-498a-9d2b-9bf69febdb1e` as requiring
  reconciliation and created final approval
  `905133a1-5bf1-426b-9475-fc8dd99c7efa` for a stdout-source payload, with a
  permanent stop condition after that attempt.

## 2026-08-10

- Executed the approved BountyBook AVL claim and one inline submission. The
  provider reopened the job after selecting the optional two-line stdout field
  and failing `sufficient_code`; no payout occurred. Recorded the terminal
  effect failure and created retry approval
  `b81ed67c-124b-4f24-8985-bf6d88f9059f` for one corrected no-stdout payload.

## 2026-08-10

- Prepared a validated zero-spend BountyBook AVL-tree revenue candidate for
  open job `1063de95-75f4-4170-8879-f5b1b683bb9b` (USD 15.00 USDC) and created
  exact approval `74c4d5ca-c182-44c9-9b5c-bd505bbab04d` for one claim and one
  submission. No external effect has run; the candidate is kept under
  `research/bountybook-candidate-avl/`.

## 2026-08-10

- Verified a second current paid buyer (HiphopKR) and sent one tailored,
  zero-cost architecture-first proposal under the approved outreach tranche.
  Persisted experiment `3bc9c19d-81ff-41c0-bb78-e83c9919a55c`, decision
  `2101519c-830e-44f2-ba6b-d4a4ffec7349`, outreach artifact, effect
  `01826580-b1e2-4a63-9806-b11514417d1e`, AgentMail receipt, and CRM lead
  `443a2923-4f66-45c7-b1b2-8b5462de230d`. No payment or contract action was
  taken.
- Researched a current explicit Videngineer hiring request and sent one
  individually tailored, zero-cost email under the approved outreach tranche.
  Persisted experiment `d2a1da48-18b8-43dd-92f4-353414df2eae`, decision
  `fd920705-e4df-4304-ae23-b69e241a23fb`, outreach artifact, effect
  `6eca962e-a60a-43df-ad23-c86b7ac97051`, AgentMail receipt, and CRM lead
  `12da621e-b3f9-49a5-be08-771f487e239d`. No payment or contract action was
  taken.
- Executed the owner-approved Agent402 registration once through effect
  `4aecdc3a-89b3-4649-950c-b05075a38e29`; provider returned `listed: true`,
  Base-routable health 1, and no payment occurred. Recorded the receipt and
  the low-rank public-index limitation in the Agent OS daily log and research
  packet. The approval is now reconciled as approved; no registration replay
  was attempted.
- Prepared the higher-value SporeAgent pytest lane from read-only evidence and
  persisted its experiment, decision, checksummed bid packet, and exact
  zero-cost approval request `4f527379-b0d2-4eb6-aa76-f87a5c46e733`. The
  approval is approved, but execution remains deferred because the provider's
  documented MCP endpoint currently returns 404. No undocumented REST write,
  credential creation, bid, contract, wallet, or payment action was performed.
- Ran a fresh zero-spend market scout and PayanAgent catalog-health report.
  Seller listings were not mistaken for awarded buyer work; 100 public offers
  were probed with non-paying HEAD requests and paidCalls remained 0.

## 2026-08-10 — Revenue execution and x402 recovery gate

- Added bounded PayAPI Market distribution experiment `320c1dfe-1c09-48e7-aec0-207619602307` and decision `23cf9a3d-463d-471e-ac01-0c2875a343ef` after a fresh read-only verification of its free provider listing flow. Created exact pending approval `2bb81d92-0a3d-47db-9dc4-dd0e96cd3142` for one free listing only; no PayAPI submission, payment, featured placement, or wallet action occurred.
- Revalidated the live x402 origin (health 200, discovery 200, unpaid check 402) and ran the catalog-health deliverable against 100 public PayanAgent gateways with zero paid calls. The escrowed request remains open and both Goofy bids remain pending; no duplicate bid or fulfillment was attempted.
- Owner approval `2bb81d92-0a3d-47db-9dc4-dd0e96cd3142` authorized one guarded PayAPI submission. The provider request was sent once, but the first reconciliation call omitted a required idempotency header; the effect is now durably marked `reconciliation_required` and the listing request was not replayed. No payment or wallet action occurred.
- Read-only PayAPI data confirmed the single listing was created: listing `20662e63-c7a1-41c4-8d60-a71076ff5e43` is `pending_review`, payment verification is false, and the approved $0.25 origin, Goofy/Neuratech identity, and one-endpoint metadata match. Decision `e8dae4c4-fa45-4337-ab8f-e76c75e9f251` records the evidence; no duplicate POST or Featured subscription was attempted.
- Performed a zero-spend, read-only review of PayanAgent commit `51a7425` for the already-pending security bounty. Persisted experiment `8689f7d3-58b4-4534-bd8b-1c3582864411`, decision `a5cff20f-9a00-42f8-8dd6-2288e9cd310d`, and the reproducible artifact `research/payanagent-security-source-review-2026-08-10.md`. The review found a candidate payment-before-request-insert ordering flaw, but no live PoC, payment movement, third-party testing, or disclosure was performed; a separate approval remains required after bid acceptance.
- Researched Agent402.Tools as a free x402 distribution surface and prepared the bounded zero-spend experiment `e860a23b-10ef-4fec-b5a8-ab7e668704d`, decision `f6a62f3a-1db5-406d-b957-12811b08f421`, and packet `research/agent402-distribution-2026-08-10.md`. Created pending approval `353b68ca-e7cd-4cd4-ae7e-6e7d92fde05b` for one exact origin registration; no external write or payment has occurred.

- Recorded the first fresh, effect-guarded public buyer reply for the medical
  consulting practice lead and persisted its CRM prospect, message, delivery
  evidence, and reply-review activity.
- Sent and persisted the one permitted follow-up to Paris ZigZag’s published
  business email after fresh thread activity, with suppression language and no
  second-follow-up path.
- Recorded and suppressed a second forum attempt rejected by provider link
  policy; failed external effects are never replayed.
- Added the dated revenue log and truthful outreach artifacts for this block.
- Detected that the previously deployed x402 tunnel is DNS-dead and created
  pending approval `858b1a84-916b-4057-b89a-c9f4636935d2` for one isolated,
  zero-cost origin recovery. PayanAgent remains inactive until health checks
  pass.
- Found a live, already-escrowed 4 USDC PayanAgent request matching the existing
  catalog-health capability and created pending approval
  `b61adf0c-78f2-4ced-9106-71af926bab4d` for one guarded bid/fulfillment only;
  no marketplace write or wallet spend has occurred.
- After approval, deployed and verified one isolated quick-tunnel x402 origin
  (`floors-pickup-european-theory.trycloudflare.com`) with health 200,
  discovery metadata, and unpaid 402 checks. Authorized deployment effect:
  `432428b0-0834-4a7f-ac93-149cf7d44652`.
- After approval, submitted one 4 USDC bid on the escrow-funded catalog-health
  request; effect `f6812b4b-da5f-4166-910b-32e00ee610d4` succeeded and the bid
  remains pending. Created pending approval
  `5b183bdf-b7b1-4332-8225-f4909b86f095` for the exact existing-offer update to
  the fresh origin because the prior approved hostname is DNS-dead.
- Recorded decision `7276e733-18ff-47e7-bef3-cd31cef201f0` to prioritize
  verified x402 activation and the escrow-funded bid while preserving the
  no-spend/no-paid-call boundary.
- Added and smoke-tested the dependency-free catalog-health bounty deliverable
  in `commercial/deliveries/`; the bid was polled without side effects and
  remains pending, so fulfillment was not attempted.
- Continuation audit confirms the public origin is still healthy, the escrow
  bid is still pending, and the existing listing remains on its stale endpoint
  until exact approval `5b183bdf-b7b1-4332-8225-f4909b86f095` is decided.
- Added one new effect-guarded reply to the fresh n8n Cloud podcast workflow
  buyer (post `573576`), offering a truthful USD 249 Phase 0 and recording the
  prospect and review activity in Commercial Operations.
- Owner approved the exact PayanAgent listing update. Effect
  `4441e0a3-6d98-4e95-9d33-291a97149fa3` sent the metadata-preserving PATCH to
  the fresh origin; direct and public lookups now show one active matching
  offer at $0.25, and the public x402 route returns the expected unpaid 402
  challenge. No paid call or wallet action occurred.
- The effect remains `reconciliation_required` because its initial duplicate
  check was limited to the top-100 catalog; direct/public postconditions prove
  the provider mutation, and the PATCH was not replayed. The 4-USDC request is
  still open with two pending Goofy bids and no fulfillment.

## 2026-08-09 — Agent OS-owned Telegram native approval buttons

- Replaced copy-paste approval commands in Telegram notices with native Approve and Reject inline buttons carrying bounded, hidden callback data.
- Moved Telegram owner-notification delivery from Hermes CLI invocation into the Agent OS host relay using the official Bot API, including callback polling, owner validation, callback acknowledgement, and keyboard removal.
- Added an authenticated Agent OS callback-update endpoint, immutable approval transition/audit handling, protected token-file configuration, and a one-poller Hermes migration boundary.
- Added ADR 0006 and updated integration, runbook, and historical plan documentation.
- Fixed the user-level relay unit for this host's capability model by retaining compatible hardening and removing directives that prevent an unprivileged systemd user manager from starting the relay.

## 2026-08-09 — Durable Telegram job-success notifications

- Added a generic `job_success` notification path for successful supervisor jobs, delivered through the existing PostgreSQL channel outbox and Hermes Telegram relay.
- Enqueued one owner-only, redacted message per job occurrence under the approved standing Telegram message policy; duplicate worker completion paths cannot create duplicate notices.
- Notified on every successful job by default, with `notify_on_success=false` opt-out and meaningful-transition-only behavior for the five-minute NEAR bid monitor to prevent poller spam.
- Passed Telegram recipient and policy configuration to the supervisor, added savepoint isolation so notification failures do not fail completed jobs, and documented the architecture and recovery procedure.

## 2026-08-02 — Persistent NEAR bid monitor

- Added a five-minute durable supervisor job for bid `09d31f07-ca9f-4039-8e78-992b6efe5c29`.
- Each provider check is recorded in job runs and audit activity; a non-pending status transition creates a deduplicated `near_bid_status_alert` event visible in Agent OS.
- Mounted the existing protected NEAR credential as a read-only Compose secret, copied it to an ephemeral mode-0400 agent-owned runtime path before dropping privileges, and ensured the monitor returns and persists no credential material.

## 2026-08-02

- Added a dedicated `/decisions` owner dashboard page that exposes the durable PostgreSQL decision journal with selected options, evidence, expected results, outcomes, lessons, confidence, and review dates.
- Added the Decisions route to primary dashboard navigation, authenticated page routing, and regression coverage so material business decisions are no longer hidden behind the raw API or Telegram command.
- Fixed Compose database authentication after container recreation by removing password interpolation from `DATABASE_URL` and passing Postgres credentials through structured `PG*` environment variables.
- Aligned the existing Postgres role password with the protected Compose runtime secret without deleting or mutating business data.
- Mounted the protected approval-token signing secret into the app container and copied it to a strict agent-owned runtime path before startup, matching the existing protected wallet-key pattern.
- Placed Goofy's first live NEAR Agent Market worker bid on a 4 NEAR technical-writing job and prepared the full draft deliverable for immediate submission if awarded.

## 2026-08-01

- Added an owner-authorized dedicated Goofy wallet with protected mode-0600 key storage, separate from the owner's MetaMask and payment credentials.
- Added default-deny autonomous BountyBook message signing with provider/message allowlists, pause/kill enforcement, derived-address verification, durable rate limits, denial records, and raw-signature exclusion from PostgreSQL/logs/dashboard.
- Added PostgreSQL wallet policy and operation history, Base ETH/USDC balance reporting, authenticated provisioning/signing APIs, wallet and finance dashboard visibility, restart-safe secret mounting, and an idempotent provisioning workflow.
- Added a dated constitutional amendment and updated memory, security, approval, design, implementation, and operator documentation for the autonomous-wallet boundary.
- Updated and validated the `os` skill so future Codex sessions distinguish the owner-linked MetaMask from the bounded dedicated wallet and use the protected BountyBook signer correctly.
- Fixed production key delivery so the host mode-0600 wallet remains read-only while the non-root app receives only a mode-0400 ephemeral runtime copy.
- Provisioned and verified the dedicated wallet in production, including Base ETH/USDC balance visibility and autonomously signed BountyBook authentication.
- Retried the live `$6` Go bounty with a locally tested deliverable; BountyBook accepted claim/submission requests but its public verifier misparsed all documented inline code shapes, reopened the job, and paid nothing.
- Fixed the TypeScript build syntax check so parser failures now propagate instead of being masked by `find`.
- Fixed wallet linking so the `/wallet` page prefers the native MetaMask browser extension provider before falling back to MetaMask Connect SDK.
- Added visible wallet-link progress states for connect, account request, and signature request steps.
- Added regression coverage for direct injected providers, provider arrays, MetaMask `isMetaMask`, provider metadata, fallback provider selection, missing providers, mainnet/no-switch, switch-to-mainnet, and missing-account failures.
- Fixed pre-auth serving for the exact wallet JavaScript assets so browser module loading cannot receive JSON authentication errors.
