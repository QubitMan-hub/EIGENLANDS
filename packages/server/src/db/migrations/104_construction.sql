-- Separate layer: a roof/foundation must not overwrite the chest on the same tile.
CREATE TABLE construction_cells (
  world_seed BIGINT NOT NULL,
  x INT NOT NULL,
  y INT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'structure' CHECK (kind = 'structure'),
  sub TEXT NOT NULL DEFAULT 'cell',
  owner UUID NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (world_seed, x, y)
);
