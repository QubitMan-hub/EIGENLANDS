import type { Biome } from './worldgen';
import type { Weather } from './weather';

export type DomesticAnimal = 'chicken' | 'cat' | 'dog' | 'pigeon';
export type AnimalRoutine = 'wander' | 'shelter' | 'sleep' | 'roost';

/** Small daily routines, shared by the ambient animals and their behavior tests. */
export function animalRoutine(kind: DomesticAnimal, hour: number, weather: Weather): AnimalRoutine {
  const night = hour >= 20 || hour < 5.5;
  if ((kind === 'chicken' || kind === 'pigeon') && night) return 'roost';
  if (kind === 'dog' && night) return 'sleep';
  if (weather === 'rain' || weather === 'storm' || weather === 'snow') return 'shelter';
  // Cats are active after dark, but take a quiet rest during the warmest part of the day.
  if (kind === 'cat' && hour >= 12 && hour < 16) return 'sleep';
  return 'wander';
}

/** Insect activity follows habitat as well as the calendar; a sunny tundra is still too cold. */
export function insectHabitat(
  kind: 'butterfly' | 'firefly',
  biome: Biome,
  season: number,
  hour: number,
  weather: Weather,
): boolean {
  if (season === 3 || biome === 'taiga' || biome === 'desert' || biome === 'corrupted') return false;
  if (weather === 'rain' || weather === 'storm' || weather === 'snow') return false;
  return kind === 'butterfly'
    ? hour >= 6.5 && hour < 19 && weather !== 'fog'
    : (hour >= 19.5 || hour < 5) && (biome === 'swamp' || weather !== 'fog');
}
