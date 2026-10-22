import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BIOMES, MSG, RUIN_MONUMENT, biomeAt, ruinObjects, ruinOfCell, ruinObjectsIn, type RuinSite } from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot, hasToast, sleep, spawn, tp, until, type Probe } from './p2';

const SEED = 20260101;
let app: App;
let p: Probe;
beforeAll(async () => { app = await boot(); p = await spawn(app, 'Explorer'); });
afterAll(async () => { await app.close(); });

function firstRuin(): RuinSite {
  for (let r = 1; r < 6; r++) for (let gy = -r; gy <= r; gy++) for (let gx = -r; gx <= r; gx++) {
    const s = ruinOfCell(SEED, gx, gy);
    if (s && ruinObjects(SEED, s).some((o) => o.sub === 'ruin_cache')) return s;
  }
  throw new Error('no ruin found');
}

describe('ruins', () => {
  it('are placed deterministically outside the home vale, styled by their biome, and delivered with their chunk', () => {
    const s = firstRuin();
    expect(Math.hypot(s.x, s.y)).toBeGreaterThan(80);
    expect(BIOMES).toContain(s.biome);
    expect(s.biome).toBe(biomeAt(SEED, s.x, s.y));
    const objs = ruinObjects(SEED, s);
    expect(objs.some((o) => o.sub === RUIN_MONUMENT[s.biome])).toBe(true);
    const cache = objs.find((o) => o.sub === 'ruin_cache')!;
    expect(ruinObjectsIn(SEED, Math.floor(cache.x / 32), Math.floor(cache.y / 32)).some((o) => o.x === cache.x && o.y === cache.y)).toBe(true);
    expect(ruinOfCell(SEED, 0, 0)).toBeNull(); // the home vale has no ruins
  });

  it('a cache gives its loot once per traveller; the monument tells its story', async () => {
    const s = firstRuin();
    const objs = ruinObjects(SEED, s);
    const cache = objs.find((o) => o.sub === 'ruin_cache')!;
    await tp(p, cache.x + 0.5, cache.y + 1.5);
    const before = p.sp.data.inv.reduce((a, x) => a + (x ? x.n : 0), 0);
    const k = p.toasts.length;
    p.r.send(MSG.OPEN, { tx: cache.x, ty: cache.y });
    await until(() => hasToast(p, /forgotten cache/, k));
    expect(p.sp.data.inv.reduce((a, x) => a + (x ? x.n : 0), 0)).toBeGreaterThan(before);
    expect(p.sp.data.prog.ruins).toHaveLength(1);
    p.r.send(MSG.OPEN, { tx: cache.x, ty: cache.y });
    await until(() => hasToast(p, /already searched/, k));
    expect(p.sp.data.prog.ruins).toHaveLength(1);
    const mon = objs.find((o) => o.sub === RUIN_MONUMENT[s.biome]);
    if (mon) {
      const pk = p.panels.length;
      await tp(p, mon.x + 0.5, mon.y + 1.5);
      p.r.send(MSG.OPEN, { tx: mon.x, ty: mon.y });
      await until(() => p.panels.length > pk);
      expect(p.panels[p.panels.length - 1].kind).toBe('lore');
    }
    await sleep(50);
  });
});
