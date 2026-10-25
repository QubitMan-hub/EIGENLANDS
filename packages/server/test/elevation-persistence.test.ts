import { afterAll, expect, it } from 'vitest';
import { T, type ChunkStore } from '@eigenlands/shared';
import type { App } from '../src/app';
import { handleUse } from '../src/systems/tools';
import { startApp } from './helpers';
import { boot3, sleep, spawn3, tp } from './p3helpers';

let app: App | undefined;
afterAll(async () => {
  await app?.close();
});

/** open grass whose whole 3x3 neighbourhood sits on one raised level */
function flatHighGround(s: ChunkStore): [number, number] {
  for (let y = -190; y < 190; y++)
    for (let x = 100; x < 230; x++) {
      const l = s.levelAt(x, y);
      if (l < 1 || s.getTile(x, y) !== T.GRASS || s.solidAt(x, y + 1)) continue;
      let flat = true;
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++) if (s.levelAt(x + ox, y + oy) !== l) flat = false;
      if (flat) return [x, y];
    }
  throw new Error('no flat high ground');
}

it('a revision-3 world keeps its revision, edits and a traveller on high ground across restarts, whatever the operator configures later', async () => {
  app = await boot3({ newWorldGeneration: 3 });
  const p = await spawn3(app, 'Highlander');
  const creds = { token: p.token, accountId: p.accountId };
  const seed = p.room.seed;
  const [x, y] = flatHighGround(p.room.store);
  const level = p.room.store.levelAt(x, y);
  await tp(p, x + 0.5, y + 1.5);
  p.sp.data.inv[0] = { id: 'timber_floor', n: 3 };
  p.sp.toolReadyAt = 0;
  await handleUse(p.room, p.sp, { slot: 0, tx: x, ty: y });
  expect(p.room.store.structureAt(x, y)?.owner).toBe(p.accountId);
  await p.r.leave();
  await sleep(400);
  await app.close();

  // restart against the same database with the operator now asking for new worlds at revision 2: nothing moves
  app = await startApp({ config: { devCommands: true, newWorldGeneration: 2 } });
  const q = await spawn3(app, 'Highlander', creds);
  expect(await app.repo.getBlob(`worldgen:${seed}`)).toEqual({ version: 3 });
  expect(q.room.store.generation).toBe(3);
  expect(q.room.store.levelAt(x, y)).toBe(level);
  expect(q.room.store.structureAt(x, y)?.owner).toBe(q.accountId);
  expect(Math.hypot(q.sp.sim.x - (x + 0.5), q.sp.sim.y - (y + 1.5))).toBeLessThan(1.5);
  expect(q.sp.data.worldGeneration).toBe(3);
  await q.r.leave();
}, 60_000);

it('a world created at revision 2 stays at revision 2 when the server default moves to 3', async () => {
  await app?.close();
  app = await boot3({ newWorldGeneration: 2 });
  const p = await spawn3(app, 'Elder');
  const creds = { token: p.token, accountId: p.accountId };
  const seed = p.room.seed;
  expect(p.room.store.generation).toBe(2);
  expect(p.room.store.get(5, 5).levels).toBeUndefined();
  await p.r.leave();
  await sleep(400);
  await app.close();
  app = await startApp({ config: { devCommands: true, newWorldGeneration: 3 } });
  const q = await spawn3(app, 'Elder', creds);
  expect(q.room.store.generation).toBe(2);
  expect(await app.repo.getBlob(`worldgen:${seed}`)).toMatchObject({ version: 2 });
  await q.r.leave();
}, 60_000);
