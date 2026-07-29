WITH next_brief AS (
  SELECT CASE
    WHEN (
      date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') + interval '18 hours 30 minutes'
    ) AT TIME ZONE 'Asia/Kolkata' > now()
    THEN (
      date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') + interval '18 hours 30 minutes'
    ) AT TIME ZONE 'Asia/Kolkata'
    ELSE (
      date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') + interval '1 day 18 hours 30 minutes'
    ) AT TIME ZONE 'Asia/Kolkata'
  END AS run_at
)
INSERT INTO jobs(
  name,
  purpose,
  action_kind,
  schedule,
  trigger_type,
  payload,
  idempotency_key,
  status,
  attempts,
  max_attempts,
  interval_seconds,
  next_run_at
)
SELECT
  'Daily owner pitch deck snapshot',
  'Capture an authoritative daily business snapshot for the owner-facing HTML pitch deck.',
  'job',
  'Daily at 18:30 Asia/Kolkata',
  'scheduled',
  '{"kind":"daily_owner_brief_snapshot","route":"/daily-brief"}'::jsonb,
  'daily-owner-brief-snapshot-v1',
  'queued',
  0,
  3,
  86400,
  run_at
FROM next_brief
ON CONFLICT(idempotency_key) DO NOTHING;
