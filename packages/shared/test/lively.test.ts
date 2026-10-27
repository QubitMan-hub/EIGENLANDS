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
      // soldiers march every road, knights ride it, and villagers take produce to market
      expect(on.some((w) => w.kind === 'column' && w.party >= 8)).toBe(true);
      expect(on.some((w) => w.kind === 'knights')).toBe(true);
      expect(on.some((w) => w.kind === 'market')).toBe(true);
    }
    // the open road is busy: drovers, herds, monks and nobles turn up across the kingdoms
    const kinds = new Set(all.map((w) => w.kind));
    for (const k of ['drover', 'goatherd', 'swineherd', 'monks', 'noble', 'shepherd', 'pilgrim'])
      expect(kinds.has(k as never), k).toBe(true);
    // a marching column keeps a soldier's pace, knights ride faster, herds dawdle
    const pace = (k: string) => all.find((w) => w.kind === k)!.speed;
    expect(pace('knights')).toBeGreaterThan(pace('column'));
    expect(pace('column')).toBeGreaterThan(pace('swineherd'));
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

describe('nutrition', () => {
  it('sorts dishes into produce, protein and hearty, and three groups make a balanced diet', async () => {
    const { foodGroup, recordMeal, balanced } = await import('../src/index');
    expect(foodGroup('veggie_stew', 'food')).toBe('hearty');
    expect(foodGroup('fish_fry', 'food')).toBe('protein');
    expect(foodGroup('omelet', 'food')).toBe('protein');
    expect(foodGroup('berry_jam', 'food')).toBe('produce');
    expect(foodGroup('carp', 'fish')).toBe('protein');
    expect(foodGroup('pickaxe', 'tool')).toBeNull();
    let m = recordMeal([], 'produce', 0);
    m = recordMeal(m, 'protein', 1000);
    expect(balanced(m)).toBe(false);
    expect(balanced(recordMeal(m, 'hearty', 2000))).toBe(true);
    // too long ago does not count
    expect(balanced(recordMeal(m, 'hearty', 3_600_000))).toBe(false);
  });
});

describe('weapon families', () => {
  it('twin daggers are the quickest and shortest, the greatsword the longest and slowest, and both come in every metal', async () => {
    const { MELEE_COMBOS, meleeHeavy, WEAPONS, ITEMS, RECIPES } = await import('../src/index');
    const recovery = (f: keyof typeof MELEE_COMBOS) => MELEE_COMBOS[f].reduce((a, h) => a + h.recovery, 0);
    const reach = (f: keyof typeof MELEE_COMBOS) => Math.max(...MELEE_COMBOS[f].map((h) => h.range));
    for (const f of ['sword', 'spear', 'battle_axe', 'warhammer'] as const) {
      expect(recovery('dagger')).toBeLessThan(recovery(f));
      expect(reach('greatsword')).toBeGreaterThan(reach('battle_axe'));
    }
    expect(meleeHeavy('dagger', 1).lunge).toBeGreaterThan(meleeHeavy('sword', 1).lunge);
    expect(meleeHeavy('greatsword', 1).arc).toBeLessThan(meleeHeavy('battle_axe', 1).arc); // a wider sweep
    for (const id of ['dagger', 'greatsword', 'dagger_steel', 'greatsword_mithril']) {
      expect(WEAPONS[id], id).toBeTruthy();
      expect(ITEMS[id]?.kind).toBe('weapon');
      expect(
        RECIPES.some((r) => r.out.id === id),
        id,
      ).toBe(true);
    }
    expect(meleeHeavy('dagger_steel', 0)).toEqual(meleeHeavy('dagger', 0));
  });
});
