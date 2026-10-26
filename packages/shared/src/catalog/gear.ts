import { ARMOR_SLOTS, armorId } from '../equipment';
import type { ArmorSlot } from '../equipment';
import type { StationId } from '../crafting';
import { CATALOG_SETS, type CatalogSet } from './armor';
import { WEAPON_TIERS, FAMILIES, weaponVariantId } from './weapons-data';
import { rec } from './kit';

/**
 * Recipes for the armour sets and weapon variants. The items themselves are generated in items.ts from the same data
 * (armour sets and weapon definitions) so the combat code and the crafting code can never disagree about what exists.
 * Gear rolls a quality (Crude..Masterwork) from the crafter's skill; better quality means better numbers.
 */

/** How many units of the main material each slot takes. */
const UNITS: Record<ArmorSlot, number> = { head: 2, chest: 4, legs: 3, feet: 2 };

interface Make {
  station: StationId;
  main: (s: CatalogSet) => string;
  extras: (s: CatalogSet, slot: ArmorSlot) => Array<[string, number]>;
  disc: 'smithing' | 'leatherworking' | 'tailoring';
}

const METAL: Make = {
  station: 'forge',
  disc: 'smithing',
  main: (s) => `${s.mat}_plate`,
  extras: (s, slot) => [
    [s.id === 'mithril' || s.id === 'moonsilver' ? 'quilting' : 'leather', slot === 'chest' ? 2 : 1],
    ...(s.id === 'bronze' ? ([['rivets', UNITS[slot]]] as Array<[string, number]>) : []),
    ...(s.id === 'voidsteel' ? ([['qubit_crystal', 1]] as Array<[string, number]>) : []),
  ],
};

const MAKERS: Record<string, Make> = {
  chain: {
    station: 'forge',
    disc: 'smithing',
    main: () => 'iron_rod',
    extras: (_s, slot) => [['quilting', slot === 'chest' ? 2 : 1]],
  },
  padded: {
    station: 'loom',
    disc: 'tailoring',
    main: () => 'wool_cloth',
    extras: (_s, slot) => [['quilting', slot === 'chest' ? 2 : 1]],
  },
  linen: { station: 'loom', disc: 'tailoring', main: () => 'linen_cloth', extras: () => [['linen_thread', 2]] },
  magister: {
    station: 'loom',
    disc: 'tailoring',
    main: () => 'silk_cloth',
    extras: (_s, slot) => [
      ['copper_wire', slot === 'chest' ? 3 : 1],
      ['dye_violet', 1],
    ],
  },
  fur: { station: 'tannery', disc: 'leatherworking', main: () => 'pelt', extras: () => [['leather_strap', 2]] },
  studded: {
    station: 'tannery',
    disc: 'leatherworking',
    main: () => 'leather',
    extras: (_s, slot) => [['rivets', UNITS[slot] * 2]],
  },
  ranger: {
    station: 'tannery',
    disc: 'leatherworking',
    main: () => 'leather',
    extras: (_s, slot) => [
      ['sinew', slot === 'chest' ? 3 : 1],
      ['dye_green', 1],
    ],
  },
  starforged: {
    station: 'forge',
    disc: 'smithing',
    main: () => 'voidsteel_plate',
    extras: (_s, slot) => [
      ['starstone', slot === 'chest' ? 2 : 1],
      ['essence_storm', 1],
      ['thick_leather', 1],
    ],
  },
  shadow: {
    station: 'tannery',
    disc: 'leatherworking',
    main: () => 'thick_leather',
    extras: (_s, slot) => [
      ['dye_black', 1],
      ...(slot === 'chest' ? ([['bat_wing', 2]] as Array<[string, number]>) : []),
    ],
  },
  scale: {
    station: 'tannery',
    disc: 'leatherworking',
    main: () => 'scale_leather',
    extras: () => [['leather_strap', 2]],
  },
  dragon: {
    station: 'tannery',
    disc: 'leatherworking',
    main: () => 'wyrm_leather',
    extras: (_s, slot) => [['dragon_bone', slot === 'chest' ? 2 : 1]],
  },
};

for (const s of CATALOG_SETS) {
  const mk = MAKERS[s.id] ?? METAL;
  for (const slot of ARMOR_SLOTS) {
    const inputs: Array<[string, number]> = [[mk.main(s), UNITS[slot]], ...mk.extras(s, slot)];
    rec(mk.station, inputs, [armorId(s.id, slot), 1], {
      lvl: s.level,
      disc: mk.disc,
      xp: 12 + s.level * 3,
      learn: s.realm ? `realm:${s.realm}` : s.id === 'starforged' ? 'scroll' : 'level',
      hint: `${s.name}: ${slot} piece.`,
      cat: 'armor',
      tool: mk.station === 'forge' ? 'tongs' : 'needle_kit',
      quality: true,
      gear: true,
      ...(s.realm ? { realm: s.realm } : {}),
    });
  }
}

// ── weapons: a metal's rod forms the shaft or blade, plates the head
const HEAD: Record<string, (m: string) => Array<[string, number]>> = {
  sword: (m) => [
    [`${m}_rod`, 3],
    [`${m}_plate`, 1],
    ['handle', 1],
  ],
  spear: (m) => [
    [`${m}_rod`, 2],
    [`${m}_plate`, 1],
    ['handle', 1],
  ],
  battle_axe: (m) => [
    [`${m}_plate`, 3],
    [`${m}_rod`, 1],
    ['handle', 1],
  ],
  warhammer: (m) => [
    [`${m}_plate`, 4],
    [`${m}_rod`, 1],
    ['handle', 1],
  ],
  crossbow: (m) => [
    [`${m}_rod`, 2],
    [`${m}_plate`, 1],
    ['bowstave', 1],
    ['sinew', 2],
  ],
};
const REALM_OF: Record<string, string> = {
  skysteel: 'aurelion',
  deepsteel: 'khardum',
  stormiron: 'raijin',
  tidesilver: 'thalassara',
  hellsteel: 'nethrakar',
  moonsilver: 'sylvaris',
};
for (const f of FAMILIES) {
  for (const t of WEAPON_TIERS) {
    if (!f.from.includes(t.metal)) continue;
    const realm = REALM_OF[t.metal];
    rec('forge', HEAD[f.base]!(t.metal), [weaponVariantId(f.base, t.metal), 1], {
      lvl: Math.max(2, t.level - 1),
      disc: 'smithing',
      xp: 14 + t.level * 3,
      learn: realm ? `realm:${realm}` : 'level',
      hint: `${t.name} ${f.noun.toLowerCase()}.`,
      cat: 'weapon',
      tool: 'tongs',
      quality: true,
      gear: true,
      ...(realm ? { realm } : {}),
    });
  }
}
