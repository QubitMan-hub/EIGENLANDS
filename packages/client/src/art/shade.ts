import { C, PALETTE, hash2 } from '@eigenlands/shared';
import { makeCanvas, type Ctx } from './draw';
export type { Ctx };

export { makeCanvas, C };
export type Ramp = readonly number[];

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x: number, y: number) => (BAYER[(x & 3) + (y & 3) * 4]! + 0.5) / 16;

/** Palette ramps (dark -> light), all drawn from the fixed 48 colours. */
export const R = {
  leaf: [C.g0, C.g1, C.g2, C.g3, C.g4, C.g5, C.g6] as Ramp,
  leafSpring: [C.g1, C.g2, C.g3, C.g4, C.g5, C.g6, C.g7] as Ramp,
  leafAutumnO: [C.e1, C.e2, C.e3, C.e4, C.e5, C.e6] as Ramp,
  leafAutumnR: [C.r0, C.r1, C.r2, C.r3, C.r4, C.r5] as Ramp,
  leafAutumnY: [C.e3, C.e4, C.e5, C.e6, C.e7] as Ramp,
  pine: [C.g0, C.g1, C.g2, C.g3, C.g4] as Ramp,
  snow: [C.mist, C.fog, C.pale, C.white] as Ramp,
  bark: [C.e0, C.e1, C.e2, C.e3, C.e4] as Ramp,
  stone: [C.slate, C.steel, C.mist, C.fog, C.pale] as Ramp,
  moss: [C.g1, C.g2, C.g3, C.g4] as Ramp,
  gel: [C.w1, C.w2, C.w3, C.w4, C.w5, C.w6, C.w7] as Ramp,
  gelDark: [C.q0, C.q1, C.q2, C.q3, C.q4, C.q5, C.q6] as Ramp,
  fur: [C.e1, C.e2, C.e3, C.e4, C.e5, C.e6] as Ramp,
  furDark: [C.r0, C.r1, C.r2, C.r3, C.r4, C.r5] as Ramp,
  crystal: [C.q1, C.q2, C.q3, C.q4, C.q5, C.q6, C.q7] as Ramp,
  skin: [C.e2, C.e3, C.e4, C.e5, C.e6] as Ramp,
  gold: [C.e3, C.e4, C.e5, C.e6, C.e7] as Ramp,
};

const L = (() => { const v = [-0.55, -0.7, 0.45]; const n = Math.hypot(...v); return v.map((a) => a / n) as [number, number, number]; })();

export const col = (i: number) => PALETTE[i]!;
export function put(ctx: Ctx, x: number, y: number, c: number, w = 1, h = 1): void {
  ctx.fillStyle = PALETTE[c]!;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}
function pick(ramp: Ramp, t: number, d: number): number {
  const x = Math.min(1, Math.max(0, t)) * (ramp.length - 1);
  const lo = Math.floor(x);
  return ramp[Math.min(ramp.length - 1, lo + (x - lo > d ? 1 : 0))]!;
}

export interface BlobOpts { seed?: number; noise?: number; bright?: number; edgeDark?: number; shape?: number }

/** Lambert-shaded ellipsoid with dithered ramp, per-pixel leafy noise and a darkened rim. */
export function blob(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, ramp: Ramp, o: BlobOpts = {}): void {
  const seed = o.seed ?? 1, noise = o.noise ?? 0.25, bright = o.bright ?? 0, edge = o.edgeDark ?? 0.28, shape = o.shape ?? 2;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      const dd = Math.pow(Math.abs(nx), shape) + Math.pow(Math.abs(ny), shape);
      if (dd > 1) continue;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const lam = nx * L[0] + ny * L[1] + nz * L[2];
      const n = hash2(seed, x, y, 7) - 0.5;
      const t = 0.5 + 0.55 * lam + bright - edge * dd * dd + n * noise;
      put(ctx, x, y, pick(ramp, t, bayer(x, y)));
    }
  }
}

/** Shaded rectangle lit from the left. */
export function slab(ctx: Ctx, x: number, y: number, w: number, h: number, ramp: Ramp, seed = 1, noise = 0.2): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const t = 0.85 - 0.6 * (i / Math.max(1, w - 1)) + (hash2(seed, x + i, y + j, 3) - 0.5) * noise - 0.05 * (j / h);
      put(ctx, x + i, y + j, pick(ramp, t, bayer(x + i, y + j)));
    }
  }
}

export function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, c: number): void {
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), err = dx + dy;
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  for (let guard = 0; guard < 200; guard++) {
    put(ctx, x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export function sheetCanvas(w: number, h: number) { return makeCanvas(w, h); }
