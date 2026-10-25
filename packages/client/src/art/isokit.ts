/**
 * Isometric drawing kit for props. Objects are modelled as real boxes, slabs and cylinders in a small 3D space and
 * projected with the game's own 2:1 camera, so every prop shows a believable top and two sides that line up with the
 * floor diamonds and the walls.
 *
 *   u: along tile x (screen down-right)   v: along tile y (screen down-left)   z: up
 *   16 units = one tile edge;  screen X = ox + (u - v),  Y = oy + (u + v) / 2 - z
 *
 * A sprite's anchor is the centre of its tile at ground level: (u, v, z) = (8, 8, 0).
 * Light comes from the upper left, so the +v face (facing south-west, screen left) is lit and the +u face (facing
 * south-east, screen right) is in shade, the same rule the terrain shader uses for its block sides.
 *
 * Props that stand against a wall are drawn for both orientations ('sw': back to the north-east wall, front facing
 * screen-left; 'se': back to the north-west wall, front facing screen-right). The geometry is rebuilt for each, not
 * mirrored, so the light stays consistent.
 */
import { C, put, type Ctx, type Ramp } from './shade';

export type Facing = 'sw' | 'se';
/** colour for a face pixel: s runs along the face's width, t up its height (or along v on a top), both 0..1 */
export type Paint = number | ((s: number, t: number, x: number, y: number) => number);

export class Iso {
  constructor(
    public ctx: Ctx,
    public ox: number,
    public oy: number,
  ) {}
  X(u: number, v: number): number {
    return this.ox + (u - v);
  }
  Y(u: number, v: number, z: number): number {
    return this.oy + (u + v) / 2 - z;
  }

  /** Fill the parallelogram with corner A and edge vectors e1 (s) and e2 (t), screen space. */
  para(ax: number, ay: number, e1x: number, e1y: number, e2x: number, e2y: number, paint: Paint): void {
    const det = e1x * e2y - e1y * e2x;
    if (Math.abs(det) < 1e-6) return;
    const xs = [ax, ax + e1x, ax + e2x, ax + e1x + e2x],
      ys = [ay, ay + e1y, ay + e2y, ay + e1y + e2y];
    const x0 = Math.floor(Math.min(...xs)),
      x1 = Math.ceil(Math.max(...xs)),
      y0 = Math.floor(Math.min(...ys)),
      y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - ax,
          py = y + 0.5 - ay;
        const s = (px * e2y - py * e2x) / det,
          t = (e1x * py - e1y * px) / det;
        if (s < -1e-4 || s > 1 + 1e-4 || t < -1e-4 || t > 1 + 1e-4) continue;
        const c =
          typeof paint === 'number' ? paint : paint(Math.min(1, Math.max(0, s)), Math.min(1, Math.max(0, t)), x, y);
        if (c >= 0) put(this.ctx, x, y, c); // negative = leave this pixel empty
      }
  }
  /** top face at height z over [u0,u0+du] x [v0,v0+dv]; s along u, t along v */
  top(u0: number, v0: number, z: number, du: number, dv: number, paint: Paint): void {
    this.para(this.X(u0, v0), this.Y(u0, v0, z), du, du / 2, -dv, dv / 2, paint);
  }
  /** the +v face (screen-left, lit): s along u, t up */
  left(u0: number, v: number, z0: number, du: number, dz: number, paint: Paint): void {
    this.para(this.X(u0, v), this.Y(u0, v, z0), du, du / 2, 0, -dz, paint);
  }
  /** the +u face (screen-right, shaded): s along v, t up */
  right(u: number, v0: number, z0: number, dv: number, dz: number, paint: Paint): void {
    this.para(this.X(u, v0), this.Y(u, v0, z0), -dv, dv / 2, 0, -dz, paint);
  }
  /** a solid box: lit left face, shaded right face, top */
  box(u0: number, v0: number, z0: number, du: number, dv: number, dz: number, m: BoxMat): void {
    if (dz > 0) {
      this.left(u0, v0 + dv, z0, du, dz, m.left);
      this.right(u0 + du, v0, z0, dv, dz, m.right);
    }
    this.top(u0, v0, z0 + dz, du, dv, m.top);
  }
  /** an upright cylinder (barrels, pots, posts): elliptical top, shaded round side */
  cyl(
    u: number,
    v: number,
    z0: number,
    r: number,
    h: number,
    ramp: Ramp,
    topRamp: Ramp = ramp,
    band?: (t: number) => number | null,
  ): void {
    const cx = this.X(u, v),
      cy = this.Y(u, v, z0);
    const rx = r * 1.41,
      ry = r * 0.71;
    for (let y = Math.floor(cy - h - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        if (Math.abs(nx) > 1) continue;
        const half = ry * Math.sqrt(1 - nx * nx);
        const py = y + 0.5;
        const topC = cy - h,
          inTop = Math.abs(py - topC) <= half,
          inSide = py >= topC && py <= cy + half;
        if (inTop) {
          const ny = (py - topC) / Math.max(0.5, half);
          put(
            this.ctx,
            x,
            y,
            rampAt(topRamp, 0.78 - nx * 0.2 - ny * 0.15 - (Math.abs(nx) > 0.85 || Math.abs(ny) > 0.85 ? 0.2 : 0)),
          );
        } else if (inSide) {
          const t = 1 - (py - topC) / Math.max(1, h + half);
          const b = band?.(t);
          put(
            this.ctx,
            x,
            y,
            b ?? rampAt(ramp, 0.62 - nx * 0.42 - (t < 0.12 ? 0.12 : 0) - (Math.abs(nx) > 0.88 ? 0.12 : 0)),
          );
        }
      }
  }
  /** a line between two 3D points */
  line3(u0: number, v0: number, z0: number, u1: number, v1: number, z1: number, c: number): void {
    const x0 = this.X(u0, v0),
      y0 = this.Y(u0, v0, z0),
      x1 = this.X(u1, v1),
      y1 = this.Y(u1, v1, z1);
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++)
      put(this.ctx, Math.floor(x0 + ((x1 - x0) * i) / n), Math.floor(y0 + ((y1 - y0) * i) / n), c);
  }
  /** a single pixel at a 3D point */
  dot(u: number, v: number, z: number, c: number, w = 1, h = 1): void {
    put(this.ctx, Math.floor(this.X(u, v)), Math.floor(this.Y(u, v, z)), c, w, h);
  }
}

