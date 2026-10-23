import { expect, it } from 'vitest';
import { townsFor, townFor, tileAt, isSolid, objSolid } from '../src';

it('furnished upper floors have reversible, walkable stairs and separate solid boundaries', () => {
  const towns = townsFor(1337), base = townFor(1337);
  const stairs = base.objects.filter(o => o.sub === 'stairs_up');
  expect(stairs.length).toBeGreaterThanOrEqual(2);
  for (const up of stairs) {
    expect(objSolid(up.kind, up.sub)).toBe(false);
    const to = up.data!.to as { x: number; y: number };
    expect(isSolid(tileAt(1337, Math.floor(to.x), Math.floor(to.y)))).toBe(false);
    const upper = towns.find(t => t.buildings.some(b => to.x >= b.x && to.x < b.x + b.w && to.y >= b.y && to.y < b.y + b.h))!;
    const down = upper.objects.find(o => o.sub === 'stairs_down' && o.data?.building === up.data?.building)!;
    expect(down.data!.to).toEqual({ x: up.x + .5, y: up.y + .5 });
    expect(upper.objects.some(o => o.sub === 'bed')).toBe(true);
    expect(isSolid(tileAt(1337, upper.x0, upper.y0))).toBe(true);
  }
});
