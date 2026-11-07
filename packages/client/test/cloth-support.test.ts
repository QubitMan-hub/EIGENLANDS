import { expect, it } from 'vitest';
import { DIMS, legPointAt, solve, type V3 } from '../src/art/body/skeleton';
import { poseOf } from '../src/art/body/poses';

it('keeps cloth support within bent-leg bounds, including knees above hips and prone poses', () => {
  for (const d of Object.values(DIMS))
    for (const frame of [0, 78, 86, 142, 150, 234, 246]) {
      const j = solve(d, poseOf(d, frame, 4));
      for (const side of ['L', 'R'] as const) {
        const hip = j[`hip${side}`],
          knee = j[`knee${side}`],
          ankle = j[`ankle${side}`];
        for (let z = -2; z <= d.height + 4; z += 0.5) {
          const p = legPointAt(hip, knee, ankle, z);
          for (let axis = 0; axis < 3; axis++) {
            expect(p[axis]).toBeGreaterThanOrEqual(Math.min(hip[axis]!, knee[axis]!, ankle[axis]!) - 1e-6);
            expect(p[axis]).toBeLessThanOrEqual(Math.max(hip[axis]!, knee[axis]!, ankle[axis]!) + 1e-6);
          }
        }
      }
    }
  const hip: V3 = [0, 2, 10],
    knee: V3 = [5, 4, 14],
    ankle: V3 = [7, 4, 5];
  expect(legPointAt(hip, knee, ankle, 12)).toEqual([2.5, 3, 12]);
});
