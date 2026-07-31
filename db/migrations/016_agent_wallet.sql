-- Public policy and activity for the owner-authorized dedicated Goofy wallet.
-- Secret key material is deliberately excluded from PostgreSQL.
CREATE TABLE agent_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL UNIQUE CHECK (address ~ '^0x[0-9a-f]{40}$'),
  key_backend text NOT NULL CHECK (key_backend IN ('protected_file','remote_signer','hsm')),
  key_reference text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','rotated')),
  allowed_chain_ids integer[] NOT NULL DEFAULT ARRAY[8453],
  policy jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  revoked_at timestamptz
);
CREATE UNIQUE INDEX agent_wallets_one_active ON agent_wallets ((1)) WHERE status='active';

CREATE TABLE agent_wallet_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES agent_wallets(id),
  provider text NOT NULL,
  operation_type text NOT NULL CHECK (operation_type IN ('personal_sign','typed_data_sign','transaction_sign')),
  message_hash text CHECK (message_hash IS NULL OR message_hash ~ '^[0-9a-f]{64}$'),
  message_preview text,
  outcome text NOT NULL CHECK (outcome IN ('succeeded','denied','failed')),
  error_code text,
  idempotency_key text NOT NULL UNIQUE,
  external_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_wallet_operations_recent_idx ON agent_wallet_operations(created_at DESC);
CREATE INDEX agent_wallet_operations_wallet_idx ON agent_wallet_operations(wallet_id, created_at DESC);

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['agent_wallets','agent_wallet_operations'] LOOP
    EXECUTE format('CREATE TRIGGER %I_audit_backstop AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_state_change()', table_name, table_name);
  END LOOP;
END $$;
