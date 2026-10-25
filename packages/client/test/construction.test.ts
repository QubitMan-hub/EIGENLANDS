import { expect, it } from 'vitest';
import { ChunkStore, T, type BuildCell } from '@eigenlands/shared';
import { LocalRepo } from '../src/local/repo';
import { LocalDb } from '../src/local/db';
import { describeUse } from '../src/game/targeting';
import { constructionRoom } from '../src/game/constructionviews';
const cell = (x: number, y: number, wall = false): BuildCell => ({
  x,
  y,
  kind: 'structure',
  sub: 'cell',
  owner: 'builder',
  data: { floor: 'timber_floor', roof: 'shingle_roof', ...(wall ? { wall: 'timber_wall' } : {}) },
});
it('preserves independent furnishings and construction in local saves and deletions', async () => {
  const repo = new LocalRepo(await LocalDb.open()),
    built = cell(31, 32),
    chest = { x: 31, y: 32, kind: 'chest' as const, sub: 'chest', owner: 'builder', data: { slots: [] } };
  await repo.saveObjects(7, [built, chest], []);
  expect(await repo.loadObjects(7, 0, 1)).toHaveLength(2);
  await repo.saveObjects(7, [], [{ x: 31, y: 32, structure: true }]);
  expect(await repo.loadObjects(7, 0, 1)).toEqual([chest]);
  await repo.saveObjects(7, [built], []);
  await repo.saveObjects(7, [], [{ x: 31, y: 32 }]);
  expect(await repo.loadObjects(7, 0, 1)).toEqual([built]);
});
it('cuts away only the connected room and stops at walls', () => {
  const s = new ChunkStore(7);
  for (const c of [cell(0, 0), cell(1, 0), cell(2, 0, true), cell(3, 0)]) s.putObject(c);
  const room = constructionRoom(s, 0, 0);
  expect(room.has('1,0')).toBe(true);
  expect(room.has('2,0')).toBe(true);
  expect(room.has('3,0')).toBe(false);
  expect(constructionRoom(s, 4, 0).size).toBe(0);
});
it('routes structural placement and reclamation before opening the furniture below', () => {
  const c = cell(0, 0),
    chest = { x: 0, y: 0, kind: 'chest' as const, sub: 'chest' };
  expect(describeUse({ id: 'pickaxe', n: 1 }, T.FLOOR, chest, 0, c)).toMatchObject({
    kind: 'tool',
    label: 'Reclaim Slate Roof',
  });
  expect(describeUse({ id: 'timber_wall', n: 1 }, T.FLOOR, undefined, 0, c)).toMatchObject({ kind: 'place', ok: true });
  expect(describeUse(null, T.FLOOR, chest, 0, c)).toMatchObject({ kind: 'open', label: 'Open chest' });
  expect(describeUse({ id: 'stone_floor', n: 1 }, T.WATER, undefined, 0)).toMatchObject({ kind: 'place', ok: false });
});
