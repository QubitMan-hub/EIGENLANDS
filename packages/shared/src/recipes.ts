import { BUILD_PIECES } from './construction';
import { ITEMS } from './items';
import { ARMOR_SLOTS, armorId } from './equipment';
import { catalogRecipes } from './catalog';
import { STATION_BY_ID, discLevel, type DiscXp, type Discipline, type ItemCat, type StationId } from './crafting';
import { repTier } from './kingdoms';

export interface Recipe {
  id: string;
  station: StationId;
  inputs: Array<{ id: string; n: number }>;
  out: { id: string; n: number; p?: Record<string, unknown> };
  xp: number;
  /**
   * How it becomes known. 'start' from the beginning; 'discover' found by experimenting; 'npc:<id>' taught by an NPC at
   * 4 hearts; 'level' once the discipline reaches `lvl`; 'realm:<id>' once you stand at least Friendly with that
   * kingdom (and are level enough); 'scroll' only from a recipe scroll, a quest or a vault.
   */
  learn: 'start' | 'discover' | 'level' | 'scroll' | `npc:${string}` | `realm:${string}`;
  hint: string;
  /** discipline it trains (inferred from the station when a recipe does not name one) */
  disc: Discipline;
  /** discipline level needed to craft it */
  lvl: number;
  /** 1 = raw to part, 2 = part to component, 3 = component to finished piece (for recipe trees) */
  stage?: 1 | 2 | 3;
  /** the kingdom whose craft this is (its recipes need standing there) */
  realm?: string;
  /** UI category of the output */
  cat?: ItemCat;
  /** a tool item that must be in the pack (it is not used up) */
  tool?: string;
  /** crafted quality scales the output's stats and durability */
  quality?: boolean;
  /** the output is worn or wielded: it is made with full durability and carries `up` 0 */
  gear?: boolean;
}

/** The discipline a station defaults to. */
export const stationDisc = (s: StationId): Discipline => STATION_BY_ID[s].disc[0]!;

const R: Recipe[] = [];
function r(
  id: string,
  station: StationId,
  inputs: Array<[string, number]>,
  out: [string, number],
  xp: number,
  learn: Recipe['learn'],
  hint: string,
  p?: Record<string, unknown>,
): void {
  R.push({
    id,
    station,
    inputs: inputs.map(([i, n]) => ({ id: i, n })),
    out: { id: out[0], n: out[1], ...(p ? { p } : {}) },
    xp,
    learn,
    hint,
    disc: stationDisc(station),
    lvl: 1,
  });
}

for (const [id, piece] of Object.entries(BUILD_PIECES) as Array<
  [string, { name: string; cost: readonly (readonly [string, number])[]; station?: StationId; lvl?: number }]
>) {
  // the first pieces are free to build by hand; the catalog's materials ask for a bench and some skill
  const station: StationId = piece.station ?? 'hand';
  r(
    id,
    station,
    piece.cost.map(([id, n]) => [id, n]),
    [id, 1],
    piece.station ? 4 + (piece.lvl ?? 1) * 2 : 1,
    piece.station && (piece.lvl ?? 1) > 1 ? 'level' : 'start',
    piece.station
      ? `${piece.name}: cut, fire or saw it at the ${station === 'hand' ? 'bench' : station.replace('_', ' ')}.`
      : `Build freely: ${piece.name}. Place a floor first, then walls, roofs or stairs.`,
  );
  const made = R[R.length - 1]!;
  made.lvl = piece.lvl ?? 1;
  made.cat = 'building';
}

// Field crafting (no station)
r(
  'waterskin',
  'hand',
  [
    ['hide', 1],
    ['fiber', 2],
  ],
  ['waterskin_empty', 1],
  2,
  'start',
  'Hide stitched with fiber. Fill at a town well.',
);
r(
  'boil_water',
  'cooking_pot',
  [['waterskin_murky', 1]],
  ['waterskin_full', 1],
  1,
  'start',
  'River water boiled clean over the fire.',
);
r(
  'workbench',
  'hand',
  [
    ['wood', 10],
    ['stone', 4],
  ],
  ['workbench', 1],
  4,
  'start',
  'Wood and stone make a bench.',
);
r(
  'torch_post',
  'hand',
  [
    ['wood', 2],
    ['coal', 1],
  ],
  ['lamp', 1],
  2,
  'start',
  'Wood and a lump of coal.',
);
r('chest', 'hand', [['wood', 12]], ['chest', 1], 3, 'start', 'A box of wood.');
r('fence', 'hand', [['wood', 2]], ['fence', 4], 1, 'start', 'Wood, split up.');
r('hay', 'hand', [['fiber', 3]], ['hay', 1], 1, 'start', 'Dry fiber bundled up.');
r(
  'fertilizer',
  'hand',
  [
    ['fiber', 4],
    ['slime_gel', 1],
  ],
  ['fertilizer', 2],
  3,
  'discover',
  'Fiber and something gooey.',
);

