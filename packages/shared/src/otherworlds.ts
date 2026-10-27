/**
 * The three realms beyond the six kingdoms (master plan §7): Aetheria, the Celestial Expanse; the Umbral Abyss; and
 * Chronoria, the Fractured Realm. Each is a plane of its own, far from the surface, reached through a realm portal
 * near Hadamere and generated from the seed like everything else:
 *
 *   Aetheria   — floating islands over a sea of cloud, joined by sky-roads and updrafts. Ring the three wind chimes
 *                and the updraft to the Phoenix's eyrie will carry you.
 *   Umbral Abyss — caverns of black rock and glowing fungi, the lit ruin of an old city, and darkness that gnaws at
 *                anyone without a light. The Umbral Maw waits in its pit.
 *   Chronoria  — temporal ruins on a plateau split by reality fractures. Rewind rifts return you to a moment ago; set
 *                the three chrono dials to the archive's hour and the Unwound's sealed court opens.
 *
 * Layouts are graphs of rooms (islands, chambers, plazas) on a jittered grid, so every part of a realm is reachable.
 * Tiles, levels and props are pure functions of the seed; nothing is stored but each traveller's progress.
 */
import { CHUNK_SIZE } from './constants';
import { hash2 } from './rng';
import { T } from './tiles';
import { isGateY } from './gate-plane';
import type { WorldObj } from './objects';

export type OtherworldId = 'aetheria' | 'umbra' | 'chronoria';
export const OTHERWORLD_IDS: OtherworldId[] = ['aetheria', 'umbra', 'chronoria'];

export interface OtherworldDef {
  id: OtherworldId;
  name: string;
  title: string;
  /** plane offset (tiles) */
  oy: number;
  /** level a traveller needs before the portal lets them through */
  level: number;
  /** room-grid spacing and extent */
  cell: number;
  span: number;
  /** creature level out here */
  creatureLevel: number;
  blurb: string;
}

export const OTHERWORLDS: Record<OtherworldId, OtherworldDef> = {
  aetheria: {
    id: 'aetheria',
    name: 'Aetheria',
    title: 'the Celestial Expanse',
    oy: -300000,
    level: 6,
    cell: 48,
    span: 6,
    creatureLevel: 8,
    blurb: 'Islands of meadow drift on a sea of cloud. The wind carries you where the sky-roads do not reach.',
  },
  umbra: {
    id: 'umbra',
    name: 'the Umbral Abyss',
    title: 'the Deep Below Everything',
    oy: -400000,
    level: 10,
    cell: 40,
    span: 6,
    creatureLevel: 12,
    blurb: 'Black caverns lit only by fungus. The dark here is hungry: carry a light, or stay near one.',
  },
  chronoria: {
    id: 'chronoria',
    name: 'Chronoria',
    title: 'the Fractured Realm',
    oy: -500000,
    level: 14,
    cell: 56,
    span: 5,
    creatureLevel: 16,
    blurb: 'Ruins of a city that happened, and did not, and will. Reality is cracked; time leaks through the gaps.',
  },
};

const SPAN_Y = 30000;
/** Which realm plane (if any) the tile row y lies on. */
export function otherworldOf(y: number): OtherworldId | null {
  for (const id of OTHERWORLD_IDS) if (Math.abs(y - OTHERWORLDS[id].oy) < SPAN_Y) return id;
  return null;
}
/** off the surface world entirely: one of the three realms, or the plane the dungeon gates open onto */
export const isOtherworldY = (y: number): boolean => otherworldOf(y) !== null || isGateY(y);

// ───────────────────────── noise and the room grid ─────────────────────────

/** smooth value noise in [0, 1) */
function vnoise(seed: number, x: number, y: number, salt: number): number {
  const x0 = Math.floor(x),
    y0 = Math.floor(y);
  const fx = x - x0,
    fy = y - y0;
  const ux = fx * fx * (3 - 2 * fx),
    uy = fy * fy * (3 - 2 * fy);
  const a = hash2(seed, x0, y0, salt),
    b = hash2(seed, x0 + 1, y0, salt),
    c = hash2(seed, x0, y0 + 1, salt),
    d = hash2(seed, x0 + 1, y0 + 1, salt);
  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
}

export interface Room {
  gx: number;
  gy: number;
  /** centre, realm-local tiles */
  x: number;
  y: number;
  r: number;
}

const SALT: Record<OtherworldId, number> = { aetheria: 7100, umbra: 7200, chronoria: 7300 };
/** the room where the boss waits */
export const ARENA_CELL: Record<OtherworldId, [number, number]> = {
  aetheria: [4, 3],
  umbra: [3, -3],
  chronoria: [3, -2],
};

// ───────────────────────── the realm graph ─────────────────────────

/**
 * Which cells of a realm's grid hold a room, and which neighbouring rooms are joined. Each seed leaves some cells
 * empty, joins the rest with a random spanning tree (so everything is reachable) and adds a few extra links for
 * loops. The rooms that matter (home, the boss's room and the way up to it, the chime isles, the lore rooms, the
 * peoples' homes) are always present and always connected.
 */
