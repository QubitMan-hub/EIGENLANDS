import { CHUNK_SIZE, T, biomeAt, chunkOf, hash2, vegetationCover, townFor, type ChunkStore } from '@eigenlands/shared';

export type SceneryKind = 'wild_ferns' | 'wild_reeds' | 'wild_clover' | 'wild_leaves' | 'wild_bough' | 'wild_driftwood' | 'wild_scree' | 'wild_stalagmite' | 'wild_glowcap';

/** Cosmetic only: one candidate per 8×8 cell. Never changes terrain, collision, loot or persisted objects. */
export function sceneryAt(store: ChunkStore, x: number, y: number): SceneryKind | null {
  const { seed } = store, gx = Math.floor(x / 8), gy = Math.floor(y / 8);
  if (x !== gx * 8 + Math.floor(hash2(seed, gx, gy, 1201) * 8) || y !== gy * 8 + Math.floor(hash2(seed, gx, gy, 1202) * 8)) return null;
  if (hash2(seed, gx, gy, 1203) > 0.3 + 0.45 * vegetationCover(seed, x, y) || Math.hypot(x, y) < 12) return null;
  const t = townFor(seed);
  if (x >= t.x0 - 2 && x <= t.x1 + 2 && y >= t.y0 - 2 && y <= t.y1 + 2) return null;
  const c = store.get(chunkOf(x), chunkOf(y));
  if (c.diff.has((y - c.cy * CHUNK_SIZE) * CHUNK_SIZE + x - c.cx * CHUNK_SIZE) || store.objectAt(x, y)) return null;
  const tile = store.getTile(x, y), b = biomeAt(seed, x, y);
  if (tile === T.CAVE_FLOOR) return hash2(seed, x, y, 1204) < 0.3 ? 'wild_glowcap' : 'wild_stalagmite';
  if (tile === T.SAND) {
    const nearWater = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => store.getTile(x + dx!, y + dy!) === T.WATER);
    return nearWater ? (hash2(seed, gx, gy, 1205) < 0.6 ? 'wild_reeds' : 'wild_driftwood') : b === 'desert' ? 'wild_scree' : null;
  }
  if (tile !== T.GRASS) return null;
  if (b === 'taiga' || b === 'corrupted' || b === 'desert') return 'wild_scree';
  if (b === 'swamp' || b === 'enchanted') return 'wild_glowcap';
  // Litter and ferns belong beside trunks, not scattered equally through an entire biome.
  const sheltered = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]].some(([dx, dy]) => store.getTile(x + dx!, y + dy!) === T.TREE);
  if (sheltered && hash2(seed, x, y, 1206) < 0.6) return 'wild_ferns';
  if (b === 'autumn') return 'wild_leaves';
  if (b === 'forest' && sheltered) return hash2(seed, x, y, 1204) < 0.5 ? 'wild_bough' : 'wild_leaves';
  return 'wild_clover';
}
