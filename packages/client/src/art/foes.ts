import { ART_RGB } from './creature-pixels';
import { wildDef } from './fauna';
import type { Texture } from 'pixi.js';
import {
  D4_YAW,
  Scene,
  Sheet,
  I3,
  add,
  lerp3,
  ramp,
  rampOf,
  rotX,
  rotY,
  rotZ,
  type Mat,
  type Ramp,
  type V3,
} from './sprite';

/**
 * Creatures — fauna (Meadow Rabbit, Eigendeer) and meadow foes (Wisp Slime, Glint Hopper, Phase Wisp, Decoherent
 * Brute, Static Mite) plus orb projectiles — modelled once (see sprite.ts) and rendered in the four iso diagonals
 * (SE, SW, NE, NW) with day and night variants. Every kind has the same animation set (idle, move, windup, attack,
 * hurt, death); frames are baked lazily per kind into one sheet (rows = facings).
 */
export type Anim = 'idle' | 'move' | 'windup' | 'attack' | 'hurt' | 'death';
export const ANIMS: Anim[] = ['idle', 'move', 'windup', 'attack', 'hurt', 'death'];
export type CritterKind =
  | 'slime'
  | 'hopper'
  | 'rabbit'
  | 'deer'
  | 'wisp'
  | 'brute'
  | 'mite'
  | 'fox'
  | 'otter'
  | 'tortoise'
  | 'owl'
  | 'thornling'
  | 'glasscrawler'
  | 'reed_stalker'
  | 'cinder_moth'
  | 'echo_bat'
  | 'spore_sage'
  | 'prism_beetle'
  | 'blind_ram'
  | 'rime_skitter'
  | 'pool_lurker'
  | 'vault_guardian'
  | 'spore_matriarch'
  | 'bellkeeper';

interface Def {
  w: number;
  h: number;
  ay?: number;
  /** frames per animation */
  n: Record<Anim, number>;
  /** draw one frame: k = frame index, t = k / n (0..1) */
  draw(s: Scene, a: Anim, k: number, t: number, night: boolean): void;
  /** soft shadow radii (art px) */
  shadow: [number, number];
}

const TAU = Math.PI * 2;
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const M = (r: Ramp, o: Partial<Mat> = {}): Mat => ({ r, ...o });

// ───────────────────────── shared leg rig ─────────────────────────

/**
 * Two-segment leg from joint `j` to hoof `f`; the knee bows forward (`bend` > 0) or backward (hocks).
 */
function leg(
  s: Scene,
  j: V3,
  f: V3,
  r0: number,
  r1: number,
  bend: number,
  mat: Mat,
  foot?: { mat: Mat; r: number },
): void {
  const mid = lerp3(j, f, 0.5);
  const len = Math.hypot(f[0] - j[0], f[2] - j[2]);
  const knee: V3 = [mid[0] + bend * Math.max(0.6, 3.2 - len * 0.18), mid[1], mid[2]];
  const p = s.newPart();
  s.cap(j, knee, r0, (r0 + r1) / 2, mat, p);
  s.cap(knee, f, (r0 + r1) / 2, r1, mat, p);
  if (foot) s.sph(add(f, [0.2, 0, foot.r * 0.4]), foot.r, foot.mat, p);
}

/** foot target for a gait: phase ph (0..1), stride, lift */
function gait(ph: number, stride: number, lift: number): [number, number] {
  const a = ph * TAU;
  const dx = Math.sin(a) * stride;
  const dz = Math.max(0, Math.cos(a)) * lift;
  return [dx, dz];
}

// ───────────────────────── Eigendeer (stag) ─────────────────────────

const DEER = ramp(ART_RGB.r2, 3, 2, { hue: 12 });
const DEER_CREAM = ramp(ART_RGB.e6, 2, 1, { hue: 9 });
const ANTLER = ramp(ART_RGB.r0, 2, 2, { hue: 8, step: 0.09 });
const HOOF = rampOf([ART_RGB.ink, ART_RGB.e0, ART_RGB.e0], 1);
const DEER_DARK = rampOf(DEER.c.slice(0, 4) as number[], 2);
const DEER_SNOUT: Mat = M(ramp(ART_RGB.r4, 2, 1, { hue: 10 }));

