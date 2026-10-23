import { hash2 } from './rng';
import { T } from './tiles';
import { tileAt } from './worldgen';
import type { WorldObj } from './objects';

/** Sparse salvage on open seas. Stable IDs use existing per-character discovery persistence. */
export function seaCache(seed: number, gx: number, gy: number): WorldObj | null {
  if (hash2(seed, gx, gy, 1700) > 0.18) return null;
  const x = gx * 96 + 24 + Math.floor(hash2(seed, gx, gy, 1701) * 48);
  const y = gy * 96 + 24 + Math.floor(hash2(seed, gx, gy, 1702) * 48);
  if (Math.hypot(x, y) < 230 || y >= 39000) return null;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (tileAt(seed, x + i, y + j) !== T.DEEP_WATER) return null;
  return { x, y, kind: 'deco', sub: 'sea_cache', static: true, data: { ruin: `sea${gx}_${gy}`, ocean: true } };
}
export function oceanObjectsIn(seed: number, cx: number, cy: number): WorldObj[] {
  const o = seaCache(seed, Math.floor(cx / 3), Math.floor(cy / 3));
  return o && Math.floor(o.x / 32) === cx && Math.floor(o.y / 32) === cy ? [o] : [];
}
