import { CHUNK_SIZE } from './constants';
import type { WorldObj } from './objects';
import { hash2 } from './rng';
import { ruinOfCell } from './ruins';
import { Simplex2D } from './simplex';
import { T, isSolid } from './tiles';
import { townFor } from './town';
import { HOME_VALE, biomeAt, tileAt, type Biome } from './worldgen';

/**
 * The Undercroft: a cave layer under the whole world. It lives on its own plane far south (y + CAVE_OY), so every
 * surface tile (x, y) has a cave tile (x, y + CAVE_OY) under it. Cave mouths in the wild drop you straight down into a
 * lit landing chamber with a ladder back up; from there winding tunnels and caverns hold ore veins, qubit crystals,
 * glowcaps, still pools, the torches of old miners and a forgotten cache. Cave rock can be dug: tunnels stay dug.
 */
export const CAVE_OY = 40000;
/** True for tiles on the cave plane. */
export const isCaveY = (y: number): boolean => y >= CAVE_OY - 512;

export interface CaveMouth { id: string; x: number; y: number; biome: Biome }

const CELL = 72;
const cache = new Map<string, CaveMouth | null>();

/** The cave mouth of one 72x72 surface cell, if it has one. */
export function caveOfCell(seed: number, gx: number, gy: number): CaveMouth | null {
  const key = `${seed}:${gx},${gy}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let out: CaveMouth | null = null;
  if (hash2(seed, gx, gy, 961) < 0.5) {
    const t = townFor(seed);
    for (let k = 0; k < 12 && !out; k++) {
      const x = gx * CELL + 8 + Math.floor(hash2(seed, gx * 17 + k, gy, 962) * (CELL - 16));
      const y = gy * CELL + 8 + Math.floor(hash2(seed, gx, gy * 17 + k, 963) * (CELL - 16));
      if (Math.hypot(x, y) < HOME_VALE * 0.55 || (x > t.x0 - 8 && x < t.x1 + 8 && y > t.y0 - 8 && y < t.y1 + 8)) continue;
      let clear = true;
      for (let j = -1; j <= 2 && clear; j++) for (let i = -1; i <= 1 && clear; i++) if (isSolid(tileAt(seed, x + i, y + j))) clear = false;
      if (!clear) continue;
      const r = ruinOfCell(seed, Math.floor(x / 96), Math.floor(y / 96));
      if (r && Math.hypot(r.x - x, r.y - y) < 9) continue;
      out = { id: `cv${gx}_${gy}`, x, y, biome: biomeAt(seed, x, y) };
    }
  }
  if (cache.size > 4000) cache.clear();
  cache.set(key, out);
  return out;
}

function mouthsNear(seed: number, x: number, y: number, r: number): CaveMouth[] {
  const out: CaveMouth[] = [];
  for (let gy = Math.floor((y - r) / CELL); gy <= Math.floor((y + r) / CELL); gy++) {
    for (let gx = Math.floor((x - r) / CELL); gx <= Math.floor((x + r) / CELL); gx++) {
      const m = caveOfCell(seed, gx, gy);
      if (m) out.push(m);
    }
  }
  return out;
}

const noise = new Map<number, [Simplex2D, Simplex2D, Simplex2D]>();
function caveNoise(seed: number): [Simplex2D, Simplex2D, Simplex2D] {
  let n = noise.get(seed);
  if (!n) { n = [new Simplex2D(seed ^ 0xca5e), new Simplex2D(seed ^ 0x0bed), new Simplex2D(seed ^ 0x7001)]; noise.set(seed, n); }
  return n;
}

/** Generated tile of the cave plane at world (x, y) (y already on the cave plane). */
export function caveTileAt(seed: number, x: number, y: number): number {
  const ly = y - CAVE_OY;
  const [a, b, c] = caveNoise(seed);
  // landing chambers under every mouth: always open, always dry, kept clear of clutter
  let landing = 99;
  for (const m of mouthsNear(seed, x, ly, 8)) landing = Math.min(landing, Math.hypot((x - m.x) * 0.85, ly - m.y));
  if (landing < 3.2) return T.CAVE_FLOOR;
  // winding tunnels along the zero contours of two smooth fields (2-3 tiles wide), broad caverns where a third peaks
  const worm = Math.min(Math.abs(a.fbm(x / 34, ly / 34, 2)), Math.abs(c.fbm(x / 41 + 60, ly / 41, 2)) * 1.1);
  const hall = b.fbm(x / 46 + 100, ly / 46, 3);
  const open = worm < 0.085 || hall > 0.32 || landing < 5.5 + 1.5 * c.noise(x / 6, ly / 6);
  if (!open) return T.CAVE_WALL;
  if (hall > 0.46 && c.fbm(x / 14, ly / 14 + 40, 2) > 0.2 && landing > 7) return c.fbm(x / 14, ly / 14 + 40, 2) > 0.38 ? T.DEEP_WATER : T.WATER;
  if (landing < 6) return T.CAVE_FLOOR;
  const h = hash2(seed, x, y, 977);
  if (h < 0.032) {
    const o = hash2(seed, x, y, 978);
    return o < 0.3 ? T.ORE_IRON : o < 0.55 ? T.ORE_COPPER : o < 0.8 ? T.ORE_SILVER : T.ORE_GOLD;
  }
  if (h < 0.042) return T.CRYSTAL;
  if (h < 0.065) return T.ROCK;
  if (h < 0.082) return T.SHIMMER;                                    // glowcaps
  if (h < 0.085) return T.TORCH;                                    // an old miner's torch, still burning
  return T.CAVE_FLOOR;
}

/** Static objects of chunk (cx, cy): cave mouths on the surface; ladders and forgotten caches below. */
export function caveObjectsIn(seed: number, cx: number, cy: number): WorldObj[] {
  const out: WorldObj[] = [];
  const x0 = cx * CHUNK_SIZE, y0 = cy * CHUNK_SIZE;
  const below = isCaveY(y0);
  const sy = below ? y0 - CAVE_OY : y0;
  const inChunk = (x: number, y: number) => x >= x0 && x < x0 + CHUNK_SIZE && y >= y0 && y < y0 + CHUNK_SIZE;
  for (const m of mouthsNear(seed, x0 + CHUNK_SIZE / 2, sy + CHUNK_SIZE / 2, CHUNK_SIZE)) {
    if (!below) {
      if (inChunk(m.x, m.y)) out.push({ x: m.x, y: m.y, kind: 'deco', sub: 'cave_mouth', static: true, data: { cave: m.id, biome: m.biome } });
      continue;
    }
    if (inChunk(m.x, m.y + CAVE_OY)) out.push({ x: m.x, y: m.y + CAVE_OY, kind: 'deco', sub: 'cave_ladder', static: true, data: { cave: m.id } });
    const k = cacheSpot(seed, m);
    if (k && inChunk(k.x, k.y)) out.push({ x: k.x, y: k.y, kind: 'deco', sub: 'ruin_cache', static: true, data: { ruin: `${m.id}c`, biome: m.biome } });
  }
  return out;
}

/** A dry, open tile some way down the tunnels from the landing where a cache was left behind. */
function cacheSpot(seed: number, m: CaveMouth): { x: number; y: number } | null {
  for (let k = 0; k < 24; k++) {
    const a = hash2(seed, m.x + k, m.y, 981) * Math.PI * 2, d = 9 + hash2(seed, m.x, m.y + k, 982) * 14;
    const x = Math.round(m.x + Math.cos(a) * d), y = Math.round(m.y + Math.sin(a) * d) + CAVE_OY;
    if (tileAt(seed, x, y) === T.CAVE_FLOOR && tileAt(seed, x, y + 1) === T.CAVE_FLOOR && tileAt(seed, x - 1, y) === T.CAVE_FLOOR) return { x, y };
  }
  return null;
}

/** Where a traveller stands after climbing down (cave) or out (surface) of mouth `id`. */
export function caveLanding(seed: number, id: string, down: boolean): { x: number; y: number } | null {
  const m = /^cv(-?\d+)_(-?\d+)$/.exec(id);
  if (!m) return null;
  const mouth = caveOfCell(seed, Number(m[1]), Number(m[2]));
  if (!mouth) return null;
  return down ? { x: mouth.x + 0.5, y: mouth.y + CAVE_OY + 1.5 } : { x: mouth.x + 0.5, y: mouth.y + 1.5 };
}
