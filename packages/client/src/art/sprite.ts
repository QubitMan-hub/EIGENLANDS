import { Rectangle, Texture } from 'pixi.js';

/**
 * Tiny sprite renderer for everything that moves: characters and creatures are modelled as a handful of 3D primitives
 * (ellipsoids, capsules, dots, thin lines) in a local frame (x = forward, y = left, z = up, units = art pixels),
 * ray-cast through the game's 2:1 isometric camera and shaded into flat value bands of a hue-shifted colour ramp.
 *
 * Style rules (the "critter" look):
 *  - no outlines: forms read by value only — key light from the top-left, lit tops, a darker underside;
 *  - flat bands, no dithering; occlusion contacts darken one step so overlapping parts stay readable;
 *  - muted ramps whose shadows drift toward plum / navy and whose lights drift toward warm yellow;
 *  - soft navy drop shadows are separate textures (see `softShadow`), so squash/flip never distorts them.
 * Every direction is rendered from the same model, so the light never flips with the sprite.
 */

export type Hex = number;
export type V3 = [number, number, number];
export type M3 = [number, number, number, number, number, number, number, number, number]; // row-major

// ───────────────────────── colour ─────────────────────────

function hexToHsl(c: Hex): [number, number, number] {
  const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToHex(h: number, s: number, l: number): Hex {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}
/** rotate hue `h` toward `target` by at most `deg` along the shorter way */
function hueToward(h: number, target: number, deg: number): number {
  let d = ((target - h + 540) % 360) - 180;
  if (Math.abs(d) < deg) return target;
  return h + Math.sign(d) * deg;
}
export function mixHex(a: Hex, b: Hex, t: number): Hex {
  const m = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}
export const hexStr = (c: Hex): string => `#${(c & 0xffffff).toString(16).padStart(6, '0')}`;

/**
 * A ramp around `base`, dark -> light: `below` darker steps whose hue slides toward plum/navy and `above` lighter steps
 * sliding toward warm yellow. `ramp[below]` is the base colour.
 */
export interface Ramp { readonly c: readonly Hex[]; readonly base: number }
export function ramp(base: Hex, below = 3, above = 2, o: { step?: number; hue?: number; sat?: number } = {}): Ramp {
  const [h, s, l] = hexToHsl(base);
  const step = o.step ?? 0.11, hueStep = o.hue ?? 13, satK = o.sat ?? 1;
  // warm colours get richer toward the light, cool ones greyer (like sunlit fur vs. slate)
  const warm = Math.cos(((h - 30) * Math.PI) / 180);
  const c: Hex[] = [];
  for (let k = -below; k <= above; k++) {
    if (k === 0) { c.push(base); continue; }
    const hh = k < 0 ? hueToward(h, 262, -k * hueStep) : hueToward(h, 50, k * hueStep * 1.15);
    const ss = k < 0 ? s * (1 + 0.04 * -k * (warm < 0 ? 1.5 : -0.6)) : s * (1 + 0.09 * k * warm);
    const ll = l + (k < 0 ? k * step : k * step * (0.62 + 0.25 * (1 - Math.max(0, warm))));
    c.push(hslToHex(hh, Math.min(0.82, ss * satK), Math.max(0.07, Math.min(0.93, ll))));
  }
  return { c, base: below };
}
/** explicit ramp, base index given */
export const rampOf = (c: Hex[], base: number): Ramp => ({ c, base });

/** Muted, outline-free remap of a saturated colour (used for icons drawn from the shared palette). */
export function mute(c: Hex, k = 0.78): Hex {
  const [h, s, l] = hexToHsl(c);
  const hh = l < 0.35 ? hueToward(h, 255, (0.35 - l) * 40) : h;
  return hslToHex(hh, s * k, 0.05 + l * 0.9);
}

// ───────────────────────── vectors ─────────────────────────

export const v3 = (x: number, y: number, z: number): V3 => [x, y, z];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scl = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export function mul(a: M3, b: M3): M3 {
  const o = new Array(9).fill(0) as M3;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!;
  return o;
}
export const apply = (m: M3, p: V3): V3 => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2], m[3] * p[0] + m[4] * p[1] + m[5] * p[2], m[6] * p[0] + m[7] * p[1] + m[8] * p[2]];
/** yaw about z (turn left positive) */
export const rotZ = (a: number): M3 => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
/** pitch about y: positive tips the nose (+x) down */
export const rotY = (a: number): M3 => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
/** roll about x: positive rolls the left side (+y) up */
export const rotX = (a: number): M3 => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
function inv(m: M3): M3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C || 1e-9;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
const T = (m: M3): M3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];

