import {
  CAVE_BIOME_NAMES,
  CAVE_OY,
  caveBiomeField,
  caveRegion,
  caveRegionAt,
  caveRoutes,
  caveTownAt,
  caveWaystation,
  type CaveBiome,
  type CavePoint,
} from './undercroft';
import { CHUNK_SIZE } from './constants';
import type { WorldObj } from './objects';
import { shardAt } from './shards';
import { mouthsNear } from './cavemouths';
import { mineLineDistance, mineLineOfRegion } from './mines';
import { hash2 } from './rng';
import { Simplex2D } from './simplex';
import { T, isSolid } from './tiles';

/**
 * Undercroft 2 terrain (world revision 4). The district skeleton of revision 2 (a centre chamber and four gates shared
 * with the neighbouring districts) still guarantees that the whole network is connected, but everything is drawn
 * through a smooth noise warp so passages meander instead of running ruler-straight, widths swell and pinch (never
 * below three tiles), and blobs of cavern open off the passages. Biomes are continuous patches (see
 * `caveBiomeField`). Minerals are ribbons of vein that follow noise contours inside the rock and only show where a
 * passage cuts them, so ore reads as geology rather than as scattered stickers.
 *
 * Everything here is a pure function of (seed, x, y).
 */

const noises = new Map<number, Simplex2D>();
function noiseFor(seed: number): Simplex2D {
  let n = noises.get(seed);
  if (!n) {
    n = new Simplex2D(seed ^ 0x2c4a);
    if (noises.size > 8) noises.clear();
    noises.set(seed, n);
  }
  return n;
}
const fbm = (n: Simplex2D, x: number, y: number): number =>
  n.noise(x, y) * 0.65 + n.noise(x * 2.1 + 9, y * 2.1 - 4) * 0.35;

interface Blob {
  x: number;
  y: number;
  r: number;
}
interface RegionPlan {
  blobs: Blob[];
  /** mouths whose connector or landing chamber touches this district */
  mouths: Array<{ x: number; y: number; hubX: number; hubY: number; landing: boolean }>;
}
const plans = new Map<string, RegionPlan>();

/** Cavern blobs hung off each passage, kept inside the district so they never meet a clipped border. */
function planOf(seed: number, gx: number, gy: number): RegionPlan {
  const key = `${seed}:${gx},${gy}`,
    hit = plans.get(key);
  if (hit) return hit;
  const r = caveRegion(seed, gx, gy, 4),
    routes = caveRoutes(seed, gx, gy),
    x0 = gx * 72,
    y0 = CAVE_OY + gy * 72;
  const blobs: Blob[] = [];
  routes.forEach((path, i) => {
    for (let j = 0; j < 2; j++) {
      const t = 0.32 + j * 0.28 + hash2(seed, gx * 9 + i, gy * 3 + j, 2440) * 0.12,
        a = path[0]!,
        m = path[1]!,
        g = path[2]!;
      // walk the two-leg polyline centre -> mid -> gate
      const from = t < 0.5 ? a : m,
        to = t < 0.5 ? m : g,
        k = t < 0.5 ? t * 2 : (t - 0.5) * 2;
      const leg = [from, to] as const;
      const px = from.x + (to.x - from.x) * k,
        py = from.y + (to.y - from.y) * k;
      const rad = 3.6 + hash2(seed, gx * 9 + i, gy * 3 + j, 2441) * 3.8,
        side = hash2(seed, gx * 9 + i, gy * 3 + j, 2442) < 0.5 ? -1 : 1,
        dx = leg[1].x - leg[0].x,
        dy = leg[1].y - leg[0].y,
        len = Math.hypot(dx, dy) || 1,
        off = rad * (0.45 + hash2(seed, gx * 9 + i, gy * 3 + j, 2443) * 0.3) * side;
      const bx = Math.min(x0 + 72 - rad - 3, Math.max(x0 + rad + 3, px - (dy / len) * off)),
        by = Math.min(y0 + 72 - rad - 3, Math.max(y0 + rad + 3, py + (dx / len) * off));
      blobs.push({ x: bx, y: by, r: rad });
    }
  });
  const ly0 = gy * 72;
  const mouths: RegionPlan['mouths'] = [];
  for (const m of mouthsNear(seed, x0 + 36, ly0 + 36, 60)) {
    const hub = caveRegionAt(seed, m.x, m.y + CAVE_OY, 4);
    const inBox = m.x >= x0 - 8 && m.x < x0 + 80 && m.y >= ly0 - 8 && m.y < ly0 + 80;
    if (inBox || (hub.gx === gx && hub.gy === gy))
      mouths.push({ x: m.x, y: m.y, hubX: hub.x, hubY: hub.y - CAVE_OY, landing: true });
  }
  const plan = { blobs, mouths };
  if (plans.size >= 1024) plans.delete(plans.keys().next().value!);
  plans.set(key, plan);
  return plan;
}