// Workbench
r('plank', 'workbench', [['wood', 2]], ['plank', 1], 1, 'start', 'Wood, sawn.');
r(
  'furnace',
  'workbench',
  [
    ['stone', 20],
    ['coal', 2],
  ],
  ['furnace', 1],
  6,
  'start',
  'Stone and coal, lots of stone.',
);
r(
  'forge',
  'workbench',
  [
    ['iron_ingot', 4],
    ['stone', 10],
    ['coal', 4],
  ],
  ['forge', 1],
  14,
  'discover',
  'Iron, stone and coal.',
);
r(
  'cooking_pot',
  'workbench',
  [
    ['iron_ingot', 1],
    ['stone', 6],
    ['wood', 4],
  ],
  ['cooking_pot', 1],
  6,
  'start',
  'A pot needs a little iron.',
);
r(
  'sprinkler_1',
  'workbench',
  [
    ['copper_ingot', 2],
    ['iron_ingot', 1],
  ],
  ['sprinkler_1', 1],
  8,
  'discover',
  'Copper pipes and an iron valve.',
);
r(
  'sprinkler_2',
  'workbench',
  [
    ['silver_ingot', 1],
    ['iron_ingot', 2],
    ['copper_ingot', 2],
  ],
  ['sprinkler_2', 1],
  14,
  'discover',
  'A better sprinkler: silver helps.',
);
r(
  'alchemy_table',
  'workbench',
  [
    ['plank', 6],
    ['silver_ingot', 1],
    ['qubit_crystal', 1],
  ],
  ['alchemy_table', 1],
  12,
  'discover',
  'Planks, silver and a hint of crystal.',
);
r(
  'phase_lantern',
  'workbench',
  [
    ['plank', 4],
    ['iron_ingot', 2],
    ['qubit_crystal', 1],
  ],
  ['phase_lantern', 1],
  14,
  'discover',
  'Planks, iron, and a crystal that will not pick a season.',
);
r(
  'loom',
  'workbench',
  [
    ['plank', 8],
    ['fiber', 10],
  ],
  ['loom', 1],
  8,
  'start',
  'Planks and fiber.',
);
r(
  'jeweler_bench',
  'workbench',
  [
    ['plank', 6],
    ['gold_ingot', 1],
    ['silver_ingot', 1],
  ],
  ['jeweler_bench', 1],
  14,
  'discover',
  'Planks and precious metals.',
);
r(
  'carpenter_bench',
  'workbench',
  [
    ['plank', 10],
    ['iron_ingot', 1],
  ],
  ['carpenter_bench', 1],
  8,
  'start',
  'Planks and an iron vice.',
);
r(
  'axe_1',
  'workbench',
  [
    ['wood', 5],
    ['stone', 5],
  ],
  ['axe', 1],
  3,
  'start',
  'Stone-headed axe.',
  { tier: 1 },
);
r(
  'pickaxe_1',
  'workbench',
  [
    ['wood', 5],
    ['stone', 8],
  ],
  ['pickaxe', 1],
  3,
  'start',
  'Stone-headed pick.',
  { tier: 1 },
);
r(
  'hoe_1',
  'workbench',
  [
    ['wood', 4],
    ['stone', 4],
  ],
  ['hoe', 1],
  3,
  'start',
  'A stone hoe.',
  { tier: 1 },
);
r(
  'can_1',
  'workbench',
  [
    ['wood', 4],
    ['stone', 4],
    ['fiber', 2],
  ],
  ['can', 1],
  3,
  'start',
  'A hollowed stone and wood vessel.',
  { tier: 1 },
);
r(
  'rod_1',
  'workbench',
  [
    ['wood', 6],
    ['fiber', 6],
  ],
  ['rod', 1],
  3,
  'start',
  'A stick and string.',
  { tier: 1 },
);
r(
  'net_1',
  'workbench',
  [
    ['wood', 4],
    ['fiber', 8],
  ],
  ['net', 1],
  3,
  'start',
  'A hoop and netting.',
  { tier: 1 },
);

