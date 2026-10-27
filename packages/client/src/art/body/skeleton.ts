/**
 * The skeleton every person shares: two body types measured from the reference sheets, posed in the body's own 3D
 * space and projected with the game's camera.
 *
 * Scale (docs/CHARACTERS.md): a door opening is 34 px tall and a tile edge 1.2 m, so one vertical metre is about
 * 16.3 px. A man of 1.78 m stands 29 px, a woman of 1.68 m 28 px, crown to sole.
 *
 * Body space: a = forward, b = toward the body's right hand, z = up, in art pixels, origin on the ground between the
 * feet. The camera is the game's 2:1 projection: a body facing ground direction f (8 headings, 45° apart on the
 * ground) maps (a, b, z) to the ground point G = a·f + b·r (r = the body's right) and to the screen at
 * (X, Y) = (anchor.x + G.x, anchor.y + G.y / 2 − z). Nearness to the camera (for drawing order) is 0.866·G.y + 0.5·z.
 */
export type V3 = [number, number, number];
export type BodyType = 'male' | 'female';

export interface Dims {
  height: number;
  hipZ: number;
  hipHalf: number;
  thigh: number;
  shin: number;
  ankleZ: number;
  foot: number;
  shoulderZ: number;
  shoulderHalf: number;
  neckZ: number;
  upperArm: number;
  forearm: number;
  hand: number;
  /** limb radii: thigh top/knee, shin knee/ankle, upper arm, forearm */
  rThigh: [number, number];
  rShin: [number, number];
  rUpper: [number, number];
  rFore: [number, number];
  /** torso cross-section by height above the hips: [dz, half-width, half-depth] */
  torso: Array<[number, number, number]>;
}

export const DIMS: Record<BodyType, Dims> = {
  male: {
    height: 29,
    hipZ: 11,
    hipHalf: 1.6,
    thigh: 5.1,
    shin: 4.8,
    ankleZ: 1.2,
    foot: 2.2,
    shoulderZ: 19,
    shoulderHalf: 4.1,
    neckZ: 21,
    upperArm: 4.5,
    forearm: 4.1,
    hand: 1.05,
    rThigh: [1.75, 1.35],
    rShin: [1.35, 1.0],
    rUpper: [1.15, 1.05],
    rFore: [1.05, 0.9],
    torso: [
      [-1.4, 3.0, 1.9],
      [0, 3.3, 2.2],
      [1.6, 3.15, 2.0],
      [2.6, 3.1, 2.0],
      [4.6, 3.45, 2.3],
      [6.4, 3.9, 2.4],
      [7.4, 3.8, 2.2],
      [8.2, 2.8, 1.8],
      [9.0, 1.4, 1.2],
    ],
  },
  female: {
    height: 28,
    hipZ: 10.6,
    hipHalf: 1.75,
    thigh: 4.9,
    shin: 4.6,
    ankleZ: 1.1,
    foot: 1.9,
    shoulderZ: 18.2,
    shoulderHalf: 3.7,
    neckZ: 20,
    upperArm: 4.3,
    forearm: 3.9,
    hand: 0.95,
    rThigh: [1.75, 1.25],
    rShin: [1.25, 0.9],
    rUpper: [1.05, 0.95],
    rFore: [0.95, 0.82],
    torso: [
      [-1.4, 3.2, 2.0],
      [0, 3.6, 2.4],
      [1.2, 3.4, 2.1],
      [2.6, 2.75, 1.8],
      [4.4, 3.0, 2.6],
      [5.6, 3.2, 2.6],
      [6.8, 3.35, 2.1],
      [7.6, 2.5, 1.7],
      [8.4, 1.2, 1.1],
    ],
  },
};