const seg2 = (x: number, y: number, a: CavePoint, b: CavePoint): number => {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return (x - a.x - dx * t) ** 2 + (y - a.y - dy * t) ** 2;
};

/** Base cell classification, before minerals. */
export interface CaveCell {
  tile: number;
  /** distance (tiles) to the nearest wall inside a passage or chamber; 0 for rock */
  clear: number;
  /** distance to the nearest passage centre line */
  route: number;
  biome: CaveBiome;
}

const memo = new Map<number, Map<number, CaveCell>>();
const MEMO_CAP = 60000;
function memoFor(seed: number): Map<number, CaveCell> {
  let m = memo.get(seed);
  if (!m || m.size > MEMO_CAP) {
    if (memo.size > 6) memo.clear();
    m = new Map();
    memo.set(seed, m);
  }
  return m;
}

/** The rock-or-room decision for one tile. Pure; memoised per seed. */
export function caveCell(seed: number, x: number, y: number): CaveCell {
  const m = memoFor(seed),
    key = x * 131071 + (y - CAVE_OY + 4096);
  const hit = m.get(key);
  if (hit) return hit;
  const c = computeCell(seed, x, y);
  m.set(key, c);
  return c;
}

function computeCell(seed: number, x: number, y: number): CaveCell {
  const n = noiseFor(seed),
    ly = y - CAVE_OY;
  const biome = caveBiomeField(seed, x, y);
  // smooth warp of the sampling point; the gradient stays well below one so passages never tear
  const wx = x + 3.4 * n.noise(x / 17, ly / 17),
    wy = y + 3.4 * n.noise(x / 17 + 40, ly / 17 + 11);
  const r = caveRegionAt(seed, wx, wy, 4);
  const plan = planOf(seed, r.gx, r.gy);
  let clear = -Infinity,
    route = Infinity;

  // passages: the four gate polylines; width swells and pinches between 3.2 and 5.4
  const width =
    2.5 + 1.0 * (0.5 + 0.5 * n.noise(x / 12 + 90, ly / 12 - 20)) + 1.0 * Math.max(0, n.noise(x / 24, ly / 24 + 7));
  for (const p of caveRoutes(seed, r.gx, r.gy))
    for (let i = 1; i < p.length; i++) route = Math.min(route, Math.sqrt(seg2(wx, wy, p[i - 1]!, p[i]!)));
  clear = Math.max(clear, width - route);

  // blobs hanging off the passages
  for (const b of plan.blobs) {
    const d = Math.hypot(wx - b.x, wy - b.y),
      rad = b.r * (0.85 + 0.35 * fbm(n, x / 6 + 20, ly / 6));
    clear = Math.max(clear, rad - d);
  }

  // the district's centre chamber
  const dx = wx - r.x,
    dy = wy - r.y,
    cd = Math.hypot(dx, dy);
  const crad = Math.min(r.rx, r.ry) * (0.5 + 0.14 * fbm(n, x / 9 - 5, ly / 9 + 3)) + (r.feature === 'arena' ? 4 : 0);
  clear = Math.max(clear, crad - cd);

  // ladder landings: a rounded chamber at each mouth, and a connector to the district's centre
  const lx = x,
    lyy = ly;
  let kept = Infinity; // distance to the nearest ladder, lift or connector: nothing solid is placed within it
  for (const mo of plan.mouths) {
    const md = Math.hypot(lx - mo.x, lyy - mo.y),
      cd2 = Math.sqrt(seg2(lx, lyy, { x: mo.x, y: mo.y }, { x: mo.hubX, y: mo.hubY }));
    clear = Math.max(clear, 6.2 - md, 3 - cd2);
    kept = Math.min(kept, md - 3, cd2 + 1);
  }
  // supply lifts
  const lift = caveWaystation(seed, r.gx, r.gy);
  if (lift) {
    const ld = Math.hypot(x - lift.x, y - lift.y);
    clear = Math.max(clear, 4.5 - ld);
    kept = Math.min(kept, ld - 2.5);
  }

  // the haulage drift cut for a mine line, and the cavern at its face
  const mine = mineLineOfRegion(seed, r.gx, r.gy);
  if (mine) {
    const md = mineLineDistance(mine, x + 0.5, y + 0.5),
      fp = mine.pts[mine.pts.length - 1]!;
    clear = Math.max(clear, 2.6 - md, 6 - Math.hypot(x + 0.5 - fp[0] - 0.5, y + 0.5 - fp[1] - 0.5));
    kept = Math.min(kept, md - 2.4);
  }

  // camps and boss rooms always get a dry, round floor to build on
  if (r.feature === 'ruins' || r.feature === 'grove') clear = Math.max(clear, 9 - cd);
  const vault = vaultOf(seed, r.gx, r.gy);
  if (vault) {
    // an apron of open cave outside the doorway, so the entrance can always be reached
    const door = vault.door[1]!,
      out = [
        [3.5, 0],
        [0, 3.5],
        [-3.5, 0],
        [0, -3.5],
      ][vault.side]!;
    const spur = Math.sqrt(seg2(x, y, { x: door.x + out[0]!, y: door.y + out[1]! }, { x: r.x, y: r.y }));
    clear = Math.max(clear, 4.5 - Math.hypot(x - door.x - out[0]!, y - door.y - out[1]!), 2.4 - spur);
    kept = Math.min(kept, Math.hypot(x - door.x - out[0]!, y - door.y - out[1]!) - 3, spur - 2.4);
  }

  // authored reservations
  let tile: number = T.CAVE_WALL;
  if (clear > 0) {
    tile = T.CAVE_FLOOR;
    const core = cd < 10.5 || kept < 3;
    if (r.feature === 'arena' && cd < 14.5) tile = T.VAULT_FLOOR;
    else if (r.feature === 'arena' && cd < 17.5 && route > width + 1.2 && clear > 0.3 && kept > 3) {
      tile = biome === 'basalt' ? T.LAVA : T.WATER; // a moat the passages bridge
      clear = 0.4;
    } else if (!core && clear > 3.2 && route > 3.6 && cd > 12) {
      const q = n.noise(x / 8 + 300, ly / 8 - 120);
      const lake = r.feature === 'lake' || biome === 'drowned';
      if (biome === 'basalt') tile = q > 0.5 ? T.LAVA : q > 0.34 ? T.SCORIA : T.CAVE_FLOOR;
      else if (lake) tile = q > 0.52 ? T.DEEP_WATER : q > (r.feature === 'lake' ? -0.1 : 0.2) ? T.WATER : T.CAVE_FLOOR;
      else if (biome === 'limestone' && q > 0.66) tile = T.WATER;
    }
    if (tile === T.CAVE_FLOOR && clear > 2.2 && route > 2.4 && !core) {
      const h = hash2(seed, x, y, 979);
      // pillars: local minima only, so two never touch (not even diagonally) and passages stay open
      let local = true;
      for (let j = -1; j <= 1 && local; j++)
        for (let i = -1; i <= 1; i++) if ((i || j) && hash2(seed, x + i, y + j, 979) < h) local = false;
      const dens = biome === 'limestone' ? 0.16 : biome === 'frost' ? 0.12 : 0.07;
      if (local && h < dens && clear > 2.6) tile = T.STALAGMITE;
      else if (local && h > 0.9 && clear > 3.4 && biome !== 'drowned') tile = T.CAVE_BOULDER;
      else if (biome === 'glowmoss' && h > 0.6 && n.noise(x / 5 + 200, ly / 5) > 0.1 && clear > 1.2) tile = T.GLOWCAP;
      else if (biome === 'crystal' && hash2(seed, x, y, 981) < 0.012) tile = T.CAVE_CRYSTAL;
    }
  }
  if (vault && route > width + 1.5) {
    const v = vaultTile(vault, x, y);
    if (v !== null) return { tile: v, clear: v === T.WALL ? 0 : 2, route, biome };
  }
  return { tile, clear: Math.max(0, clear), route, biome };
}