interface RealmGraph {
  /** 1 where a cell holds a room */
  present: Uint8Array;
  /** link to the east / south neighbour: 0 none, 1 road (bridge, tunnel, street), 2 updraft */
  east: Uint8Array;
  south: Uint8Array;
}
const GRID = 32;
const gi = (gx: number, gy: number): number => (gy + GRID / 2) * GRID + (gx + GRID / 2);
const GRAPHS = new Map<string, RealmGraph>();
const DROP: Record<OtherworldId, number> = { aetheria: 0.24, umbra: 0.16, chronoria: 0.14 };
const LOOPS: Record<OtherworldId, number> = { aetheria: 0.22, umbra: 0.3, chronoria: 1 };

function realmGraph(seed: number, w: OtherworldId): RealmGraph {
  const key = `${seed}:${w}`;
  const hit = GRAPHS.get(key);
  if (hit) return hit;
  const span = OTHERWORLDS[w].span,
    s = SALT[w];
  const [ax, ay] = ARENA_CELL[w];
  const sealed = w !== 'umbra'; // the eyrie and the Unwound's court have no road in
  const inside = (gx: number, gy: number) => Math.abs(gx) <= span && Math.abs(gy) <= span;
  const forced: Array<[number, number]> = [
    [0, 0],
    [ax, ay],
    [ax - 1, ay],
    [-1, 2],
    [2, 1],
    HOLLOW_CELL,
    ...(w === 'aetheria' ? chimeCells(seed) : []),
  ];
  const present = new Uint8Array(GRID * GRID);
  for (let gy = -span; gy <= span; gy++)
    for (let gx = -span; gx <= span; gx++) if (hash2(seed, gx, gy, s + 70) >= DROP[w]) present[gi(gx, gy)] = 1;
  for (const [fx, fy] of forced) present[gi(fx, fy)] = 1;
  const walkable = (gx: number, gy: number) =>
    inside(gx, gy) && present[gi(gx, gy)] === 1 && !(sealed && gx === ax && gy === ay);
  const reached = (): Uint8Array => {
    const seen = new Uint8Array(GRID * GRID);
    const q: Array<[number, number]> = [[0, 0]];
    seen[gi(0, 0)] = 1;
    while (q.length) {
      const [x, y] = q.pop()!;
      for (const [dx, dy] of NEIGHBOURS4) {
        const nx = x + dx,
          ny = y + dy;
        if (walkable(nx, ny) && !seen[gi(nx, ny)]) {
          seen[gi(nx, ny)] = 1;
          q.push([nx, ny]);
        }
      }
    }
    return seen;
  };
  // a forced room cut off by the empty cells gets a corridor of rooms back toward home
  let seen = reached();
  for (const [fx, fy] of forced) {
    if (sealed && fx === ax && fy === ay) continue;
    let x = fx,
      y = fy;
    while (!seen[gi(x, y)]) {
      present[gi(x, y)] = 1;
      const tx = x + Math.sign(-x),
        ty = y + Math.sign(-y);
      if (x !== 0 && !(sealed && tx === ax && y === ay)) x = tx;
      else if (y !== 0) y = ty;
      else break;
      if (seen[gi(x, y)]) break;
    }
    present[gi(x, y)] = 1;
    seen = reached();
  }
  // rooms nobody can reach are not there at all
  for (let gy = -span; gy <= span; gy++)
    for (let gx = -span; gx <= span; gx++) if (!seen[gi(gx, gy)] && !(gx === ax && gy === ay)) present[gi(gx, gy)] = 0;
  // a random spanning tree (Kruskal over hashed weights), then extra links for loops
  const parent = new Int32Array(GRID * GRID).map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const edges: Array<{ a: [number, number]; b: [number, number]; wt: number }> = [];
  for (let gy = -span; gy <= span; gy++)
    for (let gx = -span; gx <= span; gx++)
      for (const [dx, dy] of NEIGHBOURS) {
        const bx = gx + dx,
          by = gy + dy;
        if (!walkable(gx, gy) || !walkable(bx, by)) continue;
        edges.push({ a: [gx, gy], b: [bx, by], wt: hash2(seed, gx * 2 + dx, gy * 2 + dy, s + 71) });
      }
  edges.sort((p, q) => p.wt - q.wt);
  const east = new Uint8Array(GRID * GRID),
    south = new Uint8Array(GRID * GRID);
  const link = (a: [number, number], b: [number, number], kind: number) => {
    if (b[0] > a[0]) east[gi(a[0], a[1])] = kind;
    else south[gi(a[0], a[1])] = kind;
  };
  // Aetheria: some links are sky-roads, the rest updrafts
  const kind = (e: { a: [number, number] }) =>
    w === 'aetheria' && hash2(seed, e.a[0], e.a[1], s + 72 + Math.round(e.a[0] * 7)) >= 0.5 ? 2 : 1;
  for (const e of edges) {
    const ra = find(gi(...e.a)),
      rb = find(gi(...e.b));
    if (ra !== rb) {
      parent[ra] = rb;
      link(e.a, e.b, kind(e));
    } else if (hash2(seed, e.a[0] + e.b[0] * 3, e.a[1] + e.b[1] * 5, s + 73) < LOOPS[w]) link(e.a, e.b, kind(e));
  }
  // the Phoenix's eyrie: a single updraft from its western neighbour
  if (w === 'aetheria') east[gi(ax - 1, ay)] = 2;
  const g = { present, east, south };
  GRAPHS.set(key, g);
  return g;
}
const NEIGHBOURS4: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** the link between two neighbouring cells: 0 none, 1 road, 2 updraft */
function linkBetween(seed: number, w: OtherworldId, a: [number, number], b: [number, number]): number {
  const [p, q] = a[0] + a[1] <= b[0] + b[1] ? [a, b] : [b, a];
  if (Math.abs(p[0]) > GRID / 2 - 1 || Math.abs(p[1]) > GRID / 2 - 1) return 0;
  const g = realmGraph(seed, w);
  return q[0] > p[0] ? g.east[gi(p[0], p[1])]! : g.south[gi(p[0], p[1])]!;
}

