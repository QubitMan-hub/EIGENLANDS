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
let noDither = false;
/** Run `fn` with the shading helpers (blob, slab, cyl, limb, rampAt) in clean, undithered bands (painterly style). */
export function undithered<T>(fn: () => T): T { const prev = noDither; noDither = true; try { return fn(); } finally { noDither = prev; } }
function pick(ramp: Ramp, t: number, d: number): number {
  if (noDither) d = 0.5;
  const x = Math.min(1, Math.max(0, t)) * (ramp.length - 1);
  const lo = Math.floor(x);
  const fr = x - lo;
  const k = fr <= 0.3 ? 0 : fr >= 0.7 ? 1 : (fr - 0.3) / 0.4;   // clean flat bands, ordered dither only in a narrow seam
  return ramp[Math.min(ramp.length - 1, lo + (k > d ? 1 : 0))]!;
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
      if (lit) sets.push([x, y, o.fringe && (x * 3 + y) % 5 === 0 ? C.q7 : lt(c)]);
      else if (shaded && c !== C.night && c !== C.ink) sets.push([x, y, o.fringe && (x + y * 3) % 6 === 0 ? C.q5 : dk(c)]);
    }
  }
  for (const [x, y, c] of sets) put(ctx, x, y, c);
  if (o.ao) {
    const { ax, ay, rx } = o.ao;
    for (let y = ay - 1; y <= ay + 3; y++) for (let x = Math.floor(ax - rx); x <= Math.ceil(ax + rx); x++) {
      if (x < 0 || y < 0 || x >= w || y >= h || solid(x, y)) continue;
      const dd = ((x - ax) / rx) ** 2 + ((y - ay) / 2.6) ** 2;
      if (dd >= 1) continue;
      // soft contact shadow: translucent ink, denser toward the centre (blends with any ground)
      ctx.globalAlpha = dd < 0.35 ? 0.42 : dd < 0.7 ? 0.28 : 0.14;
      put(ctx, x, y, C.ink);
    }
    ctx.globalAlpha = 1;
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

// ───────── isometric primitives (2:1, lit from the top-left) ─────────
/** Face callback: u in [0,1] along the face (from the front corner outward), v = pixels above the base (0 = bottom). */
export type FaceFn = (u: number, v: number, x: number, y: number) => number;
/** Top callback: s along the -x edge, t along the -y edge, both 0..1 from the front corner. */
export type TopFn = (s: number, t: number, x: number, y: number) => number;

/**
 * Iso box whose FRONT (nearest) bottom corner is at (cx, by). `a` = screen half-span of the left (x-extent) side,
 * `b` = of the right side, `h` = height in px. Left face is the lit one, right face the shaded one.
 */
export function isoBox(ctx: Ctx, cx: number, by: number, a: number, b: number, h: number, left: FaceFn | number, right: FaceFn | number, top: TopFn | number | null): void {
  const F = (f: FaceFn | number, u: number, v: number, x: number, y: number) => (typeof f === 'number' ? f : f(u, v, x, y));
  for (let x = Math.floor(cx - a); x < Math.ceil(cx + b); x++) {
    const px = x + 0.5;
    const isL = px <= cx;
    const u = isL ? (cx - px) / a : (px - cx) / b;
    const base = by - Math.abs(cx - px) * 0.5;
    for (let y = Math.floor(base - h); y < base; y++) {
      const v = base - (y + 0.5);
      if (v >= 0 && v <= h) put(ctx, x, y, F(isL ? left : right, u, v, x, y));
    }
  }
  if (top === null) return;
  const ty = by - h;
  for (let y = Math.floor(ty - (a + b) * 0.5 - 1); y <= Math.ceil(ty); y++) for (let x = Math.floor(cx - a); x < Math.ceil(cx + b); x++) {
    const px = x + 0.5 - cx, py = y + 0.5 - ty;
    const t = (px - 2 * py) / 2, s = (-2 * py - px) / 2;
    if (s < 0 || t < 0 || s > a || t > b) continue;
    put(ctx, x, y, typeof top === 'number' ? top : top(s / a, t / b, x, y));
  }
}

/** Upright cylinder (ellipse top, lit from the left). `ramp` dark->light. */
export function cyl(ctx: Ctx, cx: number, topY: number, rx: number, ry: number, h: number, ramp: Ramp, topRamp?: Ramp, seed = 1): void {
  for (let x = Math.floor(cx - rx); x < Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx;
    if (Math.abs(nx) > 1) continue;
    const ey = Math.sqrt(1 - nx * nx) * ry;
    const lam = 0.62 - 0.5 * nx - 0.22 * nx * nx;
    for (let y = Math.floor(topY); y < topY + h + ey; y++) {
      const t = lam + (hash2(seed, x, y, 5) - 0.5) * 0.08 - 0.12 * ((y - topY) / Math.max(1, h));
      put(ctx, x, y, pick(ramp, t, bayer(x, y)));
    }
  }
  const tr = topRamp ?? ramp;
  for (let y = Math.floor(topY - ry); y <= Math.ceil(topY + ry); y++) for (let x = Math.floor(cx - rx); x < Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - topY) / ry;
    const dd = nx * nx + ny * ny;
    if (dd > 1) continue;
    const t = 0.78 - 0.22 * nx - 0.2 * ny - (dd > 0.75 ? 0.22 : 0);
    put(ctx, x, y, pick(tr, t, bayer(x, y)));
  }
}