export interface Vault {
  id: string;
  /** interior bounds, inclusive */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** side the entrance faces: 0 east, 1 south, 2 west, 3 north */
  side: number;
  /** the 3-tile doorway */
  door: Array<{ x: number; y: number }>;
  kind: 'sealed' | 'trial';
}
const vaults = new Map<string, Vault | null>();
/** The built vault of a 'secret' (sealed) or 'puzzle' (trial) district: stone walls inside the cavern. */
export function vaultOf(seed: number, gx: number, gy: number): Vault | null {
  const key = `${seed}:${gx},${gy}`;
  if (vaults.has(key)) return vaults.get(key)!;
  const r = caveRegion(seed, gx, gy, 4);
  let out: Vault | null = null;
  if (r.feature === 'secret' || r.feature === 'puzzle') {
    // a corner of the district, door facing the hub; a spur (see computeCell) joins the doorway to the centre. Try the
    // four corners in a hashed order and take the first that keeps clear of every passage and ladder landing.
    const horizontal = hash2(seed, gx, gy, 2482) < 0.5,
      start = Math.floor(hash2(seed, gx, gy, 2480) * 4);
    const plan = planOf(seed, gx, gy),
      routes = caveRoutes(seed, gx, gy);
    for (let k = 0; k < 4 && !out; k++) {
      const q = (start + k) % 4,
        sx = q & 1 ? 1 : -1,
        sy = q & 2 ? 1 : -1;
      const cx = r.x + sx * 21,
        cy = r.y + sy * 17;
      let clash = false;
      for (const path of routes)
        for (let i = 1; i < path.length && !clash; i++)
          if (seg2(cx, cy, path[i - 1]!, path[i]!) < 11 * 11) clash = true;
      for (const m of plan.mouths) {
        if (Math.hypot(m.x - cx, m.y + CAVE_OY - cy) < 15) clash = true;
        // the landing's connector runs mouth -> hub
        if (seg2(cx, cy, { x: m.x, y: m.y + CAVE_OY }, { x: m.hubX, y: m.hubY + CAVE_OY }) < 11 * 11) clash = true;
      }
      const lift = caveWaystation(seed, gx, gy);
      if (lift && Math.hypot(lift.x - cx, lift.y - cy) < 13) clash = true;
      if (clash) continue;
      const x0 = cx - 7,
        y0 = cy - 5,
        x1 = cx + 7,
        y1 = cy + 5;
      const side = horizontal ? (sx > 0 ? 2 : 0) : sy > 0 ? 3 : 1;
      const door: Vault['door'] = [-1, 0, 1].map((d) =>
        side === 0
          ? { x: x1 + 1, y: cy + d }
          : side === 2
            ? { x: x0 - 1, y: cy + d }
            : side === 1
              ? { x: cx + d, y: y1 + 1 }
              : { x: cx + d, y: y0 - 1 },
      );
      out = { id: r.id, x0, y0, x1, y1, side, door, kind: r.feature === 'secret' ? 'sealed' : 'trial' };
    }
  }
  if (vaults.size > 1024) vaults.clear();
  vaults.set(key, out);
  return out;
}
/** Where the chest, braziers and pressure plates stand inside a vault. */
export function vaultLayout(v: Vault): {
  cache: { x: number; y: number };
  braziers: Array<{ x: number; y: number }>;
  plates: Array<{ x: number; y: number; key: string }>;
} {
  const cx = Math.floor((v.x0 + v.x1) / 2),
    cy = Math.floor((v.y0 + v.y1) / 2);
  return {
    cache: { x: cx, y: cy },
    braziers: [
      [-5, -3],
      [5, -3],
      [-5, 3],
      [5, 3],
    ].map(([dx, dy]) => ({ x: cx + dx!, y: cy + dy! })),
    plates:
      v.kind === 'trial'
        ? [
            [-3, 0],
            [3, 0],
            [0, -3],
          ].map(([dx, dy]) => ({ x: cx + dx!, y: cy + dy!, key: `${dx},${dy}` }))
        : [],
  };
}
/** The vault whose walls (or interior) contain (x, y), if any. */
export function vaultAt(seed: number, x: number, y: number): Vault | null {
  const r = caveRegionAt(seed, x, y, 4);
  const v = vaultOf(seed, r.gx, r.gy);
  return v && x >= v.x0 - 1 && x <= v.x1 + 1 && y >= v.y0 - 1 && y <= v.y1 + 1 ? v : null;
}
const inVaultDoor = (v: Vault, x: number, y: number) => v.door.some((d) => d.x === x && d.y === y);
/** Walls ring the interior at distance 1; returns the override tile or null. */
function vaultTile(v: Vault, x: number, y: number): number | null {
  if (x >= v.x0 && x <= v.x1 && y >= v.y0 && y <= v.y1) return T.VAULT_FLOOR;
  if (x >= v.x0 - 1 && x <= v.x1 + 1 && y >= v.y0 - 1 && y <= v.y1 + 1) {
    if (inVaultDoor(v, x, y)) return v.kind === 'sealed' ? T.CAVE_BOULDER : T.VAULT_FLOOR;
    return T.WALL;
  }
  return null;
}