// Furnace: ore + coal -> ingot (2 ore per ingot)
r(
  'copper_ingot',
  'furnace',
  [
    ['copper_ore', 2],
    ['coal', 1],
  ],
  ['copper_ingot', 1],
  4,
  'start',
  'Ore and coal.',
);
r(
  'iron_ingot',
  'furnace',
  [
    ['iron_ore', 2],
    ['coal', 1],
  ],
  ['iron_ingot', 1],
  6,
  'start',
  'Ore and coal.',
);
r(
  'silver_ingot',
  'furnace',
  [
    ['silver_ore', 2],
    ['coal', 2],
  ],
  ['silver_ingot', 1],
  9,
  'start',
  'Ore and coal.',
);
r(
  'gold_ingot',
  'furnace',
  [
    ['gold_ore', 2],
    ['coal', 2],
  ],
  ['gold_ingot', 1],
  12,
  'start',
  'Ore and coal.',
);

// Cooking pot
r(
  'roast_potato',
  'cooking_pot',
  [
    ['potato', 1],
    ['wood', 1],
  ],
  ['roast_potato', 1],
  3,
  'start',
  'Potato over a small fire.',
);
r(
  'baked_yam',
  'cooking_pot',
  [
    ['yam', 1],
    ['wood', 1],
  ],
  ['baked_yam', 1],
  3,
  'discover',
  'Like a potato, but sweeter.',
);
// ── kingdom cuisine (world revision 5)
const KING_DISH: Array<[string, Array<[string, number]>, number, string]> = [
  [
    'knights_pie',
    [
      ['potato', 1],
      ['grilled_meat', 1],
      ['egg', 1],
    ],
    9,
    'Meat, potato and egg in a crust.',
  ],
  [
    'honey_cake',
    [
      ['milk', 1],
      ['egg', 1],
      ['blueberry', 2],
    ],
    8,
    'Milk, egg and sweet berries.',
  ],
  [
    'glowcap_broth',
    [
      ['mushroom', 2],
      ['healing_herb', 1],
    ],
    8,
    'Mushrooms and herbs, slowly simmered.',
  ],
  [
    'hazel_loaf',
    [
      ['hazelnut', 3],
      ['egg', 1],
    ],
    7,
    'Ground hazelnuts, baked.',
  ],
  [
    'forge_stew',
    [
      ['coal', 1],
      ['raw_meat', 1],
      ['potato', 1],
    ],
    9,
    'Cooked over coals until it glows.',
  ],
  [
    'cave_bread',
    [
      ['milk', 1],
      ['hay', 1],
      ['mushroom', 1],
    ],
    6,
    'Dense bread and sharp cheese.',
  ],
  [
    'cherry_mochi',
    [
      ['blackberry', 2],
      ['milk', 1],
    ],
    7,
    'Soft rice-cake with fruit.',
  ],
  [
    'thunder_noodles',
    [
      ['egg', 1],
      ['wild_leek', 1],
      ['fish_fry', 1],
    ],
    10,
    'Noodles in a smoky broth.',
  ],
  [
    'reef_ceviche',
    [
      ['sailfin', 1],
      ['tomato', 1],
    ],
    9,
    'Raw fish cured in citrus and salt.',
  ],
  [
    'crab_chowder',
    [
      ['perch', 1],
      ['milk', 1],
      ['potato', 1],
    ],
    9,
    'Rich seafood chowder.',
  ],
  [
    'ember_stew',
    [
      ['raw_meat', 1],
      ['tomato', 1],
      ['coal', 1],
    ],
    10,
    'Fiercely spiced stew.',
  ],
  [
    'cinder_cake',
    [
      ['egg', 1],
      ['milk', 1],
      ['coal', 1],
    ],
    8,
    'A dark, dense, smoky cake.',
  ],
];
for (const [id, ing, xp, hint] of KING_DISH) r(id, 'cooking_pot', ing, [id, 1], xp, 'discover', hint);

