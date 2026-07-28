-- A job run is an attempt, while job_effects is the idempotency boundary for
-- handler work. An effect key is unique per job, so a recovered/retried job
-- can observe an already-completed operation instead of applying it again.
CREATE TABLE IF NOT EXISTS job_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id),
  run_id uuid REFERENCES job_runs(id),
  effect_key text NOT NULL,
  effect_type text NOT NULL CHECK (effect_type IN ('internal')),
  status text NOT NULL CHECK (status IN ('completed')),
  result jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, effect_key)
);

CREATE INDEX IF NOT EXISTS job_effects_job_idx ON job_effects(job_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS job_runs_active_idx ON job_runs(job_id) WHERE finished_at IS NULL;
