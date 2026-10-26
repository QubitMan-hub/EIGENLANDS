import type { Town, TownObject, Building } from './town';
import { T, isSolid } from './tiles';
import { propFootprint, objSolid } from './objects';
const DIRS = [
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 0],
] as const;
export const diningSurface = (sub: string): boolean => /(^|_)(table|desk|counter)(_|$)/.test(sub);
const readingSurface = (sub: string) =>
  diningSurface(sub) || ['bookshelf', 'bookcase', 'piano', 'fireplace', 'hearth'].includes(sub);
const portable = new Set([
  'chair',
  'stool',
  'bench',
  'barrel',
  'crate',
  'basket',
  'planter',
  'plant',
  'flower_pot',
  'street_lamp',
]);
const key = (x: number, y: number) => `${x},${y}`;
const contains = (b: Building, x: number, y: number) => x > b.x && y > b.y && x < b.x + b.w - 1 && y < b.y + b.h - 1;
/** Final, deterministic dressing pass over generated furnishing only. No terrain sampling, player edits or random fill. */
export function cozyTown(t: Town): Town {
  const w = t.x1 - t.x0 + 1,
    tile = (x: number, y: number) => t.tiles.get(x - t.x0 + (y - t.y0) * w) ?? T.GRASS;
  const at = new Map(t.objects.map((o) => [key(o.x, o.y), o])),
    removed = new Set<TownObject>(),
    lamps: TownObject[] = [];
  const blocked = new Set<string>();
  for (const o of t.objects)
    if (objSolid(o.kind, o.sub)) for (const [x, y] of propFootprint(o.sub, o.x, o.y, tile)) blocked.add(key(x, y));
  const home = (o: { x: number; y: number }) => t.buildings.find((b) => contains(b, o.x, o.y));
  const approach = (x: number, y: number) =>
    t.buildings.some((b) => Math.abs(x - b.doorX) <= 1 && y >= b.doorY - 1 && y <= b.doorY + 4);
  const spot = (x: number, y: number) => Object.values(t.spots).some((p) => p.x === x && p.y === y);
  const free = (x: number, y: number) =>
    x > t.x0 &&
    x < t.x1 &&
    y > t.y0 &&
    y < t.y1 &&
    !isSolid(tile(x, y)) &&
    ![T.WATER, T.DEEP_WATER, T.LAVA].includes(tile(x, y) as typeof T.WATER) &&
    !at.has(key(x, y)) &&
    !blocked.has(key(x, y)) &&
    !approach(x, y) &&
    !spot(x, y);
  const drop = (o: TownObject) => {
    removed.add(o);
    at.delete(key(o.x, o.y));
  };
  // A front door is a route, never a display shelf. Leave functional and landmark objects alone.
  for (const o of t.objects) if (portable.has(o.sub) && approach(o.x, o.y)) drop(o);
  const surfaces = t.objects.filter((o) => readingSurface(o.sub) && !removed.has(o));
  for (const o of t.objects) {
    if (removed.has(o) || o.sub !== 'chair') continue;
    let target = DIRS.map(([dx, dy], turn) => ({ o: at.get(key(o.x + dx, o.y + dy)), turn })).find(
      (p) => p.o && readingSurface(p.o.sub),
    );
    if (!target) {
      const room = home(o),
        tables = surfaces
          .filter((p) => home(p) === room && diningSurface(p.sub) && Math.hypot(p.x - o.x, p.y - o.y) <= 6)
          .sort((a, b) => Math.hypot(a.x - o.x, a.y - o.y) - Math.hypot(b.x - o.x, b.y - o.y));
      for (const table of tables) {
        for (let turn = 0; turn < 4; turn++) {
          const [dx, dy] = DIRS[turn]!,
            x = table.x - dx,
            y = table.y - dy;
          if (!free(x, y) || (room ? !contains(room, x, y) : !!home({ x, y }))) continue;
          at.delete(key(o.x, o.y));
          o.x = x;
          o.y = y;
          at.set(key(x, y), o);
          target = { o: table, turn };
          break;
        }
        if (target) break;
      }
    }
    if (target) (o.data ??= {}).seatTurn = target.turn;
    else drop(o);
  }
  const offsets: Array<[number, number]> = [];
  for (let dy = -4; dy <= 4; dy++)
    for (let dx = -4; dx <= 4; dx++) if (Math.abs(dx) + Math.abs(dy) <= 4) offsets.push([dx, dy]);
  offsets.sort((a, b) => Math.abs(a[0]) + Math.abs(a[1]) - Math.abs(b[0]) - Math.abs(b[1]));
  const road = (x: number, y: number) => tile(x, y) === T.PATH;
  for (const o of t.objects) {
    if (removed.has(o) || o.sub !== 'bench' || home(o)) continue;
    at.delete(key(o.x, o.y));
    const context = (x: number, y: number) =>
      t.objects.some(
        (a) =>
          a !== o &&
          !removed.has(a) &&
          /fountain|well|planter|flower|stall|plant/.test(a.sub) &&
          Math.hypot(a.x - x, a.y - y) <= 4,
      ) || DIRS.some(([dx, dy]) => [T.FLOWERS, T.TREE].includes(tile(x + dx, y + dy) as typeof T.FLOWERS));
    const candidate = offsets
      .map(([dx, dy]) => ({ x: o.x + dx, y: o.y + dy }))
      .find(
        (p) =>
          free(p.x, p.y) &&
          !home(p) &&
          context(p.x, p.y) &&
          DIRS.some(([dx, dy]) => road(p.x + dx, p.y + dy)) &&
          DIRS.some(([dx, dy]) => !road(p.x + dx, p.y + dy)),
      );
    if (!candidate) {
      removed.add(o);
      continue;
    }
    o.x = candidate.x;
    o.y = candidate.y;
    const focus = surfaces.find((a) => Math.hypot(a.x - o.x, a.y - o.y) < 4) ?? { x: t.cx, y: t.cy };
    const dx = focus.x - o.x,
      dy = focus.y - o.y;
    (o.data ??= {}).facing = Math.abs(dx) > Math.abs(dy) ? 'se' : 'sw';
    at.set(key(o.x, o.y), o);
  }

  for (const o of t.objects) {
    if (removed.has(o) || o.sub !== 'street_lamp') continue;
    at.delete(key(o.x, o.y));
    const candidate = offsets
      .map(([dx, dy]) => ({ x: o.x + dx, y: o.y + dy }))
      .find((p) => {
        if (
          !free(p.x, p.y) ||
          home(p) ||
          t.buildings.some((b) => p.x >= b.x - 1 && p.x <= b.x + b.w && p.y >= b.y - 1 && p.y <= b.y + b.h) ||
          lamps.some((l) => Math.hypot(l.x - p.x, l.y - p.y) < 8)
        )
          return false;
        const neighbours = DIRS.map(([dx, dy]) => road(p.x + dx, p.y + dy));
        return neighbours.some(Boolean) && (!road(p.x, p.y) || neighbours.some((v) => !v));
      });
    if (!candidate) {
      removed.add(o);
      continue;
    }
    o.x = candidate.x;
    o.y = candidate.y;
    lamps.push(o);
    at.set(key(o.x, o.y), o);
  }
  t.objects = t.objects.filter((o) => !removed.has(o));
  return t;
}
