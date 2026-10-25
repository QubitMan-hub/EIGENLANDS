/**
 * Isometric projection (2:1 diamonds, Project-Zomboid-style camera).
 * World space: tile units, +x runs toward the lower-right of the screen, +y toward the lower-left.
 * Screen space: art pixels at 1x (the whole world container is then scaled by an integer).
 *
 *   sx = (x - y) * 16        sy = (x + y) * 8
 *
 * A tile therefore covers a 32x16 diamond. Characters/objects are billboards whose FEET sit on the
 * ground point of their tile; depth order is simply the foot's screen y (see `depth`).
 */
export const ISO_HW = 16;
export const ISO_HH = 8;
export const TILE_PX_W = ISO_HW * 2;
export const TILE_PX_H = ISO_HH * 2;

export const isoX = (x: number, y: number): number => (x - y) * ISO_HW;
export const isoY = (x: number, y: number): number => (x + y) * ISO_HH;
export const project = (x: number, y: number): { x: number; y: number } => ({ x: isoX(x, y), y: isoY(x, y) });

/** Inverse: screen art-pixels (relative to the same origin) -> world tile coordinates (fractional). */
export function unproject(sx: number, sy: number): { x: number; y: number } {
  return { x: sy / (2 * ISO_HH) + sx / (2 * ISO_HW), y: sy / (2 * ISO_HH) - sx / (2 * ISO_HW) };
}

/** Where an entity standing at world (x,y) plants its feet, in iso art pixels. */
export const footX = isoX;
export const footY = isoY;

/** zIndex for y-sorting billboards: nearer (larger x+y) draws on top. Tie-break with x. */
export const depth = (x: number, y: number): number => isoY(x, y) * 4 + x * 0.001;

/** Facing in screen space for sprite direction selection (world vector -> screen vector). */
export const screenDir = (wx: number, wy: number): { x: number; y: number } => ({
  x: (wx - wy) * ISO_HW,
  y: (wx + wy) * ISO_HH,
});

/** The four corners of tile (tx,ty) as a screen-space diamond, for cursors/outlines. */
export function tileDiamond(tx: number, ty: number): number[] {
  return [
    isoX(tx, ty),
    isoY(tx, ty),
    isoX(tx + 1, ty),
    isoY(tx + 1, ty),
    isoX(tx + 1, ty + 1),
    isoY(tx + 1, ty + 1),
    isoX(tx, ty + 1),
    isoY(tx, ty + 1),
  ];
}
