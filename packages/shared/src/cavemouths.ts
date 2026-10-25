import { CAVE_OY } from './undercroft';
import { hash2 } from './rng';
import { isSolid } from './tiles';
import { townAt, townFor } from './town';
import { ruinOfCell } from './ruins';
import { HOME_VALE, biomeAt, landmarkTileAt, type Biome } from './worldgen';

export interface CaveMouth {
  id: string;
  x: number;
  y: number;
  biome: Biome;
}

export const MOUTH_CELL = 72;
const CELL = MOUTH_CELL;
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
      if (Math.hypot(x, y) < HOME_VALE * 0.55 || (x > t.x0 - 8 && x < t.x1 + 8 && y > t.y0 - 8 && y < t.y1 + 8))
        continue;
      if (townAt(seed, x, y)) continue;
      let clear = true;
      for (let j = -1; j <= 2 && clear; j++)
        for (let i = -1; i <= 1 && clear; i++) if (isSolid(landmarkTileAt(seed, x + i, y + j))) clear = false;
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

const shafts = new Map<string, CaveMouth | null>();
export function caveShaftOfCell(seed: number, gx: number, gy: number): CaveMouth | null {
  const key = `${seed}:${gx},${gy}`;
  if (shafts.has(key)) return shafts.get(key)!;
  let out: CaveMouth | null = null;
  if (!caveOfCell(seed, gx, gy))
    for (let k = 12; k < 48 && !out; k++) {
      const x = gx * 72 + 8 + Math.floor(hash2(seed, gx * 17 + k, gy, 962) * 56),
        y = gy * 72 + 8 + Math.floor(hash2(seed, gx, gy * 17 + k, 963) * 56);
      if (Math.hypot(x, y) < HOME_VALE * 0.55 || townAt(seed, x, y)) continue;
      let clear = true;
      for (let j = -1; j <= 2; j++)
        for (let i = -1; i <= 1; i++) if (isSolid(landmarkTileAt(seed, x + i, y + j))) clear = false;
      if (clear) out = { id: `sx${gx}_${gy}`, x, y, biome: biomeAt(seed, x, y) };
    }
  if (shafts.size > 2048) shafts.clear();
  shafts.set(key, out);
  return out;
}

export function mouthsNear(seed: number, x: number, y: number, r: number): CaveMouth[] {
  const out: CaveMouth[] = [];
  for (let gy = Math.floor((y - r) / CELL); gy <= Math.floor((y + r) / CELL); gy++) {
    for (let gx = Math.floor((x - r) / CELL); gx <= Math.floor((x + r) / CELL); gx++) {
      const m = caveOfCell(seed, gx, gy);
      if (m) out.push(m);
      const secondary = caveShaftOfCell(seed, gx, gy);
      if (secondary) out.push(secondary);
    }
  }
  return out;
}
