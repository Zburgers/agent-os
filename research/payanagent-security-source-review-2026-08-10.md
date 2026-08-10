# PayanAgent security-bounty source review — 2026-08-10

## Scope and authorization boundary

- Repository reviewed read-only: `https://github.com/derNif/payanagent.git`
- Reviewed commit: `51a7425` (`fix(escrow): deterministic ERC-3009 nonce per payout — retries can never double-transfer (#113)`)
- Marketplace request: `ks72wtaz7zm77kb8hwsnpkhpzx8bep72` (5-cent escrowed security bounty)
- Existing Goofy bid: `jd75f1h4k6269mxwd9x09p64218bs4kk`, still pending.
- The current Agent OS approval authorizes one bid only. It does **not** authorize
  live testing, payment movement, use of third-party agents, or the required
  private disclosure. No external write or paid call was made during this review.

## Evidence reviewed

- `SECURITY.md` and its own-two-test-agents / <=$0.10 / private-first proof standard.
- `src/app/api/v1/requests/route.ts` request creation and escrow deposit ordering.
- `src/app/api/v1/requests/[requestId]/approve/route.ts` and `cancel/route.ts`.
- `convex/requests.ts`, `convex/receipts.ts`, and `src/lib/escrow-release.ts`.
- `src/lib/x402.ts`, `src/lib/x402-settle.ts`, `src/lib/auth.ts`, and validation.
- Existing escrow-release tests, including deterministic payout nonce and pending
  receipt safeguards.

## Candidate finding (unverified)

`POST /api/v1/requests` settles an escrow payment before inserting the request row.
If request creation then fails (for example, an invalid `providerId`/Convex ID or
another database-side rejection), the buyer has already paid the platform but the
route returns an error without a request-linked escrow-deposit receipt or refund.
This is a payment-before- durable-intent ordering flaw and can strand buyer funds.

The review did **not** execute this path, submit malformed paid requests, create
test agents, move USDC, or probe the live service. Therefore this remains a
candidate until reproduced against two agents under a fresh, exact approval.

## Negative findings / controls observed

- Escrow approval and cancellation acquire a serialized `completing` lock before
  payout and reject unresolved pending receipts, materially reducing double-release
  risk.
- Payouts write a pending receipt before transfer and derive a deterministic
  ERC-3009 nonce from the request/settlement identity.
- Convex writes are platform-secret gated; API-key routes authenticate and apply
  per-IP and per-key rate limits.
- Public projections redact private offer endpoints, payloads, owner email, and
  discovery metadata.

## Decision boundary

Do not attempt a PoC or email disclosure under the existing bid approval. If the
request becomes accepted, create a separate approval for an own-two-agent,
<=$0.10 test and private disclosure. If it is not accepted, retain this as a
reusable source-review lead and do not spend funds.