r(
  'veggie_stew',
  'cooking_pot',
  [
    ['turnip', 1],
    ['potato', 1],
    ['wild_leek', 1],
  ],
  ['veggie_stew', 1],
  5,
  'discover',
  'Roots and greens.',
);
r('berry_jam', 'cooking_pot', [['blackberry', 3]], ['berry_jam', 1], 4, 'discover', 'Berries, boiled down.');
r(
  'fruit_pie',
  'cooking_pot',
  [
    ['strawberry', 2],
    ['egg', 1],
    ['milk', 1],
  ],
  ['fruit_pie', 1],
  8,
  'npc:maribel',
  'Maribel makes it with eggs and milk.',
);
r(
  'fish_fry',
  'cooking_pot',
  [
    ['perch', 1],
    ['wood', 1],
  ],
  ['fish_fry', 1],
  4,
  'discover',
  'Any decent fish will do.',
);
r(
  'fish_fry_trout',
  'cooking_pot',
  [
    ['trout', 1],
    ['wood', 1],
  ],
  ['fish_fry', 1],
  4,
  'discover',
  'Trout fries up well too.',
);
r(
  'grilled_meat',
  'cooking_pot',
  [
    ['raw_meat', 1],
    ['wood', 1],
  ],
  ['grilled_meat', 1],
  5,
  'discover',
  'Meat, fire.',
);
r(
  'pumpkin_soup',
  'cooking_pot',
  [
    ['pumpkin', 1],
    ['milk', 1],
  ],
  ['pumpkin_soup', 1],
  7,
  'discover',
  'Pumpkin and cream.',
);
r(
  'omelet',
  'cooking_pot',
  [
    ['egg', 2],
    ['wild_leek', 1],
  ],
  ['omelet', 1],
  4,
  'discover',
  'Eggs and a green.',
);
r(
  'hearty_stew',
  'cooking_pot',
  [
    ['raw_meat', 1],
    ['potato', 1],
    ['mushroom', 1],
  ],
  ['hearty_stew', 1],
  9,
  'npc:maribel',
  'A meal for a long journey.',
);
r(
  'qubit_tea',
  'cooking_pot',
  [
    ['qubit_crystal', 1],
    ['healing_herb', 2],
  ],
  ['qubit_tea', 1],
  12,
  'discover',
  'A crystal steeped with herbs.',
);

// Alchemy
r(
  'healing_potion',
  'alchemy',
  [
    ['healing_herb', 3],
    ['slime_gel', 1],
  ],
  ['healing_potion', 1],
  6,
  'start',
  'Herbs bound with gel.',
);
r(
  'regen_potion',
  'alchemy',
  [
    ['healing_herb', 2],
    ['daffodil', 1],
    ['slime_gel', 1],
  ],
  ['regen_potion', 1],
  8,
  'discover',
  'Herbs, a flower and gel.',
);
r(
  'might_potion',
  'alchemy',
  [
    ['hopper_tooth', 1],
    ['sunpetal', 1],
  ],
  ['might_potion', 1],
  9,
  'discover',
  'A tooth and a bright flower.',
);
r(
  'ward_potion',
  'alchemy',
  [
    ['iron_ingot', 1],
    ['healing_herb', 2],
  ],
  ['ward_potion', 1],
  9,
  'discover',
  'Iron and herbs.',
);
r(
  'bandage',
  'alchemy',
  [
    ['cloth', 1],
    ['healing_herb', 1],
  ],
  ['bandage', 2],
  4,
  'start',
  'Clean cloth and a herb poultice.',
);
r(
  'antidote',
  'alchemy',
  [
    ['healing_herb', 2],
    ['slime_gel', 1],
  ],
  ['antidote', 1],
  6,
  'start',
  'Herbs bound with gel draw out poison.',
);
r(
  'burn_salve',
  'alchemy',
  [
    ['healing_herb', 2],
    ['milk', 1],
  ],
  ['burn_salve', 1],
  6,
  'discover',
  'Herbs and milk soothe a burn.',
);
r(
  'warming_tonic',
  'alchemy',
  [
    ['sunpetal', 1],
    ['coal', 1],
    ['healing_herb', 1],
  ],
  ['warming_tonic', 1],
  8,
  'discover',
  'A bright flower, a coal and a herb: warmth in a bottle.',
);
r(
  'cooling_tonic',
  'alchemy',
  [
    ['daffodil', 1],
    ['slime_gel', 1],
    ['healing_herb', 1],
  ],
  ['cooling_tonic', 1],
  8,
  'discover',
  'A cool flower, gel and a herb.',
);
r(
  'lantern_potion',
  'alchemy',
  [
    ['firefly', 2],
    ['healing_herb', 1],
  ],
  ['lantern_potion', 1],
  7,
  'discover',
  'Captured light.',
);
r(
  'phase_tonic_a',
  'alchemy',
  [
    ['qubit_crystal', 1],
    ['fertilizer', 1],
    ['crocus', 1],
  ],
  ['phase_tonic_a', 1],
  12,
  'npc:wren',
  'Wren knows how to tilt a crop toward its first self.',
);
r(
  'phase_tonic_b',
  'alchemy',
  [
    ['qubit_crystal', 1],
    ['fertilizer', 1],
    ['sunpetal', 1],
  ],
  ['phase_tonic_b', 1],
  12,
  'npc:wren',
  'Or toward its second.',
);
r(
  'superposed_seed',
  'alchemy',
  [
    ['qubit_crystal', 1],
    ['*seed', 1],
    ['*seed', 1],
  ],
  ['superposed_seed', 1],
  14,
  'start',
  'Two different seeds and a qubit crystal. (Special: choose any two seeds.)',
);

