import { hash2 } from './rng';
import { T } from './tiles';
import { GATE_OY, isGateY } from './gate-plane';

/**
 * Dungeon gates. Each day, seeded rifts open across the wilds, ranked E to S by how far they lie from the spawn.
 * Step through one and you stand in a dungeon of its own: a chain of rooms with side chambers, packed with the
 * rank's monsters, and the gate's master waiting in the last hall. Bring the master down and the gate closes,
 * paying out mana stones and coin. Leave one open past dusk and it breaks: its monsters spill out into the world.
 *
 * Every dungeon is one of a fixed set of slots on the gate plane, laid out from the seed alone (so the terrain can
 * be generated and cached like any other plane). Which slot a day's gate opens onto is what changes.
 */
export { GATE_OY, GATE_SPAN, isGateY } from './gate-plane';

export const GATE_RANKS = ['E', 'D', 'C', 'B', 'A', 'S'] as const;
export type GateRankName = (typeof GATE_RANKS)[number];

export interface GateRankInfo {
  /** level a hunter needs to step through */
  level: number;
  /** level of what waits inside */
  creature: number;
  /** rooms along the main way, entry to the master's hall */
  rooms: number;
  /** monsters per room */
  pack: number;
  pool: string[];
  master: string;
  /** the master's health, as a multiple of its kind's */
  masterHp: number;
  /** coins and mana stones paid to everyone in the dungeon when the master falls */
  coins: number;
  stones: { id: string; n: number };
  xp: number;
}
export const GATE_RANK_INFO: GateRankInfo[] = [
  {
    level: 3,
    creature: 4,
    rooms: 5,
    pack: 2,
    pool: ['slime', 'wolf', 'goblin'],
    master: 'raider',
    masterHp: 3,
    coins: 90,
    stones: { id: 'lesser_mana_stone', n: 2 },
    xp: 120,
  },
  {
    level: 8,
    creature: 9,
    rooms: 6,
    pack: 3,
    pool: ['goblin', 'bandit', 'spider'],
    master: 'orc',
    masterHp: 3,
    coins: 180,
    stones: { id: 'lesser_mana_stone', n: 4 },
    xp: 260,
  },
  {
    level: 13,
    creature: 14,
    rooms: 7,
    pack: 3,
    pool: ['orc', 'undead', 'rogue_mage'],
    master: 'troll',
    masterHp: 3.5,
    coins: 320,
    stones: { id: 'mana_stone', n: 2 },
    xp: 480,
  },
  {
    level: 18,
    creature: 19,
    rooms: 8,
    pack: 3,
    pool: ['troll', 'corrupted_beast', 'rogue_mage', 'spider'],
    master: 'manticore',
    masterHp: 3.5,
    coins: 520,
    stones: { id: 'mana_stone', n: 4 },
    xp: 780,
  },
  {
    level: 24,
    creature: 25,
    rooms: 9,
    pack: 4,
    pool: ['shade_stalker', 'gear_hound', 'sundered_blade', 'gloam_hexer'],
    master: 'hydra',
    masterHp: 4,
    coins: 800,
    stones: { id: 'radiant_mana_stone', n: 2 },
    xp: 1200,
  },
  {
    level: 30,
    creature: 32,
    rooms: 10,
    pack: 4,
    pool: ['troll', 'basilisk', 'manticore', 'sundered_blade'],
    master: 'dragon',
    masterHp: 4,
    coins: 1300,
    stones: { id: 'radiant_mana_stone', n: 4 },
    xp: 2000,
  },
];

/** gates open at dawn; one still open at dusk breaks */
export const GATE_OPEN_HOUR = 6;
export const GATE_BREAK_HOUR = 20;

// ───────────────────────── the dungeons (slots on the gate plane) ─────────────────────────

