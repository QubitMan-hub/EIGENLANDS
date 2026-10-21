import { C } from './palette';

/** Ground classes: what the terrain shader blends. Objects sit on top of a ground class. */
export const G = {
  DEEP: 0, WATER: 1, SAND: 2, GRASS: 3, PATH: 4, SOIL: 5, SOIL_WET: 6, FLOOR: 7, WALL: 8,
} as const;

export type ObjKind =
  | 'tree' | 'rock' | 'flowers' | 'tallgrass' | 'bloom' | 'torch' | 'stump';

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
  /** ground class drawn by the terrain shader */
  ground: number;
  /** object sprite drawn on top (y-sorted, casts a shadow) */
  obj: ObjKind | null;
  /** light radius in tiles (0 = none) and palette colour index */
  light: number;
  lightColor: number;
}

const d = (
  id: number, name: string, ground: number, obj: ObjKind | null = null,
  o: { solid?: boolean; breaksTo?: number; light?: number; lightColor?: number } = {},
): TileDef => ({
  id, name, ground, obj, solid: o.solid ?? false, breaksTo: o.breaksTo ?? -1,
  light: o.light ?? 0, lightColor: o.lightColor ?? C.e6,
});

export const TILE_DEFS: TileDef[] = [
  d(T.DEEP_WATER, 'Deep water', G.DEEP, null, { solid: true }),
  d(T.WATER, 'Water', G.WATER, null, { solid: true }),
  d(T.SAND, 'Sand', G.SAND),
  d(T.GRASS, 'Grass', G.GRASS),
  d(T.GRASS_TALL, 'Tall grass', G.GRASS, 'tallgrass'),
  d(T.FLOWERS, 'Flowers', G.GRASS, 'flowers'),
  d(T.TREE, 'Tree', G.GRASS, 'tree', { solid: true, breaksTo: T.STUMP }),
  d(T.ROCK, 'Rock', G.GRASS, 'rock', { solid: true, breaksTo: T.GRASS }),
  d(T.SHIMMER, 'Phase bloom', G.GRASS, 'bloom', { light: 2.2, lightColor: C.q7 }),
  d(T.PATH, 'Path', G.PATH),
  d(T.STUMP, 'Stump', G.GRASS, 'stump'),
  d(T.TORCH, 'Torch', G.GRASS, 'torch', { solid: true, light: 6, lightColor: C.e5 }),
];

export function isSolid(tile: number): boolean {
  return TILE_DEFS[tile]?.solid ?? true;
}
