import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FORAGE_BY_SEASON, T } from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot, count, give, hasToast, nextDay, setDay, sleep, slotOf, spawn, tp, until, use, flatten, type Probe } from './p2';

let app: App;
let p: Probe;
const X = 100, Y = 100; // player stands on tile (100,100) centre; fixtures go on the tiles right of it

beforeAll(async () => {
  app = await boot();
  p = await spawn(app, 'Gatherer');
  setDay(p.room, 1); // spring, noon
  await tp(p, X + 0.5, Y + 0.5);
  flatten(p.room, X, Y, 8);
});
afterAll(async () => { await app?.close(); });

describe('trees, rocks and ore', () => {
  it('an axe fells a tree in a few swings, drops wood, gives xp, leaves a stump and the tree regrows', async () => {
    p.room.setTile(X + 1, Y, T.TREE);
    const xp0 = p.sp.data.skills.foraging;
    for (let i = 0; i < 3; i++) await use(p, 'axe', X + 1, Y);
    await until(() => p.room.store.getTile(X + 1, Y) === T.STUMP);
    expect(count(p, 'wood')).toBeGreaterThanOrEqual(3);
    expect(p.sp.data.skills.foraging).toBeGreaterThan(xp0);
    expect(p.tiles.some((t) => t.tx === X + 1 && t.ty === Y && t.tile === T.STUMP)).toBe(true);
    expect((p.room as any).respawns.has(`${X + 1},${Y}`)).toBe(true);
    // respawn: a day later the stump has regrown
    p.sp.sim.x = X + 0.5; p.sp.sim.y = Y + 0.5;
    await nextDay(p.room);
    await until(() => p.room.store.getTile(X + 1, Y) === T.TREE, 4000);
  });

  it('the wrong tool or too low a tier does nothing and says why', async () => {
    p.room.setTile(X + 1, Y + 1, T.ORE_IRON);
    const from = p.toasts.length;
    await use(p, 'pickaxe', X + 1, Y + 1); // tier 1
    expect(p.room.store.getTile(X + 1, Y + 1)).toBe(T.ORE_IRON);
    expect(hasToast(p, /Tier 2/, from)).toBe(true);
    const from2 = p.toasts.length;
    await use(p, 'axe', X + 1, Y + 1);
    expect(hasToast(p, /pickaxe/, from2)).toBe(true);
    // a tier-2 pickaxe works
    await give(p, 'pickaxe', 1, { tier: 2 });
    const slot = p.sp.data.inv.findIndex((s) => s?.id === 'pickaxe' && s.p?.tier === 2);
    for (let i = 0; i < 4; i++) { p.r.send('use', { slot, tx: X + 1, ty: Y + 1 }); await sleep(60); }
    await until(() => p.room.store.getTile(X + 1, Y + 1) === T.GRASS);
    expect(count(p, 'iron_ore')).toBeGreaterThanOrEqual(2);
  });

  it('boulders give stone, and a full pack protects the node', async () => {
    p.room.setTile(X, Y + 1, T.ROCK);
    for (let i = 0; i < 3; i++) await use(p, 'pickaxe', X, Y + 1);
    await until(() => p.room.store.getTile(X, Y + 1) === T.GRASS);
    expect(count(p, 'stone')).toBeGreaterThanOrEqual(2);
    // fill every free slot with unique items, then try again
    // nothing the rock could drop may be mergeable, otherwise it would still fit
    for (let i = 0; i < 30; i++) if (['stone', 'coal', 'copper_ore'].includes(p.sp.data.inv[i]?.id ?? '')) p.sp.data.inv[i] = null;
    await give(p, 'ring_hp', 30, { stat: 'hp', val: 1 });
    await until(() => p.sp.data.inv.every(Boolean));
    try {
      p.room.setTile(X, Y - 1, T.ROCK);
      const from = p.toasts.length;
      for (let i = 0; i < 4; i++) await use(p, 'pickaxe', X, Y - 1);
      await sleep(100);
      expect(p.room.store.getTile(X, Y - 1)).toBe(T.ROCK);
      expect(hasToast(p, /pack is full/i, from)).toBe(true);
    } finally {
      for (let i = 0; i < 30; i++) if (p.sp.data.inv[i]?.id === 'ring_hp') p.sp.data.inv[i] = null; // free the slots again
    }
  });
});

