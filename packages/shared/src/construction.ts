import { T } from './tiles';
import type { WorldObj } from './objects';

/** Structural pieces share a cell; furnishings continue to occupy the ordinary object layer. */
export const BUILD_PIECES = {
  timber_floor: { name: 'Timber Floor', layer: 'floor', material: 'timber', cost: [['wood', 2]] },
  stone_floor: { name: 'Flagstone Floor', layer: 'floor', material: 'stone', cost: [['stone', 3]] },
  timber_wall: {
    name: 'Timber Wall',
    layer: 'wall',
    material: 'timber',
    cost: [
      ['wood', 3],
      ['fiber', 1],
    ],
  },
  stone_wall: { name: 'Stone Wall', layer: 'wall', material: 'stone', cost: [['stone', 5]] },
  timber_door: { name: 'Timber Door', layer: 'wall', material: 'timber', door: true, cost: [['wood', 4]] },
  shingle_roof: {
    name: 'Slate Roof',
    layer: 'roof',
    material: 'slate',
    cost: [
      ['stone', 2],
      ['wood', 1],
    ],
  },
  thatch_roof: {
    name: 'Thatched Roof',
    layer: 'roof',
    material: 'thatch',
    cost: [
      ['fiber', 3],
      ['wood', 1],
    ],
  },
  // ── catalog materials: brick, marble, sandstone, granite, plaster, log, glass, tile and copper
  oak_floor: {
    name: 'Oak Parquet Floor',
    layer: 'floor',
    material: 'oak',
    cost: [['oak_plank', 2]],
    station: 'carpenter',
    lvl: 3,
  },
  brick_floor: {
    name: 'Brick Floor',
    layer: 'floor',
    material: 'brick',
    cost: [['clay_brick', 3]],
    station: 'masonry',
    lvl: 2,
  },
  tile_floor: {
    name: 'Terracotta Tile Floor',
    layer: 'floor',
    material: 'tile',
    cost: [['roof_tile', 3]],
    station: 'masonry',
    lvl: 3,
  },
  marble_floor: {
    name: 'Marble Floor',
    layer: 'floor',
    material: 'marble',
    cost: [['marble_slab', 2]],
    station: 'masonry',
    lvl: 7,
  },
  sandstone_floor: {
    name: 'Sandstone Floor',
    layer: 'floor',
    material: 'sandstone',
    cost: [['sandstone_block', 2]],
    station: 'masonry',
    lvl: 2,
  },
  granite_floor: {
    name: 'Granite Floor',
    layer: 'floor',
    material: 'granite',
    cost: [['granite_block', 2]],
    station: 'masonry',
    lvl: 4,
  },
  brick_wall: {
    name: 'Brick Wall',
    layer: 'wall',
    material: 'brick',
    cost: [
      ['clay_brick', 5],
      ['mortar', 1],
    ],
    station: 'masonry',
    lvl: 3,
  },
  plaster_wall: {
    name: 'Plastered Wall',
    layer: 'wall',
    material: 'plaster',
    cost: [
      ['limestone_block', 3],
      ['mortar', 1],
      ['wood', 1],
    ],
    station: 'masonry',
    lvl: 4,
  },
  sandstone_wall: {
    name: 'Sandstone Wall',
    layer: 'wall',
    material: 'sandstone',
    cost: [
      ['sandstone_block', 4],
      ['mortar', 1],
    ],
    station: 'masonry',
    lvl: 3,
  },
  granite_wall: {
    name: 'Granite Wall',
    layer: 'wall',
    material: 'granite',
    cost: [
      ['granite_block', 4],
      ['mortar', 1],
    ],
    station: 'masonry',
    lvl: 5,
  },
  marble_wall: {
    name: 'Marble Wall',
    layer: 'wall',
    material: 'marble',
    cost: [
      ['marble_slab', 4],
      ['mortar', 1],
    ],
    station: 'masonry',
    lvl: 8,
  },
  log_wall: {
    name: 'Log Wall',
    layer: 'wall',
    material: 'log',
    cost: [
      ['pine_log', 4],
      ['resin', 1],
    ],
    station: 'carpenter',
    lvl: 2,
  },
  window_wall: {
    name: 'Window Wall',
    layer: 'wall',
    material: 'glass',
    cost: [
      ['oak_plank', 2],
      ['glass_pane', 2],
      ['nails', 2],
    ],
    station: 'carpenter',
    lvl: 5,
  },
  oak_door: {
    name: 'Oak Door',
    layer: 'wall',
    material: 'oak',
    door: true,
    cost: [
      ['oak_plank', 4],
      ['nails', 2],
      ['rivets', 2],
    ],
    station: 'carpenter',
    lvl: 3,
  },
  iron_door: {
    name: 'Iron Door',
    layer: 'wall',
    material: 'iron',
    door: true,
    cost: [
      ['iron_plate', 3],
      ['rivets', 6],
    ],
    station: 'forge',
    lvl: 8,
  },
  tile_roof: {
    name: 'Clay Tile Roof',
    layer: 'roof',
    material: 'tile',
    cost: [
      ['roof_tile', 4],
      ['wood', 1],
    ],
    station: 'masonry',
    lvl: 3,
  },
  slate_tile_roof: {
    name: 'Slate Tile Roof',
    layer: 'roof',
    material: 'slate',
    cost: [
      ['slate_tile', 3],
      ['wood', 1],
    ],
    station: 'masonry',
    lvl: 4,
  },
  reed_roof: {
    name: 'Reed Thatch Roof',
    layer: 'roof',
    material: 'thatch',
    cost: [
      ['reed_fiber', 4],
      ['pine_plank', 1],
    ],
    station: 'carpenter',
    lvl: 2,
  },
  copper_roof: {
    name: 'Copper Roof',
    layer: 'roof',
    material: 'copper',
    cost: [
      ['copper_plate', 3],
      ['nails', 2],
    ],
    station: 'forge',
    lvl: 6,
  },
  stone_stairs: {
    name: 'Granite Stairs',
    layer: 'stairs',
    material: 'granite',
    cost: [
      ['granite_block', 8],
      ['mortar', 2],
    ],
    station: 'masonry',
    lvl: 5,
  },
  oak_stairs: {
    name: 'Oak Stairs',
    layer: 'stairs',
    material: 'oak',
    cost: [
      ['oak_plank', 10],
      ['nails', 4],
    ],
    station: 'carpenter',
    lvl: 3,
  },
  timber_stairs: {
    name: 'Timber Stairs',
    layer: 'stairs',
    material: 'timber',
    cost: [
      ['wood', 10],
      ['stone', 2],
    ],
  },
} as const;
export type BuildPiece = keyof typeof BUILD_PIECES;
type Layer = 'floor' | 'wall' | 'roof' | 'stairs';
/** Pieces of one layer (floors, walls ...), for the typed fields of a building cell. */
export type PieceOf<L extends Layer> = {
  [K in BuildPiece]: (typeof BUILD_PIECES)[K]['layer'] extends L ? K : never;
}[BuildPiece];
/** Pieces that open and close. */
export const isDoor = (id: string | undefined): boolean =>
  !!id && isBuildPiece(id) && 'door' in BUILD_PIECES[id] && BUILD_PIECES[id].door === true;
export type BuildTurn = 0 | 1 | 2 | 3;
export interface BuildData extends Record<string, unknown> {
  floor?: PieceOf<'floor'>;
  wall?: PieceOf<'wall'>;
  roof?: PieceOf<'roof'>;
  stairs?: 'up' | 'down';
  wallTurn?: BuildTurn;
  roofTurn?: BuildTurn;
  stairsTurn?: BuildTurn;
  open?: boolean;
}
export interface BuildCell extends WorldObj {
  kind: 'structure';
  sub: 'cell';
  owner: string;
  data: BuildData;
}
export const isBuildPiece = (id: string): id is BuildPiece => Object.hasOwn(BUILD_PIECES, id);
export const buildSolid = (d: BuildData): boolean => !!d.wall && !(isDoor(d.wall) && d.open);
export const buildTile = (o: WorldObj | undefined): number | undefined => {
  if (!o) return undefined;
  const d = (o.data ?? {}) as BuildData;
  return buildSolid(d) ? T.WALL : d.floor ? T.FLOOR : undefined;
};
export const buildKey = (x: number, y: number) => `${x},${y}`;
/** A bounded upper-floor band leaves caves and ocean instances untouched. */
export const BUILD_WORLD_LIMIT = 10000;
