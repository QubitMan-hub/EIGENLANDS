import { expect, it } from 'vitest';
import { healthReading, selectBoss, bossPhase } from '../src/ui/encounter-model';

it('bounds health and handles unavailable or corrupt maxima without invalid CSS', () => {
  expect(healthReading(120, 100)).toEqual({ hp: 100, max: 100, percent: 100 });
  expect(healthReading(-1, 100).hp).toBe(0);
  expect(healthReading(NaN, 0)).toEqual({ hp: 0, max: 0, percent: 0 });
});
it('selects a nearby boss instead of an out-of-reach boss with more health', () => {
  const near = { id: 'near', kind: 10, hp: 100, maxHp: 500, x: 4, y: 0 };
  const far = { id: 'far', kind: 12, hp: 2000, maxHp: 2000, x: 70, y: 0 };
  expect(selectBoss([far, near], { x: 0, y: 0 }, null)?.id).toBe('near');
  expect(selectBoss([far], { x: 0, y: 0 }, null)).toBeNull();
});
it('prefers a selected in-range boss and ignores dead or malformed candidates', () => {
  const a = { id: 'a', kind: 10, hp: 100, maxHp: 500, x: 4, y: 0 };
  const b = { ...a, id: 'b', kind: 11, x: 8 };
  expect(selectBoss([a, b], { x: 0, y: 0 }, 'b')?.id).toBe('b');
  expect(
    selectBoss(
      [
        { ...b, hp: 0 },
        { ...a, x: NaN },
      ],
      { x: 0, y: 0 },
      null,
    ),
  ).toBeNull();
});
it('uses the same inclusive phase thresholds as the authoritative encounter', () => {
  expect(bossPhase(10, 67, 100)).toBe(1);
  expect(bossPhase(10, 66, 100)).toBe(2);
  expect(bossPhase(10, 33, 100)).toBe(3);
  expect(bossPhase(11, 50, 100)).toBe(2);
});
