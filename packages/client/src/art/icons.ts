/** Inventory thumbnails rendered from actual voxel item geometry, using the world camera angle. */
import { voxelIconCanvas } from './voxel-icons';

const canvases = new Map<string, HTMLCanvasElement>();
const urls = new Map<string, string>();

export function itemIconCanvas(id: string, size = 16): HTMLCanvasElement {
  const key = `${id}@${size}`;
  let canvas = canvases.get(key);
  if (!canvas) {
    canvas = voxelIconCanvas(id, size);
    canvases.set(key, canvas);
  }
  return canvas;
}

/** Render once at thumbnail resolution, then share the PNG among inventory, crafting and hotbar cells. */
export function itemIconUrl(id: string): string {
  let url = urls.get(id);
  if (!url) {
    url = itemIconCanvas(id, 64).toDataURL();
    urls.set(id, url);
  }
  return url;
}
