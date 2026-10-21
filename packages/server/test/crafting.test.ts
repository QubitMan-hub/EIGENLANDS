import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MSG, T, beatTimes, type RhythmStartMsg } from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot, count, flatten, give, hasToast, setDay, sleep, slotOf, spawn, tp, until, use, type Probe } from './p2';

let app: App;
let p: Probe;
const X = 300, Y = 300;

beforeAll(async () => {
  app = await boot();
  p = await spawn(app, 'Smith');
  setDay(p.room, 1, 12);
  await tp(p, X + 0.5, Y + 0.5);
  flatten(p.room, X, Y, 8);
});
afterAll(async () => { await app.close(); });

const place = async (item: string, dx: number, dy: number) => { await give(p, item, 1); await use(p, item, X + dx, Y + dy); };
const craft = async (station: string, recipe: string, n = 1, tx = 0, ty = 0) => { p.r.send(MSG.CRAFT, { station, recipe, n, tx, ty }); await sleep(120); };

describe('stations and recipes', () => {
  it('field crafting works anywhere; station recipes need the station nearby', async () => {
    await give(p, 'wood', 30);
    await craft('hand', 'fence', 2);
    expect(count(p, 'fence')).toBe(8);
    expect(count(p, 'wood')).toBe(30 - 4); // 2 wood per craft
    // plank needs a workbench
    const from = p.toasts.length;
    await craft('workbench', 'plank', 1, X + 1, Y);
    expect(count(p, 'plank')).toBe(0);
    expect(hasToast(p, /station/i, from)).toBe(true);
    await give(p, 'stone', 30);
    await give(p, 'coal', 10);
    await craft('hand', 'workbench');
    expect(count(p, 'workbench')).toBe(1);
    await use(p, 'workbench', X + 1, Y);
    expect(p.room.store.objectAt(X + 1, Y)?.sub).toBe('workbench');
    expect(p.room.store.solidAt(X + 1, Y)).toBe(true); // stations block movement on the server too
    await craft('workbench', 'plank', 3, X + 1, Y);
    expect(count(p, 'plank')).toBe(3);
    // far away: refused
    await tp(p, X + 0.5, Y + 7.5);
    const from2 = p.toasts.length;
    await craft('workbench', 'plank', 1, X + 1, Y);
    expect(count(p, 'plank')).toBe(3);
    expect(hasToast(p, /right station/i, from2)).toBe(true);
    await tp(p, X + 0.5, Y + 0.5);
  });

  it('unknown recipes are refused until discovered by experimenting; failed experiments cost nothing', async () => {
    await give(p, 'iron_ingot', 4);
    await give(p, 'stone', 10);
    await give(p, 'coal', 4);
    const forgeInputs = ['iron_ingot', 'stone', 'coal'];
    await craft('workbench', 'forge', 1, X + 1, Y);
    expect(count(p, 'forge')).toBe(0); // not learned
    // wrong amounts: nothing happens, nothing consumed
    const iron0 = count(p, 'iron_ingot');
    p.r.send(MSG.EXPERIMENT, { station: 'workbench', tx: X + 1, ty: Y, items: [{ slot: slotOf(p, 'iron_ingot'), n: 3 }, { slot: slotOf(p, 'stone'), n: 10 }, { slot: slotOf(p, 'coal'), n: 4 }] });
    await sleep(150);
    expect(count(p, 'forge')).toBe(0);
    expect(count(p, 'iron_ingot')).toBe(iron0);
    // the right mix discovers and crafts it
    const slots = forgeInputs.map((id, i) => ({ slot: slotOf(p, id), n: [4, 10, 4][i]! }));
    const from = p.toasts.length;
    p.r.send(MSG.EXPERIMENT, { station: 'workbench', tx: X + 1, ty: Y, items: slots });
    await until(() => count(p, 'forge') === 1);
    expect(p.sp.data.recipes.has('forge')).toBe(true);
    expect(hasToast(p, /discovered/i, from)).toBe(true);
    expect(count(p, 'iron_ingot')).toBe(iron0 - 4);
  });

  it('the furnace smelts, and crafting xp accrues', async () => {
    await place('furnace', 2, 0);
    expect(p.room.store.objectAt(X + 2, Y)?.sub).toBe('furnace');
    await give(p, 'copper_ore', 4);
    const xp0 = p.sp.data.skills.crafting;
    await craft('furnace', 'copper_ingot', 2, X + 2, Y);
    expect(count(p, 'copper_ingot')).toBe(2);
    expect(count(p, 'copper_ore')).toBe(0);
    expect(p.sp.data.skills.crafting).toBeGreaterThan(xp0);
  });

  it('tools and rings carry their properties; rings change stats when equipped', async () => {
    p.room.objects.put({ x: X + 3, y: Y, kind: 'station', sub: 'jeweler', owner: p.accountId });
    await give(p, 'copper_ingot', 2);
    await craft('jeweler', 'ring_hp', 1, X + 3, Y);
    const ring = p.sp.data.inv.find((s) => s?.id === 'ring_hp')!;
    expect(ring.p).toMatchObject({ stat: 'hp', val: 12 });
    const maxHp0 = p.sp.maxHp;
    p.r.send(MSG.EQUIP, { slot: slotOf(p, 'ring_hp'), as: 'ring1' });
    await until(() => p.sp.data.equip.ring1?.id === 'ring_hp');
    await sleep(120);
    expect(p.sp.stats.hpBonus).toBe(12);
    expect(p.sp.maxHp).toBe(maxHp0 + 12);
    p.r.send(MSG.EQUIP, { slot: 0, as: 'unequip_ring1' });
    await until(() => p.sp.data.equip.ring1 === null);
    expect(p.sp.stats.hpBonus).toBe(0);
    // tools made at the workbench get a tier
    await give(p, 'wood', 5); await give(p, 'stone', 5);
    await craft('workbench', 'axe_1', 1, X + 1, Y);
    expect(p.sp.data.inv.filter((s) => s?.id === 'axe').length).toBeGreaterThanOrEqual(2);
  });

  it('outfits set the player look; invalid equips are ignored', async () => {
    await give(p, 'outfit_violet', 1);
    p.r.send(MSG.EQUIP, { slot: slotOf(p, 'outfit_violet'), as: 'outfit' });
    await until(() => p.sp.state.look === 2);
    p.r.send(MSG.EQUIP, { slot: slotOf(p, 'axe'), as: 'ring2' }); // not a ring
    p.r.send(MSG.EQUIP, { slot: 999, as: 'outfit' });
    await sleep(100);
    expect(p.sp.data.equip.ring2).toBeNull();
  });

  it('a superposed seed is made from two different seeds and a crystal at the alchemy table', async () => {
    p.room.objects.put({ x: X - 1, y: Y, kind: 'station', sub: 'alchemy', owner: p.accountId });
    await give(p, 'qubit_crystal', 1);
    await give(p, 'turnip_seed', 1);
    await give(p, 'potato_seed', 1);
    p.r.send(MSG.EXPERIMENT, { station: 'alchemy', tx: X - 1, ty: Y, items: [{ slot: slotOf(p, 'qubit_crystal'), n: 1 }, { slot: slotOf(p, 'turnip_seed'), n: 1 }, { slot: slotOf(p, 'potato_seed'), n: 1 }] });
    await until(() => count(p, 'superposed_seed') === 1);
    const s = p.sp.data.inv.find((x) => x?.id === 'superposed_seed')!;
    expect([s.p!.a, s.p!.b].sort()).toEqual(['potato', 'turnip']);
  });
});

