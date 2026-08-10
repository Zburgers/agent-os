INSERT INTO jobs(
  name, purpose, action_kind, schedule, trigger_type, payload,
  idempotency_key, status, attempts, max_attempts, next_run_at,
  interval_seconds, related_ticket_id
)
VALUES(
  'PayanAgent escrow request acceptance monitor',
  'Read the approved escrow-backed catalog-health request and alert only when its request or Goofy bid status changes.',
  'job',
  'every 5 minutes',
  'scheduled',
  '{"kind":"payanagent_request_status_monitor","request_id":"ks76vc9pzpz3qfgf8aawjckn5n8bezhf"}'::jsonb,
  'payanagent-request-monitor:ks76vc9pzpz3qfgf8aawjckn5n8bezhf',
  'queued',
  0,
  10,
  now(),
  300,
  '440de021-f284-4a5b-8ed2-1d7b9fc871cd'
)
ON CONFLICT(idempotency_key) DO NOTHING;
