import { hash2 } from './rng';
import type { Weather } from './weather';

export interface FishDef {
  id: string;
  seasons: number[];
  /** 'shallow' | 'deep' | 'any' */
  water: 'shallow' | 'deep' | 'any';
  hours: [number, number]; // inclusive start, exclusive end (wraps past midnight if start > end)
  weight: number;          // rarity weight
  difficulty: number;      // 0..1 (rhythm tolerance shrinks)
  rainBonus?: boolean;
  oceanOnly?: boolean;
  minLevel?: number;
}

export const FISH_TABLE: FishDef[] = [
  { id: 'minnow', seasons: [0, 1, 2, 3], water: 'shallow', hours: [0, 24], weight: 40, difficulty: 0.1 },
  { id: 'carp', seasons: [0, 1, 2], water: 'any', hours: [6, 20], weight: 26, difficulty: 0.25 },
  { id: 'perch', seasons: [0, 1, 2, 3], water: 'shallow', hours: [6, 20], weight: 24, difficulty: 0.3 },
  { id: 'trout', seasons: [0, 2, 3], water: 'deep', hours: [6, 20], weight: 14, difficulty: 0.45 },
  { id: 'catfish', seasons: [1, 2], water: 'deep', hours: [18, 6], weight: 10, difficulty: 0.55, rainBonus: true },
  { id: 'pike', seasons: [2, 3], water: 'deep', hours: [6, 18], weight: 7, difficulty: 0.65 },
  { id: 'eel', seasons: [0, 1, 2, 3], water: 'deep', hours: [18, 6], weight: 6, difficulty: 0.7, rainBonus: true },
  { id: 'koi', seasons: [0, 1], water: 'shallow', hours: [6, 12], weight: 2.5, difficulty: 0.85 },
  { id: 'sailfin', seasons: [0, 1, 2, 3], water: 'deep', hours: [6, 20], weight: 8, difficulty: 0.55, oceanOnly: true },
  { id: 'moonray', seasons: [0, 1, 2, 3], water: 'deep', hours: [18, 6], weight: 3, difficulty: 0.8, oceanOnly: true, minLevel: 3 },
  { id: 'prism_nautilus', seasons: [0, 1, 2, 3], water: 'deep', hours: [0, 24], weight: 1.5, difficulty: 0.95, oceanOnly: true, minLevel: 5 },
  { id: 'glowfin', seasons: [0, 1, 2, 3], water: 'deep', hours: [20, 4], weight: 2, difficulty: 0.9 },
];

const inHours = (h: number, [a, b]: [number, number]) => (a <= b ? h >= a && h < b : h >= a || h < b);

export interface FishCtx { season: number; hour: number; deep: boolean; ocean?: boolean; weather: Weather; level: number; luck: number }

/** Weighted draw from the fish that can bite right now. Skill and luck favour rare fish. */
export function rollFish(rand: () => number, c: FishCtx): FishDef {
  const pool = FISH_TABLE.filter((f) => (!f.oceanOnly || c.ocean === true && c.deep) && c.level >= (f.minLevel ?? 0) && f.seasons.includes(c.season) && inHours(c.hour, f.hours) && (f.water === 'any' || (f.water === 'deep') === c.deep));
  const list = pool.length ? pool : [FISH_TABLE[0]!];
  const weights = list.map((f) => {
    let w = f.weight;
    if (f.rainBonus && (c.weather === 'rain' || c.weather === 'storm')) w *= 2;
    w *= 1 + (c.level * 0.04 + c.luck * 0.05) * f.difficulty * 4; // rare fish gain more from skill
    return w;
  });
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) { r -= weights[i]!; if (r <= 0) return list[i]!; }
  return list[list.length - 1]!;
}

/** Seconds until a bite for a cast at (x,y) on a given nonce. Deterministic given the rand source. */
export const biteDelaySec = (rand: () => number, level: number): number => Math.max(1.5, 2 + rand() * 5 - level * 0.25);
export const _fishHash = hash2;
