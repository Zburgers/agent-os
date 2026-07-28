CREATE TABLE IF NOT EXISTS owner_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text UNIQUE NOT NULL,
  csrf_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  remote_address inet
);
CREATE INDEX IF NOT EXISTS owner_sessions_active_idx ON owner_sessions (expires_at) WHERE revoked_at IS NULL;
