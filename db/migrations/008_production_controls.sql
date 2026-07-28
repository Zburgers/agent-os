ALTER TABLE system_controls
  ADD COLUMN IF NOT EXISTS commercial_lock boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS killed_at timestamptz,
  ADD COLUMN IF NOT EXISTS kill_generation bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS service_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  credential_type text NOT NULL CHECK (credential_type IN ('supervisor','hermes_mcp','channel_relay','backup','health','agent')),
  token_hash text UNIQUE NOT NULL,
  scopes text[] NOT NULL,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

ALTER TABLE effect_intents
  ADD COLUMN IF NOT EXISTS actor_type text,
  ADD COLUMN IF NOT EXISTS actor_id text,
  ADD COLUMN IF NOT EXISTS correlation_id uuid,
  ADD COLUMN IF NOT EXISTS venture_id uuid REFERENCES ventures(id),
  ADD COLUMN IF NOT EXISTS experiment_id uuid REFERENCES experiments(id),
  ADD COLUMN IF NOT EXISTS ticket_id uuid REFERENCES tasks(id),
  ADD COLUMN IF NOT EXISTS ledger_entry_id uuid REFERENCES ledger_entries(id);

ALTER TABLE effect_intents DROP CONSTRAINT IF EXISTS effect_intents_state_check;
ALTER TABLE effect_intents ADD CONSTRAINT effect_intents_state_check
  CHECK (state IN ('proposed','denied','authorized','executing','succeeded','failed','reconciliation_required','cancelled'));

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS interval_seconds integer CHECK (interval_seconds IS NULL OR interval_seconds >= 60),
  ADD COLUMN IF NOT EXISTS timeout_seconds integer NOT NULL DEFAULT 120 CHECK (timeout_seconds BETWEEN 1 AND 3600),
  ADD COLUMN IF NOT EXISTS last_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_occurrence_key text;

CREATE TABLE IF NOT EXISTS channel_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('telegram','discord')),
  recipient_ref text NOT NULL,
  message_kind text NOT NULL,
  redacted_payload jsonb NOT NULL,
  idempotency_key text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivering','delivered','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  provider_receipt jsonb,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);

ALTER TABLE memory_references
  ADD COLUMN IF NOT EXISTS provider_id text,
  ADD COLUMN IF NOT EXISTS project_id text,
  ADD COLUMN IF NOT EXISTS customer_id text,
  ADD COLUMN IF NOT EXISTS experiment_id uuid,
  ADD COLUMN IF NOT EXISTS run_id uuid,
  ADD COLUMN IF NOT EXISTS decision_id uuid,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE TABLE IF NOT EXISTS backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('running','succeeded','failed')),
  manifest_path text,
  checksum text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  detail jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency char(3) NOT NULL,
  quote_currency char(3) NOT NULL,
  rate numeric NOT NULL CHECK (rate > 0),
  source text NOT NULL,
  observed_at timestamptz NOT NULL,
  evidence_uri text NOT NULL,
  UNIQUE(base_currency, quote_currency, source, observed_at)
);

CREATE TABLE IF NOT EXISTS fund_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id uuid REFERENCES ventures(id),
  experiment_id uuid REFERENCES experiments(id),
  approval_id uuid REFERENCES approvals(id),
  currency char(3) NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','released','consumed','cancelled')),
  idempotency_key text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz
);

CREATE TABLE IF NOT EXISTS readiness_gates (
  gate_key text PRIMARY KEY,
  priority text NOT NULL CHECK (priority IN ('P0','P1','P2')),
  status text NOT NULL CHECK (status IN ('PASS','PARTIAL','FAIL')),
  evidence_uri text,
  verified_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO readiness_gates(gate_key,priority,status) VALUES
 ('restart_recovery','P0','PARTIAL'),('authentication_authorization','P0','PARTIAL'),
 ('migrations','P0','PARTIAL'),('live_dashboard','P0','PARTIAL'),('domain_crud','P0','PARTIAL'),
 ('durable_jobs','P0','PARTIAL'),('exactly_once_effects','P0','PARTIAL'),('append_only_finance','P0','PARTIAL'),
 ('spending_reserve','P0','PARTIAL'),('approvals','P0','PARTIAL'),('telegram_controls','P0','PARTIAL'),
 ('pause_kill','P0','PARTIAL'),('scoped_memory','P0','PARTIAL'),('secret_safety','P0','PARTIAL'),
 ('audit_preservation','P0','PARTIAL'),('backups','P0','PARTIAL'),('restore','P0','PARTIAL'),
 ('internal_experiment','P0','PARTIAL')
ON CONFLICT(gate_key) DO NOTHING;

DROP TRIGGER IF EXISTS channel_outbox_delete_guard ON channel_outbox;
CREATE TRIGGER channel_outbox_delete_guard BEFORE DELETE ON channel_outbox FOR EACH ROW EXECUTE FUNCTION reject_mutation();