export interface BoxMat {
  top: Paint;
  left: Paint;
  right: Paint;
}

/** pick from a ramp by 0..1 */
export function rampAt(r: Ramp, t: number): number {
  return r[Math.max(0, Math.min(r.length - 1, Math.round(t * (r.length - 1))))]!;
}

/**
 * Standard material from a ramp: lit top with a bright front rim, mid left face, dark right face; vertical faces get a
 * darker foot (contact) and a lit top edge. `grain` adds planks/strata lines every n px along t.
 */
export function mat(r: Ramp, o: { grain?: number; noise?: number; rim?: boolean } = {}): BoxMat {
  const n = r.length - 1;
  const at = (i: number) => r[Math.max(0, Math.min(n, i))]!;
  const hi = n,
    mid = Math.max(0, n - 1),
    lo = Math.max(0, n - 3),
    sh = Math.max(0, n - 2);
  const jitter = (x: number, y: number) => (o.noise ? (((x * 73 + y * 151) % 17) / 17 < o.noise ? -1 : 0) : 0);
  return {
    top: (s, t, x, y) => (o.rim !== false && (t > 0.9 || s > 0.92) ? at(hi) : at(mid + jitter(x, y))),
    left: (s, t, x, y) =>
      t > 0.94
        ? at(hi)
        : t < 0.08
          ? at(lo)
          : o.grain && Math.round(t * 100) % o.grain === 0
            ? at(sh - 1)
            : at(sh + jitter(x, y)),
    right: (s, t, x, y) =>
      t > 0.94
        ? at(sh)
        : t < 0.08
          ? at(lo - 1)
          : o.grain && Math.round(t * 100) % o.grain === 0
            ? at(lo - 1)
            : at(lo + jitter(x, y)),
  };
}

export const WOODM: Ramp = [C.e0, C.e1, C.e2, C.e3, C.e4, C.e5];
export const DARKWOOD: Ramp = [C.ink, C.e0, C.e1, C.e2, C.e3, C.e4];
export const STONEM: Ramp = [C.night, C.slate, C.steel, C.mist, C.fog, C.pale];
export const IRONM: Ramp = [C.ink, C.night, C.slate, C.steel, C.mist, C.fog];

