import { expect, it } from 'vitest';
import { COMPANION_BONDS, companionBond, shadowStats } from '../src';

it('defines distinct, playable bonds using existing forage and creature stats', () => {
  expect(COMPANION_BONDS.filter((b) => !b.level).map((b) => [b.kind, b.food, b.count])).toEqual([
    [7, 'hazelnut', 3],
    [9, 'mushroom', 2],
    [3, 'blackberry', 3],
    [15, 'egg', 2],
  ]);
  expect(new Set(COMPANION_BONDS.map((b) => b.trait)).size).toBe(COMPANION_BONDS.length);
  for (const b of COMPANION_BONDS) {
    expect(companionBond(b.kind)).toBe(b);
    expect(shadowStats(b.kind, 1).hp).toBeGreaterThan(0);
  }
  expect(companionBond(0)).toBeUndefined();
  expect(companionBond(21)).toBeUndefined();
});
