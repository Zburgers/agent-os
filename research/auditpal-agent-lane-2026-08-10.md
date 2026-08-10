# AuditPal agent lane — 2026-08-10

## Why this lane matters

The current BountyBook verifier sample is failing provider-side, the PayanAgent
bids remain pending, and the current public automation routes are mostly
DM-only. AuditPal is a distinct security-research marketplace with a native
agent API and live USDC programs. It is a higher-upside lead, but account
registration and every finding submission must remain separately controlled.

## Read-only evidence

Source: <https://auditpal.ai/>

- The public product describes an API-first bounty marketplace for AI agents.
- `GET https://api.auditpal.io/api/v1/programs` returned three active programs:
  - OpenLedger Treasury Guard — maximum USD 150,000; reported paid USD 22,400;
    Solidity/TypeScript and Base/Ethereum/off-chain scope.
  - Nebula Wallet Web & Mobile — maximum USD 30,000; reported paid USD 8,800;
    TypeScript/Swift and Ethereum/Solana/off-chain scope.
  - Atlas Bridge Smart Contracts — maximum USD 250,000; reported paid USD
    42,500; Solidity/TypeScript and bridge/relayer scope.
- The live program records require reproducible proof-of-concept evidence,
  specify reputation thresholds, and describe USDC payout windows. These are
  provider claims and not revenue; no report has been submitted.
- `GET https://api.auditpal.io/api/v1/metrics` returned 13 active agents and
  7 reports, including 3 accepted. This is marketplace telemetry, not a
  guarantee of eligibility or payment.

## Bounded experiment

- Experiment: `70574f74-fc7f-4b62-ae32-f9c59cd1470c`
- Hypothesis: one truthful registration plus read-only discovery can unlock a
  materially higher-value channel without spending owner funds.
- Budget and stop-loss: USD 0 / USD 0.
- Success: registration succeeds, protected credentials are stored safely, and
  at least one current program is machine-readable with a truthful capability
  match and a separately approvable report path.
- Failure: KYC, paid access, owner-wallet requirements, ungranted identity
  claims, or no eligible program. Any of these closes the experiment.

## Control boundary

Pending approval `ae29fbf9-73b9-4d4b-9a12-6952267ba1e6` requests exactly one
AuditPal registration using the configured Neuratech business inbox, followed
by read-only GET discovery. It explicitly excludes finding submission, live
exploit attempts, bounty claims, payment, wallet connection, and transactions.
No provider write or account creation has occurred yet.

## Rejected adjacent lanes

- MoltJobs public API currently exposes three records, but their deadlines are
  already past (2026-06-07 and 2026-08-04) and one uses `STRIPE` with pending
  authorization; no bid or registration was justified.
- WorkProtocol reports zero open jobs in its public overview.
- ClawFreelance's own repository currently states that it does not offer
  bounties; no registration or claim was attempted.

## Next action

After the durable AuditPal approval becomes `approved`, execute only the
registration/discovery packet, reconcile the provider response, and create a
separate approval only if a specific eligible bounty and safe report scope are
found. Revenue remains zero until a settled provider receipt is reconciled in
Agent OS.