/** the torso cross-section (half-width, half-depth) at `dz` above the hips */
export function torsoAt(d: Dims, dz: number): [number, number] {
  const t = d.torso;
  if (dz <= t[0]![0]) return [t[0]![1], t[0]![2]];
  for (let i = 1; i < t.length; i++)
    if (dz <= t[i]![0]) {
      const [z0, w0, d0] = t[i - 1]!,
        [z1, w1, d1] = t[i]!;
      const k = (dz - z0) / (z1 - z0);
      return [w0 + (w1 - w0) * k, d0 + (d1 - d0) * k];
    }
  return [t[t.length - 1]![1], t[t.length - 1]![2]];
}

/** The game's DIR_* (0 S, 1 N, 2 W, 3 E, 4 SW, 5 SE, 6 NW, 7 NE) as the reference's row order (S, SW, W, NW, N, NE, E, SE). */
export const REF_DIR = [0, 4, 2, 6, 1, 7, 3, 5] as const;
/** each game direction's facing on the ground plane (y toward the camera), radians */
export const HEADING = [90, 270, 180, 0, 135, 45, 225, 315].map((a) => (a * Math.PI) / 180);

export interface Frame {
  f: [number, number];
  r: [number, number];
}
export function frameOf(dir: number, twist = 0): Frame {
  const h = HEADING[((dir % 8) + 8) % 8]! + twist;
  const f: [number, number] = [Math.cos(h), Math.sin(h)];
  return { f, r: [-f[1], f[0]] };
}
export const AX = 16,
  AY = 45;
/** body space to screen (cell pixels), and nearness to the camera */
export function project(p: V3, fr: Frame): { x: number; y: number; depth: number } {
  const gx = p[0] * fr.f[0] + p[1] * fr.r[0],
    gy = p[0] * fr.f[1] + p[1] * fr.r[1];
  return { x: AX + gx, y: AY + gy / 2 - p[2], depth: 0.866 * gy + 0.5 * p[2] };
}

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];

/** two-bone IK: the joint between root r and target t (lengths l1, l2), bending toward `bend` */
export function ik(r: V3, t: V3, l1: number, l2: number, bend: V3): V3 {
  let d = sub(t, r);
  let dl = len(d) || 0.001;
  const max = l1 + l2 - 0.02;
  if (dl > max) {
    d = scale(d, max / dl);
    dl = max;
  }
  const u = scale(d, 1 / dl);
  const bd = bend[0] * u[0] + bend[1] * u[1] + bend[2] * u[2];
  let p = sub(bend, scale(u, bd));
  const pl = len(p) || 1;
  p = scale(p, 1 / pl);
  const along = (l1 * l1 - l2 * l2 + dl * dl) / (2 * dl);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  return add(add(r, scale(u, along)), scale(p, h));
}
/** where the far end of a bone reaching for `t` actually lands (the limb cannot stretch) */
export function reach(r: V3, t: V3, l: number): V3 {
  const d = sub(t, r),
    dl = len(d);
  return dl <= l ? t : add(r, scale(d, l / dl));
}

/**
 * A pose: where the body is and what its hands and feet do. Everything else (knees, elbows, shoulders) follows.
 */
export interface Pose {
  /** hip centre */
  pelvis: V3;
  /** torso pitch forward (rad), the shoulders' turn against the hips (rad, + toward the body's right), roll */
  lean: number;
  twist: number;
  roll: number;
  /** extra lift of the shoulders (breathing, shrug) */
  shrug: number;
  handL: V3;
  handR: V3;
  footL: V3;
  footR: V3;
  /** feet's toe direction in body space (default forward) */
  toeL?: V3;
  toeR?: V3;
  /** which way the elbows and knees bend (defaults: elbows back, knees forward) */
  elbowL?: V3;
  elbowR?: V3;
  kneeL?: V3;
  kneeR?: V3;
  /** a held tool's shaft direction from the hand in body space, and which hand holds it */
  tool?: { hand: 'L' | 'R'; dir: V3 };
  /** the whole figure tipped over (falling): pitch (rad) about the feet toward `fallDir` (body space, default backward) */
  fall?: number;
  fallDir?: [number, number];
  /** turn the whole body away from its facing (rad), e.g. a twisting swing */
  yaw?: number;
  /** a forward roll: the whole figure turned head-over-heels (rad) about a point `spinZ` above the ground */
  spin?: number;
  spinZ?: number;
}

