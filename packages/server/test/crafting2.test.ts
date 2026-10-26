import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MSG, discLevel, recipeById, xpForDiscLevel } from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot, count, flatten, give, hasToast, setDay, sleep, slotOf, spawn, tp, until, use, type Probe } from './p2';

let app: App;
let p: Probe;
const X = 320,
  Y = 320;

beforeAll(async () => {
  app = await boot();
  p = await spawn(app, 'Artisan');
  p.room.rand = () => 0.99; // exact-cost fixtures exclude the random ingredient-saving bonus
  setDay(p.room, 1, 12);
  await tp(p, X + 4.5, Y + 0.5);
  flatten(p.room, X, Y, 8);
  // one of every bench within reach
  for (const [i, sub] of ['masonry', 'forge', 'jeweler', 'enchanting', 'tannery', 'oven', 'cooking_pot'].entries())
    p.room.objects.put({ x: X + 1 + i, y: Y, kind: 'station', sub, owner: p.accountId });
});
afterAll(async () => {
  await app?.close();
});
const at = (sub: string) =>
  ['masonry', 'forge', 'jeweler', 'enchanting', 'tannery', 'oven', 'cooking_pot'].indexOf(sub) + 1;
const craft = async (station: string, recipe: string, n = 1) => {
  p.r.send(MSG.CRAFT, { station, recipe, n, tx: X + at(station), ty: Y });
  await sleep(120);
};
const gear = async (action: string, ref: unknown, station: string, rune?: number) => {
  p.r.send(MSG.GEAR, { action, ref, station, tx: X + at(station), ty: Y, ...(rune !== undefined ? { rune } : {}) });
  await sleep(120);
};