export const GATE_SLOTS = 192;
/** tiles between neighbouring dungeons along the plane: every other shard region, each dungeon at a region's centre */
export const GATE_PITCH = 512;
const CELL = 24;
/** rooms stay within this many cells of the entry, so a whole dungeon fits inside one shard region */
const REACH = 4;
const SALT = 8100;

export type GateTheme = 'cavern' | 'temple' | 'ember' | 'crystal';
export const GATE_THEMES: GateTheme[] = ['cavern', 'temple', 'ember', 'crystal'];
export interface GateRoom {
  /** centre, dungeon-local tiles */
  x: number;
  y: number;
  r: number;
  kind: 'entry' | 'hall' | 'side' | 'master';
}
export interface GateLayout {
  slot: number;
  rank: number;
  theme: GateTheme;
  /** world x of the dungeon's origin (its y origin is GATE_OY) */
  ox: number;
  rooms: GateRoom[];
  /** corridors, as pairs of room indices */
  links: Array<[number, number]>;
}

/** a slot's rank: slots cycle through E..S, so every rank has a share of the plane */
export const slotRank = (slot: number): number => slot % GATE_RANKS.length;
export const slotOrigin = (slot: number): number => (slot - GATE_SLOTS / 2) * GATE_PITCH;
/** the slot whose dungeon world-x `x` lies in, or null */
export function gateSlotAt(x: number): number | null {
  const s = Math.round(x / GATE_PITCH) + GATE_SLOTS / 2;
  return s >= 0 && s < GATE_SLOTS ? s : null;
}

const LAYOUTS = new Map<string, GateLayout>();
const DIAGONALS: Array<[number, number]> = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const DIRS: Array<[number, number]> = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/** The dungeon behind slot `slot`: a winding main way of rooms with a few side chambers, the master at the end. */
export function gateLayout(seed: number, slot: number): GateLayout {
  const key = `${seed}:${slot}`;
  const hit = LAYOUTS.get(key);
  if (hit) return hit;
  const rank = slotRank(slot);
  const info = GATE_RANK_INFO[rank]!;
  const theme = GATE_THEMES[Math.floor(hash2(seed, slot, 1, SALT) * GATE_THEMES.length)]!;
  const taken = new Set<string>(['0,0']);
  const cells: Array<[number, number]> = [[0, 0]];
  let [cx, cy] = [0, 0];
  let heading = Math.floor(hash2(seed, slot, 2, SALT) * 4);
  for (let i = 1; i < info.rooms; i++) {
    // wander: usually keep the heading, sometimes turn; never double back into a room already there
    const options = [heading, (heading + 1) % 4, (heading + 3) % 4].filter(
      (d) =>
        !taken.has(`${cx + DIRS[d]![0]},${cy + DIRS[d]![1]}`) &&
        Math.abs(cx + DIRS[d]![0]) <= REACH &&
        Math.abs(cy + DIRS[d]![1]) <= REACH,
    );
    if (!options.length) break;
    const turn = hash2(seed, slot, 10 + i, SALT);
    heading =
      turn < 0.55 || options.length === 1
        ? options[0]!
        : options[1 + (Math.floor((turn - 0.55) * 4.4) % (options.length - 1))]!;
    cx += DIRS[heading]![0];
    cy += DIRS[heading]![1];
    taken.add(`${cx},${cy}`);
    cells.push([cx, cy]);
  }
  const at = (gx: number, gy: number, k: number) => ({
    x: Math.round(gx * CELL + (hash2(seed, slot * 64 + k, 3, SALT) - 0.5) * 6),
    y: Math.round(gy * CELL + (hash2(seed, slot * 64 + k, 4, SALT) - 0.5) * 6),
  });
  const rooms: GateRoom[] = cells.map(([gx, gy], i) => ({
    ...at(gx, gy, i),
    r: i === 0 ? 6 : i === cells.length - 1 ? 10 : 5 + Math.floor(hash2(seed, slot * 64 + i, 5, SALT) * 3),
    kind: i === 0 ? 'entry' : i === cells.length - 1 ? 'master' : 'hall',
  }));
  const links: Array<[number, number]> = [];
  for (let i = 1; i < rooms.length; i++) links.push([i - 1, i]);
  // side chambers off the halls: dead ends with a cache
  for (let i = 1; i < cells.length - 1; i++) {
    if (hash2(seed, slot * 64 + i, 6, SALT) > 0.45) continue;
    const [gx, gy] = cells[i]!;
    const d = DIRS.find(
      ([dx, dy]) => !taken.has(`${gx + dx},${gy + dy}`) && Math.abs(gx + dx) <= REACH && Math.abs(gy + dy) <= REACH,
    );
    if (!d) continue;
    taken.add(`${gx + d[0]},${gy + d[1]}`);
    rooms.push({ ...at(gx + d[0], gy + d[1], 40 + i), r: 4, kind: 'side' });
    links.push([i, rooms.length - 1]);
  }
  const out: GateLayout = { slot, rank, theme, ox: slotOrigin(slot), rooms, links };
  LAYOUTS.set(key, out);
  return out;
}

