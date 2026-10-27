import { describe, expect, it } from 'vitest';
import {
  CONDITIONS,
  DISEASES,
  ITEMS,
  ambientWarmth,
  diseaseRisk,
  graveInjuryOnHit,
  injuryOnHit,
  stepBodyTemp,
  thermalState,
  validTravelNeeds,
  type ThermoCtx,
} from '../src';

const base: ThermoCtx = {
  biome: 'meadow',
  cave: null,
  hour: 12,
  weather: 'clear',
  season: 0,
  indoors: false,
  fire: false,
  coldResist: 0,
  heatResist: 0,
  exerted: false,
};

describe('body temperature', () => {
  it('swings hard in deserts and stays cold in taiga and frost caves', () => {
    const noon = ambientWarmth({ ...base, biome: 'desert', hour: 12 }),
      night = ambientWarmth({ ...base, biome: 'desert', hour: 0 });
    expect(noon).toBeGreaterThan(0.6);
    expect(night).toBeLessThan(-0.2);
    expect(ambientWarmth({ ...base, biome: 'taiga', season: 3, weather: 'snow' })).toBeLessThan(-0.8);
    expect(ambientWarmth({ ...base, cave: 'frost' })).toBeLessThan(-0.7);
    expect(ambientWarmth({ ...base, cave: 'basalt' })).toBeGreaterThan(0.6);
    expect(ambientWarmth(base)).toBeGreaterThan(-0.2);
  });
  it('fires and shelter warm the cold; tonics blunt the extremes', () => {
    const cold = { ...base, biome: 'taiga' as const, season: 3 };
    const open = ambientWarmth(cold);
    expect(ambientWarmth({ ...cold, fire: true })).toBeGreaterThan(open + 0.5);
    expect(ambientWarmth({ ...cold, indoors: true })).toBeGreaterThan(open);
    expect(ambientWarmth({ ...cold, coldResist: 0.7 })).toBeGreaterThan(open);
    const hot = { ...base, biome: 'desert' as const };
    expect(ambientWarmth({ ...hot, heatResist: 0.7 })).toBeLessThan(ambientWarmth(hot));
  });
  it('drifts toward the air and is bounded', () => {
    let t = 0;
    for (let i = 0; i < 20; i++) t = stepBodyTemp(t, -1, 1);
    expect(t).toBeLessThan(-35);
    for (let i = 0; i < 600; i++) t = stepBodyTemp(t, -1, 1);
    expect(t).toBeGreaterThanOrEqual(-100);
    expect(t).toBeLessThan(-95);
    let w = -80;
    for (let i = 0; i < 90; i++) w = stepBodyTemp(w, 0.6, 1);
    expect(w).toBeGreaterThan(30);
  });
  it('names the bands', () => {
    expect([0, -36, -60, -90, 40, 60, 90].map(thermalState)).toEqual([
      'ok',
      'chilly',
      'cold',
      'freezing',
      'warm',
      'hot',
      'scorching',
    ]);
  });
});

describe('injuries and needs', () => {
  it('maps creature families to injuries', () => {
    expect(injuryOnHit('wolf')?.cond).toBe('bleed');
    expect(injuryOnHit('mite')?.cond).toBe('poison');
    expect(injuryOnHit('cinder_drake')?.cond).toBe('burn');
    expect(injuryOnHit('frost_wraith')?.cond).toBe('frostbite');
    expect(injuryOnHit('slime')).toBeNull();
  });
  it('validates difficulty and temperature from saves', () => {
    expect(validTravelNeeds({ mode: 'hardcore', temp: 500 })).toMatchObject({ mode: 'hardcore', temp: 100 });
    expect(validTravelNeeds({ mode: 'bogus', temp: NaN })).toMatchObject({ mode: 'cozy', temp: 0 });
    expect(validTravelNeeds({ mode: 'adventure' }).temp).toBe(0);
  });
});

describe('diseases', () => {
  it('the cold and wet breed fever; the night swamp breeds ague; shelter and fire keep both off', () => {
    const base = {
      thermal: 'cold' as const,
      weather: 'rain',
      nearFire: false,
      indoors: false,
      biome: 'meadow',
      hour: 12,
    };
    expect(diseaseRisk(base)).toBe('fever');
    expect(diseaseRisk({ ...base, nearFire: true })).toBeNull();
    expect(diseaseRisk({ ...base, weather: 'clear' })).toBeNull();
    const swamp = { ...base, thermal: 'ok' as const, biome: 'swamp', hour: 23 };
    expect(diseaseRisk(swamp)).toBe('ague');
    expect(diseaseRisk({ ...swamp, hour: 13 })).toBeNull();
    expect(diseaseRisk({ ...swamp, indoors: true })).toBeNull();
  });
  it('the restless dead leave grave rot; swamp biters the ague; every disease has a remedy item', () => {
    expect(graveInjuryOnHit('shade_stalker')?.cond).toBe('grave_rot');
    expect(graveInjuryOnHit('reed_stalker')?.cond).toBe('ague');
    for (const d of DISEASES) {
      expect(CONDITIONS).toContain(d);
      expect(Object.values(ITEMS).some((i) => i.cure?.includes(d))).toBe(true);
    }
  });
});
