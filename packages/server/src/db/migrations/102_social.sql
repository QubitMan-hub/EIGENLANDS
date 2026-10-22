-- Phase 4: trade audit log, chat reports, moderation flags.
CREATE TABLE IF NOT EXISTS trades (
  id       BIGSERIAL PRIMARY KEY,
  a        UUID REFERENCES accounts(id) ON DELETE SET NULL,
  b        UUID REFERENCES accounts(id) ON DELETE SET NULL,
  a_items  JSONB NOT NULL,
  b_items  JSONB NOT NULL,
  a_coins  INT NOT NULL,
  b_coins  INT NOT NULL,
  at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trades_a ON trades(a);
CREATE INDEX IF NOT EXISTS trades_b ON trades(b);

CREATE TABLE IF NOT EXISTS chat_reports (
  id          BIGSERIAL PRIMARY KEY,
  reporter    UUID REFERENCES accounts(id) ON DELETE SET NULL,
  target_name TEXT NOT NULL,
  target      UUID REFERENCES accounts(id) ON DELETE SET NULL,
  reason      TEXT NOT NULL,
  context     JSONB NOT NULL DEFAULT '[]'::jsonb,
  at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS account_flags (
  account_id  UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  muted_until TIMESTAMPTZ
);