const deerDef: Def = {
  w: 46,
  h: 44,
  n: { idle: 6, move: 6, windup: 1, attack: 1, hurt: 1, death: 7 },
  shadow: [11, 4],
  draw(s, a, k, t) {
    const body = M(DEER),
      cream = M(DEER_CREAM),
      far = M(DEER_DARK),
      hoof = M(HOOF);
    const antM = M(ANTLER),
      antFar = M(rampOf(ANTLER.c.slice(0, 3) as number[], 1));
    let bob = 0,
      pitch = 0,
      headDrop = 0,
      earFlick = 0,
      roll = 0,
      sink = 0,
      legFold = 0,
      headUp = 0,
      tailUp = 0;
    let legs: Array<[number, number]> = [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ]; // LF RF LH RH (dx, lift)
    if (a === 'idle') {
      bob = k === 2 || k === 3 ? 0.5 : 0;
      headDrop = k === 4 ? 0.8 : 0;
      earFlick = k === 1 ? 1 : 0;
      tailUp = k === 5 ? 1 : 0;
    } else if (a === 'move') {
      legs = [gait(t, 3.4, 2.4), gait(t + 0.12, 3.4, 2.4), gait(t + 0.5, 3.8, 2.6), gait(t + 0.62, 3.8, 2.6)];
      pitch = Math.sin(t * TAU + 0.6) * 0.09;
      bob = Math.abs(Math.cos(t * TAU)) * 1.3 - 0.3;
      tailUp = 1;
    } else if (a === 'hurt') {
      pitch = -0.14;
      headUp = 1.6;
      bob = 0.6;
      tailUp = 1;
    } else if (a === 'windup' || a === 'attack') {
      headDrop = 2;
      pitch = 0.06;
    } else if (a === 'death') {
      const p = k / (this.n.death - 1);
      headUp = k === 0 ? 1.6 : 0;
      legFold = ease(clamp01(p * 2.2));
      sink = legFold * 4;
      roll = ease(clamp01((p - 0.35) / 0.5)) * 1.4;
      headDrop = ease(clamp01((p - 0.5) / 0.5)) * 3;
    }
    s.push(rotX(roll), [0, -4.5, 0]);
    s.push(rotY(pitch), [0, 0, 11], [0, 0, bob - sink]);
    const hipZ = 7.4;
    const legDefs: Array<{ x: number; y: number; front: boolean; i: number }> = [
      { x: 7.2, y: 2.3, front: true, i: 0 },
      { x: 7.2, y: -2.3, front: true, i: 1 },
      { x: -7.6, y: 2.5, front: false, i: 2 },
      { x: -7.6, y: -2.5, front: false, i: 3 },
    ];
    for (const L of legDefs) {
      const [dx, lift] = legs[L.i]!;
      const foot: V3 =
        legFold > 0
          ? [
              L.x + (L.front ? 3 : -2) * legFold,
              L.y * (1 + legFold * 0.5),
              Math.max(0.6, 0.9 + (hipZ - 4) * legFold * 0.7 - (bob - sink)),
            ]
          : [L.x + dx, L.y, 0.7 + lift - (bob - sink)];
      leg(s, [L.x, L.y * 0.8, hipZ + 1], foot, L.front ? 1.5 : 1.8, 0.95, L.front ? -0.4 : 0.6, L.y < 0 ? far : body, {
        mat: hoof,
        r: 1.05,
      });
    }
    // barrel body: haunch, belly, chest (cream bib on the front)
    s.ell([-7.0, 0, 11.2], [4.6, 4.4, 4.8], body);
    s.ell([0, 0, 10.8], [10.6, 4.4, 4.7], body);
    s.ell([6.6, 0, 11.4], [4.6, 4.2, 5.2], (q) => (q[0] > 0.7 && q[2] < 0.5 && Math.abs(q[1]) < 0.55 ? cream : body));
    // tail flick
    s.ell(
      [-11.2, 0, 13.8 + tailUp * 0.6],
      [1.6, 1.3, 2.1],
      (q) => (q[0] < -0.3 || q[2] > 0.6 ? cream : body),
      rotY(0.7 - tailUp * 0.4),
    );
    // short thick neck, head sitting high on the chest
    const hz = 17.6 - headDrop + headUp;
    const hx = 11.6 + headDrop * 0.5;
    s.cap([8.0, 0, 13.2], [hx - 1.0, 0, hz - 0.8], 3.3, 2.5, body);
    s.push(rotY(0.25 + headDrop * 0.15), [hx, 0, hz]);
    s.ell([hx, 0, hz], [3.1, 2.4, 2.4], body);
    s.ell([hx + 2.5, 0, hz - 0.5], [1.7, 1.5, 1.4], (q) => (q[0] > 0.45 ? DEER_SNOUT : body));
    s.dot([hx + 4.1, 0, hz - 0.4], ART_RGB.ink, 1, 1, 2.5);
    s.pop();
    const eUp = earFlick ? 0.8 : 0;
    s.ell([hx - 1.1, 2.6, hz + 1.5 + eUp], [0.9, 1.6, 0.8], body, rotX(0.45 + eUp * 0.6));
    s.ell([hx - 1.1, -2.6, hz + 1.5], [0.9, 1.6, 0.8], far, rotX(-0.45));
    s.dot([hx + 1.1, 2.1, hz + 0.5], ART_RGB.ink, 1, 1, 1.8);
    s.dot([hx + 1.1, -2.1, hz + 0.5], ART_RGB.ink, 1, 1, 1.8);
    // antlers: a wide crown of chunky beams with tines
    for (const side of [1, -1]) {
      const m = side > 0 ? antM : antFar;
      const p = s.newPart();
      // beams sweep up and back, tines rake forward: reads as a wide crown from every side
      const c0: V3 = [hx - 0.8, side * 1.3, hz + 2.0];
      const c1: V3 = [hx - 2.6, side * 3.6, hz + 4.6];
      const c2: V3 = [hx - 5.4, side * 5.2, hz + 7.4];
      const c3: V3 = [hx - 8.6, side * 5.8, hz + 9.6];
      s.cap(c0, c1, 0.95, 0.85, m, p);
      s.cap(c1, c2, 0.85, 0.75, m, p);
      s.cap(c2, c3, 0.75, 0.55, m, p);
      s.cap(c1, [hx + 0.6, side * 4.6, hz + 7.4], 0.6, 0.5, m, p); // brow tine
      s.cap(lerp3(c1, c2, 0.7), [hx - 1.8, side * 6.4, hz + 10.4], 0.6, 0.5, m, p); // fore tine
      s.cap(c2, [hx - 4.4, side * 6.0, hz + 11.4], 0.55, 0.5, m, p); // top tine
      s.cap(lerp3(c2, c3, 0.6), [hx - 7.0, side * 5.4, hz + 12.0], 0.5, 0.45, m, p); // rear tine
    }
    s.pop();
    s.pop();
  },
};

// ───────────────────────── Meadow Rabbit ─────────────────────────

const RABBIT = ramp(ART_RGB.e4, 3, 2, { hue: 10 });
const RABBIT_FAR = rampOf(RABBIT.c.slice(0, 4) as number[], 2);
const RABBIT_CREAM = ramp(ART_RGB.e6, 2, 1);
const TAIL_WHITE = ramp(ART_RGB.e7, 2, 1, { step: 0.08 });
const PINK = ART_RGB.r3;

