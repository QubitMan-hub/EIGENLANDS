import type { Container } from 'pixi.js';
import type { Sun } from './objectviews';

/**
 * Hadamere's buildings: south-wall facades (y-sorted into `entityLayer`) and roofs (drawn above entities in `roofLayer`).
 * A roof fades out while the player stands inside that building. ART WORKER: implement; keep this API.
 */
export class BuildingViews {
  constructor(_seed: number, _shadowLayer: Container, _entityLayer: Container, _roofLayer: Container) {}
  /** tile coords; bounds in tiles */
  update(_now: number, _playerTx: number, _playerTy: number, _reduced: boolean, _sun: Sun, _minX: number, _minY: number, _maxX: number, _maxY: number): void {}
  /** id of the building whose footprint contains the tile, or null */
  insideBuilding(_tx: number, _ty: number): string | null { return null; }
}
