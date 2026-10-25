import { caveRegion, caveTownAt, CAVE_OY } from './undercroft';
import { isCaveY } from './caves';
import { hash2 } from './rng';
import { landmarkTileAt, sampleClimate } from './worldgen';
import { isSolid } from './tiles';
import type { WorldObj } from './objects';
import { townFor, townAt } from './town';
import { oceanShrine, isDiveY, DIVE_OY } from './sanctuaries';

/**
 * Resonance Shrines, Zelda style: small ruins scattered across the wild, each a self-contained challenge. Placement is a
 * pure function of the seed (every client and server agrees, and nothing is stored). Solving one grants a Shrine
 * Shard; four shards make a Heart Crystal.
 */
export type ShrineType = 'sequence' | 'gauntlet' | 'balance' | 'trail' | 'traps' | 'platform';
export interface Shrine {
  id: string;
  x: number;
  y: number;
  type: ShrineType;
  /** pillar offsets from the altar for the sequence puzzle */
  pillars: Array<[number, number]>;
}

const REGION = 7; // chunks per cell: one shrine candidate per 224x224 tiles
const SAFE = 48; // never closer than this to the spawn shrine or the town

const PILLARS: Array<[number, number]> = [
  [-3, 0],
  [0, -3],
  [3, 0],
  [0, 3],
];

const cache = new Map<string, Shrine | null>();

function clear(seed: number, x: number, y: number): boolean {
  if (townAt(seed, x, y)) return false;
  for (let j = -4; j <= 4; j++)
    for (let i = -4; i <= 4; i++) {
      const t = landmarkTileAt(seed, x + i, y + j);
      if (isSolid(t)) return false;
    }
  return sampleClimate(seed, x, y).height > -0.05;
}

