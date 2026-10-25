import { hash2 } from './rng';
import { T } from './tiles';
import { tileAt } from './worldgen';
import type { Shrine } from './shrines';
import type { WorldObj } from './objects';

export const DIVE_OY = -120000;
export const isDiveY = (y: number): boolean => y > DIVE_OY - 3600 && y < DIVE_OY + 3600;
export const trapSafe = (now: number, pad: number): boolean => (Math.floor(now / 1000) + pad) % 4 < 2;
const gateCache = new Map<string, { x: number; y: number } | null>();

/** One sparse buoy per 192-tile sea cell, always with room for a sloop. */
export function oceanGate(seed: number, gx: number, gy: number): { x: number; y: number } | null {
  const key = `${seed}:${gx},${gy}`,
    cached = gateCache.get(key);
  if (cached !== undefined) return cached;
  const p = makeGate(seed, gx, gy);
  if (gateCache.size > 4000) gateCache.clear();
  gateCache.set(key, p);
  return p;
}
function makeGate(seed: number, gx: number, gy: number): { x: number; y: number } | null {
  if (hash2(seed, gx, gy, 1810) > 0.35 || Math.abs(gy) > 17) return null;
  const x = gx * 192 + 48 + Math.floor(hash2(seed, gx, gy, 1811) * 96);
  const y = gy * 192 + 48 + Math.floor(hash2(seed, gx, gy, 1812) * 96);
  if (Math.hypot(x, y) < 250) return null;
  for (let j = -2; j <= 2; j++)
    for (let i = -2; i <= 2; i++) if (tileAt(seed, x + i, y + j) !== T.DEEP_WATER) return null;
  return { x, y };
}
export function oceanShrine(seed: number, gx: number, gy: number): Shrine | null {
  const p = oceanGate(seed, gx, gy);
  if (!p) return null;
  const type = (['platform', 'traps', 'balance', 'sequence'] as const)[Math.floor(hash2(seed, gx, gy, 1813) * 4)]!;
  return {
    id: `os${gx}_${gy}`,
    x: p.x,
    y: p.y + DIVE_OY,
    type,
    pillars: [
      [-4, 0],
      [0, -4],
      [4, 0],
      [0, 4],
    ],
  };
}
export function sanctuaryTileAt(seed: number, x: number, y: number): number | null {
  if (!isDiveY(y)) return null;
  const sh = oceanShrine(seed, Math.floor(x / 192), Math.floor((y - DIVE_OY) / 192));
  if (!sh) return T.CAVE_WALL;
  const dx = x - sh.x,
    dy = y - sh.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) >= 10) return T.CAVE_WALL;
  if (sh.type === 'platform') {
    const pad = sh.pillars.some(([px, py]) => Math.max(Math.abs(dx - px), Math.abs(dy - py)) <= 1);
    if (!pad && !(Math.abs(dx) <= 1 && dy >= -1 && dy <= 8)) return T.DEEP_WATER;
  }
  return T.VAULT_FLOOR;
}
export function sanctuaryObjectsIn(seed: number, cx: number, cy: number): WorldObj[] {
  const diving = isDiveY(cy * 32),
    out: WorldObj[] = [];
  const y0 = cy * 32 - (diving ? DIVE_OY : 0);
  // A room can straddle the edge of its candidate's sea cell.
  for (let gy = Math.floor((y0 - 12) / 192); gy <= Math.floor((y0 + 44) / 192); gy++)
    for (let gx = Math.floor((cx * 32 - 12) / 192); gx <= Math.floor((cx * 32 + 44) / 192); gx++) {
      const p = oceanGate(seed, gx, gy);
      if (!p) continue;
      const add = (x: number, y: number, sub: string, data: Record<string, unknown>) => {
        if (Math.floor(x / 32) === cx && Math.floor(y / 32) === cy)
          out.push({ x, y, sub, kind: 'deco', static: true, data });
      };
      if (!diving) add(p.x, p.y, 'dive_gate', { to: { x: p.x + 0.5, y: p.y + DIVE_OY + 7.5 } });
      else {
        const sh = oceanShrine(seed, gx, gy)!;
        add(sh.x, sh.y - 8, 'sea_arch', {});
        add(sh.x, sh.y + 7, 'dive_exit', { to: { x: p.x + 0.5, y: p.y + 0.5 } });
        add(sh.x, sh.y, 'shrine_altar', { shrine: sh.id, type: sh.type });
        sh.pillars.forEach(([dx, dy], idx) =>
          add(sh.x + dx, sh.y + dy, 'shrine_pillar', { shrine: sh.id, idx, type: sh.type }),
        );
        for (const dx of [-8, 8]) for (const dy of [-8, 8]) add(sh.x + dx, sh.y + dy, 'coral_column', {});
      }
    }
  return out;
}