// ───────────────────────── materials ─────────────────────────

export interface Mat {
  r: Ramp;
  /** shift in bands (+ lighter) */
  bias?: number;
  /** band sensitivity to light (default 1) */
  gain?: number;
  /** unshaded: always the base colour (eyes, glow cores) */
  flat?: boolean;
  /** extra highlight band where the surface faces the light squarely */
  shiny?: boolean;
  /** never darkened by occlusion contacts (emissive things) */
  glow?: boolean;
}
/** per-hit material: q = hit point on the unit primitive in its own local axes; null punches a hole */
export type MatFn = (q: V3) => Mat | null;
type AnyMat = Mat | MatFn;

/** key light in view space (u = screen right, v = toward the camera along the ground, z = up) */
const LIGHT = norm([-0.3, 0.25, 0.92]);
const SQ = Math.SQRT1_2;

// ───────────────────────── scene ─────────────────────────

interface Hit { d: number; band: number; mat: Mat; part: number }

/**
 * One sprite frame being rendered. `ox, oy` = screen pixel of the model origin (the point between the feet on the ground).
 * `yaw` = world facing angle: 0 faces world +x (screen lower-right), PI/2 faces world +y (screen lower-left).
 */
export class Scene {
  readonly depth: Float32Array;
  readonly band: Int8Array;
  readonly mat: Array<Mat | null>;
  readonly part: Uint16Array;
  readonly over: Uint32Array;          // flat overlay colours (dots/lines), 0 = none, else 0xff000000 | rgb
  readonly overD: Float32Array;
  private stack: Array<{ m: M3; t: V3 }> = [];
  private m: M3;                        // model -> view linear part
  private t: V3 = [0, 0, 0];            // model origin offset (model units, before view)
  private curPart = 1;
  private lin: M3 = I3;                 // current model-space transform (pose)

  constructor(readonly w: number, readonly h: number, readonly ox: number, readonly oy: number, yaw: number) {
    const n = w * h;
    this.depth = new Float32Array(n).fill(-1e9);
    this.band = new Int8Array(n);
    this.mat = new Array(n).fill(null);
    this.part = new Uint16Array(n);
    this.over = new Uint32Array(n);
    this.overD = new Float32Array(n).fill(-1e9);
    // world (x,y,z) -> view (u,v,z): u=(x-y)/sqrt2, v=(x+y)/sqrt2
    const V: M3 = [SQ, -SQ, 0, SQ, SQ, 0, 0, 0, 1];
    this.m = mul(V, rotZ(yaw));
  }

  /** push a model-space transform: subsequent geometry is rotated by `r` about `pivot`, then moved by `move` */
  push(r: M3, pivot: V3 = [0, 0, 0], move: V3 = [0, 0, 0]): void {
    this.stack.push({ m: this.lin, t: this.t });
    // p' = r (p - pivot) + pivot + move, composed with the current transform
    const nt = add(this.xfm([pivot[0] + move[0], pivot[1] + move[1], pivot[2] + move[2]]), [0, 0, 0]);
    const lin = mul(this.lin, r);
    const off = sub3(nt, apply(lin, pivot));
    this.lin = lin; this.t = off;
  }
  pop(): void { const s = this.stack.pop(); if (s) { this.lin = s.m; this.t = s.t; } }
  /** model point -> transformed model point (pose applied) */
  private xfm(p: V3): V3 { return add(apply(this.lin, p), this.t); }
  /** model point -> view (u, v, z) */
  private view(p: V3): V3 { return apply(this.m, this.xfm(p)); }
  /** model point -> screen pixel + depth */
  project(p: V3): { x: number; y: number; d: number } {
    const [u, v, z] = this.view(p);
    const sy = 0.5 * v - z;
    return { x: this.ox + u, y: this.oy + sy, d: 1.25 * v - 0.5 * sy };
  }
  newPart(): number { return ++this.curPart; }

  private write(i: number, h: Hit): void {
    if (h.d <= this.depth[i]!) return;
    this.depth[i] = h.d; this.band[i] = h.band; this.mat[i] = h.mat; this.part[i] = h.part;
  }

