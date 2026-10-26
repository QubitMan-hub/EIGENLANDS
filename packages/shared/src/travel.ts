import { hash2 } from './rng';
import { T, isSolid } from './tiles';
import { tileAt } from './worldgen';
import { townFor, townsFor, type Town } from './town';
import { frontierTownsNear } from './frontier';
import { REALM_SITE_BY_ID, nearestRealm, type RealmSite } from './realms';
import { isCaveY } from './caves';
import { isUpperY } from './floors';
import { isDiveY } from './sanctuaries';
import { shrinesNear } from './shrines';
import { ruinOfCell } from './ruins';
import { activeGeneration } from './generation-registry';
import { propFootprint, type WorldObj } from './objects';
import type { WorldGeneration } from './world-version';

/**
 * Teleportation & travel (master plan §14). Waystones stand in every surface settlement and, one per wild region, out
 * in the open country. Touching one attunes it (charting the land around it); from any attuned stone you may travel to
 * any other you have attuned on the same kingdom network. Realm Gates (capitals and Hadamere) and Harbour ferries
 * (seaward outposts) also link the networks to each other. You must find a place before you can return to it, travel
 * starts only at a stone, never mid-fight or underground. Placement is a pure function of seed and world revision, so
 * client and server agree and nothing is stored but each character's attuned list.
 */
export type WayKind = 'waystone' | 'gate' | 'harbor';
export interface Waystone {
  /** stable: kind letter + coordinates */
  id: string;
  x: number;
  y: number;
  kind: WayKind;
  name: string;
  /** network: the kingdom whose sphere the stone stands in, or 'home' (Hadamere's continent and the open wilds) */
  net: string;
  /** a settlement's stone, or one found in the wild */
  wild: boolean;
}

export const WAY_SUB: Record<WayKind, string> = { waystone: 'waystone', gate: 'realm_gate', harbor: 'ferry_post' };
export const WAY_SUBS = new Set(Object.values(WAY_SUB));
/** Walking this close attunes a stone. */
export const ATTUNE_REACH = 3.5;
/** Seconds of channelling before the jump; moving or being hurt breaks it. */
export const TRAVEL_CHANNEL = 2.5;
export const RECALL_CHANNEL = 5;
/** Every this many attuned stones raises the Wayfarer rank (cheaper travel, rewards). */
export const WAYFARER_STEP = 5;
export const WAYFARER_MAX = 4;
/** Attuned stones needed for the Recall Shard recipe and the Moonlit Stag. */
export const RECALL_AT = 3;
export const STAG_AT = 12;

const NET_NAMES: Record<string, string> = {
  home: 'Hadamere & the Wilds',
  aurelion: 'Aurelion',
  sylvaris: 'Sylvaris',
  khardum: 'Khar-Dum',
  raijin: 'Raijin Shogunate',
  thalassara: 'Thalassara',
  nethrakar: 'Nethrakar',
};
export const netName = (net: string): string => NET_NAMES[net] ?? net;
export const wayNet = (x: number, y: number): string => nearestRealm(x, y)?.id ?? 'home';
const surfaceY = (y: number): boolean => !isCaveY(y) && !isUpperY(y) && !isDiveY(y);

const OPEN = new Set<number>([T.GRASS, T.GRASS_TALL, T.FLOWERS, T.SAND, T.PATH, T.SHIMMER]);
/** Settlement stones may also stand on paving and yard floors outside buildings. */
const TOWN_OPEN = new Set<number>([...OPEN, T.FLOOR]);

/** A kingdom settlement's site: frontier towns carry it, realm towns name their spots after it. */
function siteOf(t: Town): RealmSite | null {
  if (t.site) return t.site;
  for (const k of Object.keys(t.spots)) {
    const s = REALM_SITE_BY_ID[k.split('.')[0]!];
    if (s) return s;
  }
  return null;
}
function kindOf(seed: number, t: Town): WayKind {
  const site = siteOf(t);
  if (t === townFor(seed) || site?.kind === 'capital') return 'gate';
  if (site?.kind === 'outpost') return 'harbor';
  return 'waystone';
}
const idOf = (kind: WayKind, x: number, y: number) => `${kind[0]}:${x}:${y}`;

