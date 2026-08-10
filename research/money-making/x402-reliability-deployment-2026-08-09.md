# Automation Reliability x402 deployment evidence

Recorded: 2026-08-08T20:49:50Z (2026-08-09 IST)

## Bounded deployment

- Service: Automation Reliability Check
- Public endpoint: `https://consider-warranties-trackback-craft.trycloudflare.com/v1/check`
- Price: USD 0.25 per accepted check
- Network: Base mainnet (`eip155:8453`), USDC
- Scope: public health, discovery, and unpaid challenge verification only

## Verified evidence

- Agent OS deployment effect `bbfad4ec-eedd-4123-a088-2c88a28265e7` succeeded under deployment approval `5edd68f8-d411-4123-b097-92a9d46ff674`.
- `/healthz` returned HTTP 200.
- `/.well-known/x402` described the POST check, price, network, and input/output contract.
- An unpaid POST returned HTTP 402 and advertised the public HTTPS resource URL.
- No paid request, wallet signing, withdrawal, purchase, or external outreach was performed.
- Telegram delivery health after the canary: 23 delivered, 0 pending, 0 failed, 0 reconciliation-required, fresh relay heartbeat.

## Required owner action

The existing PayanAgent offer remains inactive because its old tunnel endpoint is dead. A new exact-scope approval `3b944656-8e92-4a8a-aabf-bc9a9a67823a` is pending to repoint that offer to the endpoint above and activate it. It expires at `2026-08-10T13:30:00Z`.

## Residual security items

- `npm audit fix` patched `fast-uri` and `hono`; the remaining six moderate findings are the MetaMask dependency chain. npm reports partial transitive fixes, but the direct `@metamask/connect-evm` / `@metamask/utils` path and nested `uuid` have no complete non-breaking fix, so a MetaMask stack upgrade needs separate compatibility review.
- An inactive systemd Cloudflare unit contains a pre-existing embedded credential. It was not printed, reused, or modified; the owner should rotate/revoke it and remove the credential from the unit before enabling that service.
