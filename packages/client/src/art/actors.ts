import { Rectangle, Texture } from 'pixi.js';
import { DELVER_MERCHANTS, NPCS as VILLAGE_NPCS, REALMFOLK, realmNpcs } from '@eigenlands/shared';

const NPCS = [...VILLAGE_NPCS, ...DELVER_MERCHANTS, ...realmNpcs(), ...REALMFOLK];
import { actionPose } from './person-actions';
import { paintPerson } from './person-model';
import { appearanceOf, outfitFromAppearance } from './appearance';
import {
  blob,
  C,
  limb,
  makeCanvas,
  outline,
  PixBuf,
  polish,
  poly,
  put,
  rampAt,
  undithered,
  type Ctx,
  type Ramp,
} from './shade';

/**
 * Characters, enemies and fauna. People are native 32×48 frames in 8 iso directions with an idle pair (breathing) and an
 * 8-frame walk, four strike/recovery poses and eight run poses. Every direction is drawn (never mirrored) so the key light always comes from the top-left.
 */
export const DIR_DOWN = 0,
  DIR_UP = 1,
  DIR_LEFT = 2,
  DIR_RIGHT = 3;
export const DIR_DOWN_LEFT = 4,
  DIR_DOWN_RIGHT = 5,
  DIR_UP_LEFT = 6,
  DIR_UP_RIGHT = 7;
/** frame 0 = idle, 1..8 = walk cycle */
export const WALK_FRAMES = 9;
export const PERSON_W = 32;
export const PERSON_H = 48;
export const ATTACK_FRAME = 10,
  ATTACK_FRAMES = 4;
export const RUN_FRAME = 14,
  RUN_FRAMES = 8;
export const SHOT_FRAME = 22,
  CAST_FRAME = 26;
const COLS = CAST_FRAME + ATTACK_FRAMES;

/** Screen-space facing vector -> one of 8 directions. */
export function dirOf(fx: number, fy: number): number {
  if (fx === 0 && fy === 0) return DIR_DOWN;
  const a = Math.atan2(fy, fx); // 0 = right, +pi/2 = down
  const o = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  return [DIR_RIGHT, DIR_DOWN_RIGHT, DIR_DOWN, DIR_DOWN_LEFT, DIR_LEFT, DIR_UP_LEFT, DIR_UP, DIR_UP_RIGHT][o]!;
}

export type HairStyle =
  'short' | 'long' | 'bun' | 'bald' | 'braids' | 'curly' | 'ponytail' | 'spiky' | 'swept' | 'topknot' | 'twintail';
export type HatStyle = 'cap' | 'brim' | 'beret' | 'helm' | 'hood' | 'circlet' | 'bandana' | 'crown';
/** Garment cut: how far the skirts hang and what sits on the shoulders. Plain tunic when absent. */
export type DressStyle = 'robe' | 'coat' | 'mantle' | 'plated';
export interface Outfit {
  shirt: Ramp;
  pants: Ramp;
  hair: Ramp;
  skin: Ramp;
  boots: Ramp;
  longHair?: boolean;
  hat?: Ramp;
  /** NPC extras */
  hairStyle?: HairStyle;
  hatStyle?: HatStyle;
  beard?: Ramp;
  moustache?: boolean;
  glasses?: boolean;
  apron?: Ramp;
  scarf?: Ramp;
  /** px by which the body is shorter (children) */
  shorten?: number;
  headband?: number;
  /** quantum adventurer trim: glowing seams on the tunic */
  glow?: number;
  cape?: Ramp;
  vest?: Ramp;
  /** garment cut (skirts, mantle, plate) */
  dress?: DressStyle;
  /** hems, collars, cuffs and buckles (palette index) */
  trim?: number;
  /** iris colour (palette index) */
  eyes?: number;
  /** shoulder guards and breastplate */
  plate?: Ramp;
  /** shoulder mantle */
  mantle?: Ramp;
  /** diagonal chest sash */
  sash?: Ramp;
}

const SKIN_LIGHT = [C.e3, C.e4, C.e5, C.e6, C.e7] as Ramp;
const SKIN_MID = [C.e3, C.e4, C.e5, C.e6, C.e7] as Ramp;
const SKIN_DARK = [C.e1, C.e2, C.e3, C.e4, C.e5] as Ramp;
const SKINS_EXTRA = [
  [C.e4, C.e5, C.e6, C.e7, C.white],
  [C.e0, C.e1, C.e2, C.e3, C.e4],
] as Ramp[];
const HAIR = {
  brown: [C.e0, C.e1, C.e2, C.e3, C.e4] as Ramp,
  black: [C.ink, C.night, C.slate, C.steel] as Ramp,
  blond: [C.e3, C.e4, C.e5, C.e6, C.e7] as Ramp,
  red: [C.r0, C.r1, C.r2, C.r3, C.r4] as Ramp,
  white: [C.steel, C.mist, C.fog, C.pale, C.white] as Ramp,
  violet: [C.q0, C.q1, C.q2, C.q3, C.q4] as Ramp,
};
const cloth = (a: number[]) => a as Ramp;
const PANTS = {
  brown: cloth([C.e0, C.e1, C.e2, C.e3]),
  slate: cloth([C.night, C.slate, C.steel, C.mist]),
  navy: cloth([C.w0, C.w1, C.w2, C.w3]),
  olive: cloth([C.g0, C.g1, C.g2, C.g3]),
};
const BOOTS = cloth([C.ink, C.e0, C.e1, C.e2]);

/** Player appearance presets (chosen from the session id) and NPC outfits. */
export const OUTFITS: Outfit[] = [
  {
    shirt: cloth([C.w1, C.w2, C.w3, C.w4, C.w5]),
    pants: PANTS.brown,
    hair: HAIR.brown,
    skin: SKIN_LIGHT,
    boots: BOOTS,
    glow: C.q7,
    cape: cloth([C.q0, C.q1, C.q2, C.q3]),
  },
  {
    shirt: cloth([C.r1, C.r2, C.r3, C.r4, C.r5]),
    pants: PANTS.slate,
    hair: HAIR.black,
    skin: SKIN_MID,
    boots: BOOTS,
    longHair: true,
    glow: C.q6,
  },
  {
    shirt: cloth([C.q1, C.q2, C.q3, C.q4, C.q6]),
    pants: PANTS.navy,
    hair: HAIR.blond,
    skin: SKIN_LIGHT,
    boots: BOOTS,
    glow: C.q7,
    hairStyle: 'ponytail',
  },
  {
    shirt: cloth([C.g1, C.g2, C.g3, C.g4, C.g5]),
    pants: PANTS.brown,
    hair: HAIR.red,
    skin: SKIN_MID,
    boots: BOOTS,
    longHair: true,
    vest: cloth([C.e1, C.e2, C.e3, C.e4]),
  },
  {
    shirt: cloth([C.e3, C.e4, C.e5, C.e6, C.e7]),
    pants: PANTS.olive,
    hair: HAIR.violet,
    skin: SKIN_DARK,
    boots: BOOTS,
    hairStyle: 'curly',
    glow: C.q5,
  },
  {
    shirt: cloth([C.steel, C.mist, C.fog, C.pale, C.white]),
    pants: PANTS.slate,
    hair: HAIR.white,
    skin: SKIN_DARK,
    boots: BOOTS,
    longHair: true,
    cape: cloth([C.w0, C.w1, C.w2, C.w3]),
  },
  {
    shirt: cloth([C.r2, C.r3, C.r4, C.r5, C.r6]),
    pants: PANTS.navy,
    hair: HAIR.black,
    skin: SKIN_LIGHT,
    boots: BOOTS,
    hairStyle: 'bun',
  },
  {
    shirt: cloth([C.w2, C.w3, C.w4, C.w5, C.w6]),
    pants: PANTS.brown,
    hair: HAIR.blond,
    skin: SKIN_DARK,
    boots: BOOTS,
    hat: cloth([C.e1, C.e2, C.e3, C.e4]),
    hatStyle: 'brim',
  },
];

