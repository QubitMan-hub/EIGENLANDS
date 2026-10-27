import { hash2 } from './rng';
import { DAY_MS } from './constants';
import { dayNumber, gameHour } from './time';
import { townsFor, type Town } from './town';
import { isCaveY } from './caves';
import { isUpperY } from './floors';
import { activeGeneration } from './generation-registry';
import { waystonesNear } from './travel';
import { ITEMS } from './items';
import { KINGDOMS } from './kingdoms';
import { REALM_GEO, REALM_IDS, REALM_SITES, nearestRealm, roadCentre, type RealmId, type RealmSite } from './realms';

/**
 * Caravans (master plan §14): one wagon train per kingdom road, shuttling from the capital out through the ring's
 * village and town to its seaward farm or outpost and back, resting at every settlement on the way. Where a caravan
 * is is a pure function of seed and world time, so every client draws it in the same place and the server checks
 * trades and ambushes against the same position without simulating or storing anything.
 */
export type Ring = 'n' | 'e' | 's' | 'w';
export interface CaravanStop {
  site: RealmSite;
  /** distance along the road from the capital where the caravan rests (just outside the settlement) */
  d: number;
}
export interface CaravanRoute {
  id: string;
  realm: RealmId;
  ring: Ring;
  name: string;
  master: string;
  axis: 'ns' | 'ew';
  /** +1 when the road runs toward increasing x/y */
  sign: 1 | -1;
  stops: CaravanStop[];
  len: number;
  period: number;
  offset: number;
  /** the home continent's Wandering Peddler: parks in a different town each day instead of rolling a road */
  peddler?: boolean;
}
export interface CaravanPos {
  route: CaravanRoute;
  x: number;
  y: number;
  /** heading in world space (unit) */
  fx: number;
  fy: number;
  moving: boolean;
  /** the settlement it is resting at, if any */
  at: RealmSite | null;
  /** winding through a settlement's own streets between its gates: not drawn, not trading */
  hidden: boolean;
  /** the peddler: the town it is visiting today */
  town?: string;
}

export const CARAVAN_SPEED = 1.4; // tiles per second
export const CARAVAN_DWELL = 30; // seconds resting at each settlement
/** Trading reach from the wagon's centre. */
export const CARAVAN_REACH = 3.2;

const RING_DIR: Record<Ring, { axis: 'ns' | 'ew'; sign: 1 | -1; word: string }> = {
  n: { axis: 'ns', sign: -1, word: 'North' },
  s: { axis: 'ns', sign: 1, word: 'South' },
  e: { axis: 'ew', sign: 1, word: 'East' },
  w: { axis: 'ew', sign: -1, word: 'West' },
};
const MASTERS = [
  'Odo Brannick',
  'Mirela Sand',
  'Haskel Ferr',
  'Ysolt Varro',
  'Benedek Crane',
  'Tamsin Rook',
  'Ulric Penn',
  'Sabe Okonkwo',
  'Ilka Dorne',
  'Fennick Ash',
  'Rosa Calder',
  'Juno Marsh',
];

function buildRoutes(seed: number): CaravanRoute[] {
  const out: CaravanRoute[] = [];
  for (const realm of REALM_IDS) {
    const g = REALM_GEO[realm];
    for (const ring of ['n', 'e', 's', 'w'] as const) {
      const { axis, sign, word } = RING_DIR[ring];
      const sites = REALM_SITES.filter((s) => s.realm === realm && (s.ring === ring || s.kind === 'capital'));
      // a caravan rests on the road just outside each settlement's gate (the side toward the capital; the capital's
      // own outer gate on this road), never in a crowded square
      const stops = sites
        .map((site) => {
          const centre = Math.abs(axis === 'ns' ? site.cy - g.cy : site.cx - g.cx),
            half = (axis === 'ns' ? site.h : site.w) / 2;
          return { site, d: site.kind === 'capital' ? half + 4 : centre - half - 4 };
        })
        .sort((a, b) => a.d - b.d);
      const len = stops[stops.length - 1]!.d;
      const period = (2 * len) / CARAVAN_SPEED + CARAVAN_DWELL * 2 * stops.length;
      const k = REALM_IDS.indexOf(realm) * 4 + ['n', 'e', 's', 'w'].indexOf(ring);
      out.push({
        id: `${realm}_${ring}`,
        realm,
        ring,
        name: `${KINGDOMS[realm].name} ${word} Road Caravan`,
        master: MASTERS[Math.floor(hash2(seed, k, 17, 8801) * MASTERS.length)]!,
        axis,
        sign,
        stops,
        len,
        period,
        offset: Math.floor(hash2(seed, k, 3, 8802) * period),
      });
    }
  }
  return out;
}
/** The Wandering Peddler of the home continent (realm is only its wagon's placeholder; it belongs to no kingdom). */
const PEDDLER: CaravanRoute = {
  id: 'peddler',
  realm: 'aurelion',
  ring: 'n',
  name: 'Wandering Peddler',
  master: 'Pell the Wanderer',
  axis: 'ns',
  sign: 1,
  stops: [],
  len: 0,
  period: DAY_MS / 1000,
  offset: 0,
  peddler: true,
};
/** The peddler's hours in each town it visits. */
export const PEDDLER_HOURS: [number, number] = [8, 18];

