-- Durable state used by the PR remediation paths. Secrets and raw signatures are
-- deliberately excluded.
CREATE TABLE agent_wallet_policy_current (
  wallet_id uuid PRIMARY KEY REFERENCES agent_wallets(id),
  policy_id uuid NOT NULL REFERENCES agent_wallet_platform_policies(id),
  status text NOT NULL CHECK (status IN ('active','revoked')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE agent_wallet_transaction_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES agent_wallets(id),
  policy_id uuid NOT NULL REFERENCES agent_wallet_platform_policies(id),
  idempotency_key text NOT NULL UNIQUE,
  chain_id integer NOT NULL CHECK (chain_id > 0),
  recipient text NOT NULL,
  value_minor bigint NOT NULL CHECK (value_minor >= 0),
  gas_minor bigint NOT NULL CHECK (gas_minor >= 0),
  status text NOT NULL CHECK (status IN ('simulated','reconciliation_required','submitted')),
  envelope jsonb NOT NULL,
  simulation_evidence jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE agent_wallet_operations
  ADD COLUMN IF NOT EXISTS draft_id uuid REFERENCES agent_wallet_transaction_drafts(id),
  ADD COLUMN IF NOT EXISTS value_minor bigint,
  ADD COLUMN IF NOT EXISTS gas_minor bigint,
  ADD COLUMN IF NOT EXISTS simulation_evidence jsonb;
ALTER TABLE agent_wallet_operations DROP CONSTRAINT IF EXISTS agent_wallet_operations_outcome_check;
ALTER TABLE agent_wallet_operations ADD CONSTRAINT agent_wallet_operations_outcome_check CHECK (outcome IN ('succeeded','denied','failed','simulated'));
CREATE INDEX agent_wallet_drafts_budget_idx ON agent_wallet_transaction_drafts(wallet_id, created_at, status);
CREATE TRIGGER agent_wallet_policy_current_audit AFTER INSERT OR UPDATE OR DELETE ON agent_wallet_policy_current
FOR EACH ROW EXECUTE FUNCTION audit_state_change();
CREATE TRIGGER agent_wallet_transaction_drafts_audit AFTER INSERT OR UPDATE OR DELETE ON agent_wallet_transaction_drafts
FOR EACH ROW EXECUTE FUNCTION audit_state_change();

CREATE TABLE codex_operating_block_run_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES codex_operating_block_runs(id),
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX codex_run_events_recent_idx ON codex_operating_block_run_events(run_id, occurred_at);
CREATE TRIGGER codex_run_events_audit AFTER INSERT ON codex_operating_block_run_events
FOR EACH ROW EXECUTE FUNCTION audit_state_change();
