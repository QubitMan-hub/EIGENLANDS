import { expect, it } from 'vitest';
import { townsFor, cozyTown, T, frontierSite, frontierTown, REALM_IDS, type Town } from '../src';
const dirs = [
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 0],
];
it('puts chairs at real surfaces and street lights away from front doors across all settlement families', () => {
  const towns = townsFor(20260101, 6);
  expect(towns.length).toBeGreaterThan(70);
  for (const t of towns) {
    const before = JSON.stringify(t.objects);
    cozyTown(t);
    expect(JSON.stringify(t.objects), t.name + ' idempotence').toBe(before);
    const lights = t.objects.filter((o) => o.sub === 'street_lamp');
    for (let i = 0; i < lights.length; i++)
      for (let j = i + 1; j < lights.length; j++)
        expect(
          Math.hypot(lights[i]!.x - lights[j]!.x, lights[i]!.y - lights[j]!.y),
          t.name + ' lamp spacing',
        ).toBeGreaterThanOrEqual(8);
    for (const o of t.objects) {
      if (o.sub === 'chair') {
        expect(o.data?.seatTurn, t.name + ' oriented chair').toBeDefined();
        const [dx, dy] = dirs[Number(o.data?.seatTurn)]!;
        expect(
          t.objects.some((a) => a.x === o.x + dx! && a.y === o.y + dy!),
          t.name + ' chair faces furnishing',
        ).toBe(true);
      }
      if (['street_lamp', 'chair', 'bench'].includes(o.sub))
        expect(
          t.buildings.some((b) => Math.abs(o.x - b.doorX) <= 1 && o.y >= b.doorY - 1 && o.y <= b.doorY + 4),
          t.name + ' clear entrance',
        ).toBe(false);
    }
  }
});
it('is deterministic, retains functional furniture and fixes orphan seats without adding clutter', () => {
  const t: Town = {
    name: 'Fixture',
    cx: 5,
    cy: 5,
    x0: 0,
    y0: 0,
    x1: 12,
    y1: 12,
    buildings: [],
    spots: { work: { x: 5, y: 5 } },
    tiles: new Map(),
    objects: [
      { x: 4, y: 4, kind: 'deco', sub: 'table' },
      { x: 1, y: 1, kind: 'deco', sub: 'chair' },
      { x: 6, y: 6, kind: 'station', sub: 'forge' },
      { x: 2, y: 2, kind: 'deco', sub: 'street_lamp' },
      { x: 3, y: 2, kind: 'deco', sub: 'street_lamp' },
    ],
  };
  for (let x = 0; x < 13; x++) t.tiles.set(x + 3 * 13, T.PATH);
  const clone = structuredClone(t);
  cozyTown(t);
  cozyTown(clone);
  expect(t.objects).toEqual(clone.objects);
  expect(t.objects.some((o) => o.sub === 'forge')).toBe(true);
  expect(t.objects.filter((o) => o.sub === 'chair')).toHaveLength(1);
  expect(t.objects.length).toBeLessThanOrEqual(5);
});
