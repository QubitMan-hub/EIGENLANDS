import { describe, expect, it } from 'vitest';
import { findPath } from '../src/path';
import { biomeWeather, weatherWeights } from '../src/weather';
import { animalRoutine, insectHabitat } from '../src/ecology';
import { NPCS, scheduleAt } from '../src/npcs';

describe('living world', () => {
  it('moves the farmer to indoor seed work in winter instead of tending an empty field', () => {
    const farmer = NPCS.find((n) => n.id === 'fenwick')!;
    expect(scheduleAt(farmer, 9, 'clear', 3).spot).toBe('farmhouse.work');
    expect(scheduleAt(farmer, 9, 'clear', 0).spot).toBe('field');
    expect(scheduleAt(farmer, 9, 'clear', 2).doing).toContain('harvest');
  });
  it('takes a modest road detour instead of cutting across a field', () => {
    const solid = (x: number, y: number) => x < 0 || x > 8 || y < 0 || y > 3;
    const path = findPath(0, 2, 8, 2, solid, 500, (_x, y) => (y === 0 ? 1 : 2));
    expect(path).not.toBeNull();
    expect(path!.filter(([, y]) => y === 0).length).toBeGreaterThan(3);
    expect(path!.at(-1)).toEqual([8, 2]);
  });

  it('does not cross a diagonal cliff when the side tiles cannot reach the destination', () => {
    const solid = Object.assign((x: number, y: number) => x < 0 || x > 1 || y < 0 || y > 1, {
      level: (x: number, y: number) => (x === 1 && y === 1 ? 1 : x !== y ? -1 : 0),
    });
    expect(findPath(0, 0, 1, 1, solid)).toBeNull();
  });

  it('blends weather across the winter/spring boundary and repeats each year', () => {
    const before = weatherWeights(27.999);
    const after = weatherWeights(28.001);
    expect(before[4]).toBeGreaterThan(0);
    expect(after[4]).toBeGreaterThan(0);
    expect(Math.max(...before.map((v, i) => Math.abs(v - after[i]!)))).toBeLessThan(0.001);
    expect(weatherWeights(0)).toEqual(weatherWeights(28));
    expect(after.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('keeps lingering spring snow out of warm biomes', () => {
    expect(biomeWeather('snow', 'desert')).toBe('clear');
    expect(biomeWeather('snow', 'swamp')).toBe('rain');
  });

  it('gives domestic animals shelter and species-specific sleep routines', () => {
    expect(animalRoutine('chicken', 23, 'clear')).toBe('roost');
    expect(animalRoutine('cat', 23, 'clear')).toBe('wander');
    expect(animalRoutine('dog', 23, 'clear')).toBe('sleep');
    expect(animalRoutine('chicken', 12, 'storm')).toBe('shelter');
    expect(animalRoutine('cat', 12, 'rain')).toBe('shelter');
    expect(animalRoutine('chicken', 12, 'clear')).toBe('wander');
  });

  it('limits insects to suitable climates, seasons, and times of day', () => {
    expect(insectHabitat('butterfly', 'meadow', 0, 12, 'clear')).toBe(true);
    expect(insectHabitat('butterfly', 'taiga', 1, 12, 'clear')).toBe(false);
    expect(insectHabitat('butterfly', 'desert', 1, 12, 'clear')).toBe(false);
    expect(insectHabitat('firefly', 'swamp', 1, 22, 'fog')).toBe(true);
    expect(insectHabitat('firefly', 'forest', 3, 22, 'clear')).toBe(false);
    expect(insectHabitat('butterfly', 'meadow', 1, 12, 'storm')).toBe(false);
  });
});