const rabbitDef: Def = {
  w: 26,
  h: 24,
  n: { idle: 4, move: 4, windup: 1, attack: 1, hurt: 1, death: 5 },
  shadow: [6, 2],
  draw(s, a, k) {
    const fur = M(RABBIT),
      far = M(RABBIT_FAR),
      cream = M(RABBIT_CREAM),
      white = M(TAIL_WHITE);
    let air = 0,
      pitch = 0,
      stretch = 0,
      ear = 0,
      roll = 0,
      nose = 0;
    if (a === 'idle') {
      ear = k === 2 ? 1 : 0;
      nose = k % 2;
    } else if (a === 'move') {
      air = [0, 2.2, 3.2, 0.6][k]!;
      pitch = [0.15, -0.35, 0.05, 0.3][k]!;
      stretch = [-0.3, 0.5, 0.3, -0.2][k]!;
    } else if (a === 'hurt') {
      pitch = -0.3;
      ear = -1;
    } else if (a === 'death') {
      const p = k / (this.n.death - 1);
      roll = ease(clamp01(p * 1.4)) * 1.5;
      air = k === 0 ? 1.5 : 0;
      ear = -1;
    }
    s.push(rotX(roll), [0, -2.5, 0]);
    s.push(rotY(pitch), [0, 0, 3], [0, 0, air]);
    const L = 1 + stretch * 0.25;
    s.ell([-2.0 * L, 0, 3.8], [2.9, 3.0, 3.0 - stretch * 0.4], fur);
    s.ell([0.2, 0, 4.0], [3.8 * L, 2.7, 2.9 - stretch * 0.3], (q) => (q[2] < -0.55 ? cream : fur));
    s.sph([-4.6 * L, 0, 5.0], 1.2, white);
    for (const sd of [1, -1]) {
      s.ell([-2.0 * L + stretch * -1.5, sd * 2.2, 0.8], [2.0, 0.85, 0.8], sd < 0 ? far : fur);
      s.cap([2.6 * L, sd * 1.2, 3.0], [3.0 * L + stretch * 2, sd * 1.2, 0.6], 0.7, 0.6, sd < 0 ? far : fur);
    }
    const hx = 3.9 * L,
      hz = 6.4;
    s.ell([hx, 0, hz], [2.3, 2.0, 2.1], (q) => (q[0] > 0.6 && q[2] < -0.1 ? cream : fur));
    for (const sd of [1, -1]) {
      const tip: V3 =
        ear < 0 ? [hx - 4.2, sd * 1.8, hz + 2.2] : [hx - 1.6 - (ear && sd > 0 ? -0.8 : 0), sd * 1.3, hz + 6.2];
      s.cap([hx - 0.8, sd * 0.9, hz + 1.4], tip, 0.8, 0.6, sd < 0 ? far : fur);
      if (sd > 0 && ear >= 0) s.dot(lerp3([hx - 0.6, sd * 1.5, hz + 2.2], tip, 0.5), PINK, 1, 1, 0.9);
    }
    s.dot([hx + 1.1, 1.75, hz + 0.6], ART_RGB.ink, 1, 1, 1.5);
    s.dot([hx + 1.1, -1.75, hz + 0.6], ART_RGB.ink, 1, 1, 1.5);
    s.dot([hx + 2.25, 0, hz - 0.2 + nose * 0.3], PINK, 1, 1, 1.6);
    s.pop();
    s.pop();
  },
};

// ───────────────────────── Wisp Slime ─────────────────────────

const GEL = ramp(ART_RGB.w3, 3, 3, { hue: 10 });
const GEL_N = ramp(ART_RGB.q3, 3, 3, { hue: 10 });
const GEL_CORE = [ART_RGB.w7, ART_RGB.w6];
const GEL_CORE_N = [ART_RGB.white, ART_RGB.q6];

const slimeDef: Def = {
  w: 28,
  h: 26,
  n: { idle: 4, move: 4, windup: 2, attack: 2, hurt: 1, death: 6 },
  shadow: [8, 3],
  draw(s, a, k, t, night) {
    const gel = M(night ? GEL_N : GEL, { shiny: true });
    const deep = M(rampOf((night ? GEL_N : GEL).c.slice(0, 4) as number[], 1));
    let sq = 0,
      lean = 0,
      lift = 0,
      fwd = 0,
      melt = 0,
      open = false;
    if (a === 'idle') sq = Math.sin(t * TAU) * 0.1;
    else if (a === 'move') {
      sq = [0.28, -0.22, -0.12, 0.32][k]!;
      lift = [0, 2, 3, 0][k]!;
      lean = [0.1, 0.25, 0.1, -0.05][k]!;
    } else if (a === 'windup') {
      sq = 0.32 + k * 0.1;
      lean = -0.22 - k * 0.08;
    } else if (a === 'attack') {
      sq = -0.28 + k * 0.2;
      lean = 0.38;
      fwd = 2.5 - k;
      open = true;
    } else if (a === 'hurt') {
      sq = 0.24;
      lean = -0.3;
    } else if (a === 'death') {
      melt = k / (this.n.death - 1);
      sq = 0.3 + melt * 0.62;
    }
    const R = 6.8 * (1 - melt * 0.25);
    const rz = R * (1 - sq),
      rxy = R * (1 + sq * 0.55);
    s.ell([fwd * 0.5, 0, 0.5], [rxy + 1.2, rxy + 1.0, 0.7 + melt * 0.6], deep);
    if (melt < 0.95) {
      s.push(rotY(lean), [0, 0, 0], [fwd, 0, lift]);
      s.ell([0, 0, rz * 0.95], [rxy, rxy * 0.94, rz], gel);
      // the wisp-core floats inside and shows through the jelly
      const core = night ? GEL_CORE_N : GEL_CORE;
      const cz = rz * (0.85 + 0.12 * Math.sin(t * TAU));
      s.glowPx([0.3, 0, cz], core[1]!, 2, 2);
      s.glowPx([0.3, 0, cz + 0.5], core[0]!, 1, 1);
      if (melt < 0.5) {
        const ez = rz * 1.15;
        for (const sd of [1, -1]) s.dot([rxy * 0.8, sd * 2.3, ez], ART_RGB.ink, 1, 2, 2.4);
        if (open) s.dot([rxy * 0.92, 0, ez - 2.2], ART_RGB.e0, 2, 1, 2.4);
      }
      s.pop();
    }
    if (melt > 0.3)
      for (let i = 0; i < 3; i++)
        s.glowPx([Math.sin(i * 2.1) * 4, Math.cos(i * 1.7) * 3, 3 + melt * 6 + i * 2.5], (night ? GEL_N : GEL).c[5]!);
  },
};

// ───────────────────────── Glint Hopper ─────────────────────────

const HOP = ramp(ART_RGB.e4, 3, 2, { hue: 11 });
const HOP_N = ramp(ART_RGB.e2, 3, 2, { hue: 10 });
const HOP_CREAM = ramp(ART_RGB.e6, 2, 1);
const HOP_CREAM_N = ramp(ART_RGB.e5, 2, 1);
const CRYSTAL = ramp(ART_RGB.w4, 3, 3, { hue: 9 });
const CRYSTAL_N = ramp(ART_RGB.q5, 3, 3, { hue: 9 });

