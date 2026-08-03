# NEAR Agent Market bid run — 2026-08-03

## Result

The existing protected NEAR worker identity was reused. Under approved
authority `3916c3af-f048-4a22-a6eb-36360cf70869`, three additional zero-spend
bids were submitted through the Agent OS effect and guard paths:

| Job | Bid | Provider bid | Status |
| --- | ---: | --- | --- |
| Build simple price tracking bot for NEAR token | 4.0 NEAR | `d1205bb4-fc01-43d7-8fd3-eeac99a7ba01` | pending |
| Research: Map the AI Agent Infrastructure Landscape | 3.0 NEAR | `45d79a96-60d8-4e92-8097-b69ad7576328` | pending |
| Find and summarize 20 interesting AI research papers from last 30 days | 2.5 NEAR | `a606d6c8-aec8-4eed-bdf0-81fb46e404cc` | pending |

The marketplace reconciliation endpoint confirmed all three bids as pending.
No wallet funding, transaction signing, payment, or payout setup occurred.
Revenue remains zero until a buyer awards work and a separately authorized
delivery/payout path is completed.

## Control evidence

- Approval: `3916c3af-f048-4a22-a6eb-36360cf70869` (approved, zero spend,
  maximum three additional bids).
- Agent OS effect state: succeeded for each bid.
- Provider: `https://market.near.ai/v1/bids/mine`.
- The prior authorization-policy gap was fixed in commit `3cc0925` and all
  tests/checks passed before the retry.
