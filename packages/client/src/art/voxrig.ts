/**
 * A rig of rigid voxel parts (voxel.ts primitives) posed and projected in the game's 2:1 isometric view.
 *
 * Each part is voxelised once (surface voxels with their normals and colour ramps, in the part's own space, pivot at
 * the origin); a pose places every part with a rotation and a translation, and the whole figure is turned to a
 * heading and projected with a depth buffer. Rotating stored voxels is cheap, so a character's whole sheet (eight
 * headings, dozens of poses) costs a fraction of re-sampling the shapes per frame.
 *
 * Projection: screen x = u − v, screen y = (u + v) / 2 − z; depth (nearer the camera) = u + v + z.
 */
import { put, type Ctx } from './shade';
import type { Prim, Ramp } from './voxel';

export type M3 = [number, number, number, number, number, number, number, number, number];
export type V3 = [number, number, number];

export interface Part {
  /** surface voxels: position and normal in part space, and the ramp that colours them */
  pos: Float32Array;
  nrm: Float32Array;
  ramp: Ramp[];
  n: number;
}

const STEP = 0.5;

/**
 * Voxelise primitives into a part. `decals` paint onto the surface (eyes, buckles, seams) without adding shape: a
 * surface voxel inside a decal takes the decal's ramp.
 */
export function buildPart(prims: Prim[], decals: Prim[] = []): Part {
  if (!prims.length) return { pos: new Float32Array(0), nrm: new Float32Array(0), ramp: [], n: 0 };
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
  const dist = (a: number, b: number, z: number): number => {
    let best = Infinity;
    for (const p of prims) {
      const bx = p.box;
      if (
        a < bx[0] - 1.5 ||
        a > bx[3] + 1.5 ||
        b < bx[1] - 1.5 ||
        b > bx[4] + 1.5 ||
        z < bx[2] - 1.5 ||
        z > bx[5] + 1.5
      )
        continue;
      const d = p.d(a, b, z);
      if (d < best) best = d;
    }
    return best;
  };
  const owner = (a: number, b: number, z: number): Prim => {
    let best = Infinity,
      bp = prims[0]!;
    for (const p of prims) {
      const d = p.d(a, b, z);
      if (d < best) {
        best = d;
        bp = p;
      }
    }
    return bp;
  };
  const pos: number[] = [],
    nrm: number[] = [],
    ramp: Ramp[] = [];
  const sa = Math.round((a1 - a0) / STEP) + 3,
    sb = Math.round((b1 - b0) / STEP) + 3,
    sz = Math.round((z1 - z0) / STEP) + 3;
  // occupancy grid, then keep voxels with an empty neighbour
  const occ = new Uint8Array(sa * sb * sz);
  const at = (i: number, j: number, k: number) => (k * sb + j) * sa + i;
  for (let k = 0; k < sz; k++)
    for (let j = 0; j < sb; j++)
      for (let i = 0; i < sa; i++)
        if (dist(a0 - STEP + i * STEP, b0 - STEP + j * STEP, z0 - STEP + k * STEP) <= 0) occ[at(i, j, k)] = 1;
  for (let k = 1; k < sz - 1; k++)
    for (let j = 1; j < sb - 1; j++)
      for (let i = 1; i < sa - 1; i++) {
        if (!occ[at(i, j, k)]) continue;
        if (
          occ[at(i + 1, j, k)] &&
          occ[at(i - 1, j, k)] &&
          occ[at(i, j + 1, k)] &&
          occ[at(i, j - 1, k)] &&
          occ[at(i, j, k + 1)] &&
          occ[at(i, j, k - 1)]
        )
          continue;
        const a = a0 - STEP + i * STEP,
          b = b0 - STEP + j * STEP,
          z = z0 - STEP + k * STEP;
        const e = 0.55;
        let ga = dist(a + e, b, z) - dist(a - e, b, z),
          gb = dist(a, b + e, z) - dist(a, b - e, z),
          gz = dist(a, b, z + e) - dist(a, b, z - e);
        const n = Math.hypot(ga, gb, gz) || 1;
        ga /= n;
        gb /= n;
        gz /= n;
        let r: Ramp | null = null;
        for (const d of decals) if (d.d(a, b, z) <= 0) r = d.ramp(a, b, z);
        pos.push(a, b, z);
        nrm.push(ga, gb, gz);
        ramp.push(r ?? owner(a, b, z).ramp(a, b, z));
      }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), ramp, n: ramp.length };
}

// ───────────────────────── rotations ─────────────────────────

export const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export function mul(A: M3, B: M3): M3 {
  const o = new Array(9).fill(0) as M3;
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      o[r * 3 + c] = A[r * 3]! * B[c]! + A[r * 3 + 1]! * B[3 + c]! + A[r * 3 + 2]! * B[6 + c]!;
  return o;
}
export function apply(M: M3, v: V3): V3 {
  return [
    M[0] * v[0] + M[1] * v[1] + M[2] * v[2],
    M[3] * v[0] + M[4] * v[1] + M[5] * v[2],
    M[6] * v[0] + M[7] * v[1] + M[8] * v[2],
  ];
}
/** rotation about the a (forward) axis: a roll to the side */
export function rotA(t: number): M3 {
  const c = Math.cos(t),
    s = Math.sin(t);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}
/** rotation about the b (across) axis: positive tips the top forward (+a) */
export function rotB(t: number): M3 {
  const c = Math.cos(t),
    s = Math.sin(t);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}