// Loom
r('cloth', 'loom', [['fiber', 4]], ['cloth', 1], 2, 'start', 'Fiber woven.');
r(
  'outfit_red',
  'loom',
  [
    ['cloth', 4],
    ['blackberry', 1],
  ],
  ['outfit_red', 1],
  6,
  'discover',
  'Cloth and a red dye.',
);
r(
  'outfit_violet',
  'loom',
  [
    ['cloth', 4],
    ['crocus', 2],
  ],
  ['outfit_violet', 1],
  6,
  'discover',
  'Cloth and violet dye.',
);
r(
  'outfit_green',
  'loom',
  [
    ['cloth', 4],
    ['healing_herb', 2],
  ],
  ['outfit_green', 1],
  6,
  'discover',
  'Cloth and green dye.',
);
r(
  'outfit_gold',
  'loom',
  [
    ['cloth', 4],
    ['sunpetal', 2],
  ],
  ['outfit_gold', 1],
  6,
  'discover',
  'Cloth and yellow dye.',
);
r(
  'outfit_frost',
  'loom',
  [
    ['cloth', 5],
    ['snow_yam', 1],
  ],
  ['outfit_frost', 1],
  8,
  'discover',
  'Cloth and winter pigment.',
);
r(
  'outfit_crimson',
  'loom',
  [
    ['cloth', 5],
    ['hide', 1],
    ['blackberry', 1],
  ],
  ['outfit_crimson', 1],
  8,
  'discover',
  'Cloth, hide and dye.',
);
r(
  'outfit_sky',
  'loom',
  [
    ['cloth', 5],
    ['feather', 2],
  ],
  ['outfit_sky', 1],
  8,
  'npc:pippa',
  'Pippa taught me this one.',
);
r('outfit_traveler', 'loom', [['cloth', 3]], ['outfit_traveler', 1], 3, 'start', 'Plain and sturdy.');

// Jeweler
r('ring_hp', 'jeweler', [['copper_ingot', 2]], ['ring_hp', 1], 8, 'start', 'Copper, polished.', {
  stat: 'hp',
  val: 12,
});
r('ring_haste', 'jeweler', [['silver_ingot', 2]], ['ring_haste', 1], 12, 'discover', 'Silver, polished.', {
  stat: 'haste',
  val: 0.12,
});
r('ring_luck', 'jeweler', [['gold_ingot', 2]], ['ring_luck', 1], 14, 'discover', 'Gold, polished.', {
  stat: 'luck',
  val: 1,
});
r(
  'ring_atk',
  'jeweler',
  [
    ['silver_ingot', 1],
    ['qubit_crystal', 1],
  ],
  ['ring_atk', 1],
  16,
  'discover',
  'Silver set with a crystal.',
  { stat: 'atk', val: 4 },
);

// Carpenter
r('chair', 'carpenter', [['plank', 3]], ['chair', 1], 3, 'start', 'Four legs, mostly.');
r('table', 'carpenter', [['plank', 5]], ['table', 1], 4, 'start', 'Planks nailed together.');
r(
  'bed',
  'carpenter',
  [
    ['plank', 6],
    ['cloth', 3],
  ],
  ['bed', 1],
  6,
  'start',
  'Planks and cloth.',
);
r('shelf', 'carpenter', [['plank', 4]], ['shelf', 1], 3, 'start', 'For your things.');
r('rug', 'carpenter', [['cloth', 4]], ['rug', 1], 3, 'start', 'Underfoot.');
r('sign', 'carpenter', [['plank', 2]], ['sign', 1], 2, 'start', 'A post and a board.');
r(
  'coop',
  'carpenter',
  [
    ['plank', 12],
    ['hay', 4],
  ],
  ['coop', 1],
  10,
  'start',
  'Planks and hay.',
);
r(
  'barn',
  'carpenter',
  [
    ['plank', 30],
    ['hay', 10],
    ['iron_ingot', 2],
  ],
  ['barn', 1],
  20,
  'npc:fenwick',
  'Fenwick can show you how to raise a barn.',
);

