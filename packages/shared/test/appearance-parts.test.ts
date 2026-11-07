import { expect, it } from 'vitest';
import { validParts, partsKey, PART_COUNTS, packAppearance, DEFAULT_APPEARANCE } from '../src';
it('keeps old packed looks stable and defaults missing catalogs to classic', () => {
  expect(Object.values(validParts(null)).every((v) => v === 0)).toBe(true);
  expect(partsKey(null)).toBe('');
  expect(packAppearance({ ...DEFAULT_APPEARANCE, parts: validParts({ tops: 50 }) })).toBe(
    packAppearance(DEFAULT_APPEARANCE),
  );
});
it('validates every catalog boundary and canonicalizes network/storage data', () => {
  for (const field of Object.keys(PART_COUNTS) as (keyof typeof PART_COUNTS)[]) {
    expect(validParts({ [field]: PART_COUNTS[field] })[field]).toBe(PART_COUNTS[field]);
    for (const value of [-1, Infinity, NaN, 1.5, '4', PART_COUNTS[field] + 1])
      expect(validParts({ [field]: value })[field]).toBe(0);
  }
  const key = partsKey({ hair: 50, tops: 50, pants: 55, boots: 50 });
  expect(partsKey(key)).toBe(key);
  expect(partsKey('invalid')).toBe('');
  expect(validParts({ pants: 55, shorts: 50 })).toMatchObject({ pants: 0, shorts: 50 });
});
