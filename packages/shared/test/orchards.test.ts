import { expect, it } from 'vitest';
import { CROPS, advanceDay, afterHarvest, isRipe, daysToRipe, type CropData } from '../src/crops';
const crop = (id: string): CropData => ({ crop: id, planted: 0, growth: 0, watered: -1, lastDay: -1, owner: 'grower' });
it('establishes real orchard trees and trellises that survive dormancy and keep their size after picking', () => {
  expect(CROPS.apple?.shape).toBe('tree');
  expect(CROPS.grapes?.shape).toBe('trellis');
  let d = crop('apple');
  for (let day = 0; day < 20; day++) d = advanceDay(d, day, { rain: false, sprinkler: true, greenhouse: false });
  expect(d.dead).not.toBe(true);
  expect(d.established).toBe(true);
  expect(isRipe(d)).toBe(true);
  const picked = afterHarvest(d)!;
  expect(picked.established).toBe(true);
  expect(isRipe(picked)).toBe(false);
  for (let day = 20; day < 29; day++) d = advanceDay(d, day, { rain: false, sprinkler: true, greenhouse: false });
  expect(d.dormant).toBe(true);
  expect(d.dead).not.toBe(true);
  expect(isRipe(d)).toBe(false);
  expect(d.growth).toBeLessThanOrEqual(daysToRipe(d));
});
it('keeps ordinary crop season rules and prevents strong fertilizer from making instant crops', () => {
  expect(daysToRipe({ ...crop('turnip'), fert: 2 })).toBe(1);
  const ordinary = advanceDay({ ...crop('turnip'), lastDay: 5 }, 6, {
    rain: false,
    sprinkler: false,
    greenhouse: false,
  });
  expect(ordinary.dead).toBe(true);
});
