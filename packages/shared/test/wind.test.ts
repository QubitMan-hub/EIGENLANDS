import { describe, expect, it } from 'vitest';
import { gust, sway, windBase, windScreenX, type Wind } from '../src/wind';

describe('wind', () => {
  it('is deterministic and has a unit direction', () => {
    const a = windBase(7, 1234.5, 'clear'), b = windBase(7, 1234.5, 'clear');
    expect(a).toEqual(b);
    expect(Math.hypot(a.dx, a.dy)).toBeCloseTo(1, 6);
  });
  it('storms blow harder than fog and the heading turns smoothly', () => {
    expect(windBase(1, 100, 'storm').strength).toBeGreaterThan(windBase(1, 100, 'fog').strength);
    let prev = windBase(3, 0, 'clear');
    for (let t = 5; t < 2000; t += 5) {
      const w = windBase(3, t, 'clear');
      expect(Math.abs(w.dx - prev.dx) + Math.abs(w.dy - prev.dy)).toBeLessThan(0.12);
      prev = w;
    }
  });
  it('gust fronts travel downwind and stay in 0..1', () => {
    const w: Wind = { dx: 1, dy: 0, strength: 0.6 };
    for (let i = 0; i < 200; i++) { const g = gust(w, i * 0.7, i * 0.3, i * 0.9); expect(g).toBeGreaterThanOrEqual(0); expect(g).toBeLessThanOrEqual(1); }
    // a crest at (0,0,t=0) later sits further along +x
    const g0 = gust(w, 0, 0, 0);
    const later = gust(w, 0.6 * 1.6 * 0 + (0.6 + 1.6 * 0.6) * 2 / 0.72, 0, 2);
    expect(later).toBeCloseTo(g0, 5);
  });
  it('plants lean with the wind direction and barely move when calm', () => {
    const east: Wind = { dx: Math.SQRT1_2, dy: -Math.SQRT1_2, strength: 0.8 }; // screen-right
    expect(windScreenX(east)).toBeCloseTo(1, 6);
    let sum = 0; for (let t = 0; t < 30; t += 0.3) sum += sway(east, 3, 4, t, 1);
    expect(sum).toBeGreaterThan(0);
    const calm: Wind = { ...east, strength: 0 };
    for (let t = 0; t < 10; t += 0.5) expect(Math.abs(sway(calm, 3, 4, t, 1))).toBeLessThan(0.1);
  });
});
