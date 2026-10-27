/**
 * Road traffic (master plan §16/§19): the kingdom roads are never empty. Besides each road's caravan, a handful of
 * wayfarers walk or ride them: pilgrims, mounted couriers, soldier patrols, a shepherd driving a flock, a carter with
 * a handcart, a minstrel, hunters and families on the move. Each walks the road between the capital and the road's
 * far settlement and back at its own pace, keeping to the right-hand verge. Most travel by day; couriers and patrols
 * ride on through the night with a lantern. Positions are a pure function of the seed and world clock, exactly like
 * the caravans, so every client sees the same traveller in the same place and nothing is sent over the network.
 */
import { along, caravanRoutes, type CaravanRoute } from './caravans';
import { hash2 } from './rng';
import { gameHour } from './time';

export type WayfarerKind =
  | 'pilgrim'
  | 'courier'
  | 'patrol'
  | 'shepherd'
  | 'carter'
  | 'minstrel'
  | 'hunter'
  | 'family'
  // a company of the realm's soldiers marching in step behind a mounted officer and the standard
  | 'column'
  // three knights riding together
  | 'knights'
  // a drover with cattle, a goatherd, a swineherd taking pigs to market
  | 'drover'
  | 'goatherd'
  | 'swineherd'
  // brothers of a road shrine walking in file
  | 'monks'
  // villagers pushing a barrow of produce to the market
  | 'market'
  // a noble on horseback with two guards on foot
  | 'noble';
export interface Wayfarer {
  id: string;
  route: CaravanRoute;
  kind: WayfarerKind;
  /** tiles per second */
  speed: number;
  /** seconds into its round trip at world time zero */
  offset: number;
  /** a stable cosmetic index for its people */
  look: number;
  /** how many walk together (patrols three, families three, flocks are sheep) */
  party: number;
}
export interface WayfarerPos {
  w: Wayfarer;
  x: number;
  y: number;
  fx: number;
  fy: number;
  /** inside a settlement's streets, or off the road for the night: not drawn */
  hidden: boolean;
}

const KIND_SPEED: Record<WayfarerKind, number> = {
  pilgrim: 0.9,
  courier: 3.4,
  patrol: 1.25,
  shepherd: 0.55,
  carter: 0.8,
  minstrel: 1,
  hunter: 1.15,
  family: 0.85,
  column: 1.0,
  knights: 1.9,
  drover: 0.6,
  goatherd: 0.65,
  swineherd: 0.5,
  monks: 0.7,
  market: 0.85,
  noble: 1.5,
};
const PARTY: Record<WayfarerKind, number> = {
  pilgrim: 1,
  courier: 1,
  patrol: 3,
  shepherd: 5,
  carter: 1,
  minstrel: 1,
  hunter: 2,
  family: 3,
  column: 10,
  knights: 3,
  drover: 4,
  goatherd: 5,
  swineherd: 3,
  monks: 3,
  market: 2,
  noble: 3,
};
/** who travels after dark (the rest stop at an inn) */
export const NIGHT_RIDERS = new Set<WayfarerKind>(['courier', 'patrol']);
const KINDS: WayfarerKind[] = [
  'pilgrim',
  'courier',
  'patrol',
  'shepherd',
  'carter',
  'minstrel',
  'hunter',
  'family',
  'drover',
  'goatherd',
  'swineherd',
  'monks',
  'market',
  'noble',
  'knights',
];
/** who every road always has, in order: the rest are drawn from everyone */
const FIXED: WayfarerKind[] = ['patrol', 'courier', 'column', 'knights', 'market', 'carter'];
/** travellers per kingdom road */
export const WAYFARERS_PER_ROAD = 13;

const cache = new Map<number, Wayfarer[]>();
export function wayfarers(seed: number): Wayfarer[] {
  let out = cache.get(seed);
  if (out) return out;
  out = [];
  for (const r of caravanRoutes(seed)) {
    if (r.peddler) continue;
    for (let i = 0; i < WAYFARERS_PER_ROAD; i++) {
      const h = (k: number) => hash2(seed, r.len * 7 + i, r.stops.length + r.id.length * 13, 9100 + k);
      // every road has a patrol, a courier, a marching column, knights, market folk and a carter; the rest are drawn
      // from everyone
      const kind = FIXED[i] ?? KINDS[Math.floor(h(1) * KINDS.length)]!;
      const speed = KIND_SPEED[kind] * (0.9 + h(2) * 0.2);
      out.push({
        id: `${r.id}:${i}`,
        route: r,
        kind,
        speed,
        offset: h(3) * ((2 * r.len) / speed),
        look: Math.floor(h(4) * 1e6),
        party: PARTY[kind],
      });
    }
  }
  if (cache.size > 4) cache.clear();
  cache.set(seed, out);
  return out;
}

