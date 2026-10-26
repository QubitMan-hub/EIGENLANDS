import { describe, expect, it } from 'vitest';
import { REALM_GEO, REALM_IDS, REALM_SITES, generateLevels, isSolid, tileAt, type RealmId } from '../src';

const SEED = 20260101;
const open = (x: number, y: number) => !isSolid(tileAt(SEED, x, y, 5));

function reach(from: { x: number; y: number }, x0: number, y0: number, x1: number, y1: number): Set<number> {
  const W = x1 - x0 + 1,
    seen = new Set<number>(),
    key = (x: number, y: number) => x - x0 + (y - y0) * W;
  const q: Array<[number, number]> = [[from.x, from.y]];
  seen.add(key(from.x, from.y));
  while (q.length) {
    const [x, y] = q.pop()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx,
        ny = y + dy;
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1 || seen.has(key(nx, ny)) || !open(nx, ny)) continue;
      seen.add(key(nx, ny));
      q.push([nx, ny]);
    }
  }
  return seen;
}

describe('the six realms', () => {
  it('every settlement plot lies inside one shard', () => {
    const shard = (t: number) => Math.floor((t + 128) / 256);
    for (const s of REALM_SITES) {
      expect(shard(s.cx - s.w / 2)).toBe(shard(s.cx + s.w / 2 - 1));
      expect(shard(s.cy - s.h / 2)).toBe(shard(s.cy + s.h / 2 - 1));
    }
    expect(REALM_SITES).toHaveLength(78);
  });
  for (const id of REALM_IDS.filter((r) => r !== 'thalassara') as RealmId[]) {
    it(`${id}: the capital reaches every town on foot along the royal roads`, () => {
      const g = REALM_GEO[id];
      const box = [g.cx - 420, g.cy - 420, g.cx + 420, g.cy + 420] as const;
      const seen = reach({ x: g.cx, y: g.cy }, ...box);
      const W = box[2] - box[0] + 1;
      for (const s of REALM_SITES.filter((s) => s.realm === id && s.kind === 'town'))
        expect(seen.has(s.cx - box[0] + (s.cy - box[1]) * W), `${s.id}`).toBe(true);
    });
  }
  it('has land, sea and varied terrain levels', () => {
    for (const id of REALM_IDS) {
      const g = REALM_GEO[id];
      let land = 0,
        high = 0;
      for (let cy = -5; cy <= 5; cy++)
        for (let cx = -5; cx <= 5; cx++) {
          const ccx = Math.floor(g.cx / 32) + cx,
            ccy = Math.floor(g.cy / 32) + cy;
          const tiles = [] as number[];
          for (let i = 0; i < 32; i += 8) tiles.push(tileAt(SEED, ccx * 32 + i, ccy * 32 + i, 5));
          land += tiles.filter((t) => !isSolid(t)).length;
          high += generateLevels(SEED, ccx, ccy, 5).some((v) => v >= 3) ? 1 : 0;
        }
      expect(land).toBeGreaterThan(40);
      if (id === 'khardum') expect(high).toBeGreaterThan(3);
    }
  });
});
