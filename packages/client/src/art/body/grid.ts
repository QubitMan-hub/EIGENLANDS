/**
 * The pixel canvas a character is assembled on. Parts write *materials* (a part id and a colour ramp, or a fixed
 * tone), never colours; once every part is down, each part's horizontal runs are shaded the way a pixel artist
 * shades by hand — lit on the left and top, shade toward the right, the darkest tone where the part meets something
 * else on its right or below — so overlapping limbs separate with a clean one-pixel edge. Then the ramps are applied.
 */
import { put, type Ctx, type Ramp } from '../shade';

export const GW = 32,
  GH = 48;

/** the key light in screen terms (x right, y down, toward the camera): from the upper left, in front */
const LX = -0.55,
  LY = -0.62,
  LC = 0.56;
/** a surface's tone (0 dark .. 4 light) from its screen-space normal */
export function lightTone(nx: number, ny: number, nc: number): number {
  const l = Math.hypot(nx, ny, nc) || 1;
  const lum = (nx * LX + ny * LY + nc * LC) / l;
  return lum > 0.82 ? 4 : lum > 0.52 ? 3 : lum > 0.0 ? 2 : lum > -0.45 ? 1 : 0;
}

interface Cell {
  /** part id (shading runs never cross parts) */
  part: number;
  ramp: Ramp;
  /** fixed tone index into the ramp (bypasses the hand shading), or -1 */
  tone: number;
  /** fixed colour (eyes, buckles), or -1 */
  ink: number;
}

const NB: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, -1],
  [0, 1],
];

export class Grid {
  private cells: Array<Cell | null>;
  /** nearness to the camera of what each pixel shows (a z-buffer: nearer surfaces win) */
  private zb: Float32Array;
  constructor(
    readonly w = GW,
    readonly h = GH,
  ) {
    this.cells = new Array(w * h).fill(null);
    this.zb = new Float32Array(w * h).fill(-1e9);
  }
  private next = 1;
  /** a new part id: shading treats its pixels as one surface */
  part(): number {
    return this.next++;
  }
  at(x: number, y: number): Cell | null {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.cells[y * this.w + x]!;
  }
  set(x: number, y: number, part: number, ramp: Ramp, tone = -1, ink = -1): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.cells[y * this.w + x] = { part, ramp, tone, ink };
  }
  /** write a pixel of a surface at nearness `depth` if nothing nearer is there (or the pixel belongs to `over`) */
  zset(x: number, y: number, depth: number, part: number, ramp: Ramp, tone = -1, ink = -1, over = -1): boolean {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    const i = y * this.w + x;
    const c = this.cells[i];
    if (depth < this.zb[i]! && !(c && c.part === over)) return false;
    this.zb[i] = Math.max(depth, this.zb[i]!);
    this.cells[i] = { part, ramp, tone, ink };
    return true;
  }
  /** recolour what is already there (clothing over a body part keeps its shape) */
  paint(x: number, y: number, fn: (c: Cell) => Cell | null): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const c = this.cells[y * this.w + x];
    if (c) this.cells[y * this.w + x] = fn(c);
  }
  clear(x: number, y: number): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) {
      this.cells[y * this.w + x] = null;
      this.zb[y * this.w + x] = -1e9;
    }
  }
  /** a round-ended stroke from (x0, y0) to (x1, y1), radius r0 tapering to r1 */
  stroke(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    r0: number,
    r1: number,
    part: number,
    ramp: Ramp,
    only?: (c: Cell | null) => boolean,
  ): void {
    const dx = x1 - x0,
      dy = y1 - y0,
      l2 = Math.max(1e-6, dx * dx + dy * dy);
    const R = Math.max(r0, r1);
    for (let y = Math.floor(Math.min(y0, y1) - R); y <= Math.ceil(Math.max(y0, y1) + R); y++)
      for (let x = Math.floor(Math.min(x0, x1) - R); x <= Math.ceil(Math.max(x0, x1) + R); x++) {
        const qx = x + 0.5 - x0,
          qy = y + 0.5 - y0;
        const t = Math.max(0, Math.min(1, (qx * dx + qy * dy) / l2));
        const r = r0 + (r1 - r0) * t;
        if ((qx - dx * t) ** 2 + (qy - dy * t) ** 2 > r * r) continue;
        if (only && !only(this.at(x, y))) continue;
        this.set(x, y, part, ramp);
      }
  }
  poly(pts: Array<[number, number]>, part: number, ramp: Ramp, only?: (c: Cell | null) => boolean): void {
    const ys = pts.map((p) => p[1]),
      xs = pts.map((p) => p[0]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
      for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
        const px = x + 0.5,
          py = y + 0.5;
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i]!,
            [xj, yj] = pts[j]!;
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside && (!only || only(this.at(x, y)))) this.set(x, y, part, ramp);
      }
  }
  /** the hand-shading pass, then the colours */
  render(ctx: Ctx): void {
    for (let y = 0; y < this.h; y++) {
      let x = 0;
      while (x < this.w) {
        const c = this.cells[y * this.w + x];
        if (!c) {
          x++;
          continue;
        }
        let e = x;
        while (e + 1 < this.w && this.cells[y * this.w + e + 1]?.part === c.part) e++;
        const n = e - x + 1;
        for (let i = 0; i < n; i++) {
          const px = x + i,
            cell = this.cells[y * this.w + px]!;
          if (cell.ink >= 0) {
            put(ctx, px, y, cell.ink);
            continue;
          }
          const r = cell.ramp,
            L = r.length;
          let idx: number;
          if (cell.tone >= 10) {
            // a lit tone (10 + 0..4): darkened where a nearer part covers the neighbouring pixel (contact shadow)
            let tone = cell.tone - 10;
            const z = this.zb[y * this.w + px]!;
            for (const [ox, oy] of NB) {
              const nx = px + ox,
                ny = y + oy;
              const n = this.at(nx, ny);
              if (n && n.part !== cell.part && this.zb[ny * this.w + nx]! > z + 1.2) {
                tone = Math.max(0, tone - 2);
                break;
              }
            }
            idx = Math.round((tone * (L - 1)) / 4);
          } else if (cell.tone >= 0) idx = Math.min(L - 1, cell.tone);
          else {
            // 0 dark, 1 shade, 2 mid, 3 light
            let tone = 2;
            if (n > 2 && i >= Math.ceil(n * 0.62)) tone = 1;
            const below = this.at(px, y + 1),
              above = this.at(px, y - 1);
            const belowOther = !!below && below.part !== cell.part;
            if (i === n - 1 && n > 1) tone = 0;
            else if (belowOther) tone = Math.min(tone, 1);
            else if (i === 0 || ((!above || above.part !== cell.part) && i < n * 0.6)) tone = 3;
            if (belowOther && i === n - 1) tone = 0;
            idx = [Math.min(1, L - 1), Math.round(L * 0.4), Math.round(L * 0.6), Math.min(L - 1, Math.round(L * 0.84))][
              tone
            ]!;
          }
          put(ctx, px, y, r[Math.max(0, Math.min(L - 1, idx))]!);
        }
        x = e + 1;
      }
    }
  }
}
