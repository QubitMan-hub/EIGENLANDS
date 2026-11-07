import { describe, expect, it } from 'vitest';
import {
  FLORA,
  WILDLIFE,
  NATURE_HABITATS,
  floraFor,
  wildlifeFor,
  floraPatchAt,
  type NatureContext,
} from '../src/nature';

const context = (habitat: NatureContext['habitat']): NatureContext => ({
  habitat,
  nearWater: true,
  wooded: true,
  flowering: true,
  season: 1,
  hour: 12,
  weather: 'clear',
});

describe('biodiversity habitats', () => {
  it('actually selects at least forty plants and thirty wildlife species across suitable habitats', () => {
    const plants = new Set<string>(),
      animals = new Set<string>();
    for (const habitat of NATURE_HABITATS) {
      const c = context(habitat);
      for (let i = 0; i < 300; i++) {
        const f = floraFor(c, i / 300);
        if (f) plants.add(f.id);
      }
      for (const hour of [0, 7, 12, 18, 22])
        for (const season of [0, 1, 2, 3])
          for (const weather of ['clear', 'rain'] as const)
            for (const a of wildlifeFor({ ...c, hour, season, weather })) animals.add(a.id);
    }
    expect(plants.size).toBeGreaterThanOrEqual(40);
    expect(animals.size).toBeGreaterThanOrEqual(30);
    expect(plants.size).toBe(FLORA.length);
    expect(animals.size).toBe(WILDLIFE.length);
  });

  it('keeps aquatic species, cold climates, and daylight activity meaningful', () => {
    const meadow = context('meadow');
    expect(wildlifeFor({ ...meadow, nearWater: false }).some((s) => s.id === 'frog' || s.id === 'duck')).toBe(false);
    expect(wildlifeFor({ ...meadow, weather: 'rain' }).some((s) => s.id === 'bee')).toBe(false);
    expect(wildlifeFor({ ...meadow, season: 3 }).some((s) => s.id === 'bee' || s.id === 'hedgehog')).toBe(false);
    expect(wildlifeFor({ ...meadow, hour: 23 }).some((s) => s.id === 'moth')).toBe(true);
    expect(wildlifeFor({ ...meadow, hour: 12 }).some((s) => s.id === 'moth')).toBe(false);
    expect(wildlifeFor({ ...meadow, weather: 'rain' }).some((s) => s.id === 'frog')).toBe(true);
    expect(wildlifeFor(context('taiga')).every((s) => s.habitats.includes('taiga'))).toBe(true);
  });

  it('separates cave and realm ecology from surface fields', () => {
    for (const habitat of ['cave:crystal', 'realm:aetheria', 'realm:umbra', 'realm:chronoria'] as const) {
      const c = context(habitat);
      expect(floraFor(c, 0.5)).not.toBeNull();
      expect(wildlifeFor(c).length).toBeGreaterThan(0);
      expect(wildlifeFor(c).every((s) => s.habitats.includes(habitat))).toBe(true);
      expect(wildlifeFor(c).some((s) => s.id === 'bee' || s.id === 'duck')).toBe(false);
    }
  });

  it('forms reproducible vegetation patches with variety across seeds', () => {
    const c = context('forest');
    const layouts = new Set<string>();
    for (const seed of [7, 42, 20260101]) {
      const kinds: string[] = [];
      for (let x = -240; x < 240; x += 24) {
        const a = floraPatchAt(seed, x + 2, 100, c);
        expect(floraPatchAt(seed, x + 2, 100, c)).toBe(a);
        expect(floraPatchAt(seed, x + 3, 101, c)).toBe(a);
        kinds.push(a!.id);
      }
      expect(new Set(kinds).size).toBeGreaterThan(3);
      layouts.add(kinds.join(','));
    }
    expect(layouts.size).toBe(3);
  });
});
