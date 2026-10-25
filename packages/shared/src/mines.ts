import { regionOfTile } from './shards';
import { caveRegionAt, caveTownAt, type CavePoint } from './undercroft';

export interface MineLoop {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Small abandoned haulage circuits in dry mining chambers; never run through settlements or arenas. */
export function mineLoopAt(seed: number, x: number, y: number): MineLoop | null {
  if (y < 39488) return null;
  const r = caveRegionAt(seed, x, y);
  if (!['ruins', 'grove'].includes(r.feature) || caveTownAt(r.x, r.y)) return null;
  for (const dx of [-15, 15]) for (const dy of [-10, 10]) if (caveTownAt(r.x + dx, r.y + dy)) return null;
  // A mounted circuit stays in one authoritative room; crossing a shard would detach the rider.
  if (regionOfTile(r.x - 12) !== regionOfTile(r.x + 12) || regionOfTile(r.y - 7) !== regionOfTile(r.y + 7)) return null;
  return { x: r.x - 12, y: r.y - 7, w: 24, h: 14 };
}
export function mineRailAt(m: MineLoop | null, x: number, y: number): boolean {
  return (
    !!m &&
    x >= m.x &&
    x <= m.x + m.w &&
    y >= m.y &&
    y <= m.y + m.h &&
    (x === m.x || x === m.x + m.w || y === m.y || y === m.y + m.h)
  );
}
/** Rail endpoints: +x, +y, -x, -y. */
export function mineRailMask(m: MineLoop, x: number, y: number): number {
  return [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ].reduce((mask, [dx, dy], i) => (mineRailAt(m, x + dx!, y + dy!) ? mask | (1 << i) : mask), 0);
}
export function minePosition(m: MineLoop, travel: number): CavePoint & { fx: number; fy: number } {
  const length = 2 * (m.w + m.h);
  let t = ((travel % length) + length) % length;
  if (t < m.w) return { x: m.x + 0.5 + t, y: m.y + 0.5, fx: 1, fy: 0 };
  t -= m.w;
  if (t < m.h) return { x: m.x + m.w + 0.5, y: m.y + 0.5 + t, fx: 0, fy: 1 };
  t -= m.h;
  if (t < m.w) return { x: m.x + m.w + 0.5 - t, y: m.y + m.h + 0.5, fx: -1, fy: 0 };
  t -= m.w;
  return { x: m.x + 0.5, y: m.y + m.h + 0.5 - t, fx: 0, fy: -1 };
}
