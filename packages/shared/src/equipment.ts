/**
 * Armor sets, melee weapons and Foci. Pure data shared by server (stats, attacks), client (tooltips, looks) and recipes.
 * Quantum flavour: staves are Foci that bias which element your attacks collapse into, armor can phase-slip a hit.
 */
import { CATALOG_SETS } from './catalog/armor';
import { buildVariantWeapons } from './catalog/weapons-data';

export type ArmorSlot = 'head' | 'chest' | 'legs' | 'feet';
export const ARMOR_SLOTS: ArmorSlot[] = ['head', 'chest', 'legs', 'feet'];
export const ARMOR_SLOT_NAMES: Record<ArmorSlot, string> = { head: 'Head', chest: 'Body', legs: 'Legs', feet: 'Feet' };

/** Stats armor and weapons add. `def` and `phase` are fractions (0.1 = 10%). */
export interface Bonus {
  hp?: number;
  atk?: number;
  luck?: number;
  haste?: number;
  def?: number;
  phase?: number;
}

export interface ArmorSet {
  id: string;
  name: string;
  /** index of the worn-set look (client sprite palette); drawn when 3+ pieces are equipped */
  look: number;
  /** per-piece stats (same for each piece of the set) */
  piece: Bonus;
  /** bonus for wearing 2 and 4 pieces */
  two: Bonus;
  four: Bonus;
  /** short description of how it plays */
  blurb: string;
  pieces: Record<ArmorSlot, string>;
  /** player level to wear */
  level: number;
  /** inventory icon colours (catalog sets; the first five are listed in items.ts) */
  colors?: [number, number];
  /** the metal / cloth / hide the pieces are made of, for recipes */
  mat?: string;
}

const names = (a: string, b: string, c: string, d: string): Record<ArmorSlot, string> => ({
  head: a,
  chest: b,
  legs: c,
  feet: d,
});

export const ARMOR_SETS: ArmorSet[] = [
  {
    id: 'leather',
    name: "Wanderer's Leathers",
    look: 0,
    level: 1,
    piece: { def: 0.02, hp: 5 },
    two: { luck: 1 },
    four: { hp: 12, luck: 1 },
    blurb: 'Soft hide. Light, quiet and cheap.',
    pieces: names('Leather Hood', 'Leather Jerkin', 'Leather Leggings', 'Leather Boots'),
  },
  {
    id: 'hunter',
    name: "Hunter's Greens",
    look: 1,
    level: 8,
    piece: { def: 0.025, hp: 6, atk: 1 },
    two: { luck: 2 },
    four: { atk: 4, luck: 2, hp: 10 },
    blurb: 'Wolf-fang studded greens for those who live off the land.',
    pieces: names("Hunter's Cap", "Hunter's Coat", "Hunter's Trousers", "Hunter's Boots"),
  },
  {
    id: 'iron',
    name: 'Ironclad',
    look: 2,
    level: 12,
    piece: { def: 0.045, hp: 4 },
    two: { hp: 10 },
    four: { def: 0.08, hp: 16 },
    blurb: 'Heavy plate. Soaks up damage, asks for nothing back.',
    pieces: names('Iron Helm', 'Iron Cuirass', 'Iron Greaves', 'Iron Sabatons'),
  },
  {
    id: 'silk',
    name: 'Silkweave',
    look: 3,
    level: 16,
    piece: { def: 0.015, hp: 3, haste: 1 },
    two: { haste: 2 },
    four: { phase: 0.06, atk: 5, haste: 2 },
    blurb: 'Quantum-woven robes. Light, fast, and occasionally not quite there.',
    pieces: names('Silkweave Cowl', 'Silkweave Robe', 'Silkweave Skirt', 'Silkweave Slippers'),
  },
  {
    id: 'voidglass',
    name: 'Voidglass',
    look: 4,
    level: 24,
    piece: { def: 0.03, hp: 8 },
    two: { atk: 4 },
    four: { phase: 0.12, atk: 8, def: 0.05 },
    blurb: 'Crystal armour grown in a collapsed wavefunction. Hits sometimes pass straight through it.',
    pieces: names('Voidglass Circlet', 'Voidglass Mail', 'Voidglass Greaves', 'Voidglass Treads'),
  },
];
ARMOR_SETS.push(...CATALOG_SETS);
export const SET_BY_ID: Record<string, ArmorSet> = Object.fromEntries(ARMOR_SETS.map((s) => [s.id, s]));
export const armorId = (set: string, slot: ArmorSlot): string => `armor_${set}_${slot}`;
export function parseArmorId(id: string): { set: ArmorSet; slot: ArmorSlot } | null {
  const m = /^armor_([a-z]+)_(head|chest|legs|feet)$/.exec(id);
  const set = m && SET_BY_ID[m[1]!];
  return m && set ? { set, slot: m[2] as ArmorSlot } : null;
}

