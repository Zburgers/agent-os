# Marketplace bounty effect scope

## Decision

Classify a marketplace bounty claim-and-submission as an `account_change`
external effect and allow that effect only when it references an approved
`marketplace_bounty_claim_and_submission` request. This is the smallest change
that makes the existing exact-job approval enforceable. Claiming work changes
Goofy's provider-side state and reserves the job, while submitting changes the
same provider record; neither operation is a deployment, payment, purchase, or
expense.

Adding a new effect kind was rejected because it would require a schema,
dashboard, guard, actor-scope, and migration expansion without improving the
security boundary for the first marketplace experiment. Treating the action as
a deployment was rejected because that would make repository and marketplace
effects share an inaccurate permission class.

## Security and verification

The change does not approve an action, decide an approval, sign a wallet
message, authorize spending, or permit a transaction. `authorizeEffect` still
requires an unexpired owner-approved record, matching actor scope, and healthy
pause, kill, and commercial-lock controls. The exact provider, operation, and
job remain in the immutable effect payload and are checked by the executor and
guard before the external request.

An integration regression test creates an approved marketplace request and
proves that an `account_change` effect can be authorized against it. Existing
tests continue proving that effects without valid approvals fail closed and
that an authorization can be consumed only once.
