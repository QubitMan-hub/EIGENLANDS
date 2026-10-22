import { hash2 } from './rng';
import { DAYS_PER_SEASON } from './constants';

export type Weather = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog';
/** [clear, cloudy, rain, storm, snow, fog] probabilities per season. */
const TABLE: number[][] = [
  [0.45, 0.15, 0.3, 0.05, 0, 0.05],
  [0.62, 0.1, 0.15, 0.1, 0, 0.03],
  [0.4, 0.2, 0.22, 0.06, 0, 0.12],
  [0.38, 0.2, 0.02, 0, 0.35, 0.05],
];
const NAMES: Weather[] = ['clear', 'cloudy', 'rain', 'storm', 'snow', 'fog'];

export const seasonOfDay = (day: number): number => Math.floor(day / DAYS_PER_SEASON) % 4;

/** Deterministic weather for a world day (same on every server/client). */
export function weatherForDay(seed: number, day: number): Weather {
  const r = hash2(seed, day, 7, 401);
  const row = TABLE[seasonOfDay(day)]!;
  let acc = 0;
  for (let i = 0; i < row.length; i++) { acc += row[i]!; if (r < acc) return NAMES[i]!; }
  return 'clear';
}

/** Rain or storm waters outdoor crops automatically. */
export const waters = (w: Weather): boolean => w === 'rain' || w === 'storm';

/** The day's weather as it falls in a biome: snow in the tundra, dry skies over the dunes, mist on the fen. */
export function biomeWeather(w: Weather, biome: import('./worldgen').Biome): Weather {
  if (biome === 'taiga') return w === 'rain' || w === 'storm' || w === 'cloudy' ? 'snow' : w === 'fog' ? 'fog' : w;
  if (biome === 'desert') return w === 'rain' || w === 'snow' || w === 'fog' ? 'clear' : w === 'storm' ? 'cloudy' : w;
  if (biome === 'swamp') return w === 'clear' || w === 'cloudy' ? 'fog' : w === 'snow' ? 'rain' : w;
  if (biome === 'corrupted') return w === 'snow' || w === 'clear' ? 'fog' : w;
  return w;
}