const isOpen = (t: number): boolean => t !== T.CAVE_WALL && t !== T.LAVA && t !== T.DEEP_WATER;

/** Mineral for a rock tile in vein ribbons; null leaves plain rock. */
function veinAt(seed: number, x: number, ly: number, biome: CaveBiome, depth: number, face = false): number | null {
  const n = noiseFor(seed);
  // each ribbon is the zero contour of a noise field; lodes swell where a second field is high
  const ribbon = Math.abs(n.noise(x / 15 + 500, ly / 15 + 500));
  const lode = 0.03 + 0.07 * Math.max(0, n.noise(x / 22 - 300, ly / 22 + 300));
  const second = Math.abs(n.noise(x / 11 - 700, ly / 11 + 100));
  const hit = ribbon < lode || (second < 0.012 && n.noise(x / 30, ly / 30) > 0.25);
  if (!hit && !face) return null;
  // the material changes slowly along a ribbon, never tile by tile
  const m = hash2(seed, Math.floor(x / 30), Math.floor(ly / 30), 2450);
  const deep = depth >= 2;
  switch (biome) {
    case 'limestone':
      return m < 0.4 ? T.CAVE_COAL : m < 0.8 ? T.CAVE_COPPER : deep ? T.CAVE_IRON : T.CAVE_COPPER;
    case 'glowmoss':
      return m < 0.45 ? T.CAVE_COPPER : m < 0.8 ? T.CAVE_COAL : T.CAVE_IRON;
    case 'crystal':
      return m < 0.55 ? T.CAVE_CRYSTAL : m < 0.8 ? (deep ? T.CAVE_SILVER : T.CAVE_IRON) : T.CAVE_GEODE;
    case 'basalt':
      return m < 0.45 ? T.CAVE_IRON : m < 0.75 ? T.CAVE_COAL : deep ? T.CAVE_GOLD : T.CAVE_IRON;
    case 'frost':
      return m < 0.4 ? T.CAVE_IRON : m < 0.75 ? (deep ? T.CAVE_SILVER : T.CAVE_COPPER) : T.CAVE_CRYSTAL;
    case 'drowned':
      return m < 0.4
        ? T.CAVE_COPPER
        : m < 0.7
          ? deep
            ? T.CAVE_SILVER
            : T.CAVE_COAL
          : m < 0.9
            ? T.CAVE_GEODE
            : deep
              ? T.CAVE_GOLD
              : T.CAVE_COPPER;
  }
}

