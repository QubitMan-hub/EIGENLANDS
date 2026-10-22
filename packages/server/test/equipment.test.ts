import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MSG, MSG34, WEAPONS, armorId } from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot3, clearEnemies, dev, dummy, flatten, setLevel, spawn3, sleep, tp, until, type P3 } from './p3helpers';

let app: App;
beforeAll(async () => { app = await boot3(); });
afterAll(async () => { await app?.close(); });

const give = (p: P3, id: string, n = 1) => dev(p, { cmd: 'give', id, n });
const equip = (p: P3, as: string, id: string) => {
  const slot = p.sp.data.inv.findIndex((s) => s?.id === id);
  expect(slot, `${id} in pack`).toBeGreaterThanOrEqual(0);
  p.r.send(MSG.EQUIP, { slot, as });
};

describe('armour and weapons', () => {
  it('armour has level requirements, set bonuses change stats and the look, unequip returns it', async () => {
    const p = await spawn3(app, 'Smith');
    await setLevel(p, 5);
    const pieces = (['head', 'chest', 'legs', 'feet'] as const).map((s) => armorId('leather', s));
    for (const id of pieces) await give(p, id);
    await give(p, armorId('iron', 'head'));
    await until(() => p.sp.data.inv.some((s) => s?.id === armorId('iron', 'head')), 2000);
    // iron needs level 12
    equip(p, 'head', armorId('iron', 'head'));
    await sleep(200);
    expect(p.sp.data.equip.head).toBeNull();
    for (const [i, slot] of (['head', 'chest', 'legs', 'feet'] as const).entries()) { equip(p, slot, pieces[i]!); await until(() => p.sp.data.equip[slot]?.id === pieces[i], 2000); }
    expect(p.sp.stats.def).toBeCloseTo(0.08, 5);
    expect(p.sp.stats.hpBonus).toBe(5 * 4 + 12);
    expect(p.sp.stats.luck).toBe(2);
    expect(p.sp.state.look).toBe(8); // leather set look
    // a wrong-slot drop is refused
    p.r.send(MSG.EQUIP, { slot: p.sp.data.inv.findIndex((s) => s?.id === armorId('iron', 'head')), as: 'feet' });
    await sleep(150);
    expect(p.sp.data.equip.feet?.id).toBe(pieces[3]);
    p.r.send(MSG.EQUIP, { slot: 0, as: 'unequip_chest' });
    await until(() => p.sp.data.equip.chest === null, 2000);
    await sleep(120);
    expect(p.sp.state.look).toBe(8); // three pieces still show the set
    p.r.send(MSG.EQUIP, { slot: 0, as: 'unequip_legs' });
    await until(() => p.sp.data.equip.legs === null, 2000);
    await sleep(120);
    expect(p.sp.state.look).toBe(p.sp.data.equip.outfit); // fewer than 3 pieces: back to the chosen outfit
    await p.r.leave();
  });

  it('armour reduces enemy damage; phase armour can ignore a hit', async () => {
    const p = await spawn3(app, 'Tank');
    await tp(p, 700.5, 500.5); flatten(p.room, 700, 500, 10);
    await setLevel(p, 30);
    clearEnemies(p.room);
    for (const s of ['head', 'chest', 'legs', 'feet'] as const) { await give(p, armorId('voidglass', s)); }
    await until(() => p.sp.data.inv.filter((x) => x?.id.startsWith('armor_voidglass')).length === 4, 3000);
    for (const s of ['head', 'chest', 'legs', 'feet'] as const) { equip(p, s, armorId('voidglass', s)); await until(() => p.sp.data.equip[s] !== null, 2000); }
    expect(p.sp.stats.phase).toBeCloseTo(0.12, 5);
    expect(p.sp.stats.def).toBeCloseTo(0.12 + 0.05, 5);
    // every roll below the phase chance: the hit passes through
    p.sp.invuln = 0; p.room.rand = () => 0;
    const hp = p.sp.hp;
    const foe = dummy(p.room, p.sp.sim.x + 0.8, p.sp.sim.y);
    (p.room as unknown as { hurtPlayer(p: unknown, d: number, e: unknown, w: number, x: number, y: number): boolean }).hurtPlayer(p.sp, 40, foe, 0, 1, 0);
    expect(p.sp.hp).toBe(hp);
    // rolls above it: reduced by defence
    p.room.rand = () => 0.99; p.sp.invuln = 0;
    (p.room as unknown as { hurtPlayer(p: unknown, d: number, e: unknown, w: number, x: number, y: number): boolean }).hurtPlayer(p.sp, 40, foe, 0, 1, 0);
    expect(hp - p.sp.hp).toBe(Math.round(40 * (1 - 0.17)));
    await p.r.leave();
  });

  it('a crossbow and a fire staff shoot through the ability engine; charged volley pierces', async () => {
    const p = await spawn3(app, 'Archer');
    await tp(p, 740.5, 500.5); flatten(p.room, 740, 500, 12);
    await setLevel(p, 12);
    clearEnemies(p.room);
    p.sp.invuln = 0;
    await give(p, 'crossbow'); await give(p, 'ember_staff');
    await until(() => p.sp.data.inv.some((s) => s?.id === 'ember_staff'), 2000);
    equip(p, 'weapon', 'crossbow');
    await until(() => p.sp.data.equip.weapon?.id === 'crossbow', 2000);
    const near = dummy(p.room, p.sp.sim.x + 4, p.sp.sim.y), far = dummy(p.room, p.sp.sim.x + 6, p.sp.sim.y);
    const hp0 = near.hp, hp1 = far.hp;
    // a charged shot goes through the first target to hit the second
    const shot = WEAPONS.crossbow.charged!;
    p.room.shadows; // (module present)
    (p.room as unknown as { circuit: { engine: { weaponShot(p: unknown, s: unknown, ax: number, ay: number, pw: number): void } } }).circuit.engine.weaponShot(p.sp, shot, 1, 0, 1);
    await until(() => near.hp < hp0 && far.hp < hp1, 3000, 30);
    // swapping to a staff changes what the weapon slot holds and its stat bonus
    equip(p, 'weapon', 'ember_staff');
    await until(() => p.sp.data.equip.weapon?.id === 'ember_staff', 2000);
    expect(p.sp.stats.atkBonus).toBe(WEAPONS.ember_staff.bonus.atk);
    await p.r.leave();
  });
});
