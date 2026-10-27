import { beforeAll, afterAll, expect, it } from 'vitest';
import { T } from '@eigenlands/shared';
import { boot3, spawn3, tp, sleep, until } from './p3helpers';
import type { App } from '../src/app';
let app: App;
beforeAll(async () => {
  app = await boot3({ newWorldGeneration: 6 });
});
afterAll(async () => {
  await app.close();
});
it('records actual visible sightings, preserves fog and reloads only valid species', async () => {
  const p = await spawn3(app, 'Field naturalist');
  await p.room.ensureChunk(6, 6);
  for (let y = 198; y < 214; y++) for (let x = 198; x < 214; x++) p.room.store.setTile(x, y, T.GRASS);
  p.room.store.get(6, 6).levels?.fill(0);
  p.room.enemies.clear();
  p.room.state.enemies.clear();
  await tp(p, 204.5, 204.5);
  for (let y = 198; y < 214; y++) p.room.store.setTile(206, y, T.WALL);
  const hidden = p.room.spawnEnemy('goblin', 208.5, 204.5, false);
  hidden.mode = 'recover';
  hidden.t = 99;
  await sleep(1200);
  expect((p.sp.data.prog as any).bestiary ?? []).not.toContain('goblin');
  p.room.store.setTile(206, 204, T.GRASS);
  await until(() => ((p.sp.data.prog as any).bestiary ?? []).includes('goblin'), 3500);
  const creds = { token: p.token, accountId: p.accountId };
  await p.r.leave();
  await sleep(250);
  const again = await spawn3(app, 'Field naturalist', creds);
  expect((again.sp.data.prog as any).bestiary).toContain('goblin');
  const { validProg } = await import('../src/systems/profile');
  expect((validProg({ bestiary: ['goblin', '__proto__', 'no-such-species', 'goblin'] }) as any).bestiary).toEqual([
    'goblin',
  ]);
  await again.r.leave();
}, 15000);
