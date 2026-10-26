import { COL as C, item, rec } from './kit';
import type { EnchantDef } from './types';
import type { Rarity } from '../crafting';

/**
 * Runes and enchanting. Runes are carved at the Rune Altar from crystals and gems; an enchanting table binds one rune
 * into a piece of gear, where it adds its bonus until the piece is re-enchanted. Which gear can carry which rune, and how
 * rare the gear must be, is data.
 */
export const ENCHANTS: EnchantDef[] = [
  { key: 'flame', name: 'Flame', bonus: { atk: 4 }, minRarity: 0, on: ['weapon'], blurb: 'Strikes burn: +4 attack.' },
  { key: 'keen', name: 'Keen', bonus: { atk: 6 }, minRarity: 1, on: ['weapon'], blurb: 'A razor edge: +6 attack.' },
  {
    key: 'tempest',
    name: 'Tempest',
    bonus: { atk: 3, haste: 1.5 },
    minRarity: 2,
    on: ['weapon'],
    blurb: 'Storm-quick strokes: +3 attack, +1.5 haste.',
  },
  {
    key: 'vitality',
    name: 'Vitality',
    bonus: { hp: 22 },
    minRarity: 0,
    on: ['armor', 'gear'],
    blurb: 'Hardier flesh: +22 health.',
  },
  {
    key: 'warding',
    name: 'Warding',
    bonus: { def: 0.04 },
    minRarity: 0,
    on: ['armor', 'gear'],
    blurb: 'Turns blows: -4% damage.',
  },
  {
    key: 'frostward',
    name: 'Frostward',
    bonus: { warm: 4 },
    minRarity: 0,
    on: ['armor', 'gear'],
    blurb: 'Shrugs off cold: +4 warmth.',
  },
  {
    key: 'emberward',
    name: 'Emberward',
    bonus: { cool: 4 },
    minRarity: 0,
    on: ['armor', 'gear'],
    blurb: 'Shrugs off heat: +4 coolness.',
  },
  {
    key: 'swiftness',
    name: 'Swiftness',
    bonus: { haste: 1.5 },
    minRarity: 1,
    on: ['armor', 'gear', 'weapon'],
    blurb: 'Quick hands: +1.5 haste.',
  },
  {
    key: 'fortune',
    name: 'Fortune',
    bonus: { luck: 2 },
    minRarity: 1,
    on: ['armor', 'gear', 'weapon'],
    blurb: 'Luck follows you: +2 luck.',
  },
  {
    key: 'endurance',
    name: 'Endurance',
    bonus: { stamina: 15, drain: 0.05 },
    minRarity: 1,
    on: ['armor', 'gear'],
    blurb: 'Tireless: +15 stamina, hungrier less.',
  },
  {
    key: 'artisan',
    name: 'Artisan',
    bonus: { craft: 6 },
    minRarity: 1,
    on: ['gear'],
    blurb: '6% chance to save an ingredient.',
  },
  {
    key: 'phasing',
    name: 'Phasing',
    bonus: { phase: 0.05 },
    minRarity: 3,
    on: ['armor', 'gear'],
    blurb: '5% of hits pass straight through you.',
  },
];
export const ENCHANT_BY_KEY: Readonly<Record<string, EnchantDef>> = Object.fromEntries(ENCHANTS.map((e) => [e.key, e]));

