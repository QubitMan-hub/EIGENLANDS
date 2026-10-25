import { describe, expect, it } from 'vitest';
import { REALM_SITES, isSolid, realmNpcs, realmTowns, tileAt } from '../src';

const SEED = 20260101;
const towns = realmTowns(SEED);

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
});
