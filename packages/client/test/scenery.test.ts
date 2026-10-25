import { expect, it } from 'vitest';
import { ChunkStore, T, chunkOf, hash2 } from '@eigenlands/shared';
import { sceneryAt } from '../src/game/scenery';

it('places repeatable sparse scenery across positive and negative chunk boundaries', () => {
  const a = new ChunkStore(20260101),
    b = new ChunkStore(20260101);
  const found: Array<[number, number, string]> = [];
  for (let gy = -12; gy <= 12; gy++)
    for (let gx = -12; gx <= 12; gx++) {
      const x = gx * 8 + Math.floor(hash2(a.seed, gx, gy, 1201) * 8);
      const y = gy * 8 + Math.floor(hash2(a.seed, gx, gy, 1202) * 8);
      const kind = sceneryAt(a, x, y);
      expect(sceneryAt(b, x, y)).toBe(kind);
      if (kind) found.push([x, y, kind]);
    }
  expect(found.length).toBeGreaterThan(15);
  expect(found.some(([x]) => x < 0)).toBe(true);
  for (const [x, y] of found) {
    const solid = a.solidAt(x, y);
    expect(solid).toBe(false);
    a.setTile(x, y, T.FLOOR);
    expect(sceneryAt(a, x, y)).toBeNull();
    a.setTile(x, y, T.GRASS); // even a restored tile belongs to the player now
    expect(sceneryAt(a, x, y)).toBeNull();
    expect(a.get(chunkOf(x), chunkOf(y)).diff.size).toBeGreaterThan(0);
  }
});

it('keeps spawn, town paths and occupied tiles clear', () => {
  const s = new ChunkStore(20260101);
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) expect(sceneryAt(s, x, y)).toBeNull();
  let placed = false;
  for (let gy = 2; gy < 20 && !placed; gy++)
    for (let gx = 2; gx < 20 && !placed; gx++) {
      const x = gx * 8 + Math.floor(hash2(s.seed, gx, gy, 1201) * 8),
        y = gy * 8 + Math.floor(hash2(s.seed, gx, gy, 1202) * 8);
      if (!sceneryAt(s, x, y)) continue;
      s.putObject({ x, y, kind: 'crop', sub: 'turnip' });
      expect(sceneryAt(s, x, y)).toBeNull();
      placed = true;
    }
  expect(placed).toBe(true);
});
