/**
 * Settlement layout rules: what every generated town, village and city must keep, checked from its own data — and
 * the pass that enforces them (`clearLayout`, run last in `cozyTown` for every settlement family).
 *
 * - Nothing solid cuts a street: road tiles stay connected to the main street, and no prop stands across a one-tile
 *   lane (a statue on a square is fine; a crate across a lane is not).
 * - A prop's artwork never covers the path to a door (collision is trimmed there, but the art still reads as a block).
 * - Every outside door has a clear step, and the step can be reached on foot from the main street.
 * - No prop is jammed into a one-tile gap between two walls, and a directional prop backed onto a wall faces away
 *   from it.
 * - Street furniture stands by a street (lamps, signposts, notice boards) and a mailbox by a door.
 *
 * The tests (shared/test/settlement-audit.test.ts) run `auditTown` over every settlement family.
 */
import { objFootprint, objSolid, propFacing, propFootprint, type PropFacing } from './objects';
import { T } from './tiles';
import { townTile, type Town, type TownObject } from './town';

export type AuditRule = 'road' | 'door-path' | 'door-step' | 'door-reach' | 'facing' | 'wedged' | 'adrift';
export interface AuditIssue {
  rule: AuditRule;
  town: string;
  x: number;
  y: number;
  sub?: string;
  detail: string;
}

/** street furniture that belongs beside a road or square */
const STREET = new Set(['lamp', 'street_lamp', 'signpost', 'notice_board', 'guild_noticeboard', 'bounty_board']);
/** how far (tiles) street furniture may stand from the nearest road tile, and a mailbox from a door */
const STREET_REACH = 3;
const MAILBOX_REACH = 4;
/** props that may fill a gap between two houses: a line strung across it, a hedge closing it */
const GAP_FILLERS = new Set(['laundry', 'hedge', 'fence', 'gate']);
/** props whose facing does not show (round or symmetric) */
const UNDIRECTED = new Set([
  'barrel',
  'crate',
  'planter',
  'hedge',
  'basket',
  'pumpkins',
  'flower_bed',
  'well',
  'lamp',
  'street_lamp',
  'candles',
  'stool',
  'cooking_pot',
  'cauldron',
  'beehive',
  'plant',
]);

/** architecture drawn as props (city walls, towers, gates, bridges, wall hangings): part of the build, never judged
 * or moved as furniture */
const structural = (t: Town, o: TownObject) => {
  const v = townTile(t, o.x, o.y);
  return (
    v === T.WALL ||
    v === T.FACE ||
    v === T.FENCE ||
    v === T.WATER ||
    v === T.DEEP_WATER ||
    /rampart|tower|gate|bridge|wall|palisade|moat|keep|battlement|pier|dock/.test(o.sub)
  );
};
/** pieces the game relies on (stations, signs and boards, landmarks): they may be moved, never left out */
const essential = (o: TownObject) =>
  o.kind === 'station' ||
  o.kind === 'sign' ||
  /board|waystone|gate|statue|altar|portal|well|fountain|shrine|lift|stairs|guild|bell/.test(o.sub);

const key = (x: number, y: number) => `${x},${y}`;
const N4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const BLOCKING_TILES = new Set<number>([T.WALL, T.FACE, T.FENCE, T.WATER, T.DEEP_WATER, T.TREE, T.ROCK, T.LAVA]);
const isRoad = (tile: number | null) => tile === T.PATH;

/** the ground a town's rules read: its tiles, with open grass outside its own grid */
function ground(t: Town) {
  const tile = (x: number, y: number) => townTile(t, x, y);
  const grid = (x: number, y: number) => tile(x, y) ?? T.GRASS;
  const wall = (x: number, y: number) => {
    const v = tile(x, y);
    return v === T.WALL || v === T.FACE;
  };
  return { tile, grid, wall };
}

function facingOf(o: TownObject, wall: (x: number, y: number) => boolean): PropFacing {
  const f = o.data?.facing;
  return f === 'sw' || f === 'se' ? f : propFacing(wall, o.x, o.y);
}