/** Thick limb: a Lambert-shaded capsule from (x0,y0) to (x1,y1) with radii r0 -> r1 (lit from the top-left). */
export function limb(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, ramp: Ramp, seed = 1, bright = 0): void {
  const dx = x1 - x0, dy = y1 - y0, len2 = Math.max(1e-6, dx * dx + dy * dy), len = Math.sqrt(len2);
  const px = -dy / len, py = dx / len;            // perpendicular (unit)
  const R = Math.max(r0, r1);
  for (let y = Math.floor(Math.min(y0, y1) - R); y <= Math.ceil(Math.max(y0, y1) + R); y++) {
    for (let x = Math.floor(Math.min(x0, x1) - R); x <= Math.ceil(Math.max(x0, x1) + R); x++) {
      const qx = x + 0.5 - x0, qy = y + 0.5 - y0;
      const t = Math.max(0, Math.min(1, (qx * dx + qy * dy) / len2));
      const r = r0 + (r1 - r0) * t;
      const cx = qx - dx * t, cy = qy - dy * t;
      const dist = Math.hypot(cx, cy);
      if (dist > r) continue;
      // surface normal: across the limb plus bulge at the caps
      const side = (cx * px + cy * py) / r;
      const nx = (cx / r), ny = (cy / r);
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const lam = nx * L[0] + ny * L[1] + nz * L[2];
      const tt = 0.5 + 0.6 * lam + bright - 0.18 * Math.pow(Math.abs(side), 4) + (hash2(seed, x, y, 9) - 0.5) * 0.05;
      put(ctx, x, y, pick(ramp, tt, bayer(x, y)));
    }
  }
}

/** Centre `text` at cx in the 3x5 pixel font, with an optional 1px drop-shadow colour. */
export function pixelTextC(ctx: Ctx, text: string, cx: number, y: number, c: number, shadow?: number): void {
  const x = Math.round(cx - fontWidth(text) / 2);
  if (shadow !== undefined) pixelText(ctx, text, x + 1, y + 1, shadow);
  pixelText(ctx, text, x, y, c);
}

// ───────── 5x7 engraving font (plaques, shop signs) ─────────
const BIG: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'], D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'], F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'], H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'], J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'], L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'], N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'], R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'], T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'], V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'], X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'], Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};
export const bigTextWidth = (text: string): number => text.length * 6 - 1;
/** 5x7 capitals centred at cx (top at y). `hi` paints a 1px highlight under each stroke (engraved look). */
export function bigTextC(ctx: Ctx, text: string, cx: number, y: number, c: number, hi?: number): void {
  let x = Math.round(cx - bigTextWidth(text) / 2);
  for (const ch of text.toUpperCase()) {
    const g = BIG[ch] ?? BIG[' ']!;
    for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (g[j]![i] === '1') {
      put(ctx, x + i, y + j, c);
      if (hi !== undefined && (j === 6 || g[j + 1]![i] !== '1')) put(ctx, x + i, y + j + 1, hi);
    }
    x += 6;
  }
}

// ───────── fast off-screen pixel buffer that quacks like a 2D context (put/outline/polish only) ─────────
const RGBA = new Map<string, number>();
function rgbaOf(style: string): number {
  let v = RGBA.get(style);
  if (v === undefined) { const n = parseInt(style.slice(1), 16); v = (255 << 24) | ((n & 255) << 16) | (n & 0xff00) | ((n >> 16) & 255); RGBA.set(style, v); }
  return v;
}
export class PixBuf {
  fillStyle = '#000000';
  globalAlpha = 1;
  readonly px: Uint32Array;
  constructor(readonly width: number, readonly height: number) { this.px = new Uint32Array(width * height); }
  fillRect(x: number, y: number, w: number, h: number): void {
    let c = rgbaOf(this.fillStyle as string);
    if (this.globalAlpha < 1) c = ((Math.round(255 * this.globalAlpha) << 24) | (c & 0xffffff)) >>> 0;
    const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y)), x1 = Math.min(this.width, Math.round(x + w)), y1 = Math.min(this.height, Math.round(y + h));
    for (let j = y0; j < y1; j++) this.px.fill(c, j * this.width + x0, j * this.width + x1);
  }
  clearRect(x: number, y: number, w: number, h: number): void { const s = this.fillStyle; this.fillStyle = '#000000'; const c = this.px; const x0 = Math.max(0, x), y0 = Math.max(0, y); for (let j = y0; j < Math.min(this.height, y + h); j++) c.fill(0, j * this.width + x0, j * this.width + Math.min(this.width, x + w)); this.fillStyle = s; }
  getImageData(_x: number, _y: number, w: number, h: number): ImageData {
    return { data: new Uint8ClampedArray(this.px.buffer, 0, w * h * 4), width: w, height: h, colorSpace: 'srgb' } as ImageData;
  }
  putImageData(img: ImageData, dx: number, dy: number): void { if (img.data.buffer !== this.px.buffer) new Uint8ClampedArray(this.px.buffer).set(img.data); void dx; void dy; }
  get ctx(): Ctx { return this as unknown as Ctx; }
  /** copy into a real canvas context at (dx, dy) */
  blit(target: CanvasRenderingContext2D, dx: number, dy: number): void {
    const img = target.createImageData(this.width, this.height); img.data.set(new Uint8Array(this.px.buffer)); target.putImageData(img, dx, dy);
  }
}

