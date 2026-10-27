/**
 * A tiny signed-distance "voxel" modeller for creatures, drawn in the game's strict 2:1 isometric projection.
 *
 * A model is built once in its own space: a runs from tail to nose, b across the body, z up, one unit = one art pixel,
 * (0, 0, 0) the point on the ground under the middle of the animal. Primitives (ellipsoids, rounded boxes, capsules)
 * are unioned; the surface is sampled on a half-unit grid, lit from the upper left like the rest of the world, and
 * projected for each of the four screen headings with a depth buffer. Because every heading comes from the same 3D
 * model, a cow is the same cow from every side: same length, same legs, same patches.
 *
 * Projection (shared with isokit): screen x = u − v, screen y = (u + v) / 2 − z; the camera looks down (−1, −1, −1),
 * so depth (nearer the camera) is u + v + z.
 */
import { C, makeCanvas, outline, put } from './shade';

export type Ramp = readonly number[];
type V3 = [number, number, number];

export interface Prim {
  /** signed distance (negative inside) at model point (a, b, z) */
  d: (a: number, b: number, z: number) => number;
  /** the colour ramp at a surface point (lets a primitive carry patches, stripes, hooves) */
  ramp: (a: number, b: number, z: number) => Ramp;
  /** drawn on the front layer (over a rider) when it is nearer the camera than the saddle */
  front?: boolean;
  /** bounding box (a0, b0, z0, a1, b1, z1) */
  box: [number, number, number, number, number, number];
}

const fixed = (r: Ramp) => () => r;

export function ellipsoid(c: V3, r: V3, ramp: Ramp | Prim['ramp'], front = false): Prim {
  const m = Math.min(r[0], r[1], r[2]);
  return {
    d: (a, b, z) => (Math.hypot((a - c[0]) / r[0], (b - c[1]) / r[1], (z - c[2]) / r[2]) - 1) * m,
    ramp: typeof ramp === 'function' ? ramp : fixed(ramp),
    front,
    box: [c[0] - r[0], c[1] - r[1], c[2] - r[2], c[0] + r[0], c[1] + r[1], c[2] + r[2]],
  };
}

/** a box of half-extents h, its edges rounded by k */
export function rbox(c: V3, h: V3, k: number, ramp: Ramp | Prim['ramp'], front = false): Prim {
  return {
    d: (a, b, z) => {
      const qa = Math.abs(a - c[0]) - h[0] + k,
        qb = Math.abs(b - c[1]) - h[1] + k,
        qz = Math.abs(z - c[2]) - h[2] + k;
      return Math.hypot(Math.max(qa, 0), Math.max(qb, 0), Math.max(qz, 0)) + Math.min(Math.max(qa, qb, qz), 0) - k;
    },
    ramp: typeof ramp === 'function' ? ramp : fixed(ramp),
    front,
    box: [c[0] - h[0], c[1] - h[1], c[2] - h[2], c[0] + h[0], c[1] + h[1], c[2] + h[2]],
  };
}

/** a capsule from p to q, radius r0 at p tapering to r1 at q */
export function capsule(p: V3, q: V3, r0: number, ramp: Ramp | Prim['ramp'], r1 = r0, front = false): Prim {
  const ba: V3 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
  const l2 = ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2] || 1;
  const r = Math.max(r0, r1);
  return {
    d: (a, b, z) => {
      const pa: V3 = [a - p[0], b - p[1], z - p[2]];
      const h = Math.max(0, Math.min(1, (pa[0] * ba[0] + pa[1] * ba[1] + pa[2] * ba[2]) / l2));
      return Math.hypot(pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h) - (r0 + (r1 - r0) * h);
    },
    ramp: typeof ramp === 'function' ? ramp : fixed(ramp),
    front,
    box: [
      Math.min(p[0], q[0]) - r,
      Math.min(p[1], q[1]) - r,
      Math.min(p[2], q[2]) - r,
      Math.max(p[0], q[0]) + r,
      Math.max(p[1], q[1]) + r,
      Math.max(p[2], q[2]) + r,
    ],
  };
}

/** heading: 0 SE (+u), 1 SW (+v), 2 NW (−u), 3 NE (−v) */
export type Heading = 0 | 1 | 2 | 3;
/** model (a, b) to world (u, v) for a heading */
export function turn(h: Heading, a: number, b: number): [number, number] {
  return h === 0 ? [a, b] : h === 1 ? [-b, a] : h === 2 ? [-a, -b] : [b, -a];
}

/** light from the upper left, in world space */
const L: V3 = (() => {
  const v: V3 = [-0.55, -0.05, 0.83];
  const n = Math.hypot(...v);
  return [v[0] / n, v[1] / n, v[2] / n];
})();
const STEP = 0.5;

export interface Rendered {
  canvas: HTMLCanvasElement;
  /** the front layer (only the primitives marked front, where they are nearer than `frontDepth`) */
  front: HTMLCanvasElement | null;
}

/**
 * Render a model for a heading into a w × h canvas with the model origin at (ax, ay). With `frontDepth`, also render
 * the parts marked `front` that lie nearer the camera than that depth, for drawing over a rider.
 */