const hopperDef: Def = {
  w: 32,
  h: 30,
  n: { idle: 4, move: 4, windup: 2, attack: 2, hurt: 1, death: 6 },
  shadow: [8, 3],
  draw(s, a, k, _t, night) {
    const fur = M(night ? HOP_N : HOP),
      far = M(rampOf((night ? HOP_N : HOP).c.slice(0, 4) as number[], 2));
    const cream = M(night ? HOP_CREAM_N : HOP_CREAM),
      cry = M(night ? CRYSTAL_N : CRYSTAL, { shiny: true, bias: 0.6 });
    let air = 0,
      squat = 0,
      pitch = 0,
      roll = 0,
      ear = 0,
      glint = k % 2;
    if (a === 'idle') {
      squat = k === 1 || k === 2 ? 0.6 : 0;
      ear = k === 3 ? 1 : 0;
    } else if (a === 'move') {
      air = [0, 2.5, 3.5, 0.8][k]!;
      squat = [1.2, -0.5, -0.3, 0.8][k]!;
      pitch = [0.1, -0.3, 0, 0.25][k]!;
    } else if (a === 'windup') {
      squat = 2.0 + k * 0.6;
      pitch = 0.2;
      glint = 1;
    } else if (a === 'attack') {
      air = 4 - k * 2;
      squat = -0.8;
      pitch = -0.35 + k * 0.5;
    } else if (a === 'hurt') {
      pitch = -0.35;
      ear = -1;
    } else if (a === 'death') {
      const p = k / (this.n.death - 1);
      roll = ease(clamp01(p * 1.5)) * 1.55;
      ear = -1;
      glint = 0;
    }
    s.push(rotX(roll), [0, -4, 0]);
    s.push(rotY(pitch), [0, 0, 4], [0, 0, air - squat * 0.6]);
    const bz = 6.6 - squat * 0.4;
    for (const sd of [1, -1]) {
      s.ell([-2.6, sd * 3.9, 3.4 + squat * 0.2], [3.6, 1.7, 2.7], sd < 0 ? far : fur, rotY(-0.3));
      s.ell([-1.4, sd * 3.6, 0.8], [2.6, 1.1, 0.8], sd < 0 ? far : fur);
      s.cap(
        [3.2, sd * 2.0, bz - 2],
        [4.0 + (air > 1 ? 1.5 : 0), sd * 2.2, 0.7 + (air > 1 ? 1 : 0)],
        1.0,
        0.9,
        sd < 0 ? far : fur,
      );
    }
    s.ell([0, 0, bz], [5.2, 4.4, 4.6 + squat * -0.4], (q) => (q[2] < -0.45 && q[0] > -0.3 ? cream : fur));
    const hx = 4.4,
      hz = bz + 2.4;
    s.ell([hx, 0, hz], [3.0, 3.2, 2.8], (q) => (q[0] > 0.55 && q[2] < -0.2 ? cream : fur));
    for (const sd of [1, -1]) {
      const tip: V3 = ear < 0 ? [hx - 5.5, sd * 4.5, hz + 1.5] : [hx - 3.2 + ear, sd * 4.2, hz + 6.4];
      const base: V3 = [hx - 1, sd * 2.0, hz + 2.0];
      const mid = lerp3(base, tip, 0.5);
      s.ell(
        mid,
        [1.0, 1.5, Math.hypot(tip[0] - base[0], tip[2] - base[2]) * 0.55],
        sd < 0 ? far : fur,
        rotY(Math.atan2(base[0] - tip[0], tip[2] - base[2]) * -1),
      );
    }
    for (const sd of [1, -1]) {
      s.dot([hx + 2.3, sd * 1.6, hz + 0.5], ART_RGB.ink, 1, 2, 1.8);
      if (glint) s.dot([hx + 2.5, sd * 1.6, hz + 0.9], night ? ART_RGB.q6 : ART_RGB.w7, 1, 1, 1.8);
    }
    // crystal crest down the back
    const crest: Array<[number, number, number]> = [
      [1.4, 4.2, 0.1],
      [-0.8, 5.4, -0.15],
      [-3.0, 4.6, -0.4],
      [-4.8, 3.2, -0.7],
    ];
    for (const [x, hgt, tilt] of crest) s.ell([x, 0, bz + 3.6 + hgt * 0.45], [0.95, 1.1, hgt * 0.55], cry, rotY(tilt));
    if (glint && a !== 'death') s.glowPx([-0.8, 0, bz + 8.4], ART_RGB.white);
    s.pop();
    s.pop();
  },
};

// ───────────────────────── Phase Wisp ─────────────────────────

const WISP = ramp(ART_RGB.w4, 3, 3, { hue: 9, step: 0.1 });
const WISP_N = ramp(ART_RGB.q3, 3, 3, { hue: 9, step: 0.1 });

const wispDef: Def = {
  w: 26,
  h: 32,
  n: { idle: 4, move: 4, windup: 2, attack: 2, hurt: 1, death: 6 },
  shadow: [5, 2],
  draw(s, a, k, t, night) {
    const R = night ? WISP_N : WISP;
    const body = M(R, { glow: true, bias: 0.4, gain: 1.3, shiny: true }),
      tail = M(R, { glow: true, bias: -0.3, gain: 1.1 });
    let flare = 0,
      lean = 0,
      recoil = 0,
      fade = 0,
      slit = false;
    if (a === 'move') lean = 0.25;
    else if (a === 'windup') {
      flare = 0.8 + k * 0.5;
      slit = true;
      lean = -0.15;
    } else if (a === 'attack') {
      recoil = 2 - k;
      lean = -0.3;
      flare = 0.4;
    } else if (a === 'hurt') {
      lean = -0.4;
      recoil = 1;
    } else if (a === 'death') fade = k / (this.n.death - 1);
    const cz = 12;
    if (fade < 0.6) {
      const r = (3.6 + flare) * (1 - fade * 0.8);
      s.push(rotY(lean), [0, 0, cz], [-recoil, 0, 0]);
      for (let i = 1; i <= 5; i++) {
        const w = Math.sin(t * TAU + i * 0.9) * 0.9;
        s.sph([-i * 1.25, w, cz + i * 1.15], Math.max(0.6, r * (1 - i * 0.17)), tail);
      }
      s.ell([0, 0, cz], [r, r, r * 1.1], body);
      s.glowPx([-0.5, 0.5, cz + 1.2], R.c[R.c.length - 1]!, 2, 1); // hot core showing through
      const eye = ART_RGB.ink;
      for (const sd of [1, -1]) {
        if (slit) s.dot([r * 0.85, sd * 1.4, cz + 0.4], night ? ART_RGB.q6 : ART_RGB.white, 2, 1, 2.5, 0.5);
        else s.dot([r * 0.85, sd * 1.4, cz + 0.2], eye, 1, 2, 2.5);
      }
      if (a === 'attack') s.dot([r * 0.9, 0, cz - 1.6], eye, 1, 1, 2.5);
      s.pop();
    }
    const motes = night ? [ART_RGB.q6, ART_RGB.white] : [ART_RGB.w7, ART_RGB.q7];
    for (let i = 0; i < 3; i++) {
      const ang = t * TAU + (i * TAU) / 3;
      const rr = 5.5 + fade * 9;
      s.glowPx([Math.cos(ang) * rr, Math.sin(ang) * rr, cz + Math.sin(ang * 2) * 1.5 + fade * 4], motes[i % 2]!);
    }
  },
};

