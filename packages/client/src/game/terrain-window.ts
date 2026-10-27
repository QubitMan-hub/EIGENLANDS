/** Overscan lets a cached background follow the camera immediately between shader paints. */
export const TERRAIN_PAD = 16;
/** A wide overscan for slow graphics chips: the painted background is reused across ~6x more camera travel. */
export const TERRAIN_PAD_WIDE = 96;
export function terrainWindow(x: number, y: number, time: number, motion: boolean, detail: number, pad = TERRAIN_PAD) {
  return {
    x: Math.floor(x / pad) * pad - pad,
    y: Math.floor(y / pad) * pad - pad,
    tick: motion ? Math.floor(time * (detail < 0.5 ? 15 : 24)) : 0,
  };
}
