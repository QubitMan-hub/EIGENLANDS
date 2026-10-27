import { C } from '../palette';
import type { BaseWeaponId, WeaponDef } from '../equipment';

/**
 * Weapon variants: the same hands-on moves as a base weapon (spear thrusts, axe sweeps, hammer blows, crossbow bolts),
 * made of a better metal. `fam` points at the base weapon whose combo, held look and charge they borrow. The metal
 * decides level, attack and any special; nothing here changes how the weapon plays, so a hundred variants stay readable.
 */
export interface Tier {
  metal: string;
  name: string;
  level: number;
  atk: number;
  /** extra bonus on top of attack */
  extra?: WeaponDef['bonus'];
  colors: [number, number];
}

export const WEAPON_TIERS: Tier[] = [
  { metal: 'bronze', name: 'Bronze', level: 3, atk: 1, colors: [C.e3, C.e5] },
  { metal: 'steel', name: 'Steel', level: 10, atk: 4, colors: [C.slate, C.pale] },
  { metal: 'skysteel', name: 'Skysteel', level: 12, atk: 5, extra: { haste: 1 }, colors: [C.w5, C.e7] },
  { metal: 'deepsteel', name: 'Deepsteel', level: 14, atk: 6, extra: { hp: 6 }, colors: [C.slate, C.e4] },
  { metal: 'moonsilver', name: 'Moonsilver', level: 15, atk: 5, extra: { luck: 1 }, colors: [C.q5, C.white] },
  { metal: 'tidesilver', name: 'Tidesilver', level: 16, atk: 5, extra: { luck: 1, hp: 4 }, colors: [C.w3, C.w7] },
  { metal: 'stormiron', name: 'Stormiron', level: 17, atk: 7, extra: { haste: 1 }, colors: [C.w6, C.e6] },
  { metal: 'hellsteel', name: 'Hellsteel', level: 20, atk: 9, colors: [C.r3, C.r6] },
  { metal: 'mithril', name: 'Mithril', level: 19, atk: 8, extra: { haste: 2 }, colors: [C.w4, C.white] },
  { metal: 'adamant', name: 'Adamant', level: 25, atk: 12, extra: { def: 0.02 }, colors: [C.g2, C.g5] },
  { metal: 'voidsteel', name: 'Voidsteel', level: 32, atk: 17, extra: { luck: 2 }, colors: [C.q2, C.q6] },
];

interface FamilyForm {
  base: BaseWeaponId;
  /** the name a variant goes by, "<Metal> <noun>" */
  noun: string;
  /** adds to a tier's attack: heavier weapons hit harder per swing but recover slower */
  mult: number;
  blurb: string;
  /** tiers it is offered in (metal ids) */
  from: string[];
}

const ALL = WEAPON_TIERS.map((t) => t.metal);
export const FAMILIES: FamilyForm[] = [
  { base: 'sword', noun: 'Sword', mult: 0.9, blurb: 'A balanced three-hit combo with a lunging finisher.', from: ALL },
  { base: 'spear', noun: 'Spear', mult: 1, blurb: 'Reaching thrusts.', from: ALL.filter((m) => m !== 'hellsteel') },
  { base: 'battle_axe', noun: 'Battle Axe', mult: 1.15, blurb: 'Wide sweeping cleaves.', from: ALL },
  {
    base: 'warhammer',
    noun: 'Warhammer',
    mult: 1.3,
    blurb: 'Slow, crushing blows.',
    from: ALL.filter((m) => m !== 'bronze'),
  },
  { base: 'dagger', noun: 'Daggers', mult: 0.75, blurb: 'Quick twin cuts and a darting stab.', from: ALL },
  {
    base: 'greatsword',
    noun: 'Greatsword',
    mult: 1.25,
    blurb: 'Long two-handed sweeps.',
    from: ALL.filter((m) => m !== 'bronze'),
  },
  {
    base: 'crossbow',
    noun: 'Crossbow',
    mult: 1,
    blurb: 'Fast bolts at long range.',
    from: ['bronze', 'steel', 'skysteel', 'stormiron', 'mithril', 'adamant', 'voidsteel'],
  },
];

