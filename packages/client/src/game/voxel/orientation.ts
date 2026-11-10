import type { Object3D } from 'three';

/** Authored creatures use +X forward; live actors and imported rigs use +Z forward. */
export const CREATURE_YAW = -Math.PI / 2;

/** Match Prop.uv exactly: its second wall layout exchanges u/v while retaining the inward-facing side. */
export function orientWallProp(root: Object3D, facing: unknown): void {
  root.rotation.y = facing === 'se' ? Math.PI / 2 : 0;
  root.scale.x = facing === 'se' ? -1 : 1;
}

import { propFacing, diningSurface, T, type WorldObj, type ChunkStore } from '@eigenlands/shared';

/** Reuse the authoritative wall/footprint convention; chairs face their neighboring dining surface. */
export function objectLayout(store: Pick<ChunkStore, 'getTile' | 'objectAt'>, o: WorldObj) {
  const facing =
    o.data?.facing === 'se' || o.data?.facing === 'sw'
      ? o.data.facing
      : propFacing(
          (x, y) => {
            const tile = store.getTile(x, y);
            return tile === T.WALL || tile === T.FACE;
          },
          o.x,
          o.y,
        );
  let seatTurn: number | undefined;
  if (o.sub === 'chair') {
    if (Number.isInteger(o.data?.seatTurn) && Number(o.data?.seatTurn) >= 0 && Number(o.data?.seatTurn) < 4)
      seatTurn = Number(o.data?.seatTurn);
    else {
      const dirs = [
        [0, 1],
        [-1, 0],
        [0, -1],
        [1, 0],
      ];
      const index = dirs.findIndex(([dx, dy]) => {
        const n = store.objectAt(o.x + dx, o.y + dy);
        return !!n && diningSurface(n.sub);
      });
      if (index >= 0) seatTurn = index;
    }
  }
  return { facing, seatTurn };
}