/** Revision 4 cave tile. Towns, shrines and authored rooms are layered on top by the caller. */
export function caveTileAt2(seed: number, x: number, y: number): number {
  const c = caveCell(seed, x, y);
  if (c.tile !== T.CAVE_WALL) return c.tile;
  // veins only where a passage cuts them
  const ly = y - CAVE_OY;
  if (
    isOpen(caveCell(seed, x + 1, y).tile) ||
    isOpen(caveCell(seed, x - 1, y).tile) ||
    isOpen(caveCell(seed, x, y + 1).tile) ||
    isOpen(caveCell(seed, x, y - 1).tile)
  ) {
    const r = caveRegionAt(seed, x, y, 4),
      mine = mineLineOfRegion(seed, r.gx, r.gy);
    if (mine) {
      // the face of a working: the lode the miners were following, thick with the biome's best metal
      const fp = mine.pts[mine.pts.length - 1]!;
      if (Math.hypot(x - fp[0], y - fp[1]) < 9 && hash2(seed, x, y, 2470) < 0.5)
        return veinAt(seed, x, ly, c.biome, r.depth, true) ?? T.CAVE_WALL;
    }
    return veinAt(seed, x, ly, c.biome, r.depth) ?? T.CAVE_WALL;
  }
  return T.CAVE_WALL;
}

