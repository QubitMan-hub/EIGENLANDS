import { ANCIENT_RITES } from './bestiary';
/**
 * Item catalog and pure inventory operations. Shared by server (authority) and client (UI, tooltips).
 * Unique crafted items (forged weapons, rings, superposed seeds) carry per-stack `p` properties.
 */
export type ItemKind =
  | 'resource'
  | 'tool'
  | 'weapon'
  | 'seed'
  | 'crop'
  | 'forage'
  | 'fish'
  | 'bug'
  | 'food'
  | 'potion'
  | 'material'
  | 'placeable'
  | 'ring'
  | 'outfit'
  | 'animal'
  | 'fertilizer'
  | 'misc'
  | 'armor'
  | 'gear'
  | 'scroll'
  | 'rune';

/** Glyph vocabulary the art pipeline must draw (16x16 inventory icons). `a` = main, `b` = accent palette index. */
export type Glyph =
  | CatalogGlyph
  | 'log'
  | 'plank'
  | 'stone'
  | 'coal'
  | 'ore'
  | 'ingot'
  | 'gem'
  | 'seed'
  | 'sprout'
  | 'leaf'
  | 'fruit'
  | 'root'
  | 'berry'
  | 'mushroom'
  | 'flower'
  | 'fish'
  | 'bug'
  | 'meat'
  | 'hide'
  | 'feather'
  | 'egg'
  | 'bottle'
  | 'bowl'
  | 'pie'
  | 'bread'
  | 'jar'
  | 'cloth'
  | 'axe'
  | 'pickaxe'
  | 'hoe'
  | 'can'
  | 'rod'
  | 'net'
  | 'sword'
  | 'ring'
  | 'shirt'
  | 'box'
  | 'bench'
  | 'furnace'
  | 'anvil'
  | 'pot'
  | 'loom'
  | 'chair'
  | 'table'
  | 'bed'
  | 'lamp'
  | 'shelf'
  | 'rug'
  | 'sprinkler'
  | 'coop'
  | 'barn'
  | 'chicken'
  | 'cow'
  | 'sign'
  | 'fence'
  | 'gel'
  | 'tooth'
  | 'waterskin'
  | 'bag'
  | 'orb'
  | 'book'
  | 'staff'
  | 'crossbow'
  | 'spear'
  | 'battle_axe'
  | 'warhammer'
  | 'dagger'
  | 'greatsword'
  | 'helm'
  | 'cuirass'
  | 'greaves'
  | 'boots';

import { BUILD_PIECES } from './construction';
import { catalogItems } from './catalog';
import type { GearSpec, ItemUse } from './catalog/types';
import type { CatalogGlyph } from './catalog/glyphs';
import type { ItemCat, Rarity } from './crafting';
import {
  ARMOR_SETS,
  ARMOR_SLOTS,
  ARMOR_SLOT_NAMES,
  SET_BY_ID,
  WEAPONS,
  armorId,
  type ArmorSlot,
  type WeaponId,
} from './equipment';

export interface ToolSpec {
  type: 'axe' | 'pickaxe' | 'hoe' | 'can' | 'rod' | 'net';
}
/** Timed effects stored as server buffs: boons, resistances and injuries. */
export type BuffKind =
  | 'regen'
  | 'might'
  | 'ward'
  | 'lantern'
  | 'bleed'
  | 'poison'
  | 'burn'
  | 'frostbite'
  | 'fracture'
  | 'curse'
  | 'fever'
  | 'gut_rot'
  | 'ague'
  | 'grave_rot'
  | 'rested'
  | 'warmth'
  | 'coolness'
  | 'vigor'
  | 'fortune'
  | 'swift'
  | 'fury'
  | 'bulwark'
  | 'steady'
  | 'focus';
export const BUFF_KIND_LIST: readonly BuffKind[] = [
  'regen',
  'might',
  'ward',
  'lantern',
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
  'rested',
  'warmth',
  'coolness',
  'vigor',
  'fortune',
  'swift',
  'fury',
  'bulwark',
  'steady',
  'focus',
];

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  stack: number;
  /** base value in coins (sell price before market multipliers) */
  value: number;
  desc: string;
  icon: { g: Glyph; a: number; b: number };
  /** forging: phase 0..7 (0 red,1 orange,2 yellow,3 green,4 cyan,5 blue,6 violet,7 magenta) */
  phase?: number;
  tool?: ToolSpec;
  /** food/potion */
  heal?: number;
  nourishment?: number;
  buff?: { kind: BuffKind; secs: number; power: number };
  /** medicine: injuries this item cures */
  cure?: Array<
    'bleed' | 'poison' | 'burn' | 'frostbite' | 'fracture' | 'curse' | 'fever' | 'gut_rot' | 'ague' | 'grave_rot'
  >;
  /** placeable: world object subtype created */
  place?: {
    kind: 'station' | 'sprinkler' | 'shelter' | 'chest' | 'furniture' | 'sign' | 'fence' | 'structure';
    sub: string;
  };
  /** seed: crop id planted */
  crop?: string;
  /** outfit index into the client outfit table */
  outfit?: number;
  /** armor piece: slot and set id */
  armor?: { slot: ArmorSlot; set: string };
  /** Main-hand weapon id; the forged sword remains a plain quick-bar weapon. */
  weapon?: WeaponId;
  /** consumed on use for a special effect: a Heart Crystal (+10 max health) or a boss summon */
  special?: 'heart' | 'summon' | 'ship' | 'recall' | 'mount';
  /** special 'mount': which mount it calls */
  mount?: 'horse' | 'stag' | 'griffin';
  tags?: string[];
  /** catalog fields: rarity 0..5, material tier, UI category, the kingdom it belongs to */
  rarity?: Rarity;
  tier?: number;
  cat?: ItemCat;
  realm?: string;
  /** fertiliser: days of growth saved and extra harvest yield */
  fert?: { days: number; yield: number };
  /** worn/wielded stats of data-driven gear (see catalog/gear.ts) */
  gear?: GearSpec;
  /** what using it does beyond eating or drinking (recipe scrolls, runes, repair kits ...) */
  use?: ItemUse;
}

