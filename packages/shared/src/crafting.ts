/**
 * Crafting vocabulary shared by the catalog, recipes, server and UI: disciplines (what you get better at), rarity,
 * stations (where you craft), item categories (how the UI groups things) and crafted quality. Pure data and functions.
 */
export type Discipline =
  | 'smithing'
  | 'woodworking'
  | 'tailoring'
  | 'leatherworking'
  | 'cooking'
  | 'brewing'
  | 'alchemy'
  | 'enchanting'
  | 'engineering'
  | 'masonry'
  | 'farming'
  | 'magic';

export interface DisciplineDef {
  id: Discipline;
  name: string;
  /** what it makes, for the guide and the empty states */
  makes: string;
  /** one line on what higher levels give */
  perk: string;
}

export const DISCIPLINES: readonly DisciplineDef[] = [
  { id: 'smithing', name: 'Smithing', makes: 'Metal, weapons, plate armour, tools, fittings', perk: 'Finer metalwork' },
  { id: 'woodworking', name: 'Woodworking', makes: 'Planks, handles, bows, furniture, carts', perk: 'Less waste' },
  { id: 'tailoring', name: 'Tailoring', makes: 'Thread, cloth, robes, bags, banners', perk: 'Finer cloth' },
  {
    id: 'leatherworking',
    name: 'Leatherworking',
    makes: 'Leather, light armour, belts, saddles, packs',
    perk: 'Tougher hides',
  },
  {
    id: 'cooking',
    name: 'Cooking',
    makes: 'Meals, bread, preserves, the dishes of six kingdoms',
    perk: 'Richer meals',
  },
  { id: 'brewing', name: 'Brewing', makes: 'Ale, wine, spirits, teas, cordials', perk: 'Stronger brews' },
  { id: 'alchemy', name: 'Alchemy', makes: 'Potions, tonics, reagents, antidotes, dyes', perk: 'Stronger potions' },
  { id: 'enchanting', name: 'Enchanting', makes: 'Gem and rune enchantments for gear', perk: 'Deeper enchantments' },
  {
    id: 'engineering',
    name: 'Engineering',
    makes: 'Lanterns, traps, gears, irrigation, crossbows',
    perk: 'Cleverer devices',
  },
  { id: 'masonry', name: 'Masonry', makes: 'Cut stone, bricks, tiles, glass, statues', perk: 'Sturdier stone' },
  {
    id: 'farming',
    name: 'Farming',
    makes: 'Fertilizer, feed, seeds, tools of the field, dairy',
    perk: 'Better yields',
  },
  { id: 'magic', name: 'Magical crafting', makes: 'Runes, scrolls, charged crystals, artifacts', perk: 'Truer magic' },
];
export const DISC_BY_ID: Readonly<Record<Discipline, DisciplineDef>> = Object.fromEntries(
  DISCIPLINES.map((d) => [d.id, d]),
) as Record<Discipline, DisciplineDef>;
export const DISCIPLINE_IDS: readonly Discipline[] = DISCIPLINES.map((d) => d.id);

export const MAX_DISC = 40;
export type DiscXp = Record<Discipline, number>;
export const emptyDisc = (): DiscXp => Object.fromEntries(DISCIPLINE_IDS.map((d) => [d, 0])) as DiscXp;
/** Total XP needed to reach `level` (level 1 = 0). A steady climb: level 10 at ~1.6k, level 20 at ~5k, level 40 at ~18k. */
export const xpForDiscLevel = (level: number): number => (level <= 1 ? 0 : Math.round(30 * Math.pow(level - 1, 1.75)));
export function discLevel(xp: number): number {
  let l = 1;
  while (l < MAX_DISC && xp >= xpForDiscLevel(l + 1)) l++;
  return l;
}
export function validDisc(v: unknown): DiscXp {
  const out = emptyDisc();
  if (v && typeof v === 'object')
    for (const k of DISCIPLINE_IDS) {
      const n = (v as Record<string, unknown>)[k];
      if (typeof n === 'number' && Number.isFinite(n) && n >= 0) out[k] = Math.min(1e7, Math.floor(n));
    }
  return out;
}

// ───────────────────────── rarity ─────────────────────────