// ───────────────────────── objects ─────────────────────────

/** A delver camp: the site of a district's travelling-merchant stop. */
export interface DelverCamp {
  id: string;
  x: number;
  y: number;
  /** where a merchant stands beside the cart, and where they sleep by the fire */
  stall: { x: number; y: number };
  rest: { x: number; y: number };
}
export function delverCampOf(seed: number, gx: number, gy: number): DelverCamp | null {
  const r = caveRegion(seed, gx, gy, 4);
  if (r.feature !== 'ruins') return null;
  return {
    id: r.id,
    x: r.x,
    y: r.y,
    stall: { x: r.x + 3, y: r.y },
    rest: { x: r.x - 2, y: r.y + 2 },
  };
}
/** The camps near the home vale, nearest first: the merchants' round. */
export function delverCamps(seed: number, radius = 5): DelverCamp[] {
  const out: DelverCamp[] = [];
  for (let gy = -radius; gy <= radius; gy++)
    for (let gx = -radius; gx <= radius; gx++) {
      const c = delverCampOf(seed, gx, gy);
      if (c) out.push(c);
    }
  return out.sort((a, b) => Math.hypot(a.x, a.y - CAVE_OY) - Math.hypot(b.x, b.y - CAVE_OY));
}

const MERCHANT_IDS = ['delver_odo', 'delver_marla', 'delver_tobin', 'delver_sable'] as const;
const rounds = new Map<number, Array<{ id: string; shard: string; camps: DelverCamp[] }>>();
/**
 * Each merchant's round: three camps inside ONE shard (an NPC is owned by a single room), starting from a different
 * anchor camp each so the four merchants are never all at the same fire.
 */