export interface Props {
  tier?: number; // tools
  atk?: number; // weapons
  dur?: number; // weapons/tools remaining uses
  maxDur?: number;
  phase?: number; // forged item phase (0..7, fractional allowed)
  quality?: number; // 0..1 forging / crafting tune
  qname?: string; // quality label
  stat?: 'hp' | 'atk' | 'luck' | 'haste'; // rings
  val?: number;
  a?: string;
  b?: string; // superposed seed: two crops
  note?: string;
  stats?: Record<string, number>; // forged stat breakdown
  qt?: number; // crafted quality tier 0..4 (Crude..Masterwork)
  up?: number; // upgrade level (+N)
  ench?: string; // enchantment key set into the gear
}
export interface Stack {
  id: string;
  n: number;
  p?: Props;
}
export type Slot = Stack | null;

export const INV_SIZE = 30;
export const HOTBAR = 10;

const I: Record<string, ItemDef> = {};
const COL = {
  ink: 0,
  night: 1,
  slate: 2,
  steel: 3,
  mist: 4,
  fog: 5,
  pale: 6,
  white: 7,
  g1: 9,
  g2: 10,
  g3: 11,
  g4: 12,
  g5: 13,
  g6: 14,
  g7: 15,
  e1: 17,
  e2: 18,
  e3: 19,
  e4: 20,
  e5: 21,
  e6: 22,
  e7: 23,
  w2: 26,
  w3: 27,
  w4: 28,
  w5: 29,
  w6: 30,
  w7: 31,
  r2: 34,
  r3: 35,
  r4: 36,
  r5: 37,
  r6: 38,
  r7: 39,
  q2: 42,
  q3: 43,
  q4: 44,
  q5: 45,
  q6: 46,
  q7: 47,
};
function def(
  id: string,
  name: string,
  kind: ItemKind,
  value: number,
  g: Glyph,
  a: number,
  b: number,
  desc: string,
  o: Partial<ItemDef> = {},
): void {
  I[id] = {
    id,
    name,
    kind,
    stack:
      kind === 'tool' ||
      kind === 'weapon' ||
      kind === 'ring' ||
      kind === 'outfit' ||
      kind === 'armor' ||
      kind === 'gear'
        ? 1
        : 99,
    value,
    desc,
    ...(kind === 'food' ? { nourishment: 25 } : {}),
    icon: { g, a, b },
    ...o,
  };
}
const C = COL;

def(
  'waterskin_empty',
  'Empty Waterskin',
  'misc',
  10,
  'waterskin',
  C.e3,
  C.e5,
  'Select in the quick-bar, then Use it facing a town well (clean water) or any river or lake (murky water).',
  { stack: 1, tags: ['supplies'] },
);
def(
  'waterskin_full',
  'Filled Waterskin',
  'misc',
  10,
  'waterskin',
  C.e3,
  C.w5,
  'Drink to restore 35 water. Keeps the empty skin; refill it at a reachable town well.',
  { stack: 1, tags: ['supplies'] },
);
def(
  'waterskin_murky',
  'Murky Waterskin',
  'misc',
  6,
  'waterskin',
  C.e3,
  C.g3,
  'River water. Drinking it may make you sick (Adventure and Hardcore); boil it in a cooking pot first.',
  { stack: 1, tags: ['supplies'] },
);

// Reusable construction blocks: original art is shared by inventory and world previews.
for (const [id, piece] of Object.entries(BUILD_PIECES)) {
  def(
    id,
    piece.name,
    'placeable',
    0,
    'box',
    piece.material === 'stone' || piece.material === 'slate' ? C.steel : C.e3,
    C.e6,
    `Craft and place on your own foundation. ${piece.layer === 'stairs' ? 'Links two floors; includes an upper landing.' : 'Pickaxe + Use returns the piece.'}`,
    { place: { kind: 'structure', sub: id }, tags: ['building'], cat: 'building' },
  );
}

// ── raw resources
def('wood', 'Wood', 'resource', 4, 'log', C.e3, C.e5, 'Rough timber from a felled tree.');
def('stone', 'Stone', 'resource', 3, 'stone', C.mist, C.pale, 'A lump of grey stone.');
def('coal', 'Coal', 'resource', 12, 'coal', C.night, C.steel, 'Burns hot. Fuel for the furnace.');
def('fiber', 'Fiber', 'resource', 2, 'leaf', C.g4, C.g6, 'Stringy plant fiber, good for hay and cloth.');
def('copper_ore', 'Copper Ore', 'resource', 8, 'ore', C.e4, C.e6, 'Orange-flecked ore. Phase: orange.', { phase: 1 });
def('iron_ore', 'Iron Ore', 'resource', 14, 'ore', C.steel, C.w5, 'Heavy blue-grey ore. Phase: blue.', { phase: 5 });
def('silver_ore', 'Silver Ore', 'resource', 24, 'ore', C.pale, C.w7, 'Bright ore with a cyan shimmer. Phase: cyan.', {
  phase: 4,
});
def('gold_ore', 'Gold Ore', 'resource', 40, 'ore', C.e5, C.e7, 'Soft, heavy and golden. Phase: yellow.', { phase: 2 });
def(
  'qubit_crystal',
  'Qubit Crystal',
  'resource',
  90,
  'gem',
  C.q3,
  C.q7,
  'A crystal that hums in two states at once. Phase: violet.',
  { phase: 6 },
);
def('slime_gel', 'Slime Gel', 'resource', 10, 'gel', C.w4, C.w7, 'Wobbles between solid and liquid. Phase: cyan.', {
  phase: 4,
});
def(
  'hopper_tooth',
  'Hopper Tooth',
  'resource',
  16,
  'tooth',
  C.pale,
  C.r4,
  'A tooth that glints red when tilted. Phase: red.',
  { phase: 0 },
);
def(
  'boar_tusk',
  'Boar Tusk',
  'resource',
  22,
  'tooth',
  C.pale,
  C.e4,
  'Curved ivory, still warm with stubbornness. Phase: orange.',
  { phase: 1 },
);
def(
  'wolf_fang',
  'Wolf Fang',
  'resource',
  26,
  'tooth',
  C.pale,
  C.w6,
  'A fang that rings like a bell when struck. Phase: blue.',
  { phase: 5 },
);
def(
  'heartwood',
  'Heartwood',
  'resource',
  30,
  'log',
  C.g3,
  C.g6,
  'Dense green wood from the oldest trees. Phase: green.',
  { phase: 3 },
);
def('raw_meat', 'Raw Meat', 'resource', 14, 'meat', C.r3, C.r5, 'Fresh from the hunt. Cook it.');
def('hide', 'Hide', 'resource', 10, 'hide', C.e3, C.e5, 'A supple animal hide.');
def('feather', 'Feather', 'resource', 6, 'feather', C.pale, C.w6, 'Light and strong.');
def('egg', 'Egg', 'food', 12, 'egg', C.e7, C.e6, 'A fresh egg.', { heal: 6 });
def('milk', 'Milk', 'food', 18, 'bottle', C.white, C.pale, 'Creamy cow milk.', { heal: 8 });