/** Worn armour sets (look = 8 + set.look): shown whenever 3+ pieces of a set are equipped. */
export const COSMETIC_OUTFITS = OUTFITS.length;
OUTFITS.push(
  // leather: soft brown hide, hood
  {
    shirt: cloth([C.e1, C.e2, C.e3, C.e4, C.e5]),
    pants: PANTS.brown,
    hair: HAIR.brown,
    skin: SKIN_LIGHT,
    boots: BOOTS,
    vest: cloth([C.e0, C.e1, C.e2, C.e3]),
    hat: cloth([C.e1, C.e2, C.e3, C.e4]),
    hatStyle: 'hood',
  },
  // hunter: forest green with a cap and short cloak
  {
    shirt: cloth([C.g1, C.g2, C.g3, C.g4, C.g5]),
    pants: PANTS.olive,
    hair: HAIR.red,
    skin: SKIN_MID,
    boots: BOOTS,
    vest: cloth([C.e1, C.e2, C.e3, C.e4]),
    hat: cloth([C.g1, C.g2, C.g3, C.g4]),
    hatStyle: 'cap',
    cape: cloth([C.g0, C.g1, C.g2, C.g3]),
  },
  // iron: full plate
  {
    shirt: cloth([C.slate, C.steel, C.mist, C.fog, C.pale]),
    pants: cloth([C.night, C.slate, C.steel, C.mist]),
    hair: HAIR.black,
    skin: SKIN_LIGHT,
    boots: cloth([C.ink, C.night, C.slate, C.steel]),
    hat: cloth([C.slate, C.steel, C.mist, C.fog, C.pale]),
    hatStyle: 'helm',
    cape: cloth([C.r1, C.r2, C.r3, C.r4]),
  },
  // silk: violet quantum robes with a glowing seam
  {
    shirt: cloth([C.q1, C.q2, C.q3, C.q4, C.q6]),
    pants: cloth([C.q0, C.q1, C.q2, C.q3]),
    hair: HAIR.white,
    skin: SKIN_LIGHT,
    boots: cloth([C.q0, C.q1, C.q2]),
    hat: cloth([C.q1, C.q2, C.q3, C.q4]),
    hatStyle: 'hood',
    glow: C.q7,
    cape: cloth([C.q0, C.q1, C.q2, C.q3]),
    longHair: true,
  },
  // voidglass: crystal mail, cyan glow, circlet
  {
    shirt: cloth([C.w2, C.w3, C.w5, C.w6, C.w7]),
    pants: cloth([C.w1, C.w2, C.w3, C.w4]),
    hair: HAIR.violet,
    skin: SKIN_DARK,
    boots: cloth([C.w0, C.w1, C.w2, C.w3]),
    hat: cloth([C.w3, C.w5, C.w6, C.w7, C.white]),
    hatStyle: 'circlet',
    glow: C.q7,
    cape: cloth([C.w0, C.w1, C.w2, C.w4]),
  },
);

const rmp = (a: number[]) => a as Ramp;
/** One distinctive look per village NPC (ids from shared NPCS). */
/** Kingdom residents (revision 5): realm colours and uniforms, varied by role and a stable per-id hash. */
const REALM_LOOK: Record<string, { a: Ramp; b: Ramp; trim: number; hair: Ramp[]; skin: Ramp[]; styles: HairStyle[] }> =
  {
    aurelion: {
      a: rmp([C.w1, C.w2, C.w3, C.w4, C.w5]),
      b: rmp([C.e3, C.e4, C.e5, C.e6]),
      trim: C.e6,
      hair: [HAIR.blond, HAIR.brown, HAIR.red],
      skin: [SKIN_LIGHT, SKIN_MID],
      styles: ['short', 'swept', 'braids', 'long', 'bun'],
    },
    sylvaris: {
      a: rmp([C.g1, C.g2, C.g3, C.g4, C.g5]),
      b: rmp([C.e1, C.e2, C.e3, C.e4]),
      trim: C.g6,
      hair: [HAIR.brown, HAIR.white, HAIR.violet, HAIR.blond],
      skin: [SKIN_LIGHT, SKIN_MID, SKIN_DARK],
      styles: ['long', 'braids', 'ponytail', 'curly', 'bun'],
    },
    khardum: {
      a: rmp([C.slate, C.steel, C.mist, C.fog]),
      b: rmp([C.r0, C.r1, C.r2, C.r3]),
      trim: C.e6,
      hair: [HAIR.red, HAIR.brown, HAIR.black],
      skin: [SKIN_MID, SKIN_LIGHT],
      styles: ['braids', 'spiky', 'short', 'ponytail'],
    },
    raijin: {
      a: rmp([C.r1, C.r2, C.r3, C.r4, C.r5]),
      b: rmp([C.night, C.slate, C.steel, C.mist]),
      trim: C.white,
      hair: [HAIR.black, HAIR.black, HAIR.brown],
      skin: [SKIN_LIGHT, SKIN_MID],
      styles: ['topknot', 'twintail', 'short', 'ponytail', 'bun'],
    },
    thalassara: {
      a: rmp([C.w2, C.w3, C.w4, C.w5, C.w6]),
      b: rmp([C.e3, C.e4, C.e5, C.e6]),
      trim: C.pale,
      hair: [HAIR.white, HAIR.black, HAIR.violet, HAIR.brown],
      skin: [SKIN_DARK, SKIN_MID, SKIN_LIGHT],
      styles: ['curly', 'long', 'braids', 'swept', 'ponytail'],
    },
    nethrakar: {
      a: rmp([C.night, C.slate, C.q0, C.q1, C.q2]),
      b: rmp([C.r1, C.r2, C.r3, C.r4]),
      trim: C.r5,
      hair: [HAIR.white, HAIR.black, HAIR.violet, HAIR.red],
      skin: [SKIN_DARK, SKIN_MID],
      styles: ['swept', 'long', 'spiky', 'topknot'],
    },
  };