/** The towns of the home continent, in the order the peddler visits them (Hadamere first). */
export function homeTowns(seed: number): Town[] {
  return townsFor(seed, activeGeneration(seed)).filter(
    (t) => !t.abandoned && !t.site && !isCaveY(t.cy) && !isUpperY(t.cy) && !nearestRealm(t.cx, t.cy),
  );
}

/** Where the peddler's wagon stands today: beside the town's waystone during market hours, otherwise on the road. */
const peddlerCache = new Map<string, { t: Town | undefined; x: number; y: number }>();
function peddlerAt(seed: number, nowMs: number): CaravanPos {
  const day = dayNumber(nowMs);
  const hour = gameHour(nowMs);
  const key = `${seed}:${day}`;
  let spot = peddlerCache.get(key);
  if (!spot) {
    const towns = homeTowns(seed);
    const t = towns[((day % towns.length) + towns.length) % towns.length];
    const stone = t
      ? waystonesNear(seed, t.cx, t.cy, 70).find((s) => !s.wild && s.net === 'home' && s.name.startsWith(t.name))
      : null;
    spot = {
      t,
      x: stone ? stone.x + 3.5 : (t?.cx ?? 0) + 0.5,
      y: stone ? stone.y + 1.5 : (t?.cy ?? 0) + 0.5,
    };
    if (peddlerCache.size > 16) peddlerCache.clear();
    peddlerCache.set(key, spot);
  }
  const { t, x, y } = spot;
  const open = hour >= PEDDLER_HOURS[0] && hour < PEDDLER_HOURS[1];
  return { route: PEDDLER, x, y, fx: 0, fy: 1, moving: false, at: null, hidden: !open || !t, town: t?.name };
}

const routeCache = new Map<number, CaravanRoute[]>();
export function caravanRoutes(seed: number): CaravanRoute[] {
  let r = routeCache.get(seed);
  if (!r) {
    r = buildRoutes(seed);
    r.push(PEDDLER);
    if (routeCache.size > 8) routeCache.clear();
    routeCache.set(seed, r);
  }
  return r;
}
export function caravanById(seed: number, id: string): CaravanRoute | null {
  return caravanRoutes(seed).find((r) => r.id === id) ?? null;
}

/** World point at distance `d` from the capital along the road of `r` (also used by the wayfarers). */
export function along(seed: number, r: CaravanRoute, d: number): { x: number; y: number } {
  const g = REALM_GEO[r.realm];
  if (r.axis === 'ns') {
    const y = g.cy + r.sign * d;
    return { x: roadCentre(seed, g, 'ns', Math.round(y)) + 0.5, y: y + 0.5 };
  }
  const x = g.cx + r.sign * d;
  return { x: x + 0.5, y: roadCentre(seed, g, 'ew', Math.round(x)) + 0.5 };
}

/** Where the caravan of `r` is at world time `nowMs` (server clock). */
export function caravanAt(seed: number, r: CaravanRoute, nowMs: number): CaravanPos {
  if (r.peddler) return peddlerAt(seed, nowMs);
  let t = (((nowMs / 1000 + r.offset) % r.period) + r.period) % r.period;
  // the outward leg then the return leg; each leg rests at every stop (the capital first, the far end last)
  const legs: Array<{ from: number; to: number }> = [];
  const ds = r.stops.map((s) => s.d);
  for (let i = 0; i < ds.length - 1; i++) legs.push({ from: ds[i]!, to: ds[i + 1]! });
  for (let i = ds.length - 1; i > 0; i--) legs.push({ from: ds[i]!, to: ds[i - 1]! });
  for (const leg of legs) {
    // rest at the leg's starting stop
    if (t < CARAVAN_DWELL) {
      const p = along(seed, r, leg.from);
      const dir = Math.sign(leg.to - leg.from) * r.sign;
      return {
        route: r,
        ...p,
        ...heading(r, dir),
        moving: false,
        at: r.stops.find((s) => s.d === leg.from)!.site,
        hidden: false,
      };
    }
    t -= CARAVAN_DWELL;
    const dur = Math.abs(leg.to - leg.from) / CARAVAN_SPEED;
    if (t < dur) {
      const d = leg.from + Math.sign(leg.to - leg.from) * t * CARAVAN_SPEED;
      const p = along(seed, r, d);
      const hidden = r.stops.some(
        (s) => Math.abs(p.x - s.site.cx) < s.site.w / 2 + 1 && Math.abs(p.y - s.site.cy) < s.site.h / 2 + 1,
      );
      return { route: r, ...p, ...heading(r, Math.sign(leg.to - leg.from) * r.sign), moving: true, at: null, hidden };
    }
    t -= dur;
  }
  const p = along(seed, r, ds[0]!);
  return { route: r, ...p, ...heading(r, r.sign), moving: false, at: r.stops[0]!.site, hidden: false };
}
function heading(r: CaravanRoute, dir: number): { fx: number; fy: number } {
  return r.axis === 'ns' ? { fx: 0, fy: dir || 1 } : { fx: dir || 1, fy: 0 };
}