describe('forage, bugs, fauna', () => {
  it('forage tiles yield a seasonal item and respawn the next dawn', async () => {
    p.room.setTile(X - 1, Y, T.FORAGE);
    await use(p, 'axe', X - 1, Y);
    await until(() => p.room.store.getTile(X - 1, Y) === T.GRASS);
    const season = p.room.wclock.season();
    const got = p.sp.data.inv.some((s) => s && FORAGE_BY_SEASON[season]!.includes(s.id));
    expect(got).toBe(true);
    await nextDay(p.room);
    await until(() => p.room.store.getTile(X - 1, Y) === T.FORAGE, 4000);
  });

  it('a net catches a bug once per tile per day in season, nothing in deep winter', async () => {
    setDay(p.room, 2, 12);
    p.room.setTile(X - 1, Y - 1, T.FLOWERS);
    p.room.rand = () => 0;
    await use(p, 'net', X - 1, Y - 1);
    expect(count(p, 'butterfly')).toBe(1);
    const from = p.toasts.length;
    await use(p, 'net', X - 1, Y - 1, 150);
    expect(count(p, 'butterfly')).toBe(1);
    expect(hasToast(p, /tomorrow/i, from)).toBe(true);
    setDay(p.room, 21, 12); // winter
    p.room.setTile(X, Y - 2, T.GRASS_TALL);
    const from2 = p.toasts.length;
    await use(p, 'net', X, Y - 2, 150);
    expect(hasToast(p, /Nothing's flying/, from2)).toBe(true);
    p.room.rand = Math.random;
    setDay(p.room, 1);
  });

  it('rabbits flee from players, can be hunted, and every enemy drops loot', async () => {
    // Calm wildlife ignores distant walkers but still flees a close approach.
    const rab = p.room.spawnEnemy('rabbit', X + 2.5, Y + 0.5, false);
    const d0 = Math.hypot(rab.x - p.sp.sim.x, rab.y - p.sp.sim.y);
    await sleep(900);
    expect(Math.hypot(rab.x - p.sp.sim.x, rab.y - p.sp.sim.y)).toBeGreaterThan(d0 + 1);
    expect(rab.state.hp).toBe(rab.maxHp); // it never attacks and never loses hp by itself
    p.room.rand = () => 0;
    const xp0 = p.sp.data.skills.foraging;
    (p.room as any).damageEnemy(rab, 999, p.sp, 1, 0, 0);
    expect(count(p, 'raw_meat')).toBeGreaterThanOrEqual(1);
    expect(p.sp.data.skills.foraging).toBeGreaterThan(xp0);
    const slime = p.room.spawnEnemy('slime', X + 3.5, Y + 3.5, false);
    (p.room as any).damageEnemy(slime, 999, p.sp, 1, 0, 0);
    expect(count(p, 'slime_gel')).toBeGreaterThanOrEqual(1);
    p.room.rand = Math.random;
  });

  it('deer have a sturdier hide and bigger drops', async () => {
    const deer = p.room.spawnEnemy('deer', X + 5.5, Y + 5.5, false);
    expect(deer.maxHp).toBe(36);
    p.room.rand = () => 0;
    (p.room as any).damageEnemy(deer, 999, p.sp, 1, 0, 0);
    expect(count(p, 'hide')).toBeGreaterThanOrEqual(1);
    p.room.rand = Math.random;
    expect(slotOf(p, 'raw_meat')).toBeGreaterThanOrEqual(0);
  });
});