describe('interference forging with the rhythm protocol', () => {
  const startForge = async (slots: number[]): Promise<RhythmStartMsg | null> => {
    p.rhythm.length = 0;
    p.r.send(MSG.FORGE_START, { tx: X, ty: Y + 3, template: 'sword', slots });
    await sleep(250);
    return (p.rhythm[0] as RhythmStartMsg) ?? null;
  };
  const finish = async (start: RhythmStartMsg, hits: number[]) => {
    const last = start.plan.startAt + start.plan.intervalMs * start.plan.count;
    await until(() => p.room.wclock.now() >= last, 8000, 10);
    p.results.length = 0;
    p.r.send(MSG.RHYTHM_DONE, { id: start.id, hits });
    await until(() => p.results.length > 0, 2000);
    return p.results[0];
  };

  it('previews phases, validates the offer, and consumes materials only when the hammering ends', async () => {
    p.room.objects.put({ x: X, y: Y + 3, kind: 'station', sub: 'forge', owner: p.accountId });
    p.r.send(MSG.FORGE_PREVIEW, { materials: ['copper_ingot', 'iron_ingot'] });
    await until(() => p.forgePreviews.length > 0);
    expect(p.forgePreviews[0].ok).toBe(true);
    expect(p.forgePreviews[0].preview.coherence).toBeLessThan(-0.9);
    p.r.send(MSG.FORGE_PREVIEW, { materials: ['wood', 'stone'] });
    await until(() => p.forgePreviews.length > 1);
    expect(p.forgePreviews[1].ok).toBe(false);

    await give(p, 'copper_ingot', 4);
    // not forgeable / not enough in the slot / not a forge: no session
    expect(await startForge([slotOf(p, 'stone'), slotOf(p, 'stone')])).toBeNull();
    const cu = slotOf(p, 'copper_ingot');
    p.sp.data.inv[cu]!.n = 1;
    expect(await startForge([cu, cu])).toBeNull();
    p.sp.data.inv[cu]!.n = 4;
    p.r.send(MSG.FORGE_START, { tx: X + 7, ty: Y + 7, template: 'sword', slots: [cu, cu] });
    await sleep(150);
    expect(p.rhythm.length).toBe(0);

    // a valid offer: the same stack may supply both ingots
    const start = await startForge([cu, cu]);
    expect(start).toBeTruthy();
    expect(start!.kind).toBe('forge');
    expect(start!.plan.count).toBe(5);
    expect(count(p, 'copper_ingot')).toBe(4); // untouched so far

    // finishing before the last beat is refused and keeps the session
    p.r.send(MSG.RHYTHM_DONE, { id: start!.id, hits: beatTimes(start!.plan) });
    await sleep(150);
    expect(p.results.length).toBe(0);
    expect(hasToast(p, /too soon/i)).toBe(true);

    // perfect timing -> a Perfect sword with phase-derived stats
    const res = await finish(start!, beatTimes(start!.plan));
    expect(res.ok).toBe(true);
    expect(res.accuracy).toBeGreaterThan(0.98);
    expect(res.item.id).toBe('sword');
    expect(res.item.p.qname).toBe('Perfect');
    expect(res.item.p.atk).toBeGreaterThan(5);
    expect(count(p, 'copper_ingot')).toBe(2);
    const swords = p.sp.data.inv.filter((s) => s?.id === 'sword');
    expect(swords.some((s) => s!.p?.qname === 'Perfect')).toBe(true);
    // a sword on the hotbar (slots 0-9) raises melee damage; in the pack it does not
    const si = p.sp.data.inv.findIndex((s) => s?.id === 'sword' && s.p?.qname === 'Perfect');
    const dmg0 = (p.room as any).outgoing(p.sp, 8);
    p.r.send(MSG.INV_MOVE, { from: si, to: 0 });
    await until(() => p.sp.stats.atkBonus > 0);
    expect((p.room as any).outgoing(p.sp, 8)).toBeGreaterThan(dmg0);
  });

  it('bad timing and cheated timestamps yield a Rough result; the session cannot be replayed', async () => {
    const cu = slotOf(p, 'copper_ingot');
    const start = (await startForge([cu, cu]))!;
    const beats = beatTimes(start.plan);
    const cheated = [...beats.map((b) => b + 400), 1, 2, 999999999999, NaN as any];
    const res = await finish(start, cheated);
    expect(res.ok).toBe(true);
    expect(res.accuracy).toBeLessThan(0.1);
    expect(res.item.p.qname).toBe('Rough');
    expect(count(p, 'copper_ingot')).toBe(0);
    p.results.length = 0;
    p.r.send(MSG.RHYTHM_DONE, { id: start.id, hits: beats });
    await sleep(150);
    expect(p.results.length).toBe(0); // session already consumed
  });

  it('a forged pickaxe carries a tier computed from the metals', async () => {
    await give(p, 'iron_ingot', 1);
    await give(p, 'silver_ingot', 1);
    p.rhythm.length = 0;
    p.r.send(MSG.FORGE_START, { tx: X, ty: Y + 3, template: 'pickaxe', slots: [slotOf(p, 'iron_ingot'), slotOf(p, 'silver_ingot')] });
    await until(() => p.rhythm.length > 0);
    const res = await finish(p.rhythm[0], beatTimes(p.rhythm[0].plan));
    expect(res.item.id).toBe('pickaxe');
    expect(res.item.p.tier).toBeGreaterThanOrEqual(4);
  });
});

