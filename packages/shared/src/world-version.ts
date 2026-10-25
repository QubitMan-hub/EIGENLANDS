/**
 * World generation revisions. A saved world is pinned to the revision it was created with:
 *  1 — original climate and seven-tile fens.
 *  2 — surface hydrology only (broad fens, rare lava). Climate, biomes and landmark placement remain revision 1.
 *  3 — the full rebuild: warped Worley biome regions, shared climate fields, rivers and shores, clustered object
 *      placement and real gameplay elevation (per-tile levels in chunk data, cliffs, ramps, height-aware movement).
 *  4 — revision 3's surface plus Undercroft 2: organic cave systems with continuous biomes, vein-based ores, cave
 *      elevation, mine rail lines, delver camps, themed vault shrines and boss rooms. Surface, towns and landmarks are
 *      identical to revision 3.
 *  5 — revision 4 plus the Six Great Kingdoms: six continents across the sea (realms.ts), each with its own
 *      biomes, capital, towns, villages, outposts, ruler, court, army, economy, festivals and quests.
 * Landmark and town placement always uses the revision-1 layout, so their ids never move between revisions.
 */
export const WORLD_GENERATION = 5;
/** Newest revision a world may be created with; also the default for new, empty worlds. */
export type WorldGeneration = 1 | 2 | 3 | 4 | 5;
/** Revision of worlds that predate versioned metadata or were pinned to the hydrology revision. */
export const LEGACY_GENERATION = 2;
export interface WorldGenerationMeta {
  version: WorldGeneration;
  migratedFrom?: 1;
}
export const isWorldGeneration = (v: unknown): v is WorldGeneration =>
  v === 1 || v === 2 || v === 3 || v === 4 || v === 5;

/**
 * Decide a world's revision from its saved metadata.
 * - Saved metadata always wins and is never upgraded: a revision-2 world stays revision 2 until an operator
 *   explicitly migrates it (there is no automatic path to revision 3).
 * - A revision-1 world is lifted to revision 2 by the limited hydrology migration.
 * - No metadata and no saved characters is a brand-new world and starts at `fresh`.
 *   (Configured `fresh = 2` keeps the previous behaviour for every unsaved world, including its hydrology flag.)
 * - No metadata but existing characters is a legacy world: revision 2 with the hydrology migration.
 */
export function generationMeta(
  saved: unknown,
  opts: { hasWorldData?: boolean; fresh?: WorldGeneration } = {},
): WorldGenerationMeta {
  if (saved === null || saved === undefined) {
    const fresh = opts.fresh ?? 2;
    if (fresh >= 3 && opts.hasWorldData === false) return { version: fresh };
    return { version: LEGACY_GENERATION, migratedFrom: 1 };
  }
  const value = saved as Partial<WorldGenerationMeta>;
  if (!isWorldGeneration(value.version))
    throw new Error('Unsupported saved world generation; restore a compatible server');
  if (value.version === 3 || value.version === 4 || value.version === 5) return { version: value.version };
  return value.version === 1 || value.migratedFrom === 1 ? { version: 2, migratedFrom: 1 } : { version: 2 };
}
