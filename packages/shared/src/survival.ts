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

export const CONDITIONS = [
  'bleed',
  'poison',
  'burn',
  'frostbite',
  'fracture',
  'curse',
  'fever',
  'gut_rot',
  'ague',
  'grave_rot',
] as const;
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
  // these two do not bleed you: a fracture stops you running and dodging, a curse saps your blows and your healing
  fracture: { secs: 240, every: 0, dmg: 0, label: 'Fractured', cure: 'a splint, or time' },
  curse: { secs: 300, every: 0, dmg: 0, label: 'Cursed', cure: 'holy water, or pray at a shrine altar' },
  // diseases: slow, long and caught rather than struck (see DISEASES below)
  fever: { secs: 480, every: 8, dmg: 1, label: 'Chill Fever', cure: 'willow-bark tea, or time' },
  gut_rot: { secs: 300, every: 10, dmg: 1, label: 'Gut Rot', cure: 'a charcoal draught' },
  ague: { secs: 600, every: 12, dmg: 1, label: 'Marsh Ague', cure: 'an ague tonic' },
  grave_rot: { secs: 420, every: 8, dmg: 1, label: 'Grave Rot', cure: 'holy water, or pray at a shrine altar' },
};

/**
 * Diseases (Adventure and Hardcore only, like every condition). Each is caught rather than struck:
 * - Chill Fever: being cold or freezing out in rain or snow, away from a fire. It is catching: a feverish traveller
 *   can pass it to anyone standing close.
 * - Gut Rot: unboiled water, raw meat or fish, spoiled food. Hunger and thirst run faster while it lasts.
 * - Marsh Ague: the swamp at night, out of doors, and the bites of its mites and lurkers. Blows land weaker.
 * - Grave Rot: wounds from the restless dead and the spirits of the dark places. Wounds will not close by themselves.
 */
export const DISEASES = ['fever', 'gut_rot', 'ague', 'grave_rot'] as const satisfies readonly Condition[];
export type Disease = (typeof DISEASES)[number];
export const isDisease = (c: string): c is Disease => (DISEASES as readonly string[]).includes(c);
/** seconds between rolls for catching a disease from the surroundings, and the chance per roll (before difficulty) */
export const CATCH_EVERY = 30;
export const FEVER_CATCH = 0.08;
export const AGUE_CATCH = 0.06;
/** chance per roll (every CATCH_EVERY seconds) that a feverish traveller passes it to someone within CONTAGION_RANGE */
export const CONTAGION_CHANCE = 0.12;
export const CONTAGION_RANGE = 2.5;
/** chance that a drink of unboiled water, raw meat or fish, or spoiled food brings on gut rot */
export const GUT_ROT_CHANCE = { murky: 0.3, raw: 0.2, spoiled: 0.6 } as const;
/** extra hunger and thirst per second with gut rot */
export const GUT_ROT_DRAIN = { food: 0.04, water: 0.06 } as const;
/** blows dealt with the marsh ague */
export const AGUE_ATTACK_MULT = 0.85;

/** Does this place, at this hour, breed a disease? (pure: the server rolls the dice) */
export function diseaseRisk(c: {
  thermal: ThermalState;
  weather: string;
  nearFire: boolean;
  indoors: boolean;
  biome: string;
  hour: number;
}): Disease | null {
  if (
    !c.indoors &&
    !c.nearFire &&
    (c.thermal === 'cold' || c.thermal === 'freezing') &&
    (c.weather === 'rain' || c.weather === 'snow' || c.weather === 'storm')
  )
    return 'fever';
  if (!c.indoors && c.biome === 'swamp' && (c.hour >= 20 || c.hour < 5)) return 'ague';
  return null;
}
/** blows dealt while cursed */
export const CURSE_ATTACK_MULT = 0.8;

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

