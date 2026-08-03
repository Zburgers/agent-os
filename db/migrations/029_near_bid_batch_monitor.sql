INSERT INTO jobs(
  name, purpose, action_kind, schedule, trigger_type, payload,
  idempotency_key, status, attempts, max_attempts, next_run_at,
  interval_seconds, related_ticket_id
)
VALUES
  ('NEAR bid award monitor — price tracker', 'Poll the approved NEAR worker bid and raise a durable Agent OS alert when its status changes from pending.', 'job', 'every 5 minutes', 'scheduled', '{"kind":"near_bid_status_monitor","bid_id":"d1205bb4-fc01-43d7-8fd3-eeac99a7ba01"}'::jsonb, 'near-bid-monitor:d1205bb4-fc01-43d7-8fd3-eeac99a7ba01', 'queued', 0, 10, now(), 300, '440de021-f284-4a5b-8ed2-1d7b9fc871cd'),
  ('NEAR bid award monitor — infrastructure research', 'Poll the approved NEAR worker bid and raise a durable Agent OS alert when its status changes from pending.', 'job', 'every 5 minutes', 'scheduled', '{"kind":"near_bid_status_monitor","bid_id":"45d79a96-60d8-4e92-8097-b69ad7576328"}'::jsonb, 'near-bid-monitor:45d79a96-60d8-4e92-8097-b69ad7576328', 'queued', 0, 10, now(), 300, '440de021-f284-4a5b-8ed2-1d7b9fc871cd'),
  ('NEAR bid award monitor — research papers', 'Poll the approved NEAR worker bid and raise a durable Agent OS alert when its status changes from pending.', 'job', 'every 5 minutes', 'scheduled', '{"kind":"near_bid_status_monitor","bid_id":"a606d6c8-aec8-4eed-bdf0-81fb46e404cc"}'::jsonb, 'near-bid-monitor:a606d6c8-aec8-4eed-bdf0-81fb46e404cc', 'queued', 0, 10, now(), 300, '440de021-f284-4a5b-8ed2-1d7b9fc871cd')
ON CONFLICT(idempotency_key) DO NOTHING;
