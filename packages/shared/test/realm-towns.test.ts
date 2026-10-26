import { describe, expect, it } from 'vitest';
import { REALM_SITES, isSolid, realmNpcs, realmTowns, tileAt } from '../src';

const SEED = 20260101;
const towns = realmTowns(SEED);
const walkable = (x: number, y: number) => !isSolid(tileAt(SEED, x, y, 5));

describe('realm towns', () => {
  it('builds one town per site, deterministically', () => {
    expect(towns.length).toBe(REALM_SITES.length);
    expect(realmTowns(SEED)).toBe(towns);
  });

  it('keeps buildings inside plots with an open door', () => {
    for (const t of towns) {
      expect(t.buildings.length).toBeGreaterThan(0);
      for (const b of t.buildings) {
        expect(b.x).toBeGreaterThanOrEqual(t.x0);
        expect(b.x + b.w).toBeLessThanOrEqual(t.x1 + 1);
        expect(b.y).toBeGreaterThanOrEqual(t.y0);
        expect(b.y + b.h).toBeLessThanOrEqual(t.y1 + 1);
        expect(b.style).toBeGreaterThanOrEqual(4);
        expect(isSolid(tileAt(SEED, b.doorX, b.doorY, 5)), `${t.name} ${b.id} door`).toBe(false);
      }
    }
  });

  it('gives every resident an open home spot', () => {
    const open = (x: number, y: number) => !isSolid(tileAt(SEED, x, y, 5));
    const spots: Record<string, { x: number; y: number }> = {};
    for (const t of towns) Object.assign(spots, t.spots);
    let missing = 0;
    for (const n of realmNpcs()) {
      const s = spots[`${n.id}.home`];
      if (!s) {
        missing++;
        continue;
      }
      expect(open(Math.floor(s.x), Math.floor(s.y)), `${n.id} home`).toBe(true);
    }
    expect(missing).toBe(0);
  });

  it('keeps every door and resident spot reachable from the main gate road', () => {
    for (const t of towns) {
      const seen = new Set<number>();
      const W = t.x1 - t.x0 + 1;
      const key = (x: number, y: number) => x - t.x0 + (y - t.y0) * W;
      const q: Array<[number, number]> = [[t.cx, t.cy]];
      seen.add(key(t.cx, t.cy));
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
          if (nx < t.x0 || nx > t.x1 || ny < t.y0 || ny > t.y1 || seen.has(key(nx, ny)) || !walkable(nx, ny)) continue;
          seen.add(key(nx, ny));
          q.push([nx, ny]);
        }
      }
      for (const b of t.buildings) {
        if ((b.kind as string) === 'tower') continue;
        expect(seen.has(key(b.doorX, b.doorY + 1)), `${t.name} ${b.id} door street`).toBe(true);
      }
      for (const [name, sp] of Object.entries(t.spots)) {
        if (/\.(wall|throne|gate|field)$/.test(name)) continue;
        expect(seen.has(key(sp.x, sp.y)), `${t.name} ${name}`).toBe(true);
      }
    }
  });
});