/** The shrine of region (rx, ry), if any. */
export function shrineOfRegion(seed: number, rx: number, ry: number): Shrine | null {
  const key = `${seed}:${rx},${ry}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let out: Shrine | null = null;
  const t = townFor(seed);
  for (let k = 0; k < 6 && !out; k++) {
    const x = rx * REGION * 32 + 16 + Math.floor(hash2(seed, rx * 31 + k, ry, 901) * (REGION * 32 - 32));
    const y = ry * REGION * 32 + 16 + Math.floor(hash2(seed, rx, ry * 31 + k, 902) * (REGION * 32 - 32));
    if (Math.hypot(x, y) < SAFE || (x > t.x0 - 12 && x < t.x1 + 12 && y > t.y0 - 12 && y < t.y1 + 12)) continue;
    if (!clear(seed, x, y)) continue;
    out = {
      id: `sh${rx}_${ry}`,
      x,
      y,
      type:
        hash2(seed, rx, ry, 903) < 0.5
          ? 'sequence'
          : (['gauntlet', 'balance', 'trail'] as const)[Math.floor(hash2(seed, rx, ry, 904) * 3)]!,
      pillars: PILLARS,
    };
  }
  cache.set(key, out);
  return out;
}

/** Survey chambers use the same persistent, authoritative shrine challenges as the surface. */
export function caveShrine(seed: number, gx: number, gy: number): Shrine | null {
  const r = caveRegion(seed, gx, gy);
  if (r.feature !== 'puzzle' || caveTownAt(r.x, r.y)) return null;
  return {
    id: `cs${gx}_${gy}`,
    x: r.x,
    y: r.y,
    type: (['sequence', 'balance', 'trail', 'traps', 'gauntlet'] as const)[Math.floor(hash2(seed, gx, gy, 2440) * 5)]!,
    pillars: PILLARS,
  };
}

/** Every shrine within `r` tiles of (x, y). */
export function shrinesNear(seed: number, x: number, y: number, r: number): Shrine[] {
  const out: Shrine[] = [];
  if (isCaveY(y) && !isDiveY(y)) {
    for (let gy = Math.floor((y - CAVE_OY - r) / 72); gy <= Math.floor((y - CAVE_OY + r) / 72); gy++)
      for (let gx = Math.floor((x - r) / 72); gx <= Math.floor((x + r) / 72); gx++) {
        const sh = caveShrine(seed, gx, gy);
        if (sh && Math.hypot(sh.x - x, sh.y - y) <= r) out.push(sh);
      }
    return out;
  }
  if (isDiveY(y)) {
    for (let gy = Math.floor((y - DIVE_OY - r) / 192); gy <= Math.floor((y - DIVE_OY + r) / 192); gy++)
      for (let gx = Math.floor((x - r) / 192); gx <= Math.floor((x + r) / 192); gx++) {
        const sh = oceanShrine(seed, gx, gy);
        if (sh && Math.hypot(sh.x - x, sh.y - y) <= r) out.push(sh);
      }
    return out;
  }
  const span = REGION * 32;
  for (let ry = Math.floor((y - r) / span); ry <= Math.floor((y + r) / span); ry++) {
    for (let rx = Math.floor((x - r) / span); rx <= Math.floor((x + r) / span); rx++) {
      const s = shrineOfRegion(seed, rx, ry);
      if (s && Math.hypot(s.x - x, s.y - y) <= r) out.push(s);
    }
  }
  return out;
}

/** The altar and pillars of every shrine in chunk (cx, cy), as static world objects. */
export function shrineObjectsIn(seed: number, cx: number, cy: number): WorldObj[] {
  const span = REGION;
  const sites =
    isCaveY(cy * 32) && !isDiveY(cy * 32)
      ? shrinesNear(seed, cx * 32 + 16, cy * 32 + 16, 32)
      : [shrineOfRegion(seed, Math.floor(cx / span), Math.floor(cy / span))].filter((s): s is Shrine => !!s);
  const out: WorldObj[] = [];
  const mine = (x: number, y: number) => Math.floor(x / 32) === cx && Math.floor(y / 32) === cy;
  for (const s of sites) {
    if (mine(s.x, s.y))
      out.push({
        x: s.x,
        y: s.y,
        kind: 'deco',
        sub: 'shrine_altar',
        static: true,
        data: { shrine: s.id, type: s.type },
      });
    s.pillars.forEach(([dx, dy], i) => {
      if (mine(s.x + dx, s.y + dy))
        out.push({
          x: s.x + dx,
          y: s.y + dy,
          kind: 'deco',
          sub: 'shrine_pillar',
          static: true,
          data: { shrine: s.id, idx: i },
        });
    });
  }
  return out;
}

export const SHRINE_REACH = 3.2;
export type ShrineEvent =
  | { kind: 'show'; shrine: string; pattern: number[]; stepMs: number }
  | { kind: 'hit'; shrine: string; idx: number; ok: boolean }
  | { kind: 'fail'; shrine: string }
  | { kind: 'barrier'; shrine: string; on: boolean; wave?: number; waves?: number }
  | { kind: 'solved'; shrine: string; text: string }
  | { kind: 'state'; solved: string[] }
  | { kind: 'balance'; shrine: string; mask: number }
  | { kind: 'trail'; shrine: string; pattern: number[]; stage: number; seconds: number };

export function shrineOfId(seed: number, id: string): Shrine | null {
  const m = /^(sh|os|cs)(-?\d+)_(-?\d+)$/.exec(id);
  return m
    ? m[1] === 'cs'
      ? caveShrine(seed, Number(m[2]), Number(m[3]))
      : m[1] === 'os'
        ? oceanShrine(seed, Number(m[2]), Number(m[3]))
        : shrineOfRegion(seed, Number(m[2]), Number(m[3]))
    : null;
}

/** Pressing a lantern toggles it and its clockwise neighbour. */
export const toggleShrineLantern = (mask: number, idx: number): number => mask ^ (1 << idx) ^ (1 << ((idx + 1) % 4));