/** A clear spot inside a settlement: open ground, nothing furnished nearby, away from doors and NPC spots. */
function townStone(seed: number, gen: WorldGeneration, t: Town): Waystone | null {
  if (!surfaceY(t.cy)) return null;
  const kind = kindOf(seed, t);
  const taken = new Set<string>();
  const tile = (x: number, y: number) => tileAt(seed, x, y, gen);
  for (const o of t.objects) {
    taken.add(`${o.x},${o.y}`);
    for (const [fx, fy] of propFootprint(o.sub, o.x, o.y, tile)) taken.add(`${fx},${fy}`);
  }
  const spots = Object.values(t.spots);
  const r = kind === 'gate' ? 3 : 2;
  const ok = (x: number, y: number) => {
    if (x - r < t.x0 || x + r > t.x1 || y - r < t.y0 || y + r > t.y1) return false;
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++) {
        const v = tile(x + i, y + j);
        if (!TOWN_OPEN.has(v) || isSolid(v) || taken.has(`${x + i},${y + j}`)) return false;
      }
    // doorways stay well clear, and the floor must be a yard, not the inside of a building
    for (let j = -3; j <= 3; j++)
      for (let i = -3; i <= 3; i++) {
        const v = tile(x + i, y + j);
        if (v === T.DOOR || v === T.WALL || v === T.FACE) return false;
      }
    return !spots.some((s) => Math.abs(s.x - x) <= r && Math.abs(s.y - y) <= r);
  };
  const ax = t.spots.plaza_c?.x ?? t.cx,
    ay = t.spots.plaza_c?.y ?? t.cy;
  for (let d = 3; d < 40; d++)
    for (let k = 0; k < d * 8; k++) {
      // walk the square ring of radius d, starting at a seeded corner so stones are not all due north
      const side = Math.floor(k / (d * 2)),
        off = (k % (d * 2)) - d;
      const [dx, dy] = side === 0 ? [off, -d] : side === 1 ? [d, off] : side === 2 ? [-off, d] : [-d, -off];
      const x = ax + dx,
        y = ay + dy;
      if (!ok(x, y)) continue;
      const name =
        kind === 'gate' ? `${t.name} Realm Gate` : kind === 'harbor' ? `${t.name} Ferry` : `${t.name} Waystone`;
      return { id: idOf(kind, x, y), x, y, kind, name, net: wayNet(x, y), wild: false };
    }
  return null;
}

const PRE = [
  'Amber',
  'Hollow',
  'Whisper',
  'Lantern',
  'Briar',
  'Cinder',
  'Gale',
  'Moss',
  'Raven',
  'Thistle',
  'Ember',
  'Frost',
  'Starfall',
  'Wren',
  'Old Oak',
  'Sable',
  'Dawn',
  'Tide',
  'Echo',
  'Copper',
  'Heron',
  'Gloam',
  'Bramble',
  'Kestrel',
];
const POST = ['Waystone', 'Watchstone', 'Menhir', 'Cairn', 'Standing Stone', 'Runestone'];
/** One wild stone per CELL x CELL tiles, preferring a spot beside a road. */
const CELL = 192;
const wildCache = new Map<string, Waystone | null>();

function wildClear(seed: number, gen: WorldGeneration, x: number, y: number): boolean {
  if (Math.hypot(x, y) < 28) return false;
  // cheapest tests first: tile sampling dominates, so the centre and corners go before the full square
  if (!OPEN.has(tileAt(seed, x, y, gen))) return false;
  if (townsNearPoint(seed, gen, x, y, 16)) return false;
  for (const [i, j] of [
    [-2, -2],
    [2, -2],
    [-2, 2],
    [2, 2],
  ] as const)
    if (!OPEN.has(tileAt(seed, x + i, y + j, gen))) return false;
  for (let j = -2; j <= 2; j++)
    for (let i = -2; i <= 2; i++)
      if ((i || j) && Math.abs(i * j) !== 4 && !OPEN.has(tileAt(seed, x + i, y + j, gen))) return false;
  if (shrinesNear(seed, x, y, 12).length) return false;
  for (let gy = Math.floor(y / 96) - 1; gy <= Math.floor(y / 96) + 1; gy++)
    for (let gx = Math.floor(x / 96) - 1; gx <= Math.floor(x / 96) + 1; gx++) {
      const r = ruinOfCell(seed, gx, gy);
      if (r && Math.hypot(r.x - x, r.y - y) < 16) return false;
    }
  return true;
}
function townsNearPoint(seed: number, gen: WorldGeneration, x: number, y: number, m: number): boolean {
  return (
    townsFor(seed, gen).some((t) => x >= t.x0 - m && x <= t.x1 + m && y >= t.y0 - m && y <= t.y1 + m) ||
    (gen >= 6 && frontierTownsNear(seed, x - m, y - m, x + m, y + m, gen).length > 0)
  );
}

