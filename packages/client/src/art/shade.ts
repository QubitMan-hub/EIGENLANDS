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

// ───────── Phase 2 helpers ─────────
/** Palette rows are dark->light ramps: step within the row. */
export const dk = (c: number): number => (c % 8 === 0 ? c : c - 1);
export const lt = (c: number): number => (c % 8 === 7 ? c : c + 1);
export const ramp4 = (c: number): Ramp => [dk(dk(c)), dk(c), c, lt(c)];
export const ramp3 = (c: number): Ramp => [dk(c), c, lt(c)];

/** Pixel-exact polygon fill (no anti-aliasing so only palette colours appear). `colorAt` picks the colour per pixel. */
export function poly(ctx: Ctx, pts: Array<[number, number]>, colorAt: number | ((x: number, y: number) => number)): void {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const px = x + 0.5, py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i]!, [xj, yj] = pts[j]!;
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) put(ctx, x, y, typeof colorAt === 'number' ? colorAt : colorAt(x, y));
    }
  }
}

/** Adds a 1px dark outline around opaque pixels (readable, consistent icons). Operates in place. */
export function outline(ctx: Ctx, w: number, h: number, c: number = C.night): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3]! > 0;
  const mark: Array<[number, number]> = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (solid(x, y)) continue;
    if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) mark.push([x, y]);
  }
  for (const [x, y] of mark) put(ctx, x, y, c);
}

export { hash2, mulberry32 } from '@eigenlands/shared';

// ───────── sprite polish (rim light, contact shadow, quantum fringe) ─────────
const HEX_TO_IDX = new Map<string, number>(PALETTE.map((h, i) => [h.toLowerCase(), i]));
const rgbKey = (r: number, g: number, b: number) => `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;

export interface PolishOpts {
  /** lighten silhouette pixels facing up-left, darken those facing down-right */
  rim?: boolean;
  /** dithered contact shadow ellipse under the feet at (ax, ay) */
  ao?: { ax: number; ay: number; rx: number } | null;
  /** quantum fringe: cyan on the lit rim, magenta on the shaded rim (subtle) */
  fringe?: boolean;
}

/** Post-process a freshly drawn sprite: keeps colours inside the fixed palette (steps along palette rows). */
export function polish(ctx: Ctx, w: number, h: number, o: PolishOpts = {}): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3]! > 0;
  const idxAt = (x: number, y: number) => { const i = (y * w + x) * 4; return HEX_TO_IDX.get(rgbKey(d[i]!, d[i + 1]!, d[i + 2]!)) ?? -1; };
  const sets: Array<[number, number, number]> = [];
  if (o.rim || o.fringe) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      const c = idxAt(x, y);
      if (c < 0) continue;
      const lit = !solid(x - 1, y - 1) || !solid(x, y - 1) && !solid(x - 1, y);
      const shaded = !solid(x + 1, y + 1) || (!solid(x + 1, y) && !solid(x, y + 1));
      if (lit) sets.push([x, y, o.fringe && (x + y) % 2 === 0 ? C.q7 : lt(c)]);
      else if (shaded && c !== C.night && c !== C.ink) sets.push([x, y, o.fringe && (x + y) % 3 === 0 ? C.q5 : dk(c)]);
    }
  }
  for (const [x, y, c] of sets) put(ctx, x, y, c);
  if (o.ao) {
    const { ax, ay, rx } = o.ao;
    for (let y = ay - 1; y <= ay + 3; y++) for (let x = Math.floor(ax - rx); x <= Math.ceil(ax + rx); x++) {
      if (x < 0 || y < 0 || x >= w || y >= h || solid(x, y)) continue;
      const dd = ((x - ax) / rx) ** 2 + ((y - ay) / 2.6) ** 2;
      if (dd < 1 && ((x + y) & 1) === 0 ? dd < 0.9 : dd < 0.45) put(ctx, x, y, C.q0);
    }
  }
}

// ───────── 3x5 pixel font ─────────
const FONT: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101111011', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001110',
  ' ': '000000000000000', '-': '000000111000000', '.': '000000000000010', '!': '010010010000010',
};
export const fontWidth = (text: string): number => text.length * 4 - 1;
/** Draw `text` in the 3x5 pixel font at (x,y) (top-left); returns the width used. */
export function pixelText(ctx: Ctx, text: string, x: number, y: number, c: number): number {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const g = FONT[ch] ?? FONT[' ']!;
    for (let i = 0; i < 15; i++) if (g[i] === '1') put(ctx, cx + (i % 3), y + Math.floor(i / 3), c);
    cx += 4;
  }
  return cx - x - 1;
}
