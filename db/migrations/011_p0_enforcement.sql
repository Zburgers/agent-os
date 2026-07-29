-- Database-level backstops for P0 audit and financial invariants. Application
-- audit records retain richer actor context; these trigger records ensure a
-- committed state change can never exist without durable audit evidence.
CREATE OR REPLACE FUNCTION audit_state_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  row_data jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  entity text := COALESCE(row_data->>'id', row_data->>'worker_id', row_data->>'currency', 'singleton');
BEGIN
  INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload)
  VALUES('system','postgres-trigger',lower(TG_TABLE_NAME || '_' || TG_OP),TG_TABLE_NAME,entity,
    jsonb_build_object('operation',lower(TG_OP)));
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'system_controls','owner_sessions','ventures','opportunities','objectives','tasks',
    'experiments','decisions','approvals','approval_events','jobs','job_runs',
    'effect_intents','financial_policy_state','fund_reservations','channel_outbox'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_audit_backstop ON %I', table_name, table_name);
    EXECUTE format(
      'CREATE TRIGGER %I_audit_backstop AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_state_change()',
      table_name, table_name
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION validate_new_financial_entry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.net_minor <> NEW.gross_minor - NEW.fees_minor - NEW.tax_minor THEN
    RAISE EXCEPTION 'invalid financial arithmetic';
  END IF;
  IF NEW.entry_type = 'expense' AND (
    NEW.category IS NULL OR NEW.venture_id IS NULL OR NEW.experiment_id IS NULL OR
    NEW.approval_id IS NULL OR NEW.evidence_uri IS NULL
  ) THEN
    RAISE EXCEPTION 'expense metadata required';
  END IF;
  IF NEW.entry_type IN ('revenue','refund','fee') AND (
    NEW.provider_reference IS NULL OR NEW.evidence_uri IS NULL
  ) THEN
    RAISE EXCEPTION 'provider and evidence metadata required';
  END IF;
  IF NEW.entry_type = 'reversal' AND (
    NEW.external_reference IS NULL OR NEW.external_reference !~ '^reversal_of:[0-9a-f-]{36}$'
  ) THEN
    RAISE EXCEPTION 'reversal linkage required';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ledger_entries_validate_insert ON ledger_entries;
CREATE TRIGGER ledger_entries_validate_insert BEFORE INSERT ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION validate_new_financial_entry();

DROP TRIGGER IF EXISTS ledger_entries_audit_backstop ON ledger_entries;
CREATE TRIGGER ledger_entries_audit_backstop AFTER INSERT ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION audit_state_change();

CREATE UNIQUE INDEX IF NOT EXISTS ledger_one_reversal_per_original
  ON ledger_entries(external_reference)
  WHERE entry_type='reversal' AND external_reference IS NOT NULL;
