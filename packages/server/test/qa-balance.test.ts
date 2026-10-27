import { beforeAll, afterAll, expect, it } from 'vitest';
import { T, homeTowns, WORLD_EPOCH_MS } from '@eigenlands/shared';
import { boot3, spawn3, tp, flatten, clearEnemies, sleep } from './p3helpers';
import { plantSeed, uprootCrop, waterCrop, harvestCrop } from '../src/systems/farming';
import type { App } from '../src/app';
let app: App;
beforeAll(async () => {
  app = await boot3({ newWorldGeneration: 6 });
});
afterAll(async () => {
  await sleep(100);
  await app.close();
});

it('cannot train farming by repeatedly watering the same crop on the same day', async () => {
  const p = await spawn3(app, 'Water audit');
  await p.room.ensureChunk(2, 2);
  flatten(p.room, 84, 84, 3);
  await tp(p, 84.5, 84.5);
  p.room.setTile(85, 84, T.TILLED);
  p.room.objects.put({
    x: 85,
    y: 84,
    kind: 'crop',
    sub: 'turnip',
    owner: p.accountId,
    data: { crop: 'turnip', growth: 0, planted: p.room.wclock.day(), watered: -1, lastDay: p.room.wclock.day() - 1 },
  });
  const o = p.room.store.objectAt(85, 84)!;
  const before = p.sp.data.skills.farming;
  for (let i = 0; i < 20; i++) waterCrop(p.room, p.sp, o);
  expect(p.sp.data.skills.farming - before).toBe(1);
  p.room.wclock.offset += 24 * 60 * 1000;
  waterCrop(p.room, p.sp, o);
  expect(p.sp.data.skills.farming - before).toBe(2);
  await p.r.leave();
});
it('keeps trowel seed recovery without letting plant/uproot loops generate free farming XP', async () => {
  const p = await spawn3(app, 'Seed audit');
  p.room.wclock.setOffset(WORLD_EPOCH_MS + 120000 - Date.now());
  await p.room.ensureChunk(2, 2);
  flatten(p.room, 84, 84, 3);
  await tp(p, 84.5, 84.5);
  p.sp.data.inv.fill(null);
  p.sp.data.inv[0] = { id: 'turnip_seed', n: 1 };
  p.sp.data.inv[1] = { id: 'trowel', n: 1 };
  const before = p.sp.data.skills.farming;
  for (let i = 0; i < 12; i++) {
    p.room.setTile(85, 84, T.TILLED);
    const slot = p.sp.data.inv.findIndex((s) => s?.id === 'turnip_seed');
    plantSeed(p.room, p.sp, slot, 85, 84);
    const o = p.room.store.objectAt(85, 84)!;
    expect(o?.kind).toBe('crop');
    uprootCrop(p.room, p.sp, o);
  }
  expect(p.sp.data.inv.filter((s) => s?.id === 'turnip_seed').reduce((n, s) => n + s!.n, 0)).toBe(1);
  expect(p.sp.data.skills.farming).toBe(before);
  p.room.setTile(85, 84, T.TILLED);
  const slot = p.sp.data.inv.findIndex((s) => s?.id === 'turnip_seed');
  plantSeed(p.room, p.sp, slot, 85, 84);
  const ripe = p.room.store.objectAt(85, 84)!;
  ripe.data!.growth = 99;
  harvestCrop(p.room, p.sp, ripe);
  expect(p.sp.data.skills.farming).toBeGreaterThan(before);
  await p.r.leave();
});
it('never heals, applies debuffs or earns spell-hit credit from protected targets that take zero damage', async () => {
  const p = await spawn3(app, 'Ward audit');
  clearEnemies(p.room);
  const t = homeTowns(p.room.seed)[0]!;
  p.sp.sim.x = t.cx + 0.5;
  p.sp.sim.y = t.cy + 0.5;
  const e = p.room.spawnEnemy('troll', t.cx + 1.5, t.cy + 0.5, false);
  const hp = e.hp;
  p.sp.hp = 5;
  const result = p.circuit.engine.hit(p.sp, e, 40, { dx: 1, dy: 0, kb: 0, hue: 3, stun: 2 });
  expect(e.hp).toBe(hp);
  expect(result).toBe(0);
  expect(p.sp.hp).toBe(5);
  expect(e.mode).not.toBe('recover');
  await p.r.leave();
});

it('blocks an enemy melee impact through intervening rock but still hits on a clear lane', async () => {
  const p = await spawn3(app, 'Cover audit');
  await p.room.ensureChunk(2, 2);
  flatten(p.room, 85, 84, 5);
  p.room.store.get(2, 2).levels?.fill(0);
  clearEnemies(p.room);
  await tp(p, 86.5, 84.5);
  p.sp.invuln = 0;
  p.sp.viewLag = 0;
  p.sp.hp = p.sp.maxHp;
  const e = p.room.spawnEnemy('goblin', 84.5, 84.5, false);
  p.room.setTile(85, 84, T.ROCK);
  p.room.enemyStrike(e, e.x, e.y, 3);
  expect(p.sp.hp).toBe(p.sp.maxHp);
  p.room.setTile(85, 84, T.GRASS);
  p.room.enemyStrike(e, e.x, e.y, 3);
  expect(p.sp.hp).toBeLessThan(p.sp.maxHp);
  await p.r.leave();
});