export const RARITY_NAMES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'] as const;
/** UI colours (readable on the dark bronze panels). */
export const RARITY_COLORS = ['#c3c9b9', '#7fd96b', '#5aa0d8', '#b98ad6', '#f2c230', '#ff6b4a'] as const;
/** The same rarity ramp as ink on parchment (journal, tooltips, stations): every shade passes 4.5:1 on the page. */
export const RARITY_INK = ['#3d2f20', '#245019', '#1a4a7a', '#5a2a7a', '#664400', '#8a2414'] as const;
export type Rarity = 0 | 1 | 2 | 3 | 4 | 5;
/** Price multiplier of a rarity over the same item at Common. */
export const RARITY_VALUE = [1, 1.6, 2.6, 4.5, 9, 18] as const;
/** Stat multiplier of gear made of / at a rarity. */
export const RARITY_POWER = [1, 1.1, 1.22, 1.38, 1.6, 1.9] as const;

// ───────────────────────── stations ─────────────────────────

export type StationId =
  | 'hand'
  | 'workbench'
  | 'furnace'
  | 'forge'
  | 'cooking_pot'
  | 'alchemy'
  | 'loom'
  | 'jeweler'
  | 'carpenter'
  | 'tannery'
  | 'masonry'
  | 'oven'
  | 'brewery'
  | 'enchanting'
  | 'engineering'
  | 'runeforge'
  | 'dairy';

export interface StationDef {
  id: StationId;
  name: string;
  /** world-object subtype players place (town stations use the same subtype) */
  sub: string;
  /** disciplines whose recipes it hosts, first is the default */
  disc: Discipline[];
  blurb: string;
}
export const STATIONS: readonly StationDef[] = [
  {
    id: 'hand',
    name: 'Field crafting',
    sub: '',
    disc: ['woodworking', 'farming', 'cooking'],
    blurb: 'Simple work anywhere.',
  },
  {
    id: 'workbench',
    name: 'Workbench',
    sub: 'workbench',
    disc: ['woodworking', 'engineering'],
    blurb: 'Tools, stations and general work.',
  },
  { id: 'furnace', name: 'Furnace', sub: 'furnace', disc: ['smithing'], blurb: 'Smelts ore into ingots and alloys.' },
  {
    id: 'forge',
    name: 'Anvil & Forge',
    sub: 'forge',
    disc: ['smithing'],
    blurb: 'Weapons, plate and tools; interference forging.',
  },
  {
    id: 'cooking_pot',
    name: 'Cooking Pot',
    sub: 'cooking_pot',
    disc: ['cooking'],
    blurb: 'Stews, soups and boiled dishes.',
  },
  { id: 'alchemy', name: 'Alchemy Table', sub: 'alchemy', disc: ['alchemy'], blurb: 'Potions, tonics and reagents.' },
  { id: 'loom', name: 'Loom', sub: 'loom', disc: ['tailoring'], blurb: 'Thread, cloth and clothing.' },
  {
    id: 'jeweler',
    name: 'Jeweler Bench',
    sub: 'jeweler',
    disc: ['smithing', 'enchanting'],
    blurb: 'Gems, rings and amulets.',
  },
  {
    id: 'carpenter',
    name: 'Carpenter Bench',
    sub: 'carpenter',
    disc: ['woodworking'],
    blurb: 'Furniture, bows and building parts.',
  },
  {
    id: 'tannery',
    name: 'Tanning Rack',
    sub: 'tannery',
    disc: ['leatherworking'],
    blurb: 'Cures hides and cuts leather armour.',
  },
  { id: 'masonry', name: 'Stonecutter', sub: 'masonry', disc: ['masonry'], blurb: 'Cut stone, brick, tile and glass.' },
  { id: 'oven', name: 'Stone Oven', sub: 'oven', disc: ['cooking'], blurb: 'Bread, pies, roasts and pastries.' },
  { id: 'brewery', name: 'Brewing Barrel', sub: 'brewery', disc: ['brewing'], blurb: 'Ale, wine, spirits and teas.' },
  {
    id: 'enchanting',
    name: 'Enchanting Table',
    sub: 'enchanting',
    disc: ['enchanting'],
    blurb: 'Binds gems and runes into gear.',
  },
  {
    id: 'engineering',
    name: 'Engineer’s Bench',
    sub: 'engineering',
    disc: ['engineering'],
    blurb: 'Gears, lanterns, traps and irrigation.',
  },
  { id: 'runeforge', name: 'Rune Altar', sub: 'runeforge', disc: ['magic'], blurb: 'Runes, scrolls and artifacts.' },
  { id: 'dairy', name: 'Dairy & Press', sub: 'dairy', disc: ['farming'], blurb: 'Cheese, butter, oil and preserves.' },
];
export const STATION_NAMES: Readonly<Record<StationId, string>> = Object.fromEntries(
  STATIONS.map((s) => [s.id, s.name]),
) as Record<StationId, string>;
/** Placeable-object subtype -> station id (town stations use the same ids). */
export const STATION_SUBS: Readonly<Record<string, StationId>> = Object.fromEntries(
  STATIONS.filter((s) => s.sub).map((s) => [s.sub, s.id]),
);
export const STATION_BY_ID: Readonly<Record<StationId, StationDef>> = Object.fromEntries(
  STATIONS.map((s) => [s.id, s]),
) as Record<StationId, StationDef>;
export const STATION_IDS: readonly StationId[] = STATIONS.map((s) => s.id);
export const isStationId = (v: unknown): v is StationId => typeof v === 'string' && Object.hasOwn(STATION_BY_ID, v);