// ───────────────────────── Decoherent Brute ─────────────────────────

const STONE = ramp(ART_RGB.mist, 3, 2, { hue: 8 });
const STONE_N = ramp(ART_RGB.steel, 3, 2, { hue: 8 });
const CRACK = [ART_RGB.q7, ART_RGB.w7];
const CRACK_N = [ART_RGB.q6, ART_RGB.white];

const bruteDef: Def = {
  w: 50,
  h: 48,
  n: { idle: 4, move: 6, windup: 2, attack: 2, hurt: 1, death: 7 },
  shadow: [13, 5],
  draw(s, a, k, t, night) {
    const st = M(night ? STONE_N : STONE),
      far = M(rampOf((night ? STONE_N : STONE).c.slice(0, 4) as number[], 2));
    const ck = night ? CRACK_N : CRACK;
    let lean = 0.3,
      breathe = 0,
      armL: V3 = [7, 7.4, 3.2],
      armR: V3 = [7, -7.4, 3.2],
      stepL = 0,
      stepR = 0,
      sway = 0,
      drop = 0,
      crumble = 0;
    if (a === 'idle') {
      breathe = Math.sin(t * TAU) * 0.5;
    } else if (a === 'move') {
      const ph = t * TAU;
      stepL = Math.sin(ph) * 2.6;
      stepR = -stepL;
      sway = Math.sin(ph) * 0.06;
      breathe = Math.abs(Math.cos(ph)) * 0.6;
      armL = [7 - stepL * 0.8, 7.6, 3.4 + Math.max(0, -Math.sin(ph)) * 1.2];
      armR = [7 + stepL * 0.8, -7.6, 3.4 + Math.max(0, Math.sin(ph)) * 1.2];
    } else if (a === 'windup') {
      lean = -0.15 - k * 0.1;
      armL = [1, 6.5, 27 + k];
      armR = [1, -6.5, 27 + k];
      breathe = 1;
    } else if (a === 'attack') {
      lean = 0.75 - k * 0.15;
      armL = [11, 4.5, 1.6];
      armR = [11, -4.5, 1.6];
      drop = 1.5;
    } else if (a === 'hurt') {
      lean = -0.05;
      sway = 0.12;
    } else if (a === 'death') {
      crumble = k / (this.n.death - 1);
      lean = 0.3 + crumble * 0.4;
    }
    const fall = (i: number): V3 => {
      const c = clamp01(crumble * 1.6 - i * 0.12);
      return [Math.sin(i * 2.3) * c * 3, Math.cos(i * 1.9) * c * 3, -ease(c) * (8 + i * 2)];
    };
    const hipZ = 8.5 - drop;
    for (const [sd, stp] of [
      [1, stepL],
      [-1, stepR],
    ] as const) {
      if (crumble > 0.85) break;
      const m = sd < 0 ? far : st;
      s.cap(
        add([-3, sd * 4.2, hipZ], fall(1)),
        add([-3 + stp, sd * 4.6, 1.8 + Math.max(0, stp) * 0.4], fall(1)),
        3.0,
        2.6,
        m,
      );
      s.ell(add([-2.2 + stp, sd * 4.6, 1.1], fall(1)), [3.0, 2.3, 1.3], m);
    }
    s.push(rotX(sway), [0, 0, 0]);
    s.push(rotY(lean), [-2, 0, hipZ], add([0, 0, breathe * 0.3], fall(0)));
    const tz = 16 + breathe * 0.4;
    s.ell([0, 0, tz], [6.4, 7.2, 7.4], st);
    s.sph([1.8, 6.6, tz + 3.2], 3.9, st);
    s.sph([1.8, -6.6, tz + 3.2], 3.9, far);
    s.ell([6.6, 0, tz + 1.4], [2.8, 3.0, 2.7], st);
    for (const sd of [1, -1])
      s.dot([9.2, sd * 1.3, tz + 1.9], a === 'windup' || a === 'attack' ? ck[1]! : ck[0]!, 1, 1, 2.0);
    if (crumble < 0.6) {
      s.line([6.2, 3.5, tz + 4], [7.2, 0.5, tz - 1.5], ck[0]!, 2.5);
      s.line([7.2, 0.5, tz - 1.5], [6.0, -3.6, tz - 4.5], ck[0]!, 2.5);
      s.line([3.2, 6.8, tz - 2], [5.2, 5.0, tz - 5], ck[0]!, 2.5);
      s.dot([7.0, 0.6, tz - 1.6], ck[1]!, 1, 1, 2.5);
    }
    s.pop();
    for (const [sd, hand] of [
      [1, armL],
      [-1, armR],
    ] as const) {
      const m = sd < 0 ? far : st;
      const sh: V3 = add([1.6, sd * 7.2, tz + 2.2 + breathe * 0.3 - drop], fall(2));
      const h = add(hand, fall(3));
      s.cap(sh, h, 2.6, 2.3, m);
      s.sph(h, 3.0, m);
    }
    s.pop();
    if (crumble < 0.3)
      for (const [i, sd] of [
        [0, 1],
        [1, -1],
      ] as const) {
        const fz = 26 + Math.sin(t * TAU + i * 2) * 1.2 + (a === 'windup' ? 3 : 0);
        const fy = sd * (11 + Math.cos(t * TAU + i) * 0.8);
        s.ell([-2 + i * 2, fy, fz], [1.6, 1.4, 1.2], sd < 0 ? far : st, rotY(t * 2 + i));
        s.glowPx([-2 + i * 2, fy, fz - 1.6], ck[0]!);
      }
    if (crumble > 0)
      for (let i = 0; i < 5; i++) {
        const c = clamp01(crumble * 1.4 - i * 0.1);
        s.ell(
          [Math.sin(i * 2.7) * 7, Math.cos(i * 1.3) * 7, 1 + (1 - c) * 10],
          [2.2, 1.8, 1.4],
          i % 2 ? far : st,
          rotZ(i),
        );
      }
  },
};