function realmOutfit(n: { id: string; realm?: string; role?: string }, i: number): Outfit {
  const k = REALM_LOOK[n.realm ?? 'aurelion']!;
  let h = 0;
  for (const c of n.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const pick = <T>(a: T[], o = 0): T => a[(h + o) % a.length]!;
  const role = n.role ?? 'hand';
  const hair = pick(k.hair, 3);
  const base: Outfit = {
    shirt: k.a,
    pants: rmp([C.e0, C.e1, C.e2, C.e3]),
    hair,
    skin: pick(k.skin, 5),
    boots: rmp([C.e0, C.e1, C.e2, C.e3]),
    hairStyle: pick(k.styles, 7),
    eyes: pick([C.e2, C.g4, C.w5, C.r5, C.q4, C.e3], 11),
    trim: k.trim,
  };
  const soldierArms = { plate: rmp([C.slate, C.steel, C.mist, C.fog, C.pale]), cape: k.b, pants: k.b };
  switch (role) {
    case 'ruler':
      return { ...base, shirt: k.a, dress: 'robe', mantle: k.b, cape: k.b, sash: rmp([C.e5, C.e6, C.e7]), trim: C.e7 };
    case 'court':
      return {
        ...base,
        dress: 'coat',
        mantle: k.b,
        sash: rmp([C.e4, C.e5, C.e6]),
        ...(h % 3 === 0 ? { glasses: true } : {}),
      };
    case 'commander':
      return {
        ...base,
        ...soldierArms,
        hat: k.b,
        hatStyle: 'brim',
        sash: rmp([C.e5, C.e6, C.e7]),
        beard: i % 2 ? hair : undefined,
      };
    case 'guard':
    case 'soldier':
      return { ...base, ...soldierArms, hat: k.a, hatStyle: 'cap', ...(h % 4 === 0 ? { moustache: true } : {}) };
    case 'archer':
      return { ...base, hat: k.a, hatStyle: 'hood', cape: k.a, pants: k.b };
    case 'innkeeper':
      return { ...base, apron: rmp([C.pale, C.white, C.fog]), shirt: k.b, ...(h % 2 ? { moustache: true } : {}) };
    case 'smith':
      return {
        ...base,
        apron: rmp([C.e0, C.e1, C.e2, C.night]),
        shirt: rmp([C.night, C.slate, C.steel]),
        beard: n.realm === 'khardum' || h % 3 === 0 ? hair : undefined,
      };
    case 'merchant':
      return { ...base, vest: k.b, hat: k.b, hatStyle: 'beret', scarf: k.a };
    case 'herbalist':
      return {
        ...base,
        dress: 'robe',
        hat: rmp([C.g1, C.g2, C.g3, C.g4]),
        hatStyle: 'hood',
        scarf: rmp([C.g2, C.g3, C.g4]),
      };
    case 'scholar':
      return { ...base, dress: 'robe', glasses: true, shirt: rmp([C.q0, C.q1, C.q2, C.q3]) };
    case 'elder':
      return { ...base, hair: HAIR.white, dress: 'mantle', mantle: k.b, beard: h % 2 ? HAIR.white : undefined };
    case 'farmer':
    case 'hand':
    default:
      return {
        ...base,
        shirt: k.b,
        hat: rmp([C.e3, C.e4, C.e5, C.e6]),
        hatStyle: 'brim',
        apron: i % 3 ? undefined : k.a,
      };
  }
}

export const NPC_LOOKS: Record<string, Outfit> = {
  // the mayor: silver bun, spectacles, a long violet coat with gold lapels and a rose scarf
  orla: {
    shirt: rmp([C.q0, C.q1, C.q2, C.q3, C.q4]),
    pants: rmp([C.night, C.slate, C.steel, C.mist]),
    hair: rmp([C.slate, C.steel, C.mist, C.fog, C.pale]),
    skin: SKIN_MID,
    boots: BOOTS,
    hairStyle: 'bun',
    glasses: true,
    eyes: C.w5,
    dress: 'coat',
    trim: C.r6,
    scarf: rmp([C.r4, C.r5, C.r6, C.r7]),
    cape: rmp([C.q0, C.q1, C.q2, C.q3]),
  },
  // the grower: sun-bleached straw hat, green jerkin over linen, a copper moustache
  tobin: {
    shirt: rmp([C.e5, C.e6, C.e7, C.white, C.white]),
    pants: PANTS.brown,
    hair: HAIR.brown,
    skin: SKIN_LIGHT,
    boots: BOOTS,
    hat: rmp([C.e4, C.e5, C.e6, C.e7]),
    hatStyle: 'brim',
    vest: rmp([C.g1, C.g2, C.g3, C.g4]),
    apron: rmp([C.g1, C.g2, C.g3, C.g4]),
    moustache: true,
    beard: rmp([C.e0, C.e1, C.e2, C.e3]),
    eyes: C.g4,
    trim: C.r6,
  },
  // the smith: shaved head, soot beard, pauldrons of dark iron and a heavy leather apron
  brannoch: {
    shirt: rmp([C.r0, C.r1, C.r2, C.r3, C.r4]),
    pants: PANTS.slate,
    hair: HAIR.black,
    skin: SKIN_DARK,
    boots: rmp([C.ink, C.night, C.slate, C.steel]),
    hairStyle: 'bald',
    beard: rmp([C.ink, C.night, C.slate, C.steel]),
    apron: rmp([C.e0, C.e1, C.e2, C.e3]),
    headband: C.r3,
    plate: rmp([C.night, C.slate, C.steel, C.mist, C.fog]),
    eyes: C.r5,
    trim: C.e5,
  },
  // the baker: flour-white apron, a tall bun, rose dress with a warm sash
  maribel: {
    shirt: rmp([C.r2, C.r3, C.r4, C.r5, C.r6]),
    pants: PANTS.brown,
    hair: rmp([C.e1, C.e2, C.e3, C.e4, C.e5]),
    skin: SKIN_LIGHT,
    boots: BOOTS,
    hairStyle: 'topknot',
    dress: 'robe',
    apron: rmp([C.fog, C.pale, C.white, C.white]),
    eyes: C.e3,
    trim: C.white,
  },
  // the fisher: wide brim, fair beard, a sea-blue long coat with a red waistcoat
  fenwick: {
    shirt: rmp([C.w1, C.w2, C.w3, C.w4, C.w5]),
    pants: PANTS.brown,
    hair: HAIR.blond,
    skin: SKIN_LIGHT,
    boots: BOOTS,
    hat: rmp([C.e3, C.e4, C.e5, C.e6]),
    hatStyle: 'brim',
    beard: rmp([C.e3, C.e4, C.e5, C.e6]),
    vest: rmp([C.r1, C.r2, C.r3, C.r4]),
    dress: 'coat',
    trim: C.e6,
    eyes: C.w6,
  },
  // the elder: snow beard, indigo mantle trimmed in bone, a faded gold sash
  sedge: {
    shirt: rmp([C.w0, C.w1, C.w2, C.w3, C.w4]),
    pants: PANTS.olive,
    hair: HAIR.white,
    skin: SKIN_MID,
    boots: BOOTS,
    hat: rmp([C.w1, C.w2, C.w3, C.w4]),
    hatStyle: 'cap',
    beard: rmp([C.mist, C.fog, C.pale, C.white]),
    mantle: rmp([C.q0, C.q1, C.q2, C.q3]),
    trim: C.e7,
    sash: rmp([C.e3, C.e4, C.r6]),
    eyes: C.w5,
  },
  // the tinkerer: violet braids, a beret, a teal robe with a glowing seam and a rune scarf
  wren: {
    shirt: rmp([C.w1, C.w2, C.w3, C.w4, C.w6]),
    pants: PANTS.slate,
    hair: HAIR.violet,
    skin: SKIN_MID,
    boots: BOOTS,
    hairStyle: 'braids',
    hat: rmp([C.q0, C.q1, C.q2, C.q3]),
    hatStyle: 'beret',
    scarf: rmp([C.q3, C.q4, C.q5, C.q6]),
    dress: 'robe',
    glow: C.q7,
    eyes: C.q7,
    trim: C.q6,
  },
  // the weaver: ember ponytail, a cobalt coat cut in lapels, bright sea scarf
  pippa: {
    shirt: rmp([C.q3, C.q4, C.q5, C.q6, C.white]),
    pants: PANTS.navy,
    hair: rmp([C.r2, C.r3, C.r4, C.r5, C.r6]),
    skin: SKIN_DARK,
    boots: BOOTS,
    hairStyle: 'swept',
    scarf: rmp([C.w4, C.w5, C.w6, C.w7]),
    dress: 'coat',
    trim: C.r7,
    eyes: C.q7,
    sash: rmp([C.q1, C.q2, C.w6]),
  },
  // the carpenter: bandana, ruddy beard, a canvas jerkin and a tool apron
  odo: {
    shirt: rmp([C.fog, C.pale, C.white, C.white, C.white]),
    pants: PANTS.brown,
    hair: HAIR.red,
    skin: SKIN_LIGHT,
    boots: BOOTS,
    hairStyle: 'short',
    hat: rmp([C.r1, C.r2, C.r3, C.r4, C.r5]),
    hatStyle: 'bandana',
    beard: rmp([C.r1, C.r2, C.r3, C.r4]),
    moustache: true,
    apron: rmp([C.e2, C.e3, C.e4, C.e5]),
    vest: rmp([C.e1, C.e2, C.e3, C.e4]),
    eyes: C.g4,
  },
  // the scout: spiky straw hair, a green bandana and a short mantle, small and quick
  juniper: {
    shirt: rmp([C.g3, C.g4, C.g5, C.g6, C.g7]),
    pants: PANTS.brown,
    hair: rmp([C.e3, C.e4, C.e5, C.e6, C.e7]),
    skin: SKIN_MID,
    boots: BOOTS,
    hairStyle: 'twintail',
    shorten: 3,
    hat: rmp([C.r2, C.r3, C.r4, C.r5]),
    hatStyle: 'bandana',
    mantle: rmp([C.g1, C.g2, C.g3, C.g4]),
    trim: C.r6,
    eyes: C.w5,
  },
};

// ── the peoples of the three realms (shared/realmfolk.ts): each its own colouring, cut and bearing
const AERIN_SKIN = rmp([C.w4, C.w5, C.w6, C.w7, C.white]);
const AERIN_HAIR = rmp([C.mist, C.fog, C.pale, C.white, C.white]);
const HOLLOW_SKIN = rmp([C.slate, C.steel, C.q3, C.q4, C.mist]);
const HOLLOW_HAIR = rmp([C.ink, C.night, C.slate, C.steel, C.q3]);
const ARCHIVE_SKIN = rmp([C.e2, C.e3, C.e4, C.e5, C.e6]);
Object.assign(NPC_LOOKS, {
  // the Aerin: pale sky-blue skin, white hair, gold eyes, light robes and circlets
  aerin_lysa: {
    shirt: rmp([C.w4, C.w5, C.w6, C.w7, C.white]),
    pants: rmp([C.fog, C.pale, C.white, C.white]),
    hair: AERIN_HAIR,
    skin: AERIN_SKIN,
    boots: BOOTS,
    hairStyle: 'long',
    eyes: C.e7,
    dress: 'robe',
    trim: C.e7,
    hat: rmp([C.e5, C.e6, C.e7, C.white]),
    hatStyle: 'circlet',
    glow: C.w7,
  },
  aerin_corvane: {
    shirt: rmp([C.w2, C.w3, C.w4, C.w5, C.w6]),
    pants: rmp([C.slate, C.steel, C.mist, C.fog]),
    hair: AERIN_HAIR,
    skin: AERIN_SKIN,
    boots: BOOTS,
    hairStyle: 'swept',
    eyes: C.e7,
    dress: 'plated',
    plate: rmp([C.mist, C.fog, C.pale, C.white, C.white]),
    trim: C.e6,
    cape: rmp([C.w3, C.w4, C.w5, C.w6]),
  },
  aerin_elder: {
    shirt: rmp([C.fog, C.pale, C.white, C.white, C.white]),
    pants: rmp([C.fog, C.pale, C.white, C.white]),
    hair: AERIN_HAIR,
    skin: AERIN_SKIN,
    boots: BOOTS,
    hairStyle: 'long',
    beard: AERIN_HAIR,
    eyes: C.e7,
    dress: 'mantle',
    trim: C.e7,
    mantle: rmp([C.e5, C.e6, C.e7, C.white]),
    glow: C.e7,
  },
  // the Hollowfolk: grey-violet skin, black hair, eyes that glow, hooded coats against the dark
  hollow_mirren: {
    shirt: rmp([C.q1, C.q2, C.q3, C.q4, C.q5]),
    pants: rmp([C.ink, C.night, C.slate, C.steel]),
    hair: HOLLOW_HAIR,
    skin: HOLLOW_SKIN,
    boots: BOOTS,
    hairStyle: 'braids',
    eyes: C.q6,
    dress: 'coat',
    trim: C.e6,
    apron: rmp([C.e1, C.e2, C.e3, C.e4]),
    glow: C.q6,
  },
  hollow_brannoc: {
    shirt: rmp([C.night, C.slate, C.q2, C.q3, C.q4]),
    pants: rmp([C.ink, C.night, C.slate, C.steel]),
    hair: HOLLOW_HAIR,
    skin: HOLLOW_SKIN,
    boots: BOOTS,
    hairStyle: 'short',
    beard: HOLLOW_HAIR,
    eyes: C.q6,
    dress: 'plated',
    plate: rmp([C.ink, C.night, C.slate, C.q3, C.q4]),
    trim: C.q6,
    cape: rmp([C.q0, C.q1, C.q2, C.q3]),
  },
  hollow_elder: {
    shirt: rmp([C.q0, C.q1, C.q2, C.q3, C.q4]),
    pants: rmp([C.ink, C.night, C.slate, C.steel]),
    hair: rmp([C.steel, C.mist, C.fog, C.pale, C.white]),
    skin: HOLLOW_SKIN,
    boots: BOOTS,
    hairStyle: 'bun',
    eyes: C.e7,
    dress: 'robe',
    trim: C.e7,
    hat: rmp([C.q0, C.q1, C.q2, C.q3]),
    hatStyle: 'hood',
    glow: C.e7,
  },
  // the Archivists: bronze skin, shaven or topknotted, spectacles, robes with brass trim
  archive_quill: {
    shirt: rmp([C.e1, C.e2, C.e3, C.e4, C.e5]),
    pants: rmp([C.e0, C.e1, C.e2, C.e3]),
    hair: rmp([C.ink, C.e0, C.e1, C.e2, C.e3]),
    skin: ARCHIVE_SKIN,
    boots: BOOTS,
    hairStyle: 'topknot',
    glasses: true,
    eyes: C.q5,
    dress: 'robe',
    trim: C.e7,
    scarf: rmp([C.q2, C.q3, C.q4, C.q5]),
  },
  archive_halden: {
    shirt: rmp([C.e3, C.e4, C.e5, C.e6, C.e7]),
    pants: rmp([C.e0, C.e1, C.e2, C.e3]),
    hair: rmp([C.ink, C.e0, C.e1, C.e2, C.e3]),
    skin: ARCHIVE_SKIN,
    boots: BOOTS,
    hairStyle: 'bald',
    eyes: C.q5,
    dress: 'plated',
    plate: rmp([C.e3, C.e4, C.e5, C.e6, C.e7]),
    trim: C.q5,
    cape: rmp([C.q1, C.q2, C.q3, C.q4]),
  },
  archive_prime: {
    shirt: rmp([C.mist, C.fog, C.pale, C.white, C.white]),
    pants: rmp([C.e1, C.e2, C.e3, C.e4]),
    hair: rmp([C.mist, C.fog, C.pale, C.white, C.white]),
    skin: ARCHIVE_SKIN,
    boots: BOOTS,
    hairStyle: 'bald',
    beard: rmp([C.mist, C.fog, C.pale, C.white]),
    glasses: true,
    eyes: C.q6,
    dress: 'mantle',
    mantle: rmp([C.e5, C.e6, C.e7, C.white]),
    trim: C.q5,
    glow: C.q6,
  },
} satisfies Record<string, Outfit>);

// ───────────────────────── people ─────────────────────────
interface View {
  turn: number;
  s: number;
} // turn 0 front .. 1 profile .. 2 back; s = +1 facing right, -1 left
const VIEWS: View[] = [
  { turn: 0, s: 1 }, // DOWN
  { turn: 2, s: 1 }, // UP
  { turn: 1, s: -1 }, // LEFT
  { turn: 1, s: 1 }, // RIGHT
  { turn: 0.5, s: -1 }, // DOWN_LEFT
  { turn: 0.5, s: 1 }, // DOWN_RIGHT
  { turn: 1.5, s: -1 }, // UP_LEFT
  { turn: 1.5, s: 1 }, // UP_RIGHT
];

/** Shared near-hand anchor for the body and held equipment; coordinates in the 24×32 frame. */
function legacyGrip(dir: number, frame: number): { x: number; y: number; angle: number } {
  const work = actionPose(dir, frame);
  if (work) return { x: work.x, y: work.y, angle: work.angle };
  const { s, turn } = VIEWS[dir]!;
  const profile = turn === 1,
    three = turn === 0.5 || turn === 1.5,
    back = turn > 1.2,
    front = turn < 0.8;
  const nearK = (back ? s : -s) > 0 ? 1 : 0;
  const running = frame >= RUN_FRAME && frame < SHOT_FRAME;
  const moving = (frame >= 1 && frame <= 8) || running;
  const action =
    frame >= CAST_FRAME
      ? frame - CAST_FRAME
      : frame >= SHOT_FRAME
        ? frame - SHOT_FRAME
        : frame >= ATTACK_FRAME && frame < RUN_FRAME
          ? frame - ATTACK_FRAME
          : -1;
  const reach = action >= 0 ? [0.35, 1, 0.65, 0][action]! : 0;
  const aim = [
    [0, 1],
    [0, -1],
    [-1, 0],
    [1, 0],
    [-0.894, 0.447],
    [0.894, 0.447],
    [-0.894, -0.447],
    [0.894, -0.447],
  ][dir]!;
  const sw = moving ? Math.sin(((running ? frame - RUN_FRAME : frame - 1) / 8) * Math.PI * 2) * (running ? 1.3 : 1) : 0;
  const sk = nearK ? sw : -sw;
  const top = moving ? (Math.abs(sw) < 0.5 ? -1 : 0) : action >= 0 ? -reach * 0.7 : frame === 9 ? 0.6 : 0;
  const sy = 14.3 + top;
  const lean = (profile ? 0.6 : three ? 0.3 : 0) * s * (running ? 2 : moving ? 1 : 0.5) + aim[0]! * reach;
  const sx = profile ? 12.5 + lean * 0.8 : 12.5 + (nearK ? 1 : -1) * ((three ? 4 : 4.5) - 0.7) + lean;
  let x = profile
    ? sx + (sk * 2.8 + Math.max(0, sk) * 0.8) * s
    : sx + (nearK ? 0.9 : -0.9) + (three ? sk * 1.6 * s : 0);
  let y = profile
    ? sy + 7 - Math.abs(sk) * 0.9 - Math.max(0, sk) * 0.6
    : sy + 7 + (front ? sk : back ? -sk : sk * 0.7) * 1.1;
  if (action >= 0) {
    x = sx + aim[0]! * (2 + reach * 5);
    y = sy + 3 + aim[1]! * reach * 4;
  }
  const aimAngle = Math.atan2(aim[1]!, aim[0]!);
  // Crossbow points along aim; a blade cuts across it, a staff returns upright after release.
  let angle = action >= 0 ? aimAngle + [-0.8, -0.1, 0.45, -0.7][action]! : -1.1 + sw * 0.15;
  if (frame >= CAST_FRAME) angle = action === 1 ? aimAngle - 0.35 : -1.35;
  else if (frame >= SHOT_FRAME) {
    angle = aimAngle;
    x -= aim[0]! * (action === 2 ? 1.2 : 0);
    y -= aim[1]! * (action === 2 ? 1.2 : 0);
  }
  return { x, y, angle };
}

/** Native 32×48 body and equipment share a single contact solver. */
export function personGrip(dir: number, frame: number): { x: number; y: number; angle: number } {
  const p = legacyGrip(dir, frame);
  // Reserve room for the support hand and outline when reaching diagonally away from the camera.
  return { x: Math.max(6, Math.min(PERSON_W - 6, p.x * 1.25 + 0.375)), y: p.y * 1.5, angle: p.angle };
}
function drawPerson(ctx: Ctx, dir: number, frame: number, o: Outfit, _seed: number): void {
  paintPerson(ctx, dir, frame, o, personGrip(dir, frame));
}

const FUR: Ramp = [C.e1, C.e2, C.e3, C.e4, C.e5, C.e6];
const FUR_DEER: Ramp = [C.e0, C.e1, C.e2, C.e3, C.e4, C.e5];
const CREAM: Ramp = [C.e5, C.e6, C.e7, C.white];

/** 20x18 hopping rabbit facing right. frames: 0 crouch, 1 launch, 2 peak, 3 land. */
function drawRabbit(ctx: Ctx, frame: number): void {
  const air = [0, 2, 4, 1][frame]!;
  const st = [0, 1.5, 1, -0.5][frame]!; // stretch (+) / squash (-)
  const by = 14 - air;
  blob(ctx, 6 - st, by - 0.5, 4.4, 3.4 - st * 0.3, FUR, { seed: 4, noise: 0.15, edgeDark: 0.25 }); // haunch
  blob(ctx, 10, by - 2.4, 5.6 + st * 0.6, 3.8 - st * 0.4, FUR, { seed: 5, noise: 0.15, edgeDark: 0.22 }); // body
  blob(ctx, 10.5, by - 0.8, 4, 1.6, CREAM, { seed: 6, noise: 0.05, edgeDark: 0 });
  blob(ctx, 2.6 - st, by - 3.4, 2, 2, [C.fog, C.pale, C.white, C.white], { seed: 3, noise: 0.05, edgeDark: 0.15 }); // tail
  blob(ctx, 15 + st * 0.5, by - 5, 3.4, 3, FUR, { seed: 7, noise: 0.1, edgeDark: 0.2, bright: 0.05 }); // head
  const ear = frame === 2 ? 1 : 0;
  limb(ctx, 13.5 + st * 0.5, by - 7, 12.5 - ear, by - 12 + ear, 1.2, 1.1, FUR, 8);
  limb(ctx, 15.2 + st * 0.5, by - 7, 15.8 - ear, by - 12.5 + ear, 1.2, 1.1, FUR, 9, 0.1);
  put(ctx, Math.round(15.7 + st * 0.5 - ear), by - 11, C.r5, 1, 3);
  put(ctx, Math.round(16.6 + st * 0.5), by - 6, C.ink, 1, 2);
  put(ctx, Math.round(16.6 + st * 0.5), by - 6, C.night);
  put(ctx, Math.round(18.2 + st * 0.5), by - 4, C.r5);
  // feet
  put(ctx, Math.round(13 + st), by + 1 + Math.min(air, 1), FUR[2]!, 3, 1);
  put(ctx, Math.round(3 - st * 2), by + 1, FUR[1]!, 5, 1);
}

/** 34x34 walking stag facing right. 4-frame walk cycle. */
function drawDeer(ctx: Ctx, frame: number): void {
  const sw = [2, 0, -2, 0][frame]!;
  const bob = frame % 2 === 0 ? 0 : 1;
  const B = 18 - bob;
  for (const [lx, d, ramp] of [
    [11, -sw, [C.e0, C.e1, C.e2]],
    [23, sw, [C.e0, C.e1, C.e2]],
    [9, sw, FUR_DEER],
    [25, -sw, FUR_DEER],
  ] as const) {
    limb(ctx, lx, B + 2, lx + d * 0.6, 30, 1.8, 1.1, ramp as Ramp, lx);
    put(ctx, Math.round(lx + d * 0.6) - 1, 31, C.ink, 2, 2);
  }
  blob(ctx, 17, B - 1, 10, 5, FUR_DEER, { seed: 12, noise: 0.12, edgeDark: 0.25 });
  blob(ctx, 16, B + 2, 7, 2, CREAM, { seed: 13, noise: 0.05, edgeDark: 0 });
  for (let i = 0; i < 5; i++) put(ctx, 11 + i * 3, B - 3 + (i % 2), C.e6);
  blob(ctx, 7, B - 3, 2, 2.4, [C.pale, C.white, C.white], { seed: 14, noise: 0 });
  limb(ctx, 24, B - 2, 27, B - 10, 3.2, 2.4, FUR_DEER, 15, 0.08);
  blob(ctx, 28.5, B - 11.5, 3.6, 2.8, FUR_DEER, { seed: 16, noise: 0.08, edgeDark: 0.2, bright: 0.06 });
  blob(ctx, 31.3, B - 10.5, 1.6, 1.4, [C.e1, C.e2, C.e3], { seed: 17, noise: 0 });
  put(ctx, 29, B - 13, C.ink, 1, 2);
  put(ctx, 32, B - 10, C.ink);
  put(ctx, 25, B - 14, FUR_DEER[1]!, 2, 2);
  // antlers
  const ant = [
    [27, B - 14, 25, B - 20],
    [25, B - 20, 23, B - 23],
    [25, B - 20, 27, B - 23],
    [28, B - 14, 30, B - 19],
    [30, B - 19, 29, B - 23],
    [30, B - 19, 32, B - 21],
  ] as const;
  for (const [x0, y0, x1, y1] of ant) limb(ctx, x0, y0, x1, y1, 0.7, 0.6, [C.e4, C.e5, C.e6, C.e7], 18);
}

const GEL: Ramp = [C.w1, C.w2, C.w3, C.w4, C.w5, C.w6, C.w7];
const GEL_N: Ramp = [C.q0, C.q1, C.q2, C.q3, C.q4, C.q6, C.white];

/** Wisp Slime, 24x20: wobbly jelly with a floating wisp-core and squash/stretch. */
function drawSlime(ctx: Ctx, frame: number, night: boolean): void {
  const ramp = night ? GEL_N : GEL;
  const squash = [0, 1.4, 2.4, 1][frame % 4]!;
  const ry = 7.2 - squash * 0.9,
    rx = 8 + squash * 0.9;
  const cy = 19 - ry;
  // gooey base puddle
  blob(ctx, 12, 18.4, rx + 1.2, 1.6, ramp, { seed: 2, noise: 0.05, bright: -0.25, edgeDark: 0.1 });
  blob(ctx, 12, cy, rx, ry, ramp, { seed: night ? 7 : 3, noise: 0.06, bright: 0.02, edgeDark: 0.42, shape: 2.15 });
  // translucent core with a wisp inside
  blob(ctx, 12.6, cy + 1.5, rx * 0.45, ry * 0.4, ramp, { seed: 4, noise: 0.05, bright: 0.25, edgeDark: 0.05 });
  const wy = Math.round(cy + 1 - (frame % 2));
  put(ctx, 12, wy, night ? C.q7 : C.w7, 2, 2);
  put(ctx, 13, wy - 1, C.white);
  // highlights
  put(ctx, Math.round(12 - rx * 0.55), Math.round(cy - ry * 0.55), C.white, 2, 1);
  put(ctx, Math.round(12 - rx * 0.62), Math.round(cy - ry * 0.4), C.white, 1, 1);
  // face
  const ey = Math.round(cy - ry * 0.12);
  for (const ex of [8, 15]) {
    put(ctx, ex, ey, C.ink, 2, 3);
    put(ctx, ex, ey, night ? C.q7 : C.white);
  }
  put(ctx, 11, ey + 3, C.ink, 3, 1);
  if (frame % 4 === 2) put(ctx, 12, ey + 4, C.r4); // a tongue on the big squash
}

/** Glint Hopper, 22x22: a crystal-backed jumping critter; frames 0 idle, 1 squat, 2 air, 3 land. */
function drawHopper(ctx: Ctx, frame: number, night: boolean): void {
  const ramp: Ramp = night ? [C.r0, C.r1, C.r2, C.r3, C.r4, C.r5] : FUR;
  const air = frame === 2 ? 4 : 0,
    squat = frame === 1 ? 2 : frame === 3 ? 1 : 0;
  const by = 20 - air;
  blob(ctx, 11, by - 5 + squat * 0.5, 7 + squat * 0.5, 5 - squat * 0.4 + (frame === 2 ? 0.8 : 0), ramp, {
    seed: night ? 5 : 2,
    noise: 0.15,
    edgeDark: 0.3,
  });
  blob(ctx, 11, by - 3 + squat * 0.4, 5, 2.2, CREAM, { seed: 3, noise: 0.05, edgeDark: 0, bright: -0.1 });
  // glinting crystal crest
  for (const [x, h] of [
    [7, 4],
    [10, 6],
    [13, 5],
    [15, 3],
  ] as const) {
    const y0 = by - 9 + squat;
    poly(
      ctx,
      [
        [x - 1.2, y0 + 1],
        [x, y0 - h],
        [x + 1.2, y0 + 1],
      ],
      (px) => (px < x ? (night ? C.q6 : C.q7) : night ? C.q3 : C.w5),
    );
  }
  // ears + eyes
  limb(ctx, 7, by - 8 + squat, 4.5, by - 13 + squat + (frame === 2 ? 2 : 0), 1.3, 1, ramp, 8);
  limb(ctx, 15, by - 8 + squat, 17.5, by - 13 + squat + (frame === 2 ? 2 : 0), 1.3, 1, ramp, 9);
  const ey = by - 6 + squat;
  put(ctx, 8, ey, C.ink, 2, 2);
  put(ctx, 13, ey, C.ink, 2, 2);
  put(ctx, 8, ey, night ? C.r6 : C.white);
  put(ctx, 13, ey, night ? C.r6 : C.white);
  put(ctx, 10, ey + 2, C.r3, 3, 1);
  // feet
  blob(ctx, 6, by - 0.5, 2.6, 1.4, ramp, { seed: 11, noise: 0.05 });
  blob(ctx, 16, by - 0.5, 2.6, 1.4, ramp, { seed: 12, noise: 0.05 });
}

function drawOrb(ctx: Ctx, frame: number): void {
  const r = frame ? 4.6 : 3.8;
  blob(ctx, 8, 8, r, r, [C.q2, C.q3, C.q4, C.q6, C.white], { seed: 1, noise: 0, bright: 0.15, edgeDark: 0.1 });
  put(ctx, 6, 6, C.white, 2, 1);
  put(ctx, frame ? 2 : 13, 8, C.q7);
  put(ctx, 8, frame ? 13 : 2, C.q7);
}

export interface Sheets {
  /** frame 0 = idle (breathes on its own), 1..WALK_FRAMES-1 = walk; dir = one of the 8 DIR_* constants */
  person(outfit: number, dir: number, frame: number): Texture;
  /** a player with a chosen appearance (packed, see shared/appearance.ts) wearing outfit/armour look `look` */
  styled(look: number, app: number, dir: number, frame: number): Texture;
  /** true when `styled(look, app, ...)` is already built (building one costs a frame or two, so callers can budget it) */
  styledReady(look: number, app: number): boolean;
  /** unique sprite per village NPC; same layout as `person` */
  npc(npcId: string, dir: number, frame: number): Texture;
  /** passive fauna: 4 frames, always drawn facing right (flip the sprite to face left) */
  rabbit(frame: number, dir: number): Texture;
  deer(frame: number, dir: number): Texture;
  slime(night: boolean, frame: number): Texture;
  hopper(night: boolean, frame: number): Texture;
  orb(frame: number): Texture;
}

function polished(buf: PixBuf): void {
  outline(buf.ctx, buf.width, buf.height, C.night);
  // Ground shadows belong to the world renderer, so they do not rise with a rider or a work pose.
  polish(buf.ctx, buf.width, buf.height, { rim: true });
}

function personSheet(looks: Outfit[], seedBase: number, cols = COLS): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(PERSON_W * cols, looks.length * 8 * PERSON_H);
  looks.forEach((o, i) => {
    for (let d = 0; d < 8; d++)
      for (let f = 0; f < cols; f++) {
        const buf = new PixBuf(PERSON_W, PERSON_H);
        undithered(() => drawPerson(buf.ctx, d, f, o, seedBase + i * 37 + d * 13));
        polished(buf);
        buf.blit(ctx, f * PERSON_W, (i * 8 + d) * PERSON_H);
      }
  });
  return canvas;
}

