INSERT INTO jobs(
  name, purpose, action_kind, schedule, trigger_type, payload,
  idempotency_key, status, attempts, max_attempts, next_run_at,
  interval_seconds
)
VALUES(
  'Revenue market opportunity scout',
  'Refresh read-only x402 and agent-bounty opportunity evidence for the revenue workstream.',
  'job',
  'every 6 hours',
  'scheduled',
  '{"kind":"revenue_market_scout"}'::jsonb,
  'revenue-market-scout-v1',
  'queued',
  0,
  3,
  now(),
  21600
)
ON CONFLICT(idempotency_key) DO NOTHING;