export function delverRounds(seed: number): Array<{ id: string; shard: string; camps: DelverCamp[] }> {
  const hit = rounds.get(seed);
  if (hit) return hit;
  const all = delverCamps(seed, 6);
  const out = MERCHANT_IDS.map((id, i) => {
    const anchor = all[(i * 2) % Math.max(1, all.length)];
    if (!anchor) return { id, shard: '', camps: [] as DelverCamp[] };
    const shard = shardAt(anchor.x, anchor.y);
    const same = all.filter((c) => shardAt(c.x, c.y) === shard);
    const near = same.sort(
      (a, b) => Math.hypot(a.x - anchor.x, a.y - anchor.y) - Math.hypot(b.x - anchor.x, b.y - anchor.y),
    );
    const camps = [near[0]!, near[1] ?? near[0]!, near[2] ?? near[1] ?? near[0]!];
    return { id, shard, camps };
  });
  if (rounds.size > 8) rounds.clear();
  rounds.set(seed, out);
  return out;
}
/** NPC spots for the merchants: stalls `<id>.c0..c2`, bedroll `<id>.r2`. */
export function delverSpots(seed: number): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  for (const r of delverRounds(seed)) {
    r.camps.forEach((c, j) => {
      out[`${r.id}.c${j}`] = { x: c.stall.x, y: c.stall.y };
      if (j === 2) out[`${r.id}.r2`] = { x: c.rest.x, y: c.rest.y };
    });
  }
  return out;
}

const DECO_HINT: Record<CaveBiome, string> = {
  limestone: 'Amber galleries: coal and copper lie in the pale seams.',
  glowmoss: 'Lanternroot grotto: spore-light. Watch the caps; they bite back.',
  crystal: 'Prism vault: qubit veins hum when you swing at them.',
  basalt: 'Cinder hollows: iron and gold in the black rock. Mind the lava.',
  frost: 'Rime cathedral: silver in the ice-bound rock. The cold bites.',
  drowned: 'Stillwater deeps: copper, silver, and geodes below the waterline.',
};