export interface WornArmor {
  head: string | null;
  chest: string | null;
  legs: string | null;
  feet: string | null;
}

const add = (a: Bonus, b: Bonus): Bonus => ({
  hp: (a.hp ?? 0) + (b.hp ?? 0),
  atk: (a.atk ?? 0) + (b.atk ?? 0),
  luck: (a.luck ?? 0) + (b.luck ?? 0),
  haste: (a.haste ?? 0) + (b.haste ?? 0),
  def: (a.def ?? 0) + (b.def ?? 0),
  phase: (a.phase ?? 0) + (b.phase ?? 0),
});

/** Total stats of what is worn, with set bonuses (2 and 4 pieces of the same set). */
export function armorTotals(worn: WornArmor): {
  bonus: Required<Bonus>;
  sets: Record<string, number>;
  look: number | null;
} {
  let sum: Bonus = {};
  const counts: Record<string, number> = {};
  for (const slot of ARMOR_SLOTS) {
    const p = worn[slot] ? parseArmorId(worn[slot]!) : null;
    if (!p) continue;
    sum = add(sum, p.set.piece);
    counts[p.set.id] = (counts[p.set.id] ?? 0) + 1;
  }
  let look: number | null = null,
    best = 0;
  for (const [id, n] of Object.entries(counts)) {
    const s = SET_BY_ID[id]!;
    if (n >= 2) sum = add(sum, s.two);
    if (n >= 4) sum = add(sum, s.four);
    if (n >= 3 && n > best && s.look >= 0) {
      best = n;
      look = s.look;
    }
  }
  const b = add(sum, {}) as Required<Bonus>;
  b.def = Math.min(0.6, b.def);
  b.phase = Math.min(0.3, b.phase);
  return { bonus: b, sets: counts, look };
}

// ───────────────────────── weapons ─────────────────────────

export type WeaponClass = 'blade' | 'crossbow' | 'staff';
export type BaseWeaponId =
  | 'sword'
  | 'spear'
  | 'battle_axe'
  | 'warhammer'
  | 'dagger'
  | 'greatsword'
  | 'crossbow'
  | 'ember_staff'
  | 'rime_staff'
  | 'verdant_staff'
  | 'radiant_staff'
  | 'morph_staff';
/** A base weapon or a catalog variant (a metal-tier spear, a heavier hammer...). */
export type WeaponId = string;

/** One attack of a weapon, expressed with the same fields the ability engine understands. */
export interface WeaponShot {
  name: string;
  /** element (ELEMENTS id); -1 physical */
  hue: number;
  kind: 'bolt' | 'ring' | 'heal_pulse';
  dmg: number;
  count?: number;
  spread?: number;
  range?: number;
  speed?: number;
  radius?: number;
  slow?: number;
  secs?: number;
  push?: number;
  heal?: number;
  /** bolt hits this many enemies in a line */
  pierce?: number;
}