// ───────────────────────── Static Mite ─────────────────────────

const MITE = ramp(ART_RGB.e4, 3, 2, { hue: 12 });
const MITE_N = ramp(ART_RGB.w3, 3, 2, { hue: 10 });

const miteDef: Def = {
  w: 20,
  h: 18,
  n: { idle: 2, move: 4, windup: 2, attack: 2, hurt: 1, death: 5 },
  shadow: [4, 2],
  draw(s, a, k, t, night) {
    const sh = M(night ? MITE_N : MITE, { shiny: true });
    const legC = (night ? MITE_N : MITE).c[0]!;
    let pitch = 0,
      fwd = 0,
      roll = 0,
      jig = 0,
      spark = true;
    if (a === 'move') jig = k % 2 ? 0.4 : -0.4;
    else if (a === 'windup') pitch = -0.45 - k * 0.1;
    else if (a === 'attack') {
      pitch = 0.25;
      fwd = 2 - k;
    } else if (a === 'hurt') pitch = -0.3;
    else if (a === 'death') {
      roll = ease(clamp01(k / 2.5)) * Math.PI;
      spark = k < 2;
    }
    s.push(rotX(roll), [0, 0, 2.2]);
    s.push(rotY(pitch), [-1, 0, 1], [fwd, jig, 0]);
    s.ell([-0.4, 0, 2.6], [2.8, 2.3, 1.9], sh);
    s.sph([2.4, 0, 2.4], 1.3, sh);
    for (const sd of [1, -1]) s.dot([3.4, sd * 0.7, 2.8], night ? ART_RGB.q6 : ART_RGB.r7, 1, 1, 1.5);
    for (let i = 0; i < 3; i++)
      for (const sd of [1, -1]) {
        const lx = 1.2 - i * 1.5,
          ph = (k + i + (sd > 0 ? 0 : 1)) % 2;
        const kneeV: V3 = [lx + (ph ? 0.6 : -0.4), sd * 3.0, 2.6];
        s.line([lx, sd * 1.6, 2.2], kneeV, legC, 2);
        s.line(kneeV, [lx + (ph ? 1.0 : -0.6), sd * 3.6, roll > 1 ? 4 : 0.3], legC, 2);
      }
    if (spark) {
      const c = night ? ART_RGB.q7 : ART_RGB.r7;
      const j = Math.floor(t * 7) % 3;
      s.glowPx([-0.6, 0.6 * (j - 1), 5.4 + (k % 2)], c);
      s.glowPx([-2.2 + j, -1.2, 4.6], c);
      if (a === 'windup') s.glowPx([0.4, 1.2, 6.2], ART_RGB.white);
    }
    s.pop();
    s.pop();
  },
};

/** Two original encounter models; the existing z-buffer rig handles all facings and occlusion. */
function encounterDef(moth: boolean): Def {
  return {
    w: 48,
    h: 44,
    ay: 36,
    shadow: moth ? [6, 3] : [8, 4],
    n: { idle: 4, move: 6, windup: 3, attack: 3, hurt: 2, death: 5 },
    draw(s, a, k, t, night) {
      const dying = a === 'death',
        wind = a === 'windup',
        moving = a === 'move',
        phase = t * TAU;
      const shell = M(
        ramp(moth ? (night ? ART_RGB.r1 : ART_RGB.e3) : night ? ART_RGB.g1 : ART_RGB.g3, 3, 2, { hue: 8 }),
      );
      const light = M(ramp(moth ? ART_RGB.r5 : ART_RGB.g5, 2, 2)),
        dark = M(ramp(ART_RGB.e1, 2, 2));
      const z = (moth ? 9 : 5) + (moving ? Math.sin(phase) * 0.5 : 0) - (dying ? t * 7 : 0);
      if (moth) {
        const flap = dying ? 0.15 : wind ? 0.12 : 0.25 + 0.3 * Math.sin(phase);
        for (const side of [-1, 1]) {
          s.push(rotX(side * flap), [0, side * 1, z]);
          s.ell([-1, side * 7, z], [5.5, 7, 0.8], shell);
          s.ell([-3, side * 4.5, z - 1], [4, 4, 0.7], light);
          s.ell([0, side * 7, z + 0.9], [1.5, 2, 0.4], dark);
          s.line([1, side * 2, z + 1], [-3, side * 10, z + 1], ART_RGB.r5, 1);
          s.pop();
        }
        s.ell([0, 0, z], [4, 1.6, 1.8], dark);
        s.sph([3, 0, z + 1], 2, light);
        for (const side of [-1, 1]) s.line([3, side * 0.8, z + 2], [5, side * 2, z + 4], ART_RGB.e6, 1);
        s.sph([1.4, 0, z + 1], wind ? 2.4 : 1.2, M(ramp(ART_RGB.r5, 2, 1), { glow: true }));
      } else {
        s.ell([0, 0, z], [5, 4, 4], shell);
        s.ell([4, 0, z + 1], [2.5, 3, 2], dark);
        for (const side of [-1, 1])
          for (const x of [-3, 3]) {
            const step = moving ? Math.sin(phase + (x * side > 0 ? 0 : Math.PI)) * 1.4 : 0;
            s.cap([x, side * 3, z - 1], [x + step, side * 4, 1], 1.2, 0.7, shell);
          }
        for (const side of [-1, 0, 1])
          s.cap([-2, side * 2, z + 2], [-4, side * 4, z + (wind ? 10 : 7)], 1.4, 0.1, light);
        for (const side of [-1, 1]) s.dot([6, side * 1.5, z + 1.7], wind ? ART_RGB.r6 : ART_RGB.w6, 1, 1, 2);
      }
    },
  };
}