/** Room (island, chamber or plaza) of grid cell (gx, gy), or null where the realm has none. */
export function roomOf(seed: number, w: OtherworldId, gx: number, gy: number): Room | null {
  const def = OTHERWORLDS[w];
  if (Math.abs(gx) > def.span || Math.abs(gy) > def.span) return null;
  if (!realmGraph(seed, w).present[gi(gx, gy)]) return null;
  const s = SALT[w];
  const home = gx === 0 && gy === 0;
  const arena = gx === ARENA_CELL[w][0] && gy === ARENA_CELL[w][1];
  const j = def.cell * 0.26;
  const x = home ? 0 : Math.round(gx * def.cell + (hash2(seed, gx, gy, s + 1) - 0.5) * 2 * j);
  const y = home ? 0 : Math.round(gy * def.cell + (hash2(seed, gx, gy, s + 2) - 0.5) * 2 * j);
  const base = w === 'aetheria' ? 8 : w === 'umbra' ? 7 : 6;
  const r = home ? 13 : arena ? 15 : base + Math.floor(hash2(seed, gx, gy, s + 3) * 9);
  return { gx, gy, x, y, r };
}

/** Is there a road (bridge, tunnel, street) between two neighbouring cells? */
export function roadBetween(seed: number, w: OtherworldId, a: [number, number], b: [number, number]): boolean {
  return linkBetween(seed, w, a, b) === 1;
}

/** realm-local coordinates of a world tile on plane `w` */
export const localY = (w: OtherworldId, y: number): number => y - OTHERWORLDS[w].oy;

/** distance from p to the segment ab */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax,
    dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

const NEIGHBOURS: Array<[number, number]> = [
  [1, 0],
  [0, 1],
];

/** What lies at realm-local (x, y): the room it is in and how far inside, or the road it is on. */
function placeAt(
  seed: number,
  w: OtherworldId,
  x: number,
  y: number,
): { room: Room | null; edge: number; road: boolean } {
  const cell = OTHERWORLDS[w].cell;
  const gx0 = Math.round(x / cell),
    gy0 = Math.round(y / cell);
  let best: Room | null = null,
    edge = -Infinity,
    road = false;
  const wob = (vnoise(seed, x / 5, y / 5, SALT[w] + 9) - 0.5) * (w === 'chronoria' ? 2 : 5);
  for (let gy = gy0 - 1; gy <= gy0 + 1; gy++)
    for (let gx = gx0 - 1; gx <= gx0 + 1; gx++) {
      const r = roomOf(seed, w, gx, gy);
      if (!r) continue;
      const e = r.r + wob - Math.hypot(x - r.x, y - r.y);
      if (e > edge) {
        edge = e;
        best = r;
      }
      for (const [dx, dy] of NEIGHBOURS) {
        if (road) break;
        const o = roomOf(seed, w, gx + dx, gy + dy);
        if (!o || !roadBetween(seed, w, [gx, gy], [gx + dx, gy + dy])) continue;
        const half = w === 'umbra' ? 1.6 : w === 'chronoria' ? 1.6 : 1.1;
        if (segDist(x, y, r.x, r.y, o.x, o.y) < half) road = true;
      }
    }
  return { room: edge > 0 ? best : null, edge, road };
}

// ───────────────────────── room themes ─────────────────────────

/**
 * Each ordinary room (not the home, the boss's room or the Hollow) is seeded with a theme of its realm, so no two
 * islands, chambers or ruins read alike. Themes only change ground and scatter: solid features stay sparse and away
 * from the room's heart, its rim and its roads, so every room stays crossable.
 */
export const ROOM_THEMES = {
  aetheria: ['meadow', 'grove', 'crystal', 'ruin', 'lake'],
  umbra: ['fungal', 'crystal', 'ember', 'flooded', 'boulders'],
  chronoria: ['overgrown', 'clockyard', 'stilled', 'dunes'],
} as const satisfies Record<OtherworldId, readonly string[]>;
export type RoomTheme = (typeof ROOM_THEMES)[OtherworldId][number];

export function roomTheme(seed: number, w: OtherworldId, r: Room): RoomTheme | null {
  if ((r.gx === 0 && r.gy === 0) || (r.gx === ARENA_CELL[w][0] && r.gy === ARENA_CELL[w][1])) return null;
  if (w === 'umbra' && r.gx === HOLLOW_CELL[0] && r.gy === HOLLOW_CELL[1]) return null;
  const list = ROOM_THEMES[w];
  return list[Math.floor(hash2(seed, r.gx, r.gy, SALT[w] + 50) * list.length)]!;
}