function scan(t: Town, want: number): boolean {
  for (const v of t.tiles.values()) if (v === want) return true;
  return false;
}

/**
 * The rules a single prop keeps by itself, from the ground around it (no other props): its art off door paths, not
 * across a lane, not jammed between walls, facing out of a wall, and street furniture by the street.
 */
export function propIssues(t: Town, o: TownObject, roads = scan(t, T.PATH), doors = scan(t, T.DOOR)): AuditIssue[] {
  const { tile, grid, wall } = ground(t);
  const out: AuditIssue[] = [];
  if (structural(t, o)) return out;
  const at = (rule: AuditRule, detail: string) => out.push({ rule, town: t.name, x: o.x, y: o.y, sub: o.sub, detail });
  const near = (r: number, hit: (x: number, y: number) => boolean) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (hit(o.x + dx, o.y + dy)) return true;
    return false;
  };
  const { x, y } = o;
  const indoors = tile(x, y) === T.FLOOR;
  if (objSolid(o.kind as never, o.sub)) {
    // art over a door path: footprint tiles the game trims because they sit in a doorway's approach
    const kept = new Set(propFootprint(o.sub, x, y, grid).map(([fx, fy]) => key(fx, fy)));
    if (objFootprint(o.sub, x, y, facingOf(o, wall)).some(([fx, fy]) => !kept.has(key(fx, fy)) && isRoad(tile(fx, fy))))
      at('door-path', `${o.sub} art covers a door path`);
    // across a lane: road on both sides along one axis, the lane only one tile wide there
    if (
      isRoad(tile(x, y)) &&
      ((isRoad(tile(x - 1, y)) && isRoad(tile(x + 1, y)) && !isRoad(tile(x, y - 1)) && !isRoad(tile(x, y + 1))) ||
        (isRoad(tile(x, y - 1)) && isRoad(tile(x, y + 1)) && !isRoad(tile(x - 1, y)) && !isRoad(tile(x + 1, y))))
    )
      at('road', `${o.sub} stands across a lane`);
    if (
      !indoors &&
      !GAP_FILLERS.has(o.sub) &&
      ((wall(x - 1, y) && wall(x + 1, y)) || (wall(x, y - 1) && wall(x, y + 1)))
    )
      at('wedged', `${o.sub} is jammed between two walls`);
    if (!UNDIRECTED.has(o.sub) && !GAP_FILLERS.has(o.sub) && (wall(x, y - 1) || wall(x - 1, y))) {
      const f = facingOf(o, wall);
      const [fx, fy] = f === 'sw' ? [x, y + 1] : [x + 1, y];
      if (wall(fx, fy)) at('facing', `${o.sub} faces into a wall`);
    }
  }
  if (!indoors) {
    if (roads && STREET.has(o.sub) && !near(STREET_REACH, (nx, ny) => isRoad(tile(nx, ny))))
      at('adrift', `${o.sub} is far from any road`);
    if (doors && o.sub === 'mailbox' && !near(MAILBOX_REACH, (nx, ny) => tile(nx, ny) === T.DOOR))
      at('adrift', 'mailbox is far from any door');
  }
  return out;
}

/** every tile the props make solid in the game: their own tiles and footprints, trimmed near doorways */
function solidMap(t: Town): Map<string, TownObject> {
  const { grid } = ground(t);
  const solid = new Map<string, TownObject>();
  for (const o of t.objects)
    if (objSolid(o.kind as never, o.sub))
      for (const [x, y] of [[o.x, o.y] as [number, number], ...propFootprint(o.sub, o.x, o.y, grid)])
        solid.set(key(x, y), o);
  return solid;
}

