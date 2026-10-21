CREATE TABLE world_objects (
  world_seed BIGINT NOT NULL,
  x          INT NOT NULL,
  y          INT NOT NULL,
  kind       TEXT NOT NULL,
  sub        TEXT NOT NULL,
  owner      UUID,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (world_seed, x, y)
);

CREATE TABLE respawns (
  world_seed   BIGINT NOT NULL,
  x            INT NOT NULL,
  y            INT NOT NULL,
  restore_tile INT NOT NULL,
  at_ms        BIGINT NOT NULL,
  PRIMARY KEY (world_seed, x, y)
);

CREATE TABLE world_state (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE chunk_diffs ADD COLUMN day INT NOT NULL DEFAULT 0;
