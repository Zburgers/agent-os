-- Account observability stores metadata only. Secret material remains in
-- protected runtime injection, signers, or owner-controlled providers.
CREATE TABLE IF NOT EXISTS owned_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_key text UNIQUE NOT NULL CHECK (platform_key ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 200),
  category text NOT NULL CHECK (category IN ('ai_provider','communications','crypto','developer','infrastructure','marketplace','payments','other')),
  homepage_url text CHECK (homepage_url IS NULL OR homepage_url ~ '^https://'),
  account_identifier text CHECK (account_identifier IS NULL OR length(account_identifier) <= 500),
  ownership_status text NOT NULL DEFAULT 'owned' CHECK (ownership_status IN ('owned','observed','unknown','revoked')),
  access_status text NOT NULL DEFAULT 'unknown' CHECK (access_status IN ('available','partial','missing','expired','revoked','unknown')),
  source text NOT NULL CHECK (source IN ('runtime_integration','database_state','registration_event','manual')),
  notes text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS owned_account_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owned_account_id uuid NOT NULL REFERENCES owned_accounts(id) ON DELETE CASCADE,
  credential_type text NOT NULL CHECK (credential_type IN ('account_identifier','api_key','bot_token','client_id','oauth_token','password','signing_key','webhook_secret','wallet_link','other')),
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 200),
  source text NOT NULL CHECK (source IN ('runtime environment','protected runtime file','protected runtime signer','database metadata','owner-linked provider','registration metadata')),
  status text NOT NULL DEFAULT 'unknown' CHECK (status IN ('available','partial','missing','expired','revoked','unknown')),
  scopes text[] NOT NULL DEFAULT '{}',
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owned_account_id, credential_type, label)
);

CREATE INDEX IF NOT EXISTS owned_accounts_access_status_idx ON owned_accounts(access_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS owned_account_credentials_account_idx ON owned_account_credentials(owned_account_id, updated_at DESC);

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['owned_accounts','owned_account_credentials'] LOOP
    EXECUTE format('CREATE TRIGGER %I_audit_backstop AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_state_change()', table_name, table_name);
  END LOOP;
END $$;
