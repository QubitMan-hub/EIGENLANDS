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
/** the rooms, relative to the crypt's anchor (inclusive tile rects) */
export const CRYPT_ROOMS: Record<'entrance' | 'passage1' | 'hall' | 'passage2' | 'reliquary', Rect> = {
  entrance: [-3, -3, 3, 3],
  passage1: [-1, 4, 1, 10],
  hall: [-7, 11, 7, 23],
  passage2: [-1, 24, 1, 28],
  reliquary: [-4, 29, 4, 35],
};
const PILLARS: Array<[number, number]> = [
  [-4, 14],
  [4, 14],
  [-4, 20],
  [4, 20],
];
const TORCHES: Array<[number, number]> = [
  [-3, -3],
  [3, -3],
  [-7, 11],
  [7, 11],
  [-7, 23],
  [7, 23],
  [-4, 29],
  [4, 29],
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
  if (TORCHES.some(([tx, ty]) => tx === dx && ty === dy)) return T.TORCH;
  if (PILLARS.some(([px, py]) => Math.abs(dx - px) <= 0 && Math.abs(dy - py) <= 0)) return T.CAVE_WALL;
  for (const r of Object.values(CRYPT_ROOMS)) if (inRect(dx, dy, r)) return T.VAULT_FLOOR;
  return T.CAVE_WALL;
}

/** Where a traveller arrives coming down the stairs, and where they come out up top. */
export const cryptArrival = (c: CryptSite) => ({ x: c.x + 0.5, y: c.y + 1.5 });
export const cryptSurface = (c: CryptSite) => ({ x: c.door.x + 0.5, y: c.door.y + 1.5 });
/** Is (x, y) inside the wardens' hall of crypt `c`? */
export const inCryptHall = (c: CryptSite, x: number, y: number) =>
  inRect(Math.floor(x) - c.x, Math.floor(y) - c.y, CRYPT_ROOMS.hall);
/** Spots in the hall where wardens rise (between the pillars and along the far wall). */
export function cryptWardenSpots(c: CryptSite): Array<{ x: number; y: number }> {
  return [
    [0, 17],
    [-5, 17],
    [5, 17],
    [-2, 21],
    [2, 21],
    [0, 13],
  ].map(([dx, dy]) => ({ x: c.x + dx! + 0.5, y: c.y + dy! + 0.5 }));
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
      for (const [bx, by] of [
        [-6, 12],
        [6, 12],
        [-6, 22],
        [6, 22],
      ] as const)
        add(bx, by, 'trial_brazier');
      add(0, 34, 'crypt_reliquary');
      add(-3, 32, 'crypt_sarcophagus');
      add(3, 32, 'crypt_sarcophagus');
      // bones and rubble scattered about the hall, a little different under every ruin
      for (let k = 0; k < 4; k++) {
        const bx = -6 + Math.floor(hash2(seed, c.x, c.y, 1400 + k) * 13),
          by = 12 + Math.floor(hash2(seed, c.y, c.x, 1410 + k) * 11);
        if (!PILLARS.some(([px, py]) => px === bx && py === by) && !(bx === 0 && by === 17)) add(bx, by, 'crypt_bones');
      }
    }
  return out;
}
