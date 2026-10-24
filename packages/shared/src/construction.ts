import { T } from './tiles';
import type { WorldObj } from './objects';

/** Structural pieces share a cell; furnishings continue to occupy the ordinary object layer. */
export const BUILD_PIECES = {
  timber_floor: { name: 'Timber Floor', layer: 'floor', material: 'timber', cost: [['wood', 2]] },
  stone_floor: { name: 'Flagstone Floor', layer: 'floor', material: 'stone', cost: [['stone', 3]] },
  timber_wall: { name: 'Timber Wall', layer: 'wall', material: 'timber', cost: [['wood', 3], ['fiber', 1]] },
  stone_wall: { name: 'Stone Wall', layer: 'wall', material: 'stone', cost: [['stone', 5]] },
  timber_door: { name: 'Timber Door', layer: 'wall', material: 'timber', cost: [['wood', 4]] },
  shingle_roof: { name: 'Slate Roof', layer: 'roof', material: 'slate', cost: [['stone', 2], ['wood', 1]] },
  thatch_roof: { name: 'Thatched Roof', layer: 'roof', material: 'thatch', cost: [['fiber', 3], ['wood', 1]] },
  timber_stairs: { name: 'Timber Stairs', layer: 'stairs', material: 'timber', cost: [['wood', 10], ['stone', 2]] },
} as const;
export type BuildPiece = keyof typeof BUILD_PIECES;
export type BuildTurn = 0 | 1 | 2 | 3;
export interface BuildData extends Record<string, unknown> {
  floor?: 'timber_floor' | 'stone_floor';
  wall?: 'timber_wall' | 'stone_wall' | 'timber_door';
  roof?: 'shingle_roof' | 'thatch_roof';
  stairs?: 'up' | 'down';
  wallTurn?: BuildTurn; roofTurn?: BuildTurn; stairsTurn?: BuildTurn;
  open?: boolean;
}
export interface BuildCell extends WorldObj { kind: 'structure'; sub: 'cell'; owner: string; data: BuildData }
export const isBuildPiece = (id: string): id is BuildPiece => Object.hasOwn(BUILD_PIECES, id);
export const buildSolid = (d: BuildData): boolean => !!d.wall && !(d.wall === 'timber_door' && d.open);
export const buildTile = (o: WorldObj | undefined): number | undefined => {
  if (!o) return undefined;
  const d = (o.data ?? {}) as BuildData;
  return buildSolid(d) ? T.WALL : d.floor ? T.FLOOR : undefined;
};
export const buildKey = (x: number, y: number) => `${x},${y}`;
/** A bounded upper-floor band leaves caves and ocean instances untouched. */
export const BUILD_WORLD_LIMIT = 10000;
