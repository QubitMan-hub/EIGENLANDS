import { C, PALETTE, hash2, mulberry32 } from '@eigenlands/shared';

export type Ctx = CanvasRenderingContext2D;
export const col = (i: number) => PALETTE[i]!;

export function px(ctx: Ctx, x: number, y: number, c: number, w = 1, h = 1): void {
  ctx.fillStyle = col(c);
  ctx.fillRect(x, y, w, h);
}

export function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

/** Scatter `n` single pixels of colour `c` over a 16x16 cell using a deterministic rng. */
export function speckle(ctx: Ctx, rng: () => number, n: number, c: number, x0 = 0, y0 = 0, w = 16, h = 16): void {
  for (let i = 0; i < n; i++) px(ctx, x0 + Math.floor(rng() * w), y0 + Math.floor(rng() * h), c);
}

export { C, hash2, mulberry32 };
