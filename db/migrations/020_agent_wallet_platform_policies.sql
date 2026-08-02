CREATE TABLE agent_wallet_platform_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES agent_wallets(id),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','revoked','superseded')),
  policy jsonb NOT NULL DEFAULT '{}',
  supersedes_id uuid REFERENCES agent_wallet_platform_policies(id),
  created_by text NOT NULL,
  activated_by text,
  revoked_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  revoked_at timestamptz,
  UNIQUE(wallet_id, version)
);
ALTER TABLE agent_wallet_operations ADD COLUMN policy_id uuid REFERENCES agent_wallet_platform_policies(id);
DO $$ BEGIN
  CREATE TRIGGER agent_wallet_platform_policies_immutable BEFORE UPDATE OR DELETE ON agent_wallet_platform_policies FOR EACH ROW EXECUTE FUNCTION reject_mutation();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TRIGGER agent_wallet_platform_policies_audit_backstop AFTER INSERT OR UPDATE OR DELETE ON agent_wallet_platform_policies FOR EACH ROW EXECUTE FUNCTION audit_state_change();