// ── crafted materials
def('plank', 'Plank', 'material', 8, 'plank', C.e5, C.e3, 'Sawn wood.');
def('cloth', 'Cloth', 'material', 14, 'cloth', C.pale, C.q4, 'Woven plant fiber.');
def('copper_ingot', 'Copper Ingot', 'material', 26, 'ingot', C.e4, C.e6, 'Smelted copper. Phase: orange.', {
  phase: 1,
});
def('iron_ingot', 'Iron Ingot', 'material', 44, 'ingot', C.steel, C.w5, 'Smelted iron. Phase: blue.', { phase: 5 });
def('silver_ingot', 'Silver Ingot', 'material', 72, 'ingot', C.pale, C.w7, 'Smelted silver. Phase: cyan.', {
  phase: 4,
});
def('gold_ingot', 'Gold Ingot', 'material', 120, 'ingot', C.e5, C.e7, 'Smelted gold. Phase: yellow.', { phase: 2 });
def('hay', 'Hay', 'material', 3, 'leaf', C.e6, C.e7, 'Animal feed.');

// ── seeds & crops (see crops.ts for growth data)
const CROP_SEEDS: Array<[string, string, number, number, number, Glyph]> = [
  // id, name, seedValue, cropValue, colour, glyph
  ['turnip', 'Turnip', 10, 36, C.w7, 'root'],
  ['potato', 'Potato', 14, 52, C.e5, 'root'],
  ['strawberry', 'Strawberry', 40, 40, C.r4, 'berry'],
  ['green_bean', 'Green Bean', 18, 34, C.g5, 'leaf'],
  ['tomato', 'Tomato', 22, 44, C.r3, 'fruit'],
  ['melon', 'Melon', 50, 140, C.g4, 'fruit'],
  ['corn', 'Corn', 30, 50, C.e6, 'fruit'],
  ['blueberry', 'Blueberry', 60, 28, C.w3, 'berry'],
  ['pumpkin', 'Pumpkin', 36, 120, C.e4, 'fruit'],
  ['cranberry', 'Cranberry', 70, 32, C.r4, 'berry'],
  ['yam', 'Yam', 24, 60, C.q4, 'root'],
  ['eggplant', 'Eggplant', 28, 62, C.q3, 'fruit'],
  ['frostroot', 'Frostroot', 45, 95, C.w6, 'root'],
];
for (const [id, name, sv, cv, c, g] of CROP_SEEDS) {
  def(
    `${id}_seed`,
    `${name} Seed`,
    'seed',
    sv,
    'seed',
    c,
    C.e5,
    `Plant on tilled soil. Grows into ${name.toLowerCase()}.`,
    { crop: id },
  );
  def(id, name, 'crop', cv, g, c, C.g5, `A ${name.toLowerCase()} you grew yourself.`, { heal: 5 });
}
def(
  'superposed_seed',
  'Superposed Seed',
  'seed',
  120,
  'orb',
  C.q4,
  C.q7,
  'Two seeds in one. At harvest it collapses into either crop.',
  { crop: '*', stack: 20 },
);

// ── forage
const FORAGE: Array<[string, string, number, Glyph, number, number]> = [
  ['wild_leek', 'Wild Leek', 14, 'leaf', C.g5, C.g7],
  ['daffodil', 'Daffodil', 20, 'flower', C.e6, C.e7],
  ['blackberry', 'Blackberry', 18, 'berry', C.q2, C.q4],
  ['sunpetal', 'Sunpetal', 26, 'flower', C.r5, C.e6],
  ['mushroom', 'Cap Mushroom', 22, 'mushroom', C.e5, C.pale],
  ['hazelnut', 'Hazelnut', 16, 'fruit', C.e4, C.e6],
  ['snow_yam', 'Snow Yam', 30, 'root', C.w6, C.white],
  ['crocus', 'Crocus', 28, 'flower', C.q5, C.q7],
  ['healing_herb', 'Healing Herb', 24, 'leaf', C.g3, C.g6],
];
for (const [id, name, v, g, a, b] of FORAGE)
  def(id, name, 'forage', v, g, a, b, `Foraged from the wild. ${name}.`, { heal: 8 });

// ── fish & bugs
const FISH: Array<[string, string, number, number, number]> = [
  ['minnow', 'Minnow', 12, C.w5, C.w7],
  ['carp', 'Carp', 30, C.e4, C.e6],
  ['perch', 'Perch', 36, C.g4, C.e6],
  ['trout', 'Trout', 54, C.r4, C.w6],
  ['catfish', 'Catfish', 70, C.steel, C.pale],
  ['pike', 'Pike', 90, C.g3, C.e7],
  ['eel', 'Eel', 110, C.q2, C.q5],
  ['sailfin', 'Ocean Sailfin', 85, C.w3, C.e6],
  ['moonray', 'Moonray', 190, C.w3, C.pale],
  ['prism_nautilus', 'Prism Nautilus', 320, C.q3, C.q7],
  ['koi', 'Koi', 220, C.r4, C.white],
  ['glowfin', 'Glowfin', 180, C.q6, C.q7],
];
for (const [id, name, v, a, b] of FISH)
  def(id, name, 'fish', v, 'fish', a, b, `A ${name.toLowerCase()} from the water.`, { heal: 6 });
const BUGS: Array<[string, string, number, number, number]> = [
  ['butterfly', 'Butterfly', 18, C.w5, C.q5],
  ['ladybug', 'Ladybug', 14, C.r4, C.ink],
  ['beetle', 'Jewel Beetle', 30, C.g5, C.q7],
  ['firefly', 'Firefly', 40, C.e6, C.e7],
  ['dragonfly', 'Dragonfly', 36, C.w4, C.q6],
  ['cricket', 'Cricket', 10, C.e3, C.e5],
];
for (const [id, name, v, a, b] of BUGS)
  def(id, name, 'bug', v, 'bug', a, b, `A ${name.toLowerCase()} caught with a net.`);

