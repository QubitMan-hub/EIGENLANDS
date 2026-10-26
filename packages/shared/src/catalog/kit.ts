import { C } from '../palette';
import type { ItemCat, Rarity, StationId, Discipline } from '../crafting';
import { STATION_BY_ID } from '../crafting';
import type { Glyph, ItemDef, ItemKind } from '../items';
import type { Recipe } from '../recipes';
import type { FishSpec, Source } from './types';

/**
 * Authoring kit for the catalog: terse builders that fill one registry. Content files are plain data run through
 * these, so adding a hundred items is a table, and every item/recipe goes through one set of defaults and checks.
 */
export const COL = C;

export interface Registry {
  items: Map<string, ItemDef>;
  recipes: Recipe[];
  sources: Array<{ item: string; src: Source }>;
}
export const OUT: Registry = { items: new Map(), recipes: [], sources: [] };

const KIND_OF: Partial<Record<ItemCat, ItemKind>> = {
  weapon: 'weapon',
  armor: 'armor',
  shield: 'gear',
  accessory: 'gear',
  pack: 'gear',
  light: 'gear',
  tool: 'tool',
  potion: 'potion',
  scroll: 'scroll',
  rune: 'rune',
  seed: 'seed',
  crop: 'crop',
  fish: 'fish',
  dish: 'food',
  drink: 'food',
  building: 'placeable',
  furniture: 'placeable',
  decor: 'placeable',
  station: 'placeable',
  animal: 'animal',
};

export interface ItemOpts extends Partial<Omit<ItemDef, 'id' | 'name' | 'icon' | 'desc' | 'value'>> {
  /** base value in coins */
  v: number;
  g: Glyph;
  a: number;
  b: number;
  d: string;
  kind?: ItemKind;
  /** how it is obtained when it is not crafted (the catalog test requires a source or a recipe) */
  src?: Source[];
  /** no other item or recipe needs this (an end product); tells the test it is a deliberate leaf */
  leaf?: boolean;
}

export function item(id: string, name: string, cat: ItemCat, o: ItemOpts): ItemDef {
  if (OUT.items.has(id)) throw new Error(`catalog: duplicate item ${id}`);
  const { v, g, a, b, d, kind, src, leaf: _leaf, ...rest } = o;
  void _leaf;
  const k: ItemKind = kind ?? KIND_OF[cat] ?? 'material';
  const def: ItemDef = {
    id,
    name,
    kind: k,
    stack: k === 'tool' || k === 'weapon' || k === 'armor' || k === 'gear' ? 1 : 99,
    value: Math.max(0, Math.round(v)),
    desc: d,
    icon: { g, a, b },
    cat,
    rarity: 0,
    ...rest,
  };
  OUT.items.set(id, def);
  for (const s of src ?? []) OUT.sources.push({ item: id, src: s });
  return def;
}

export interface RecOpts {
  lvl?: number;
  disc?: Discipline;
  xp?: number;
  learn?: Recipe['learn'];
  hint?: string;
  stage?: 1 | 2 | 3;
  realm?: string;
  cat?: ItemCat;
  quality?: boolean;
  gear?: boolean;
  /** a tool item that must be in the pack */
  tool?: string;
  p?: Record<string, unknown>;
  /** recipe id (defaults to the output's id, with a suffix for a second recipe of the same output) */
  id?: string;
}

/** a recipe: inputs [[id, n], ...] -> out [id, n] */
export function rec(
  station: StationId,
  inputs: Array<[string, number]>,
  out: [string, number],
  o: RecOpts = {},
): Recipe {
  const lvl = o.lvl ?? 1;
  let id = o.id ?? out[0];
  if (OUT.recipes.some((r) => r.id === id)) {
    let k = 2;
    while (OUT.recipes.some((r) => r.id === `${id}_${k}`)) k++;
    id = `${id}_${k}`;
  }
  const r: Recipe = {
    id,
    station,
    inputs: inputs.map(([i, n]) => ({ id: i, n })),
    out: { id: out[0], n: out[1], ...(o.p ? { p: o.p } : {}) },
    xp: o.xp ?? Math.max(2, Math.round(2 + lvl * 1.6)),
    learn: o.learn ?? (lvl <= 1 ? 'start' : 'level'),
    hint: o.hint ?? '',
    disc: o.disc ?? STATION_BY_ID[station].disc[0]!,
    lvl,
    ...(o.stage ? { stage: o.stage } : {}),
    ...(o.realm ? { realm: o.realm } : {}),
    ...(o.cat ? { cat: o.cat } : {}),
    ...(o.quality ? { quality: true } : {}),
    ...(o.gear ? { gear: true } : {}),
    ...(o.tool ? { tool: o.tool } : {}),
  };
  OUT.recipes.push(r);
  return r;
}

export const src = {
  node: (
    tile: number,
    min: number,
    max: number,
    chance: number,
    tier = 1,
    extra: { realm?: string; cave?: string } = {},
  ): Source => ({
    k: 'node',
    tile,
    min,
    max,
    chance,
    tier,
    ...extra,
  }),
  mob: (
    family: string,
    chance: number,
    min = 1,
    max = 1,
    extra: { minLevel?: number; realm?: string } = {},
  ): Source => ({
    k: 'mob',
    family,
    chance,
    min,
    max,
    ...extra,
  }),
  forage: (seasons: number[], weight = 1, realm?: string): Source => ({
    k: 'forage',
    seasons,
    weight,
    ...(realm ? { realm } : {}),
  }),
  fish: (def: FishSpec): Source => ({ k: 'fish', def }),
  shop: (role: string, markup = 1.3, realm?: string, seasons?: number[]): Source => ({
    k: 'shop',
    role,
    markup,
    ...(realm ? { realm } : {}),
    ...(seasons ? { seasons } : {}),
  }),
  vault: (table: string, weight = 1): Source => ({ k: 'vault', table, weight }),
  animal: (kind: string): Source => ({ k: 'animal', kind }),
  crop: (): Source => ({ k: 'crop' }),
  boss: (boss: string, chance = 1): Source => ({ k: 'boss', boss, chance }),
  quest: (): Source => ({ k: 'quest' }),
};

export type { Rarity };