/** Standing at rest: feet under the hips, hands by the thighs. */
export function restPose(d: Dims): Pose {
  const handZ = d.shoulderZ - d.upperArm - d.forearm + 0.5;
  return {
    pelvis: [0, 0, d.hipZ - 0.3],
    lean: 0,
    twist: 0,
    roll: 0,
    shrug: 0,
    handL: [0.3, -(d.shoulderHalf + 0.5), handZ],
    handR: [0.3, d.shoulderHalf + 0.5, handZ],
    footL: [0, -d.hipHalf, 0],
    footR: [0, d.hipHalf, 0],
  };
}

/** The walk (8 frames, phase in 0..1) and the run, after the reference's gait: heel strike, a passing step with the
 * body at its highest, opposite arm forward. */
export function gaitPose(d: Dims, phase: number, run: boolean): Pose {
  const p = restPose(d);
  const a = phase * Math.PI * 2;
  const s = Math.sin(a),
    c = Math.cos(a);
  const stride = run ? 4.4 : 3.0,
    lift = run ? 2.6 : 1.3;
  // left leg leads when s > 0; a foot lifts while it swings forward (cos > 0 for the left)
  p.footL = [stride * s, -d.hipHalf * 0.95, Math.max(0, c) * lift];
  p.footR = [-stride * s, d.hipHalf * 0.95, Math.max(0, -c) * lift];
  // the body rides highest as the legs pass, lowest at the stride's reach
  const drop = run ? 1.3 : 0.7;
  p.pelvis = [run ? 0.6 : 0.2, 0, d.hipZ - 0.2 - drop * Math.abs(s) + (run ? 0.6 * Math.abs(c) : 0)];
  p.lean = run ? 0.28 : 0.05;
  p.twist = -s * (run ? 0.22 : 0.12);
  // arms swing against the legs; running arms bend at the elbow
  const sw = run ? 3.4 : 2.0;
  const hz = run ? d.shoulderZ - d.upperArm * 0.9 : d.shoulderZ - d.upperArm - d.forearm + 0.8;
  p.handL = [
    -sw * s + (run ? 2.2 : 0.3),
    -(d.shoulderHalf + (run ? 0.1 : 0.4)),
    hz + (run ? Math.max(0, -s) * 1.6 : 0),
  ];
  p.handR = [sw * s + (run ? 2.2 : 0.3), d.shoulderHalf + (run ? 0.1 : 0.4), hz + (run ? Math.max(0, s) * 1.6 : 0)];
  if (run) {
    p.elbowL = [-1, -0.2, -0.3];
    p.elbowR = [-1, 0.2, -0.3];
  }
  return p;
}

/** the body's joints in body space, once a pose is solved */
export interface Joints {
  pelvis: V3;
  hipL: V3;
  hipR: V3;
  kneeL: V3;
  kneeR: V3;
  ankleL: V3;
  ankleR: V3;
  toeL: V3;
  toeR: V3;
  neck: V3;
  chest: V3;
  shoulderL: V3;
  shoulderR: V3;
  elbowL: V3;
  elbowR: V3;
  wristL: V3;
  wristR: V3;
}

/** rotate a body-space vector about z by `t` (a twist toward the body's right for t > 0) */
function yaw(v: V3, t: number): V3 {
  const c = Math.cos(t),
    s = Math.sin(t);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
}

