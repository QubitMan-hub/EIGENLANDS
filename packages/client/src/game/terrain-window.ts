/** Overscan lets a cached background follow the camera immediately between shader paints. */
export const TERRAIN_PAD = 16;
export function terrainWindow(x: number, y: number, time: number, motion: boolean, detail: number) {
  return {
    x: Math.floor(x / TERRAIN_PAD) * TERRAIN_PAD - TERRAIN_PAD,
    y: Math.floor(y / TERRAIN_PAD) * TERRAIN_PAD - TERRAIN_PAD,
    tick: motion ? Math.floor(time * (detail < 0.5 ? 15 : 24)) : 0,
  };
}