// Armor and Foci (see equipment.ts). Armor is made at the workbench (silk at the loom); staves and the crossbow at the carpenter's.
const ARMOR_COSTS: Record<string, Record<string, Array<[string, number]>>> = {
  leather: {
    head: [['hide', 3]],
    chest: [
      ['hide', 6],
      ['fiber', 4],
    ],
    legs: [['hide', 5]],
    feet: [
      ['hide', 3],
      ['fiber', 2],
    ],
  },
  hunter: {
    head: [
      ['hide', 3],
      ['wolf_fang', 1],
    ],
    chest: [
      ['hide', 6],
      ['wolf_fang', 2],
      ['boar_tusk', 1],
    ],
    legs: [
      ['hide', 5],
      ['wolf_fang', 1],
    ],
    feet: [
      ['hide', 3],
      ['boar_tusk', 1],
    ],
  },
  iron: {
    head: [['iron_ingot', 4]],
    chest: [
      ['iron_ingot', 8],
      ['hide', 2],
    ],
    legs: [['iron_ingot', 6]],
    feet: [
      ['iron_ingot', 4],
      ['hide', 1],
    ],
  },
  silk: {
    head: [
      ['cloth', 4],
      ['silver_ingot', 1],
    ],
    chest: [
      ['cloth', 8],
      ['silver_ingot', 1],
      ['qubit_crystal', 1],
    ],
    legs: [
      ['cloth', 6],
      ['silver_ingot', 1],
    ],
    feet: [
      ['cloth', 4],
      ['feather', 2],
    ],
  },
  voidglass: {
    head: [
      ['qubit_crystal', 3],
      ['iron_ingot', 2],
    ],
    chest: [
      ['qubit_crystal', 6],
      ['iron_ingot', 4],
    ],
    legs: [
      ['qubit_crystal', 4],
      ['iron_ingot', 3],
    ],
    feet: [
      ['qubit_crystal', 3],
      ['iron_ingot', 2],
    ],
  },
};
for (const [set, slots] of Object.entries(ARMOR_COSTS)) {
  for (const slot of ARMOR_SLOTS) {
    r(
      armorId(set, slot),
      set === 'silk' ? 'loom' : 'workbench',
      slots[slot]!,
      [armorId(set, slot), 1],
      6 + ARMOR_SLOTS.indexOf(slot),
      set === 'leather' ? 'start' : 'discover',
      `Made from ${slots[slot]!.map(([i, n]) => `${n} ${i.replace('_', ' ')}`).join(', ')}.`,
    );
  }
}
r(
  'spear',
  'forge',
  [
    ['iron_ingot', 2],
    ['wood', 4],
    ['fiber', 2],
  ],
  ['spear', 1],
  12,
  'start',
  'Iron head, ash shaft and tight bindings. Level 3 to wield.',
);
r(
  'battle_axe',
  'forge',
  [
    ['iron_ingot', 4],
    ['plank', 2],
    ['hide', 2],
  ],
  ['battle_axe', 1],
  18,
  'start',
  'A broad iron bit and leather-wrapped haft. Level 6 to wield.',
);
r(
  'warhammer',
  'forge',
  [
    ['iron_ingot', 7],
    ['heartwood', 2],
    ['coal', 3],
  ],
  ['warhammer', 1],
  24,
  'start',
  'A tempered iron head on resilient heartwood. Level 10 to wield.',
);
r(
  'dagger',
  'forge',
  [
    ['iron_ingot', 2],
    ['hide', 2],
  ],
  ['dagger', 1],
  10,
  'start',
  'Two short iron blades with wrapped grips. Level 4 to wield.',
);
r(
  'greatsword',
  'forge',
  [
    ['iron_ingot', 8],
    ['plank', 1],
    ['hide', 2],
  ],
  ['greatsword', 1],
  26,
  'start',
  'A long two-handed blade, folded and tempered. Level 12 to wield.',
);
r(
  'crossbow',
  'carpenter',
  [
    ['plank', 6],
    ['iron_ingot', 2],
    ['fiber', 6],
  ],
  ['crossbow', 1],
  12,
  'start',
  'Planks, an iron stirrup and plenty of string.',
);
r(
  'ember_staff',
  'carpenter',
  [
    ['wood', 4],
    ['copper_ingot', 3],
    ['qubit_crystal', 1],
  ],
  ['ember_staff', 1],
  14,
  'discover',
  'Copper holds a crystal that remembers fire.',
);
r(
  'rime_staff',
  'carpenter',
  [
    ['wood', 4],
    ['silver_ingot', 2],
    ['slime_gel', 6],
    ['qubit_crystal', 1],
  ],
  ['rime_staff', 1],
  14,
  'discover',
  'Silver, gel and a crystal that remembers winter.',
);
r(
  'verdant_staff',
  'carpenter',
  [
    ['heartwood', 3],
    ['fiber', 6],
    ['qubit_crystal', 1],
  ],
  ['verdant_staff', 1],
  14,
  'discover',
  'Green heartwood wrapped around a crystal.',
);
r(
  'radiant_staff',
  'carpenter',
  [
    ['wood', 3],
    ['gold_ingot', 2],
    ['qubit_crystal', 1],
  ],
  ['radiant_staff', 1],
  16,
  'discover',
  "Gold catches the crystal's light.",
);
r(
  'morph_staff',
  'carpenter',
  [
    ['heartwood', 2],
    ['wolf_fang', 2],
    ['boar_tusk', 2],
    ['qubit_crystal', 2],
  ],
  ['morph_staff', 1],
  20,
  'discover',
  'Fang, tusk and crystal: two animals, one staff.',
);

