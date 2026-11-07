import { beforeAll, afterAll, expect, it } from 'vitest';
import {
  MSG,
  T,
  UPPER_OY,
  ChunkStore,
  buildPlan,
  type BuildPiece,
  type BuildTurn,
  type ObjMsg,
} from '@eigenlands/shared';
import type { App } from '../src/app';
import { handleUse } from '../src/systems/tools';
import { handleOpen } from '../src/systems/containers';
import { runtime } from '../src/rooms/runtime';
import { boot3, spawn3, flatten, tp, sleep, until, type P3 } from './p3helpers';
let app: App;
let a: P3;
let b: P3;
beforeAll(async () => {
  app = await boot3();
  a = await spawn3(app, 'Architect');
  b = await spawn3(app, 'Visitor');
  await tp(a, 735.5, 735.5);
  await tp(b, 740.5, 735.5);
  flatten(a.room, 736, 736, 12);
});
afterAll(async () => {
  await a?.r.leave();
  await b?.r.leave();
  await sleep(300);
  await app?.close();
});
async function use(p: P3, id: string, x: number, y: number, turn = 0) {
  p.sp.data.inv[0] = { id, n: 20 };
  p.sp.toolReadyAt = 0;
  await handleUse(p.room, p.sp, { slot: 0, tx: x, ty: y, turn });
}
it('builds an owned floor, wall, roof and working door through the normal USE route', async () => {
  await use(a, 'timber_floor', 736, 736);
  expect(a.room.store.structureAt(736, 736)?.owner).toBe(a.accountId);
  await use(a, 'timber_wall', 736, 736, 1);
  await use(a, 'shingle_roof', 736, 736, 2);
  expect(a.room.store.solidAt(736, 736)).toBe(true);
  expect(a.room.store.structureAt(736, 736)?.data.roofTurn).toBe(2);
  await use(a, 'timber_floor', 735, 736);
  await use(a, 'timber_door', 735, 736);
  await handleOpen(a.room, a.sp, { tx: 735, ty: 736 });
  expect(a.room.store.solidAt(735, 736)).toBe(false);
});
it('coexists with furniture and refuses foreign edits without spending the stack', async () => {
  await use(a, 'timber_floor', 734, 736);
  await use(a, 'chest', 734, 736);
  await use(a, 'thatch_roof', 734, 736);
  expect(a.room.store.objectAt(734, 736)?.kind).toBe('chest');
  expect(a.room.store.structureAt(734, 736)?.data.roof).toBe('thatch_roof');
  await tp(b, 733.5, 735.5);
  await use(b, 'pickaxe', 734, 736);
  expect(a.room.store.structureAt(734, 736)?.data.roof).toBe('thatch_roof');
  await use(b, 'stone_wall', 734, 736);
  expect(b.sp.data.inv[0]?.n).toBe(20);
});
it('pairs stairs across floor chunks, checks landing collision and keeps a usable exit', async () => {
  await use(a, 'timber_floor', 736, 734);
  await use(a, 'timber_floor', 735, 734);
  await use(a, 'timber_stairs', 735, 734, 1);
  expect(a.room.store.structureAt(735, 734 + UPPER_OY)?.data.stairs).toBe('down');
  await handleOpen(a.room, a.sp, { tx: 735, ty: 734 });
  expect(a.sp.sim.y).toBe(734.5 + UPPER_OY);
  await use(a, 'timber_floor', 736, 734 + UPPER_OY);
  expect(a.room.store.getTile(736, 734 + UPPER_OY)).toBe(T.FLOOR);
  await use(a, 'pickaxe', 735, 734 + UPPER_OY);
  expect(a.room.store.structureAt(735, 734)?.data.stairs).toBe('up');
  await use(a, 'chest', 735, 734 + UPPER_OY);
  expect(a.room.store.objectAt(735, 734 + UPPER_OY)).toBeUndefined();
  await handleOpen(a.room, a.sp, { tx: 735, ty: 734 + UPPER_OY });
  expect(a.sp.sim.y).toBe(734.5);
  a.room.store.setTile(735, 734 + UPPER_OY, T.CAVE_WALL); // floor overlay remains authoritative
  a.room.store.putObject({ x: 735, y: 734 + UPPER_OY, kind: 'chest', sub: 'chest' });
  await handleOpen(a.room, a.sp, { tx: 735, ty: 734 });
  expect(a.sp.sim.y).toBe(734.5);
  a.room.store.removeObject(735, 734 + UPPER_OY);
});
it('persists both layers and chunk-edge ownership, including structural deletions', async () => {
  await tp(a, 736.5, 735.5);
  await use(a, 'timber_floor', 737, 735);
  await use(a, 'chest', 737, 735);
  await use(a, 'shingle_roof', 737, 735);
  await a.room.objects.flush(runtime().repo);
  const list = await runtime().repo.loadObjects(a.room.seed, 23, 22);
  const loaded = new ChunkStore(a.room.seed);
  for (const o of list) loaded.putObject(o);
  expect(loaded.structureAt(737, 735)?.owner).toBe(a.accountId);
  expect(loaded.objectAt(737, 735)?.kind).toBe('chest');
  await use(a, 'pickaxe', 737, 735);
  expect(a.room.store.structureAt(737, 735)?.data.roof).toBeUndefined();
  expect(a.room.store.objectAt(737, 735)?.kind).toBe('chest');
});
it('does not duplicate the included landing and refuses refunds into a full pack', async () => {
  await tp(a, 735.5, 733.5);
  await use(a, 'pickaxe', 735, 734);
  expect(a.room.store.structureAt(735, 734)?.data.stairs).toBeUndefined();
  expect(a.room.store.structureAt(735, 734 + UPPER_OY)).toBeUndefined();
  expect(a.room.store.structureAt(735, 734)?.data.floor).toBe('timber_floor');
  await use(a, 'timber_stairs', 735, 734);
  expect(a.room.store.structureAt(735, 734 + UPPER_OY)?.data.stairs).toBe('down');
  await tp(a, 736.5, 735.5);
  a.sp.data.inv = Array.from({ length: 30 }, () => ({ id: 'stone', n: 99 }));
  a.sp.data.inv[0] = { id: 'pickaxe', n: 1 };
  a.sp.toolReadyAt = 0;
  await handleUse(a.room, a.sp, { slot: 0, tx: 736, ty: 736 });
  expect(a.room.store.structureAt(736, 736)?.data.roof).toBe('shingle_roof');
  a.sp.data.inv[1] = null;
  a.sp.toolReadyAt = 0;
  await handleUse(a.room, a.sp, { slot: 0, tx: 736, ty: 736 });
  expect(a.room.store.structureAt(736, 736)?.data.roof).toBeUndefined();
  expect(a.sp.data.inv[1]).toEqual({ id: 'shingle_roof', n: 1 });
});
it('keeps door permissions and chunk snapshots across an owner reconnect', async () => {
  await tp(a, 735.5, 735.5);
  await tp(b, 734.5, 735.5);
  // The owner closes the door; a nearby visitor cannot reopen it.
  const door = a.room.store.structureAt(735, 736)!;
  if (door.data.open) await handleOpen(a.room, a.sp, { tx: 735, ty: 736 });
  b.r.send(MSG.OPEN, { tx: 735, ty: 736 });
  await sleep(80);
  expect(a.room.store.solidAt(735, 736)).toBe(true);
  await a.room.objects.flush(runtime().repo);
  const creds = { token: a.token, accountId: a.accountId };
  await a.r.leave();
  a = await spawn3(app, 'Architect', creds);
  await tp(a, 735.5, 735.5);
  const chunks: Array<{ objs?: Array<{ kind: string; owner?: string; x: number; y: number }> }> = [];
  a.r.onMessage(MSG.CHUNK, (m) => chunks.push(m));
  a.r.send(MSG.CHUNK_REQ, { cx: 22, cy: 23 });
  await until(
    () => chunks.some((m) => m.objs?.some((o) => o.kind === 'structure' && o.x === 735 && o.y === 736)),
    2000,
  );
  expect(
    chunks.flatMap((m) => m.objs ?? []).find((o) => o.kind === 'structure' && o.x === 735 && o.y === 736)?.owner,
  ).toBe(creds.accountId);
  a.r.send(MSG.OPEN, { tx: 735, ty: 736 });
  await until(() => !a.room.store.solidAt(735, 736), 2000);
});
it('sends separate-layer updates and refuses unsupported or town construction', async () => {
  const updates: ObjMsg[] = [];
  a.r.onMessage(MSG.OBJ, (m: ObjMsg) => updates.push(m));
  await tp(a, 736.5, 735.5);
  await use(a, 'stone_floor', 737, 736);
  await sleep(100);
  expect(updates.some((m) => m.obj?.kind === 'structure' && m.x === 737)).toBe(true);
  await use(a, 'timber_wall', 736, 735);
  expect(a.sp.data.inv[0]?.n).toBe(20);
  await tp(a, 0.5, 4.5);
  await use(a, 'timber_floor', 0, 4);
  expect(a.room.store.structureAt(0, 4)).toBeUndefined();
});
it('lays a dragged run of floors and a walled room in one go, keeping every placement rule', async () => {
  await tp(a, 744.5, 744.5);
  const run = async (id: string, x0: number, y0: number, x1: number, y1: number, n = 64, turn = 0) => {
    a.sp.data.inv[0] = { id, n };
    a.sp.toolReadyAt = 0;
    const area = buildPlan(id as BuildPiece, x0, y0, x1, y1, turn as BuildTurn);
    await handleUse(a.room, a.sp, { slot: 0, tx: area[0]![0], ty: area[0]![1], area });
    return area;
  };
  // a 5×4 foundation: every tile, one piece each
  const floors = await run('timber_floor', 742, 742, 746, 745);
  expect(floors).toHaveLength(20);
  for (const [x, y] of floors) expect(a.room.store.structureAt(x, y)?.data.floor).toBe('timber_floor');
  expect(a.sp.data.inv[0]?.n).toBe(44);
  // walls around its edge: 14 pieces, turned to run along each side
  const walls = await run('timber_wall', 742, 742, 746, 745);
  expect(walls).toHaveLength(14);
  expect(a.room.store.structureAt(744, 742)?.data.wallTurn).toBe(0);
  expect(a.room.store.structureAt(742, 743)?.data.wallTurn).toBe(1);
  expect(a.room.store.structureAt(744, 743)?.data.wall).toBeUndefined();
  await until(() => a.toasts.some((t) => t.text.includes('Built 14 × Timber Wall')), 3000);
  // a roof run with too few pieces: as many as the stack allows, then one summary of the rest
  await run('thatch_roof', 742, 742, 746, 745, 5, 1);
  const roofed = floors.filter(([x, y]) => a.room.store.structureAt(x, y)?.data.roof === 'thatch_roof');
  expect(roofed).toHaveLength(5);
  expect(a.room.store.structureAt(roofed[0]![0], roofed[0]![1])?.data.roofTurn).toBe(1);
  await until(() => a.toasts.some((t) => t.text.includes('Built 5 of 20') && t.text.includes('ran out')), 3000);
});
