-- Shadow Army: the roster of extracted shadows (ids, kinds, levels, xp) and which are summoned.
CREATE TABLE IF NOT EXISTS character_shadows (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
