/**
 * Character appearance: the cosmetic choices a player makes when creating (or later changing) their wanderer.
 * Packed into one uint32 that is persisted, validated on the server and synced to every client. 0 means "never chosen":
 * the wanderer keeps the classic look picked by the equipped outfit, so existing characters are untouched.
 * Only indices live here; the client maps them onto palette ramps (art/appearance.ts).
 */
export const APPEARANCE_COUNTS = {
  skin: 6,
  hairStyle: 11,
  hairColor: 10,
  eyes: 6,
  dress: 6,
  dressColor: 12,
  trim: 6,
  /** base body: 0 the men's, 1 the women's reference body */
  body: 2,
  /** haircut (0 = follow `hairStyle`; 1.. = HAIRCUT_NAMES[n - 1]) */
  cut: 30,
} as const;

export type AppearanceField = keyof typeof APPEARANCE_COUNTS;
export interface Appearance {
  skin: number;
  hairStyle: number;
  hairColor: number;
  eyes: number;
  dress: number;
  dressColor: number;
  trim: number;
  body: number;
  cut: number;
}

/** Field order and bit widths of the packed value (bit 24 marks "chosen"). */
const LAYOUT: ReadonlyArray<[AppearanceField, number]> = [
  ['skin', 3],
  ['hairStyle', 4],
  ['hairColor', 4],
  ['eyes', 3],
  ['dress', 3],
  ['dressColor', 4],
  ['trim', 3],
];
const CHOSEN = 1 << 24;
/** fields added after the first layout live above the "chosen" bit, so every value stored before decodes unchanged */
const EXTRA: ReadonlyArray<[AppearanceField, number, number]> = [
  ['body', 25, 1],
  ['cut', 26, 5],
];

export const HAIR_STYLE_NAMES = [
  'Short',
  'Long',
  'Bun',
  'Braids',
  'Curly',
  'Ponytail',
  'Spiky',
  'Swept',
  'Topknot',
  'Twin tails',
  'Shaved',
] as const;
export const DRESS_NAMES = ['Tunic', 'Robe', 'Long coat', 'Jerkin', 'Mantle', 'Plated'] as const;
export const SKIN_NAMES = ['Porcelain', 'Fair', 'Golden', 'Tan', 'Umber', 'Ebony'] as const;
export const HAIR_COLOR_NAMES = [
  'Chestnut',
  'Raven',
  'Honey',
  'Ember',
  'Silver',
  'Violet',
  'Sea blue',
  'Moss',
  'Rose',
  'Snow',
] as const;
export const EYE_NAMES = ['Brown', 'Green', 'Blue', 'Amber', 'Violet', 'Crimson'] as const;
export const DRESS_COLOR_NAMES = [
  'Sky',
  'Ember',
  'Violet',
  'Forest',
  'Gold',
  'Frost',
  'Rose',
  'Sea',
  'Plum',
  'Slate',
  'Leather',
  'Midnight',
] as const;
export const BODY_NAMES = ['Masculine', 'Feminine'] as const;
/** the haircuts of the modular character system (client art/body/headwear.ts CUTS, same order) */
export const HAIRCUT_NAMES = [
  'Short',
  'Buzz',
  'Crop',
  'Side part',
  'Swept',
  'Quiff',
  'Spiky',
  'Messy',
  'Curly',
  'Afro',
  'Mohawk',
  'Bob',
  'Shoulder',
  'Long',
  'Long waves',
  'Ponytail',
  'High ponytail',
  'Bun',
  'Top knot',
  'Braids',
  'Back braid',
  'Twin tails',
  'Twin buns',
  'Undercut',
  'Mullet',
  'Fringe',
  'Pixie',
  'Receding',
  'Shaved',
] as const;
export const TRIM_NAMES = ['Bronze', 'Silver', 'Gold', 'Crimson', 'Teal', 'Bone'] as const;

const clampIndex = (v: unknown, count: number): number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < count ? v : 0;

export function packAppearance(a: Appearance): number {
  let out = CHOSEN;
  let shift = 0;
  for (const [k, bits] of LAYOUT) {
    out |= clampIndex(a[k], APPEARANCE_COUNTS[k]) << shift;
    shift += bits;
  }
  for (const [k, at] of EXTRA) out |= clampIndex(a[k], APPEARANCE_COUNTS[k]) << at;
  return out >>> 0;
}

/** Decode a packed value; null when nothing was ever chosen or the value is not one we wrote. */
export function unpackAppearance(v: unknown): Appearance | null {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 0xffffffff || !(v & CHOSEN)) return null;
  const out = {} as Appearance;
  let shift = 0;
  for (const [k, bits] of LAYOUT) {
    out[k] = clampIndex((v >>> shift) & ((1 << bits) - 1), APPEARANCE_COUNTS[k]);
    shift += bits;
  }
  for (const [k, at, bits] of EXTRA) out[k] = clampIndex((v >>> at) & ((1 << bits) - 1), APPEARANCE_COUNTS[k]);
  return out;
}

/** Stored or received values are never trusted: normalise to a canonical packed value (0 when unset or malformed). */
export function validAppearance(v: unknown): number {
  const a = unpackAppearance(v);
  return a ? packAppearance(a) : 0;
}

export function randomAppearance(rand: () => number): Appearance {
  const pick = (n: number) => Math.min(n - 1, Math.floor(rand() * n));
  return {
    skin: pick(APPEARANCE_COUNTS.skin),
    hairStyle: pick(APPEARANCE_COUNTS.hairStyle),
    hairColor: pick(APPEARANCE_COUNTS.hairColor),
    eyes: pick(APPEARANCE_COUNTS.eyes),
    dress: pick(APPEARANCE_COUNTS.dress),
    dressColor: pick(APPEARANCE_COUNTS.dressColor),
    trim: pick(APPEARANCE_COUNTS.trim),
    body: pick(APPEARANCE_COUNTS.body),
    cut: 1 + pick(APPEARANCE_COUNTS.cut - 1),
  };
}

export const DEFAULT_APPEARANCE: Appearance = {
  skin: 1,
  hairStyle: 0,
  hairColor: 0,
  eyes: 2,
  dress: 0,
  dressColor: 0,
  trim: 0,
  body: 0,
  cut: 0,
};
