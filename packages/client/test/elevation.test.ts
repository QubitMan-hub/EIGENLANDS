import { afterEach, describe, expect, it } from 'vitest';
import { CHUNK_SIZE, ChunkStore, LEVEL_PX, MAX_LEVEL, encodeDiff, type ChunkMsg } from '@eigenlands/shared';
import { applyChunkSnapshot } from '../src/game/chunk-updates';
import { depth, isoX, isoY, isoYFlat, occluded, setLift, softLevel, tileDiamond, unproject } from '../src/game/iso';

afterEach(() => setLift(null));

describe('elevated projection', () => {
  it('lifts everything that projects with isoY, while depth and the terrain plane stay flat', () => {
    const levels = (x: number, y: number) => (Math.floor(x) >= 10 ? 3 : 0);
    setLift((x, y) => softLevel(levels, x, y) * LEVEL_PX);
    expect(isoY(12.5, 4.5)).toBe(isoYFlat(12.5, 4.5) - 3 * LEVEL_PX);
    expect(isoY(2.5, 4.5)).toBe(isoYFlat(2.5, 4.5));
    expect(isoX(12.5, 4.5)).toBe((12.5 - 4.5) * 16); // sideways position never changes with height
    // depth order must not depend on height: a creature on the plateau still sorts by its ground position
    expect(depth(12.5, 4.5)).toBe(isoYFlat(12.5, 4.5) * 4 + 12.5 * 0.001);
    // the plain inverse is the flat-ground inverse; terrain picks add level * LEVEL_PX before inverting
    const lifted = { x: isoX(12.5, 4.5), y: isoY(12.5, 4.5) };
    const u = unproject(lifted.x, lifted.y + 3 * LEVEL_PX);
    expect(u.x).toBeCloseTo(12.5, 9);
    expect(u.y).toBeCloseTo(4.5, 9);
  });

  it('glides up a ramp but never sags into a cliff', () => {
    // a ramp rising along x then a sheer 5-level wall at x = 8
    const ramp = (x: number) => (x >= 8 ? 6 : Math.min(3, Math.max(0, x - 4)));
    const at = (x: number) => softLevel((tx) => ramp(tx), x, 0.5);
    for (let x = 4.5; x < 7.5; x += 0.25) expect(at(x + 0.25)).toBeGreaterThanOrEqual(at(x) - 1e-9);
    expect(at(4.5)).toBeCloseTo(0, 6); // tile centres sit exactly on their own level
    expect(at(6.5)).toBeCloseTo(2, 6);
    // standing on the low tile beside the wall, the body is lifted by at most one level toward the wall's far side
    expect(at(7.99)).toBeLessThanOrEqual(4 + 1e-9);
    expect(at(8.01)).toBeGreaterThanOrEqual(5 - 1e-9);
  });

  it('hides what stands behind higher ground nearer the camera, not what stands in the open', () => {
    const wall = (x: number, y: number) => (x === 6 && y === 6 ? 4 : 0);
    expect(occluded(wall, 5.5, 5.5, 0)).toBe(true); // one tile behind a 4-level block
    expect(occluded(wall, 4.5, 4.5, 0)).toBe(true); // two tiles behind it
    expect(occluded(wall, 5.5, 5.5, 3)).toBe(false); // standing near its top: seen over the edge
    expect(occluded(wall, 5.5, 6.5, 0)).toBe(false); // off the view diagonal
    expect(occluded(() => 0, 5.5, 5.5, 0)).toBe(false);
  });

  it('draws a tile cursor flush on its level', () => {
    const flat = tileDiamond(3, 4);
    const raised = tileDiamond(3, 4, 2 * LEVEL_PX);
    for (let i = 0; i < 8; i += 2) {
      expect(raised[i]).toBe(flat[i]);
      expect(raised[i + 1]).toBe(flat[i + 1]! - 2 * LEVEL_PX);
    }
  });
});

describe('authoritative chunk levels', () => {
  it('replaces locally derived levels with the server copy and says so', () => {
    const store = new ChunkStore(20260101, 64, 3);
    const mine = store.get(5, -2).levels!;
    const levels = new Uint8Array(mine);
    levels[7] = Math.min(MAX_LEVEL, levels[7]! + 2);
    const m: ChunkMsg = { cx: 5, cy: -2, diff: encodeDiff(new Map()), objs: [], levels };
    expect(applyChunkSnapshot(store, m).levels).toBe(true);
    expect(store.levelAt(5 * CHUNK_SIZE + 7, -2 * CHUNK_SIZE)).toBe(levels[7]);
    expect(applyChunkSnapshot(store, m).levels).toBe(false); // an identical resend changes nothing
  });

  it('rejects malformed levels and leaves flat revisions flat', () => {
    const store = new ChunkStore(20260101, 64, 3);
    const before = [...store.get(2, 2).levels!];
    expect(store.setLevels(2, 2, new Uint8Array(10))).toBe(false);
    expect(store.setLevels(2, 2, new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(MAX_LEVEL + 1))).toBe(false);
    expect([...store.get(2, 2).levels!]).toEqual(before);
    const old = new ChunkStore(20260101, 64, 2);
    expect(old.levelAt(3, 3)).toBe(0);
    const m: ChunkMsg = { cx: 0, cy: 0, diff: encodeDiff(new Map()), objs: [] };
    expect(applyChunkSnapshot(old, m).levels).toBe(false);
  });
});