/** Original cave fauna, with restrained idle poses and distinct windup silhouettes. */
function caveFauna(form: number): Def {
  return {
    w: form === 8 ? 96 : form >= 6 ? 64 : 48,
    h: form === 8 ? 96 : form >= 6 ? 64 : 46,
    ay: form === 8 ? 86 : form >= 6 ? 56 : 39,
    shadow: form === 8 ? [20, 8] : form >= 6 ? [12, 5] : [7, 3],
    n:
      form === 8
        ? { idle: 2, move: 4, windup: 3, attack: 3, hurt: 1, death: 4 }
        : { idle: 4, move: 6, windup: 4, attack: 3, hurt: 2, death: 5 },
    draw(s, a, k, t) {
      const moving = a === 'move',
        wind = a === 'windup',
        dead = a === 'death',
        pulse = moving ? Math.sin(t * TAU) : 0;
      const colors = [
        ART_RGB.steel,
        ART_RGB.g4,
        ART_RGB.w3,
        ART_RGB.e4,
        ART_RGB.w5,
        ART_RGB.w3,
        ART_RGB.mist,
        ART_RGB.mist,
        ART_RGB.e4,
      ];
      const shell = M(ramp(colors[form]!, 3, 2, { hue: 9 })),
        dark = M(ramp(ART_RGB.slate, 2, 2)),
        ivory = M(ramp(ART_RGB.e6, 2, 1));
      const glow = M(ramp(form === 3 ? ART_RGB.r5 : ART_RGB.q7, 2, 1), { glow: true }),
        scale = form >= 6 ? 1.5 : 1;
      s.push(I3, [0, 0, 0], [a === 'attack' ? (1 - t) * 3 : 0, 0, 0]);
      const z = (form === 0 ? 10 : 5) * scale - (dead ? t * 7 : 0) + (moving ? 0.4 * pulse : 0);
      if (form === 0) {
        s.ell([0, 0, z], [3, 2, 3], dark);
        s.sph([2, 0, z + 2], 2.6, shell);
        for (const side of [-1, 1]) {
          const flap = wind ? -0.5 : Math.sin(t * TAU) * 0.35;
          s.cap([0, side * 1, z], [0, side * 8, z + flap * 7], 1, 0.7, shell);
          s.cap([0, side * 8, z + flap * 7], [-5, side * 11, z + flap * 5], 0.6, 0.1, shell);
          s.ell([-2, side * 6, z + flap * 4], [4, 5, 0.7], shell);
          s.cap([2, side, z + 3], [2, side * 2, z + 7], 1.3, 0.1, ivory);
        }
      } else if (form === 1 || form === 7) {
        s.cap([0, 0, 1], [0, 0, z + 7 * scale], 2 * scale, 3 * scale, ivory);
        s.ell([0, 0, z + 9 * scale], [7 * scale, 6 * scale, 3 * scale], shell);
        for (const side of [-1, 1]) {
          s.cap([0, side * 2, z + 3], [3, side * 5, z + (wind ? 8 : 1)], 1.1 * scale, 0.7 * scale, ivory);
          s.sph([2, side * 4, z + 10 * scale], 1 * scale, glow);
        }
        for (let i = 0; i < 5; i++)
          s.sph([Math.cos(i * 2.4) * 4 * scale, Math.sin(i * 2.4) * 4 * scale, z + 11 * scale], 0.7 * scale, ivory);
      } else if (form === 8) {
        const iron = M(ramp(ART_RGB.slate, 3, 2, { hue: 8 }), { shiny: true }),
          bronze = M(ramp(ART_RGB.e3, 3, 2)),
          voidM = M(rampOf([ART_RGB.ink, ART_RGB.night], 0));
        const lift = wind ? 8 : a === 'attack' ? -5 : 0,
          fall = dead ? t * 22 : 0;
        s.push(I3, [0, 0, 0], [0, 0, -fall]);
        // Hollow iron bell cuirass, flared skirt and a skull recessed in the split crown.
        s.ell([0, 0, 26], [14, 11, 19], iron);
        s.ell([0, 0, 10], [18, 14, 4], bronze);
        s.ell([10, 0, 34], [6, 7, 10], voidM);
        s.ell([13, 0, 36], [3.5, 4.5, 6], ivory);
        for (const side of [-1, 1]) {
          s.ell([15, side * 2.4, 38], [1.6, 1.2, 1.1], voidM);
          s.glowPx([16, side * 2.4, 38], ART_RGB.q7);
          s.cap([-1, side * 8, 43], [-3, side * 12, 57], 3, 0.2, bronze);
          s.cap([0, side * 10, 32], [-1, side * 20, 25 + lift], 4, 3, iron);
          s.cap([-1, side * 20, 25 + lift], [8, side * 24, 15 + lift], 3, 1.8, ivory);
          for (let finger = 0; finger < 3; finger++)
            s.cap([8, side * (23 + finger), 15 + lift], [12, side * (23 + finger), 10 + lift], 0.8, 0.15, ivory);
          for (let i = 0; i < 6; i++) s.ell([-2, side * 18, 22 + lift - i * 3], [1.2, 0.7, 1.8], bronze);
          s.line([12, side * 5, 17], [12, side * 5, 28], ART_RGB.w5, 1);
        }
        for (let i = 0; i < 7; i++) {
          const y = (i - 3) * 3.2;
          s.cap([9, y, 23], [12, y, 10], 1.4, 0.5, bronze);
        }
        s.sph([0, 0, 7], 3, glow);
        s.cap([0, 0, 7], [0, 0, 23], 0.8, 0.8, bronze);
        for (const side of [-1, 1]) s.cap([0, side * 6, 9], [4, side * 8, 1], 2.5, 1.8, iron);
        s.pop();
      } else {
        const r = scale;
        s.ell([0, 0, z], [5 * r, 4 * r, 3.5 * r], shell);
        s.ell([4 * r, 0, z + 1], [2.5 * r, 3 * r, 2 * r], dark);
        for (const side of [-1, 1])
          for (let i = 0; i < (form === 4 ? 4 : 2); i++) {
            const x = (-3 + i * (form === 4 ? 2 : 6)) * r,
              step = moving ? Math.sin(t * TAU + i + side) * 1.5 : 0;
            s.cap([x, side * 3 * r, z - 1], [x + step, side * 5 * r, 1], 1 * r, 0.5 * r, shell);
          }
        if (form === 3)
          for (const side of [-1, 1]) s.cap([5, side * 2, z + 1], [8, side * 3, z + (wind ? 6 : 4)], 1.5, 0.3, ivory);
        if (form === 2 || form === 6)
          for (const side of [-1, 1]) s.cap([-2, side * 2, z + 2], [-2, side * 3, z + 7 * r], 2 * r, 0.1, glow);
        if (form === 5) s.cap([-4, 0, z], [-10, 0, 1], 2, 0.2, shell);
      }
      if (!dead) for (const side of [-1, 1]) s.sph([form === 8 ? 8 : 4, side * 1.5, z + 2], wind ? 1.1 : 0.6, glow);
      s.pop();
    },
  };
}

