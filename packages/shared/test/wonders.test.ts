import { describe, expect, it } from 'vitest';
import {
  sanctuaryAt,
  bountyOf,
  compassWord,
  rainbowAt,
  realmTowns,
  starfallOn,
  weatherForDay,
  type Town,
} from '../src/index';

const SEED = 20260101;

describe('starfall and the sky', () => {
  it('starfall comes on roughly one night in seven, and only under a clear or cloudy sky', () => {
    let n = 0;
    for (let d = 0; d < 700; d++)
      if (starfallOn(SEED, d)) {
        n++;
        expect(['clear', 'cloudy']).toContain(weatherForDay(SEED, d));
      }
    expect(n).toBeGreaterThan(40);
    expect(n).toBeLessThan(160);
  });

  it('a rainbow hangs in the morning after rain, and only then', () => {
    let seen = 0;
    for (let d = 1; d < 400; d++) {
      const after = ['rain', 'storm'].includes(weatherForDay(SEED, d - 1));
      const clear = ['clear', 'cloudy'].includes(weatherForDay(SEED, d));
      expect(rainbowAt(SEED, d, 8)).toBe(after && clear);
      expect(rainbowAt(SEED, d, 13)).toBe(false);
      if (after && clear) seen++;
    }
    expect(seen).toBeGreaterThan(5);
  });

  it('the compass reads the screen: up is north', () => {
    expect(compassWord(-1, -1)).toBe('north');
    expect(compassWord(1, 1)).toBe('south');
    expect(compassWord(1, -1)).toBe('east');
    expect(compassWord(-1, 1)).toBe('west');
  });
});

describe('town bounties', () => {
  it('most towns post a named beast each day, out in the hills, the same for everyone', () => {
    const towns: Town[] = realmTowns(SEED, 6).slice(0, 20);
    let posted = 0;
    for (const t of towns)
      for (let d = 0; d < 5; d++) {
        const b = bountyOf(SEED, t, d);
        expect(bountyOf(SEED, t, d)).toEqual(b);
        if (!b) continue;
        posted++;
        const r = Math.hypot(b.x - t.cx, b.y - t.cy);
        expect(r).toBeGreaterThan(45);
        // never inside a ward, where the beast would be dispersed as it appeared
        expect(sanctuaryAt(SEED, b.x, b.y), `${t.name} day ${d}`).toBeNull();
        expect(b.reward).toBeGreaterThanOrEqual(120);
        expect(b.id).toBe(`bty:${t.name}:${d}`);
      }
    expect(posted).toBeGreaterThan(50);
  });
});
