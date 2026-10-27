/**
 * The game's existing outfit descriptions (art/actors.ts `Outfit`: player presets, armour sets, every NPC's look) as
 * layers of the modular body, so nobody's colours, garments or accessories change — only the body they are worn on.
 */
import { C, type Ramp } from '../shade';
import type { Outfit } from '../actors';
import type { BodyLook } from './paint';
import { CUTS, type BeardId, type CutId, type HatId } from './headwear';
import type { BodyType } from './skeleton';

const UNDER: Ramp = [C.night, C.slate, C.steel, C.mist];
const BELT: Ramp = [C.ink, C.e0, C.e1, C.e2];
const PLATE: Ramp = [C.slate, C.steel, C.mist, C.fog, C.pale];

/** the older eleven hair styles, each as the cut that matches it best (per body: a "short" crop differs) */
const STYLE_CUT: Record<string, [CutId, CutId]> = {
  short: ['short', 'pixie'],
  long: ['shoulder', 'long'],
  bun: ['bun', 'bun'],
  bald: ['bald', 'buzz'],
  braids: ['braid_back', 'braids'],
  curly: ['curly', 'curly'],
  ponytail: ['ponytail', 'ponytail'],
  spiky: ['spiky', 'spiky'],
  swept: ['swept', 'swept'],
  topknot: ['top_knot', 'top_knot'],
  twintail: ['mullet', 'twintail'],
};
const DEFAULT_CUTS: Record<BodyType, CutId[]> = {
  male: ['short', 'crop', 'side_part', 'messy', 'quiff', 'undercut', 'buzz'],
  female: ['bob', 'shoulder', 'ponytail', 'bun', 'long', 'fringe', 'pixie'],
};
const HATS: Record<string, HatId> = {
  cap: 'cap',
  brim: 'brim',
  beret: 'beret',
  helm: 'helm',
  hood: 'hood',
  circlet: 'circlet',
  bandana: 'bandana',
  crown: 'crown',
};

/** a stable small hash of a seed */
const mix = (n: number) => {
  let h = (n | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
};

const looks = new WeakMap<Outfit, BodyLook>();
/** the layered look for an outfit (stable: the same outfit always gets the same defaults) */
export function lookOf(o: Outfit): BodyLook {
  let l = looks.get(o);
  if (!l) looks.set(o, (l = buildLook(o)));
  return l;
}

function buildLook(o: Outfit): BodyLook {
  const h = mix(o.shirt[0]! * 7 + o.hair[1]! * 131 + o.skin[2]! * 977 + o.pants[0]! * 31 + (o.eyes ?? 0) * 3);
  const body: BodyType = o.body ?? (o.longHair || o.hairStyle === 'twintail' ? 'female' : 'male');
  const fem = body === 'female' ? 1 : 0;
  let cut: CutId;
  if (o.cut) cut = o.cut;
  else if (o.hairStyle) cut = STYLE_CUT[o.hairStyle]![fem]!;
  else if (o.longHair) cut = fem ? 'long' : 'shoulder';
  else cut = DEFAULT_CUTS[body][h % DEFAULT_CUTS[body].length]!;
  const hat: HatId | undefined = o.hatStyle
    ? HATS[o.hatStyle]
    : o.hat
      ? 'cap'
      : o.headband !== undefined
        ? 'circlet'
        : undefined;
  const beard: BeardId | undefined = o.beard
    ? (['full', 'short', 'long', 'goatee'] as const)[h % 4]
    : o.moustache
      ? 'moustache'
      : undefined;
  const dress = o.dress;
  const robe = dress === 'robe',
    coat = dress === 'coat';
  const longSleeve = robe || coat || dress === 'mantle' || dress === 'plated' || !!o.plate || h % 3 !== 0;
  const look: BodyLook = {
    body,
    skin: o.skin,
    hair: o.hair,
    eyes: o.eyes ?? C.w2,
    under: UNDER,
    gear: { cut, hat, beard },
    hat: o.hat,
    hatTrim: o.trim ?? (o.headband !== undefined ? o.headband : undefined),
    beard: o.beard ?? (o.moustache ? o.hair : undefined),
    top: { ramp: o.shirt, sleeve: longSleeve ? 1 : 0.5, hem: robe ? 0 : -1.8, trim: o.trim, collar: true },
    legs: { ramp: o.pants, hem: 1 },
    boots: { ramp: o.boots, top: robe ? 2 : 3.4 },
    belt: robe && !o.sash ? undefined : { ramp: BELT, buckle: o.trim ?? C.e6 },
    glow: o.glow,
    trim: o.trim,
    glasses: o.glasses,
    scale: o.shorten ? Math.max(0.62, 1 - o.shorten * 0.08) : undefined,
  };
  if (robe) look.skirt = { ramp: o.shirt, hem: 1.0, flare: 2.0, trim: o.trim };
  else if (coat) look.skirt = { ramp: o.shirt, hem: 4.5, flare: 1.4, open: true, trim: o.trim };
  if (o.vest) look.vest = { ramp: o.vest, hem: -1.4, trim: o.trim };
  if (o.plate || dress === 'plated') look.plate = { ramp: o.plate ?? PLATE, pauldrons: true, trim: o.trim };
  if (o.mantle || dress === 'mantle') look.mantle = o.mantle ?? o.shirt;
  if (o.sash) look.sash = o.sash;
  if (o.scarf) look.scarf = o.scarf;
  if (o.apron) look.apron = o.apron;
  if (o.cape) look.cape = { ramp: o.cape, length: 13, trim: o.trim };
  return look;
}

/** body type from an NPC's own bio (the pronouns its writers used); otherwise a stable pick */
export function bodyFromBio(bio: string | undefined, id: string): BodyType {
  const t = ` ${(bio ?? '').toLowerCase()} `;
  const she = (t.match(/\b(she|her|hers|herself)\b/g) ?? []).length,
    he = (t.match(/\b(he|him|his|himself)\b/g) ?? []).length;
  if (she > he) return 'female';
  if (he > she) return 'male';
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 2 ? 'female' : 'male';
}

export { CUTS };
