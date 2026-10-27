import type { Building, Town, TownObject } from './town';
import { isUpperY, townStairTile } from './floors';
import { T } from './tiles';
import { objSolid, propFootprint } from './objects';

/** Choose an existing civic footprint; capitals use their spare hall, never the palace. */
export function guildHall(t: Town): Building | undefined {
  if (t.abandoned || isUpperY(t.cy)) return;
  return (
    t.buildings.find((b) => b.guild) ??
    t.buildings
      .filter((b) => b.kind === 'hall' && !/palace|keep/.test(b.id))
      .sort((a, b) => a.w * a.h - b.w * b.h)[0] ??
    t.buildings.find((b) => b.kind === 'inn') ??
    t.buildings.find((b) => b.kind === 'hall')
  );
}

/** Dress generated halls only. Footprints, terrain, NPC schedules and saved edits are unchanged. */
export function furnishGuildHall(t: Town): void {
  const b = guildHall(t);
  if (!b || b.guild || /palace|keep/.test(b.id)) return;
  b.guild = true;
  // An inn remains a shared annex; never evict its kitchen, guests or existing stations.
  if (b.kind !== 'hall') return;
  const contains = (x: number, y: number) => x > b.x && x < b.x + b.w - 1 && y > b.y && y < b.y + b.h - 1;
  t.objects = t.objects.filter((o) => !contains(o.x, o.y) || o.sub.startsWith('stairs_'));
  const tile = (x: number, y: number) => t.tiles.get(x - t.x0 + (y - t.y0) * (t.x1 - t.x0 + 1)) ?? T.GRASS;
  const used = new Set<string>(),
    stair = townStairTile(b);
  const reserved = (x: number, y: number) =>
    !contains(x, y) ||
    tile(x, y) !== T.FLOOR ||
    (Math.abs(x - b.doorX) <= 1 && y >= b.doorY - 2) ||
    (x >= stair.x - 1 && y <= stair.y + 1) ||
    // Reserve the rear-left registration board and its standing space.
    (x <= b.x + 2 && y <= b.y + 2) ||
    Object.values(t.spots).some((s) => s.x === x && s.y === y);
  const add = (x: number, y: number, sub: string, kind: TownObject['kind'] = 'deco') => {
    const cells = [[x, y], ...(objSolid(kind, sub) ? propFootprint(sub, x, y, tile) : [])];
    if (cells.some(([x, y]) => reserved(x!, y!) || used.has(`${x},${y}`))) return;
    for (const [x, y] of cells) used.add(`${x},${y}`);
    t.objects.push({ x, y, kind, sub });
  };
  for (const o of t.objects.filter((o) => contains(o.x, o.y))) used.add(`${o.x},${o.y}`);
  const left = b.x + 1,
    right = b.x + b.w - 2,
    rear = b.y + 1,
    front = b.y + b.h - 2;
  // Storage and a shared workbench on the rear wall, separated by a clear reception aisle.
  add(left + 3, rear, 'bookcase');
  add(left + 5, rear, 'workbench', 'station');
  add(left + 7, rear, 'shelf');
  // A real recovery bed along the west wall, with a lamp at its head.
  add(left, rear + 3, 'bed');
  add(left, front, 'candles');
  add(right, front, 'plant');
  // Briefing tables have opposed seats and clear routes around every group.
  if (b.w >= 9 && b.h >= 6) {
    for (const x of [left + 1, right - 1]) {
      add(x, rear + 2, 'table');
      add(x - 1, rear + 2, 'chair');
      add(x + 1, rear + 2, 'chair');
    }
  }

  // Warm recovery corner without another solid prop in the entrance lane.
  add(right, front - 2, 'hearth');
}