// Adventure: Heart Crystals and boss summons (each boss drops the key to the next)
r(
  'sloop',
  'workbench',
  [
    ['plank', 24],
    ['cloth', 8],
    ['iron_ingot', 2],
  ],
  ['sloop', 1],
  26,
  'start',
  'Planks, sailcloth and iron fittings: a hull that rides the swell.',
);
r(
  'recall_shard',
  'workbench',
  [
    ['stone', 4],
    ['qubit_crystal', 1],
  ],
  ['recall_shard', 2],
  14,
  'discover',
  'Chip a waystone splinter around a crystal heart. Learned by attuning three waystones.',
);
r(
  'griffin_whistle',
  'jeweler',
  [
    ['griffin_plume', 3],
    ['gold_ingot', 2],
    ['hide', 6],
  ],
  ['griffin_whistle', 1],
  40,
  'discover',
  'Three plumes from a Gilded Griffin, a gold-bound whistle and a light saddle. Learned at Wayfarer rank 3.',
);
r('heart_crystal', 'hand', [['shrine_shard', 4]], ['heart_crystal', 1], 20, 'start', 'Four solved shrines, fused.');
r(
  'slime_crown',
  'workbench',
  [
    ['slime_gel', 20],
    ['gold_ingot', 2],
    ['qubit_crystal', 1],
  ],
  ['slime_crown', 1],
  18,
  'discover',
  'Gel, gold and a crystal: a crown for something large.',
);
r(
  'warden_horn',
  'workbench',
  [
    ['slime_core', 1],
    ['boar_tusk', 3],
    ['wolf_fang', 3],
  ],
  ['warden_horn', 1],
  24,
  'discover',
  'Carved from tusk and fang, tuned by a slime core.',
);
r(
  'colossus_core',
  'workbench',
  [
    ['warden_heart', 1],
    ['qubit_crystal', 6],
    ['iron_ingot', 4],
  ],
  ['colossus_core', 1],
  30,
  'discover',
  "A warden's heart wrapped in crystal and iron.",
);

export const RECIPES: ReadonlyArray<Recipe> = R;

/** Can the player afford this recipe from `count`? (Wildcard recipes are handled by the experiment path.) */
export const canCraft = (rec: Recipe, count: (id: string) => number, times = 1): boolean =>
  !rec.inputs.some((i) => i.id.startsWith('*')) && rec.inputs.every((i) => count(i.id) >= i.n * times);

r(
  'deep_sigil',
  'workbench',
  [
    ['iron_ingot', 4],
    ['qubit_crystal', 2],
    ['coal', 8],
  ],
  ['deep_sigil', 1],
  20,
  'discover',
  'A crystal bell sealed in iron. It answers only in a surveyed cave arena.',
);

r(
  'storm_beacon',
  'workbench',
  [
    ['iron_ingot', 6],
    ['qubit_crystal', 4],
    ['wolf_fang', 3],
  ],
  ['storm_beacon', 1],
  25,
  'discover',
  'An iron cage channels a crystal storm. Use it on open surface ground at level 22.',
);
r(
  'stormglass_signet',
  'jeweler',
  [
    ['storm_heart', 1],
    ['gold_ingot', 3],
    ['qubit_crystal', 2],
  ],
  ['stormglass_signet', 1],
  32,
  'discover',
  'Bind a Storm Heart in gold.',
  { stat: 'atk', val: 7 },
);

// Catalog recipes (the data-driven content waves) join the hand-written ones above.
for (const rec of catalogRecipes()) R.push(rec);