  private shadeBand(mat: Mat, n: V3): number {
    if (mat.flat) return 0;
    const lam = dot(n, LIGHT) * (mat.gain ?? 1) + (mat.bias ?? 0) * 0.33;
    let b = lam > 0.86 ? 1 : lam > -0.12 ? 0 : lam > -0.55 ? -1 : -2;
    if (mat.shiny && lam > 0.9) b = 2;
    return b;
  }

  /**
   * Ellipsoid centred at model point `c` with radii `r` along its local axes; `rot` orients those axes in model space.
   * `mat` may be a function of the unit-sphere hit point (in local axes) to paint regions or punch holes.
   */
  ell(c: V3, r: V3, mat: AnyMat, rot: M3 = I3, part = this.newPart()): void {
    const A = mul(mul(this.m, mul(this.lin, rot)), [r[0], 0, 0, 0, r[1], 0, 0, 0, r[2]]);
    const Ai = inv(A), AiT = T(Ai);
    const C = this.view(c);
    const q1 = apply(Ai, [0, 1, 0.5]);
    const a = dot(q1, q1);
    // screen bounds from the transformed ellipsoid extents
    const ex = Math.hypot(A[0], A[1], A[2]);
    const ey = Math.hypot(0.5 * A[3] - A[6], 0.5 * A[4] - A[7], 0.5 * A[5] - A[8]);
    const cx = this.ox + C[0], cy = this.oy + 0.5 * C[1] - C[2];
    const x0 = Math.max(0, Math.floor(cx - ex - 1)), x1 = Math.min(this.w - 1, Math.ceil(cx + ex + 1));
    const y0 = Math.max(0, Math.floor(cy - ey - 1)), y1 = Math.min(this.h - 1, Math.ceil(cy + ey + 1));
    const fn = typeof mat === 'function' ? mat : null;
    for (let py = y0; py <= y1; py++) {
      const sy = py + 0.5 - this.oy;
      for (let px = x0; px <= x1; px++) {
        const u = px + 0.5 - this.ox;
        const q0 = apply(Ai, [u - C[0], -C[1], -sy - C[2]]);
        const b = 2 * dot(q0, q1), cc = dot(q0, q0) - 1;
        const disc = b * b - 4 * a * cc;
        if (disc < 0) continue;
        const sq = Math.sqrt(disc);
        // nearest surface first; if a material function punches a hole there, try the far side (inside of a shell)
        for (const v of [(-b + sq) / (2 * a), (-b - sq) / (2 * a)]) {
          const q: V3 = [q0[0] + v * q1[0], q0[1] + v * q1[1], q0[2] + v * q1[2]];
          const m = fn ? fn(q) : (mat as Mat);
          if (!m) continue;
          let n = norm(apply(AiT, q));
          if (v !== (-b + sq) / (2 * a)) n = scl(n, -1);
          this.write(py * this.w + px, { d: 1.25 * v - 0.5 * sy, band: this.shadeBand(m, n), mat: m, part });
          break;
        }
      }
    }
  }

  sph(c: V3, r: number, mat: AnyMat, part = this.newPart()): void { this.ell(c, [r, r, r], mat, I3, part); }

