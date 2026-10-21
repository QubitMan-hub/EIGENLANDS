/**
 * Inventory icons (16x16 pixel art, drawn procedurally from the item's `icon: {g, a, b}` spec).
 * ART WORKER: replace the stub body; keep these exports and signatures.
 */
import { ITEMS, PALETTE } from '@eigenlands/shared';
import { makeCanvas } from './draw';

const cache = new Map<string, string>();

/** A crisp 16x16 canvas for an item id (unknown ids get a "?" box). */
export function itemIconCanvas(id: string, size = 16): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(size, size);
  const d = ITEMS[id];
  ctx.fillStyle = PALETTE[d?.icon.a ?? 3]!;
  ctx.fillRect(size * 0.2, size * 0.2, size * 0.6, size * 0.6);
  ctx.fillStyle = PALETTE[d?.icon.b ?? 7]!;
  ctx.fillRect(size * 0.35, size * 0.35, size * 0.2, size * 0.2);
  return canvas;
}

/** Cached data URL of the 16x16 icon, for DOM <img> use (render with image-rendering: pixelated). */
export function itemIconUrl(id: string): string {
  let u = cache.get(id);
  if (!u) { u = itemIconCanvas(id).toDataURL(); cache.set(id, u); }
  return u;
}