/** Where a wayfarer is at world time `nowMs`. */
export function wayfarerAt(seed: number, w: Wayfarer, nowMs: number): WayfarerPos {
  const r = w.route;
  const d0 = r.stops[0]!.d,
    span = r.len - d0;
  const trip = (2 * span) / w.speed;
  const t = (((nowMs / 1000 + w.offset) % trip) + trip) % trip;
  const out = t < trip / 2;
  const d = out ? d0 + t * w.speed : r.len - (t - trip / 2) * w.speed;
  const p = along(seed, r, d);
  const dir = (out ? 1 : -1) * r.sign;
  const fx = r.axis === 'ew' ? dir : 0,
    fy = r.axis === 'ns' ? dir : 0;
  // keep to the right of the road (in world space: heading rotated a quarter turn)
  const side = 1.1;
  const x = p.x - fy * side,
    y = p.y + fx * side;
  const inTown = r.stops.some(
    (s) => Math.abs(x - s.site.cx) < s.site.w / 2 + 1 && Math.abs(y - s.site.cy) < s.site.h / 2 + 1,
  );
  const h = gameHour(nowMs);
  const night = h >= 21 || h < 6;
  return { w, x, y, fx, fy, hidden: inTown || (night && !NIGHT_RIDERS.has(w.kind)) };
}

/** Wayfarers within `rad` tiles of (x, y). */
export function wayfarersNear(seed: number, x: number, y: number, rad: number, nowMs: number): WayfarerPos[] {
  const out: WayfarerPos[] = [];
  for (const w of wayfarers(seed)) {
    const r = w.route;
    // the whole road lies along one line: reject a far road before working out where anyone is on it
    const a = along(seed, r, r.stops[0]!.d),
      b = along(seed, r, r.len);
    if (
      x < Math.min(a.x, b.x) - rad - 14 ||
      x > Math.max(a.x, b.x) + rad + 14 ||
      y < Math.min(a.y, b.y) - rad - 14 ||
      y > Math.max(a.y, b.y) + rad + 14
    )
      continue;
    const p = wayfarerAt(seed, w, nowMs);
    if (!p.hidden && Math.hypot(p.x - x, p.y - y) <= rad) out.push(p);
  }
  return out;
}

/** What a passing traveller says to you. */
export const WAYFARER_BARKS: Record<WayfarerKind, string[]> = {
  pilgrim: ['Peace on your road.', 'The shrine is still a long way off.', 'Walk with the light, friend.'],
  courier: ['Make way! Royal post!', 'No time, no time!', 'Letters for the capital!'],
  patrol: ['Keep to the road, traveller.', 'Wolves were seen near the bridge.', 'All quiet. For now.'],
  shepherd: ['Mind the flock!', 'Come by, come by!', 'Good grass past the hill.'],
  carter: ['Heavy load today.', 'One more mile and a mug of ale.', 'Wheel keeps squeaking.'],
  minstrel: ['♪ Oh the road goes ever on… ♪', '♪ A copper for a song? ♪', '♪ Fa la, the sun is high ♪'],
  hunter: ['Tracks went that way.', 'Quiet now, there are deer about.', 'A fine day for the hunt.'],
  family: ['Are we there yet?', 'Off to see Grandmother!', 'Say hello to the traveller, dear.'],
  column: ['Left! Left! Left, right, left!', 'Company, keep in step!', 'Clear the road for the march!', 'Eyes front!'],
  knights: ['Good day, traveller.', 'For the crown!', 'Ride on, brothers.'],
  drover: ['Hup! Hup! Move along there!', 'Cattle fair at the capital.', 'Mind the horns, friend.'],
  goatherd: ['Get down from there, you!', 'Goats eat anything. Watch your pack.'],
  swineherd: ['Sooey! This way, my beauties!', 'Fat pigs fetch good silver.'],
  monks: ['Peace be with you.', 'We walk to the shrine at the pass.', 'Blessings on your road.'],
  market: ['Turnips for the market!', 'Fresh eggs, if you want some.', 'Market day, market day!'],
  noble: ['Stand aside for the Lady.', 'Keep your distance, commoner.', 'A fine day for a ride.'],
};