  /** tapered capsule from a (radius ra) to b (radius rb), built from overlapping spheres */
  cap(a: V3, b: V3, ra: number, rb: number, mat: Mat, part = this.newPart()): void {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const n = Math.max(1, Math.ceil(len / 0.45));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.sphFast(lerp3(a, b, t), ra + (rb - ra) * t, mat, part);
    }
  }

  private sphFast(c: V3, r: number, mat: Mat, part: number): void {
    const L = this.lin;
    const det = L[0] * (L[4] * L[8] - L[5] * L[7]) - L[1] * (L[3] * L[8] - L[5] * L[6]) + L[2] * (L[3] * L[7] - L[4] * L[6]);
    const sc = Math.cbrt(Math.abs(det)) || 1;          // uniform pose scale (children) also scales the spheres
    const C = this.view(c);
    const rr = r * sc;
    const cx = this.ox + C[0], cy = this.oy + 0.5 * C[1] - C[2];
    const x0 = Math.max(0, Math.floor(cx - rr - 1)), x1 = Math.min(this.w - 1, Math.ceil(cx + rr + 1));
    const y0 = Math.max(0, Math.floor(cy - rr * 1.12 - 1)), y1 = Math.min(this.h - 1, Math.ceil(cy + rr * 1.12 + 1));
    for (let py = y0; py <= y1; py++) {
      const sy = py + 0.5 - this.oy;
      const w0 = -sy - C[2];
      for (let px = x0; px <= x1; px++) {
        const du = px + 0.5 - this.ox - C[0];
        // |(u, v, 0.5v - sy) - C|^2 = r^2  in v
        const a = 1.25, b = -2 * C[1] + w0, cc = C[1] * C[1] + w0 * w0 + du * du - rr * rr;
        const disc = b * b - 4 * a * cc;
        if (disc < 0) continue;
        const v = (-b + Math.sqrt(disc)) / (2 * a);
        const n: V3 = [du / rr, (v - C[1]) / rr, (0.5 * v - sy - C[2]) / rr];
        this.write(py * this.w + px, { d: 1.25 * v - 0.5 * sy, band: this.shadeBand(mat, n), mat, part });
      }
    }
  }

  /** a flat-coloured pixel cluster on/near a surface point; hidden if something nearer covers it */
  dot(p: V3, c: Hex, w = 1, h = 1, tol = 1.6, ax = 0): void {
    const s = this.project(p);
    const x = Math.floor(s.x - (w - 1) * ax), y = Math.floor(s.y);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.overPx(x + i, y + j, c, s.d, tol);
  }
  /** always-visible pixel (glows that shine through) */
  glowPx(p: V3, c: Hex, w = 1, h = 1): void {
    const s = this.project(p);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.overPx(Math.floor(s.x) + i, Math.floor(s.y) + j, c, 1e9, 1e9);
  }
  /** 1px line between model points, colour from `col(t)` (t 0..1), depth-tested */
  line(a: V3, b: V3, col: Hex | ((t: number) => Hex), tol = 1.2): void {
    const A = this.project(a), B = this.project(b);
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(B.x - A.x), Math.abs(B.y - A.y))));
    let lx = -999, ly = -999;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = Math.floor(A.x + (B.x - A.x) * t), y = Math.floor(A.y + (B.y - A.y) * t);
      if (x === lx && y === ly) continue;
      lx = x; ly = y;
      this.overPx(x, y, typeof col === 'number' ? col : col(t), A.d + (B.d - A.d) * t, tol);
    }
  }
  private overPx(x: number, y: number, c: Hex, d: number, tol: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (d < this.depth[i]! - tol || d < this.overD[i]!) return;
    this.over[i] = (0xff000000 | c) >>> 0; this.overD[i] = d;
  }

  /** Resolve bands into colours: contact darkening, underside edge, stray-pixel cleanup. Returns RGBA words (ABGR). */
  resolve(o: { edgeDark?: boolean; topLight?: boolean } = {}): Uint32Array {
    const { w, h } = this;
    const n = w * h;
    const band = Int8Array.from(this.band);
    const has = (i: number) => this.mat[i] !== null;
    // 1) occlusion contact: a pixel bordering a clearly nearer, different part darkens one step
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, m = this.mat[i];
      if (!m || m.flat || m.glow) continue;
      const d = this.depth[i]!, p = this.part[i]!;
      let occ = false;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j < 0 || !has(j) || this.part[j] === p) continue;
        if (this.depth[j]! > d + 2.2) { occ = true; break; }
      }
      if (occ) band[i] = band[i]! - 1;
    }
    // 2) silhouette: the lowest pixel of a column run darkens (grounded underside); optional lit top edge
    if (o.edgeDark !== false) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, m = this.mat[i];
      if (!m || m.flat || m.glow) continue;
      if (y === h - 1 || !has(i + w)) band[i] = Math.min(band[i]!, this.band[i]! - 1);
    }
    if (o.topLight) for (let y = 1; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, m = this.mat[i];
      if (!m || m.flat || m.glow || has(i - w)) continue;
      if (this.band[i]! >= 0) band[i] = band[i]! + 1;
    }
    // 3) cleanup: a lone pixel whose 4 same-material neighbours all agree on another band joins them
    const out = Int8Array.from(band);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, m = this.mat[i];
      if (!m) continue;
      const nb = [i - 1, i + 1, i - w, i + w];
      if (!nb.every((j) => this.mat[j] === m)) continue;
      const b0 = band[nb[0]!]!;
      if (b0 !== band[i] && nb.every((j) => band[j] === b0)) out[i] = b0;
    }
    const px = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let c = 0;
      const m = this.mat[i];
      if (m) {
        const k = Math.max(0, Math.min(m.r.c.length - 1, m.r.base + out[i]!));
        c = (0xff000000 | m.r.c[k]!) >>> 0;
      }
      if (this.over[i]) c = this.over[i]!;
      if (c) c = ((c & 0xff000000) | ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff)) >>> 0; // RGB -> canvas ABGR
      px[i] = c;
    }
    return px;
  }
}

