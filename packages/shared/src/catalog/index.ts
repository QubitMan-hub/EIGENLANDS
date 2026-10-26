import type { ItemDef } from '../items';
import type { Recipe } from '../recipes';
import { OUT } from './kit';
import './metals';
import './stone-wood';
import './fibers';
import './gems';
import './alchemy';
import './gear';
import './gear-items';
import './magic';
import './farm';
import './kitchen';
import './dishes';
import './drinks';
import './home';
import './homesteads';
import './legendary';
import type { Source } from './types';

export { OUT };
export * from './types';
export { METALS, METAL_BY_ID } from './metals';

/** Every item the catalog defines (called once by items.ts). */
export const catalogItems = (): ItemDef[] => [...OUT.items.values()];
/** Every recipe the catalog defines (called once by recipes.ts). */
export const catalogRecipes = (): Recipe[] => [...OUT.recipes];
/** Where each catalog item comes from when it is not crafted (the world hooks and the catalog test read this). */
export const catalogSources = (): ReadonlyArray<{ item: string; src: Source }> => OUT.sources;
export { CATALOG_GLYPHS, type CatalogGlyph } from './glyphs';
export { ENCHANTS, ENCHANT_BY_KEY, ENCHANT_TIER_NAMES } from './magic';

/** Groups of enemy kinds a source can name instead of one kind. */
export const MOB_GROUPS: Readonly<Record<string, readonly string[]>> = {
  beast: ['boar', 'wolf', 'badger', 'deer', 'fox', 'rabbit', 'spirit_stag', 'hellhound'],
  cave: ['echo_bat', 'amber_gnawer', 'lantern_hound', 'rime_skitter', 'glasscrawler', 'prism_beetle', 'blind_ram'],
};
export interface MobDrop {
  item: string;
  min: number;
  max: number;
  chance: number;
  minLevel: number;
  realm?: string;
}
let mobIndex: Map<string, MobDrop[]> | null = null;
/** Catalog drops of one enemy kind (its key in ENEMY_DEFS): monster parts, boss trophies. */
export function catalogMobDrops(key: string): readonly MobDrop[] {
  if (!mobIndex) {
    mobIndex = new Map();
    const add = (k: string, d: MobDrop): void => {
      const l = mobIndex!.get(k);
      if (l) l.push(d);
      else mobIndex!.set(k, [d]);
    };
    for (const { item, src } of catalogSources()) {
      if (src.k === 'mob') {
        for (const k of MOB_GROUPS[src.family] ?? [src.family])
          add(k, {
            item,
            min: src.min,
            max: src.max,
            chance: src.chance,
            minLevel: src.minLevel ?? 0,
            ...(src.realm ? { realm: src.realm } : {}),
          });
      } else if (src.k === 'boss')
        add(src.boss, { item, min: 1, max: item === 'dragon_bone' ? 3 : 1, chance: src.chance, minLevel: 0 });
    }
  }
  return mobIndex.get(key) ?? [];
}

/** What a shop of a given role (and kingdom) also stocks from the catalog. Local shops (no realm) sell the plain goods. */
export function catalogShopStock(
  role: string,
  realm?: string,
): Array<{ item: string; markup: number; seasons?: number[] }> {
  const out: Array<{ item: string; markup: number; seasons?: number[] }> = [];
  for (const { item, src } of catalogSources())
    if (src.k === 'shop' && src.role === role && (!src.realm || src.realm === realm))
      out.push({ item, markup: src.markup, ...(src.seasons ? { seasons: src.seasons } : {}) });
  return out;
}
export { PROP_SPECS, PROP_LIGHT, PROP_WARM, type PropShape, type PropSpec, type RampKey } from './home';

/** What a vault of a given theme (cave biome) may also hold from the catalog: scroll, collectibles, gems. */
export function catalogVaultDrops(theme: string): Array<{ item: string; weight: number }> {
  const out: Array<{ item: string; weight: number }> = [];
  for (const { item, src } of catalogSources())
    if (src.k === 'vault' && (src.table === theme || src.table === 'any')) out.push({ item, weight: src.weight });
  return out;
}
export { CROP_ROWS, type CropRow } from './crop-data';
export { PEN_DATA, type PenData } from './pen-data';