export function renderModel(
  prims: Prim[],
  heading: Heading,
  w: number,
  h: number,
  ax: number,
  ay: number,
  frontDepth?: number,
): Rendered {
  // sample bounds
  let a0 = Infinity,
    b0 = Infinity,
    z0 = Infinity,
    a1 = -Infinity,
    b1 = -Infinity,
    z1 = -Infinity;
  for (const p of prims) {
    a0 = Math.min(a0, p.box[0]);
    b0 = Math.min(b0, p.box[1]);
    z0 = Math.min(z0, p.box[2]);
    a1 = Math.max(a1, p.box[3]);
    b1 = Math.max(b1, p.box[4]);
    z1 = Math.max(z1, p.box[5]);
  }
  a0 -= 1;
  b0 -= 1;
  z0 = Math.max(0, z0 - 1);
  a1 += 1;
  b1 += 1;
  z1 += 1;
  const dist = (a: number, b: number, z: number): { d: number; p: Prim | null } => {
    let best = Infinity,
      bp: Prim | null = null;
    for (const p of prims) {
      const bx = p.box;
      // cheap reject: far outside this primitive's box
      if (a < bx[0] - 2 || a > bx[3] + 2 || b < bx[1] - 2 || b > bx[4] + 2 || z < bx[2] - 2 || z > bx[5] + 2) continue;
      const d = p.d(a, b, z);
      if (d < best) {
        best = d;
        bp = p;
      }
    }
    return { d: best, p: bp };
  };
  const depth = new Float32Array(w * h).fill(-Infinity);
  const color = new Int16Array(w * h).fill(-1);
  const isFront = new Uint8Array(w * h);
  const shade = new Uint8Array(w * h); // ramp step used, for the contour pass
  const rampOf: Ramp[] = [];
  const rampIdx = new Int16Array(w * h).fill(-1);
  for (let a = a0; a <= a1; a += STEP)
    for (let b = b0; b <= b1; b += STEP)
      for (let z = z0; z <= z1; z += STEP) {
        const { d, p } = dist(a, b, z);
        if (d > 0 || !p) continue;
        // surface voxels only: some neighbour is outside
        if (
          dist(a + STEP, b, z).d <= 0 &&
          dist(a - STEP, b, z).d <= 0 &&
          dist(a, b + STEP, z).d <= 0 &&
          dist(a, b - STEP, z).d <= 0 &&
          dist(a, b, z + STEP).d <= 0 &&
          (z - STEP < 0 || dist(a, b, z - STEP).d <= 0)
        )
          continue;
        const [u, v] = turn(heading, a, b);
        const px = Math.floor(ax + (u - v)),
          py = Math.floor(ay + (u + v) / 2 - z);
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        const dep = u + v + z;
        const i = py * w + px;
        if (dep <= depth[i]!) continue;
        // normal from the distance gradient, turned into world space
        const e = 0.6;
        const ga = dist(a + e, b, z).d - dist(a - e, b, z).d,
          gb = dist(a, b + e, z).d - dist(a, b - e, z).d,
          gz = dist(a, b, z + e).d - dist(a, b, z - e).d;
        const [nu, nv] = turn(heading, ga, gb);
        const n = Math.hypot(nu, nv, gz) || 1;
        const lit = (nu * L[0] + nv * L[1] + gz * L[2]) / n;
        const ramp = p.ramp(a, b, z);
        let ri = rampOf.indexOf(ramp);
        if (ri < 0) ri = rampOf.push(ramp) - 1;
        const t = Math.max(0, Math.min(0.999, 0.42 + lit * 0.62));
        const k = Math.floor(t * ramp.length);
        depth[i] = dep;
        color[i] = ramp[k]!;
        shade[i] = k;
        rampIdx[i] = ri;
        isFront[i] = p.front && frontDepth !== undefined && dep > frontDepth ? 1 : 0;
      }
  // contours: where a nearer part overlaps a farther one, darken the far side's edge (legs read apart from the body)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (color[i]! < 0) continue;
      for (const j of [i + 1, i - 1, i + w, i - w]) {
        if (j < 0 || j >= w * h || color[j]! < 0) continue;
        if (depth[j]! - depth[i]! > 3.5 && rampIdx[i]! >= 0) {
          const r = rampOf[rampIdx[i]!]!;
          color[i] = r[Math.max(0, shade[i]! - 2)]!;
          break;
        }
      }
    }
  const { canvas, ctx } = makeCanvas(w, h);
  for (let i = 0; i < w * h; i++) if (color[i]! >= 0) put(ctx, i % w, Math.floor(i / w), color[i]!);
  outline(ctx, w, h, C.ink);
  let front: HTMLCanvasElement | null = null;
  if (frontDepth !== undefined && isFront.some((f) => f)) {
    const f = makeCanvas(w, h);
    for (let i = 0; i < w * h; i++) if (isFront[i]) put(f.ctx, i % w, Math.floor(i / w), color[i]!);
    outline(f.ctx, w, h, C.ink);
    front = f.canvas;
  }
  return { canvas, front };
}

/** a smooth 3D hash-noise in [0, 1) for coat patches (stable for a given model point) */
export function patchNoise(a: number, b: number, z: number, seed: number): number {
  const s = (x: number) => {
    const t = Math.sin(x * 12.9898 + seed * 78.233) * 43758.5453;
    return t - Math.floor(t);
  };
  // a few soft blobs placed by the seed
  let v = 0;
  for (let k = 0; k < 6; k++) {
    const ca = (s(k + 1) - 0.5) * 22,
      cb = (s(k + 7) - 0.5) * 10,
      cz = 8 + s(k + 13) * 8,
      r = 3 + s(k + 19) * 3.2;
    v = Math.max(v, 1 - Math.hypot(a - ca, (b - cb) * 0.6, z - cz) / r);
  }
  return v;
}

/** a model scaled about its ground origin */
export function scaled(prims: Prim[], k: number): Prim[] {
  return prims.map((p) => ({
    ...p,
    d: (a: number, b: number, z: number) => p.d(a / k, b / k, z / k) * k,
    ramp: (a: number, b: number, z: number) => p.ramp(a / k, b / k, z / k),
    box: p.box.map((v) => v * k) as Prim['box'],
  }));
}
