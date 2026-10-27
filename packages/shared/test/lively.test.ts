import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  T,
  WAYFARERS_PER_ROAD,
  WORLD_EPOCH_MS,
  setActiveGeneration,
  tileAt,
  wayfarerAt,
  wayfarers,
  wayfarersNear,
  wildFolkNear,
  wildFolkOut,
} from '../src/index';

const SEED = 20260101;
setActiveGeneration(SEED, 6);

describe('road traffic', () => {
  it('every kingdom road has a patrol, a courier and more, walking it by the verge', () => {
    const all = wayfarers(SEED);
    expect(all.length).toBe(24 * WAYFARERS_PER_ROAD);
    const roads = new Set(all.map((w) => w.route.id));
    for (const r of roads) {
      const on = all.filter((w) => w.route.id === r);
      expect(on.some((w) => w.kind === 'patrol')).toBe(true);
      expect(on.some((w) => w.kind === 'courier')).toBe(true);
    }
    const noon = WORLD_EPOCH_MS + DAY_MS / 4;
    let seen = 0,
      walkable = 0;
    for (const w of all.slice(0, 60))
      for (let t = 0; t < 600_000; t += 37_000) {
        const p = wayfarerAt(SEED, w, noon + t);
        // deterministic
        expect(wayfarerAt(SEED, w, noon + t)).toEqual(p);
        if (p.hidden) continue;
        seen++;
        const tile = tileAt(SEED, Math.floor(p.x), Math.floor(p.y), 6);
        if (tile !== T.WATER && tile !== T.DEEP_WATER && tile !== T.WALL) walkable++;
      }
    expect(seen).toBeGreaterThan(100);
    expect(walkable / seen).toBeGreaterThan(0.9);
    // at night only couriers and patrols are out
    const night = WORLD_EPOCH_MS + DAY_MS * 0.7;
    for (const w of all) {
      const p = wayfarerAt(SEED, w, night);
      if (!p.hidden) expect(['courier', 'patrol']).toContain(w.kind);
    }
    const p = wayfarerAt(SEED, all[0]!, noon);
    expect(wayfarersNear(SEED, p.x, p.y, 5, noon).some((q) => q.w.id === all[0]!.id) || p.hidden).toBe(true);
  });
});

describe('wild folk', () => {
  it('people work out in the wilds on open ground, by day', () => {
    const folk = wildFolkNear(SEED, 0, 0, 400);
    expect(folk.length).toBeGreaterThan(20);
    for (const f of folk) {
      const t = tileAt(SEED, Math.floor(f.x), Math.floor(f.y), 6);
      expect(t === T.WATER || t === T.DEEP_WATER).toBe(false);
    }
    expect(new Set(folk.map((f) => f.kind)).size).toBeGreaterThanOrEqual(3);
    const worker = folk.find((f) => f.kind !== 'hermit')!;
    expect(wildFolkOut(worker, 10)).toBe(true);
    expect(wildFolkOut(worker, 23)).toBe(false);
    expect(wildFolkNear(SEED, 0, 0, 400)).toEqual(folk);
  });
});