const DEFS: Record<CritterKind, Def> = {
  echo_bat: caveFauna(0),
  spore_sage: caveFauna(1),
  prism_beetle: caveFauna(2),
  blind_ram: caveFauna(3),
  rime_skitter: caveFauna(4),
  pool_lurker: caveFauna(5),
  vault_guardian: caveFauna(6),
  spore_matriarch: caveFauna(7),
  bellkeeper: caveFauna(8),
  reed_stalker: encounterDef(false),
  cinder_moth: encounterDef(true),
  fox: wildDef('fox'),
  otter: wildDef('otter'),
  tortoise: wildDef('tortoise'),
  owl: wildDef('owl'),
  thornling: wildDef('thornling'),
  glasscrawler: wildDef('glasscrawler'),
  deer: deerDef,
  rabbit: rabbitDef,
  slime: slimeDef,
  hopper: hopperDef,
  wisp: wispDef,
  brute: bruteDef,
  mite: miteDef,
};

// ───────────────────────── projectiles ─────────────────────────

const ORB_PLAYER = [ART_RGB.w2, ART_RGB.w4, ART_RGB.w6, ART_RGB.w7];
const ORB_ENEMY = [ART_RGB.q1, ART_RGB.q3, ART_RGB.q6, ART_RGB.white];
const ORB_REFLECT = [ART_RGB.e2, ART_RGB.r4, ART_RGB.r6, ART_RGB.white];
let orbSheet: Sheet | null = null;
/** glowing orb projectile, 14x14: kind 0 player bolt, 1 enemy orb, 2 reflected orb; 2 frames each */
export function orbTex(kind: number, frame: number): Texture {
  if (!orbSheet) {
    const sh = new Sheet(14, 14, 2, 3);
    [ORB_PLAYER, ORB_ENEMY, ORB_REFLECT].forEach((c, row) => {
      for (let f = 0; f < 2; f++) {
        const s = new Scene(14, 14, 7, 10, 0);
        const r = 3.4 + f * 0.5;
        s.sph([0, 0, 3.2], r + 0.9, M(rampOf([c[0]!, c[1]!], 1), { glow: true, gain: 0.5 }));
        s.sph([0, 0, 3.2], r, M(rampOf(c.slice(1), 1), { glow: true, bias: 1, shiny: true }));
        s.glowPx([-1, 1, 4.6], c[3]!, 1, 1);
        s.glowPx([3 + f, -3 - f, 3], c[2]!);
        sh.put(f, row, s.resolve({ edgeDark: false }));
      }
    });
    orbSheet = sh;
  }
  return orbSheet.frame(frame % 2, Math.max(0, Math.min(2, kind)));
}

// ───────────────────────── baking ─────────────────────────

interface Baked {
  sheet: Sheet;
  col0: Record<Anim, number>;
}
const baked = new Map<string, Baked>();

function bake(kind: CritterKind, night: boolean): Baked {
  const def = DEFS[kind];
  const col0 = {} as Record<Anim, number>;
  let cols = 0;
  for (const a of ANIMS) {
    col0[a] = cols;
    cols += def.n[a];
  }
  const sheet = new Sheet(def.w, def.h, cols, 4);
  for (let d = 0; d < 4; d++) {
    for (const a of ANIMS) {
      for (let k = 0; k < def.n[a]; k++) {
        const s = new Scene(def.w, def.h, def.w / 2, def.ay ?? def.h - 2, D4_YAW[d]!);
        def.draw(s, a, k, k / def.n[a], night);
        sheet.put(col0[a] + k, d, s.resolve());
      }
    }
  }
  return { sheet, col0 };
}

/** Texture for a creature frame. Looping anims wrap, `death` holds its last frame. */
export function critter(kind: CritterKind, night: boolean, dir: number, anim: Anim, frame: number): Texture {
  const key = `${kind}${night ? 'n' : 'd'}`;
  let b = baked.get(key);
  if (!b) {
    b = bake(kind, night);
    baked.set(key, b);
  }
  const n = DEFS[kind].n[anim];
  const f = anim === 'death' ? Math.min(n - 1, Math.max(0, frame)) : ((frame % n) + n) % n;
  return b.sheet.frame(b.col0[anim] + f, ((dir % 4) + 4) % 4);
}
export const critterFrames = (kind: CritterKind, anim: Anim): number => DEFS[kind].n[anim];
export const critterShadow = (kind: CritterKind): [number, number] => DEFS[kind].shadow;
export const critterSheetCanvas = (kind: CritterKind, night: boolean): HTMLCanvasElement => {
  critter(kind, night, 0, 'idle', 0);
  return baked.get(`${kind}${night ? 'n' : 'd'}`)!.sheet.canvas;
};

// ───────────────────────── game-facing facade ─────────────────────────

/** Enemy-kind index (shared ENEMY_BY_KIND order) -> creature model. */
export const KIND_NAMES: CritterKind[] = ['slime', 'hopper', 'rabbit', 'deer', 'wisp', 'brute', 'mite'];

export interface FoeSheets {
  anchor(kind: number): number;
  /** any creature frame: kind index (ENEMY_BY_KIND), night variant, D4 facing, animation, frame */
  frame(kind: number, night: boolean, dir: number, anim: Anim, frame: number): Texture;
  frames(kind: number, anim: Anim): number;
  /** soft shadow radii (art px) for a kind */
  shadow(kind: number): [number, number];
  /** enemy orb (frame 0/1); reflected orb when `reflected` */
  orb(reflected: boolean, frame: number): Texture;
}

export function buildFoeSheets(): FoeSheets {
  const caveNames = [
    'echo_bat',
    'spore_sage',
    'prism_beetle',
    'blind_ram',
    'rime_skitter',
    'pool_lurker',
    'vault_guardian',
    'spore_matriarch',
    'bellkeeper',
  ] as const;
  const name = (k: number): CritterKind => {
    const cave = caveNames[k - 24];
    if (cave) return cave;
    if (k === 22) return 'reed_stalker';
    if (k === 23) return 'cinder_moth';
    return (
      (['fox', 'otter', 'tortoise', 'owl', 'thornling', 'glasscrawler'] as const)[k - 15] ?? KIND_NAMES[k] ?? 'slime'
    );
  };
  return {
    anchor: (k) => (DEFS[name(k)].ay ?? DEFS[name(k)].h - 2) / DEFS[name(k)].h,
    frame: (k, n, d, a, f) => critter(name(k), n, d, a, f),
    frames: (k, a) => critterFrames(name(k), a),
    shadow: (k) => critterShadow(name(k)),
    orb: (r, f) => orbTex(r ? 2 : 1, f),
  };
}
