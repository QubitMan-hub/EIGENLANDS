import { regionOfTile } from './shards';
import { hash2 } from './rng';
import { CAVE_OY, caveRegion, caveRegionAt, caveTownAt, segmentDistance2, type CavePoint } from './undercroft';

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

// ───────────────────────── revision 4: haulage lines ─────────────────────────

/**
 * An open haulage line (world revision 4): rails run from a loading bay in a district's centre chamber, down a drift
 * the generator cuts for them, to a mine face where the vein lodes are richest. Each end has a timber buffer, so the
 * cart can only travel the length of the line; a rider steers by pushing along or against the rails.
 */
export interface MineLine {
  id: string;
  /** corner points in tile coordinates, first = loading bay, last = face; axis-aligned legs */
  pts: Array<[number, number]>;
  /** total length in tiles */
  len: number;
  /** tile occupied by each rail piece, in order along the line */
  tiles: Array<{ x: number; y: number; mask: number }>;
  index: Map<number, number>;
}
export type MineTrack = MineLoop | MineLine;
export const isMineLine = (m: MineTrack): m is MineLine => 'pts' in m;

const lines = new Map<string, MineLine | null>();
const DIRS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as const;
export const mineLineKey = (x: number, y: number) => x * 65536 + (y - 39000);

/** The haulage line of a district, or null. Always lies inside one shard so a rider never leaves the room. */
export function mineLineOfRegion(seed: number, gx: number, gy: number): MineLine | null {
  const key = `${seed}:${gx},${gy}`;
  if (lines.has(key)) return lines.get(key)!;
  const r = caveRegion(seed, gx, gy, 4);
  let out: MineLine | null = null;
  const eligible = ['ruins', 'grove', 'vents'].includes(r.feature);
  if (eligible && hash2(seed, gx, gy, 2460) < 0.8 && !caveTownAt(r.x, r.y)) {
    const d0 = Math.floor(hash2(seed, gx, gy, 2461) * 4),
      turn = hash2(seed, gx, gy, 2462) < 0.5 ? 1 : 3;
    const a = 16 + Math.floor(hash2(seed, gx, gy, 2463) * 10),
      b = 9 + Math.floor(hash2(seed, gx, gy, 2464) * 9);
    const [dx, dy] = DIRS[d0]!,
      [ex, ey] = DIRS[(d0 + turn) % 4]!;
    const bay: [number, number] = [r.x + dx * 5, r.y + dy * 5];
    const p1: [number, number] = [bay[0] + dx * a, bay[1] + dy * a],
      p2: [number, number] = [p1[0] + ex * b, p1[1] + ey * b];
    const xs = [bay[0], p1[0], p2[0]],
      ys = [bay[1], p1[1], p2[1]];
    const inside = (v: number, lo: number) => v >= lo + 9 && v <= lo + 63;
    const sameShard = new Set(xs.map(regionOfTile)).size === 1 && new Set(ys.map((y) => regionOfTile(y))).size === 1;
    // keep clear of the lift pad and landing rooms
    if (xs.every((x) => inside(x, gx * 72)) && ys.every((y) => inside(y, CAVE_OY + gy * 72)) && sameShard) {
      const pts: Array<[number, number]> = [bay, p1, p2];
      const tiles: MineLine['tiles'] = [];
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1]!,
          [x1, y1] = pts[i]!;
        const sx = Math.sign(x1 - x0),
          sy = Math.sign(y1 - y0);
        for (let k = i === 1 ? 0 : 1, n = Math.abs(x1 - x0) + Math.abs(y1 - y0); k <= n; k++)
          tiles.push({ x: x0 + sx * k, y: y0 + sy * k, mask: 0 });
      }
      const index = new Map<number, number>();
      tiles.forEach((t, i) => index.set(mineLineKey(t.x, t.y), i));
      tiles.forEach((t, i) => {
        for (const j of [i - 1, i + 1]) {
          const o = tiles[j];
          if (!o) continue;
          const k = DIRS.findIndex(([ax, ay]) => t.x + ax === o.x && t.y + ay === o.y);
          if (k >= 0) t.mask |= 1 << k;
        }
        // a dead end still shows which way its rail runs, so the buffer faces the line
      });
      out = { id: `mn${gx}_${gy}`, pts, len: tiles.length - 1, tiles, index };
    }
  }
  if (lines.size > 1024) lines.clear();
  lines.set(key, out);
  return out;
}
export const mineLineAt = (seed: number, x: number, y: number): MineLine | null => {
  if (y < 39488) return null;
  const r = caveRegionAt(seed, x, y, 4),
    m = mineLineOfRegion(seed, r.gx, r.gy);
  return m && m.index.has(mineLineKey(Math.floor(x), Math.floor(y))) ? m : null;
};
export const mineLineHas = (m: MineLine, x: number, y: number): boolean => m.index.has(mineLineKey(x, y));
/** Distance (tiles) from a point to the nearest rail tile centre, for carving the drift. */
export function mineLineDistance(m: MineLine, x: number, y: number): number {
  let d = Infinity;
  for (let i = 1; i < m.pts.length; i++) {
    const a = m.pts[i - 1]!,
      b = m.pts[i]!;
    d = Math.min(
      d,
      Math.sqrt(segmentDistance2(x, y, { x: a[0] + 0.5, y: a[1] + 0.5 }, { x: b[0] + 0.5, y: b[1] + 0.5 })),
    );
  }
  return d;
}
/** Position and facing at `s` tiles along the line (0 = bay buffer). */
export function mineLinePosition(m: MineLine, s: number): { x: number; y: number; fx: number; fy: number } {
  const t = Math.max(0, Math.min(m.len, s));
  let left = t;
  for (let i = 1; i < m.pts.length; i++) {
    const a = m.pts[i - 1]!,
      b = m.pts[i]!,
      n = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]),
      sx = Math.sign(b[0] - a[0]),
      sy = Math.sign(b[1] - a[1]);
    if (left <= n || i === m.pts.length - 1) {
      const k = Math.min(left, n);
      return { x: a[0] + 0.5 + sx * k, y: a[1] + 0.5 + sy * k, fx: sx, fy: sy };
    }
    left -= n;
  }
  return { x: m.pts[0]![0] + 0.5, y: m.pts[0]![1] + 0.5, fx: 1, fy: 0 };
}
/**
 * Advance a rider. Loops move forward while any direction is held (revision 2/3 behaviour). A line is steered: the
 * input is projected onto the rails at the cart's position, so pushing along the track drives forward, against it
 * reverses, and across it does nothing. Buffers stop the cart at either end.
 */
export function mineStep(
  m: MineTrack,
  progress: number,
  dx: number,
  dy: number,
  dist: number,
): { progress: number; x: number; y: number; fx: number; fy: number } | null {
  if (!isMineLine(m)) {
    const length = 2 * (m.w + m.h),
      next = (progress + dist) % length;
    return { progress: next, ...minePosition(m, next) };
  }
  const here = mineLinePosition(m, progress);
  const drive = dx * here.fx + dy * here.fy;
  if (Math.abs(drive) < 0.35) return null;
  const next = Math.max(0, Math.min(m.len, progress + Math.sign(drive) * dist));
  if (next === progress) return null;
  const pos = mineLinePosition(m, next);
  // face along the direction of travel
  const s = Math.sign(drive);
  return { progress: next, x: pos.x, y: pos.y, fx: pos.fx * s, fy: pos.fy * s };
}
