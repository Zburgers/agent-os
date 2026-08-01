# Wallet, PayPal, and Tailscale Operations

This document records the production integration surface as of 2026-07-29. It
contains no credentials, wallet secrets, or payment data.

## Ethereum wallet

- Dashboard: `/wallet`; Finance includes a read-only Wallets and digital assets
  section with the linked public address, Mainnet balance, and draft count.
- Network: Ethereum Mainnet only (`0x1`).
- Browser: MetaMask Connect EVM is loaded only when the owner selects Connect.
  MetaMask retains all private-key material.
- Authority: connect is not spending permission. A transaction needs an
  immutable PostgreSQL draft, owner approval, an authorized effect, and an
  explicit MetaMask confirmation. An uncertain submission is never replayed.
- Runtime: `INFURA_PROJECT_ID` is browser-visible and origin-restricted;
  `ETHEREUM_RPC_URL` is server-only. Neither belongs in Git, logs, PostgreSQL
  payloads, or contextual memory.

## PayPal Live payments

- Runtime secrets: `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, and
  `PAYPAL_ENVIRONMENT=live`. Keep the secret in owner-managed runtime config
  only.
- Required reconciliation setting: `PAYPAL_WEBHOOK_ID`.
- The server creates Orders only after a payment effect has been authorized and
  uses PayPal request idempotency. Payment events are accepted only after
  signature verification of the exact original webhook body.
- Subscribe the configured PayPal Live webhook to
  `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`,
  `PAYMENT.CAPTURE.DENIED`, and `PAYMENT.CAPTURE.REFUNDED`.
- Do not enable payouts, refunds, subscriptions, or automatic capture flows
  without their own explicit approval/effect design.

## Tailscale exposure boundary

- Private owner dashboard: `https://razor-crest.tail4792a2.ts.net:8443/`.
- Public callback only: `https://razor-crest.tail4792a2.ts.net/webhooks/paypal`.
- The public callback is configured through Tailscale Funnel on HTTPS port 443
  and proxies only that path to the loopback Agent OS app.
- Verify public delivery from outside the tailnet before registering the URL
  with PayPal. A tailnet lookup can reach a local proxy/certificate instead of
  the public Funnel endpoint and is not an acceptance test.
- To revoke public exposure: `tailscale funnel --https=443 off`.
# Dedicated Goofy agent wallet

The owner-authorized dedicated wallet is separate from the owner's MetaMask. Its
key is stored at `/home/goofy/.hermes/goofy-agent-wallet.key`, owned by `goofy`
with mode `0600`, and mounted read-only into the application container. PostgreSQL
contains only the public address, policy, message hashes, outcomes, and activity.
The dashboard never returns private key material or raw signatures.

Provision the host key once with `node --experimental-strip-types
scripts/provision-agent-wallet.mjs`. After migration/deployment, register its public
address through the owner-only `POST /api/agent-wallet/provision` endpoint. The
agent-only `POST /api/agent-wallet/sign-message` endpoint currently accepts only
BountyBook authentication nonces. Transaction signing is disabled until its
ledger/effect/spending implementation is separately verified.

On 2026-08-01, bounded transaction simulation was added without public-network broadcast. The dedicated wallet remains separate from MetaMask. Platform policy versions are immutable and draft by default; owner activation/revocation is authenticated and audited. Receiving funds is allowed. Withdrawals require the governed transaction path with effect, ledger, reserve, simulation, idempotency, pause/kill, nonce, fee, and reconciliation evidence.