// ── cooked food & potions
const FOOD: Array<[string, string, number, Glyph, number, number, number, ItemDef['buff']?]> = [
  ['roast_potato', 'Roast Potato', 70, 'root', C.e4, C.e6, 25],
  ['veggie_stew', 'Veggie Stew', 110, 'bowl', C.g4, C.e5, 40, { kind: 'regen', secs: 60, power: 1 }],
  ['berry_jam', 'Berry Jam', 90, 'jar', C.q3, C.r4, 30],
  ['fruit_pie', 'Fruit Pie', 150, 'pie', C.e5, C.r4, 45, { kind: 'might', secs: 120, power: 0.1 }],
  ['fish_fry', 'Fried Fish', 120, 'fish', C.e4, C.e6, 40],
  ['grilled_meat', 'Grilled Meat', 130, 'meat', C.e3, C.r4, 50, { kind: 'might', secs: 120, power: 0.12 }],
  ['pumpkin_soup', 'Pumpkin Soup', 160, 'bowl', C.e5, C.e7, 50, { kind: 'ward', secs: 120, power: 0.15 }],
  ['omelet', 'Omelet', 100, 'pie', C.e6, C.e7, 35],
  ['hearty_stew', 'Hearty Stew', 210, 'bowl', C.e3, C.r4, 70, { kind: 'regen', secs: 120, power: 2 }],
  ['baked_yam', 'Baked Yam', 95, 'root', C.q4, C.e5, 32],
  ['qubit_tea', 'Qubit Tea', 260, 'bottle', C.q4, C.q7, 20, { kind: 'lantern', secs: 600, power: 1 }],
  // ── kingdom cuisine (world revision 5): signature dishes of the six great kingdoms
  ['knights_pie', "Knight's Pie", 170, 'pie', C.e4, C.e6, 55, { kind: 'might', secs: 150, power: 0.12 }],
  ['honey_cake', 'Aurelian Honey Cake', 120, 'pie', C.e6, C.e7, 38, { kind: 'regen', secs: 80, power: 1.2 }],
  ['glowcap_broth', 'Glowcap Broth', 140, 'bowl', C.w4, C.w7, 36, { kind: 'lantern', secs: 600, power: 1 }],
  ['hazel_loaf', 'Hazelnut Loaf', 100, 'pie', C.e3, C.e5, 34, { kind: 'ward', secs: 150, power: 0.12 }],
  ['forge_stew', 'Forge-Fire Stew', 190, 'bowl', C.r3, C.e6, 60, { kind: 'warmth', secs: 360, power: 0.8 }],
  ['cave_bread', 'Cave-Cheese Bread', 95, 'pie', C.e5, C.e7, 32, { kind: 'ward', secs: 120, power: 0.1 }],
  ['cherry_mochi', 'Cherry Mochi', 110, 'jar', C.r5, C.white, 34, { kind: 'might', secs: 120, power: 0.1 }],
  ['thunder_noodles', 'Thunder Noodles', 180, 'bowl', C.e4, C.w6, 55, { kind: 'might', secs: 180, power: 0.15 }],
  ['reef_ceviche', 'Reef Ceviche', 170, 'fish', C.w4, C.g6, 42, { kind: 'coolness', secs: 360, power: 0.8 }],
  ['crab_chowder', 'Pearl-Crab Chowder', 175, 'bowl', C.e6, C.w5, 56, { kind: 'ward', secs: 150, power: 0.15 }],
  ['ember_stew', 'Ember-Pepper Stew', 185, 'bowl', C.r4, C.e7, 58, { kind: 'warmth', secs: 300, power: 0.6 }],
  ['cinder_cake', 'Cinder Cake', 125, 'pie', C.night, C.r5, 36, { kind: 'regen', secs: 90, power: 1.5 }],
];
for (const [id, name, v, g, a, b, heal, buff] of FOOD)
  def(id, name, 'food', v, g, a, b, 'Cooked at the pot. Eat it for health.', { heal, buff });
def('healing_potion', 'Healing Potion', 'potion', 80, 'bottle', C.r4, C.r6, 'Restores 60 health.', { heal: 60 });
def('regen_potion', 'Regeneration Potion', 'potion', 120, 'bottle', C.g5, C.g7, 'Heals over time.', {
  buff: { kind: 'regen', secs: 90, power: 2 },
});
def('might_potion', 'Might Potion', 'potion', 140, 'bottle', C.e5, C.r5, 'Hit harder for a while.', {
  buff: { kind: 'might', secs: 180, power: 0.2 },
});
def('ward_potion', 'Warding Potion', 'potion', 140, 'bottle', C.w4, C.w7, 'Take less damage for a while.', {
  buff: { kind: 'ward', secs: 180, power: 0.25 },
});
def('lantern_potion', 'Night-Sight Potion', 'potion', 100, 'bottle', C.q4, C.q7, 'See further in the dark.', {
  buff: { kind: 'lantern', secs: 600, power: 1 },
});

// ── survival medicine and tonics (master plan §8)
def(
  'spoiled_food',
  'Spoiled Food',
  'resource',
  0,
  'meat',
  C.g2,
  C.e2,
  'Rotten. Good for nothing but the compost heap.',
);
def('bandage', 'Bandage', 'potion', 25, 'bottle', C.pale, C.e6, 'Stops bleeding. Heals a little.', {
  heal: 10,
  cure: ['bleed'],
});
def('antidote', 'Antidote', 'potion', 60, 'bottle', C.g4, C.g7, 'Clears poison.', { cure: ['poison'] });
def('burn_salve', 'Burn Salve', 'potion', 70, 'bottle', C.w3, C.e6, 'Soothes burns and frostbite.', {
  cure: ['burn', 'frostbite'],
});
def('star_shard', 'Star Shard', 'material', 140, 'gem', C.w6, C.q6, 'A splinter of a fallen star, still faintly warm.');
// what the star shards make (recipes.ts): a ward that shimmers, and a cake that keeps on mending
def(
  'starlight_draught',
  'Starlight Draught',
  'potion',
  320,
  'bottle',
  C.w6,
  C.q7,
  'Heals 40 and wards you in starlight.',
  {
    heal: 40,
    buff: { kind: 'ward', secs: 300, power: 0.3 },
  },
);
def(
  'stardust_cake',
  'Stardust Cake',
  'food',
  260,
  'pie',
  C.e7,
  C.q6,
  'Sweet, and it glitters. Heals over a long while.',
  {
    heal: 50,
    buff: { kind: 'regen', secs: 180, power: 2.5 },
  },
);
def('splint', 'Splint', 'potion', 40, 'bottle', C.e3, C.pale, 'Sets a broken bone so you can run again.', {
  heal: 6,
  cure: ['fracture'],
});
def('holy_water', 'Holy Water', 'potion', 80, 'bottle', C.w5, C.q4, 'Blessed water that lifts a curse and grave rot.', {
  cure: ['curse', 'grave_rot'],
});
// remedies for the diseases (survival.ts)
def('willow_tea', 'Willow-Bark Tea', 'potion', 45, 'bottle', C.e4, C.g6, 'Breaks a chill fever.', {
  heal: 8,
  cure: ['fever'],
});
def('charcoal_draught', 'Charcoal Draught', 'potion', 50, 'bottle', C.night, C.steel, 'Settles gut rot.', {
  cure: ['gut_rot'],
});
def('ague_tonic', 'Ague Tonic', 'potion', 70, 'bottle', C.g3, C.w6, 'Drives out the marsh ague.', {
  heal: 10,
  cure: ['ague'],
});
def('warming_tonic', 'Warming Tonic', 'potion', 90, 'bottle', C.r4, C.e7, 'Resist the cold for a long while.', {
  buff: { kind: 'warmth', secs: 420, power: 0.7 },
});
def('cooling_tonic', 'Cooling Tonic', 'potion', 90, 'bottle', C.w5, C.w7, 'Resist the heat for a long while.', {
  buff: { kind: 'coolness', secs: 420, power: 0.7 },
});