/** Pick a ramp entry for t in [0,1] with ordered dithering at (x,y). */
export function rampAt(ramp: Ramp, t: number, x: number, y: number): number { return pick(ramp, t, bayer(x, y)); }

// ───────── painterly (dither-free) helpers: the reference style ─────────
export interface LumpOpts {
  seed?: number;
  /** surface noise (tone jitter in 2px clusters) */
  rough?: number;
  /** ragged leafy silhouette + leaf-cluster breakup (0 = smooth stone) */
  leafy?: number;
  bright?: number;
  /** darkening toward the silhouette */
  edge?: number;
  /** flatten the top (stones sitting on the ground): 0..1 */
  flat?: number;
}
const sizeOf = (ctx: Ctx): [number, number] => {
  const c = ctx as unknown as { canvas?: { width: number; height: number }; width?: number; height?: number };
  return c.canvas ? [c.canvas.width, c.canvas.height] : [c.width ?? 0, c.height ?? 0];
};

/**
 * A sphere-shaded lump quantised into clean ramp bands (no dithering), lit from the top-left. Leafy lumps get a
 * ragged rim and 2px leaf clusters; stone lumps stay smooth with broad planes. Returns the pixels it painted.
 */
export function lump(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, ramp: Ramp, o: LumpOpts = {}, ids?: { map: Int16Array; id: number; w: number }): void {
  const seed = o.seed ?? 1, rough = o.rough ?? 0.12, leafy = o.leafy ?? 0, bright = o.bright ?? 0, edge = o.edge ?? 0.18, flat = o.flat ?? 0;
  const [W, H] = sizeOf(ctx);
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      const dd = nx * nx + ny * ny;
      const rim = leafy ? (hash2(seed, x, y, 3) - 0.5) * leafy * 0.9 + (hash2(seed, x >> 1, y >> 1, 4) - 0.5) * leafy * 0.6 : 0;
      if (dd > 1 + rim) continue;
      const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, dd)));
      let lam = nx * L[0] + ny * L[1] + nz * L[2];
      if (flat && ny < -0.2) lam = lam * (1 - flat) + flat * 0.75;
      const cl = (hash2(seed, (x + (y & 1)) >> 1, y >> 1, 5) - 0.5) * (leafy ? 0.38 : rough);
      const t = 0.42 + 0.62 * lam + bright - edge * dd * dd + cl;
      const i = Math.max(0, Math.min(ramp.length - 1, Math.floor(t * ramp.length)));
      put(ctx, x, y, ramp[i]!);
      if (ids) ids.map[y * ids.w + x] = ids.id;
    }
  }
}

/**
 * A pile of stone lumps drawn back to front; where a nearer stone overlaps a farther one, a 1px crevice in the
 * ramp's darkest tone separates them (value only: no outline around the silhouette).
 */
export function stonePile(ctx: Ctx, stones: Array<[number, number, number, number]>, ramp: Ramp, o: LumpOpts = {}): void {
  const [W, H] = sizeOf(ctx);
  const map = new Int16Array(W * H).fill(-1);
  const order = stones.map((s, i) => [s, i] as const).sort((a, b) => (a[0][1] + a[0][3]) - (b[0][1] + b[0][3]));
  for (const [[x, y, rx, ry], i] of order) lump(ctx, x, y, rx, ry, ramp, { ...o, seed: (o.seed ?? 1) + i * 17 }, { map, id: i, w: W });
  const rank = new Map(order.map(([, i], k) => [i, k]));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const id = map[y * W + x]!;
    if (id < 0) continue;
    // a farther stone's pixel touching a nearer stone just below/right of it sits in the crevice
    const below = y + 1 < H ? map[(y + 1) * W + x]! : -1, right = x + 1 < W ? map[y * W + x + 1]! : -1;
    const near = (j: number) => j >= 0 && j !== id && rank.get(j)! > rank.get(id)!;
    const far = (j: number) => j >= 0 && j !== id && rank.get(j)! < rank.get(id)!;
    if (near(below) || near(right)) put(ctx, x, y, ramp[0]!);
    else if (far(below) || far(right)) put(ctx, x, y, ramp[1]!);
  }
}