/** the room of a dungeon that (world) x, y stands in, as its index, or -1 */
export function gateRoomAt(seed: number, x: number, y: number): { slot: number; room: number } | null {
  if (!isGateY(y)) return null;
  const slot = gateSlotAt(x);
  if (slot === null) return null;
  const L = gateLayout(seed, slot);
  const lx = x - L.ox,
    ly = y - GATE_OY;
  const room = L.rooms.findIndex((r) => Math.hypot(lx - r.x, ly - r.y) <= r.r);
  return { slot, room };
}

/** where a hunter stepping through slot `slot`'s gate is set down, and where its way out stands (world tiles) */
export function gateEntry(seed: number, slot: number): { x: number; y: number } {
  const L = gateLayout(seed, slot),
    e = L.rooms[0]!;
  return { x: L.ox + e.x + 0.5, y: GATE_OY + e.y + 2.5 };
}
export function gateExit(seed: number, slot: number): { x: number; y: number } {
  const L = gateLayout(seed, slot),
    e = L.rooms[0]!;
  return { x: L.ox + e.x + 0.5, y: GATE_OY + e.y - 2.5 };
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax,
    dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** Tiles of the gate plane (null elsewhere): rock, with the dungeon's rooms and corridors hewn out of it. */
export function gateTileAt(seed: number, x: number, y: number): number | null {
  if (!isGateY(y)) return null;
  const slot = gateSlotAt(x);
  if (slot === null) return T.CAVE_WALL;
  const L = gateLayout(seed, slot);
  const lx = x - L.ox,
    ly = y - GATE_OY;
  if (Math.abs(lx) > GATE_PITCH / 2 - 4 || Math.abs(ly) > GATE_PITCH / 2 - 4) return T.CAVE_WALL;
  const h = hash2(seed, x, y, SALT + 20);
  let room: GateRoom | null = null,
    edge = -Infinity;
  for (const r of L.rooms) {
    const e = r.r - Math.hypot(lx - r.x, ly - r.y);
    if (e > edge) {
      edge = e;
      room = r;
    }
  }
  const corridor = L.links.some(([a, b]) => {
    const p = L.rooms[a]!,
      q = L.rooms[b]!;
    return segDist(lx, ly, p.x, p.y, q.x, q.y) < 1.6;
  });
  const inside = edge > 0 || corridor;
  if (!inside) {
    if (L.theme === 'crystal' && h < 0.05) return T.CAVE_CRYSTAL;
    return T.CAVE_WALL;
  }
  const floor =
    L.theme === 'temple' ? T.VAULT_FLOOR : L.theme === 'ember' ? (h < 0.6 ? T.SCORIA : T.CAVE_FLOOR) : T.CAVE_FLOOR;
  if (edge <= 0) return floor; // corridors stay clear
  // braziers on the four diagonals of every room, a little in from the wall (clear of the corridor mouths, which
  // meet a room square-on), so no room is ever dark
  const r = room!;
  const tr = Math.max(2, r.r - 2) * Math.SQRT1_2;
  for (const [dx, dy] of DIAGONALS)
    if (Math.round(r.x + dx * tr) === lx && Math.round(r.y + dy * tr) === ly) return T.TORCH;
  const clearBand = Math.hypot(lx - r.x, ly - r.y) < 3 || edge < 1.5;
  if (clearBand || r.kind === 'entry') return floor;
  if (L.theme === 'cavern') return h < 0.04 ? T.GLOWCAP : h < 0.055 ? T.STALAGMITE : floor;
  if (L.theme === 'ember') return h < 0.025 ? T.LAVA : floor;
  if (L.theme === 'crystal') return h < 0.04 ? T.SHIMMER : h < 0.05 ? T.CRYSTAL : floor;
  return h < 0.03 ? T.CAVE_BOULDER : floor;
}

// ───────────────────────── the gates that open each day ─────────────────────────

export interface Gate {
  id: string;
  slot: number;
  rank: number;
  /** where it stands in the wilds (world tiles) */
  x: number;
  y: number;
  day: number;
}

const REGION = 128;
const GATE_CHANCE = 0.22;
/** no gate opens this close to the spawn */
const HOME_CLEAR = 90;

/** a region's rank: E near the spawn, rising every ~350 tiles out, with the odd surprise either way */
export function regionRank(seed: number, rx: number, ry: number, day: number): number {
  const d = Math.hypot((rx + 0.5) * REGION, (ry + 0.5) * REGION);
  const h = hash2(seed, rx * 977 + day, ry, SALT + 30);
  const tier = Math.floor(d / 350) + (h < 0.15 ? 1 : 0) - (h > 0.9 ? 1 : 0);
  return Math.max(0, Math.min(GATE_RANKS.length - 1, tier));
}

/**
 * The gates open on `day` in the box (x0, y0)–(x1, y1). `open(x, y)` says whether a tile is clear ground a gate can
 * stand on (the server checks its own world); a region whose spot is not clear has no gate that day.
 */
export function gatesNear(
  seed: number,
  day: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  open: (x: number, y: number) => boolean,
): Gate[] {
  const out: Gate[] = [];
  for (let ry = Math.floor(y0 / REGION); ry <= Math.floor(y1 / REGION); ry++)
    for (let rx = Math.floor(x0 / REGION); rx <= Math.floor(x1 / REGION); rx++) {
      if (hash2(seed, rx * 131 + day, ry * 7 + day, SALT + 31) >= GATE_CHANCE) continue;
      const cx = Math.round((rx + 0.15 + hash2(seed, rx, ry * 3 + day, SALT + 32) * 0.7) * REGION),
        cy = Math.round((ry + 0.15 + hash2(seed, rx * 3 + day, ry, SALT + 33) * 0.7) * REGION);
      if (Math.hypot(cx, cy) < HOME_CLEAR) continue;
      let spot: { x: number; y: number } | null = null;
      for (let k = 0; k < 40 && !spot; k++) {
        const a = k * 2.4,
          rr = Math.sqrt(k) * 2;
        const x = Math.round(cx + Math.cos(a) * rr),
          y = Math.round(cy + Math.sin(a) * rr);
        if (open(x, y) && open(x + 1, y) && open(x, y + 1) && open(x - 1, y) && open(x, y - 1)) spot = { x, y };
      }
      if (!spot) continue;
      const rank = regionRank(seed, rx, ry, day);
      const per = GATE_SLOTS / GATE_RANKS.length;
      const slot = rank + GATE_RANKS.length * Math.floor(hash2(seed, rx + day * 17, ry, SALT + 34) * per);
      out.push({ id: `g${day}:${rx},${ry}`, slot, rank, x: spot.x, y: spot.y, day });
    }
  return out;
}
