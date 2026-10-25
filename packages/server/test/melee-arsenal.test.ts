import { afterAll, beforeAll, expect, it } from 'vitest';
import { MSG, attackDamage, meleeTap, townFor, type FxMsg } from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot3, clearEnemies, dummy, flatten, setLevel, spawn3, sleep, tp, until, type P3 } from './p3helpers';
let app: App;
beforeAll(async () => {
  app = await boot3();
});
afterAll(async () => {
  await sleep(300);
  await app?.close();
});
async function input(p: P3, attack = false) {
  const seq = p.sp.lastSeq + 1;
  p.r.send(MSG.INPUT, {
    cmds: [{ seq, viewTick: 0, dx: 0, dy: 0, dash: false, attack, hold: false, skill: false, aimX: 1, aimY: 0 }],
  });
  await until(() => p.sp.lastSeq >= seq, 2000);
}
async function equip(p: P3, id: string) {
  let slot = p.sp.data.inv.findIndex((s) => s?.id === id);
  if (slot < 0) {
    slot = p.sp.data.inv.findIndex((s) => !s);
    p.sp.data.inv[slot] = { id, n: 1 };
  }
  p.r.send(MSG.EQUIP, { slot, as: 'weapon' });
  await until(() => p.sp.data.equip.weapon?.id === id, 2000);
  await input(p);
}
async function setup(x: number) {
  const p = await spawn3(app, 'Arms tester');
  await setLevel(p, 20);
  await tp(p, x + 0.5, 700.5);
  flatten(p.room, x, 700, 10);
  clearEnemies(p.room);
  p.room.rand = () => 0.99;
  p.sp.invuln = 0;
  return p;
}
function foe(p: P3, x: number, y: number) {
  const e = dummy(p.room, x, y);
  e.poise = e.maxPoise = 100000;
  e.hp = e.maxHp = 1000;
  return e;
}
it('crafts at a real town forge, enforces equip level and restores the new main hand after reconnect', async () => {
  const p = await spawn3(app, 'Young smith');
  // Exact-cost branch: the existing crafting skill can otherwise save a random ingredient.
  p.room.rand = () => 0.99;
  const forge = townFor(p.room.seed).objects.find((o) => o.kind === 'station' && o.sub === 'forge')!;
  expect(forge).toBeDefined();
  await tp(p, forge.x + 1.5, forge.y + 0.5);
  p.sp.data.inv.fill(null);
  p.sp.data.inv[0] = { id: 'iron_ingot', n: 2 };
  p.sp.data.inv[1] = { id: 'wood', n: 4 };
  p.sp.data.inv[2] = { id: 'fiber', n: 2 };
  expect(p.sp.data.recipes.has('spear')).toBe(true);
  p.r.send(MSG.CRAFT, { station: 'forge', recipe: 'spear', n: 1, tx: forge.x, ty: forge.y });
  await until(() => p.sp.data.inv.some((s) => s?.id === 'spear'), 2000);
  expect(p.sp.data.inv.filter(Boolean)).toHaveLength(1);
  const slot = p.sp.data.inv.findIndex((s) => s?.id === 'spear');
  p.r.send(MSG.EQUIP, { slot, as: 'weapon' });
  await sleep(150);
  expect(p.sp.data.equip.weapon).toBeNull();
  expect(p.sp.data.inv[slot]?.id).toBe('spear');
  await setLevel(p, 3);
  await equip(p, 'spear');
  await until(() => p.r.state.players.get(p.sid)?.weapon === 'spear', 2000);
  const creds = { token: p.token, accountId: p.accountId };
  await p.r.leave();
  const q = await spawn3(app, 'Young smith', creds);
  expect(q.sp.data.equip.weapon?.id).toBe('spear');
  await q.r.leave();
});
it('uses real narrow spear and wide axe collision, and sends the family to another client', async () => {
  const p = await setup(700),
    q = await spawn3(app, 'Observer');
  await tp(q, 700.5, 705.5);
  const fx: FxMsg[] = [];
  q.r.onMessage(MSG.FX, (m: FxMsg) => fx.push(m));
  await equip(p, 'spear');
  expect(p.sp.sim.melee).toBe('spear');
  let x = p.sp.sim.x,
    y = p.sp.sim.y;
  const front = foe(p, x + 2.2, y),
    side = foe(p, x + 0.5, y + 1.2);
  p.sp.sim.atkCd = 0;
  await input(p, true);
  expect(front.hp).toBe(1000 - attackDamage(meleeTap('spear', 0).damage, p.sp.stats.atkBonus));
  expect(side.hp).toBe(1000);
  await until(() => fx.some((f) => f.kind === 'swing' && f.weapon === 'spear'), 2000);
  clearEnemies(p.room);
  p.sp.sim.x = x;
  p.sp.sim.y = y;
  await equip(p, 'battle_axe');
  const flank = foe(p, x + 0.5, y + 1.2);
  p.sp.sim.atkCd = 0;
  await input(p, true);
  expect(flank.hp).toBeLessThan(1000);
  await until(() => fx.some((f) => f.kind === 'swing' && f.weapon === 'battle_axe'), 2000);
  await q.r.leave();
  await p.r.leave();
});
it('warhammer finisher bypasses light-hit armour and full heavy really crushes poise', async () => {
  const p = await setup(740);
  await equip(p, 'warhammer');
  const e = foe(p, p.sp.sim.x + 1, p.sp.sim.y);
  e.def = { ...e.def, armor: true };
  e.poise = e.maxPoise = 100;
  p.sp.sim.combo = 2;
  p.sp.sim.comboT = 2;
  p.sp.sim.atkCd = 0;
  await input(p, true);
  expect(1000 - e.hp).toBe(attackDamage(22, p.sp.stats.atkBonus));
  expect(e.poise).toBe(70);
  p.sp.sim.atkCd = 0;
  p.sp.sim.atkBuf = 0;
  p.sp.sim.charge = 1;
  p.sp.sim.hold = 1;
  await input(p);
  expect(e.poise).toBe(10);
  expect(1000 - e.hp).toBe(attackDamage(22, p.sp.stats.atkBonus) + attackDamage(48, p.sp.stats.atkBonus));
  await p.r.leave();
});
