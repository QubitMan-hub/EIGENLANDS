import { describe, expect, it } from 'vitest';
import { depth, isoX, isoY, project, screenDir, unproject } from '../src/game/iso';

describe('isometric projection', () => {
  it('maps tiles to 32x16 diamonds and round-trips', () => {
    expect(isoX(1, 0) - isoX(0, 0)).toBe(16);
    expect(isoY(1, 0) - isoY(0, 0)).toBe(8);
    expect(isoX(0, 1) - isoX(0, 0)).toBe(-16);
    for (const [x, y] of [[0, 0], [3.5, -2.25], [-40, 17]] as const) {
      const p = project(x, y), u = unproject(p.x, p.y);
      expect(u.x).toBeCloseTo(x, 9); expect(u.y).toBeCloseTo(y, 9);
    }
  });
  it('sorts nearer things on top and picks screen directions', () => {
    expect(depth(5, 5)).toBeGreaterThan(depth(4, 5));
    expect(depth(5, 6)).toBeGreaterThan(depth(5, 5));
    expect(screenDir(1, 0)).toEqual({ x: 16, y: 8 });
    expect(screenDir(-1, -1).x).toBe(0);
    expect(screenDir(-1, -1).y).toBeLessThan(0);
  });
});