/** Caravans within `rad` tiles of (x, y) at world time `nowMs`. */
export function caravansNear(seed: number, x: number, y: number, rad: number, nowMs: number): CaravanPos[] {
  const out: CaravanPos[] = [];
  for (const r of caravanRoutes(seed)) {
    const g = REALM_GEO[r.realm];
    // cheap reject: the whole route lies within its road's corridor (the peddler keeps to the home continent)
    if (
      r.peddler
        ? Math.hypot(x, y) > 900
        : r.axis === 'ns'
          ? Math.abs(x - g.cx) > rad + 12
          : Math.abs(y - g.cy) > rad + 12
    )
      continue;
    const p = caravanAt(seed, r, nowMs);
    if (!p.hidden && Math.hypot(p.x - x, p.y - y) <= rad) out.push(p);
  }
  return out;
}

/**
 * What a caravan carries today: wares from the far ends of its road plus a few travel goods. Rotates daily; caravans
 * pay a better price than town shops for what they buy (they carry it to markets elsewhere).
 */
const POOL_KINDS = new Set(['food', 'material', 'potion', 'resource', 'seed', 'forage']);
let pool: string[] | null = null;
let rare: string[] | null = null;
export function caravanStock(seed: number, r: CaravanRoute, day: number): Array<{ item: string; markup: number }> {
  if (r.peddler) {
    // curiosities from far away: dearer, rarer and different every day
    rare ??= Object.values(ITEMS)
      .filter((d) => POOL_KINDS.has(d.kind) && d.value > 60 && d.value <= 900 && !d.special)
      .map((d) => d.id)
      .sort();
    const got = new Set<string>();
    for (let i = 0; got.size < 8 && i < 50; i++) got.add(rare[Math.floor(hash2(seed, i, day, 8807) * rare.length)]!);
    return [...[...got].map((item) => ({ item, markup: 1.3 })), { item: 'recall_shard', markup: 1.25 }];
  }
  pool ??= Object.values(ITEMS)
    .filter((d) => POOL_KINDS.has(d.kind) && d.value >= 8 && d.value <= 420 && !d.special)
    .map((d) => d.id)
    .sort();
  const k = REALM_IDS.indexOf(r.realm) * 4 + ['n', 'e', 's', 'w'].indexOf(r.ring);
  const picked = new Set<string>();
  for (let i = 0; picked.size < 7 && i < 40; i++)
    picked.add(pool[Math.floor(hash2(seed, k * 97 + i, day, 8803) * pool.length)]!);
  return [
    ...[...picked].map((item) => ({ item, markup: 1.15 })),
    { item: 'recall_shard', markup: 1.3 },
    { item: 'hay', markup: 1.1 },
  ];
}
/** A caravan buys anything ordinary at 60% of its value (town shops pay about half). */
export const CARAVAN_BUY = 0.6;

/**
 * Where the caravan will rest next (not counting the stop it is resting at now) and when it gets there. Escort jobs
 * ride with it to this stop.
 */
export function caravanNextStop(
  seed: number,
  r: CaravanRoute,
  nowMs: number,
): { site: RealmSite; atMs: number; distance: number } | null {
  if (r.peddler) return null;
  const here = caravanAt(seed, r, nowMs);
  const from = here.at?.id ?? null;
  let travelled = 0,
    last = here;
  for (let t = 1000; t < r.period * 1000; t += 1000) {
    const p = caravanAt(seed, r, nowMs + t);
    travelled += Math.hypot(p.x - last.x, p.y - last.y);
    last = p;
    if (!p.moving && p.at && p.at.id !== from) return { site: p.at, atMs: nowMs + t, distance: travelled };
  }
  return null;
}
/** Escort pay: by road distance and the escort's level. */
export const escortPay = (distance: number, level: number): number => Math.round(30 + distance * 0.45 + level * 6);

/** A kingdom settlement's proper name (capital, town, village, or seaward farm/outpost of its ring). */
export function siteName(site: RealmSite): string {
  if (site.name) return site.name;
  const k = KINGDOMS[site.realm];
  if (site.kind === 'capital' || site.ring === 'c') return k.capital;
  const ring = site.ring as Ring;
  return site.kind === 'town'
    ? k.names.towns[ring]
    : site.kind === 'village'
      ? k.names.villages[ring]
      : k.names.seaward[ring];
}
