-- Every side effect is represented before execution. Internal effects may be
-- committed atomically; external effects retain provider receipts and move to
-- reconciliation_required after an ambiguous call boundary.
CREATE TABLE IF NOT EXISTS effect_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id),
  run_id uuid REFERENCES job_runs(id),
  approval_id uuid REFERENCES approvals(id),
  effect_kind text NOT NULL CHECK (effect_kind IN ('internal','message','expense','deployment','payment','account_change','purchase')),
  idempotency_key text UNIQUE NOT NULL,
  provider_idempotency_key text UNIQUE,
  state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed','authorized','executing','succeeded','failed','reconciliation_required','cancelled')),
  payload jsonb NOT NULL DEFAULT '{}',
  receipt jsonb,
  policy_code text,
  last_error text,
  proposed_at timestamptz NOT NULL DEFAULT now(),
  authorized_at timestamptz,
  executing_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS effect_intents_reconciliation_idx
  ON effect_intents(state, updated_at) WHERE state IN ('executing','reconciliation_required');
CREATE INDEX IF NOT EXISTS effect_intents_job_idx ON effect_intents(job_id, proposed_at DESC);

CREATE TABLE IF NOT EXISTS supervisor_heartbeats (
  worker_id text PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  heartbeat_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('starting','running','stopping','stopped')),
  detail jsonb NOT NULL DEFAULT '{}'
);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS claimed_by text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz;

DROP TRIGGER IF EXISTS supervisor_heartbeats_delete_only ON supervisor_heartbeats;