const BY_ID = new Map<string, Recipe>(R.map((x) => [x.id, x]));
const BY_STATION = new Map<StationId, Recipe[]>();
for (const rec of R) {
  const l = BY_STATION.get(rec.station);
  if (l) l.push(rec);
  else BY_STATION.set(rec.station, [rec]);
}
/** recipes that produce an item (for the recipe tree and "how do I get this") */
const BY_OUTPUT = new Map<string, Recipe[]>();
for (const rec of R) BY_OUTPUT.set(rec.out.id, [...(BY_OUTPUT.get(rec.out.id) ?? []), rec]);
export const recipeById = (id: string): Recipe | undefined => BY_ID.get(id);
export const recipesFor = (station: StationId): Recipe[] => BY_STATION.get(station) ?? [];
export const recipesMaking = (item: string): readonly Recipe[] => BY_OUTPUT.get(item) ?? [];
/** recipes that consume an item */
const BY_INPUT = new Map<string, Recipe[]>();
for (const rec of R) for (const i of rec.inputs) BY_INPUT.set(i.id, [...(BY_INPUT.get(i.id) ?? []), rec]);
export const recipesUsing = (item: string): readonly Recipe[] => BY_INPUT.get(item) ?? [];

/** Experiment signature: sorted `id:n` of the offered multiset; wildcard recipes are matched separately. */
const sig = (list: Array<{ id: string; n: number }>) =>
  [...list]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((x) => `${x.id}:${x.n}`)
    .join('|');
const EXP = new Map<string, Recipe>();
const WILD: Recipe[] = [];
for (const rec of R) {
  if (rec.inputs.some((i) => i.id.startsWith('*'))) WILD.push(rec);
  else EXP.set(`${rec.station}#${sig(rec.inputs)}`, rec);
}

/** Does the offered multiset exactly match a recipe at this station? ('*seed' wildcards match any two distinct seeds.) */
export function matchExperiment(station: StationId, offered: Array<{ id: string; n: number }>): Recipe | null {
  const merged = new Map<string, number>();
  for (const { id, n } of offered) merged.set(id, (merged.get(id) ?? 0) + n);
  const list = [...merged].map(([id, n]) => ({ id, n }));
  const hit = EXP.get(`${station}#${sig(list)}`);
  if (hit) return hit;
  const have = merged;
  for (const rec of WILD) {
    if (rec.station !== station) continue;
    const seeds = [...have.entries()].filter(([id]) => ITEMS[id]?.kind === 'seed' && id !== 'superposed_seed');
    const others = [...have.entries()].filter(([id]) => !(ITEMS[id]?.kind === 'seed' && id !== 'superposed_seed'));
    const fixed = rec.inputs.filter((i) => !i.id.startsWith('*'));
    const wild = rec.inputs.filter((i) => i.id.startsWith('*')).reduce((a, i) => a + i.n, 0);
    const seedCount = seeds.reduce((a, [, n]) => a + n, 0);
    if (
      seeds.length === 2 &&
      seedCount === wild &&
      fixed.length === others.length &&
      fixed.every((f) => have.get(f.id) === f.n)
    )
      return rec;
  }
  return null;
}

/** What a character brings to the question "may I craft this?": learned ids, discipline XP and standing with each kingdom. */
export interface CraftProfile {
  learned: ReadonlySet<string>;
  disc: DiscXp;
  rep: Readonly<Record<string, number | undefined>>;
}
/**
 * Is a recipe known? 'start' always; 'level' once the discipline reaches its level; 'realm:<id>' once the discipline
 * reaches its level and you stand at least Friendly with that kingdom; the rest (discover, npc, scroll) only when learned.
 */
export function recipeKnown(rec: Recipe, who: CraftProfile): boolean {
  if (who.learned.has(rec.id)) return true;
  if (rec.learn === 'start') return true;
  if (rec.learn === 'level') return discLevel(who.disc[rec.disc]) >= rec.lvl;
  if (rec.learn.startsWith('realm:'))
    return discLevel(who.disc[rec.disc]) >= rec.lvl && repTier(who.rep[rec.learn.slice(6)] ?? 0) >= 1;
  return false;
}
/** Why a known recipe cannot be made yet, or null. */
export function recipeBlock(rec: Recipe, who: CraftProfile): string | null {
  const lv = discLevel(who.disc[rec.disc]);
  if (lv < rec.lvl) return `Needs ${rec.disc} level ${rec.lvl}`;
  if (rec.realm && rec.realm !== 'any' && repTier(who.rep[rec.realm] ?? 0) < 1)
    return `Needs standing with ${rec.realm}`;
  return null;
}