/** distance to the nearest of a room's two pools (lake, flooded, ember), or Infinity when it has none */
function poolDist(seed: number, w: OtherworldId, r: Room, x: number, y: number): { d: number; rad: number } {
  if (r.r < 12) return { d: Infinity, rad: 0 };
  const rad = Math.min(2.6, 1.4 + (r.r - 12) * 0.3);
  let d = Infinity;
  for (let k = 0; k < 2; k++) {
    const a = hash2(seed, r.gx, r.gy, SALT[w] + 60 + k) * Math.PI * 2;
    const m = r.r * 0.55;
    d = Math.min(d, Math.hypot(x - (r.x + Math.cos(a) * m), y - (r.y + Math.sin(a) * m)));
  }
  return { d, rad };
}

// ───────────────────────── tiles ─────────────────────────

/** Tiles of a realm plane (null off the realm planes). */
export function otherworldTileAt(seed: number, x: number, y: number): number | null {
  const w = otherworldOf(y);
  if (!w) return null;
  const ly = localY(w, y);
  const { room, edge, road } = placeAt(seed, w, x, ly);
  const h = hash2(seed, x, ly, SALT[w] + 20);
  const arena = room && room.gx === ARENA_CELL[w][0] && room.gy === ARENA_CELL[w][1];
  const home = room && room.gx === 0 && room.gy === 0;
  // props stand near each room's centre and at its edges: keep obstacles in the ring between
  const clear = !room || Math.hypot(x - room.x, ly - room.y) < 6 || edge < 6;
  if (w === 'aetheria') {
    if (!room) return road ? T.PATH : T.UPPER_VOID;
    if (edge < 1.4) return T.SAND; // the crumbling rim
    const theme = roomTheme(seed, w, room);
    if (home || arena || !theme || nearUpdraft(seed, room, x, ly))
      return h < 0.06 ? T.FLOWERS : h < 0.1 ? T.GRASS_TALL : T.GRASS;
    if (theme === 'lake' && !clear) {
      const p = poolDist(seed, w, room, x, ly);
      if (p.d < p.rad) return T.WATER;
      if (p.d < p.rad + 1.2) return T.SAND;
    }
    if (clear) {
      if (theme === 'ruin') return vnoise(seed, x / 2.5, ly / 2.5, 7150) > 0.55 ? T.VAULT_FLOOR : T.GRASS;
      if (theme === 'crystal') return h < 0.07 ? T.SHIMMER : T.GRASS;
      if (theme === 'grove') return h < 0.1 ? T.FLOWERS : h < 0.3 ? T.GRASS_TALL : T.GRASS;
      return h < 0.06 ? T.FLOWERS : h < 0.1 ? T.GRASS_TALL : T.GRASS;
    }
    // aetherium shows as pale outcrops in the meadow rings
    if (h > 0.985) return T.ORE_SILVER;
    if (h > 0.975) return T.ROCK;
    if (theme === 'grove')
      return h < 0.1 ? T.TREE : h < 0.13 ? T.SHIMMER : h < 0.25 ? T.FLOWERS : h < 0.5 ? T.GRASS_TALL : T.GRASS;
    if (theme === 'crystal') return h < 0.035 ? T.CRYSTAL : h < 0.16 ? T.SHIMMER : h < 0.22 ? T.GRASS_TALL : T.GRASS;
    if (theme === 'ruin') {
      if (h < 0.035) return T.ROCK; // fallen columns
      return vnoise(seed, x / 2.5, ly / 2.5, 7150) > 0.5 ? T.VAULT_FLOOR : h < 0.12 ? T.GRASS_TALL : T.GRASS;
    }
    return h < 0.025 ? T.TREE : h < 0.045 ? T.SHIMMER : h < 0.13 ? T.FLOWERS : h < 0.24 ? T.GRASS_TALL : T.GRASS;
  }
  if (w === 'umbra') {
    if (!room && !road) {
      // crystal seams catch the eye in the rock along the passages
      return h < 0.03 ? T.CAVE_CRYSTAL : h < 0.055 ? T.CAVE_SILVER : T.CAVE_WALL;
    }
    if (room && room.gx === HOLLOW_CELL[0] && room.gy === HOLLOW_CELL[1]) return T.VAULT_FLOOR;
    if (!room || home || arena) return T.CAVE_FLOOR;
    const theme = roomTheme(seed, w, room);
    if (!clear && (theme === 'flooded' || theme === 'ember')) {
      // pools: black water, or a lava seep that lights the chamber (and burns whoever wades in)
      const p = poolDist(seed, w, room, x, ly);
      if (p.d < p.rad) return theme === 'ember' ? T.LAVA : T.WATER;
      if (p.d < p.rad + 1.5) return theme === 'ember' ? T.SCORIA : h < 0.3 ? T.GLOWCAP : T.CAVE_FLOOR;
    }
    if (theme === 'ember') return h < 0.25 ? T.SCORIA : clear ? T.CAVE_FLOOR : h > 0.96 ? T.STALAGMITE : T.CAVE_FLOOR;
    if (theme === 'crystal') {
      if (clear) return h < 0.03 ? T.SHIMMER : T.CAVE_FLOOR;
      return h < 0.03 ? T.CRYSTAL : h < 0.06 ? T.SHIMMER : h < 0.075 ? T.STALAGMITE : T.CAVE_FLOOR;
    }
    if (theme === 'boulders') {
      if (clear) return h < 0.02 ? T.GLOWCAP : T.CAVE_FLOOR;
      return h < 0.07 ? T.CAVE_BOULDER : h < 0.09 ? T.GLOWCAP : T.CAVE_FLOOR;
    }
    if (theme === 'fungal') {
      if (clear) return h < 0.08 ? T.GLOWCAP : T.CAVE_FLOOR;
      return h < 0.14 ? T.GLOWCAP : h < 0.16 ? T.STALAGMITE : T.CAVE_FLOOR;
    }
    if (clear) return h < 0.04 ? T.GLOWCAP : T.CAVE_FLOOR;
    return h < 0.05 ? T.GLOWCAP : h < 0.065 ? T.STALAGMITE : T.CAVE_FLOOR;
  }
  // Chronoria: ruins on a cracked plateau; the fractures are bottomless
  if (arena) return T.VAULT_FLOOR;
  if (room) {
    // a paved court at the heart of each ruin; outside it the slabs give way to grass and rubble
    const r = Math.hypot(x - room.x, ly - room.y);
    if (home ? r < 7 : r < 5) return T.VAULT_FLOOR;
    const theme = roomTheme(seed, w, room);
    const slab = vnoise(seed, x / 3, ly / 3, 7340);
    if (theme === 'clockyard') {
      if (!clear && h < 0.012) return T.ORE_GOLD; // the old works' gold, half-buried
      if (!clear && h < 0.035) return T.ROCK; // fallen gearwork
      return slab > 0.38 ? T.VAULT_FLOOR : h < 0.1 ? T.GRASS_TALL : T.GRASS;
    }
    if (theme === 'stilled') {
      // a grove caught in a single moment: trees and blooms that never move
      if (!clear && h < 0.07) return T.TREE;
      return h < 0.14 ? T.SHIMMER : slab > 0.7 ? T.VAULT_FLOOR : h < 0.3 ? T.GRASS_TALL : T.GRASS;
    }
    if (theme === 'dunes') {
      // the sand of spent hours piles up against the ruin
      if (!clear && h < 0.02) return T.ROCK;
      return vnoise(seed, x / 6, ly / 6, 7350) > 0.4 ? T.SAND : slab > 0.6 ? T.VAULT_FLOOR : T.GRASS;
    }
    if (!clear && h < 0.02) return T.CRYSTAL;
    return slab > 0.55 ? T.VAULT_FLOOR : h < 0.04 ? T.SHIMMER : h < 0.15 ? T.GRASS_TALL : T.GRASS;
  }
  if (road) return T.PATH;
  // the Unwound's court is ringed by a fracture: only the chrono gate crosses it
  const a = roomOf(seed, w, ARENA_CELL[w][0], ARENA_CELL[w][1])!;
  const da = Math.hypot(x - a.x, ly - a.y);
  if (da < a.r + 5) return T.UPPER_VOID;
  if (Math.hypot(x, ly) > OTHERWORLDS[w].cell * (OTHERWORLDS[w].span + 0.6)) return T.UPPER_VOID;
  // the archive court before the gate, and the road to it from the ruin next door: no fracture ever cuts them off
  const g = gateLocal(seed);
  if (Math.hypot(x - g.x + 2, ly - g.y) < 8) return h < 0.05 ? T.SHIMMER : T.VAULT_FLOOR;
  const wn = roomOf(seed, w, ARENA_CELL[w][0] - 1, ARENA_CELL[w][1])!;
  if (segDist(x, ly, wn.x, wn.y, g.x - 2, g.y) < 1.6) return T.PATH;
  const crack = Math.abs(vnoise(seed, x / 13, ly / 13, 7320) - 0.5);
  if (crack < 0.04) return T.UPPER_VOID;
  return h < 0.02 ? T.SHIMMER : h < 0.03 ? T.ROCK : h > 0.988 ? T.ORE_GOLD : h < 0.2 ? T.GRASS_TALL : T.GRASS;
}

