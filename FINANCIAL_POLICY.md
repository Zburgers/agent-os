# Financial Policy

- Record original currency and conversion separately. Contributions are never revenue.
- Ledger entries require transaction ID, timestamp, currency, gross, fees, tax reserve, net, counterparty, venture, experiment, status, provider reference, evidence, idempotency key, and reconciliation state.
- Ledger is append-only; corrections use reversal/adjustment entries.
- Realized net profit = settled revenue - refunds - payment fees - attributable operating expenses - variable infrastructure costs.
- Initial position: INR 5,000 owner capital contribution (never revenue), INR 2,000 settled historical Codex fixed infrastructure expense, and INR 3,000 reconciled cash. INR 0 is initially spendable; INR 2,000 is locked reserve; the INR 500 first tranche requires all P0 gates plus explicit owner release; the INR 500 validation tranche additionally requires verified external demand.
- Releasing a tranche changes spending authority only. It never approves an expense; each expense requires its own valid, precisely scoped approval and effect authorization.
- Every expense proposal records amount, category, objective, venture/experiment, expected result, evidence, alternatives, worst-case loss, success/stop conditions, payback, and confidence.
- Before first settled payment, proposed limits are USD 3 single, USD 8 daily, USD 10 experiment, and USD 10 untouched reserve equivalent. The stricter initial-capital policy applies: actual spending requires explicit owner approval.
