/**
 * Crypt interiors (master plan §16 "dungeons and ruins"). Each ruin that hides a crypt (stories.ts `ruinCrypt`) has a
 * real underground interior on its own plane, CRYPT_OY tiles away, laid out the same way under every crypt:
 *
 *   entrance (stairs up)  →  passage  →  wardens' hall (pillars, braziers)  →  passage  →  reliquary chamber
 *
 * The surface door takes you down to the entrance; the wardens rise in the hall the first time you walk in; once the
 * hall is clear the reliquary at the far end opens. Tiles and props are pure functions of the seed (the plane is
 * stone wall everywhere else), so nothing is stored but each traveller's own progress.
 */
import { hash2 } from './rng';
import { T } from './tiles';
import type { WorldObj } from './objects';
import { ruinOfCell, type RuinSite } from './ruins';
import { ruinCrypt } from './stories';

import { CRYPT_OY, isCryptY } from './cryptplane';
export { CRYPT_OY, isCryptY };

type Rect = [x0: number, y0: number, x1: number, y1: number];
type Pt = readonly [number, number];
/** the first plan's rooms, relative to the crypt's anchor (inclusive tile rects) */
export const CRYPT_ROOMS: Record<'entrance' | 'passage1' | 'hall' | 'passage2' | 'reliquary', Rect> = {
  entrance: [-3, -3, 3, 3],
  passage1: [-1, 4, 1, 10],
  hall: [-7, 11, 7, 23],
  passage2: [-1, 24, 1, 28],
  reliquary: [-4, 29, 4, 35],
};

/**
 * The floor plans a crypt can follow. Every plan starts at the same stairs and ends in the same reliquary chamber, so
 * the way in, the way out and the reward never move; what lies between differs: a pillared hall, a long gallery behind
 * an antechamber, or catacombs with burial niches in the walls.
 */
export interface CryptPlan {
  name: 'pillared hall' | 'long gallery' | 'catacombs';
  rooms: Rect[];
  hall: Rect;
  pillars: Pt[];
  torches: Pt[];
  /** the four named braziers of the hall (the puzzle) */
  braziers: Pt[];
  /** wall niches holding the dead */
  niches: Pt[];
}
const ENDS: Rect[] = [CRYPT_ROOMS.entrance, CRYPT_ROOMS.reliquary];
export const CRYPT_PLANS: CryptPlan[] = [
  {
    name: 'pillared hall',
    rooms: [...ENDS, CRYPT_ROOMS.passage1, CRYPT_ROOMS.hall, CRYPT_ROOMS.passage2],
    hall: CRYPT_ROOMS.hall,
    pillars: [
      [-4, 14],
      [4, 14],
      [-4, 20],
      [4, 20],
    ],
    torches: [
      [-3, -3],
      [3, -3],
      [-7, 11],
      [7, 11],
      [-7, 23],
      [7, 23],
      [-4, 29],
      [4, 29],
    ],
    braziers: [
      [-6, 12],
      [6, 12],
      [-6, 22],
      [6, 22],
    ],
    niches: [],
  },
  {
    name: 'long gallery',
    rooms: [...ENDS, [-1, 4, 1, 6], [-4, 7, 4, 10], [-5, 11, 5, 25], [-1, 26, 1, 28]],
    hall: [-5, 11, 5, 25],
    pillars: [
      [-2, 14],
      [2, 14],
      [-2, 19],
      [2, 19],
      [-2, 23],
      [2, 23],
    ],
    torches: [
      [-3, -3],
      [3, -3],
      [-4, 7],
      [4, 7],
      [-5, 11],
      [5, 11],
      [-5, 25],
      [5, 25],
      [-4, 29],
      [4, 29],
    ],
    braziers: [
      [-4, 12],
      [4, 12],
      [-4, 24],
      [4, 24],
    ],
    niches: [],
  },
  {
    name: 'catacombs',
    rooms: [
      ...ENDS,
      CRYPT_ROOMS.passage1,
      CRYPT_ROOMS.hall,
      CRYPT_ROOMS.passage2,
      [-8, 13, -8, 14],
      [8, 13, 8, 14],
      [-8, 19, -8, 20],
      [8, 19, 8, 20],
    ],
    hall: CRYPT_ROOMS.hall,
    pillars: [
      [-3, 15],
      [3, 15],
      [-3, 19],
      [3, 19],
    ],
    torches: [
      [-3, -3],
      [3, -3],
      [-7, 11],
      [7, 11],
      [-7, 23],
      [7, 23],
      [-4, 29],
      [4, 29],
    ],
    braziers: [
      [-6, 12],
      [6, 12],
      [-6, 22],
      [6, 22],
    ],
    niches: [
      [-8, 13],
      [8, 14],
      [-8, 20],
      [8, 19],
    ],
  },
];

