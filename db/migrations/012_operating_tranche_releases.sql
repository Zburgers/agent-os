CREATE TABLE IF NOT EXISTS operating_tranche_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid NOT NULL UNIQUE REFERENCES approvals(id),
  currency char(3) NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  actor_type text NOT NULL CHECK (actor_type IN ('owner','telegram','system')),
  actor_id text NOT NULL,
  released_at timestamptz NOT NULL DEFAULT now(),
  evidence jsonb NOT NULL DEFAULT '{}'
);

DROP TRIGGER IF EXISTS operating_tranche_releases_update_guard ON operating_tranche_releases;
CREATE TRIGGER operating_tranche_releases_update_guard
BEFORE UPDATE OR DELETE ON operating_tranche_releases
FOR EACH ROW EXECUTE FUNCTION reject_mutation();

DROP TRIGGER IF EXISTS operating_tranche_releases_audit_backstop ON operating_tranche_releases;
CREATE TRIGGER operating_tranche_releases_audit_backstop
AFTER INSERT ON operating_tranche_releases
FOR EACH ROW EXECUTE FUNCTION audit_state_change();