// ───────────────────────── sheets ─────────────────────────

/** A grid sheet of equally sized frames on one canvas, uploaded once and sliced into cached textures. */
export class Sheet {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private tex: Texture | null = null;
  private cache = new Map<number, Texture>();
  constructor(readonly fw: number, readonly fh: number, readonly cols: number, readonly rows: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = fw * cols; this.canvas.height = fh * rows;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }
  put(col: number, row: number, px: Uint32Array): void {
    const img = this.ctx.createImageData(this.fw, this.fh);
    new Uint32Array(img.data.buffer).set(px);
    this.ctx.putImageData(img, col * this.fw, row * this.fh);
  }
  frame(col: number, row: number): Texture {
    const k = row * this.cols + col;
    let t = this.cache.get(k);
    if (!t) {
      if (!this.tex) { this.tex = Texture.from(this.canvas); this.tex.source.scaleMode = 'nearest'; }
      t = new Texture({ source: this.tex.source, frame: new Rectangle(col * this.fw, row * this.fh, this.fw, this.fh) });
      this.cache.set(k, t);
    }
    return t;
  }
}

// ───────────────────────── shadows ─────────────────────────

const SHADOW = 0x141a26;
const shadowCache = new Map<string, Texture>();
/**
 * Soft navy drop shadow: a pixel ellipse whose opacity falls off in a few flat steps (core ~0.5, rim ~0.1).
 * Anchor the returned texture at its centre.
 */
export function softShadow(rx: number, ry: number, strength = 1): Texture {
  rx = Math.max(2, Math.round(rx)); ry = Math.max(1, Math.round(ry));
  const key = `${rx}x${ry}@${strength}`;
  let t = shadowCache.get(key);
  if (t) return t;
  const w = rx * 2 + 2, h = ry * 2 + 2;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const d = new Uint32Array(img.data.buffer);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = (x + 0.5 - w / 2) / (rx + 0.5), ny = (y + 0.5 - h / 2) / (ry + 0.5);
    const r = nx * nx + ny * ny;
    if (r >= 1) continue;
    const a = r < 0.3 ? 0.5 : r < 0.55 ? 0.38 : r < 0.8 ? 0.24 : 0.11;
    const A = Math.round(255 * Math.min(1, a * strength));
    d[y * w + x] = ((A << 24) | ((SHADOW & 0xff) << 16) | (SHADOW & 0xff00) | ((SHADOW >> 16) & 0xff)) >>> 0;
  }
  ctx.putImageData(img, 0, 0);
  t = Texture.from(c);
  t.source.scaleMode = 'nearest';
  shadowCache.set(key, t);
  return t;
}
export const SHADOW_TINT = SHADOW;

// ───────────────────────── iso facing ─────────────────────────

/** Four diagonal iso facings used by creatures (matches the 2:1 camera): screen SE, SW, NE, NW. */
export const D4_SE = 0, D4_SW = 1, D4_NE = 2, D4_NW = 3;
/**
 * World yaw for each D4 facing (0 = world +x = screen lower-right). The south facings turn a little toward profile
 * (a long, readable side silhouette, as in hand-drawn iso critters); the north ones stay close to the true diagonal.
 */
export const D4_YAW = [-0.28, Math.PI / 2 + 0.28, -Math.PI / 2 + 0.12, Math.PI - 0.12];

/**
 * Screen-space facing -> one of the 4 diagonals, with hysteresis: a near-horizontal or near-vertical facing keeps the
 * previous east/west or north/south half so creatures do not flicker between frames.
 */
export function dir4(sx: number, sy: number, prev = D4_SE): number {
  const l = Math.hypot(sx, sy);
  if (l < 1e-6) return prev;
  const east = Math.abs(sx) < 0.2 * l ? prev === D4_SE || prev === D4_NE : sx > 0;
  const south = Math.abs(sy) < 0.15 * l ? prev === D4_SE || prev === D4_SW : sy > 0;
  return south ? (east ? D4_SE : D4_SW) : (east ? D4_NE : D4_NW);
}
