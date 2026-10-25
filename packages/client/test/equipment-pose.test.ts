import { expect, it } from 'vitest';
import { personGrip, SHOT_FRAME, CAST_FRAME, RUN_FRAME } from '../src/art/actors';

it('keeps the held grip on the striking hand in every facing and pose', () => {
  for (let d = 0; d < 8; d++)
    for (let f = -1; f < CAST_FRAME + 4; f++) {
      const p = personGrip(d, f);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(24);
      expect(p.y).toBeGreaterThan(8);
      expect(p.y).toBeLessThan(29);
      expect(Number.isFinite(p.angle)).toBe(true);
    }
  expect(personGrip(3, 11).x).toBeGreaterThan(personGrip(3, 13).x + 3);
  expect(personGrip(2, 11).x).toBeLessThan(personGrip(2, 13).x - 3);
});

it('aims crossbows toward the target while staves recover into an upright guard', () => {
  expect(personGrip(3, SHOT_FRAME + 1).angle).toBeCloseTo(0);
  expect(personGrip(2, SHOT_FRAME + 1).angle).toBeCloseTo(Math.PI);
  expect(personGrip(0, SHOT_FRAME + 1).angle).toBeCloseTo(Math.PI / 2);
  expect(personGrip(3, CAST_FRAME + 1).angle).not.toBe(personGrip(3, CAST_FRAME + 3).angle);
  expect(personGrip(3, RUN_FRAME).x).not.toBe(personGrip(3, RUN_FRAME + 2).x);
});