/** Heights: Aetheria's islands stand two levels above the cloud, Chronoria's plateau one above its fractures. */
export function otherworldLevels(seed: number, cx: number, cy: number): Uint8Array {
  const out = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const w = otherworldOf(cy * CHUNK_SIZE);
  if (!w || w === 'umbra') return out;
  for (let j = 0; j < CHUNK_SIZE; j++)
    for (let i = 0; i < CHUNK_SIZE; i++) {
      const t = otherworldTileAt(seed, cx * CHUNK_SIZE + i, cy * CHUNK_SIZE + j);
      out[j * CHUNK_SIZE + i] = t === T.UPPER_VOID ? 0 : w === 'aetheria' ? 2 : 1;
    }
  return out;
}

// ───────────────────────── places ─────────────────────────

/** the lit ruin of the old city in the Abyss: a refuge from the dark */
export const HOLLOW_CELL: [number, number] = [-2, 1];

/** Where a traveller steps out of the portal, and where the return portal stands (world tiles). */
export const otherworldArrival = (w: OtherworldId) => ({ x: 0.5, y: OTHERWORLDS[w].oy + 1.5 });
export const otherworldReturnPortal = (w: OtherworldId) => ({ x: 0, y: OTHERWORLDS[w].oy - 2 });
/** The boss's room (world tiles). */
export function otherworldArena(seed: number, w: OtherworldId): { x: number; y: number; r: number } {
  const a = roomOf(seed, w, ARENA_CELL[w][0], ARENA_CELL[w][1])!;
  return { x: a.x, y: a.y + OTHERWORLDS[w].oy, r: a.r };
}

