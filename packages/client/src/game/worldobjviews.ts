import type { Container } from 'pixi.js';
import type { ChunkStore, WorldObj } from '@eigenlands/shared';
import type { SeasonIdx } from '../art/objects';
import type { Sun } from './objectviews';

export interface TileLight { x: number; y: number; radius: number; color: number; intensity: number }

/**
 * Sprites for world objects (crops by growth stage, stations, chests, shelters, furniture, signs, town deco).
 * ART WORKER: implement for real (y-sorted into `layer`, shadows into `shadowLayer`); keep this API.
 */
export class WorldObjViews {
  constructor(_store: ChunkStore, _shadowLayer: Container, _layer: Container) {}
  setSeason(_season: SeasonIdx): void {}
  /** create or replace the sprite for one object (e.g. a crop that advanced a stage) */
  upsert(_o: WorldObj): void {}
  remove(_x: number, _y: number): void {}
  /** (re)create sprites for every object in `store.objects` that lies in chunk (cx,cy) */
  buildChunk(_cx: number, _cy: number): void {}
  retain(_keep: Set<string>): void {}
  /** per frame: idle animation (flames, shimmer), sway, sun shadows. Bounds are in tiles. */
  update(_now: number, _sun: Sun, _reduced: boolean, _minX: number, _minY: number, _maxX: number, _maxY: number): void {}
  /** light sources among the visible objects; x/y are tile-space centres */
  lights(_minX: number, _minY: number, _maxX: number, _maxY: number): TileLight[] { return []; }
}
