# AuditPal Atlas Bridge static preflight — 2026-08-10

Status: candidate only. No AuditPal submission, RPC call, transaction, fork
execution, exploit deployment, or contact occurred.

## Scope

- Program: Atlas Bridge Smart Contracts
- Target: `BridgeRouter deployment`
- Network/environment: Ethereum / MAINNET
- Published target: `0x4D7A9e7b6fA2dA11aA2b3e4C5D6eF7089A12bC34`
- Source: `https://api.auditpal.io/api/v1/programs`
- Program requires a replayable exploit narrative with chain, target, block
  height, and business impact. This document does not claim those runtime
  facts; it is only a static preflight.

## Candidate finding

### Unauthenticated fee setter can globally break deposits

**Suggested severity:** Medium, subject to provider triage.

`BridgeRouter.setFee(uint256 newFeeBps)` is externally callable without an
owner or role check and does not enforce `newFeeBps <= FEE_PRECISION`. The
published source computes the deposit fee as:

```solidity
uint256 fee = (amount * feeBps) / FEE_PRECISION;
uint256 netAmount = amount - fee;
```

An arbitrary caller can set `feeBps` above `10_000`. For ordinary positive
`amount` values, `netAmount` then underflows and `deposit` reverts, creating a
global deposit denial-of-service until another caller changes the fee. Even
within bounds, any caller can change the economic fee for every depositor. The
shown mock has no fee-recipient transfer, so this preflight does **not** claim
direct fund theft.

## Static proof sketch

1. A caller invokes `setFee(10001)`.
2. A user invokes `deposit(1, destinationChain)`.
3. `fee` is at least `1`, and `amount - fee` reverts under Solidity 0.8 checked
   arithmetic for the minimal amount; larger amounts can also revert when the
   computed fee exceeds the amount.
4. No live call was made; this sequence is a source-level reasoning sketch.

## Remediation proposal

- Restrict `setFee` to an explicit owner/governance role.
- Enforce `newFeeBps <= FEE_PRECISION` and a business-approved maximum.
- Emit a fee-change event and use a timelock for production governance.
- Add invariant tests proving deposits remain executable across the permitted
  fee range.

## Gate for any future submission

The current experiment and registration approval do not authorize reporting.
Before any external submission, Agent OS must show a successful AuditPal
identity, current program eligibility, unchanged scope, and a separate exact
report approval. A future submission must use only the provider's accepted
schema and must not include claims beyond the reproducible evidence.

Decision: `4ada58bf-5fad-4882-8026-35ba55ce0dfb`.
