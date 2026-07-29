-- Ethereum wallet records intentionally contain public addresses and transaction
-- envelopes only.  They never contain keys, recovery material, RPC URLs, or sessions.
CREATE TABLE wallet_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL UNIQUE CHECK (address ~ '^0x[0-9a-f]{40}$'),
  chain_id integer NOT NULL CHECK (chain_id = 1),
  linked_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
  revoked_by text, created_by text NOT NULL DEFAULT 'owner'
);
CREATE UNIQUE INDEX wallet_links_one_active ON wallet_links ((1)) WHERE revoked_at IS NULL;
CREATE TABLE wallet_link_nonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nonce_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL,
  consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE wallet_transaction_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), wallet_link_id uuid NOT NULL REFERENCES wallet_links(id),
  purpose text NOT NULL CHECK (length(purpose) BETWEEN 1 AND 2000), venture_id uuid REFERENCES ventures(id), experiment_id uuid REFERENCES experiments(id), task_id uuid REFERENCES tasks(id),
  from_address text NOT NULL CHECK (from_address ~ '^0x[0-9a-f]{40}$'), to_address text NOT NULL CHECK (to_address ~ '^0x[0-9a-f]{40}$'),
  value_wei numeric(78,0) NOT NULL CHECK (value_wei >= 0), data text NOT NULL DEFAULT '0x' CHECK (data ~ '^0x([0-9a-f]{2})*$'), expected_nonce numeric(78,0) NOT NULL CHECK (expected_nonce >= 0),
  estimated_gas numeric(78,0), max_fee_per_gas_wei numeric(78,0), simulation jsonb NOT NULL DEFAULT '{}', raw_calldata_warning boolean NOT NULL DEFAULT false,
  approval_id uuid NOT NULL REFERENCES approvals(id), effect_id uuid REFERENCES effect_intents(id), status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','signing','rejected','submitted','mined_success','mined_reverted','reconciliation_required','cancelled')),
  submitted_hash text CHECK (submitted_hash IS NULL OR submitted_hash ~ '^0x[0-9a-f]{64}$'), reconciliation_state text NOT NULL DEFAULT 'not_required' CHECK(reconciliation_state IN ('not_required','pending','reconciled')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), signing_started_at timestamptz, submitted_at timestamptz, mined_at timestamptz
);
CREATE INDEX wallet_transaction_intents_status_idx ON wallet_transaction_intents(status, created_at DESC);
CREATE TABLE wallet_transaction_events (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, intent_id uuid NOT NULL REFERENCES wallet_transaction_intents(id), event_type text NOT NULL, payload jsonb NOT NULL DEFAULT '{}', occurred_at timestamptz NOT NULL DEFAULT now(), actor_type text NOT NULL, actor_id text NOT NULL);
CREATE TABLE digital_asset_ledger (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), intent_id uuid REFERENCES wallet_transaction_intents(id), asset text NOT NULL DEFAULT 'ETH', chain_id integer NOT NULL DEFAULT 1, amount_atomic numeric(78,0) NOT NULL, entry_type text NOT NULL CHECK(entry_type IN ('pending_outflow','settled_outflow','gas_fee','reversal')), transaction_hash text, occurred_at timestamptz NOT NULL DEFAULT now(), evidence jsonb NOT NULL DEFAULT '{}');
CREATE OR REPLACE FUNCTION wallet_immutable_envelope() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF OLD.from_address<>NEW.from_address OR OLD.to_address<>NEW.to_address OR OLD.value_wei<>NEW.value_wei OR OLD.data<>NEW.data OR OLD.expected_nonce<>NEW.expected_nonce OR OLD.approval_id<>NEW.approval_id OR OLD.wallet_link_id<>NEW.wallet_link_id THEN RAISE EXCEPTION 'wallet intent envelope is immutable'; END IF; RETURN NEW; END; $$;
CREATE TRIGGER wallet_intent_immutable BEFORE UPDATE ON wallet_transaction_intents FOR EACH ROW EXECUTE FUNCTION wallet_immutable_envelope();
DO $$ DECLARE table_name text; BEGIN FOREACH table_name IN ARRAY ARRAY['wallet_links','wallet_link_nonces','wallet_transaction_intents','wallet_transaction_events','digital_asset_ledger'] LOOP EXECUTE format('CREATE TRIGGER %I_audit_backstop AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_state_change()', table_name, table_name); END LOOP; END $$;
