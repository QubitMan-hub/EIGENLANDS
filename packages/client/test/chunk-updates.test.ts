import { expect, it } from 'vitest';
import { ChunkStore, T, encodeDiff, type ChunkMsg } from '@eigenlands/shared';
import { applyChunkSnapshot } from '../src/game/chunk-updates';
it('skips unchanged snapshots and reports only genuinely changed ground', () => {
  const store = new ChunkStore(7);
  store.setTile(0, 0, T.GRASS);
  const m: ChunkMsg = { cx: 0, cy: 0, diff: encodeDiff(new Map([[0, T.GRASS]])), objs: [] };
  expect(applyChunkSnapshot(store, m).tiles).toHaveLength(0);
  m.diff = encodeDiff(new Map([[0, T.ROCK]]));
  expect(applyChunkSnapshot(store, m).tiles).toEqual([{ x: 0, y: 0 }]);
  expect(store.solidAt(0, 0)).toBe(true);
});
it('reconciles both layers without dropping furniture or leaving stale collision', () => {
  const store = new ChunkStore(7);
  store.setTile(-1, 32, T.GRASS);
  const structure = {
    x: -1,
    y: 32,
    kind: 'structure' as const,
    sub: 'cell',
    owner: 'a',
    data: { floor: 'timber_floor', wall: 'stone_wall' },
  };
  const chest = { x: -1, y: 32, kind: 'chest' as const, sub: 'chest', owner: 'a' };
  const m: ChunkMsg = { cx: -1, cy: 1, diff: encodeDiff(new Map()), objs: [structure, chest] };
  expect(applyChunkSnapshot(store, m).tiles).toHaveLength(1);
  expect(store.solidAt(-1, 32)).toBe(true);
  expect(applyChunkSnapshot(store, m).tiles).toHaveLength(0);
  m.objs = [chest];
  applyChunkSnapshot(store, m);
  expect(store.structureAt(-1, 32)).toBeUndefined();
  expect(store.objectAt(-1, 32)).toEqual(chest);
  m.objs = [];
  applyChunkSnapshot(store, m);
  expect(store.solidAt(-1, 32)).toBe(false);
});
