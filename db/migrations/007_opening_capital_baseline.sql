-- Owner-confirmed opening position recorded by Agent OS. The original
-- transaction dates are unknown, so occurred_at is the record timestamp and
-- the evidence metadata explicitly forbids interpreting it as a backdated
-- transaction date.
INSERT INTO financial_accounts(name,currency,account_type,locked)
VALUES
  ('Owner contributed capital','INR','contribution',false),
  ('Locked operating reserve','INR','reserve',true),
  ('Fixed infrastructure expense','INR','expense',false)
ON CONFLICT(name) DO NOTHING;

INSERT INTO ledger_entries(
  transaction_id,occurred_at,entry_type,currency,gross_minor,fees_minor,tax_minor,net_minor,
  counterparty,payment_status,evidence_uri,idempotency_key,reconciliation_status,category,original_amount_minor
) VALUES
  ('opening-owner-capital-inr-2026-07',now(),'contribution','INR',500000,0,0,500000,
   'owner','settled','owner-statement://capital-baseline-2026-07-29',
   'opening-owner-capital-inr-2026-07','reconciled','owner_capital_contribution',500000),
  ('opening-codex-fixed-expense-inr-2026-07',now(),'expense','INR',200000,0,0,200000,
   'OpenAI Codex subscription (historical)','settled','owner-statement://capital-baseline-2026-07-29',
   'opening-codex-fixed-expense-inr-2026-07','reconciled','fixed_infrastructure_historical',200000)
ON CONFLICT(idempotency_key) DO NOTHING;

INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload)
SELECT 'owner','owner-confirmed','opening_financial_position_recorded','ledger_baseline',NULL,
  jsonb_build_object(
    'confirmation_date','2026-07-29',
    'original_transaction_dates','unknown',
    'recorded_at',now(),
    'owner_capital_minor',500000,
    'historical_fixed_expense_minor',200000,
    'current_cash_minor',300000,
    'reserve_minor',200000,
    'released_operating_minor',0
  )
WHERE NOT EXISTS (
  SELECT 1 FROM audit_events
  WHERE event_type='opening_financial_position_recorded'
    AND payload->>'confirmation_date'='2026-07-29'
);

