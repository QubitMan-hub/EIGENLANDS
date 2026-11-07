import { expect, it } from 'vitest';
import { ChunkStore, T, CAVE_OY, DIVE_OY } from '@eigenlands/shared';
import { secretSites, secretGround, SECRET_STORIES } from '../src/game/secret-plan';
import { personToolAxes } from '../src/art/body';
it('keeps discoveries deterministic, sparse and stable across negative coordinates and planes', () => {
  const kinds = new Set<string>();
  for (const seed of [7, 42])
    for (const oy of [0, CAVE_OY, DIVE_OY])
      for (let x = -400; x < 400; x += 40) {
        const sites = secretSites(seed, x, oy + 100);
        expect(sites).toEqual(secretSites(seed, x, oy + 100));
        expect(sites.length).toBeLessThanOrEqual(4);
        for (const s of sites) {
          expect(Math.hypot(s.x - x, s.y - oy - 100)).toBeLessThanOrEqual(62);
          expect(SECRET_STORIES[s.kind]).toHaveLength(2);
          kinds.add(s.kind);
        }
      }
  expect(kinds.size).toBeGreaterThanOrEqual(3);
});
it('never generates unloaded ground and yields to edits, roads and occupied plots', () => {
  const s = new ChunkStore(7, 128, 7);
  expect(secretGround(s, 30000, 30000)).toBe(false);
  expect(s.has(937, 937)).toBe(false);
  const c = s.get(0, 0);
  c.tiles.fill(T.GRASS);
  c.levels?.fill(0);
  expect(secretGround(s, 5, 5)).toBe(true);
  s.setTile(5, 5, T.GRASS);
  expect(secretGround(s, 5, 5)).toBe(false);
  s.putObject({ x: 6, y: 5, kind: 'crop', sub: 'turnip' });
  expect(secretGround(s, 6, 5)).toBe(false);
  c.tiles[7 + 5 * 32] = T.PATH;
  expect(secretGround(s, 7, 5)).toBe(false);
});
it('projects physical tool axes with facing-dependent foreshortening for both bodies', () => {
  for (const body of ['male', 'female'] as const) {
    const views = Array.from({ length: 8 }, (_, d) => personToolAxes(d, 0, body));
    expect(new Set(views.map((v) => JSON.stringify(v))).size).toBe(8);
    for (const v of views) {
      expect(Math.hypot(v.along.x, v.along.y)).toBeLessThanOrEqual(Math.sqrt(1.25) + 1e-9);
      expect(Math.hypot(v.across.x, v.across.y)).toBeLessThanOrEqual(1);
    }
  }
});
