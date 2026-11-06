import { preparedSprite } from './prepared-sprite';
import catalog from './reference-trees.json';
import type { ObjSprite } from './objects';
export type ReferenceTree = keyof typeof catalog.frames;
/** Decodes the prepared, palette-indexed sprite once when seasonal object art is built. */
export function referenceTree(name: ReferenceTree): ObjSprite {
  return preparedSprite(catalog.frames[name]);
}
export function referenceForest(season: number): ObjSprite[] {
  const names: ReferenceTree[] =
    season === 3
      ? ['bare', 'bare', 'bare', 'bare', 'snow_spruce', 'snow_spruce']
      : season === 2
        ? ['maple', 'red_oak', 'maple', 'red_oak', 'spruce', 'pine']
        : ['oak', 'birch', 'oak', 'birch', 'spruce', 'pine'];
  return names.map(referenceTree);
}
