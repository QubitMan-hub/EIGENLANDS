import {
  CAVE_OY,
  caveRegionAt,
  caveRegion,
  caveRouteDistance2,
  caveWaystation,
  caveTownAt,
  CAVE_TOWNS,
  caveExitsNear,
  segmentDistance2,
} from './undercroft';
export { CAVE_OY } from './undercroft';
import { mineLoopAt, mineRailAt, mineRailMask } from './mines';
import { caveFeatureObjects2 } from './caves2';
import { mineralDeposit } from './distribution';
import { CHUNK_SIZE } from './constants';
import type { WorldObj } from './objects';
import { hash2 } from './rng';
import { ruinOfCell } from './ruins';
import { Simplex2D } from './simplex';
import { T, isSolid } from './tiles';
import { townFor, townAt } from './town';
import { HOME_VALE, biomeAt, landmarkTileAt, type Biome } from './worldgen';

/**
 * The Undercroft: a cave layer under the whole world. It lives on its own plane far south (y + CAVE_OY), so every
 * surface tile (x, y) has a cave tile (x, y + CAVE_OY) under it. Cave mouths in the wild drop you straight down into a
 * lit landing chamber with a ladder back up; from there winding tunnels and caverns hold ore veins, qubit crystals,
 * glowcaps, still pools, the torches of old miners and a forgotten cache. Cave rock can be dug: tunnels stay dug.
 */

/** True for tiles on the cave plane. */
export const isCaveY = (y: number): boolean => y >= CAVE_OY - 512;

export { caveOfCell, caveShaftOfCell, mouthsNear, type CaveMouth } from './cavemouths';
import { mouthsNear, caveOfCell, caveShaftOfCell, type CaveMouth } from './cavemouths';

const noise = new Map<number, Simplex2D>();
/** Wide connected routes and authored discoveries; deposits replace rock, never the dry route core. */
export function caveTileAt(seed: number, x: number, y: number, legacy = false): number {
  const ly = y - CAVE_OY,
    r = caveRegionAt(seed, x, y),
    route = caveRouteDistance2(seed, x, y);
  let landing = Infinity;
  for (const m of mouthsNear(seed, x, ly, 9)) landing = Math.min(landing, (x - m.x) ** 2 + (ly - m.y) ** 2);
  const lift = caveWaystation(seed, r.gx, r.gy),
    ld = lift ? Math.hypot(x - lift.x, y - lift.y) : Infinity;
  if (landing < 42 || ld < 4 || mineRailAt(mineLoopAt(seed, x, y), x, y)) return T.CAVE_FLOOR;
  let n = noise.get(seed);
  if (!n) {
    n = new Simplex2D(seed ^ 0xca5e);
    if (noise.size > 8) noise.clear();
    noise.set(seed, n);
  }
  const dx = x - r.x,
    dy = y - r.y,
    room = (dx / r.rx) ** 2 + (dy / r.ry) ** 2;
  const magma = r.biome === 'basalt' && ((dx - 12) / 7) ** 2 + ((dy - 7) / 5) ** 2 < 1;
  const lake = (r.feature === 'lake' || r.biome === 'drowned') && ((dx - 8) / 10) ** 2 + ((dy - 5) / 8) ** 2 < 1;
  if (r.feature === 'arena' && dx * dx + dy * dy < 19 * 19) {
    if (dx * dx + dy * dy > 16 * 16 && route > 10) return r.biome === 'basalt' ? T.LAVA : T.WATER;
    return T.VAULT_FLOOR;
  }
  if (route < 6.25) return lake ? T.FLOOR : T.PATH;
  // Preserve a roomy, dry centre for orientation, combat and district connections.
  if (dx * dx + dy * dy < 110) return T.CAVE_FLOOR;
  const sx = r.gx * 72 + 12,
    sy = CAVE_OY + r.gy * 72 + 12,
    secret = Math.hypot(x - sx, y - sy);
  if (r.feature === 'secret' && secret < 8) return secret < 5.5 ? T.CAVE_FLOOR : T.CAVE_WALL;
  const spur = r.feature === 'secret' && segmentDistance2(x, y, r, { x: sx, y: sy }) < 5;
  // A guaranteed connector from each legacy mouth joins the same junction network.
  let access = false;
  for (const m of mouthsNear(seed, x, ly, 52)) {
    const hub = caveRegionAt(seed, m.x, m.y + CAVE_OY);
    if (hub.gx === r.gx && hub.gy === r.gy && segmentDistance2(x, y, { x: m.x, y: m.y + CAVE_OY }, hub) < 10)
      access = true;
  }
  const open = route < 22 || access || spur || room < 1 + 0.13 * n.noise(x / 9, ly / 9);
  if (!open) {
    if (legacy) return T.CAVE_WALL;
    const deposit = mineralDeposit(seed, x, ly);
    return deposit !== null && (route < 65 || room < 1.5) ? deposit : T.CAVE_WALL;
  }
  if (access || spur) return T.CAVE_FLOOR;
  if (r.feature === 'puzzle' || r.feature === 'arena' || r.feature === 'ruins' || r.feature === 'vents')
    return T.CAVE_FLOOR;
  if (magma) return T.LAVA;
  if (lake) return room < 0.65 ? T.DEEP_WATER : T.WATER;
  const h = hash2(seed, x, y, 977);
  if (h < (r.biome === 'crystal' ? 0.025 : 0.009) && room > 0.55) return T.CRYSTAL;
  if (h < 0.02 && room > 0.72 && room < 1.05) return T.ROCK;
  if (h < 0.045 && (r.biome === 'glowmoss' || r.feature === 'grove')) return T.SHIMMER;
  return T.CAVE_FLOOR;
}

