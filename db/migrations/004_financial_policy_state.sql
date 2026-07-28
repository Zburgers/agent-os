CREATE TABLE IF NOT EXISTS financial_policy_state (
  currency char(3) PRIMARY KEY,
  released_operating_minor bigint NOT NULL DEFAULT 0 CHECK (released_operating_minor >= 0),
  required_reserve_minor bigint NOT NULL DEFAULT 0 CHECK (required_reserve_minor >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT 'migration'
);
INSERT INTO financial_policy_state(currency, released_operating_minor, required_reserve_minor)
VALUES ('INR', 0, 200000) ON CONFLICT (currency) DO NOTHING;
