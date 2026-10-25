/**
 * Maps the shared appearance indices (hair, skin, eyes, dress…) onto palette ramps and builds the Outfit the person
 * painter draws. Every colour comes from the fixed 48-colour palette.
 */
import { C, DEFAULT_APPEARANCE, unpackAppearance, type Appearance } from '@eigenlands/shared';
import type { Ramp } from './shade';
import type { DressStyle, HairStyle, Outfit } from './actors';

const r = (a: number[]) => a as Ramp;

export const SKIN_RAMPS: Ramp[] = [
  r([C.e4, C.e5, C.e6, C.e7, C.white]),
  r([C.e3, C.e4, C.e5, C.e6, C.e7]),
  r([C.e3, C.e4, C.e5, C.r5, C.r6]),
  r([C.e2, C.e3, C.e4, C.e5, C.e6]),
  r([C.e1, C.e2, C.e3, C.e4, C.e5]),
  r([C.e0, C.e1, C.e2, C.e3, C.e4]),
];
export const HAIR_RAMPS: Ramp[] = [
  r([C.e0, C.e1, C.e2, C.e3, C.e4]),
  r([C.ink, C.night, C.slate, C.steel]),
  r([C.e3, C.e4, C.e5, C.e6, C.e7]),
  r([C.r0, C.r1, C.r2, C.r3, C.r4]),
  r([C.slate, C.steel, C.mist, C.fog, C.pale]),
  r([C.q0, C.q1, C.q2, C.q3, C.q4]),
  r([C.w1, C.w2, C.w3, C.w4, C.w5]),
  r([C.g1, C.g2, C.g3, C.g4, C.g5]),
  r([C.q1, C.q2, C.q5, C.q6, C.r7]),
  r([C.mist, C.fog, C.pale, C.white, C.white]),
];
export const EYE_COLORS = [C.e2, C.g4, C.w5, C.r5, C.q4, C.r3];
export const TRIM_COLORS = [C.e4, C.fog, C.r6, C.r3, C.w5, C.e7];
export const HAIR_STYLES: HairStyle[] = [
  'short',
  'long',
  'bun',
  'braids',
  'curly',
  'ponytail',
  'spiky',
  'swept',
  'topknot',
  'twintail',
  'bald',
];
export const DRESS_STYLES: Array<DressStyle | undefined> = [undefined, 'robe', 'coat', undefined, 'mantle', 'plated'];

/** Garment colours (light → dark order matches Ramp use) and the trousers that suit each. */
export const DRESS_RAMPS: Ramp[] = [
  r([C.w2, C.w3, C.w4, C.w5, C.w6]),
  r([C.r1, C.r2, C.r3, C.r4, C.r5]),
  r([C.q1, C.q2, C.q3, C.q4, C.q6]),
  r([C.g1, C.g2, C.g3, C.g4, C.g5]),
  r([C.e3, C.e4, C.e5, C.e6, C.e7]),
  r([C.steel, C.mist, C.fog, C.pale, C.white]),
  r([C.r1, C.r2, C.q5, C.q6, C.r7]),
  r([C.w0, C.w1, C.w2, C.w3, C.w4]),
  r([C.q0, C.q1, C.r0, C.r1, C.r2]),
  r([C.night, C.slate, C.steel, C.mist, C.fog]),
  r([C.e1, C.e2, C.e3, C.e4, C.e5]),
  r([C.ink, C.night, C.w0, C.w1, C.w2]),
];
const PANTS: Ramp[] = [
  r([C.e0, C.e1, C.e2, C.e3]),
  r([C.night, C.slate, C.steel, C.mist]),
  r([C.w0, C.w1, C.w2, C.w3]),
  r([C.g0, C.g1, C.g2, C.g3]),
];
const PANTS_FOR = [0, 1, 2, 0, 3, 1, 2, 1, 0, 0, 1, 2];
const LINEN = r([C.fog, C.pale, C.white, C.white, C.white]);
const PLATE = r([C.slate, C.steel, C.mist, C.fog, C.pale]);
const BOOTS = r([C.ink, C.e0, C.e1, C.e2]);

const cache = new Map<number, Appearance>();
export function appearanceOf(packed: number): Appearance | null {
  let a = cache.get(packed);
  if (!a) {
    const u = unpackAppearance(packed);
    if (!u) return null;
    cache.set(packed, (a = u));
  }
  return a;
}

/**
 * Compose a person from the base look (an outfit or armour set) and the chosen appearance. Skin, hair and eyes always
 * follow the player; the garment follows them too unless an outfit or armour set (look > 0) is being worn.
 */
export function outfitFromAppearance(base: Outfit, a: Appearance, wearOwnDress: boolean): Outfit {
  const o: Outfit = {
    ...base,
    skin: SKIN_RAMPS[a.skin]!,
    hair: HAIR_RAMPS[a.hairColor]!,
    hairStyle: HAIR_STYLES[a.hairStyle]!,
    longHair: undefined,
    eyes: EYE_COLORS[a.eyes]!,
    trim: TRIM_COLORS[a.trim]!,
  };
  if (!wearOwnDress) return o;
  const dress = DRESS_STYLES[a.dress];
  const ramp = DRESS_RAMPS[a.dressColor]!;
  const jerkin = a.dress === 3;
  return {
    ...o,
    shirt: jerkin ? LINEN : ramp,
    pants: PANTS[PANTS_FOR[a.dressColor]!]!,
    boots: BOOTS,
    vest: jerkin ? ramp : undefined,
    cape: a.dress === 2 || a.dress === 4 ? ramp : undefined,
    mantle: a.dress === 4 ? ramp : undefined,
    plate: dress === 'plated' ? PLATE : undefined,
    dress,
    glow: undefined,
    hat: undefined,
    hatStyle: undefined,
    apron: undefined,
    scarf: undefined,
    sash: a.dress === 1 ? r([C.e0, C.e1, TRIM_COLORS[a.trim]!]) : undefined,
    ...(dress === 'plated' ? { vest: undefined } : {}),
  };
}

export const defaultAppearance = (): Appearance => ({ ...DEFAULT_APPEARANCE });
