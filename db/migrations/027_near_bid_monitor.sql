INSERT INTO jobs(
  name, purpose, action_kind, schedule, trigger_type, payload,
  idempotency_key, status, attempts, max_attempts, next_run_at,
  interval_seconds, related_ticket_id
)
VALUES(
  'NEAR bid award monitor',
  'Poll the live NEAR Agent Market bid and raise a durable Agent OS alert when its status changes from pending.',
  'job',
  'every 5 minutes',
  'scheduled',
  '{"kind":"near_bid_status_monitor","bid_id":"09d31f07-ca9f-4039-8e78-992b6efe5c29"}'::jsonb,
  'near-bid-monitor:09d31f07-ca9f-4039-8e78-992b6efe5c29',
  'queued',
  0,
  10,
  now(),
  300,
  '440de021-f284-4a5b-8ed2-1d7b9fc871cd'
)
ON CONFLICT(idempotency_key) DO NOTHING;
