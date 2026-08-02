CREATE TABLE codex_operating_block_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  thread_id uuid NOT NULL DEFAULT '019faa3e-b7af-7e13-8335-4f651c989e27',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  schedule text NOT NULL DEFAULT '*-*-* 09:00:00 Asia/Kolkata',
  schedule_paused boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (thread_id = '019faa3e-b7af-7e13-8335-4f651c989e27'),
  CHECK (timezone = 'Asia/Kolkata'),
  CHECK (schedule = '*-*-* 09:00:00 Asia/Kolkata')
);
INSERT INTO codex_operating_block_config(singleton) VALUES(true) ON CONFLICT(singleton) DO NOTHING;

CREATE TABLE codex_operating_block_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_key text NOT NULL CONSTRAINT codex_occurrence_key_unique UNIQUE,
  intended_date date,
  trigger_kind text NOT NULL CHECK (trigger_kind IN ('scheduled','manual')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','timeboxed','failed','skipped','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);
CREATE INDEX codex_occurrences_date_idx ON codex_operating_block_occurrences(intended_date, created_at DESC);

CREATE TABLE codex_operating_block_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id uuid NOT NULL REFERENCES codex_operating_block_occurrences(id),
  thread_id uuid NOT NULL CHECK (thread_id = '019faa3e-b7af-7e13-8335-4f651c989e27'),
  status text NOT NULL CHECK (status IN ('running','completed','timeboxed','failed','skipped','cancelled')),
  exit_reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  signal_at timestamptz,
  finished_at timestamptz,
  duration_ms bigint CHECK (duration_ms IS NULL OR duration_ms >= 0),
  log_path text,
  log_checksum text CHECK (log_checksum IS NULL OR log_checksum ~ '^[0-9a-f]{64}$'),
  last_assistant_message text CHECK (last_assistant_message IS NULL OR length(last_assistant_message) <= 20000),
  git_before_sha text,
  git_after_sha text,
  changed_files jsonb NOT NULL DEFAULT '[]',
  activity_ids jsonb NOT NULL DEFAULT '[]',
  usage jsonb NOT NULL DEFAULT '{}',
  summary text CHECK (summary IS NULL OR length(summary) <= 20000),
  next_action text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX codex_runs_one_per_occurrence ON codex_operating_block_runs(occurrence_id);
CREATE INDEX codex_runs_recent_idx ON codex_operating_block_runs(started_at DESC);

CREATE TRIGGER codex_operating_block_runs_immutable
BEFORE UPDATE OR DELETE ON codex_operating_block_runs
FOR EACH ROW EXECUTE FUNCTION reject_mutation();

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['codex_operating_block_config','codex_operating_block_occurrences','codex_operating_block_runs'] LOOP
    EXECUTE format('CREATE TRIGGER %I_audit_backstop AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_state_change()', table_name, table_name);
  END LOOP;
END $$;