describe('crafting v2', () => {
  it('a craft tool in the pack is required, and discipline xp is earned', async () => {
    await give(p, 'stone', 12);
    const from = p.toasts.length;
    await craft('masonry', 'stone_brick');
    expect(count(p, 'stone_brick')).toBe(0);
    expect(hasToast(p, /chisel/i, from)).toBe(true);
    await give(p, 'chisel', 1);
    const xp0 = p.sp.data.disc.masonry;
    await craft('masonry', 'stone_brick', 2);
    expect(count(p, 'stone_brick')).toBe(4);
    expect(p.sp.data.disc.masonry).toBeGreaterThan(xp0);
  });

  it('recipes that need a higher level are refused until the discipline reaches it', async () => {
    const rec = recipeById('armor_steel_chest')!;
    expect(rec.lvl).toBeGreaterThan(5);
    await give(p, 'steel_plate', 4);
    await give(p, 'leather', 2);
    await give(p, 'tongs', 1);
    const from = p.toasts.length;
    await craft('forge', 'armor_steel_chest');
    expect(count(p, 'armor_steel_chest')).toBe(0);
    expect(hasToast(p, /haven't learned|Needs/i, from)).toBe(true);
    // rise to the level: a levelled recipe is now known and crafts, with a quality and a full durability bar
    p.sp.data.disc.smithing = xpForDiscLevel(rec.lvl);
    expect(discLevel(p.sp.data.disc.smithing)).toBeGreaterThanOrEqual(rec.lvl);
    await craft('forge', 'armor_steel_chest');
    const made = p.sp.data.inv.find((s) => s?.id === 'armor_steel_chest');
    expect(made).toBeTruthy();
    expect(made!.p?.qt).toBeGreaterThanOrEqual(0);
    expect(made!.p?.maxDur).toBeGreaterThan(100);
    expect(made!.p?.dur).toBe(made!.p?.maxDur);
  });

  it('worn gear can be repaired and upgraded at its bench, paying a share of its materials', async () => {
    const id = 'armor_steel_chest';
    const slot = slotOf(p, id);
    const piece = p.sp.data.inv[slot]!;
    piece.p = { ...piece.p, dur: 10 };
    await give(p, 'steel_plate', 8);
    await give(p, 'leather', 4);
    const plates = count(p, 'steel_plate');
    await gear('repair', { where: 'inv', slot }, 'forge');
    expect(p.sp.data.inv[slot]!.p?.dur).toBe(p.sp.data.inv[slot]!.p?.maxDur);
    expect(count(p, 'steel_plate')).toBeLessThan(plates);
    const max0 = p.sp.data.inv[slot]!.p!.maxDur!;
    p.sp.data.disc.smithing = xpForDiscLevel(30);
    await gear('upgrade', { where: 'inv', slot }, 'forge');
    expect(p.sp.data.inv[slot]!.p?.up).toBe(1);
    expect(p.sp.data.inv[slot]!.p!.maxDur!).toBeGreaterThan(max0);
  });

  it('wearing broken gear gives nothing; enchanting binds a rune for its bonus', async () => {
    await give(p, 'wood_shield', 1, { qt: 1, maxDur: 100, dur: 100 });
    const slot = slotOf(p, 'wood_shield');
    p.r.send(MSG.EQUIP, { slot, as: 'shield' });
    await until(() => !!p.sp.data.equip.shield);
    const def0 = p.sp.stats.def;
    expect(def0).toBeGreaterThan(0);
    p.sp.data.equip.shield!.p = { ...p.sp.data.equip.shield!.p, dur: 0 };
    p.sp.dirty('equip');
    expect(p.sp.stats.def).toBeLessThan(def0);
    p.sp.data.equip.shield!.p = { ...p.sp.data.equip.shield!.p, dur: 100 };
    p.sp.dirty('equip');
    expect(p.sp.stats.def).toBe(def0);
    // a rune of vitality (any gear)
    p.sp.data.disc.enchanting = xpForDiscLevel(10);
    await give(p, 'rune_vitality', 1);
    const hp0 = p.sp.stats.hpBonus;
    await gear('enchant', { where: 'equip', slot: 'shield' }, 'enchanting', slotOf(p, 'rune_vitality'));
    expect(p.sp.data.equip.shield!.p?.ench).toBe('vitality');
    expect(count(p, 'rune_vitality')).toBe(0);
    expect(p.sp.stats.hpBonus).toBeGreaterThan(hp0);
  });

  it('a recipe scroll teaches its recipe once and is used up', async () => {
    await give(p, 'scroll_stormpiercer', 1);
    expect(p.sp.data.recipes.has('stormpiercer')).toBe(false);
    await use(p, 'scroll_stormpiercer', X, Y);
    await until(() => p.sp.data.recipes.has('stormpiercer'));
    expect(count(p, 'scroll_stormpiercer')).toBe(0);
  });

  it('food gives its buff and the stat shows up in the derived stats', async () => {
    await give(p, 'vigor_elixir', 1);
    const hp0 = p.sp.stats.hpBonus;
    await use(p, 'vigor_elixir', X, Y);
    await until(() => p.sp.stats.hpBonus > hp0);
    expect(p.sp.data.buffs.vigor?.power).toBeGreaterThan(0);
  });

  it('experimenting discovers catalog dishes, but only for a cook skilled enough', async () => {
    const rec = recipeById('truffle_pasta')!;
    expect(rec.learn).toBe('discover');
    for (const [id, n] of rec.inputs.map((i) => [i.id, i.n] as const)) await give(p, id, n);
    const items = () => rec.inputs.map((i) => ({ slot: slotOf(p, i.id), n: i.n }));
    p.sp.data.disc.cooking = 0;
    p.r.send(MSG.EXPERIMENT, { station: 'cooking_pot', tx: X + at('cooking_pot'), ty: Y, items: items() });
    await sleep(150);
    expect(count(p, 'truffle_pasta')).toBe(0);
    expect(p.sp.data.recipes.has('truffle_pasta')).toBe(false);
    p.sp.data.disc.cooking = xpForDiscLevel(rec.lvl);
    p.r.send(MSG.EXPERIMENT, { station: 'cooking_pot', tx: X + at('cooking_pot'), ty: Y, items: items() });
    await until(() => count(p, 'truffle_pasta') === 1);
    expect(p.sp.data.recipes.has('truffle_pasta')).toBe(true);
  });

  it('kingdom recipes are blocked without standing and open with it', async () => {
    const rec = recipeById('armor_skysteel_head')!;
    expect(rec.learn).toBe('realm:aurelion');
    p.sp.data.disc.smithing = xpForDiscLevel(rec.lvl);
    await give(p, 'skysteel_plate', 3);
    await give(p, 'leather', 2);
    const from = p.toasts.length;
    await craft('forge', rec.id);
    expect(count(p, rec.out.id)).toBe(0);
    expect(hasToast(p, /learned|standing/i, from)).toBe(true);
    p.sp.data.rep.aurelion = 400;
    await craft('forge', rec.id);
    expect(count(p, rec.out.id)).toBe(1);
  });
});
