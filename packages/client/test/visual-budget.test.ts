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

it('performance tier draws one canvas pixel per art pixel at the same framing', async () => {
  const { tierResolution, initialTier } = await import('../src/game/visual-budget');
  expect(tierResolution(1, 'high', 2)).toBe(1);
  expect(tierResolution(1, 'performance', 2)).toBe(0.5);
  expect(tierResolution(2, 'performance', 3)).toBeCloseTo(1 / 3, 10);
  expect(tierResolution(1, 'performance', 0)).toBe(1);
  expect(initialTier('auto', false, 8, 8)).toBe('high');
  expect(initialTier('auto', true, 8, 8)).toBe('economy');
  expect(initialTier('performance', false, 16, 16)).toBe('performance');
});

it('auto quality steps down on sustained slow frames, up only after long headroom, and never oscillates', async () => {
  const { AdaptiveQuality } = await import('../src/game/visual-budget');
  const q = new AdaptiveQuality();
  let t = 0,
    tier: 'high' | 'economy' | 'performance' = 'high';
  const run = (ms: number, interval: number) => {
    const out: string[] = [];
    for (const end = t + ms; t < end; t += interval) {
      const next = q.sample(t, interval, tier);
      if (next) {
        tier = next;
        out.push(next);
      }
    }
    return out;
  };
  expect(run(3000, 100)).toEqual([]); // settling after start
  q.reset(t);
  expect(run(14000, 60)).toEqual(['economy', 'performance']);
  expect(run(20000, 10)).toEqual([]); // a short fast stretch is not enough
  expect(run(15000, 10)).toEqual(['economy']);
  expect(run(10000, 60)).toEqual(['performance']); // economy failed twice now
  expect(run(120000, 10)).toEqual([]); // so it is not retried
  expect(run(15000, 3000)).toEqual([]); // hidden-tab gaps are ignored
});

it('still steps down on a machine that only manages two frames a second', async () => {
  const { AdaptiveQuality } = await import('../src/game/visual-budget');
  const q = new AdaptiveQuality();
  let tier: 'high' | 'economy' | 'performance' = 'economy';
  for (let t = 0; t < 12000; t += 450) tier = q.sample(t, 450, tier) ?? tier;
  expect(tier).toBe('performance');
});