export function buildActorSheets(): Sheets {
  const personBases = new Map<number, Texture>();
  const personBaseFor = (o: number) => {
    let t = personBases.get(o);
    if (!t) {
      t = Texture.from(personSheet([OUTFITS[o]!], 1 + o * 37));
      t.source.scaleMode = 'nearest';
      personBases.set(o, t);
    }
    return t;
  };
  const npcIds = NPCS.map((n) => n.id);
  // One small atlas per visible NPC, instead of a tall all-resident texture that exceeds mobile limits.
  const npcBases = new Map<string, Texture>();
  const npcLooks = new Map<string, Outfit>();
  const npcBaseFor = (id: string): Texture => {
    let tex = npcBases.get(id);
    if (!tex) {
      const i = Math.max(0, npcIds.indexOf(id)),
        n = NPCS[i]!;
      const cloth: Ramp[] = [
        [C.g0, C.g1, C.g2, C.g3, C.g5],
        [C.w2, C.w3, C.w4, C.w5],
        [C.e1, C.e2, C.e3, C.e4, C.e5],
        [C.r0, C.r1, C.r2, C.r3, C.r4],
        [C.slate, C.steel, C.mist, C.fog],
        [C.q0, C.q1, C.q2, C.q3],
        [C.e3, C.e4, C.e5, C.e6],
        [C.g1, C.g2, C.g3, C.g4],
      ];
      const skin = [SKIN_LIGHT, SKIN_MID, SKIN_DARK][i % 3]!;
      const hairStyles: HairStyle[] = [
        'short',
        'long',
        'bun',
        'braids',
        'curly',
        'spiky',
        'ponytail',
        'swept',
        'topknot',
        'twintail',
      ];
      const hatStyles: HatStyle[] = ['cap', 'brim', 'beret', 'hood', 'bandana', 'beret'];
      const hairs = Object.values(HAIR);
      const skins = [SKIN_LIGHT, SKIN_MID, SKIN_DARK, SKINS_EXTRA[0]!, SKINS_EXTRA[1]!];
      const trims = [C.e4, C.fog, C.r6, C.r3, C.w5, C.e7];
      const dresses: Array<Outfit['dress']> = [
        undefined,
        'robe',
        'coat',
        undefined,
        'mantle',
        'plated',
        undefined,
        'coat',
      ];
      const eyeCols = [C.e2, C.g4, C.w5, C.r5, C.q4, C.e3];
      const look: Outfit =
        NPC_LOOKS[id] ??
        (n.realm
          ? realmOutfit(n, i)
          : n.settlement
            ? {
                shirt: cloth[i % 8]!,
                pants: cloth[(i + 4 + Math.floor(i / 8)) % 8]!,
                hair: hairs[(i * 3) % hairs.length]!,
                skin: skins[(i + Math.floor(i / 5)) % skins.length]!,
                boots: [C.e0, C.e1, C.e2, C.e3],
                hairStyle: hairStyles[(i + Math.floor(i / 7)) % hairStyles.length]!,
                eyes: eyeCols[(i * 5) % eyeCols.length]!,
                trim: trims[(i * 7) % trims.length]!,
                dress: dresses[(i + Math.floor(i / 3)) % dresses.length],
                ...(i % 8 === 5 ? { plate: rmp([C.slate, C.steel, C.mist, C.fog, C.pale]) } : {}),
                ...(i % 8 === 4 ? { mantle: cloth[(i + 1) % 8]! } : {}),
                ...(i % 8 === 2 || i % 8 === 7 ? { cape: cloth[(i + 5) % 8]! } : {}),
                ...(i % 6 === 1 ? { sash: rmp([C.e1, C.e2, trims[(i * 7) % trims.length]!]) } : {}),
                ...(i % 3 !== 0
                  ? { hat: cloth[(i + 2 + Math.floor(i / 6)) % 8]!, hatStyle: hatStyles[(i + Math.floor(i / 8)) % 6]! }
                  : { scarf: cloth[(i + 3) % 8]! }),
                ...(i % 4 === 0 && !(i % 8 === 4 || i % 8 === 5) ? { apron: cloth[(i + 5) % 8]! } : {}),
                ...(i % 5 === 0 ? { glasses: true } : {}),
                ...(['Oren', 'Bram', 'Garrick', 'Harlan', 'Toren'].includes(n.name.split(' ')[0]!)
                  ? { beard: hairs[i % hairs.length]! }
                  : {}),
              }
            : OUTFITS[i % COSMETIC_OUTFITS]!);
      npcLooks.set(id, look);
      tex = Texture.from(personSheet([look], 700 + i * 37, WALK_FRAMES + 1));
      tex.source.scaleMode = 'nearest';
      npcBases.set(id, tex);
    }
    return tex;
  };

  // Players with a chosen appearance get their own small atlas, built on first sight and recycled least-recently-used.
  // Villagers only walk, so an atlas starts with the ten walk/idle columns (a third of the work) and is rebuilt with the
  // strike/run/aim/cast columns only when someone actually asks for one of those frames.
  const styledAtlases = new Map<string, { base: Texture; subs: Map<string, Texture>; cols: number }>();
  const styledFor = (look: number, app: number, needCol = 0) => {
    const key = `${look}:${app}`;
    let e = styledAtlases.get(key);
    if (e && needCol >= e.cols) {
      for (const t of e.subs.values()) t.destroy(false);
      e.base.destroy(true);
      styledAtlases.delete(key);
      e = undefined;
    }
    if (e) {
      styledAtlases.delete(key);
    } else {
      const a = appearanceOf(app)!;
      const baseLook = OUTFITS[((look % OUTFITS.length) + OUTFITS.length) % OUTFITS.length]!;
      const outfit = outfitFromAppearance(baseLook, a, look === 0);
      const cols = needCol >= WALK_FRAMES + 1 ? COLS : WALK_FRAMES + 1;
      const base = Texture.from(personSheet([outfit], 400 + (app % 997) * 7, cols));
      base.source.scaleMode = 'nearest';
      e = { base, subs: new Map(), cols };
      while (styledAtlases.size >= 160) {
        const [oldKey, old] = styledAtlases.entries().next().value!;
        styledAtlases.delete(oldKey);
        for (const t of old.subs.values()) t.destroy(false);
        old.base.destroy(true);
      }
    }
    styledAtlases.set(key, e);
    return e;
  };

  // creatures: slime 24x20 (day/night x4), hopper 22x22 (x4 x2), orb 16x16 x2, rabbit 20x18 x4, deer 34x34 x4
  const cw = 34 * 4,
    ch = 20 * 2 + 22 * 2 + 16 + 18 + 34;
  const { canvas: cc, ctx: cctx } = makeCanvas(cw, ch);
  const stamp = (
    w: number,
    h: number,
    x: number,
    y: number,
    draw: (c: Ctx) => void,
    ao: [number, number, number] | null,
  ) => {
    const buf = new PixBuf(w, h);
    draw(buf.ctx);
    outline(buf.ctx, w, h, C.night);
    polish(buf.ctx, w, h, { rim: true, ao: ao ? { ax: ao[0], ay: ao[1], rx: ao[2] } : null });
    buf.blit(cctx, x, y);
  };
  const Y = { slime: 0, hopper: 40, orb: 84, rabbit: 100, deer: 118 };
  for (let f = 0; f < 4; f++) {
    stamp(24, 20, f * 24, Y.slime, (c) => drawSlime(c, f, false), null);
    stamp(22, 22, f * 22, Y.hopper, (c) => drawHopper(c, f, false), null);
    stamp(22, 22, f * 22, Y.hopper + 22, (c) => drawHopper(c, f, true), null);
    stamp(20, 18, f * 20, Y.rabbit, (c) => drawRabbit(c, f), null);
    stamp(34, 34, f * 34, Y.deer, (c) => drawDeer(c, f), null);
  }
  // night slimes go in the second slime row
  const slimeN = makeCanvas(96, 20);
  for (let f = 0; f < 4; f++) {
    const buf = new PixBuf(24, 20);
    drawSlime(buf.ctx, f, true);
    outline(buf.ctx, 24, 20, C.night);
    polish(buf.ctx, 24, 20, { rim: true });
    buf.blit(slimeN.ctx, f * 24, 0);
  }
  for (let f = 0; f < 2; f++) stamp(16, 16, f * 16, Y.orb, (c) => drawOrb(c, f), null);
  const cBase = Texture.from(cc);
  cBase.source.scaleMode = 'nearest';
  const nBase = Texture.from(slimeN.canvas);
  nBase.source.scaleMode = 'nearest';

  const cache = new Map<string, Texture>();
  const sub = (src: Texture, key: string, x: number, y: number, w: number, h: number) => {
    let t = cache.get(key);
    if (!t) {
      t = new Texture({ source: src.source, frame: new Rectangle(x, y, w, h) });
      cache.set(key, t);
    }
    return t;
  };
  // idle frames alternate with a breathing frame on their own clock (phase-offset per look/direction)
  const idleCol = (k: number) => ((performance.now() / 700 + k * 0.37) % 2 < 1.15 ? 0 : 9);
  const col = (f: number, k: number, max = COLS - 1) => (f === -1 ? 0 : f <= 0 ? idleCol(k) : Math.min(max, f));
  const dd = (d: number) => ((d % 8) + 8) % 8;
  const actionTextures = new Map<string, Texture>();
  const actionTexture = (key: string, outfit: Outfit, d: number, f: number) => {
    let t = actionTextures.get(key);
    if (!t) {
      t = Texture.from(renderPersonCanvas(outfit, dd(d), f));
      t.source.scaleMode = 'nearest';
      if (actionTextures.size >= 512) {
        const [oldKey, old] = actionTextures.entries().next().value!;
        actionTextures.delete(oldKey);
        old.destroy(true);
      }
      actionTextures.set(key, t);
    }
    return t;
  };
  const sheet: Sheets = {
    person: (o, d, f) => {
      if (actionPose(d, f)) return actionTexture(`p:${o}:${d}:${f}`, OUTFITS[o]!, d, f);
      const c = col(f, o * 3 + d);
      return sub(personBaseFor(o), `p${o}.${dd(d)}.${c}`, c * PERSON_W, dd(d) * PERSON_H, PERSON_W, PERSON_H);
    },
    styledReady: (look, app) => !appearanceOf(app) || styledAtlases.has(`${look}:${app}`),
    styled: (look, app, d, f) => {
      if (!appearanceOf(app)) return sheet.person(look, d, f);
      if (actionPose(d, f))
        return actionTexture(
          `a:${look}:${app}:${d}:${f}`,
          outfitFromAppearance(OUTFITS[look]!, appearanceOf(app)!, look === 0),
          d,
          f,
        );
      const c = col(f, (app % 31) * 3 + d);
      const e = styledFor(look, app, c);
      const k = `${dd(d)}.${c}`;
      let t = e.subs.get(k);
      if (!t) {
        t = new Texture({
          source: e.base.source,
          frame: new Rectangle(c * PERSON_W, dd(d) * PERSON_H, PERSON_W, PERSON_H),
        });
        e.subs.set(k, t);
      }
      return t;
    },
    npc: (id, d, f) => {
      if (actionPose(d, f)) {
        npcBaseFor(id);
        return actionTexture(`n:${id}:${d}:${f}`, npcLooks.get(id)!, d, f);
      }
      const i = Math.max(0, npcIds.indexOf(id));
      const c = col(f, i * 5 + d, WALK_FRAMES - 1);
      return sub(npcBaseFor(id), `n${i}.${dd(d)}.${c}`, c * PERSON_W, dd(d) * PERSON_H, PERSON_W, PERSON_H);
    },
    rabbit: (f) => sub(cBase, `r${f % 4}`, (f % 4) * 20, Y.rabbit, 20, 18),
    deer: (f) => sub(cBase, `d${f % 4}`, (f % 4) * 34, Y.deer, 34, 34),
    slime: (n, f) =>
      n ? sub(nBase, `sn${f % 4}`, (f % 4) * 24, 0, 24, 20) : sub(cBase, `s${f % 4}`, (f % 4) * 24, Y.slime, 24, 20),
    hopper: (n, f) => sub(cBase, `h${n}.${f % 4}`, (f % 4) * 22, Y.hopper + (n ? 22 : 0), 22, 22),
    orb: (f) => sub(cBase, `o${f % 2}`, (f % 2) * 16, Y.orb, 16, 16),
  };
  return sheet;
}

/** One person frame for UI previews (character creation): same painter and polish as the world sprites. */
export function renderPersonCanvas(o: Outfit, dir: number, frame: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(PERSON_W, PERSON_H);
  const buf = new PixBuf(PERSON_W, PERSON_H);
  undithered(() => drawPerson(buf.ctx, dir, frame, o, 1 + dir * 13));
  polished(buf);
  buf.blit(ctx, 0, 0);
  return canvas;
}
