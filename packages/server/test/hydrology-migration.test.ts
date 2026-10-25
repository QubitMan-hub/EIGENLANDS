import { afterAll, beforeAll, expect, it } from 'vitest';
import { CHUNK_SIZE, T, chunkOf, isSolid, tileAt } from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot3, sleep, spawn3 } from './p3helpers';
let app: App;
beforeAll(async () => {
  app = await boot3();
});
afterAll(async () => {
  await app?.close();
});

it('persists dry owned foundations across chunk borders, preserves edits and moves an old saved traveller out of new water', async () => {
  const p = await spawn3(app, 'Fen keeper'),
    seed = p.room.seed;
  let site: { x: number; y: number } | undefined;
  for (let y = -150; y < 150 && !site; y++)
    for (let x = -161; x < 161 && !site; x += 32) {
      if (Math.abs(x) < 70 || ((y % 32) + 32) % 32 > 29) continue;
      if ([0, 1, 2].every((dx) => !isSolid(tileAt(seed, x + dx, y, 1)) && tileAt(seed, x + dx, y, 2) === T.WATER))
        site = { x, y };
    }
  expect(site).toBeTruthy();
  const { x, y } = site!;
  const credentials = { token: p.token, accountId: p.accountId };
  await p.r.leave();
  await sleep(350);
  const row = (await app.repo.getCharacter(p.accountId))!;
  await app.repo.saveCharacter({
    ...row,
    x: x + 2.5,
    y: y + 0.5,
    data: { ...row.data, worldGeneration: 1, coins: 432 },
  });
  await app.repo.saveObjects(
    seed,
    [{ x, y, kind: 'chest', sub: 'chest', owner: p.accountId, data: { slots: Array(24).fill(null) } }],
    [],
  );
  const ex = x,
    ey = y + 1,
    cx = chunkOf(ex),
    cy = chunkOf(ey),
    index = (ey - cy * CHUNK_SIZE) * CHUNK_SIZE + ex - cx * CHUNK_SIZE;
  await app.repo.saveChunkDiffs(seed, [{ cx, cy, diff: new Map([[index, T.PATH]]) }]);
  const q = await spawn3(app, 'Fen keeper', credentials);
  expect(q.room.store.getTile(x, y)).toBe(tileAt(seed, x, y, 1));
  expect(q.room.store.getTile(x + 1, y)).toBe(tileAt(seed, x + 1, y, 1));
  expect(q.room.store.getTile(ex, ey)).toBe(T.PATH);
  expect(q.room.store.solidAt(Math.floor(q.sp.sim.x), Math.floor(q.sp.sim.y))).toBe(false);
  expect(Math.hypot(q.sp.sim.x - (x + 2.5), q.sp.sim.y - (y + 0.5))).toBeGreaterThan(0.1);
  expect(q.sp.data.coins).toBe(432);
  expect(q.sp.data.worldGeneration).toBe(2);
  await q.r.leave();
  await sleep(350);
  const saved = await app.repo.loadChunk(seed, chunkOf(x + 1), chunkOf(y));
  expect(saved.diff.get((y - chunkOf(y) * 32) * 32 + x + 1 - chunkOf(x + 1) * 32)).toBe(tileAt(seed, x + 1, y, 1));
  expect(await app.repo.getBlob(`worldgen:${seed}`)).toMatchObject({ version: 2 });
  // New bridge floors belong to revision 2: do not silently turn their lake bed into legacy land.
  await app.repo.saveObjects(
    seed,
    [
      {
        x: x + 2,
        y,
        kind: 'structure',
        sub: 'cell',
        owner: p.accountId,
        data: { floor: 'timber_floor', worldGeneration: 2 },
      },
    ],
    [],
  );
  const bridge = await spawn3(app, 'Fen keeper', credentials);
  const base = bridge.room.store.get(chunkOf(x + 2), chunkOf(y));
  expect(base.tiles[(y - chunkOf(y) * 32) * 32 + x + 2 - chunkOf(x + 2) * 32]).toBe(T.WATER);
  expect(bridge.room.store.getTile(x + 2, y)).toBe(T.FLOOR);
  await bridge.r.leave();
});