/** Surface realm portals, a short walk from the spawn shrine in three directions. */
export const PORTAL_SPOTS: Record<OtherworldId, { x: number; y: number }> = {
  aetheria: { x: -38, y: -52 },
  umbra: { x: -60, y: 30 },
  chronoria: { x: 30, y: -66 },
};

export interface Updraft {
  /** where it stands (world tiles) and where it sets you down */
  x: number;
  y: number;
  to: { x: number; y: number };
  /** the updraft up to the Phoenix's eyrie (needs the three chimes rung) */
  eyrie: boolean;
}

/** Aetheria's updrafts: one at each island's edge toward every unbridged neighbour. */
export function updraftsOf(seed: number): Updraft[] {
  const cached = UPDRAFTS.get(seed);
  if (cached) return cached;
  const out: Updraft[] = [];
  const w: OtherworldId = 'aetheria',
    oy = OTHERWORLDS[w].oy,
    span = OTHERWORLDS[w].span;
  const arena = ARENA_CELL[w];
  const at = (from: Room, to: Room) => {
    const d = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const k = Math.max(3, from.r - 4) / d;
    return { x: Math.round(from.x + (to.x - from.x) * k), y: Math.round(from.y + (to.y - from.y) * k) };
  };
  for (let gy = -span; gy <= span; gy++)
    for (let gx = -span; gx <= span; gx++)
      for (const [dx, dy] of NEIGHBOURS) {
        const a = roomOf(seed, w, gx, gy),
          b = roomOf(seed, w, gx + dx, gy + dy);
        if (!a || !b || linkBetween(seed, w, [gx, gy], [gx + dx, gy + dy]) !== 2) continue;
        const intoArena = (b.gx === arena[0] && b.gy === arena[1]) || (a.gx === arena[0] && a.gy === arena[1]);
        const pa = at(a, b),
          pb = at(b, a);
        // you land a step inward from the updraft on the far side
        const inward = (p: { x: number; y: number }, r: Room) => {
          const d = Math.hypot(r.x - p.x, r.y - p.y) || 1;
          return { x: p.x + ((r.x - p.x) / d) * 1.5 + 0.5, y: p.y + ((r.y - p.y) / d) * 1.5 + 0.5 + oy };
        };
        out.push({ x: pa.x, y: pa.y + oy, to: inward(pb, b), eyrie: intoArena });
        out.push({ x: pb.x, y: pb.y + oy, to: inward(pa, a), eyrie: false });
      }
  UPDRAFTS.set(seed, out);
  return out;
}
const UPDRAFTS = new Map<number, Updraft[]>();

/** Where updrafts stand and set you down, by island: the ground there is always open. */
const UPDRAFT_SPOTS = new Map<number, Map<number, Array<[number, number]>>>();
function nearUpdraft(seed: number, room: Room, x: number, ly: number): boolean {
  let spots = UPDRAFT_SPOTS.get(seed);
  if (!spots) {
    spots = new Map();
    const oy = OTHERWORLDS.aetheria.oy;
    const put = (px: number, py: number) => {
      const p = placeAt(seed, 'aetheria', px, py - oy).room;
      if (!p) return;
      const k = gi(p.gx, p.gy);
      (spots!.get(k) ?? spots!.set(k, []).get(k)!).push([px, py - oy]);
    };
    for (const u of updraftsOf(seed)) {
      put(u.x, u.y);
      put(u.to.x, u.to.y);
    }
    UPDRAFT_SPOTS.set(seed, spots);
  }
  for (const [px, py] of spots.get(gi(room.gx, room.gy)) ?? []) if (Math.hypot(x - px, ly - py) < 2.5) return true;
  return false;
}

/** the three wind-chime islands of Aetheria (cells), seeded but never the home or the eyrie */
export function chimeCells(seed: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const candidates: Array<[number, number]> = [
    [-3, -2],
    [2, -4],
    [-4, 3],
    [1, 4],
    [-2, 5],
    [4, -1],
  ];
  const start = Math.floor(hash2(seed, 3, 7, 7130) * candidates.length);
  for (let i = 0; i < 3; i++) out.push(candidates[(start + i * 2) % candidates.length]!);
  return out;
}

/** the chrono gate in Chronoria-local tiles */
function gateLocal(seed: number): { x: number; y: number } {
  const a = roomOf(seed, 'chronoria', ARENA_CELL.chronoria[0], ARENA_CELL.chronoria[1])!;
  return { x: a.x - a.r - 8, y: a.y };
}