// ───────────────────────── categories ─────────────────────────

/**
 * How the crafting book and the pack group items. Each is a gameplay role, not decoration: raw things you gather,
 * parts you make, things you use or wear, things you place.
 */
export const ITEM_CATS = [
  'ore',
  'metal',
  'gem',
  'crystal',
  'wood',
  'stone',
  'fiber',
  'textile',
  'hide',
  'bone',
  'monster',
  'reagent',
  'magical',
  'component',
  'ingredient',
  'spice',
  'fruit',
  'vegetable',
  'meat',
  'fish',
  'grain',
  'dairy',
  'sweet',
  'dish',
  'drink',
  'potion',
  'scroll',
  'rune',
  'enchant',
  'weapon',
  'armor',
  'shield',
  'tool',
  'accessory',
  'pack',
  'light',
  'building',
  'furniture',
  'decor',
  'station',
  'farm',
  'animal',
  'seed',
  'crop',
  'explore',
  'mount',
  'artifact',
  'collectible',
  'misc',
] as const;
export type ItemCat = (typeof ITEM_CATS)[number];
export const CAT_GROUPS: ReadonlyArray<{ id: string; name: string; cats: readonly ItemCat[] }> = [
  {
    id: 'materials',
    name: 'Materials',
    cats: [
      'ore',
      'metal',
      'gem',
      'crystal',
      'wood',
      'stone',
      'fiber',
      'textile',
      'hide',
      'bone',
      'monster',
      'reagent',
      'magical',
      'component',
    ],
  },
  {
    id: 'food',
    name: 'Food & drink',
    cats: ['ingredient', 'spice', 'fruit', 'vegetable', 'meat', 'fish', 'grain', 'dairy', 'sweet', 'dish', 'drink'],
  },
  { id: 'magic', name: 'Potions & magic', cats: ['potion', 'scroll', 'rune', 'enchant', 'artifact'] },
  { id: 'gear', name: 'Weapons & armour', cats: ['weapon', 'armor', 'shield', 'accessory'] },
  { id: 'tools', name: 'Tools & travel', cats: ['tool', 'pack', 'light', 'explore', 'mount'] },
  { id: 'home', name: 'Building & home', cats: ['building', 'furniture', 'decor', 'station'] },
  { id: 'farm', name: 'Farm & animals', cats: ['farm', 'animal', 'seed', 'crop'] },
  { id: 'other', name: 'Collectibles', cats: ['collectible', 'misc'] },
];

// ───────────────────────── crafted quality ─────────────────────────

export const CRAFT_QUALITY = ['Crude', 'Standard', 'Fine', 'Superior', 'Masterwork'] as const;
export const QUALITY_POWER = [0.9, 1, 1.08, 1.18, 1.32] as const;
/**
 * Quality tier 0..4 of a crafted item: the crafter's discipline level against the recipe's level, the rarity of what it
 * is made of, and a roll. A level well above the recipe's makes Fine, Superior and Masterwork likely.
 */
export function craftQuality(discLv: number, recipeLv: number, rarity: number, luck: number, roll: number): number {
  const over = discLv - recipeLv;
  const score = 1.0 + Math.max(-2, Math.min(10, over)) * 0.13 + luck * 0.025 - rarity * 0.05 + (roll - 0.5) * 0.9;
  return score < 0.6 ? 0 : score < 1.35 ? 1 : score < 2.0 ? 2 : score < 2.55 ? 3 : 4;
}
