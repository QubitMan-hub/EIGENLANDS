import { OrthographicCamera, Vector3 } from 'three';

// Match iso.ts exactly: horizontal tile diagonals are 32px, vertical diagonals 16px.
export const VOXEL_PPU = 16 * Math.SQRT2;
export const voxelHeight = (pixels: number): number => pixels / (VOXEL_PPU * Math.cos(Math.PI / 6));

export function voxelCamera(
  width: number,
  height: number,
  scale: number,
  focus: { x: number; y: number; lift: number },
): OrthographicCamera {
  const unit = VOXEL_PPU * scale;
  const camera = new OrthographicCamera(
    -width / unit / 2,
    width / unit / 2,
    height / unit / 2,
    -height / unit / 2,
    0.1,
    600,
  );
  const target = new Vector3(focus.x, voxelHeight(focus.lift + 6), focus.y);
  camera.position.copy(target).add(new Vector3(Math.sqrt(3 / 8) * 180, 90, Math.sqrt(3 / 8) * 180));
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return camera;
}

/** Camera-ray footprint. Used by foreground cutaways, independent of pixel projection. */
export function foregroundOccludes(x: number, y: number, height: number, px: number, py: number): boolean {
  const dx = x - px,
    dy = y - py;
  const along = (dx + dy) / Math.SQRT2;
  return along > 0 && Math.abs(dx - dy) < 1.8 && along * Math.tan(Math.PI / 6) < height;
}
