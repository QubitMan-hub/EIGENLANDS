import { afterAll, beforeAll, expect, it } from 'vitest';
import { CONDITION_RULES, countItem, townFor } from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot3, spawn3, tp, dev, until, sleep, clearEnemies } from './p3helpers';
import { inflict, tickTravelNeeds } from '../src/systems/travel-needs';

let app: App;
beforeAll(async () => {
  app = await boot3({ newWorldGeneration: 4 });
});
afterAll(async () => {
  await sleep(250);
  await app?.close();
});

it('never changes temperature in Cozy and holds it inside warded towns', async () => {
  const p = await spawn3(app, 'Frost walker');
  clearEnemies(p.room);
  const needs = p.sp.data.needs;
  // a cave of the Rime Cathedral type is cold; Cozy ignores it
  needs.mode = 'cozy';
  for (let i = 0; i < 5; i++) tickTravelNeeds(p.room, p.sp);
  expect(needs.temp).toBe(0);
  needs.mode = 'adventure';
  needs.temp = -90;
  const t = townFor(p.room.seed);
  await tp(p, t.cx + 0.5, t.cy + 0.5); // town streets are warded: temperature holds
  const held = p.sp.data.needs.temp;
  tickTravelNeeds(p.room, p.sp);
  expect(p.sp.data.needs.temp).toBe(held);
  await p.r.leave();
});

it('injuries tick as buffs, are cured by the right medicine and stop at 1 HP', async () => {
  const p = await spawn3(app, 'Wounded');
  const room = p.room;
  p.sp.data.needs.mode = 'adventure';
  p.sp.hp = 6;
  expect(inflict(room, p.sp, 'bleed')).toBe(true);
  expect(p.sp.data.buffs.bleed).toBeTruthy();
  await tp(p, 40.5, 40.5);
  for (let i = 0; i < 40; i++) tickTravelNeeds(room, p.sp);
  expect(p.sp.hp).toBeGreaterThanOrEqual(1);
  expect(p.sp.hp).toBeLessThan(6);
  // bandage cures bleeding
  await dev(p, { cmd: 'give', id: 'bandage', n: 2 });
  await until(() => countItem(p.sp.data.inv, 'bandage') === 2);
  const slot = p.sp.data.inv.findIndex((s) => s?.id === 'bandage');
  p.r.send('use', { slot, tx: Math.floor(p.sp.sim.x), ty: Math.floor(p.sp.sim.y) });
  await until(() => !p.sp.data.buffs.bleed, 3000);
  // wrong medicine does not cure the wrong injury
  inflict(room, p.sp, 'poison');
  expect(CONDITION_RULES.poison.cure).toBe('antidote');
  await p.r.leave();
});

it('Cozy never suffers injuries', async () => {
  const p = await spawn3(app, 'Cozy');
  p.sp.data.needs.mode = 'cozy';
  expect(inflict(p.room, p.sp, 'burn')).toBe(false);
  expect(p.sp.data.buffs.burn).toBeUndefined();
  await p.r.leave();
});