/** Static objects of the district-level content in chunk (cx, cy); revision 4. */
export function caveFeatureObjects2(seed: number, cx: number, cy: number): WorldObj[] {
  const out: WorldObj[] = [];
  const x0 = cx * CHUNK_SIZE,
    y0 = cy * CHUNK_SIZE;
  const inChunk = (x: number, y: number) => x >= x0 && x < x0 + CHUNK_SIZE && y >= y0 && y < y0 + CHUNK_SIZE;
  const sy = y0 - CAVE_OY;
  const add = (
    x: number,
    y: number,
    sub: string,
    data: Record<string, unknown> = {},
    kind: WorldObj['kind'] = 'deco',
  ) => {
    if (!inChunk(x, y) || caveTownAt(x, y) || out.some((o) => o.x === x && o.y === y)) return;
    if (isSolid(caveTileAt2(seed, x, y))) return;
    out.push({ x, y, kind: sub === 'cave_waymark' ? 'sign' : kind, sub, static: true, data });
  };
  for (let gy = Math.floor((sy - 12) / 72); gy <= Math.floor((sy + CHUNK_SIZE + 12) / 72); gy++)
    for (let gx = Math.floor((x0 - 12) / 72); gx <= Math.floor((x0 + CHUNK_SIZE + 12) / 72); gx++) {
      const r = caveRegion(seed, gx, gy, 4),
        lift = caveWaystation(seed, gx, gy);
      if (lift) {
        add(lift.x, lift.y, 'cave_lift', { cave: lift.id });
        add(lift.x + 2, lift.y, 'cave_waymark', {
          text: `${CAVE_BIOME_NAMES[r.biome].toUpperCase()} · survey district ${gx}, ${gy}. Depth band ${r.depth}. ${DECO_HINT[r.biome]} Supply lifts stand at every other junction; the Atlas can track the nearest exit.`,
        });
      }
      // haulage line
      const mine = mineLineOfRegion(seed, gx, gy);
      if (mine) {
        mine.tiles.forEach((t, i) => {
          const end = i === 0 ? 1 : i === mine.tiles.length - 1 ? 2 : 0;
          if (i === 2) add(t.x, t.y, 'minecart', { mask: t.mask });
          else add(t.x, t.y, 'mine_rail', { mask: t.mask, end });
          // a lamp every seventh sleeper, set back from the rail
          if (i % 7 === 3 && i > 0) {
            const side = mine.tiles[i + 1] ? mine.tiles[i + 1]!.x - t.x : 1;
            add(t.x + (side === 0 ? 2 : 0), t.y + (side === 0 ? 0 : 2), 'cave_lamp');
          }
        });
        const bay = mine.tiles[0]!;
        add(bay.x + 2, bay.y + 2, 'cave_waymark', {
          text: `HAULAGE LINE ${mine.id.toUpperCase()}. Board the cart, then push along the rails to roll or against them to reverse. Buffers stop the cart at both ends; the face lies ${mine.len} paces down the drift.`,
        });
      }
      switch (r.feature) {
        case 'arena': {
          add(r.x + 7, r.y - 6, 'cave_altar', { region: r.id, depth: r.depth, biome: r.biome });
          add(r.x, r.y, 'cave_seal');
          for (const [dx, dy] of [
            [-10, -8],
            [10, -8],
            [-10, 8],
            [10, 8],
          ] as const)
            add(r.x + dx, r.y + dy, 'bell_pylon');
          break;
        }
        case 'ruins': {
          add(r.x, r.y + 1, 'campfire');
          add(r.x - 6, r.y - 3, 'delver_tent');
          add(r.x - 5, r.y + 4, 'delver_tent');
          add(r.x + 3, r.y, 'merchant_cart');
          add(r.x - 3, r.y - 6, 'cave_lamp');
          add(r.x + 5, r.y + 5, 'cave_lamp');
          add(r.x + 2, r.y - 5, 'ruin_cache', {
            ruin: `${r.id}:stash`,
            biome: 'enchanted',
            cave: true,
            depth: r.depth,
          });
          add(r.x + 5, r.y - 3, 'cave_waymark', {
            text: 'DELVER CAMP. A travelling merchant works the camps of this district in rounds; the fire stays lit for anyone with a pick.',
          });
          break;
        }
        case 'vents':
          add(r.x + 7, r.y - 6, 'cave_vent', { region: r.id });
          add(r.x - 6, r.y + 6, 'cave_vent', { region: r.id });
          break;
        case 'grove':
          for (const [dx, dy] of [
            [-6, 3],
            [-5, 7],
            [5, 6],
            [7, -3],
            [0, -8],
          ] as const)
            add(r.x + dx, r.y + dy, 'glow_mushrooms');
          break;
        case 'secret':
        case 'puzzle': {
          const v = vaultOf(seed, gx, gy);
          if (!v) break;
          const themeData = { vault: v.id, theme: r.biome, vkind: v.kind },
            lay = vaultLayout(v);
          add(lay.cache.x, lay.cache.y, 'ruin_cache', {
            ruin: `${v.id}:vault`,
            biome: 'enchanted',
            cave: true,
            depth: r.depth,
            secret: true,
            ...themeData,
          });
          for (const b of lay.braziers) add(b.x, b.y, 'trial_brazier', themeData);
          for (const pl of lay.plates) add(pl.x, pl.y, 'vault_plate', { ...themeData, plate: pl.key });
          add(
            v.door[1]!.x + (v.side === 0 ? 2 : v.side === 2 ? -2 : 0),
            v.door[1]!.y + (v.side === 1 ? 2 : v.side === 3 ? -2 : 0),
            'cave_waymark',
            {
              text:
                v.kind === 'sealed'
                  ? `SEALED VAULT. The doorway is choked with fallen rock; break it with a pickaxe. Whatever sealed it still guards the chest.`
                  : `ECHO VAULT. Three engraved plates wake the vault's guardians one at a time. Clear every ambush and the chest unlocks.`,
            },
          );
          break;
        }
        default:
      }
    }
  return out;
}
