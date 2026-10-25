import { hash2 } from './rng';
import { T } from './tiles';

/** Local priority thinning: no request-order state and no square-cell planting pattern. */
export function spacedTree(seed: number, x: number, y: number): boolean {
  const p = hash2(seed, x, y, 2);
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && hash2(seed, x + dx, y + dy, 2) < p) return false;
    }
  return true;
}

/** A short, tilted mineral seam. All tiles in a seam share its material, including across chunk edges. */
export function mineralDeposit(seed: number, x: number, y: number): number | null {
  const gx = Math.floor(x / 12),
    gy = Math.floor(y / 12);
  if (hash2(seed, gx, gy, 1500) > 0.78) return null;
  const cx = gx * 12 + 4 + hash2(seed, gx, gy, 1501) * 4;
  const cy = gy * 12 + 4 + hash2(seed, gx, gy, 1502) * 4;
  const a = hash2(seed, gx, gy, 1503) * Math.PI;
  const dx = x + 0.5 - cx,
    dy = y + 0.5 - cy;
  const along = dx * Math.cos(a) + dy * Math.sin(a),
    across = -dx * Math.sin(a) + dy * Math.cos(a);
  if (Math.abs(along) > 3.4 || Math.abs(across + Math.sin(along * 0.8) * 0.25) > 0.9) return null;
  const material = hash2(seed, gx, gy, 1504);
  return material < 0.4 ? T.ORE_COPPER : material < 0.7 ? T.ORE_IRON : material < 0.88 ? T.ORE_SILVER : T.ORE_GOLD;
}