/** Chronoria's chrono gate (beside the fracture around the court) and its three dials (world tiles). */
export function chronoGate(seed: number): { gate: { x: number; y: number }; dials: Array<{ x: number; y: number }> } {
  const a = otherworldArena(seed, 'chronoria');
  const gx = a.x - a.r - 8,
    gy = a.y;
  return {
    gate: { x: gx, y: gy },
    dials: [
      { x: gx - 3, y: gy - 3 },
      { x: gx - 3, y: gy },
      { x: gx - 3, y: gy + 3 },
    ],
  };
}
/** The hour the archive keeps: the dial positions (0..3 each) that open the gate. */
export function chronoCode(seed: number): number[] {
  return [0, 1, 2].map((i) => Math.floor(hash2(seed, i, 41, 7330) * 4));
}
export const DIAL_WORDS = ['dawn', 'noon', 'dusk', 'midnight'];

// ───────────────────────── creatures, resources, lore ─────────────────────────

export const OTHERWORLD_CREATURES: Record<OtherworldId, { roam: string[]; boss: string; bossName: string }> = {
  aetheria: { roam: ['zephyr_ray', 'gilded_sentinel'], boss: 'eyrie_phoenix', bossName: 'the Phoenix of the Eyrie' },
  umbra: { roam: ['shade_stalker', 'abyss_serpent'], boss: 'umbral_maw', bossName: 'the Umbral Maw' },
  chronoria: { roam: ['gear_hound', 'paradox_echo'], boss: 'the_unwound', bossName: 'the Unwound' },
};

/** What each realm's gathering nodes yield. */
export const OTHERWORLD_NODES: Record<string, { item: string; realm: OtherworldId; verb: string }> = {
  sky_bloom: { item: 'cloud_silk', realm: 'aetheria', verb: 'You gather threads of cloud-silk from the bloom.' },
  umbral_cap: { item: 'umbral_spore', realm: 'umbra', verb: 'You shake glowing spores into a pouch.' },
  time_sand: { item: 'chrono_sand', realm: 'chronoria', verb: 'You sift sand that falls upward for a moment.' },
};

export const OTHERWORLD_LORE: Record<OtherworldId, Array<{ title: string; pages: string[] }>> = {
  aetheria: [
    {
      title: 'The Cartographer’s Lament',
      pages: [
        'I mapped every island twice and the map was wrong both times. They drift, slowly, on the cloud.',
        'The wind keeps to its own roads. Step into the bright updrafts and they will carry you across.',
      ],
    },
    {
      title: 'Hymn of the Eyrie',
      pages: [
        'Three chimes hang on three far isles. When all three have sung, the high wind wakes.',
        'Ride it to the Eyrie, where the Phoenix burns and is reborn. Bring water. Bring courage.',
      ],
    },
    {
      title: 'A Sentinel’s Oath (carved)',
      pages: ['We were made of gold and given one word: guard. We have forgotten what. We guard anyway.'],
    },
  ],
  umbra: [
    {
      title: 'Hollow Ledger',
      pages: [
        'Before the dark came up, this was a city. The Hollow still keeps its lamps lit. Rest there.',
        'Away from the lamps the dark gnaws. Carry a lantern; the fungus glow will hold it back a little.',
      ],
    },
    {
      title: 'Of the Maw',
      pages: [
        'Deep in the south-east pit something eats the light itself. We sealed nothing. It simply waits.',
        'They say its heart, cut out, never stops beating, and gives off a light the dark cannot touch.',
      ],
    },
    {
      title: 'A Child’s Chalk Drawing',
      pages: ['A stick figure with a lantern. Beside it, in careful letters: DONT LET IT GO OUT.'],
    },
  ],
  chronoria: [
    {
      title: 'The Archivist’s Note',
      pages: [
        'The court of the Unwound is ringed by a fracture no bridge can cross. The gate obeys the dials.',
        'Set them to the hour the Archive keeps. It is written on the tablet by the gate. It is always that hour.',
      ],
    },
    {
      title: 'On Rifts',
      pages: [
        'The rifts remember. Step to one and you are returned to how you were a breath ago: wounds and all.',
        'Use it wisely. A breath ago you may have been worse off.',
      ],
    },
    {
      title: 'Superposition (scratched into stone)',
      pages: ['I was here. I was not here. Both are true until someone reads this. Thank you for reading this.'],
    },
  ],
};

/** The realm props the server answers when touched (portal, return, lore and altar subs carry the realm's name). */
export function realmPropKind(sub: string): string | null {
  const base = sub.replace(/_(aetheria|umbra|chronoria)$/, '');
  return REALM_PROP_KINDS.has(base) ? base : null;
}
const REALM_PROP_KINDS = new Set([
  'realm_portal',
  'realm_return',
  'realm_lore',
  'realm_altar',
  'updraft',
  'wind_chime',
  'chrono_dial',
  'chrono_gate',
  'chrono_rift',
  'sky_bloom',
  'umbral_cap',
  'time_sand',
]);

