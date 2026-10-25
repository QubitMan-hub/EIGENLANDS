import { afterAll, beforeAll, expect, it } from 'vitest';
import { MSG34, T, PLAYER_SPEED, newShadow } from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot3, spawn3, tp, setLevel, flatten, clearEnemies, dummy, until, sleep } from './p3helpers';
let app: App;
beforeAll(async () => {
  app = await boot3();
});
afterAll(async () => {
  await sleep(300);
  await app?.close();
});
async function setup() {
  const p = await spawn3(app, 'Escort');
  await setLevel(p, 10);
  await tp(p, 700.5, 600.5);
  flatten(p.room, 700, 600, 24);
  clearEnemies(p.room);
  p.room.rand = () => 0.5;
  const L = p.room.shadows.stateOf(p.sid)!;
  L.data.roster.push(newShadow('escort', 0, 1));
  p.r.send(MSG34.SHADOW_CMD, { act: 'summon', id: 'escort' });
  await until(() => L.units.has('escort'), 2000);
  return { p, L, u: L.units.get('escort')! };
}
function advance(p: Awaited<ReturnType<typeof setup>>['p'], n = 400) {
  for (let i = 0; i < n; i++) p.room.shadows.tick(0, 0.05);
}
it('routes around a wall instead of stalling on the straight follow line', async () => {
  const { p, u } = await setup();
  u.en.x = 694.5;
  u.en.y = 600.5;
  for (let y = 596; y <= 604; y++) p.room.store.setTile(697, y, T.WALL);
  advance(p);
  expect(Math.hypot(u.en.x - p.sp.sim.x, u.en.y - p.sp.sim.y)).toBeLessThan(4);
  expect(p.room.store.solidAt(Math.floor(u.en.x), Math.floor(u.en.y))).toBe(false);
  await p.r.leave();
});
it('engages a mob near the owner even when the companion starts beyond creature sight', async () => {
  const { p, u } = await setup();
  u.en.x = 690.5;
  u.en.y = 600.5;
  const e = dummy(p.room, 702.5, 600.5),
    hp = e.hp;
  advance(p, 40);
  expect(u.en.x).toBeGreaterThan(691.5);
  advance(p, 360);
  expect(e.hp).toBeLessThan(hp);
  await p.r.leave();
});
it('returns to the owner instead of pursuing distant aggressive targets', async () => {
  const { p, L, u } = await setup();
  L.data.stance = 'aggressive';
  u.en.x = 724.5;
  u.en.y = 600.5;
  const e = dummy(p.room, 730.5, 600.5),
    hp = e.hp;
  advance(p);
  expect(Math.hypot(u.en.x - p.sp.sim.x, u.en.y - p.sp.sim.y)).toBeLessThan(5);
  expect(e.hp).toBe(hp);
  await p.r.leave();
});

it('keeps following around an obstacle before engaging a hidden threat near the owner', async () => {
  const { p, u } = await setup();
  u.en.x = 694.5;
  u.en.y = 600.5;
  for (let y = 596; y <= 604; y++) p.room.store.setTile(697, y, T.WALL);
  const e = dummy(p.room, 702.5, 600.5),
    hp = e.hp;
  advance(p, 600);
  expect(e.hp).toBeLessThan(hp);
  await p.r.leave();
});

it('keeps up with a walking owner and recalls without landing in the adjacent wall', async () => {
  const { p, u } = await setup();
  u.en.x = 698.5;
  u.en.y = 600.5;
  for (let i = 0; i < 100; i++) {
    p.sp.sim.x += PLAYER_SPEED * 0.05;
    p.room.shadows.tick(0, 0.05);
  }
  expect(Math.hypot(u.en.x - p.sp.sim.x, u.en.y - p.sp.sim.y)).toBeLessThan(6);
  p.room.store.setTile(Math.floor(p.sp.sim.x) + 1, Math.floor(p.sp.sim.y), T.WALL);
  u.en.x = p.sp.sim.x + 40;
  p.room.shadows.tick(0, 0.05);
  expect(p.room.store.solidAt(Math.floor(u.en.x), Math.floor(u.en.y))).toBe(false);
  expect(Math.hypot(u.en.x - p.sp.sim.x, u.en.y - p.sp.sim.y)).toBeLessThan(4);
  await p.r.leave();
});
