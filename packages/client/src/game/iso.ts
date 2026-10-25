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

/**
 * Ground lift in art pixels at a world point (0 on flat worlds). Revision-3 worlds install a provider that blends
 * the elevation levels under the point, so every billboard, label and effect that projects with `isoY` stands on
 * the terrain without each caller knowing about height.
 */
let liftAt: ((x: number, y: number) => number) | null = null;
export const setLift = (fn: ((x: number, y: number) => number) | null): void => {
  liftAt = fn;
};
export const lift = (x: number, y: number): number => (liftAt ? liftAt(x, y) : 0);

/**
 * Elevation under a world point as a smooth level: tile levels blended between tile centres, each neighbour clamped to one
 * level of the tile underfoot, so a body never sags into a cliff yet glides up and down ramps.
 */
export function softLevel(levelAt: (tx: number, ty: number) => number, x: number, y: number): number {
  const here = levelAt(Math.floor(x), Math.floor(y));
  const px = x - 0.5,
    py = y - 0.5,
    x0 = Math.floor(px),
    y0 = Math.floor(py),
    fx = px - x0,
    fy = py - y0;
  const at = (i: number, j: number) => Math.min(here + 1, Math.max(here - 1, levelAt(x0 + i, y0 + j)));
  const top = at(0, 0) + (at(1, 0) - at(0, 0)) * fx,
    bottom = at(0, 1) + (at(1, 1) - at(0, 1)) * fx;
  return top + (bottom - top) * fy;
}
/** screen y of the flat ground plane: depth order and terrain maths never include height */
export const isoYFlat = (x: number, y: number): number => (x + y) * ISO_HH;
export const isoY = (x: number, y: number): number => (x + y) * ISO_HH - (liftAt ? liftAt(x, y) : 0);
export const project = (x: number, y: number): { x: number; y: number } => ({ x: isoX(x, y), y: isoY(x, y) });

/** Inverse: screen art-pixels (relative to the same origin) -> world tile coordinates (fractional). */
export function unproject(sx: number, sy: number): { x: number; y: number } {
  return { x: sy / (2 * ISO_HH) + sx / (2 * ISO_HW), y: sy / (2 * ISO_HH) - sx / (2 * ISO_HW) };
}

/**
 * Is a point at `level` hidden behind raised ground nearer the camera? Looking back along the view ray, one tile toward
 * the camera (+1,+1) shifts the screen by two levels, so terrain at least that much higher in front of the feet covers them.
 */
export function occluded(levelAt: (tx: number, ty: number) => number, x: number, y: number, level: number): boolean {
  for (let t = 1; t <= 6; t++) if (levelAt(Math.floor(x + t), Math.floor(y + t)) >= level + 2 * t) return true;
  return false;
}

/** Where an entity standing at world (x,y) plants its feet, in iso art pixels. */
export const footX = isoX;
export const footY = isoY;

/** zIndex for y-sorting billboards: nearer (larger x+y) draws on top. Tie-break with x. */
export const depth = (x: number, y: number): number => isoYFlat(x, y) * 4 + x * 0.001;

/** Facing in screen space for sprite direction selection (world vector -> screen vector). */
export const screenDir = (wx: number, wy: number): { x: number; y: number } => ({
  x: (wx - wy) * ISO_HW,
  y: (wx + wy) * ISO_HH,
});

/** The four corners of tile (tx,ty) as a screen-space diamond, for cursors/outlines. */
export function tileDiamond(tx: number, ty: number, rise = 0): number[] {
  return [
    isoX(tx, ty),
    isoYFlat(tx, ty) - rise,
    isoX(tx + 1, ty),
    isoYFlat(tx + 1, ty) - rise,
    isoX(tx + 1, ty + 1),
    isoYFlat(tx + 1, ty + 1) - rise,
    isoX(tx, ty + 1),
    isoYFlat(tx, ty + 1) - rise,
  ];
}
