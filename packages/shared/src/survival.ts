import type { Biome } from './worldgen';
import type { CaveBiome } from './undercroft';
import type { Weather } from './weather';

/**
 * Survival model (master plan §8): body temperature and the four injuries. Pure and deterministic so the server, the
 * HUD and the tests agree. Temperature is a body value in -100 (freezing) .. +100 (scorching); 0 is comfortable and
 * |t| < COMFORT draws nothing on the HUD. Injuries are ordinary server buffs (timer = remaining duration) so they
 * sync, persist and display through the existing status registry.
 */

export type Difficulty = 'cozy' | 'adventure' | 'hardcore';
export const COMFORT = 35;

export interface ThermoCtx {
  biome: Biome;
  /** cave biome when underground */
  cave: CaveBiome | null;
  /** game hour 0..24 */
  hour: number;
  weather: Weather;
  /** 0 spring .. 3 winter */
  season: number;
  /** under a roof or inside a building */
  indoors: boolean;
  /** within reach of a fire, forge or lit hearth */
  fire: boolean;
  /** resistance from tonics 0..1 */
  coldResist: number;
  heatResist: number;
  /** running or fighting adds body heat */
  exerted: boolean;
}

/** Where the air would settle a resting traveller: -1 freezing .. +1 scorching. */
export function ambientWarmth(c: ThermoCtx): number {
  const day = Math.max(0, Math.sin(((c.hour - 6) / 12) * Math.PI)); // 0 at night, 1 at noon
  let t: number;
  if (c.cave) {
    t = { limestone: 0, glowmoss: 0.05, crystal: -0.1, basalt: 0.75, frost: -0.85, drowned: -0.3 }[c.cave];
  } else {
    const base: Record<Biome, number> = {
      meadow: 0,
      forest: -0.05,
      autumn: -0.15,
      taiga: -0.55,
      swamp: 0.1,
      desert: 0.35,
      enchanted: 0,
      corrupted: 0.2,
    };
    t = base[c.biome];
    // deserts swing hard: scorching noon, bitter night; elsewhere the day/night swing is gentle
    t += (day - 0.5) * (c.biome === 'desert' ? 1.4 : 0.4);
    t += [0, 0.2, -0.05, -0.35][c.season % 4]!;
    t += c.weather === 'snow' ? -0.3 : c.weather === 'rain' ? -0.15 : c.weather === 'storm' ? -0.2 : 0;
  }
  if (c.indoors) t *= 0.25;
  if (c.fire) t = t < 0 ? t * 0.2 + 0.5 : t + 0.5;
  if (t < 0) t *= 1 - c.coldResist;
  if (t > 0) t *= 1 - c.heatResist;
  if (c.exerted && t >= -0.2) t += 0.1;
  return Math.max(-1, Math.min(1, t));
}

/** Body temperature drifts toward the air's target: about two minutes to feel a change, faster near extremes. */
export function stepBodyTemp(temp: number, ambient: number, seconds: number): number {
  const target = ambient * 100;
  const rate = (Math.abs(target - temp) / 100) * 0.35 + 0.01;
  const next = temp + (target - temp) * Math.min(1, rate * seconds);
  return Math.max(-100, Math.min(100, next));
}

export type ThermalState = 'ok' | 'chilly' | 'cold' | 'freezing' | 'warm' | 'hot' | 'scorching';
export function thermalState(temp: number): ThermalState {
  if (temp <= -80) return 'freezing';
  if (temp <= -55) return 'cold';
  if (temp <= -COMFORT) return 'chilly';
  if (temp >= 80) return 'scorching';
  if (temp >= 55) return 'hot';
  if (temp >= COMFORT) return 'warm';
  return 'ok';
}

export const CONDITIONS = ['bleed', 'poison', 'burn', 'frostbite'] as const;
export type Condition = (typeof CONDITIONS)[number];

/** Each injury: seconds of duration, health lost per tick and the seconds between ticks. */
export const CONDITION_RULES: Record<
  Condition,
  { secs: number; every: number; dmg: number; label: string; cure: string }
> = {
  bleed: { secs: 45, every: 2, dmg: 1, label: 'Bleeding', cure: 'bandage' },
  poison: { secs: 60, every: 3, dmg: 1, label: 'Poisoned', cure: 'antidote' },
  burn: { secs: 15, every: 2, dmg: 1, label: 'Burning', cure: 'burn salve, or step into water' },
  frostbite: { secs: 90, every: 4, dmg: 1, label: 'Frostbitten', cure: 'burn salve, or warm up by a fire' },
};

/** Difficulty scales how often injuries land and how hard they bite. Cozy never applies them. */
export const DIFFICULTY_RULES: Record<Difficulty, { drain: number; injury: number; bite: number; thermal: boolean }> = {
  cozy: { drain: 0, injury: 0, bite: 0, thermal: false },
  adventure: { drain: 1, injury: 1, bite: 1, thermal: true },
  hardcore: { drain: 1.5, injury: 2.2, bite: 2, thermal: true },
};

/** Chance that a hit from `kind` inflicts an injury (before difficulty). */
export function injuryOnHit(kind: string): { cond: Condition; chance: number } | null {
  const poison = new Set([
    'mite',
    'spore_sage',
    'pool_lurker',
    'reed_stalker',
    'tide_eel',
    'spore_matriarch',
    'lantern_hound',
  ]);
  const burn = new Set(['cinder_moth', 'cinder_drake', 'cinder_wyrm']);
  const frost = new Set(['rime_skitter', 'frost_wraith', 'rime_sovereign']);
  const bleed = new Set(['wolf', 'boar', 'glasscrawler', 'brute', 'amber_gnawer', 'badger', 'blind_ram', 'thornling']);
  if (poison.has(kind)) return { cond: 'poison', chance: 0.3 };
  if (burn.has(kind)) return { cond: 'burn', chance: 0.4 };
  if (frost.has(kind)) return { cond: 'frostbite', chance: 0.35 };
  if (bleed.has(kind)) return { cond: 'bleed', chance: 0.2 };
  return null;
}