// ── fertilizers
def('fertilizer', 'Fertilizer', 'fertilizer', 20, 'bag', C.e3, C.g4, 'Speeds growth: shaves a day off a crop.');
def(
  'phase_tonic_a',
  'Phase Tonic (A)',
  'fertilizer',
  90,
  'bottle',
  C.q3,
  C.q7,
  'Biases a superposed crop toward its FIRST crop (75%).',
);
def(
  'phase_tonic_b',
  'Phase Tonic (B)',
  'fertilizer',
  90,
  'bottle',
  C.w3,
  C.w7,
  'Biases a superposed crop toward its SECOND crop (75%).',
);

// ── tools & weapon (tier in props)
def('axe', 'Axe', 'tool', 30, 'axe', C.steel, C.e4, 'Fells trees. Higher tiers chop faster.', {
  tool: { type: 'axe' },
});
def('pickaxe', 'Pickaxe', 'tool', 30, 'pickaxe', C.steel, C.e4, 'Breaks rock and mines ore. Tier decides which ore.', {
  tool: { type: 'pickaxe' },
});
def('hoe', 'Hoe', 'tool', 25, 'hoe', C.steel, C.e4, 'Tills grass into planting soil.', { tool: { type: 'hoe' } });
def('can', 'Watering Can', 'tool', 25, 'can', C.w4, C.w6, 'Waters tilled soil and crops.', { tool: { type: 'can' } });
def('rod', 'Fishing Rod', 'tool', 40, 'rod', C.e4, C.w5, 'Cast at water. Time the tugs to land the catch.', {
  tool: { type: 'rod' },
});
def('net', 'Bug Net', 'tool', 30, 'net', C.e4, C.pale, 'Sweep over flowers and tall grass.', { tool: { type: 'net' } });
def('sword', 'Sword', 'weapon', 40, 'sword', C.pale, C.e5, 'A trusty blade. Forge a better one.');

// ── placeables
const PLACE: Array<[string, string, number, Glyph, number, number, NonNullable<ItemDef['place']>, string]> = [
  [
    'workbench',
    'Workbench',
    60,
    'bench',
    C.e4,
    C.e6,
    { kind: 'station', sub: 'workbench' },
    'Craft planks, tools, stations and more.',
  ],
  [
    'furnace',
    'Furnace',
    90,
    'furnace',
    C.steel,
    C.r5,
    { kind: 'station', sub: 'furnace' },
    'Smelts ore into ingots. Needs coal.',
  ],
  [
    'forge',
    'Anvil & Forge',
    200,
    'anvil',
    C.slate,
    C.r5,
    { kind: 'station', sub: 'forge' },
    'Interference Forging: combine metals by phase.',
  ],
  ['cooking_pot', 'Cooking Pot', 80, 'pot', C.slate, C.e5, { kind: 'station', sub: 'cooking_pot' }, 'Cook meals.'],
  [
    'alchemy_table',
    'Alchemy Table',
    120,
    'bottle',
    C.q3,
    C.g5,
    { kind: 'station', sub: 'alchemy' },
    'Brew potions and tonics.',
  ],
  ['loom', 'Loom', 110, 'loom', C.e5, C.q4, { kind: 'station', sub: 'loom' }, 'Weave cloth and sew outfits.'],
  [
    'jeweler_bench',
    'Jeweler Bench',
    160,
    'bench',
    C.q4,
    C.e6,
    { kind: 'station', sub: 'jeweler' },
    'Craft rings with stat bonuses.',
  ],
  [
    'carpenter_bench',
    'Carpenter Bench',
    100,
    'bench',
    C.e3,
    C.e5,
    { kind: 'station', sub: 'carpenter' },
    'Build furniture and coops.',
  ],
  ['chest', 'Chest', 50, 'box', C.e3, C.e6, { kind: 'chest', sub: 'chest' }, 'Stores 30 items. Only you can open it.'],
  [
    'sprinkler_1',
    'Sprinkler',
    140,
    'sprinkler',
    C.w4,
    C.steel,
    { kind: 'sprinkler', sub: 'sprinkler1' },
    'Waters the 4 tiles around it every day.',
  ],
  [
    'sprinkler_2',
    'Quality Sprinkler',
    320,
    'sprinkler',
    C.w5,
    C.e6,
    { kind: 'sprinkler', sub: 'sprinkler2' },
    'Waters the 8 tiles around it every day.',
  ],
  [
    'coop',
    'Chicken Coop',
    400,
    'coop',
    C.e4,
    C.r4,
    { kind: 'shelter', sub: 'coop' },
    'Houses 4 chickens. They lay eggs when fed hay.',
  ],
  [
    'barn',
    'Barn',
    900,
    'barn',
    C.r3,
    C.e5,
    { kind: 'shelter', sub: 'barn' },
    'Houses 4 cows. They give milk when fed hay.',
  ],
  [
    'phase_lantern',
    'Phase Lantern',
    180,
    'lamp',
    C.q4,
    C.q7,
    { kind: 'furniture', sub: 'phase_lantern' },
    'Holds a 5x5 patch of land in one season: crops inside never wither. (Greenhouse effect.)',
  ],
  ['fence', 'Fence', 6, 'fence', C.e4, C.e6, { kind: 'fence', sub: 'fence' }, 'Keeps things in. Or out.'],
  ['sign', 'Sign', 10, 'sign', C.e4, C.e6, { kind: 'sign', sub: 'sign' }, 'A signpost.'],
  ['chair', 'Chair', 40, 'chair', C.e4, C.e6, { kind: 'furniture', sub: 'chair' }, 'Furniture.'],
  ['table', 'Table', 70, 'table', C.e4, C.e6, { kind: 'furniture', sub: 'table' }, 'Furniture.'],
  ['bed', 'Bed', 120, 'bed', C.r3, C.pale, { kind: 'furniture', sub: 'bed' }, 'Furniture.'],
  ['lamp', 'Standing Lamp', 90, 'lamp', C.e5, C.e7, { kind: 'furniture', sub: 'lamp' }, 'Gives off a warm light.'],
  ['shelf', 'Shelf', 80, 'shelf', C.e3, C.e5, { kind: 'furniture', sub: 'shelf' }, 'Furniture.'],
  ['rug', 'Rug', 60, 'rug', C.q3, C.r4, { kind: 'furniture', sub: 'rug' }, 'Furniture. You can walk over it.'],
];
for (const [id, name, v, g, a, b, place, desc] of PLACE)
  def(id, name, 'placeable', v, g, a, b, desc, { place, stack: place.kind === 'fence' ? 99 : 20 });
