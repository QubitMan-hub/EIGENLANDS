import { expect, it } from 'vitest';
import { Profile } from '../src/game/profile';
import { describeUse } from '../src/game/targeting';
import { T } from '@eigenlands/shared';
it('keeps authoritative needs across unrelated private updates', () => {
  const p = new Profile();
  expect(p.needs.mode).toBe('cozy');
  p.apply({ needs: { mode: 'adventure', food: 42, water: 67, temp: 0 } });
  p.apply({ coins: 5 });
  expect(p.needs).toEqual({ mode: 'adventure', food: 42, water: 67, temp: 0 });
});
it('routes well refill and drinking through real item use instead of opening decoration', () => {
  const well = { id: 'well', kind: 'deco' as const, sub: 'well', x: 1, y: 1, static: true };
  expect(describeUse({ id: 'waterskin_empty', n: 1 }, T.GRASS, well, 0)).toMatchObject({ kind: 'refill', ok: true });
  expect(describeUse({ id: 'waterskin_full', n: 1 }, T.GRASS, well, 0)).toMatchObject({ kind: 'eat', ok: true });
  expect(describeUse({ id: 'waterskin_empty', n: 1 }, T.WATER, undefined, 0)).toMatchObject({ ok: false });
});
