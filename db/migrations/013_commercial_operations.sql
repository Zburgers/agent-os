-- Lightweight, operational CRM for high-touch commercial work. PostgreSQL is
-- authoritative; external effects remain governed by the existing approval,
-- commercial-lock, pause/kill, and effect-intent boundaries.

CREATE TABLE IF NOT EXISTS commercial_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id uuid REFERENCES ventures(id),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  description text NOT NULL CHECK (length(description) BETWEEN 1 AND 5000),
  target_customer text NOT NULL CHECK (length(target_customer) BETWEEN 1 AND 1000),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','paused','retired')),
  pricing_model text NOT NULL
    CHECK (pricing_model IN ('one_time','recurring','usage','custom','free')),
  price_minor bigint CHECK (price_minor IS NULL OR price_minor >= 0),
  currency char(3) NOT NULL DEFAULT 'INR',
  billing_interval text CHECK (billing_interval IN ('week','month','quarter','year')),
  delivery_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  updated_by text NOT NULL,
  CHECK (
    (pricing_model = 'recurring' AND billing_interval IS NOT NULL)
    OR (pricing_model <> 'recurring' AND billing_interval IS NULL)
  )
);

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS venture_id uuid REFERENCES ventures(id),
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES commercial_products(id),
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS organization text,
  ADD COLUMN IF NOT EXISTS source_uri text,
  ADD COLUMN IF NOT EXISTS pipeline_stage text NOT NULL DEFAULT 'potential'
    CHECK (pipeline_stage IN (
      'potential','qualified','contacted','engaged','proposal',
      'negotiation','won','lost','disqualified'
    )),
  ADD COLUMN IF NOT EXISTS qualification_score integer
    CHECK (qualification_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS estimated_value_minor bigint
    CHECK (estimated_value_minor IS NULL OR estimated_value_minor >= 0),
  ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS contact_channel text
    CHECK (contact_channel IN ('email','marketplace','community','social','referral','other')),
  ADD COLUMN IF NOT EXISTS contact_endpoint text,
  ADD COLUMN IF NOT EXISTS next_action text,
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz,
  ADD COLUMN IF NOT EXISTS lost_reason text,
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS updated_by text NOT NULL DEFAULT 'system';

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS venture_id uuid REFERENCES ventures(id),
  ADD COLUMN IF NOT EXISTS source_lead_id uuid REFERENCES leads(id),
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'active'
    CHECK (lifecycle_status IN ('active','inactive','churned')),
  ADD COLUMN IF NOT EXISTS next_action text,
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS commercial_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id),
  customer_id uuid REFERENCES customers(id),
  product_id uuid REFERENCES commercial_products(id),
  direction text NOT NULL CHECK (direction IN ('outbound','inbound')),
  channel text NOT NULL CHECK (channel IN ('email','marketplace','community','social','other')),
  subject text,
  content_preview text CHECK (content_preview IS NULL OR length(content_preview) <= 500),
  provider_reference text,
  effect_intent_id uuid REFERENCES effect_intents(id),
  approval_id uuid REFERENCES approvals(id),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by text NOT NULL,
  CHECK (lead_id IS NOT NULL OR customer_id IS NOT NULL),
  CHECK (
    direction = 'inbound'
    OR (effect_intent_id IS NOT NULL AND approval_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS commercial_messages_provider_ref_unique
  ON commercial_messages(provider_reference) WHERE provider_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS commercial_message_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES commercial_messages(id),
  event_type text NOT NULL CHECK (event_type IN (
    'drafted','authorized','sent','delivered','delivery_delayed','bounced',
    'failed','suppressed','complained','opened','clicked','replied'
  )),
  provider_event_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  evidence jsonb NOT NULL DEFAULT '{}',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS commercial_message_events_provider_unique
  ON commercial_message_events(provider_event_id) WHERE provider_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS commercial_message_events_timeline_idx
  ON commercial_message_events(message_id, occurred_at DESC, recorded_at DESC);

CREATE TABLE IF NOT EXISTS commercial_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id),
  customer_id uuid REFERENCES customers(id),
  product_id uuid REFERENCES commercial_products(id),
  activity_type text NOT NULL CHECK (activity_type IN (
    'research','follow_up','reply_review','proposal','meeting','delivery','renewal','other'
  )),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
  detail text CHECK (detail IS NULL OR length(detail) <= 5000),
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','due','completed','cancelled')),
  due_at timestamptz,
  completed_at timestamptz,
  recurrence text NOT NULL DEFAULT 'none'
    CHECK (recurrence IN ('none','daily','weekly','monthly','quarterly')),
  parent_activity_id uuid REFERENCES commercial_activities(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  updated_by text NOT NULL,
  CHECK (lead_id IS NOT NULL OR customer_id IS NOT NULL),
  CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR (status <> 'completed' AND completed_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS leads_pipeline_action_idx
  ON leads(pipeline_stage, next_action_at, updated_at DESC);
CREATE INDEX IF NOT EXISTS commercial_activities_due_idx
  ON commercial_activities(status, due_at) WHERE status IN ('scheduled','due');
CREATE INDEX IF NOT EXISTS commercial_products_status_idx
  ON commercial_products(status, updated_at DESC);

DROP TRIGGER IF EXISTS commercial_messages_immutable ON commercial_messages;
CREATE TRIGGER commercial_messages_immutable
  BEFORE UPDATE OR DELETE ON commercial_messages
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
DROP TRIGGER IF EXISTS commercial_message_events_immutable ON commercial_message_events;
CREATE TRIGGER commercial_message_events_immutable
  BEFORE UPDATE OR DELETE ON commercial_message_events
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'commercial_products','leads','customers','commercial_messages',
    'commercial_message_events','commercial_activities'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_audit_backstop ON %I', table_name, table_name);
    EXECUTE format(
      'CREATE TRIGGER %I_audit_backstop AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_state_change()',
      table_name, table_name
    );
  END LOOP;
END;
$$;
