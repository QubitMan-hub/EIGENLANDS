-- Phase 3: Circuit Board progression (class, board, gates, runes, codex, tutorial). Separate from characters.data,
-- which Phase 2 owns and rewrites as a whole.
CREATE TABLE IF NOT EXISTS character_progress (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
