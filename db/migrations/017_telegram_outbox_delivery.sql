ALTER TABLE channel_outbox
  ADD COLUMN IF NOT EXISTS effect_intent_id uuid REFERENCES effect_intents(id),
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE channel_outbox DROP CONSTRAINT IF EXISTS channel_outbox_status_check;
ALTER TABLE channel_outbox ADD CONSTRAINT channel_outbox_status_check
  CHECK (status IN ('pending','delivering','delivered','failed','reconciliation_required','cancelled'));

ALTER TABLE channel_outbox DROP CONSTRAINT IF EXISTS channel_outbox_attempts_check;
ALTER TABLE channel_outbox ADD CONSTRAINT channel_outbox_attempts_check
  CHECK (attempts >= 0 AND attempts <= max_attempts);

ALTER TABLE channel_outbox DROP CONSTRAINT IF EXISTS channel_outbox_max_attempts_check;
ALTER TABLE channel_outbox ADD CONSTRAINT channel_outbox_max_attempts_check
  CHECK (max_attempts BETWEEN 1 AND 5);

CREATE UNIQUE INDEX IF NOT EXISTS channel_outbox_effect_intent_unique
  ON channel_outbox(effect_intent_id)
  WHERE effect_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS channel_outbox_delivery_ready
  ON channel_outbox(next_attempt_at, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS channel_outbox_delivery_lease
  ON channel_outbox(lease_expires_at)
  WHERE status = 'delivering';

-- The earlier inbound-command check is not sufficient evidence for the new
-- durable outbound approval-notification contract. Deployment deliberately
-- reopens this gate until a reconciled live canary is recorded through the
-- governed readiness evidence service.
UPDATE readiness_gates SET status='PARTIAL',verified_at=NULL,
  evidence_uri='pending://telegram-control-notification-live-canary',updated_at=now()
WHERE gate_key='telegram_controls';