/** A second, rarer wound some creatures can leave on top of the first: crushing blows break bones, spirits curse. */
export function graveInjuryOnHit(kind: string): { cond: Condition; chance: number } | null {
  const crush: Record<string, number> = {
    brute: 0.1,
    blind_ram: 0.1,
    geode_golem: 0.15,
    iron_golem: 0.15,
    colossus: 0.2,
    geode_tyrant: 0.2,
    slime_king: 0.12,
    gale_captain: 0.12,
    sundered_warlord: 0.18,
    umbral_maw: 0.15,
    the_unwound: 0.15,
  };
  const hex: Record<string, number> = {
    wisp: 0.08,
    vault_guardian: 0.2,
    veyr: 0.25,
    warden: 0.25,
    hellhound: 0.15,
    gloam_hexer: 0.25,
    gloam_hierophant: 0.35,
    paradox_echo: 0.12,
    sundered_seer: 0.18,
  };
  // the restless dead leave grave rot; the swamp's biters, the ague
  const rot: Record<string, number> = {
    frost_wraith: 0.12,
    shade_stalker: 0.15,
    gloam_zealot: 0.12,
    sundered_blade: 0.15,
  };
  const marsh: Record<string, number> = { mite: 0.08, pool_lurker: 0.1, reed_stalker: 0.1, spore_sage: 0.06 };
  if (rot[kind]) return { cond: 'grave_rot', chance: rot[kind] };
  if (marsh[kind]) return { cond: 'ague', chance: marsh[kind] };
  if (crush[kind]) return { cond: 'fracture', chance: crush[kind] };
  if (hex[kind]) return { cond: 'curse', chance: hex[kind] };
  return null;
}

// ───────────────────────── nutrition ─────────────────────────

export type FoodGroup = 'produce' | 'protein' | 'hearty';
const PROTEIN = new Set([
  'fish',
  'fry',
  'meat',
  'egg',
  'milk',
  'omelet',
  'crab',
  'ceviche',
  'chowder',
  'eel',
  'carp',
  'perch',
  'trout',
  'catfish',
  'pike',
  'cheese',
  'knights',
]);
const HEARTY = new Set(['bread', 'loaf', 'cake', 'pie', 'noodles', 'stew', 'mochi', 'soup', 'broth', 'tea']);
/** Which food group a dish or ingredient belongs to (drives the balanced-diet bonus). */
export function foodGroup(itemId: string, kind: string): FoodGroup | null {
  if (kind !== 'food' && kind !== 'crop' && kind !== 'forage' && kind !== 'fish') return null;
  const words = itemId.split('_');
  if (kind === 'fish' || words.some((w) => PROTEIN.has(w))) return 'protein';
  if (words.some((w) => HEARTY.has(w))) return 'hearty';
  return 'produce';
}
/** Eat from all three groups within this many seconds to feel nourished. */
export const BALANCED_WINDOW_SECS = 1800;
export const NOURISHED_SECS = 600;
/** The groups eaten recently (world-clock ms), newest last, after eating `group` at `now`. */
export function recordMeal(
  meals: Array<[FoodGroup, number]>,
  group: FoodGroup,
  now: number,
): Array<[FoodGroup, number]> {
  return [...meals.filter(([g, t]) => g !== group && now - t < BALANCED_WINDOW_SECS * 1000), [group, now]];
}
export const balanced = (meals: Array<[FoodGroup, number]>): boolean => new Set(meals.map(([g]) => g)).size >= 3;

// ───────────────────────── food storage ─────────────────────────

/** Seconds of Adventure play between rots: each raw fish or meat stack carried in the pack loses one to rot. */
export const ROT_SECS = 1200;
/** Trophy catches are kept for show, not eaten: they never rot. */
const KEEPSAKE = new Set(['koi', 'glowfin', 'prism_nautilus', 'moonray', 'sailfin', 'kelp']);
const RAW_MEAT = new Set(['raw_meat', 'venison', 'pork', 'rabbit_meat', 'mutton', 'drake_meat', 'eel_meat']);
/**
 * Does this item spoil in a traveller's pack? Raw fish and meat do; cooked food, preserves and everything stored in a
 * chest keep. Cold slows it (see rotEvery).
 */
export function perishable(id: string, kind: string): boolean {
  return (kind === 'fish' && !KEEPSAKE.has(id)) || RAW_MEAT.has(id);
}
/** Cold air keeps meat: snow, taiga and frost caves take twice as long to spoil it. */
export const rotEvery = (cold: boolean): number => (cold ? ROT_SECS * 2 : ROT_SECS);