export function wildStoneOf(seed: number, gx: number, gy: number, gen: WorldGeneration): Waystone | null {
  const key = `${seed}:${gen}:${gx},${gy}`;
  const hit = wildCache.get(key);
  if (hit !== undefined) return hit;
  let out: Waystone | null = null;
  if (surfaceY(gy * CELL) && surfaceY(gy * CELL + CELL)) {
    let first: [number, number] | null = null,
      road: [number, number] | null = null;
    for (let k = 0; k < 8 && !road; k++) {
      const x = gx * CELL + 20 + Math.floor(hash2(seed, gx * 17 + k, gy, 7301) * (CELL - 40));
      const y = gy * CELL + 20 + Math.floor(hash2(seed, gx, gy * 17 + k, 7302) * (CELL - 40));
      if (!wildClear(seed, gen, x, y)) continue;
      first ??= [x, y];
      // a road within a few tiles makes it a wayside stone (sampled sparsely: roads are several tiles wide)
      for (let j = -6; j <= 6 && !road; j += 3)
        for (let i = -6; i <= 6 && !road; i += 3) if (tileAt(seed, x + i, y + j, gen) === T.PATH) road = [x, y];
    }
    const at = road ?? first;
    if (at) {
      const name = `${PRE[Math.floor(hash2(seed, gx, gy, 7303) * PRE.length)]} ${POST[Math.floor(hash2(seed, gx, gy, 7304) * POST.length)]}`;
      out = {
        id: idOf('waystone', at[0], at[1]),
        x: at[0],
        y: at[1],
        kind: 'waystone',
        name,
        net: wayNet(at[0], at[1]),
        wild: true,
      };
    }
  }
  if (wildCache.size > 6000) wildCache.clear();
  wildCache.set(key, out);
  return out;
}

const townCache = new Map<string, Waystone[]>();
const frontierCache = new Map<string, Waystone | null>();
function settledStones(seed: number, gen: WorldGeneration): Waystone[] {
  const key = `${seed}:${gen}`;
  let list = townCache.get(key);
  if (!list) {
    list = townsFor(seed, gen)
      .map((t) => townStone(seed, gen, t))
      .filter((s): s is Waystone => !!s);
    if (townCache.size > 8) townCache.clear();
    townCache.set(key, list);
  }
  return list;
}
function frontierStone(seed: number, gen: WorldGeneration, t: Town): Waystone | null {
  const key = `${seed}:${gen}:${t.cx},${t.cy}`;
  let s = frontierCache.get(key);
  if (s === undefined) {
    s = townStone(seed, gen, t);
    if (frontierCache.size > 400) frontierCache.clear();
    frontierCache.set(key, s);
  }
  return s;
}

/** Every waystone, gate and ferry post within `r` tiles of (x, y). */
export function waystonesNear(
  seed: number,
  x: number,
  y: number,
  r: number,
  gen: WorldGeneration = activeGeneration(seed),
): Waystone[] {
  if (!surfaceY(y)) return [];
  const out = settledStones(seed, gen).filter((s) => Math.hypot(s.x - x, s.y - y) <= r);
  if (gen >= 6)
    for (const t of frontierTownsNear(seed, x - r - 120, y - r - 120, x + r + 120, y + r + 120, gen)) {
      const s = frontierStone(seed, gen, t);
      if (s && Math.hypot(s.x - x, s.y - y) <= r && !out.some((o) => o.id === s.id)) out.push(s);
    }
  for (let gy = Math.floor((y - r) / CELL); gy <= Math.floor((y + r) / CELL); gy++)
    for (let gx = Math.floor((x - r) / CELL); gx <= Math.floor((x + r) / CELL); gx++) {
      const s = wildStoneOf(seed, gx, gy, gen);
      if (s && Math.hypot(s.x - x, s.y - y) <= r) out.push(s);
    }
  return out;
}

