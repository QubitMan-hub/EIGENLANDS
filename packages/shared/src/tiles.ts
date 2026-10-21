import { C } from './palette';

export const T = {
  DEEP_WATER: 0, WATER: 1, SAND: 2, GRASS: 3, GRASS_TALL: 4, FLOWERS: 5,
  TREE: 6, ROCK: 7, SHIMMER: 8, PATH: 9, STUMP: 10, TORCH: 11,
} as const;

export interface TileDef {
  id: number;
  name: string;
  solid: boolean;
  /** tile it becomes when broken, or -1 */
  breaksTo: number;
  animated: boolean;
  /** light radius in tiles (0 = none) and palette colour index */
  light: number;
  lightColor: number;
}

const d = (
  id: number, name: string, solid = false, breaksTo = -1, animated = false, light = 0, lightColor: number = C.e6,
): TileDef => ({ id, name, solid, breaksTo, animated, light, lightColor });

export const TILE_DEFS: TileDef[] = [
  d(T.DEEP_WATER, 'Deep water', true, -1, true),
  d(T.WATER, 'Water', true, -1, true),
  d(T.SAND, 'Sand'),
  d(T.GRASS, 'Grass'),
  d(T.GRASS_TALL, 'Tall grass'),
  d(T.FLOWERS, 'Flowers'),
  d(T.TREE, 'Tree', true, T.STUMP),
  d(T.ROCK, 'Rock', true, T.GRASS),
  d(T.SHIMMER, 'Phase bloom', false, -1, true, 2.5, C.q7),
  d(T.PATH, 'Path'),
  d(T.STUMP, 'Stump'),
  d(T.TORCH, 'Torch', true, -1, true, 6, C.e5),
];

export function isSolid(tile: number): boolean {
  return TILE_DEFS[tile]?.solid ?? true;
}
