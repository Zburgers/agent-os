# Agent402 distribution experiment — 2026-08-10

## Opportunity

Agent402.Tools exposes a free `POST /api/index/register` seller flow. Its
public seller documentation says submissions are probed for an x402 challenge,
healthy origins enter the Smart Order Router, and settlement is direct to the
seller wallet with no listing fee or platform take. This is a distribution
surface, not a new product or payment rail.

Research sources:

- <https://agent402.tools/sell>
- <https://agent402.tools/marketplace>
- <https://agent402.tools/docs>

## Current service evidence

- Origin: `https://floors-pickup-european-theory.trycloudflare.com`
- `GET /healthz`: HTTP 200
- `GET /.well-known/x402`: HTTP 200
- Unpaid `POST /v1/check`: HTTP 402
- No payment, signing, or paid call was made.

## Bounded action packet

Submit exactly one truthful registration for the existing Automation Reliability
Check origin. Preserve the $0.25 Base-USDC quote and the dedicated Goofy payout
address already used by the service. Do not create an account, subscription,
Featured placement, second listing, or additional route. Verify the provider
response and public listing only; do not call the paid endpoint.

## Stop conditions

- Reject or defer if the endpoint is no longer healthy, the provider asks for
  payment/credentials, or the request would expose the private dashboard.
- Do not retry an ambiguous POST; reconcile with read-only provider/catalog
  checks first.
- The quick-tunnel hostname is ephemeral, so this is a short-lived demand test,
  not a substitute for a stable production host.