const cascades = new Map<string, { x: number; y: number; sub: string } | null>();
/** A cascade needs both a real rear wall and a pool at its foot. Cache the authored source search. */
function cascadeAt(seed: number, r: ReturnType<typeof caveRegion>) {
  const key = `${seed}:${r.id}`;
  if (cascades.has(key)) return cascades.get(key)!;
  let out: { x: number; y: number; sub: string } | null = null;
  if (r.feature === 'lake' || r.biome === 'drowned' || r.biome === 'basalt') {
    for (let dy = -7; dy <= 14 && !out; dy++)
      for (let dx = 0; dx <= 20 && !out; dx++) {
        const x = r.x + dx,
          y = r.y + dy,
          t = caveTileAt(seed, x, y);
        if ((t === T.WATER || t === T.LAVA) && caveTileAt(seed, x, y - 1) === T.CAVE_WALL)
          out = { x, y, sub: t === T.LAVA ? 'magma_fall' : 'cave_waterfall' };
      }
  }
  if (cascades.size >= 512) cascades.delete(cascades.keys().next().value!);
  cascades.set(key, out);
  return out;
}

/** Static objects of chunk (cx, cy): cave mouths on the surface; ladders and forgotten caches below. */
export function caveObjectsIn(seed: number, cx: number, cy: number, generation = 2): WorldObj[] {
  const out: WorldObj[] = [];
  const x0 = cx * CHUNK_SIZE,
    y0 = cy * CHUNK_SIZE;
  const below = isCaveY(y0);
  const sy = below ? y0 - CAVE_OY : y0;
  const inChunk = (x: number, y: number) => x >= x0 && x < x0 + CHUNK_SIZE && y >= y0 && y < y0 + CHUNK_SIZE;
  for (const m of mouthsNear(seed, x0 + CHUNK_SIZE / 2, sy + CHUNK_SIZE / 2, CHUNK_SIZE)) {
    if (!below) {
      if (inChunk(m.x, m.y))
        out.push({
          x: m.x,
          y: m.y,
          kind: 'deco',
          sub: 'cave_mouth',
          static: true,
          data: { cave: m.id, biome: m.biome },
        });
      continue;
    }
    if (inChunk(m.x, m.y + CAVE_OY))
      out.push({ x: m.x, y: m.y + CAVE_OY, kind: 'deco', sub: 'cave_ladder', static: true, data: { cave: m.id } });
  }
  if (below && generation >= 4) out.push(...caveFeatureObjects2(seed, cx, cy));
  else if (below) {
    for (let gy = Math.floor(sy / 72); gy <= Math.floor((sy + 31) / 72); gy++)
      for (let gx = Math.floor(x0 / 72); gx <= Math.floor((x0 + 31) / 72); gx++) {
        const r = caveRegion(seed, gx, gy),
          lift = caveWaystation(seed, gx, gy);
        const add = (x: number, y: number, sub: string, data: Record<string, unknown> = {}) => {
          if (inChunk(x, y) && !caveTownAt(x, y) && !out.some((o) => o.x === x && o.y === y))
            out.push({ x, y, kind: sub === 'cave_waymark' ? 'sign' : 'deco', sub, static: true, data });
        };
        const mine = mineLoopAt(seed, r.x, r.y);
        if (mine)
          for (let y = mine.y; y <= mine.y + mine.h; y++)
            for (let x = mine.x; x <= mine.x + mine.w; x++)
              if (mineRailAt(mine, x, y)) {
                add(x, y, x === mine.x && y === mine.y ? 'minecart' : 'mine_rail', { mask: mineRailMask(mine, x, y) });
              }
        if (lift) add(lift.x, lift.y, 'cave_lift', { cave: lift.id });
        if (lift)
          add(lift.x + 2, lift.y, 'cave_waymark', {
            text: `${r.biome.toUpperCase()} · survey district ${gx}, ${gy}. Depth band ${r.depth}. Broad marked passages connect every junction. Supply lifts lie at every other junction; the Atlas can track the nearest exit.`,
          });
        if (r.feature === 'secret')
          add(gx * 72 + 12, CAVE_OY + gy * 72 + 12, 'ruin_cache', {
            ruin: `${r.id}:secret`,
            biome: 'enchanted',
            cave: true,
            depth: r.depth,
            secret: true,
          });
        else if (r.feature === 'ruins') {
          add(r.x - 7, r.y - 6, 'ruin_cache', {
            ruin: `${r.id}:archive`,
            biome: 'enchanted',
            cave: true,
            depth: r.depth,
          });
          add(r.x + 7, r.y - 6, 'ruin_pillar');
          add(r.x - 8, r.y + 4, 'ruin_pillar');
        } else if (r.feature === 'vents') {
          add(r.x + 7, r.y - 6, 'cave_vent', { region: r.id });
        } else if (r.feature === 'arena') {
          add(r.x + 7, r.y - 6, 'cave_altar', { region: r.id, depth: r.depth });
          add(r.x, r.y, 'cave_seal');
          for (const [dx, dy] of [
            [-12, -10],
            [12, -10],
            [-12, 10],
            [12, 10],
          ])
            add(r.x + dx, r.y + dy, 'bell_pylon');
        }
        const fall = cascadeAt(seed, r);
        if (fall) add(fall.x, fall.y, fall.sub);
        if (r.biome === 'glowmoss' || r.feature === 'grove') {
          for (const [dx, dy] of [
            [-12, 5],
            [-11, 9],
            [10, 9],
            [13, -5],
          ])
            if (!mineRailAt(mine, r.x + dx, r.y + dy) && !isSolid(caveTileAt(seed, r.x + dx, r.y + dy)))
              add(r.x + dx, r.y + dy, 'glow_mushrooms');
        }
      }
  }
  return out;
}

