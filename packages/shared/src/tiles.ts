import { C } from './palette';

/** Ground classes: what the terrain shader blends. Objects sit on top of a ground class. */
export const G = {
  DEEP: 0, WATER: 1, SAND: 2, GRASS: 3, PATH: 4, SOIL: 5, SOIL_WET: 6, FLOOR: 7, WALL: 8, CAVE: 9, CAVE_WALL: 10,
} as const;

export type ObjKind =
  | 'tree' | 'rock' | 'flowers' | 'tallgrass' | 'bloom' | 'torch' | 'stump'
  | 'ore_copper' | 'ore_iron' | 'ore_silver' | 'ore_gold' | 'crystal' | 'forage' | 'fence';

export const T = {
  DEEP_WATER: 0, WATER: 1, SAND: 2, GRASS: 3, GRASS_TALL: 4, FLOWERS: 5,
  TREE: 6, ROCK: 7, SHIMMER: 8, PATH: 9, STUMP: 10, TORCH: 11,
  TILLED: 12, TILLED_WET: 13, ORE_COPPER: 14, ORE_IRON: 15, ORE_SILVER: 16, ORE_GOLD: 17, CRYSTAL: 18,
  FORAGE: 19, FLOOR: 20, WALL: 21, FACE: 22, DOOR: 23, FENCE: 24, CAVE_FLOOR: 25, CAVE_WALL: 26,
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
  d(T.TILLED, 'Tilled soil', G.SOIL),
  d(T.TILLED_WET, 'Watered soil', G.SOIL_WET),
  d(T.ORE_COPPER, 'Copper outcrop', G.GRASS, 'ore_copper', { solid: true, breaksTo: T.GRASS }),
  d(T.ORE_IRON, 'Iron outcrop', G.GRASS, 'ore_iron', { solid: true, breaksTo: T.GRASS }),
  d(T.ORE_SILVER, 'Silver outcrop', G.GRASS, 'ore_silver', { solid: true, breaksTo: T.GRASS, light: 1.2, lightColor: C.w6 }),
  d(T.ORE_GOLD, 'Gold outcrop', G.GRASS, 'ore_gold', { solid: true, breaksTo: T.GRASS, light: 1.2, lightColor: C.e6 }),
  d(T.CRYSTAL, 'Qubit crystal', G.GRASS, 'crystal', { solid: true, breaksTo: T.GRASS, light: 3, lightColor: C.q5 }),
  d(T.FORAGE, 'Forageable', G.GRASS, 'forage'),
  d(T.FLOOR, 'Floor', G.FLOOR),
  d(T.WALL, 'Wall', G.WALL, null, { solid: true }),
  d(T.FACE, 'Wall', G.WALL, null, { solid: true }),
  d(T.DOOR, 'Doorway', G.FLOOR),
  d(T.FENCE, 'Fence', G.GRASS, 'fence', { solid: true, breaksTo: T.GRASS }),
  d(T.CAVE_FLOOR, 'Cave floor', G.CAVE),
  d(T.CAVE_WALL, 'Cave rock', G.CAVE_WALL, null, { solid: true, breaksTo: T.CAVE_FLOOR }),
];

export function isSolid(tile: number): boolean {
  return TILE_DEFS[tile]?.solid ?? true;
}