/** Resolve a stone id (as stored in a character's attuned list); null if the world has no such stone. */
export function waystoneById(seed: number, id: string, gen: WorldGeneration = activeGeneration(seed)): Waystone | null {
  const m = /^([wgh]):(-?\d+):(-?\d+)$/.exec(id);
  if (!m) return null;
  const x = Number(m[2]),
    y = Number(m[3]);
  return waystonesNear(seed, x, y, 0.5, gen).find((s) => s.id === id) ?? null;
}

/** The waystone objects standing in chunk (cx, cy). Gates are three tiles wide: the arch, with the portal centred. */
export function waystoneObjectsIn(
  seed: number,
  cx: number,
  cy: number,
  gen: WorldGeneration = activeGeneration(seed),
): WorldObj[] {
  const x0 = cx * 32,
    y0 = cy * 32;
  if (!surfaceY(y0)) return [];
  return waystonesNear(seed, x0 + 16, y0 + 16, 24, gen)
    .filter((s) => Math.floor(s.x / 32) === cx && Math.floor(s.y / 32) === cy)
    .map((s) => ({ x: s.x, y: s.y, kind: 'deco', sub: WAY_SUB[s.kind], static: true, data: { way: s.id } }));
}

/** Cross-network journeys need a gate or ferry at both ends; within a network any stone reaches any other. */
export function canTravel(from: Waystone, to: Waystone): boolean {
  if (from.id === to.id) return false;
  if (from.net === to.net) return true;
  return from.kind !== 'waystone' && to.kind !== 'waystone';
}

export const wayfarerRank = (attuned: number): number => Math.min(WAYFARER_MAX, Math.floor(attuned / WAYFARER_STEP));

/** Coins for a journey: a small toll by distance; crossing between kingdoms is a ferry fare or a gate's tithe. */
export function travelCost(from: Waystone, to: Waystone, rank = 0): number {
  const d = Math.hypot(from.x - to.x, from.y - to.y);
  let base: number;
  if (from.net === to.net) base = 4 + d / 40;
  else if (from.kind === 'harbor' && to.kind === 'harbor') base = 25 + d / 80;
  else base = 45 + d / 60;
  return Math.max(1, Math.round(base * (1 - 0.12 * Math.min(WAYFARER_MAX, rank))));
}

/** Where a traveller arrives: an open tile just in front of (south of) the stone. */
export function arrivalOf(s: Waystone): { x: number; y: number } {
  return { x: s.x + 0.5, y: s.y + (s.kind === 'gate' ? 2.5 : 1.5) };
}

/** Panel payload: the stones a traveller may reach from the one they stand at. */
export interface TravelDest {
  id: string;
  name: string;
  kind: WayKind;
  net: string;
  x: number;
  y: number;
  cost: number;
  /** false: attuned but needs a gate or ferry at both ends */
  reachable: boolean;
}
export interface TravelPanel {
  here: { id: string; name: string; kind: WayKind; net: string };
  home: string | null;
  attuned: number;
  rank: number;
  coins: number;
  dests: TravelDest[];
}

export type TravelEvent =
  | {
      kind: 'state';
      attuned: Array<{ id: string; name: string; kind: WayKind; x: number; y: number }>;
      home: string | null;
    }
  | { kind: 'attune'; id: string; name: string; wayKind: WayKind; x: number; y: number; reward: string; rank: number }
  | { kind: 'channel'; seconds: number; to: string }
  | { kind: 'cancel'; why: string }
  | { kind: 'arrive'; name: string; x: number; y: number };

export const MSG_TRAVEL = {
  /** client -> server: { to: id } go from the stone you stand at; { bind: true } bind home; { recall: slot } */
  GO: 'tr_go',
  /** server -> client: TravelEvent */
  EV: 'tr_ev',
} as const;
export interface TravelGoMsg {
  /** destination stone id */
  to?: string;
  /** stone the traveller stands at (validated by distance) */
  from?: string;
  /** bind the stone you stand at as your Recall home */
  bind?: boolean;
  /** cancel a channel in progress */
  cancel?: boolean;
}