/** Where a traveller stands after climbing down (cave) or out (surface) of mouth `id`. */
export function caveLanding(seed: number, id: string, down: boolean): { x: number; y: number } | null {
  const town = CAVE_TOWNS.find((t) => `townlift:${t.id}` === id && !t.abandoned);
  if (town) {
    if (down) return { x: town.cx + 3.5, y: town.cy + 6.5 };
    const home = townFor(seed),
      spot = home.spots.plaza_d ?? { x: home.cx, y: home.cy + 4 };
    return { x: spot.x + 0.5, y: spot.y + 0.5 };
  }
  const lift = /^lf(-?\d+)_(-?\d+)$/.exec(id);
  if (lift) {
    const p = caveWaystation(seed, Number(lift[1]), Number(lift[2]));
    if (!p) return null;
    if (down) return { x: p.x + 0.5, y: p.y + 1.5 };
    const near = mouthsNear(seed, p.x, p.y - CAVE_OY, 216).sort(
      (a, b) => Math.hypot(a.x - p.x, a.y + CAVE_OY - p.y) - Math.hypot(b.x - p.x, b.y + CAVE_OY - p.y),
    )[0];
    if (near) return { x: near.x + 0.5, y: near.y + 1.5 };
    const t = townFor(seed),
      q = t.spots.plaza_d ?? { x: t.cx, y: t.cy + 4 };
    return { x: q.x + 0.5, y: q.y + 0.5 };
  }
  const m = /^(cv|sx)(-?\d+)_(-?\d+)$/.exec(id);
  if (!m) return null;
  const mouth =
    m[1] === 'sx' ? caveShaftOfCell(seed, Number(m[2]), Number(m[3])) : caveOfCell(seed, Number(m[2]), Number(m[3]));
  if (!mouth) return null;
  return down ? { x: mouth.x + 0.5, y: mouth.y + CAVE_OY + 1.5 } : { x: mouth.x + 0.5, y: mouth.y + 1.5 };
}

/** Existing nearby ladders take priority over more distant emergency lifts. */
export function caveExitRoutes(
  seed: number,
  x: number,
  y: number,
): Array<{ id: string; name: string; x: number; y: number }> {
  return [
    ...caveExitsNear(seed, x, y),
    ...mouthsNear(seed, x, y - CAVE_OY, 100).map((m) => ({
      id: m.id,
      name: 'Surface ladder',
      x: m.x,
      y: m.y + CAVE_OY,
    })),
  ].sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
}
