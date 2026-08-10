# PayanAgent catalog-health checkpoint — 2026-08-10

- Observed at: `2026-08-10T09:50:31Z`
- Command: `node commercial/deliveries/payanagent-catalog-health-checker.mjs`
- Scope: 100 public offers, unauthenticated `HEAD` probes only; `paidCalls=0`.
- Result: 92 reachable, 8 non-alive (all observed as HTTP 5xx on the public
  buy-gateway surface).
- Raw run checksum: `sha256:8d50190748e22a44070b179f71aa62d4d778328ffec232d8d77891efbd7fac00`
  (the transient JSON output is reproducible from the command and was not
  copied into a secret-bearing location).
- Revenue result: no buyer acceptance or payout; no external write occurred.
- Durable decision: `57016391-7a59-4f8e-a8b3-155682304c5e` keeps the existing
  PayanAgent bids monitor-only and forbids duplicate bids, premature
  fulfillment, new listings, and spending.

The report is preparation evidence for the existing escrowed catalog-health
request, not a fulfillment or acceptance claim. Fulfillment remains gated on
buyer acceptance and a matching effect authorization.
