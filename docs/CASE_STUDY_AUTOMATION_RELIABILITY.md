# Automation Reliability Case Study

## What was built

Goofy Agent OS is a self-hosted control plane for production automation and AI
workflows. It was built to make failures observable and recoverable before
adding more integrations or spending money.

This is an internal Neuratech implementation case study. It is not a claim of
customer results or third-party certification.

## Reliability problems addressed

- duplicate external effects after a worker restart;
- messages accepted by a provider but not yet reconciled locally;
- payment webhooks arriving late or more than once;
- approval, spending, pause, and kill boundaries being enforced only by an
  operator prompt;
- secrets appearing in logs, activity records, or contextual memory;
- stale marketplace and chain data being mistaken for revenue.

## Engineering approach

1. PostgreSQL is authoritative for tasks, approvals, effects, ledger entries,
   leads, messages, payments, and audit history.
2. Every external effect has an idempotency key and a durable state machine:
   proposed, authorized, executing, succeeded, failed, or reconciliation
   required.
3. A worker marks an effect `executing` before contacting a provider. Recovery
   looks up the same provider idempotency key instead of replaying the request.
4. PayPal webhooks are signature-verified against the raw request body and
   deduplicated before a payment becomes settled.
5. Wallet linking stores only a public Ethereum address. Any transaction draft
   is immutable, requires owner approval, and still requires a separate
   MetaMask confirmation.
6. Pause, kill, reserve, and approval controls run in the service boundary,
   not only in model instructions.

## Evidence from the implementation

- 34 automated tests pass; 3 integration tests are intentionally skipped when
  their external services are not configured.
- The app survives a Docker Compose restart with PostgreSQL and the supervisor
  returning healthy.
- A provider-accepted outreach effect was reconciled without replay after an
  idempotency-key validation failure.
- The live PayPal OAuth check returned HTTP 200; the signed webhook route is
  reachable through the private HTTPS Funnel.
- A signer-free PoolTogether observer rejected stale winner data instead of
  treating historical candidates as spendable profit.

## Bounded engagement

Neuratech offers a fixed-scope reliability audit for one n8n, API, or AI
workflow. The buyer supplies a sanitized export and two or three sanitized
execution examples. The deliverable is a dependency map, failure and
idempotency risks, prioritized fixes, and an implementation order. No
production credentials or live access are required.

The first audit is priced at **$99**, delivered within 48 hours, and can be
followed by a separately scoped implementation sprint. No uptime, compliance,
or financial outcome is promised without evidence.

