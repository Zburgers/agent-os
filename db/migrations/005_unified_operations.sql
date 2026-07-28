-- The dashboard and agent both operate on these records. PostgreSQL remains
-- authoritative; this migration deliberately extends rather than replaces the
-- original control-plane tables.

ALTER TABLE ventures ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'research';
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS current_milestone text;
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS required_capital_minor bigint NOT NULL DEFAULT 0 CHECK (required_capital_minor >= 0);
ALTER TABLE ventures ADD COLUMN IF NOT EXISTS expected_return numeric;

ALTER TABLE objectives ADD COLUMN IF NOT EXISTS venture_id uuid REFERENCES ventures(id);
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS acceptance_criteria text;

UPDATE tasks SET status='waiting_for_owner' WHERE status IN ('waiting','owner_blocked');
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('inbox','backlog','ready','in_progress','blocked','waiting_for_owner','validation','completed','abandoned'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS experiment_id uuid REFERENCES experiments(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES tasks(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_effort_minutes integer CHECK (estimated_effort_minutes >= 0);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_effort_minutes integer CHECK (actual_effort_minutes >= 0);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_cost_minor bigint CHECK (actual_cost_minor >= 0);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS worker_id text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocker text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS acceptance_criteria text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS verification_evidence text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by text NOT NULL DEFAULT 'system';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_by text NOT NULL DEFAULT 'system';
CREATE INDEX IF NOT EXISTS tasks_board_idx ON tasks(status, priority DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS tasks_objective_idx ON tasks(objective_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, depends_on_task_id),
  CHECK (task_id <> depends_on_task_id)
);
CREATE TABLE IF NOT EXISTS task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_type text NOT NULL CHECK (author_type IN ('owner','agent','worker')),
  author_id text NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS task_artifacts (
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  artifact_id uuid NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, artifact_id)
);

ALTER TABLE experiments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS objective_id uuid REFERENCES objectives(id);
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS actual_expense_minor bigint NOT NULL DEFAULT 0 CHECK (actual_expense_minor >= 0);
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS actual_revenue_minor bigint NOT NULL DEFAULT 0 CHECK (actual_revenue_minor >= 0);
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS decision text CHECK (decision IN ('continue','pivot','kill'));
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE approvals DROP CONSTRAINT IF EXISTS approvals_status_check;
ALTER TABLE approvals ADD CONSTRAINT approvals_status_check CHECK(status IN ('pending','approved','rejected','modified','expired','cancelled'));
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS objective_id uuid REFERENCES objectives(id);
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS venture_id uuid REFERENCES ventures(id);
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS experiment_id uuid REFERENCES experiments(id);
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES tasks(id);
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS blocker text;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS maximum_exposure_minor bigint NOT NULL DEFAULT 0 CHECK (maximum_exposure_minor >= 0);
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '[]';
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS default_action text NOT NULL DEFAULT 'expire_without_execution';
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS parent_approval_id uuid REFERENCES approvals(id);
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE IF NOT EXISTS approval_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  approval_id uuid NOT NULL REFERENCES approvals(id),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_type text NOT NULL CHECK (actor_type IN ('owner','agent','telegram','system')),
  actor_id text,
  action text NOT NULL CHECK (action IN ('requested','approved','rejected','modified','commented','expired','cancelled','deduplicated')),
  note text,
  payload jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS approval_events_approval_idx ON approval_events(approval_id, id DESC);

ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS ticket_id uuid REFERENCES tasks(id);
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS approval_id uuid REFERENCES approvals(id);
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS original_amount_minor bigint;
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS external_reference text;
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS receipt_artifact_id uuid REFERENCES artifacts(id);

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check CHECK(status IN ('queued','running','paused','completed','dead_letter','cancelled'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual','scheduled','event','supervisor'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS related_ticket_id uuid REFERENCES tasks(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS paused_at timestamptz;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_run_at timestamptz;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;
ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS attempt integer;
ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS worker_id text;
ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS cost_minor bigint NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS job_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES job_runs(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  level text NOT NULL CHECK(level IN ('debug','info','warn','error')),
  message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS activity_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_type text NOT NULL,
  actor_id text,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  venture_id uuid REFERENCES ventures(id),
  objective_id uuid REFERENCES objectives(id),
  task_id uuid REFERENCES tasks(id),
  experiment_id uuid REFERENCES experiments(id),
  evidence jsonb NOT NULL DEFAULT '[]',
  alternatives jsonb NOT NULL DEFAULT '[]',
  selected_action text,
  confidence integer CHECK(confidence BETWEEN 0 AND 100),
  expected_outcome text,
  actual_outcome text,
  lesson text,
  payload jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS activity_events_timeline_idx ON activity_events(occurred_at DESC);

CREATE TABLE IF NOT EXISTS system_health_checks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  component text NOT NULL,
  status text NOT NULL CHECK(status IN ('ok','degraded','failed','unknown')),
  detail text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  evidence jsonb NOT NULL DEFAULT '[]'
);

DROP TRIGGER IF EXISTS approval_events_immutable ON approval_events;
CREATE TRIGGER approval_events_immutable BEFORE UPDATE OR DELETE ON approval_events FOR EACH ROW EXECUTE FUNCTION reject_mutation();
DROP TRIGGER IF EXISTS activity_events_immutable ON activity_events;
CREATE TRIGGER activity_events_immutable BEFORE UPDATE OR DELETE ON activity_events FOR EACH ROW EXECUTE FUNCTION reject_mutation();
