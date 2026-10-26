import type { ItemDef } from '../items';
import type { Recipe } from '../recipes';
import { OUT } from './kit';
import './metals';
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
