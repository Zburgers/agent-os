# Affiliate API / Coupon API

Research opportunity: Create an API that aggregates affiliate offers, coupons, or deals from multiple networks and charges for access.

## Research Questions
- Which affiliate networks have public APIs (ShareASale, CJ, Impact, Amazon Associates)?
- What data do they provide (product info, links, commissions)?
- How to aggregate and normalize?
- Monetization: subscription, revenue share, lead fee.
- Legal: affiliate disclosures, terms of service.
- Integration with Agent OS: can we offer this as a x402 service?

## Latest finding

See [research-2026-08-03.md](research-2026-08-03.md). Rakuten is the best
documented first adapter, but implementation remains gated on owner-approved
publisher access and network permission. Amazon is not a good bootstrap source
because current Creators API access has enrollment and qualifying-sales gates.

## Next Steps

- Obtain owner approval for one specific publisher credential or a sandbox
  sample before any account or network effect.
- Validate a single Rakuten coupon/product normalization path locally.
- Measure freshness and data quality before considering x402 packaging.
