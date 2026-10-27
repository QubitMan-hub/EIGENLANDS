import { beforeAll, afterAll, expect, it } from 'vitest';
import type { App } from '../src/app';
import { boot3, spawn3, tp, flatten, clearEnemies, sleep } from './p3helpers';
let app: App;
beforeAll(async () => {
  app = await boot3({ newWorldGeneration: 6 });
});
afterAll(async () => {
  await sleep(100);
  await app?.close();
});
async function field(name: string) {
  const p = await spawn3(app, name);
  await p.room.ensureChunk(2, 2);
  flatten(p.room, 90, 90, 15);
  p.room.store.get(2, 2).levels?.fill(0);
  await tp(p, 90.5, 90.5);
  clearEnemies(p.room);
  return p;
}
it('revives a phoenix once without paying a first-death reward, then dies normally', async () => {
  const p = await field('Ash witness'),
    e = p.room.spawnEnemy('phoenix', 93, 90.5, false);
  e.mode = 'recover';
  e.t = 99;
  const xp = p.sp.xp,
    level = p.sp.level,
    coins = p.sp.data.coins;
  p.room.hitEnemy(e, 99999, p.sp, 1, 0, 0);
  expect(e.reborn).toBe(true);
  expect(e.hp).toBeGreaterThan(0);
  expect(p.room.enemies.has(e.id)).toBe(true);
  expect(p.sp.xp).toBe(xp);
  expect(p.sp.data.coins).toBe(coins);
  p.room.hitEnemy(e, 99999, p.sp, 1, 0, 0);
  expect(p.room.enemies.has(e.id)).toBe(false);
  expect(p.sp.level > level || p.sp.xp > xp).toBe(true);
  await p.r.leave();
});
it('makes gaze directional, webs drain stamina and venom use the existing difficulty-aware poison authority', async () => {
  const p = await field('Pattern reader'),
    r = p.room as any;
  const gaze = p.room.spawnEnemy('basilisk', 93, 90.5, false);
  p.sp.hp = p.sp.maxHp;
  p.sp.sim.faceX = -1;
  p.sp.sim.faceY = 0;
  expect(r.hurtPlayer(p.sp, 10, gaze, 1, 1, 0, true)).toBe(false);
  expect(p.sp.hp).toBe(p.sp.maxHp);
  p.sp.sim.faceX = 1;
  expect(r.hurtPlayer(p.sp, 10, gaze, 1, 1, 0, true)).toBe(true);
  expect(p.sp.hp).toBeLessThan(p.sp.maxHp);
  const web = p.room.spawnEnemy('spider', 93, 90.5, false);
  p.sp.sim.stamina = 100;
  r.hurtPlayer(p.sp, 1, web, 1, 1, 0, true);
  expect(p.sp.sim.stamina).toBe(80);
  const manticore = p.room.spawnEnemy('manticore', 93, 90.5, false),
    rand = r.rand;
  r.rand = () => 0;
  p.sp.data.needs.mode = 'adventure';
  r.hurtPlayer(p.sp, 1, manticore, 1, 1, 0, true);
  expect(p.sp.data.buffs.poison).toBeTruthy();
  delete p.sp.data.buffs.poison;
  p.sp.data.needs.mode = 'cozy';
  r.hurtPlayer(p.sp, 1, manticore, 1, 1, 0, true);
  expect(p.sp.data.buffs.poison).toBeUndefined();
  r.rand = rand;
  await p.r.leave();
});
it('gives breath, hydra and storm creatures distinct projectile fans', async () => {
  const p = await field('Fan surveyor');
  for (const [kind, n] of [
    ['dragon', 5],
    ['hydra', 3],
    ['thunderbird', 2],
  ] as const) {
    const e = p.room.spawnEnemy(kind, 95, 90.5, false);
    e.mode = 'recover';
    e.t = 99;
    p.room.state.projectiles.clear();
    (p.room as any).projectiles.clear();
    p.room.fireOrbs(e, 1, 0);
    expect(p.room.state.projectiles.size).toBe(n);
  }
  await p.r.leave();
});