export function solve(d: Dims, p: Pose): Joints {
  const pel = p.pelvis;
  // the spine: up from the pelvis, pitched forward by the lean
  const up = (h: number): V3 => [
    pel[0] + Math.sin(p.lean) * h,
    pel[1] + Math.sin(p.roll) * h,
    pel[2] + Math.cos(p.lean) * h,
  ];
  const shoulderH = d.shoulderZ - d.hipZ + p.shrug,
    neckH = d.neckZ - d.hipZ + p.shrug * 0.5;
  const chest = up(shoulderH - 1.5),
    neck = up(neckH);
  const sAt = (side: number): V3 => {
    const o = yaw([0, side * d.shoulderHalf, 0], p.twist);
    const base = up(shoulderH);
    return [base[0] + o[0], base[1] + o[1], base[2] + o[2]];
  };
  const shoulderL = sAt(-1),
    shoulderR = sAt(1);
  const hipL: V3 = [pel[0], pel[1] - d.hipHalf, pel[2]],
    hipR: V3 = [pel[0], pel[1] + d.hipHalf, pel[2]];
  const legs = (hip: V3, foot: V3, bend: V3 | undefined, toe: V3 | undefined) => {
    const ankle: V3 = [foot[0], foot[1], foot[2] + d.ankleZ];
    const a = reach(hip, ankle, d.thigh + d.shin - 0.02);
    const knee = ik(hip, a, d.thigh, d.shin, bend ?? [1, 0, 0]);
    const t = toe ?? [1, 0, 0];
    const tl = Math.hypot(t[0], t[1], t[2]) || 1;
    const toeP: V3 = [a[0] + (t[0] / tl) * d.foot, a[1] + (t[1] / tl) * d.foot, Math.max(0.3, a[2] - d.ankleZ + 0.4)];
    return { knee, ankle: a, toe: toeP };
  };
  const L = legs(hipL, p.footL, p.kneeL, p.toeL),
    R = legs(hipR, p.footR, p.kneeR, p.toeR);
  const arm = (sh: V3, hand: V3, bend: V3 | undefined, side: number) => {
    const w = reach(sh, hand, d.upperArm + d.forearm - 0.02);
    const elbow = ik(sh, w, d.upperArm, d.forearm, bend ?? [-0.8, side * 0.35, -0.2]);
    return { elbow, wrist: w };
  };
  const AL = arm(shoulderL, p.handL, p.elbowL, -1),
    AR = arm(shoulderR, p.handR, p.elbowR, 1);
  const j: Joints = {
    pelvis: pel,
    hipL,
    hipR,
    kneeL: L.knee,
    kneeR: R.knee,
    ankleL: L.ankle,
    ankleR: R.ankle,
    toeL: L.toe,
    toeR: R.toe,
    neck,
    chest,
    shoulderL,
    shoulderR,
    elbowL: AL.elbow,
    elbowR: AR.elbow,
    wristL: AL.wrist,
    wristR: AR.wrist,
  };
  // a fall tips the whole body backward about the feet; a yaw turns it in place
  if (p.fall || p.yaw || p.spin) {
    const f = p.fall ?? 0,
      cf = Math.cos(f),
      sf = Math.sin(f);
    for (const k of Object.keys(j) as Array<keyof Joints>) {
      let v = j[k];
      if (p.yaw) v = yaw(v, p.yaw);
      if (f) {
        const [ua, ub] = p.fallDir ?? [-1, 0];
        const s = v[0] * ua + v[1] * ub,
          s2 = s * cf + v[2] * sf;
        v = [v[0] + ua * (s2 - s), v[1] + ub * (s2 - s), Math.max(0.4, -s * sf + v[2] * cf)];
      }
      if (p.spin) {
        const zc = p.spinZ ?? 4.5,
          cs = Math.cos(p.spin),
          sn = Math.sin(p.spin);
        v = [v[0] * cs + (v[2] - zc) * sn, v[1], Math.max(0.4, zc - v[0] * sn + (v[2] - zc) * cs)];
      }
      j[k] = v;
    }
  }
  return j;
}