/** Per-face detail painter: c(k) is this face's base shade shifted k steps along the ramp (lighting stays correct). */
export type Detail = (
  s: number,
  t: number,
  c: (k: number) => number,
  x: number,
  y: number,
  lit: boolean,
) => number | null | undefined | false;
export interface PMat {
  ramp: Ramp;
  top?: Detail;
  front?: Detail;
  end?: Detail;
  rim?: boolean;
}

/**
 * A prop standing against a wall, described in its own terms: a runs along the wall (0..16 = one tile), b runs out from
 * the wall toward the room, z up. `facing` picks which wall it backs onto; the geometry is laid out for that wall.
 */
export class Prop {
  readonly iso: Iso;
  constructor(
    ctx: Ctx,
    ax: number,
    ay: number,
    public facing: Facing,
  ) {
    this.iso = new Iso(ctx, ax, ay - 8);
  }
  /** local (a, b) -> iso (u, v) */
  uv(a: number, b: number): [number, number] {
    return this.facing === 'sw' ? [a, b] : [b, a];
  }

  private shade(m: PMat, face: 'top' | 'L' | 'R', d?: Detail): Paint {
    const r = m.ramp,
      n = r.length - 1;
    const base = face === 'top' ? n - 1 : face === 'L' ? n - 2 : Math.max(0, n - 4);
    return (s, t, x, y) => {
      const lvl = (k: number) => r[Math.max(0, Math.min(n, base + k))]!;
      const got = d?.(s, t, lvl, x, y, face !== 'R');
      if (got !== undefined && got !== null && got !== false) return got;
      if (face === 'top') return m.rim !== false && (t > 0.9 || s > 0.92) ? lvl(1) : lvl(0);
      return t > 0.93 ? lvl(1) : t < 0.07 ? lvl(-1) : lvl(0);
    };
  }

  /** box from (a0,b0,z0) of size (da,db,dz) */
  box(a0: number, b0: number, z0: number, da: number, db: number, dz: number, m: PMat): void {
    const I = this.iso;
    if (this.facing === 'sw') {
      if (dz > 0) {
        I.left(a0, b0 + db, z0, da, dz, this.shade(m, 'L', m.front));
        I.right(a0 + da, b0, z0, db, dz, this.shade(m, 'R', m.end));
      }
      I.top(a0, b0, z0 + dz, da, db, this.shade(m, 'top', m.top));
    } else {
      if (dz > 0) {
        I.right(b0 + db, a0, z0, da, dz, this.shade(m, 'R', m.front));
        I.left(b0, a0 + da, z0, db, dz, this.shade(m, 'L', m.end));
      }
      const tp = this.shade(m, 'top', m.top && ((s, t, c, x, y, lit) => m.top!(t, s, c, x, y, lit)));
      I.top(b0, a0, z0 + dz, db, da, typeof tp === 'number' ? tp : (s, t, x, y) => tp(s, t, x, y));
    }
  }
  cyl(
    a: number,
    b: number,
    z0: number,
    r: number,
    h: number,
    ramp: Ramp,
    topRamp?: Ramp,
    band?: (t: number) => number | null,
  ): void {
    const [u, v] = this.uv(a, b);
    this.iso.cyl(u, v, z0, r, h, ramp, topRamp, band);
  }
  line(a0: number, b0: number, z0: number, a1: number, b1: number, z1: number, c: number): void {
    const [u0, v0] = this.uv(a0, b0),
      [u1, v1] = this.uv(a1, b1);
    this.iso.line3(u0, v0, z0, u1, v1, z1, c);
  }
  dot(a: number, b: number, z: number, c: number, w = 1, h = 1): void {
    const [u, v] = this.uv(a, b);
    this.iso.dot(u, v, z, c, w, h);
  }
  X(a: number, b: number): number {
    const [u, v] = this.uv(a, b);
    return this.iso.X(u, v);
  }
  Y(a: number, b: number, z: number): number {
    const [u, v] = this.uv(a, b);
    return this.iso.Y(u, v, z);
  }
}