/** One-of-a-kind weapons: each borrows a base weapon's moves and adds a signature bonus. Recipes are in legendary.ts. */
export interface LegendaryWeapon {
  id: string;
  name: string;
  fam: BaseWeaponId;
  level: number;
  bonus: WeaponDef['bonus'];
  tint: [number, number];
  blurb: string;
  quantum: string;
}
export const LEGENDARY_WEAPONS: LegendaryWeapon[] = [
  {
    id: 'stormpiercer',
    name: 'Stormpiercer',
    fam: 'spear',
    level: 26,
    bonus: { atk: 14, haste: 2, luck: 1 },
    tint: [C.e7, C.w6],
    blurb: 'A spear that sings before a storm. Its thrusts arrive a heartbeat early.',
    quantum: 'It strikes where lightning will be.',
  },
  {
    id: 'emberfall',
    name: 'Emberfall',
    fam: 'battle_axe',
    level: 28,
    bonus: { atk: 16, hp: 24 },
    tint: [C.r5, C.e7],
    blurb: 'A broad axe quenched in dragon fire. Its edge never quite cools.',
    quantum: 'Every cleave leaves a little heat behind.',
  },
  {
    id: 'titans_maul',
    name: 'Titan’s Maul',
    fam: 'warhammer',
    level: 30,
    bonus: { atk: 20, def: 0.04, hp: 20 },
    tint: [C.g3, C.mist],
    blurb: 'A hammer of geode and adamant that makes mountains uneasy.',
    quantum: 'It is heavier than it is.',
  },
  {
    id: 'voidreaver',
    name: 'Voidreaver',
    fam: 'crossbow',
    level: 32,
    bonus: { atk: 12, luck: 2, phase: 0.04 },
    tint: [C.q3, C.q6],
    blurb: 'A crossbow drawn from a collapsed wavefunction. Its bolts may arrive before they leave.',
    quantum: 'Each bolt is already everywhere on its path.',
  },
];

export const weaponVariantId = (base: string, metal: string): string => `${base}_${metal}`;

/** The weapon definitions the catalog adds (read by equipment.ts, which owns WEAPONS). */
export function buildVariantWeapons(base: Record<string, WeaponDef>): WeaponDef[] {
  const out: WeaponDef[] = [];
  for (const f of FAMILIES) {
    const b = base[f.base]!;
    for (const t of WEAPON_TIERS) {
      if (!f.from.includes(t.metal)) continue;
      const atk = Math.round(t.atk * f.mult);
      const scale = b.cls === 'crossbow' ? 1 + t.atk * 0.045 : 1;
      out.push({
        ...b,
        id: weaponVariantId(f.base, t.metal),
        fam: f.base,
        tint: t.colors,
        name: `${t.name} ${f.noun}`,
        level: Math.max(b.level, t.level + (f.base === 'warhammer' ? 1 : 0)),
        basic: b.basic ? { ...b.basic, dmg: Math.round(b.basic.dmg * scale) } : null,
        charged: b.charged ? { ...b.charged, dmg: Math.round(b.charged.dmg * scale) } : null,
        bonus: { ...t.extra, atk: (t.extra?.atk ?? 0) + (b.cls === 'crossbow' ? Math.round(atk * 0.5) : atk) },
        blurb: `${f.blurb} Made of ${t.name.toLowerCase()}.`,
        quantum: b.quantum,
      });
    }
  }
  for (const l of LEGENDARY_WEAPONS) {
    const b = base[l.fam]!;
    const scale = b.cls === 'crossbow' ? 1.6 : 1;
    out.push({
      ...b,
      id: l.id,
      fam: l.fam,
      tint: l.tint,
      name: l.name,
      level: l.level,
      basic: b.basic ? { ...b.basic, dmg: Math.round(b.basic.dmg * scale) } : null,
      charged: b.charged ? { ...b.charged, dmg: Math.round(b.charged.dmg * scale) } : null,
      bonus: l.bonus,
      blurb: l.blurb,
      quantum: l.quantum,
    });
  }
  return out;
}