/** flood fill from `start` over tiles `ok` accepts, within the town grid padded by `pad` */
function flood(t: Town, start: Array<[number, number]>, ok: (x: number, y: number) => boolean, pad = 0): Set<string> {
  const seen = new Set<string>();
  const q: Array<[number, number]> = [];
  for (const s of start)
    if (ok(...s) && !seen.has(key(...s))) {
      seen.add(key(...s));
      q.push(s);
    }
  while (q.length) {
    const [x, y] = q.pop()!;
    for (const [dx, dy] of N4) {
      const nx = x + dx,
        ny = y + dy;
      if (nx < t.x0 - pad || ny < t.y0 - pad || nx > t.x1 + pad || ny > t.y1 + pad) continue;
      const k = key(nx, ny);
      if (seen.has(k) || !ok(nx, ny)) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return seen;
}

/** the main street: the road tile nearest the settlement's centre */
function mainStreet(t: Town): [number, number] | null {
  let best: [number, number] | null = null,
    d = Infinity;
  for (let y = t.y0; y <= t.y1; y++)
    for (let x = t.x0; x <= t.x1; x++)
      if (isRoad(townTile(t, x, y))) {
        const e = Math.hypot(x - t.cx, y - t.cy);
        if (e < d) {
          d = e;
          best = [x, y];
        }
      }
  return best;
}

/** how many road tiles the props cut off from the main street (0 on a healthy layout) */
function stranded(t: Town): number {
  const main = mainStreet(t);
  if (!main) return 0;
  const { tile } = ground(t);
  const solid = solidMap(t);
  const bare = flood(t, [main], (x, y) => isRoad(tile(x, y)));
  const fromMain = flood(t, [main], (x, y) => isRoad(tile(x, y)) && !solid.has(key(x, y)));
  let n = 0;
  for (const k of bare) if (!solid.has(k) && !fromMain.has(k)) n++;
  return n;
}

/** Rules that need the whole settlement: streets left connected, doors with a clear, reachable step. */
function townIssues(t: Town): AuditIssue[] {
  const out: AuditIssue[] = [];
  const { tile } = ground(t);
  const solid = solidMap(t);
  const open = (x: number, y: number) => {
    if (solid.has(key(x, y))) return false;
    const v = tile(x, y);
    return v === null || !BLOCKING_TILES.has(v);
  };
  const main = mainStreet(t);
  if (main) {
    const bare = flood(t, [main], (x, y) => isRoad(tile(x, y)));
    const fromMain = flood(t, [main], (x, y) => isRoad(tile(x, y)) && !solid.has(key(x, y)));
    const culprits = new Map<string, TownObject>();
    for (const k of bare) {
      if (solid.has(k) || fromMain.has(k)) continue;
      const [x, y] = k.split(',').map(Number) as [number, number];
      for (const [dx, dy] of N4) {
        const o = solid.get(key(x + dx, y + dy));
        if (o && isRoad(tile(x + dx, y + dy))) culprits.set(key(o.x, o.y), o);
      }
    }
    for (const o of culprits.values())
      out.push({
        rule: 'road',
        town: t.name,
        x: o.x,
        y: o.y,
        sub: o.sub,
        detail: `${o.sub} cuts off part of a street`,
      });
  }
  const reach = main ? flood(t, [main], open, 6) : new Set<string>();
  for (let y = t.y0; y <= t.y1; y++)
    for (let x = t.x0; x <= t.x1; x++) {
      if (tile(x, y) !== T.DOOR) continue;
      const steps = N4.map(([dx, dy]) => [x + dx, y + dy] as [number, number]).filter(([sx, sy]) => {
        const v = tile(sx, sy);
        return v !== T.FLOOR && v !== T.WALL && v !== T.FACE && v !== T.DOOR;
      });
      if (!steps.length) continue; // an inner doorway between rooms
      const kind =
        t.buildings.find((b) => x >= b.x - 1 && y >= b.y - 1 && x <= b.x + b.w && y <= b.y + b.h)?.kind ?? 'building';
      if (!steps.some(([sx, sy]) => open(sx, sy))) {
        const by = steps.map(([sx, sy]) => solid.get(key(sx, sy))).find(Boolean);
        out.push({
          rule: 'door-step',
          town: t.name,
          x: by?.x ?? x,
          y: by?.y ?? y,
          sub: by?.sub ?? kind,
          detail: `${kind} door step blocked${by ? ` by ${by.sub}` : ''}`,
        });
      } else if (main && !steps.some(([sx, sy]) => reach.has(key(sx, sy))))
        out.push({
          rule: 'door-reach',
          town: t.name,
          x,
          y,
          sub: kind,
          detail: `${kind} door cannot be reached from the main street`,
        });
    }
  return out;
}

export function auditTown(t: Town): AuditIssue[] {
  const roads = scan(t, T.PATH),
    doors = scan(t, T.DOOR);
  return [...t.objects.flatMap((o) => propIssues(t, o, roads, doors)), ...townIssues(t)];
}

/**
 * Enforce the rules on a generated settlement: a prop that breaks one moves to the nearest tile (within three steps,
 * same indoors/outdoors, off the roads and door approaches) where it keeps them all, or is left out; then any prop
 * still cutting a street or blocking a door step is left out. Deterministic: the same town gives the same result.
 */
export function clearLayout(t: Town): Town {
  const { tile } = ground(t);
  const roads = scan(t, T.PATH),
    doors = scan(t, T.DOOR);
  const taken = new Set(t.objects.map((o) => key(o.x, o.y)));
  const doorNear = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (tile(x + dx, y + dy) === T.DOOR) return true;
    return false;
  };
  const offsets: Array<[number, number]> = [];
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx || dy) offsets.push([dx, dy]);
  offsets.sort(
    (a, b) => Math.abs(a[0]) + Math.abs(a[1]) - (Math.abs(b[0]) + Math.abs(b[1])) || a[1] - b[1] || a[0] - b[0],
  );
  /** move `o` to the nearest tile where it keeps every rule, adds no cut street and keeps its footprint clear */
  const relocate = (o: TownObject, maxCut: number): boolean => {
    const indoors = tile(o.x, o.y) === T.FLOOR;
    const ox = o.x,
      oy = o.y,
      facing = o.data?.facing;
    taken.delete(key(ox, oy));
    for (const [dx, dy] of offsets) {
      const x = ox + dx,
        y = oy + dy;
      const v = tile(x, y);
      if (taken.has(key(x, y)) || (v !== null && BLOCKING_TILES.has(v)) || v === T.DOOR || isRoad(v)) continue;
      if ((v === T.FLOOR) !== indoors || doorNear(x, y)) continue;
      o.x = x;
      o.y = y;
      if (o.data && 'facing' in o.data) delete o.data.facing;
      const foot = objFootprint(o.sub, x, y, facingOf(o, ground(t).wall));
      if (foot.some(([fx, fy]) => isRoad(tile(fx, fy)) || doorNear(fx, fy) || taken.has(key(fx, fy)))) continue;
      if (!propIssues(t, o, roads, doors).length && stranded(t) <= maxCut) {
        taken.add(key(x, y));
        return true;
      }
    }
    o.x = ox;
    o.y = oy;
    if (facing !== undefined) (o.data ??= {}).facing = facing;
    taken.add(key(ox, oy));
    return false;
  };
  const dropped = new Set<TownObject>();
  const cut0 = stranded(t);
  for (const o of t.objects)
    if (propIssues(t, o, roads, doors).length && !relocate(o, cut0) && !essential(o)) dropped.add(o);
  t.objects = t.objects.filter((o) => !dropped.has(o));
  // a street the generator itself cut: a prop whose absence reconnects it moves off the road (or, if it is not one
  // the game relies on and has nowhere to go, is left out)
  let cut = stranded(t);
  for (const o of [...t.objects]) {
    if (!cut) break;
    if (structural(t, o) || !objSolid(o.kind as never, o.sub) || !isRoad(tile(o.x, o.y))) continue;
    const i = t.objects.indexOf(o);
    t.objects.splice(i, 1);
    const without = stranded(t);
    t.objects.splice(i, 0, o);
    if (without >= cut) continue;
    if (relocate(o, without)) cut = stranded(t);
    else if (!essential(o)) {
      t.objects.splice(t.objects.indexOf(o), 1);
      cut = without;
    }
  }
  return t;
}
