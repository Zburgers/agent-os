-- Contextual-memory provenance only. PostgreSQL remains authoritative for all
-- operational state and controls; these rows never grant authority.
CREATE TABLE IF NOT EXISTS curated_memory_records (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  scope_key text NOT NULL,
  markdown_path text NOT NULL UNIQUE,
  provider_id text,
  content_sha256 text NOT NULL,
  category text NOT NULL,
  sensitivity text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS curated_memory_records_scope_idx ON curated_memory_records(owner_id, scope_key, created_at DESC);
