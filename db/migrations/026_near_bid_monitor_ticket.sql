-- The monitor introduced in 027 is linked to this durable work-board record.
-- This intentionally sorts before 027 so a fresh database satisfies the FK;
-- existing databases receive the same idempotent record on their next migrate.
INSERT INTO tasks(
  id, title, status, description, acceptance_criteria, created_by, updated_by
)
VALUES(
  '440de021-f284-4a5b-8ed2-1d7b9fc871cd',
  'Monitor NEAR bid award status',
  'ready',
  'Poll the live NEAR Agent Market bid and record only material status changes.',
  'The scheduled monitor records durable, redacted evidence and raises an alert only after a meaningful transition.',
  'migration',
  'migration'
)
ON CONFLICT (id) DO NOTHING;
