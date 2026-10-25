import { expect, it } from 'vitest';
import { economyGraphics, weatherBudget, validGraphics, validWeather } from '../src/game/visual-budget';
it('keeps explicit graphics preferences and chooses a lighter automatic phone preset', () => {
  expect(economyGraphics('auto', true, 8, 8)).toBe(true);
  expect(economyGraphics('auto', false, 8, 8)).toBe(false);
  expect(economyGraphics('auto', false, 4, 8)).toBe(true);
  expect(economyGraphics('high', true, 2, 2)).toBe(false);
  expect(validGraphics('broken')).toBe('auto');
  expect(validWeather('broken')).toBe('gentle');
});
it('makes mobile storms gentler without changing weather gameplay and disables flashes for reduced motion', () => {
  const low = weatherBudget('storm', 'gentle', true, false, 844, 390),
    full = weatherBudget('storm', 'full', false, false, 1280, 720);
  expect(low.rain).toBeLessThanOrEqual(30);
  expect(full.rain).toBeGreaterThan(low.rain);
  expect(low.flash).toBe(false);
  expect(weatherBudget('storm', 'off', false, false, 1280, 720)).toMatchObject({ rain: 0, snow: 0, flash: false });
  expect(weatherBudget('storm', 'full', false, true, 1280, 720)).toMatchObject({ flash: false });
});

it('keeps integer native pixels at fractional DPR without an oversized canvas', async () => {
  const { pixelResolution } = await import('../src/game/visual-budget');
  for (const dpr of [0.8, 1, 1.25, 1.75, 2, 2.625, 3, 4])
    for (const low of [true, false]) {
      const r = pixelResolution(dpr, low);
      expect(r).toBeLessThanOrEqual(low ? 1 : 3);
      expect(dpr / r).toBeCloseTo(Math.round(dpr / r), 10);
    }
});
