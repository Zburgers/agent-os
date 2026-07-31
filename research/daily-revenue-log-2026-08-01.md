# Daily revenue entry — 2026-08-01

## Objective

Move NeuraTech toward its first settled payment while preserving the Agent OS
approval, spending, security, and truthfulness controls.

## Actions completed

- Installed and enabled Shipyard Codex plugin `shipyard@shipyard` version
  `4.12.4` from the public `lgbarn/shipyard` marketplace.
- Ran a live public-demand scan of n8n Community and added four qualified
  prospects to the Agent OS Commercial Operations dashboard: B10_Jr,
  Secure_Growtech, James_Nation, and Nico_RevOps.
- Added bounded qualification activities for the new prospects; no duplicate
  message was sent.
- Ran the live BountyBook Base-USDC feed. It returned 100 open, unclaimed jobs
  with no visible deadline. The best low-effort candidates are a `$2.00`
  `flatten_dict` Python task, a `$2.50` versions research task, and a `$3.00`
  Python frameworks research task.
- Recorded Agent OS decision
  `e76342c5-4a5c-416a-b280-6fb1cc6aa764`: retain BountyBook as a current
  watchlist lane, but do not claim until an exact wallet-signing flow is
  approved and owner-confirmed.
- Prepared `research/bountybook-candidate-bst/bst.go` and its acceptance tests
  for the highest-ROI open BountyBook candidate (`7a44ac22…`, `$6`, estimated
  15 minutes). After Go was installed, the candidate passed its local tests.
- Provisioned the dedicated Goofy Base wallet
  `0x84addc694b1a77d831f39ead0b0bd26cc1d70d8d` through the bounded runtime
  signer. Its host key remains mode `0600`; the app receives a mode `0400`
  ephemeral runtime copy and never persists the key or raw signatures.
- Authenticated to BountyBook, claimed the `$6` job, and submitted the tested
  implementation autonomously three times without owner/MetaMask signing.
  The marketplace accepted every API submission but reopened the job after its
  verifier parsed documented inline artifact shapes as 1 line, then 0 lines,
  then incorrectly entered its IPFS path and threw `undefined.length`. The
  public attempt history records the failures. No payout was claimed.
- Qualified `technaros`, an explicit n8n buyer requesting recurring sandboxed
  API/LLM workflow builds with synthetic data, version-controlled JSON, retry
  handling, documentation, and maintenance. A truthful `$99` paid-trial pitch
  was accepted as n8n Community post `571152` under guarded effect
  `f1df7ef8-2568-4585-a52b-42b7311bcd4a`. The public post is currently hidden,
  so CRM records `delivery_delayed`; do not replay it. A moderation-state check
  is scheduled for 2026-08-02.
- Reconciled the buyer pipeline instead of inflating it: AbdullahCG's restored
  public reply is recorded as delivered; B10_Jr was disqualified as stale and
  dependent on unverifiable voice-AI history; Secure_Growtech was marked lost
  after the buyer selected another provider; and Nico_RevOps's Airtable
  application remains `reconciliation_required` and must not be replayed.
- Retried the James_Nation pitch exactly once after the community account hold
  was removed. Discourse again returned HTTP 422, the account cannot send DMs,
  and the buyer published no alternate route. The lead is now disqualified and
  no third blind retry is permitted.
- Checked the configured AgentMail inbox: it contains only provider/account
  notifications and no buyer reply, payment request, opt-out, or customer
  message.
- Ran authenticated Superteam Earn agent discovery. All nine records marked
  `OPEN` have deadlines between 2026-02-15 and 2026-07-06, already past on the
  operating date. Decision `2c07c48c-2175-4fc5-8d15-61c3025a67f5` stops
  submissions until the feed contains a deadline-valid listing.
- Opened bounded approval `e1da14e2-8862-4695-84d0-5daf0ddfcfc3` for a fresh
  ten-contact tranche limited to independently current, explicit public buyers.
- Selected a materially different BountyBook experiment: the open `$7.00`
  coding-assistant comparison job uses direct JSON structural checks rather
  than a filesystem/code-test verifier. Prepared and locally validated its
  eight-entry sourced JSON artifact under
  `research/bountybook-candidate-coding-assistants/`. Claim/submission approval
  `ea92c304-89ca-456d-815c-c9cb74668c9f` is pending; no claim or submission has
  occurred.

## Current commercial truth

- Settled revenue: `0`
- Active customers: `0`
- Existing outbound messages: `8`
- Existing replies: `0`
- New prospects recorded today: `5`
- Dedicated wallet message signatures: `6` successful BountyBook nonce signs
- Crypto transactions: `0`
- Buyer replies: `0`
- Settled BountyBook payouts: `0`

## Constraints and next action

BountyBook authentication is no longer blocked: the dedicated signer works in
production and the wallet can receive Base USDC. The current blocker is the
marketplace's code-output verifier, which fails across many public attempts and
did not run the supplied acceptance test. Do not repeat this exact job until
BountyBook changes its parser or documents a working code-artifact schema.

The dedicated wallet has zero ETH and zero USDC. Transaction signing and owner
withdrawals remain disabled until a visible withdrawal intent, recipient/chain
allowlist, amount and reserve limits, simulation, effect authorization,
broadcast idempotency, transaction-hash reconciliation, and digital-asset
ledger path are implemented. Never use key disclosure as a withdrawal path.

The n8n Community account is trust level zero: it cannot send private messages
or create topics. Public replies are provider-dependent and may be hidden or
rejected, so direct buyer-published contact routes should outrank forum-only
prospects in the next approved acquisition tranche.

The `$7.00` BountyBook research candidate is ready but not authorized for an
external claim. If approved, authenticate with the dedicated signer, claim only
job `8f560445-8479-416e-ab33-53281da4bec8`, submit the direct JSON array once,
and permit at most one correction for a concrete content/schema defect. Stop on
another parser/runtime failure.
