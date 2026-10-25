import { expect, it } from 'vitest';
import { T } from '@eigenlands/shared';
import { fishingTarget } from '../src/game/targeting';
it('casts from a shore without cursor precision, prefers a valid water aim, and refuses inland or distant targets', () => {
  const tile = (x: number, y: number) => ((x === 2 && y === 0) || (x === 4 && y === 1) ? T.WATER : T.GRASS);
  expect(fishingTarget(0.5, 0.5, tile, null)).toEqual({ tx: 2, ty: 0 });
  expect(fishingTarget(0.5, 0.5, tile, { tx: 4, ty: 1 })).toEqual({ tx: 4, ty: 1 });
  expect(fishingTarget(0.5, 0.5, tile, { tx: 30, ty: 0 })).toEqual({ tx: 2, ty: 0 });
  expect(fishingTarget(-20, 0.5, tile, null)).toBeNull();
});