/** Static props of chunk (cx, cy) on a realm plane. */
export function otherworldObjectsIn(seed: number, cx: number, cy: number): WorldObj[] {
  const w = otherworldOf(cy * CHUNK_SIZE);
  if (!w) return [];
  const out: WorldObj[] = [];
  const oy = OTHERWORLDS[w].oy;
  const x0 = cx * CHUNK_SIZE,
    y0 = cy * CHUNK_SIZE;
  const add = (x: number, y: number, sub: string, data: Record<string, unknown> = {}) => {
    if (Math.floor(x / CHUNK_SIZE) === cx && Math.floor(y / CHUNK_SIZE) === cy)
      out.push({ x, y, kind: 'deco', sub, static: true, data: { realm: w, ...data } });
  };
  const rp = otherworldReturnPortal(w);
  add(rp.x, rp.y, `realm_return_${w}`);
  // rooms overlapping this chunk: their props
  const cell = OTHERWORLDS[w].cell;
  for (let gy = Math.floor((y0 - oy - cell) / cell); gy <= Math.ceil((y0 - oy + CHUNK_SIZE + cell) / cell); gy++)
    for (let gx = Math.floor((x0 - cell) / cell); gx <= Math.ceil((x0 + CHUNK_SIZE + cell) / cell); gx++) {
      const r = roomOf(seed, w, gx, gy);
      if (!r) continue;
      const home = gx === 0 && gy === 0,
        arena = gx === ARENA_CELL[w][0] && gy === ARENA_CELL[w][1];
      const ry = r.y + oy;
      if (arena) {
        add(r.x, ry - Math.floor(r.r / 2), `realm_altar_${w}`, { boss: OTHERWORLD_CREATURES[w].boss });
        continue;
      }
      if (home) {
        add(r.x - 4, ry + 3, `realm_lore_${w}`, { lore: 0 });
        continue;
      }
      const h = hash2(seed, gx, gy, SALT[w] + 40);
      // a gathering node or two in most rooms
      const node = w === 'aetheria' ? 'sky_bloom' : w === 'umbra' ? 'umbral_cap' : 'time_sand';
      if (h < 0.8) add(r.x + 2, ry - 2, node);
      if (h < 0.35) add(r.x - 3, ry + 2, node);
      // lore tablets in two rooms each
      if ((gx === -1 && gy === 2) || (gx === 2 && gy === 1))
        add(r.x, ry + 1, `realm_lore_${w}`, { lore: gx < 0 ? 1 : 2 });
      // the realm's own scenery
      if (w === 'aetheria' && h > 0.55) add(r.x - 2, ry - 3, 'sky_pillar');
      if (w === 'umbra' && h > 0.5) add(r.x + 3, ry + 3, 'umbral_obelisk');
      if (w === 'chronoria') {
        if (h > 0.45) add(r.x - 4, ry - 2, 'broken_clock');
        if (h > 0.2 && h < 0.6) add(r.x + 3, ry + 3, 'chrono_rift');
      }
      if (w === 'umbra' && gx === HOLLOW_CELL[0] && gy === HOLLOW_CELL[1])
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          add(Math.round(r.x + Math.cos(a) * (r.r - 3)), Math.round(ry + Math.sin(a) * (r.r - 3)), 'hollow_lamp');
        }
    }
  if (w === 'aetheria') {
    for (const u of updraftsOf(seed)) add(u.x, u.y, 'updraft', { to: u.to, eyrie: u.eyrie });
    chimeCells(seed).forEach(([gx, gy], i) => {
      const r = roomOf(seed, w, gx, gy)!;
      add(r.x, r.y + oy, 'wind_chime', { chime: i });
    });
  }
  if (w === 'chronoria') {
    const g = chronoGate(seed);
    add(g.gate.x, g.gate.y, 'chrono_gate');
    g.dials.forEach((d, i) => add(d.x, d.y, 'chrono_dial', { dial: i }));
    add(g.gate.x - 1, g.gate.y + 5, `realm_lore_${w}`, { lore: 0, archive: true });
  }
  return out;
}

const OPEN_GROUND = new Set<number>([T.GRASS, T.GRASS_TALL, T.FLOWERS, T.SAND, T.PATH]);
const portalCache = new Map<string, Record<OtherworldId, { x: number; y: number }>>();
/**
 * Where each surface realm portal stands: the open tile nearest its intended spot, with open ground in front of it.
 * `tile` is the surface tile function of the world (seed and revision bound).
 */
export function realmPortals(
  key: string,
  tile: (x: number, y: number) => number,
): Record<OtherworldId, { x: number; y: number }> {
  const hit = portalCache.get(key);
  if (hit) return hit;
  const out = {} as Record<OtherworldId, { x: number; y: number }>;
  for (const id of OTHERWORLD_IDS) {
    const s = PORTAL_SPOTS[id];
    let found = s;
    search: for (let r = 0; r < 16; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = s.x + dx,
            y = s.y + dy;
          if (OPEN_GROUND.has(tile(x, y)) && OPEN_GROUND.has(tile(x, y + 1)) && OPEN_GROUND.has(tile(x + 1, y + 1))) {
            found = { x, y };
            break search;
          }
        }
    out[id] = found;
  }
  portalCache.set(key, out);
  return out;
}

/** The surface realm portals in chunk (cx, cy). */
export function realmPortalsIn(
  key: string,
  tile: (x: number, y: number) => number,
  cx: number,
  cy: number,
): WorldObj[] {
  const out: WorldObj[] = [];
  const spots = realmPortals(key, tile);
  for (const id of OTHERWORLD_IDS) {
    const p = spots[id];
    if (Math.floor(p.x / CHUNK_SIZE) === cx && Math.floor(p.y / CHUNK_SIZE) === cy)
      out.push({ x: p.x, y: p.y, kind: 'deco', sub: `realm_portal_${id}`, static: true, data: { realm: id } });
  }
  return out;
}