def('chicken', 'Chicken', 'animal', 160, 'chicken', C.white, C.r4, 'Put it in a coop.', { stack: 4 });
def('cow', 'Cow', 'animal', 520, 'cow', C.white, C.ink, 'Put it in a barn.', { stack: 4 });

// ── rings & outfits
for (const [id, name, stat, a] of [
  ['ring_hp', 'Copper Ring', 'hp', C.e4],
  ['ring_atk', 'Crystal Ring', 'atk', C.q4],
  ['ring_luck', 'Gold Ring', 'luck', C.e6],
  ['ring_haste', 'Silver Ring', 'haste', C.pale],
] as const) {
  def(
    id,
    name,
    'ring',
    200,
    'ring',
    a,
    C.white,
    `A ring that boosts ${stat === 'hp' ? 'max health' : stat === 'atk' ? 'attack' : stat === 'luck' ? 'luck (more drops)' : 'haste (faster gathering)'}.`,
    { tags: [stat] },
  );
}
const OUTFITS: Array<[string, string, number, number, number]> = [
  ['outfit_traveler', "Traveler's Garb", 0, C.w3, C.e3],
  ['outfit_red', 'Ember Tunic', 1, C.r3, C.slate],
  ['outfit_violet', 'Phase Robe', 2, C.q3, C.w2],
  ['outfit_green', 'Forester Coat', 3, C.g3, C.e2],
  ['outfit_gold', 'Sunlit Vest', 4, C.e5, C.g2],
  ['outfit_frost', 'Frostweave', 5, C.pale, C.slate],
  ['outfit_crimson', 'Crimson Jerkin', 6, C.r4, C.w2],
  ['outfit_sky', "Skyfarer's Hat & Tunic", 7, C.w4, C.e3],
];
for (const [id, name, idx, a, b] of OUTFITS)
  def(id, name, 'outfit', 160, 'shirt', a, b, 'Cosmetic. Equip to change your look.', { outfit: idx });

// ── adventure: shrines and bosses (see shrines.ts, bosses.ts)
def(
  'shrine_shard',
  'Shrine Shard',
  'misc',
  80,
  'gem',
  C.q4,
  C.w7,
  'A sliver of solved resonance. Four of them make a Heart Crystal.',
);
def(
  'heart_crystal',
  'Heart Crystal',
  'misc',
  400,
  'gem',
  C.r4,
  C.r7,
  'Use it to permanently gain 10 maximum health (up to 20 crystals).',
  { special: 'heart' },
);
def(
  'slime_core',
  'Slime Core',
  'resource',
  300,
  'gel',
  C.g4,
  C.e7,
  'The still heart of the Gelatinous Sovereign. A Warden would pay dearly for the scent.',
);
def(
  'warden_heart',
  'Warden Heart',
  'resource',
  500,
  'orb',
  C.g3,
  C.e6,
  'A heart that still beats slowly, in time with the forest.',
);
// Mythical-beast trophies (world revision 5)
def(
  'griffin_plume',
  'Griffin Plume',
  'resource',
  120,
  'feather',
  C.e5,
  C.e7,
  'A gilded flight feather. Aurelion lords pay in gold.',
);
def(
  'stag_antler',
  'Spirit Antler',
  'resource',
  120,
  'leaf',
  C.g5,
  C.pale,
  'Warm to the touch and faintly luminous. Sylvaris holds it sacred.',
);
def(
  'iron_heart',
  'Iron Heart',
  'resource',
  140,
  'ore',
  C.slate,
  C.e6,
  'A fist-sized core of folded iron, still faintly warm.',
);
def('raiju_fang', 'Raiju Fang', 'resource', 130, 'feather', C.pale, C.w6, 'A crackling fang. It tingles in your pack.');
def(
  'naga_pearl',
  'Naga Pearl',
  'resource',
  150,
  'orb',
  C.white,
  C.w6,
  'A tide-bright pearl from a reef naga. Thalassara adores them.',
);
def(
  'hellhound_ember',
  'Hellhound Ember',
  'resource',
  130,
  'coal',
  C.r2,
  C.e6,
  'A coal that will not cool. Nethrakar smiths prize it.',
);
def('void_core', 'Void Core', 'resource', 900, 'orb', C.q3, C.q7, 'A crystal that is mostly absence.');
def(
  'slime_crown',
  'Slime Crown',
  'misc',
  300,
  'orb',
  C.g5,
  C.e6,
  'Use it far from any village to call the Gelatinous Sovereign. Level 10.',
  { special: 'summon', stack: 5 },
);
def(
  'warden_horn',
  'Warden Horn',
  'misc',
  500,
  'tooth',
  C.e5,
  C.g4,
  'Blow it in the wilds to call the Warden of the Grove. Level 18.',
  { special: 'summon', stack: 5 },
);
def(
  'sloop',
  'Sloop Charter',
  'misc',
  260,
  'cloth',
  C.pale,
  C.e5,
  "Use it at the water's edge to board your sloop; use it again at a shore to step off. Fire cannons with attack.",
  { special: 'ship', stack: 1 },
);
// ── travel (§14): a waystone splinter that carries you home, and the mounts you ride
def(
  'recall_shard',
  'Recall Shard',
  'misc',
  60,
  'gem',
  C.q5,
  C.e6,
  'A splinter of waystone. Use it to return to your bound Recall home after five quiet seconds. Bind a home at any attuned waystone.',
  { special: 'recall', stack: 10 },
);
def(
  'horse_whistle',
  'Riding Horse',
  'misc',
  900,
  'tooth',
  C.e4,
  C.e6,
  'A carved whistle your horse answers. Use it to mount or dismount: much faster on roads and open ground, but no fighting or tools from the saddle.',
  { special: 'mount', mount: 'horse', stack: 1 },
);
def(
  'stag_bell',
  'Moonlit Stag Bell',
  'misc',
  0,
  'ring',
  C.q6,
  C.w7,
  'A silver bell from the waystones. The Moonlit Stag, swifter than any horse, comes when it rings. A reward for twelve attuned stones.',
  { special: 'mount', mount: 'stag', stack: 1 },
);
def(
  'griffin_whistle',
  'Griffin Whistle',
  'misc',
  1600,
  'tooth',
  C.e6,
  C.w6,
  'A carved plume-whistle and a light saddle. Your griffin flies over forest, water and cliff alike, but will not soar over walls or into a town: land outside and walk in. No fighting from the air.',
  { special: 'mount', mount: 'griffin', stack: 1 },
);
def('doubloon', 'Doubloon', 'misc', 55, 'gem', C.e6, C.e4, "A pirate's gold coin. Merchants pay well for them.");
def(
  'colossus_core',
  'Colossus Core',
  'misc',
  900,
  'orb',
  C.q4,
  C.w7,
  'Use it far from any village to wake the Decoherent Colossus. Level 28.',
  { special: 'summon', stack: 5 },
);

