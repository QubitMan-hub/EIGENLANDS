import { describe, expect, it } from 'vitest';
import { localFindAt } from '../src/wonders';
import { biomeAt } from '../src/worldgen';
import { biomeWeather, seasonOfDay, weatherForDay } from '../src/weather';
import { CAVE_OY, caveBiomeAt, caveRegion, caveWaystation } from '../src/undercroft';
import { OTHERWORLDS, roomOf } from '../src/otherworlds';
import { objSolid } from '../src/objects';
import { ITEMS } from '../src/items';

describe('local finds', () => {
  it('offers seasonal outdoor finds only when the local weather can explain them', () => {
    let found = 0;
    for (const seed of [17, 99, 20260101])
      for (let day = 0; day < 56; day++) {
        const x = 600,
          y = 600;
        const f = localFindAt(seed, day, x, y, 7);
        if (!f) continue;
        found++;
        const weather = biomeWeather(weatherForDay(seed, day), biomeAt(seed, x, y, 7));
        expect(['rain', 'fog', 'snow']).toContain(weather);
        expect(f.reason.length).toBeGreaterThan(15);
        expect(f.items.every((s) => !!ITEMS[s.id])).toBe(true);
        expect(localFindAt(seed, day, x, y, 7)).toEqual(f);
        if (weather === 'snow') expect(f.title).toContain('Snow');
        else expect(f.id).toContain(`:${seasonOfDay(day)}:`);
      }
    expect(found).toBeGreaterThan(10);
  });
  it('uses cave geology without importing the surface weather', () => {
    const f = localFindAt(17, 1, 200, CAVE_OY + 200, 7)!;
    expect(f.reason).toContain(caveBiomeAt(17, 200, CAVE_OY + 200, 7));
    expect(f.items.every((s) => !!ITEMS[s.id])).toBe(true);
    expect(localFindAt(17, 2, 200, CAVE_OY + 200, 7)?.items).toEqual(f.items);
    expect(localFindAt(17, 1, 0, CAVE_OY, 7)).toBeNull();
  });
  it('leaves cave lifts and puzzle or guardian landmarks clear', () => {
    const lift = caveWaystation(17, 2, 2)!;
    expect(localFindAt(17, 1, lift.x, lift.y, 7)).toBeNull();
    for (let gy = 2; gy < 6; gy++)
      for (let gx = 2; gx < 6; gx++) {
        const r = caveRegion(17, gx, gy, 7);
        if (['arena', 'puzzle', 'secret'].includes(r.feature)) expect(localFindAt(17, 1, r.x, r.y, 7)).toBeNull();
      }
  });
  it('offers room-specific realm finds away from arrivals and rejects empty spaces', () => {
    for (const world of ['aetheria', 'umbra', 'chronoria'] as const) {
      expect(localFindAt(17, 1, 0, OTHERWORLDS[world].oy, 7)).toBeNull();
      let found = false;
      for (let gy = -3; gy <= 3 && !found; gy++)
        for (let gx = -3; gx <= 3 && !found; gx++) {
          const room = roomOf(17, world, gx, gy);
          if (!room || (!gx && !gy)) continue;
          const f = localFindAt(17, 1, room.x, room.y + OTHERWORLDS[world].oy, 7);
          if (f) {
            expect(f.reason).toContain(OTHERWORLDS[world].name);
            expect(f.items.every((s) => !!ITEMS[s.id])).toBe(true);
            found = true;
          }
        }
      expect(found).toBe(true);
      expect(localFindAt(17, 1, 9999, OTHERWORLDS[world].oy, 7)).toBeNull();
    }
  });
  it('keeps glimmers walkable so discoveries cannot block narrow routes', () => {
    expect(objSolid('deco', 'fallen_star')).toBe(false);
  });
  it('keeps old revisions unchanged', () => {
    expect(localFindAt(17, 1, 200, CAVE_OY + 200, 6)).toBeNull();
  });
});
