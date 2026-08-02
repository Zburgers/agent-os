CREATE TABLE revenue_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_track_id uuid REFERENCES revenue_tracks(id),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  owner_kind text NOT NULL DEFAULT 'agent' CHECK (owner_kind IN ('agent','owner','joint')),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','active','paused','completed','killed')),
  strategy text NOT NULL DEFAULT '',
  target_customer text NOT NULL DEFAULT '',
  monetization_model text NOT NULL DEFAULT '',
  stage varchar(80) NOT NULL DEFAULT 'discovery',
  confidence integer CHECK (confidence BETWEEN 0 AND 100),
  priority integer NOT NULL DEFAULT 0,
  expected_value numeric,
  planned_cost_minor bigint NOT NULL DEFAULT 0 CHECK (planned_cost_minor >= 0),
  current_action text,
  next_action text,
  review_date date,
  success_criteria text,
  kill_criteria text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL DEFAULT 'system',
  updated_by text NOT NULL DEFAULT 'system'
);

CREATE INDEX revenue_tracks_parent_idx ON revenue_tracks(parent_track_id);
CREATE INDEX revenue_tracks_status_idx ON revenue_tracks(status);
CREATE INDEX revenue_tracks_priority_idx ON revenue_tracks(priority DESC, updated_at DESC);

CREATE OR REPLACE FUNCTION prevent_revenue_track_cycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent_track_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.parent_track_id = NEW.id THEN
    RAISE EXCEPTION 'revenue_tracks_no_cycle';
  END IF;
  IF EXISTS (
    WITH RECURSIVE descendants(id) AS (
      SELECT id FROM revenue_tracks WHERE parent_track_id = NEW.id
      UNION ALL
      SELECT track.id FROM revenue_tracks track JOIN descendants child ON track.parent_track_id = child.id
    ) SELECT 1 FROM descendants WHERE id = NEW.parent_track_id
  ) THEN
    RAISE EXCEPTION 'revenue_tracks_no_cycle';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER revenue_tracks_cycle_guard
BEFORE INSERT OR UPDATE OF parent_track_id ON revenue_tracks
FOR EACH ROW EXECUTE FUNCTION prevent_revenue_track_cycle();

ALTER TABLE ventures ADD COLUMN IF NOT EXISTS track_id uuid REFERENCES revenue_tracks(id);
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS track_id uuid REFERENCES revenue_tracks(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS track_id uuid REFERENCES revenue_tracks(id);
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS track_id uuid REFERENCES revenue_tracks(id);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS track_id uuid REFERENCES revenue_tracks(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS track_id uuid REFERENCES revenue_tracks(id);
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS track_id uuid REFERENCES revenue_tracks(id);
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS track_id uuid REFERENCES revenue_tracks(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS track_id uuid REFERENCES revenue_tracks(id);
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS track_id uuid REFERENCES revenue_tracks(id);

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['ventures','objectives','tasks','experiments','opportunities','leads','artifacts','decisions','jobs','ledger_entries'] LOOP
    EXECUTE format('CREATE INDEX %I_track_idx ON %I(track_id)', table_name, table_name);
  END LOOP;
END $$;

CREATE TRIGGER revenue_tracks_audit_backstop
AFTER INSERT OR UPDATE OR DELETE ON revenue_tracks
FOR EACH ROW EXECUTE FUNCTION audit_state_change();