// ── armor sets and Foci (see equipment.ts)
const SET_COLORS: Record<string, [number, number]> = {
  leather: [C.e3, C.e5],
  hunter: [C.g3, C.e4],
  iron: [C.steel, C.pale],
  silk: [C.q3, C.q6],
  voidglass: [C.q5, C.w7],
};
const SLOT_GLYPH: Record<ArmorSlot, Glyph> = { head: 'helm', chest: 'cuirass', legs: 'greaves', feet: 'boots' };
for (const set of ARMOR_SETS) {
  const [a, b] = set.colors ?? SET_COLORS[set.id]!;
  const rarity = Math.min(5, Math.floor(set.level / 7)) as 0 | 1 | 2 | 3 | 4 | 5;
  for (const slot of ARMOR_SLOTS) {
    const parts = [
      set.piece.def ? `-${Math.round(set.piece.def * 1000) / 10}% damage` : '',
      set.piece.hp ? `+${set.piece.hp} health` : '',
      set.piece.atk ? `+${set.piece.atk} attack` : '',
      set.piece.haste ? `+${set.piece.haste} haste` : '',
    ]
      .filter(Boolean)
      .join(', ');
    def(
      armorId(set.id, slot),
      set.pieces[slot],
      'armor',
      60 + set.level * 14,
      SLOT_GLYPH[slot],
      a,
      b,
      `${ARMOR_SLOT_NAMES[slot]} armour of ${set.name}. ${parts}. Level ${set.level}. ${set.blurb}`,
      { armor: { slot, set: set.id }, cat: 'armor', rarity },
    );
  }
}
const WEAPON_COLORS: Record<string, [number, number]> = {
  spear: [C.steel, C.e4],
  battle_axe: [C.steel, C.r3],
  warhammer: [C.steel, C.e3],
  dagger: [C.steel, C.r2],
  greatsword: [C.steel, C.e5],
  crossbow: [C.e4, C.steel],
  ember_staff: [C.r4, C.e6],
  rime_staff: [C.w4, C.pale],
  verdant_staff: [C.g4, C.e5],
  radiant_staff: [C.e6, C.white],
  morph_staff: [C.q4, C.e4],
};
for (const w of Object.values(WEAPONS)) {
  if (w.id === 'sword') continue;
  const [a, b] = w.tint ?? WEAPON_COLORS[w.id]!;
  const fam = w.fam ?? w.id;
  const wrarity = Math.min(5, Math.floor(w.level / 7)) as 0 | 1 | 2 | 3 | 4 | 5;
  def(
    w.id,
    w.name,
    'weapon',
    120 + w.level * 20,
    fam === 'sword'
      ? 'sword'
      : fam === 'spear'
        ? 'spear'
        : fam === 'battle_axe'
          ? 'battle_axe'
          : fam === 'warhammer'
            ? 'warhammer'
            : fam === 'dagger'
              ? 'dagger'
              : fam === 'greatsword'
                ? 'greatsword'
                : w.cls === 'crossbow'
                  ? 'crossbow'
                  : 'staff',
    a,
    b,
    `${w.blurb} ${w.quantum} Level ${w.level}.`,
    { weapon: w.id, cat: 'weapon', rarity: wrarity },
  );
}

export const ITEMS: Readonly<Record<string, ItemDef>> = I;
export const itemDef = (id: string): ItemDef | undefined => I[id];
export const itemName = (s: Stack): string => {
  const d = I[s.id];
  if (!d) return s.id;
  if (d.kind === 'tool' || d.id === 'sword') return `${TIER_NAMES[(s.p?.tier ?? 1) - 1] ?? 'Mythic'} ${d.name}`;
  if (s.p?.qname) return `${s.p.qname} ${d.name}`;
  return d.name;
};
export const TIER_NAMES = ['Wooden', 'Copper', 'Iron', 'Silver', 'Crystal', 'Mithril', 'Adamant', 'Voidsteel'] as const;

/** Equal stacks can merge: same id and identical unique properties (or none). */
export function sameStack(a: Stack, b: Stack): boolean {
  if (a.id !== b.id) return false;
  const pa = a.p,
    pb = b.p;
  if (!pa && !pb) return true;
  return JSON.stringify(pa ?? {}) === JSON.stringify(pb ?? {});
}
const maxStack = (id: string, p?: Props) => (p && Object.keys(p).length ? 1 : (I[id]?.stack ?? 99));

