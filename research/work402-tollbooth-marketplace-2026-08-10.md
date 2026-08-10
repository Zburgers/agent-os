# Work402 and Tollbooth marketplace research — 2026-08-10

## Executive decision

Tollbooth is the most actionable new distribution surface for the existing
Automation Reliability Check, but listing is gated on two facts that are not
currently true: a stable public endpoint and an authoritative dedicated Goofy
payout wallet. Work402 seller onboarding is worth keeping as a future channel,
but its current public job feed contains no executable work, so onboarding is
not urgent.

No provider write, wallet connection, transaction, payment, listing, account
creation, or outreach was performed during this research.

## Tollbooth

- Public site: https://www.trytollbooth.com/
- Listing form: https://www.trytollbooth.com/list
- The site describes buying and selling x402 APIs, agents, and automations with
  USDC settlement on Base.
- The listing form requires an endpoint URL that returns 402 when unpaid, a
  price, a valid `0x` pay-to wallet, and live verification.
- Its client submits the listing to `/api/services`; verification can remain
  pending until a paid replay succeeds. The client bundle also states that the
  replay requires a funded `X402_EVM_PRIVATE_KEY` on the verification side.
- Current blocker: the existing service is on an ephemeral quick tunnel that
  PayAPI rejected, and Agent OS currently exposes only the owner-linked wallet
  publicly. The owner wallet is prohibited for Goofy operations.

Agent OS decision: `9c27febc-4e5d-44ee-82a1-67c897e54528`.

## Work402

- Seller contract: https://www.work402.com/listagent/skill.md
- Public seller page: https://www.work402.com/agent
- Read-only job feed: https://www.work402.com/api/jobs
- The seller contract describes ERC-8004 identity, x402 settlement on Base,
  and USDC/WORK payment. New-wallet onboarding may return a private key and
  provider-funded Base ETH; the contract explicitly requires operator approval
  before persisting credentials or bootstrapping a worker.
- The live public feed returned seven historical records: two `completed` and
  five `cancelled`; there were no open or available jobs to claim.
- Agent OS decision: `8177eb86-22a4-4453-81d6-943157760ea3`.
- Exact pending onboarding approval: `cb48c641-850a-4af9-85e8-5b273cba3a02`.
  It is limited to one truthful identity/onboarding action, protected secret
  storage, and read-only discovery; it does not authorize claims, submissions,
  runtime bootstrap, owner-wallet use, or spending.

## Next permitted action

1. If the persistent-host approval is granted and a dedicated Goofy payout
   address is authoritative, request/execute a separate exact Tollbooth listing
   approval for the existing service.
2. If Work402 approval is granted, perform only its single identity/onboarding
   action and read the job feed; stop if the provider asks for KYC, paid access,
   owner credentials, or an undocumented signature.
3. Continue monitoring PayanAgent and BountyBook read-only. BountyBook remains
   paused because a fresh sample had 20/20 latest verifier failures.

## Source caveat

Marketplace marketing claims are treated as provider claims, not revenue.
Revenue is recorded only after a durable settled receipt is reconciled in
Agent OS.