export interface CryptSite {
  ruin: RuinSite;
  /** the surface door */
  door: { x: number; y: number };
  /** the interior's anchor tile on the crypt plane */
  x: number;
  y: number;
}

/** The crypt whose interior anchor is (rx, ry + CRYPT_OY) for a ruin at (rx, ry). */
export function cryptOf(seed: number, r: RuinSite): CryptSite | null {
  const door = ruinCrypt(seed, r);
  return door ? { ruin: r, door, x: r.x, y: r.y + CRYPT_OY } : null;
}

const inRect = (dx: number, dy: number, [x0, y0, x1, y1]: Rect) => dx >= x0 && dx <= x1 && dy >= y0 && dy <= y1;

/** Which floor plan crypt `c` follows (fixed by its place in the world). */
export const cryptPlan = (c: CryptSite): CryptPlan =>
  CRYPT_PLANS[Math.floor(hash2(0x6c7, c.x, c.y - CRYPT_OY, 77) * CRYPT_PLANS.length)]!;

/** The crypt (if any) whose rooms could contain the crypt-plane tile (x, y). */
export function cryptAt(seed: number, x: number, y: number): CryptSite | null {
  if (!isCryptY(y)) return null;
  const sy = y - CRYPT_OY;
  // rooms reach 8 tiles across and 36 down from the anchor: look in this cell and the ones above and beside it
  for (let gy = Math.floor((sy - 36) / 96); gy <= Math.floor((sy + 3) / 96); gy++)
    for (let gx = Math.floor((x - 8) / 96); gx <= Math.floor((x + 8) / 96); gx++) {
      const r = ruinOfCell(seed, gx, gy);
      const c = r && cryptOf(seed, r);
      if (c && Math.abs(x - c.x) <= 8 && y - c.y >= -4 && y - c.y <= 36) return c;
    }
  return null;
}

/** Tiles of the crypt plane: stone everywhere, carved rooms under each crypted ruin. */
export function cryptTileAt(seed: number, x: number, y: number): number | null {
  if (!isCryptY(y)) return null;
  const c = cryptAt(seed, x, y);
  if (!c) return T.CAVE_WALL;
  const dx = x - c.x,
    dy = y - c.y;
  const plan = cryptPlan(c);
  if (plan.torches.some(([tx, ty]) => tx === dx && ty === dy)) return T.TORCH;
  if (plan.pillars.some(([px, py]) => px === dx && py === dy)) return T.CAVE_WALL;
  for (const r of plan.rooms) if (inRect(dx, dy, r)) return T.VAULT_FLOOR;
  return T.CAVE_WALL;
}

/** Where a traveller arrives coming down the stairs, and where they come out up top. */
export const cryptArrival = (c: CryptSite) => ({ x: c.x + 0.5, y: c.y + 1.5 });
export const cryptSurface = (c: CryptSite) => ({ x: c.door.x + 0.5, y: c.door.y + 1.5 });
/** Is (x, y) inside the wardens' hall of crypt `c`? */
export const inCryptHall = (c: CryptSite, x: number, y: number) =>
  inRect(Math.floor(x) - c.x, Math.floor(y) - c.y, cryptPlan(c).hall);
