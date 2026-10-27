import { expect, it } from 'vitest';
import { BOSSES } from '@eigenlands/shared';
import manifest from '../src/art/boss-manifest.json';
import { BOSS_CREATURE_DEFS, REDESIGNED_BOSSES } from '../src/art/boss-creatures';
it('gives every boss a dedicated authored atlas, four facings and every supported animation within mobile texture limits', () => {
  expect([...REDESIGNED_BOSSES].sort()).toEqual(Object.keys(BOSSES).sort());
  for (const id of REDESIGNED_BOSSES) {
    const layout = manifest.atlases[id],
      rig = BOSS_CREATURE_DEFS[id];
    expect(layout.w * layout.cols).toBeLessThanOrEqual(2048);
    expect(layout.h * layout.rows).toBeLessThanOrEqual(2048);
    expect(layout.rows).toBe(4 * layout.poseRows);
    expect(layout.ay).toBeGreaterThan(layout.h / 2);
    expect(layout.ay).toBeLessThan(layout.h);
    expect(layout.frames).toEqual(rig.n);
    expect(Object.values(rig.n).every((n) => n > 0)).toBe(true);
    expect(Object.values(rig.n).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(layout.cols * layout.poseRows);
    expect(manifest.portraits).toContain(id);
  }
});