export type Inventory = Slot[];
export const emptyInventory = (): Inventory => Array.from({ length: INV_SIZE }, () => null);
export const cloneStack = (s: Stack): Stack => ({ id: s.id, n: s.n, ...(s.p ? { p: { ...s.p } } : {}) });

/** Space check without mutating. */
export function canAdd(inv: Inventory, s: Stack): boolean {
  let left = s.n;
  const max = maxStack(s.id, s.p);
  for (const slot of inv) {
    if (!slot) left -= max;
    else if (sameStack(slot, s) && max > 1) left -= max - slot.n;
    if (left <= 0) return true;
  }
  return left <= 0;
}

/** Adds to the first matching stacks then empty slots. Returns the number that did not fit. */
export function addStack(inv: Inventory, s: Stack): number {
  let left = s.n;
  const max = maxStack(s.id, s.p);
  if (max > 1) {
    for (const slot of inv) {
      if (left <= 0) break;
      if (slot && sameStack(slot, s) && slot.n < max) {
        const m = Math.min(max - slot.n, left);
        slot.n += m;
        left -= m;
      }
    }
  }
  for (let i = 0; i < inv.length && left > 0; i++) {
    if (inv[i]) continue;
    const m = Math.min(max, left);
    inv[i] = { id: s.id, n: m, ...(s.p ? { p: { ...s.p } } : {}) };
    left -= m;
  }
  return left;
}

export function countItem(inv: Inventory, id: string): number {
  let n = 0;
  for (const s of inv) if (s && s.id === id) n += s.n;
  return n;
}

/** Removes `n` of `id` (non-unique first). Returns false (and changes nothing) if not enough. */
export function removeItem(inv: Inventory, id: string, n: number): boolean {
  if (countItem(inv, id) < n) return false;
  let left = n;
  const order = inv
    .map((s, i) => [s, i] as const)
    .filter(([s]) => s && s.id === id)
    .sort((a, b) => (a[0]!.p ? 1 : 0) - (b[0]!.p ? 1 : 0) || a[0]!.n - b[0]!.n);
  for (const [s, i] of order) {
    const m = Math.min(left, s!.n);
    s!.n -= m;
    left -= m;
    if (s!.n <= 0) inv[i] = null;
    if (left <= 0) break;
  }
  return true;
}

/** Drag-and-drop semantics: merge, otherwise swap. */
export function moveSlot(inv: Inventory, from: number, to: number): boolean {
  if (from === to || from < 0 || to < 0 || from >= inv.length || to >= inv.length) return false;
  const a = inv[from],
    b = inv[to];
  if (!a) return false;
  if (b && sameStack(a, b) && maxStack(a.id, a.p) > 1) {
    const m = Math.min(maxStack(a.id, a.p) - b.n, a.n);
    b.n += m;
    a.n -= m;
    if (a.n <= 0) inv[from] = null;
    return true;
  }
  inv[from] = b;
  inv[to] = a;
  return true;
}

export function validInventory(v: unknown): Inventory {
  const out = emptyInventory();
  if (!Array.isArray(v)) return out;
  for (let i = 0; i < Math.min(INV_SIZE, v.length); i++) {
    const s = v[i] as Stack | null;
    if (s && typeof s.id === 'string' && I[s.id] && Number.isInteger(s.n) && s.n > 0)
      out[i] = { id: s.id, n: Math.min(s.n, maxStack(s.id, s.p)), ...(s.p ? { p: s.p } : {}) };
  }
  return out;
}

/** The authoritative level gate for an equipment item. */
export function equipmentLevel(id: string): number {
  const d = ITEMS[id];
  return d?.weapon ? WEAPONS[d.weapon].level : d?.armor ? (SET_BY_ID[d.armor.set]?.level ?? 1) : (d?.gear?.level ?? 1);
}
/** Forged swords contribute only the strongest bonus in the quick-bar, including when a Focus is equipped. */
export const quickbarAttack = (inv: Inventory): number =>
  inv.slice(0, HOTBAR).reduce((best, s) => (s?.id === 'sword' ? Math.max(best, s.p?.atk ?? 0) : best), 0);

def(
  'deep_sigil',
  'Deep Sigil',
  'misc',
  350,
  'orb',
  C.q4,
  C.e6,
  'Use at a surveyed Undercroft arena to call the Hollow Bellkeeper. Level 12.',
  { special: 'summon', stack: 5 },
);

def(
  'storm_beacon',
  'Storm Beacon',
  'misc',
  650,
  'orb',
  C.w3,
  C.q7,
  'Calls Veyr, the Stormbound Colossus on open surface ground far from settlements. Level 22.',
  { special: 'summon', stack: 5 },
);
def(
  'storm_heart',
  'Storm Heart',
  'material',
  950,
  'gem',
  C.w2,
  C.q7,
  'A thunderous crystal core. Forge a Stormglass Signet at a jeweler.',
);
def(
  'stormglass_signet',
  'Stormglass Signet',
  'ring',
  1400,
  'ring',
  C.w3,
  C.q7,
  'A crystal signet forged from Veyr’s heart. Grants attack when crafted.',
  { tags: ['atk'] },
);

// ── data-driven catalog (shared/src/catalog): the content waves, merged last so ids never shadow the hand-written ones
for (const d of catalogItems()) {
  if (I[d.id]) throw new Error(`catalog item ${d.id} duplicates a built-in item`);
  I[d.id] = d;
}

// Legendary rites share real crafting and inventory rules; no new currency/save system.
def(
  'wild_essence',
  'Wild Essence',
  'misc',
  90,
  'orb',
  C.g3,
  C.q6,
  'Rare creature essence used to prepare ancient rites.',
  { stack: 99, rarity: 3 },
);
for (const [i, r] of ANCIENT_RITES.entries()) {
  def(
    r.item,
    `${r.name.split(',')[0]} Rite`,
    'misc',
    800 + i * 200,
    'orb',
    C.q2,
    C.e6,
    `Calls ${r.name} in ${r.where === 'sea' ? 'deep open water from a boat' : r.where === 'cave' ? 'a surveyed Undercroft arena' : `the ${r.where} wilds`}. Level ${r.level}; bring a party.`,
    { special: 'summon', stack: 5, rarity: 4 },
  );
  def(r.trophy, `${r.name.split(',')[0]} Relic`, 'misc', 1200 + i * 300, 'orb', C.e3, C.e7, r.loot, {
    stack: 20,
    rarity: 5,
  });
}