/** Spots in the hall where wardens rise (between the pillars and along the far wall). */
const WARDEN_SPOTS: Pt[] = [
  [0, 17],
  [-4, 17],
  [4, 17],
  [-1, 21],
  [1, 21],
  [0, 13],
];
export function cryptWardenSpots(c: CryptSite): Array<{ x: number; y: number }> {
  return WARDEN_SPOTS.map(([dx, dy]) => ({ x: c.x + dx + 0.5, y: c.y + dy + 0.5 }));
}

// ───────────────────────── the braziers' riddle ─────────────────────────

/** The four dead the hall's braziers are carved for. */
export const CRYPT_DEAD = ['the Mason', 'the Widow', 'the Knight', 'the Child'] as const;
/** The order the dead were laid to rest in (brazier indices): light them so to open the hidden ossuary. */
export function cryptOrder(seed: number, c: CryptSite): number[] {
  const out = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) {
    const j = Math.floor(hash2(seed, c.x, c.y - CRYPT_OY, 1500 + i) * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
/** Which carved name brazier `idx` of crypt `c` bears (the carvings are shuffled too, crypt by crypt). */
export function brazierName(seed: number, c: CryptSite, idx: number): string {
  const shift = Math.floor(hash2(seed, c.x, c.y - CRYPT_OY, 1520) * 4);
  return CRYPT_DEAD[(idx + shift) % 4]!;
}
/** The plaque in the entrance: the order the dead were laid down, in words. */
export function cryptPlaqueText(seed: number, c: CryptSite): string {
  const names = cryptOrder(seed, c).map((i) => brazierName(seed, c, i));
  return `Here lie four of the old house, laid to rest in turn: first ${names[0]}, then ${names[1]}, then ${names[2]}, and last ${names[3]}. Light their flames as they were laid, and they will share what they kept.`;
}
export const cryptReliquary = (c: CryptSite) => ({ x: c.x, y: c.y + 34 });

/** Props in chunk (cx, cy) of the crypt plane. */
export function cryptObjectsIn(seed: number, cx: number, cy: number): WorldObj[] {
  const out: WorldObj[] = [];
  const x0 = cx * 32,
    y0 = cy * 32;
  if (!isCryptY(y0)) return out;
  const seen = new Set<string>();
  for (let y = y0 - 36; y <= y0 + 36; y += 16)
    for (let x = x0 - 8; x <= x0 + 40; x += 16) {
      const c = cryptAt(seed, x, y);
      if (!c || seen.has(c.ruin.id)) continue;
      seen.add(c.ruin.id);
      const data = { ruin: c.ruin.id, biome: c.ruin.biome };
      const add = (dx: number, dy: number, sub: string, extra: Record<string, unknown> = {}) => {
        const o: WorldObj = { x: c.x + dx, y: c.y + dy, kind: 'deco', sub, static: true, data: { ...data, ...extra } };
        if (Math.floor(o.x / 32) === cx && Math.floor(o.y / 32) === cy) out.push(o);
      };
      add(0, -2, 'crypt_exit', { to: cryptSurface(c) });
      const plan = cryptPlan(c);
      plan.braziers.forEach(([bx, by], i) => add(bx, by, 'trial_brazier', { idx: i }));
      add(-2, -1, 'crypt_plaque');
      for (const [nx, ny] of plan.niches) add(nx, ny, 'crypt_bones');
      add(0, 34, 'crypt_reliquary');
      add(-3, 32, 'crypt_sarcophagus');
      add(3, 32, 'crypt_sarcophagus');
      // bones and rubble scattered about the hall, a little different under every ruin
      for (let k = 0; k < 4; k++) {
        const [hx0, hy0, hx1, hy1] = plan.hall;
        const bx = hx0 + 1 + Math.floor(hash2(seed, c.x, c.y, 1400 + k) * (hx1 - hx0 - 1)),
          by = hy0 + 1 + Math.floor(hash2(seed, c.y, c.x, 1410 + k) * (hy1 - hy0 - 1));
        const busy = [...plan.pillars, ...plan.braziers, ...plan.torches].some(([px, py]) => px === bx && py === by);
        if (!busy && !WARDEN_SPOTS.some(([wx, wy]) => wx === bx && wy === by)) add(bx, by, 'crypt_bones');
      }
    }
  return out;
}