export interface WeaponDef {
  id: WeaponId;
  /** catalog variants: the base weapon whose moves, held look and combo they borrow */
  fam?: BaseWeaponId;
  /** held-sprite and icon tint [metal, accent] palette indexes (variants) */
  tint?: [number, number];
  name: string;
  cls: WeaponClass;
  hue: number;
  level: number;
  /** seconds between shots (on top of the sim's swing cadence) */
  cd: number;
  /** tap / hold-and-release attacks */
  basic: WeaponShot | null;
  charged: WeaponShot | null;
  bonus: Bonus;
  blurb: string;
  /** what makes it quantum */
  quantum: string;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  spear: {
    id: 'spear',
    name: 'Iron Spear',
    cls: 'blade',
    hue: -1,
    level: 3,
    cd: 0,
    basic: null,
    charged: null,
    bonus: {},
    blurb: 'Long, narrow thrusts. Keep foes in front of you; charge for a reaching drive.',
    quantum: 'Your Phase Slip counter still guarantees a critical hit.',
  },
  battle_axe: {
    id: 'battle_axe',
    name: 'Broadhead Battle Axe',
    cls: 'blade',
    hue: -1,
    level: 6,
    cd: 0,
    basic: null,
    charged: null,
    bonus: {},
    blurb: 'Wide sweeps catch groups, with less reach and slower recovery than a sword.',
    quantum: 'Your physical cleaves leave room for Circuit abilities between swings.',
  },
  warhammer: {
    id: 'warhammer',
    name: 'Iron Warhammer',
    cls: 'blade',
    hue: -1,
    level: 10,
    cd: 0,
    basic: null,
    charged: null,
    bonus: {},
    blurb: 'Short, deliberate blows. The finisher bypasses light-hit armour; a full heavy crushes 60 poise.',
    quantum: 'Phase Slip counters turn patient positioning into a guaranteed critical smash.',
  },
  dagger: {
    id: 'dagger',
    name: 'Twin Daggers',
    cls: 'blade',
    hue: -1,
    level: 4,
    cd: 0,
    basic: null,
    charged: null,
    bonus: { haste: 1 },
    blurb: 'Quick, short cuts that keep a foe off balance; charge for a darting stab that closes the gap.',
    quantum: 'Phase Slip counters land before the foe has finished turning.',
  },
  greatsword: {
    id: 'greatsword',
    name: 'Iron Greatsword',
    cls: 'blade',
    hue: -1,
    level: 12,
    cd: 0,
    basic: null,
    charged: null,
    bonus: {},
    blurb: 'Long, wide two-handed strokes; a full charge spins a sweep that clears everything around you.',
    quantum: 'The blade is heavy in this world and light in the next.',
  },
  sword: {
    id: 'sword',
    name: 'Sword',
    cls: 'blade',
    hue: -1,
    level: 1,
    cd: 0,
    basic: null,
    charged: null,
    bonus: {},
    blurb: 'A three-hit combo and a charged heavy strike.',
    quantum: 'Hold to charge: the longer, the heavier.',
  },
  crossbow: {
    id: 'crossbow',
    name: 'Crossbow',
    cls: 'crossbow',
    hue: -1,
    level: 5,
    cd: 0.55,
    basic: { name: 'Bolt', hue: -1, kind: 'bolt', dmg: 16, range: 12, speed: 20 },
    charged: {
      name: 'Superposed Volley',
      hue: -1,
      kind: 'bolt',
      dmg: 24,
      count: 3,
      spread: 7,
      range: 13,
      speed: 22,
      pierce: 2,
    },
    bonus: {},
    blurb: 'Long reach, fast bolts. Hold to charge a volley.',
    quantum: 'The volley fires along three possible paths at once; all three are real.',
  },
  ember_staff: {
    id: 'ember_staff',
    name: 'Ember Staff',
    cls: 'staff',
    hue: 0,
    level: 8,
    cd: 0.6,
    basic: { name: 'Ember bolt', hue: 0, kind: 'bolt', dmg: 14, range: 10, speed: 13 },
    charged: { name: 'Flare', hue: 0, kind: 'ring', dmg: 26, radius: 2.6, push: 4 },
    bonus: { atk: 2 },
    blurb: 'Burning bolts. Hold to release a flare around you.',
    quantum: 'Ember bias: your Circuit abilities lean toward Ember forms.',
  },
  rime_staff: {
    id: 'rime_staff',
    name: 'Rime Staff',
    cls: 'staff',
    hue: 4,
    level: 8,
    cd: 0.6,
    basic: { name: 'Frost bolt', hue: 4, kind: 'bolt', dmg: 11, range: 10, speed: 13, slow: 0.4, secs: 2 },
    charged: { name: 'Frost Nova', hue: 4, kind: 'ring', dmg: 18, radius: 3.2, slow: 0.55, secs: 3, push: 2 },
    bonus: { hp: 8 },
    blurb: 'Slowing bolts. Hold for a freezing nova.',
    quantum: 'Frost bias: your Circuit abilities lean toward Frost forms.',
  },
  verdant_staff: {
    id: 'verdant_staff',
    name: 'Verdant Staff',
    cls: 'staff',
    hue: 3,
    level: 10,
    cd: 0.65,
    basic: { name: 'Thorn dart', hue: 3, kind: 'bolt', dmg: 12, range: 10, speed: 14 },
    charged: { name: 'Bloom', hue: 3, kind: 'heal_pulse', dmg: 0, heal: 28, radius: 6 },
    bonus: { hp: 12 },
    blurb: 'Leeching darts. Hold to bloom: heals you and friends nearby.',
    quantum: 'Verdant bias: your Circuit abilities lean toward Verdant forms.',
  },
  radiant_staff: {
    id: 'radiant_staff',
    name: 'Radiant Staff',
    cls: 'staff',
    hue: 2,
    level: 12,
    cd: 0.6,
    basic: { name: 'Light bolt', hue: 2, kind: 'bolt', dmg: 13, range: 10, speed: 15, push: 3 },
    charged: { name: 'Sanctify', hue: 2, kind: 'ring', dmg: 20, radius: 3, push: 5, heal: 24 },
    bonus: { def: 0.03 },
    blurb: 'Knocking light. Hold to sanctify: burns foes and mends allies at once.',
    quantum: 'Radiant bias: your Circuit abilities lean toward Radiant forms.',
  },
  morph_staff: {
    id: 'morph_staff',
    name: 'Shapeshifter Staff',
    cls: 'staff',
    hue: 6,
    level: 16,
    cd: 0,
    basic: null,
    charged: { name: 'Collapse', hue: 6, kind: 'ring', dmg: 30, radius: 2.8, push: 6 },
    bonus: { hp: 16, atk: 3 },
    blurb: "Your strikes become a wolf's fangs or a bear's fist, whichever the dice collapse to.",
    quantum: 'Each strike is a coin flip between Wolf (light) and Bear (crushing). Hold to Collapse both at once.',
  },
};
for (const w of buildVariantWeapons(WEAPONS)) WEAPONS[w.id] = w;
export const isWeaponId = (v: unknown): v is WeaponId => typeof v === 'string' && Object.hasOwn(WEAPONS, v);
/** A sloop's guns: the attack button fires cannonballs, held and released a chain-shot broadside. Hue 5 = ember. */
export const CANNON = {
  cd: 1.1,
  basic: { name: 'Cannonball', hue: 5, kind: 'bolt', dmg: 34, range: 16, speed: 15, radius: 0.35 } as WeaponShot,
  charged: {
    name: 'Broadside',
    hue: 5,
    kind: 'bolt',
    dmg: 30,
    count: 3,
    spread: 14,
    range: 15,
    speed: 15,
    radius: 0.35,
  } as WeaponShot,
};
/** Strike modifiers of the Shapeshifter's two forms (melee). */
export const MORPH_FORMS = [
  { name: 'Wolf', dmg: 0.8, knockback: 0.7, recovery: 0.75 },
  { name: 'Bear', dmg: 1.9, knockback: 1.8, recovery: 1.35 },
] as const;

/** Weapons that shoot (no melee lunge): the crossbow and every staff with a basic attack. */
export const isRangedWeapon = (w: WeaponDef | null | undefined): boolean =>
  !!w && (w.cls === 'crossbow' || (w.cls === 'staff' && !!w.basic));

/** Weapon output and its additional shot gate; swing recovery is governed separately by the shared simulation. */
export const weaponShotPower = (charge: number | null, attack: number): number =>
  (charge === null ? 1 : 0.7 + 0.5 * charge) * (1 + attack * 0.02);
export const weaponRecovery = (w: WeaponDef, heavy: boolean, haste: number): number =>
  (w.cd * (heavy ? 1.4 : 1)) / (1 + haste * 0.05);
