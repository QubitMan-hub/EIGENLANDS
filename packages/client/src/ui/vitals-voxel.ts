import { voxelBoxesCanvas } from '../art/voxel-icons';
import { uiGaugeBoxes } from '../game/voxel/ui-models';
import type { GaugeId } from './vitals-model';
import type { VialPlace, VialSpec } from './vitals-art';

const cache = new Map<string, HTMLCanvasElement>();
export function renderVoxelVitals(
  ctx: CanvasRenderingContext2D,
  size: { width: number; height: number },
  places: readonly VialPlace[],
  specs: Record<GaugeId, VialSpec>,
): void {
  ctx.clearRect(0, 0, size.width, size.height);
  for (const p of places) {
    const v = specs[p.id];
    const shown = Math.round(v.shown * 60) / 60,
      trail = Math.round(v.trail * 60) / 60;
    const key = `${v.id}:${shown}:${trail}:${v.pips}:${v.pipMax}:${v.low}:${v.ready}:${v.aura}`;
    let image = cache.get(key);
    if (!image) {
      image = voxelBoxesCanvas(uiGaugeBoxes({ ...v, shown, trail }), 280, true, 36);
      if (cache.size >= 192) cache.delete(cache.keys().next().value!);
      cache.set(key, image);
    }
    ctx.save();
    if (v.flash > 0) ctx.globalAlpha = 1 - Math.min(0.15, v.flash * 0.15);
    ctx.drawImage(image, p.x, p.y, p.w, p.h);
    ctx.restore();
  }
}