describe('food, potions and buffs', () => {
  it('potions heal and apply buffs; full health refuses plain healing; buffs expire and regen ticks', async () => {
    p.sp.hp = 10;
    await give(p, 'healing_potion', 1);
    await use(p, 'healing_potion', X, Y);
    expect(p.sp.hp).toBe(Math.min(p.sp.maxHp, 70));
    const from = p.toasts.length;
    await give(p, 'healing_potion', 1);
    p.sp.hp = p.sp.maxHp;
    await use(p, 'healing_potion', X, Y, 120);
    expect(hasToast(p, /full health/i, from)).toBe(true);
    expect(count(p, 'healing_potion')).toBe(1);

    await give(p, 'might_potion', 1);
    await use(p, 'might_potion', X, Y);
    expect(p.sp.data.buffs.might?.power).toBe(0.2);
    expect((p.room as any).outgoing(p.sp, 10)).toBeGreaterThan(11);

    await give(p, 'regen_potion', 1);
    p.sp.hp = 20;
    await use(p, 'regen_potion', X, Y);
    expect(p.sp.data.buffs.regen).toBeTruthy();
    p.sp.regenT = 4;
    await until(() => p.sp.hp > 20, 3000);
    // expiry: shift the world clock past the buff
    p.room.wclock.advanceDays(1);
    await until(() => !p.sp.data.buffs.might, 3000);
    p.room.wclock.advanceDays(-1);
  });
});