/** rotation about z: a turn */
export function rotZ(t: number): M3 {
  const c = Math.cos(t),
    s = Math.sin(t);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}
/** the smallest rotation taking the part's −z axis (a hanging limb) onto direction d */
export function hang(d: V3): M3 {
  const l = Math.hypot(d[0], d[1], d[2]) || 1;
  const x = d[0] / l,
    y = d[1] / l,
    z = d[2] / l;
  // from f = (0, 0, −1) to t = (x, y, z): axis f × t = (y, −x, 0), cos = −z
  const c = -z;
  if (c > 0.99999) return I3;
  if (c < -0.99999) return [1, 0, 0, 0, -1, 0, 0, 0, -1];
  const ax = y,
    ay = -x,
    s = Math.hypot(ax, ay);
  const kx = ax / s,
    ky = ay / s,
    v = 1 - c;
  return [c + kx * kx * v, kx * ky * v, ky * s, ky * kx * v, c + ky * ky * v, -kx * s, -ky * s, kx * s, c];
}

/** two-bone IK: the joint between root r and target t (lengths l1, l2), bending toward `bend` */
export function ik(r: V3, t: V3, l1: number, l2: number, bend: V3): V3 {
  let dx = t[0] - r[0],
    dy = t[1] - r[1],
    dz = t[2] - r[2];
  let d = Math.hypot(dx, dy, dz) || 0.001;
  const max = l1 + l2 - 0.01;
  if (d > max) {
    dx *= max / d;
    dy *= max / d;
    dz *= max / d;
    d = max;
  }
  const ux = dx / d,
    uy = dy / d,
    uz = dz / d;
  // the bend direction, made perpendicular to the limb axis
  const bd = bend[0] * ux + bend[1] * uy + bend[2] * uz;
  let px = bend[0] - ux * bd,
    py = bend[1] - uy * bd,
    pz = bend[2] - uz * bd;
  const pl = Math.hypot(px, py, pz) || 1;
  px /= pl;
  py /= pl;
  pz /= pl;
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  return [r[0] + ux * along + px * h, r[1] + uy * along + py * h, r[2] + uz * along + pz * h];
}

// ───────────────────────── projection ─────────────────────────

export interface Placed {
  part: Part;
  R: M3;
  T: V3;
}

/** light from the upper left, in world (u, v, z) */
const L: V3 = (() => {
  const v: V3 = [-0.5, -0.12, 0.86];
  const n = Math.hypot(...v);
  return [v[0] / n, v[1] / n, v[2] / n];
})();

/**
 * Draw a posed figure into ctx: the figure's model space turned by `heading` (radians, from +u toward +v) and its
 * ground origin placed at (ax, ay). `scale` shrinks or grows the whole figure (children, giants).
 */
export function drawFigure(
  ctx: Ctx,
  w: number,
  h: number,
  placed: Placed[],
  heading: number,
  ax: number,
  ay: number,
  scale = 1,
  global: M3 = I3,
  globalT: V3 = [0, 0, 0],
): void {
  const ch = Math.cos(heading),
    sh = Math.sin(heading);
  const depth = new Float32Array(w * h).fill(-Infinity);
  const color = new Int16Array(w * h).fill(-1);
  const shadeK = new Uint8Array(w * h);
  const rampOf = new Array<Ramp | null>(w * h).fill(null);
  for (const pl of placed) {
    const { part } = pl;
    const R = mul(global, pl.R);
    const T = apply(global, pl.T);
    T[0] += globalT[0];
    T[1] += globalT[1];
    T[2] += globalT[2];
    for (let i = 0; i < part.n; i++) {
      const p: V3 = [part.pos[i * 3]!, part.pos[i * 3 + 1]!, part.pos[i * 3 + 2]!];
      const m = apply(R, p);
      const a = (m[0] + T[0]) * scale,
        b = (m[1] + T[1]) * scale,
        z = (m[2] + T[2]) * scale;
      const u = a * ch - b * sh,
        v = a * sh + b * ch;
      const dep = u + v + z;
      const px = Math.floor(ax + u - v),
        py = Math.floor(ay + (u + v) / 2 - z);
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      const k = py * w + px;
      if (dep <= depth[k]!) continue;
      const n = apply(R, [part.nrm[i * 3]!, part.nrm[i * 3 + 1]!, part.nrm[i * 3 + 2]!]);
      const nu = n[0] * ch - n[1] * sh,
        nv = n[0] * sh + n[1] * ch;
      const lit = nu * L[0] + nv * L[1] + n[2] * L[2];
      const ramp = part.ramp[i]!;
      const t = Math.max(0, Math.min(0.999, 0.46 + lit * 0.56));
      const ri = Math.floor(t * ramp.length);
      depth[k] = dep;
      color[k] = ramp[ri]!;
      shadeK[k] = ri;
      rampOf[k] = ramp;
    }
  }
  // soft contours where a nearer part overlaps a farther one: one step darker, never a hard black line
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (color[k]! < 0) continue;
      for (const j of [k + 1, k - 1, k + w, k - w]) {
        if (j < 0 || j >= w * h || color[j]! < 0) continue;
        if (depth[j]! - depth[k]! > 2.6) {
          const r = rampOf[k]!;
          color[k] = r[Math.max(0, shadeK[k]! - 1)]!;
          break;
        }
      }
    }
  for (let k = 0; k < w * h; k++) if (color[k]! >= 0) put(ctx, k % w, Math.floor(k / w), color[k]!);
}