interface Rune {
  key: string;
  inputs: Array<[string, number]>;
  lvl: number;
  a: number;
  b: number;
  rarity: Rarity;
}
const RUNES: Rune[] = [
  {
    key: 'flame',
    inputs: [
      ['ember_crystal', 1],
      ['crystal_dust', 2],
      ['flint', 1],
    ],
    lvl: 4,
    a: C.r5,
    b: C.e7,
    rarity: 1,
  },
  {
    key: 'keen',
    inputs: [
      ['garnet_cut', 1],
      ['crystal_dust', 2],
      ['steel_rod', 1],
    ],
    lvl: 8,
    a: C.r3,
    b: C.pale,
    rarity: 2,
  },
  {
    key: 'tempest',
    inputs: [
      ['storm_crystal', 1],
      ['crystal_dust', 3],
      ['sapphire_cut', 1],
    ],
    lvl: 12,
    a: C.e7,
    b: C.w6,
    rarity: 3,
  },
  {
    key: 'vitality',
    inputs: [
      ['life_crystal', 1],
      ['crystal_dust', 2],
      ['healing_herb', 3],
    ],
    lvl: 4,
    a: C.g5,
    b: C.g6,
    rarity: 1,
  },
  {
    key: 'warding',
    inputs: [
      ['onyx_cut', 1],
      ['crystal_dust', 2],
      ['salt', 2],
    ],
    lvl: 6,
    a: C.slate,
    b: C.pale,
    rarity: 1,
  },
  {
    key: 'frostward',
    inputs: [
      ['frost_crystal', 1],
      ['crystal_dust', 1],
      ['wool', 2],
    ],
    lvl: 3,
    a: C.w6,
    b: C.white,
    rarity: 1,
  },
  {
    key: 'emberward',
    inputs: [
      ['frost_lily', 1],
      ['crystal_dust', 1],
      ['mint', 2],
    ],
    lvl: 3,
    a: C.w5,
    b: C.g6,
    rarity: 1,
  },
  {
    key: 'swiftness',
    inputs: [
      ['topaz_cut', 1],
      ['crystal_dust', 2],
      ['feather', 2],
    ],
    lvl: 7,
    a: C.e7,
    b: C.w6,
    rarity: 2,
  },
  {
    key: 'fortune',
    inputs: [
      ['emerald_cut', 1],
      ['clover', 1],
      ['crystal_dust', 2],
    ],
    lvl: 9,
    a: C.g5,
    b: C.e7,
    rarity: 2,
  },
  {
    key: 'endurance',
    inputs: [
      ['amethyst_cut', 1],
      ['crystal_dust', 2],
      ['bitterroot', 2],
    ],
    lvl: 6,
    a: C.q4,
    b: C.g5,
    rarity: 1,
  },
  {
    key: 'artisan',
    inputs: [
      ['quartz_cut', 1],
      ['crystal_dust', 2],
      ['gold_wire', 1],
    ],
    lvl: 5,
    a: C.e6,
    b: C.white,
    rarity: 1,
  },
  {
    key: 'phasing',
    inputs: [
      ['moonstone_cut', 1],
      ['void_core', 1],
      ['crystal_dust', 3],
    ],
    lvl: 16,
    a: C.q5,
    b: C.white,
    rarity: 4,
  },
];
for (const r of RUNES) {
  const def = ENCHANT_BY_KEY[r.key]!;
  item(`rune_${r.key}`, `Rune of ${def.name}`, 'rune', {
    v: 80 + r.rarity * 90,
    g: 'rune',
    a: r.a,
    b: r.b,
    d: `${def.blurb} Bind it into ${def.on.includes('weapon') && def.on.length === 1 ? 'a weapon' : 'gear'} at an enchanting table.`,
    rarity: r.rarity,
    use: { t: 'rune', key: r.key },
  });
  rec('runeforge', r.inputs, [`rune_${r.key}`, 1], {
    lvl: r.lvl,
    disc: 'magic',
    xp: 14 + r.lvl * 2,
    hint: `Carve the ${def.name.toLowerCase()} rune.`,
    tool: 'chisel',
  });
}
// the warding amulet in gear-items asks for this by another name
item('rune_ward', 'Ward Rune', 'rune', {
  v: 60,
  g: 'rune',
  a: C.pale,
  b: C.slate,
  d: 'A simple protective sign, carved to engrave on metal.',
  rarity: 0,
});
rec(
  'runeforge',
  [
    ['stone', 2],
    ['crystal_dust', 1],
  ],
  ['rune_ward', 1],
  { lvl: 2, disc: 'magic', xp: 8, hint: 'Carve a ward into stone.', tool: 'chisel' },
);

// ── charged crystals and foci: energy stored for the circuit and the lantern
item('charged_crystal', 'Charged Crystal', 'magical', {
  v: 160,
  g: 'crystal',
  a: C.q6,
  b: C.white,
  d: 'A qubit crystal soaked in raw magic. Foci and artifacts are built around it.',
  rarity: 2,
});
rec(
  'runeforge',
  [
    ['qubit_crystal', 2],
    ['crystal_dust', 2],
    ['silver_wire', 1],
  ],
  ['charged_crystal', 1],
  { lvl: 8, disc: 'magic', xp: 20, hint: 'Pour magic into a crystal.' },
);
item('wand_apprentice', 'Apprentice Wand', 'weapon', {
  v: 90,
  g: 'wand',
  a: C.e5,
  b: C.q5,
  d: 'A willow wand tipped with a crystal. Keeps a little magic ready.',
  rarity: 1,
  kind: 'misc',
  stack: 1,
});
rec(
  'runeforge',
  [
    ['willow_plank', 1],
    ['quartz_cut', 1],
    ['silver_wire', 1],
  ],
  ['wand_apprentice', 1],
  { lvl: 4, disc: 'magic', xp: 12, hint: 'A willow wand set with quartz.' },
);

// ── elemental essences: gathered, then distilled at the altar into the materials of legend
interface Essence {
  id: string;
  name: string;
  from: Array<[string, number]>;
  a: number;
  b: number;
  d: string;
  lvl: number;
}
const ESS: Essence[] = [
  {
    id: 'essence_fire',
    name: 'Essence of Fire',
    from: [
      ['ember_crystal', 2],
      ['moth_dust', 2],
      ['sulfur', 1],
    ],
    a: C.r5,
    b: C.e7,
    d: 'A vial of distilled flame.',
    lvl: 9,
  },
  {
    id: 'essence_frost',
    name: 'Essence of Frost',
    from: [
      ['frost_crystal', 2],
      ['rime_essence', 2],
      ['frost_lily', 1],
    ],
    a: C.w6,
    b: C.white,
    d: 'A vial of distilled cold.',
    lvl: 9,
  },
  {
    id: 'essence_life',
    name: 'Essence of Life',
    from: [
      ['life_crystal', 2],
      ['healing_herb', 4],
      ['moonbloom', 1],
    ],
    a: C.g5,
    b: C.white,
    d: 'A vial of distilled growth.',
    lvl: 9,
  },
  {
    id: 'essence_storm',
    name: 'Essence of Storm',
    from: [
      ['storm_crystal', 2],
      ['stormcap', 2],
      ['quicksilver', 1],
    ],
    a: C.e7,
    b: C.w6,
    d: 'A vial of distilled lightning.',
    lvl: 9,
  },
];
for (const e of ESS) {
  item(e.id, e.name, 'magical', { v: 190, g: 'vial', a: e.a, b: e.b, d: e.d, rarity: 3 });
  rec('runeforge', e.from, [e.id, 1], { lvl: e.lvl, disc: 'magic', xp: 26, hint: e.d });
}
