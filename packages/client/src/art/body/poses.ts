/**
 * Every animation frame id the game uses (art/actors.ts, art/person-actions.ts) as a pose of the shared skeleton.
 *
 * Work and combat clips are four key poses — 0 set-up, 1 anticipation (the wind-up), 2 contact, 3 recovery — sampled at
 * the eight key positions person-actions.ts assigns (0, ½, 1, 1½, 2, 2.35, 2.7, 3). Contact (k = 2) is the frame the
 * game fires its sounds, particles and resource changes on. Feet stay planted unless a clip moves them; knees and
 * elbows follow by IK, so a crouch bends the legs instead of shrinking the figure and a tool stays in both hands.
 */
import { ACTION_START, actionKeys, type PersonAction } from '../person-actions';
import { frameOf, gaitPose, restPose, type Dims, type Pose, type V3 } from './skeleton';

export const ATTACK0 = 10,
  RUN0 = 14,
  SHOT0 = 22,
  CAST0 = 26;

/** a key pose in reference-man units (heights scale to the body) */
interface Key {
  /** hip drop, hip forward shift */
  drop?: number;
  shift?: number;
  lean?: number;
  twist?: number;
  roll?: number;
  /** right hand position; the left hand either free (`hL`) or on the tool `grip` px further along the shaft */
  hR: V3;
  hL?: V3;
  grip?: number;
  /** tool pitch (up from horizontal forward) and yaw (toward the right hand side) in radians */
  pitch?: number;
  yaw?: number;
  /** step: the left foot forward by this, the right foot back */
  stance?: number;
  /** feet apart (extra) */
  wide?: number;
  shrug?: number;
  /** the left foot (for a sit or a kneel), absolute */
  fL?: V3;
  fR?: V3;
  fall?: number;
  spin?: number;
  spinZ?: number;
}

const H = 11,
  S = 19;
/** the hands' rest height */
const REST = S - 4.5 - 4.1 + 0.5;

const KEYS: Partial<Record<PersonAction, [Key, Key, Key, Key]>> = {
  mine: [
    { drop: 0.4, hR: [2.4, 1.4, H + 1.5], grip: 2.6, pitch: 0.7, stance: 1.6 },
    { drop: 0, lean: -0.18, twist: -0.25, hR: [-0.4, 1.2, S + 3.6], grip: 2.6, pitch: 2.4, stance: 1.6 },
    { drop: 1.6, lean: 0.5, hR: [4.4, 0.6, H - 1.2], grip: 2.6, pitch: -1.0, stance: 1.8 },
    { drop: 0.6, lean: 0.18, hR: [2.6, 1.2, H + 1], grip: 2.6, pitch: 0.3, stance: 1.6 },
  ],
  chop: [
    { drop: 0.3, hR: [2.2, 2.0, H + 2], grip: 2.6, pitch: 0.5, stance: 1.4 },
    { drop: 0.2, twist: 0.55, lean: -0.05, hR: [-1.2, 3.4, S + 1.4], grip: 2.6, pitch: 1.3, yaw: 1.7, stance: 1.4 },
    { drop: 0.9, twist: -0.4, lean: 0.25, hR: [3.8, 0.0, H + 3.2], grip: 2.6, pitch: 0.1, yaw: -0.7, stance: 1.8 },
    { drop: 0.5, twist: -0.1, lean: 0.1, hR: [2.6, 1.0, H + 2], grip: 2.6, pitch: 0.4, yaw: -0.2, stance: 1.4 },
  ],
  dig: [
    { drop: 0.3, hR: [2.4, 1.4, H + 1.5], grip: 2.6, pitch: 0.5, stance: 1.4 },
    { drop: 0.2, lean: -0.1, hR: [0.6, 1.2, S + 1.6], grip: 2.6, pitch: 1.9, stance: 1.4 },
    { drop: 1.4, lean: 0.55, hR: [3.6, 0.5, H - 2.2], grip: 2.6, pitch: -0.8, stance: 1.8 },
    { drop: 0.8, lean: 0.3, hR: [2.2, 1.2, H], grip: 2.6, pitch: -0.2, stance: 1.6 },
  ],
  water: [
    { hR: [2.4, 2.0, H + 2.2], hL: [0.8, -2.8, REST + 1], pitch: 0.1 },
    { lean: 0.05, hR: [3.0, 1.6, H + 3.4], hL: [0.8, -2.8, REST + 1], pitch: 0.3 },
    { lean: 0.15, drop: 0.3, hR: [3.8, 1.2, H + 2.6], hL: [1.4, -2.4, REST + 1.4], pitch: -0.9 },
    { lean: 0.08, hR: [3.0, 1.6, H + 2.6], hL: [0.8, -2.8, REST + 1], pitch: -0.4 },
  ],
  // cast: rod back over the shoulder, the throw; then a bite (rod dips, body pulled forward) and the patient wait
  fish: [
    { hR: [1.4, 1.6, H + 3.4], hL: [1.6, 0.2, H + 2.4], pitch: 0.9, stance: 1 },
    { lean: -0.12, twist: 0.3, hR: [-0.4, 1.8, S + 1.8], hL: [1.0, 0.4, H + 4], pitch: 2.3, stance: 1 },
    { lean: 0.25, drop: 0.4, hR: [3.8, 1.0, H + 3], hL: [3.0, -0.2, H + 2.4], pitch: 0.12, stance: 1.6 },
    { lean: -0.05, hR: [2.4, 1.2, H + 3.8], hL: [2.2, -0.4, H + 2.8], pitch: 0.55, stance: 1.2 },
  ],
  gather: [
    { drop: 0.6, lean: 0.2, hR: [2.0, 1.6, H], hL: [1.2, -2.2, REST + 1] },
    { drop: 2.8, lean: 0.55, hR: [3.0, 1.0, H - 2.6], hL: [2.4, -1.4, H - 1.6], stance: 1.4 },
    { drop: 3.8, lean: 0.75, hR: [3.6, 0.7, 3.2], hL: [3.4, -0.7, 3.6], stance: 1.6 },
    { drop: 1.2, lean: 0.2, hR: [2.0, 1.2, H + 2.6], hL: [1.8, -1.0, H + 2.2], stance: 1 },
  ],
  craft: [
    { drop: 0.2, lean: 0.15, hR: [3.0, 1.2, H + 3], hL: [3.2, -1.2, H + 2.8] },
    { drop: 0.2, lean: 0.1, hR: [2.6, 1.6, H + 5.4], hL: [3.2, -1.2, H + 2.8], pitch: 1.2 },
    { drop: 0.4, lean: 0.25, hR: [3.4, 0.8, H + 2.4], hL: [3.2, -1.2, H + 2.6], pitch: -0.4 },
    { drop: 0.2, lean: 0.15, hR: [3.0, 1.2, H + 3], hL: [3.2, -1.2, H + 2.8], pitch: 0.2 },
  ],
  forge: [
    { drop: 0.4, lean: 0.15, hR: [2.6, 1.8, H + 3], hL: [3.6, -1.2, H + 2.8], pitch: 0.4, stance: 1.2 },
    { drop: 0.2, lean: -0.1, twist: 0.25, hR: [0.8, 2.2, S + 2.4], hL: [3.6, -1.2, H + 2.8], pitch: 1.6, stance: 1.2 },
    { drop: 1.0, lean: 0.35, twist: -0.1, hR: [4.0, 0.6, H + 2.2], hL: [3.6, -1.2, H + 2.6], pitch: -0.5, stance: 1.6 },
    { drop: 0.5, lean: 0.2, hR: [2.8, 1.4, H + 3], hL: [3.6, -1.2, H + 2.8], pitch: 0.2, stance: 1.2 },
  ],
  cook: [
    { lean: 0.15, hR: [3.0, 1.0, H + 4], hL: [2.0, -2.6, H + 3] },
    { lean: 0.18, hR: [3.6, 0.3, H + 4], hL: [2.0, -2.6, H + 3] },
    { lean: 0.2, hR: [3.0, -0.4, H + 3.8], hL: [2.0, -2.6, H + 3] },
    { lean: 0.15, hR: [2.6, 0.6, H + 4.2], hL: [2.0, -2.6, H + 3] },
  ],
  alchemy: [
    { lean: 0.1, hR: [2.6, 1.6, H + 4], hL: [3.0, -1.0, H + 3.4] },
    { lean: 0.12, hR: [2.8, 1.2, H + 6], hL: [3.0, -1.0, H + 3.6], pitch: 0.4 },
    { lean: 0.15, hR: [3.2, 0.4, H + 5.4], hL: [3.0, -0.8, H + 3.6], pitch: -0.9 },
    { lean: 0.1, hR: [2.6, 1.4, H + 4.4], hL: [3.0, -1.0, H + 3.4], pitch: 0 },
  ],
  saw: [
    { drop: 0.6, lean: 0.3, hR: [2.0, 1.6, H + 2], hL: [3.6, -1.6, H + 0.8], pitch: -0.15, stance: 1.6 },
    { drop: 0.6, lean: 0.3, hR: [3.4, 1.4, H + 1.8], hL: [3.6, -1.6, H + 0.8], pitch: -0.15, stance: 1.6 },
    { drop: 0.8, lean: 0.4, hR: [4.6, 1.2, H + 1.6], hL: [3.6, -1.6, H + 0.8], pitch: -0.2, stance: 1.6 },
    { drop: 0.6, lean: 0.3, hR: [2.6, 1.6, H + 2], hL: [3.6, -1.6, H + 0.8], pitch: -0.15, stance: 1.6 },
  ],
  channel: [
    { hR: [2.4, 1.6, H + 5], hL: [2.4, -1.6, H + 5], pitch: 1.3 },
    { lean: -0.1, hR: [1.6, 2.6, S + 1.4], hL: [1.6, -2.6, S + 1.4], pitch: 1.6, shrug: 0.4 },
    { lean: 0.2, hR: [4.6, 1.0, S - 1.2], hL: [4.6, -1.0, S - 1.2], pitch: 0.4, stance: 1.4 },
    { lean: 0.1, hR: [3.6, 1.4, S - 2], hL: [3.6, -1.4, S - 2], pitch: 0.8, stance: 1.2 },
  ],
  talk: [
    { hR: [1.0, 3.6, REST + 1.5], hL: [0.4, -3.2, REST + 0.6] },
    { shrug: 0.3, hR: [2.6, 2.6, S - 2.2], hL: [0.4, -3.2, REST + 0.8] },
    { hR: [2.8, 3.4, S - 3.6], hL: [1.2, -3.0, REST + 2] },
    { hR: [1.6, 3.2, REST + 2.4], hL: [0.4, -3.2, REST + 0.6] },
  ],
  hit: [
    { lean: -0.32, twist: 0.35, drop: 0.4, hR: [1.4, 2.6, S - 3.4], hL: [1.2, -2.2, S - 3.8], stance: -1 },
    { lean: -0.45, twist: 0.45, drop: 1.0, hR: [0.6, 3.6, S - 2.6], hL: [0.4, -3.0, S - 3.2], stance: -1.4 },
    { lean: -0.22, twist: 0.2, drop: 0.6, hR: [1.2, 3.0, S - 4.6], hL: [1.0, -3.0, S - 5], stance: -1 },
    { lean: -0.05, hR: [0.4, 3.2, REST + 0.6], hL: [0.4, -3.2, REST + 0.6] },
  ],
  slash: [
    { drop: 0.6, hR: [2.6, 2.0, H + 4], hL: [1.6, -2.6, H + 3], pitch: 0.8, yaw: 0.3, stance: 1.6 },
    { drop: 0.6, twist: 0.55, hR: [0, 3.4, S + 1.2], hL: [2.2, -2.2, H + 4], pitch: 1.3, yaw: 1.8, stance: 1.8 },
    {
      drop: 1.2,
      twist: -0.5,
      lean: 0.3,
      hR: [5.6, -0.4, S - 3.4],
      hL: [-0.6, -3.4, H + 4],
      pitch: -0.1,
      yaw: -0.8,
      stance: 2.6,
    },
    {
      drop: 0.8,
      twist: -0.4,
      lean: 0.1,
      hR: [1.8, -2.4, H + 3],
      hL: [0.4, -3.2, H + 3.2],
      pitch: -0.5,
      yaw: -1.6,
      stance: 2,
    },
  ],
  thrust: [
    { drop: 0.6, hR: [1.6, 1.6, H + 4], grip: 3, pitch: 0.15, stance: 1.8 },
    { drop: 0.8, twist: 0.35, lean: -0.08, hR: [-0.6, 1.8, S - 3.4], grip: 3, pitch: 0.05, stance: 2 },
    { drop: 1.2, twist: -0.2, lean: 0.35, hR: [5.0, 0.6, S - 3.6], grip: 3, pitch: 0, stance: 3 },
    { drop: 0.8, lean: 0.1, hR: [2.6, 1.0, H + 4], grip: 3, pitch: 0.2, stance: 2.2 },
  ],
  cleave: [
    { drop: 0.6, hR: [2.2, 1.2, H + 2], grip: 2.6, pitch: 0.9, stance: 1.8 },
    { drop: 0.4, twist: 0.2, lean: -0.15, hR: [-1.0, 1.0, S + 4], grip: 2.6, pitch: 2.4, stance: 1.8 },
    { drop: 2.0, lean: 0.5, hR: [4.4, 0.2, H], grip: 2.6, pitch: -0.7, stance: 2.6 },
    { drop: 1.0, lean: 0.2, hR: [2.6, 0.8, H + 2], grip: 2.6, pitch: -0.2, stance: 2 },
  ],
};

const lerpN = (a: number | undefined, b: number | undefined, t: number, dflt = 0) =>
  (a ?? dflt) + ((b ?? dflt) - (a ?? dflt)) * t;
const lerpV = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const ease = (t: number) => t * t * (3 - 2 * t);

function sampleKeys(keys: [Key, Key, Key, Key], k: number): Key {
  const i = Math.min(2, Math.floor(k)),
    t = ease(Math.max(0, Math.min(1, k - i)));
  const a = keys[i]!,
    b = keys[i + 1]!;
  return {
    drop: lerpN(a.drop, b.drop, t),
    shift: lerpN(a.shift, b.shift, t),
    lean: lerpN(a.lean, b.lean, t),
    twist: lerpN(a.twist, b.twist, t),
    roll: lerpN(a.roll, b.roll, t),
    shrug: lerpN(a.shrug, b.shrug, t),
    stance: lerpN(a.stance, b.stance, t),
    wide: lerpN(a.wide, b.wide, t),
    hR: lerpV(a.hR, b.hR, t),
    hL: a.hL && b.hL ? lerpV(a.hL, b.hL, t) : (a.hL ?? b.hL),
    grip: a.grip ?? b.grip,
    pitch: a.pitch !== undefined || b.pitch !== undefined ? lerpN(a.pitch, b.pitch ?? a.pitch, t) : undefined,
    yaw: lerpN(a.yaw, b.yaw, t),
  };
}

const toolDir = (pitch: number, yaw: number): V3 => [
  Math.cos(pitch) * Math.cos(yaw),
  Math.cos(pitch) * Math.sin(yaw),
  Math.sin(pitch),
];

/** a key pose, scaled to the body, as a skeleton pose */
function keyPose(d: Dims, key: Key): Pose {
  const p = restPose(d);
  const s = d.shoulderZ / S;
  const sc = (v: V3): V3 => [v[0] * s, v[1] * s, v[2] * s];
  p.pelvis = [(key.shift ?? 0) * s + Math.max(0, key.lean ?? 0) * -1.2, 0, d.hipZ - 0.3 - (key.drop ?? 0) * s];
  p.lean = key.lean ?? 0;
  p.twist = key.twist ?? 0;
  p.roll = key.roll ?? 0;
  p.shrug = key.shrug ?? 0;
  const st = (key.stance ?? 0) * s,
    w = (key.wide ?? 0) * s;
  p.footL = key.fL ? sc(key.fL) : [st * 0.6, -d.hipHalf - w - Math.abs(st) * 0.15, 0];
  p.footR = key.fR ? sc(key.fR) : [-st * 0.5, d.hipHalf + w + Math.abs(st) * 0.15, 0];
  // the trailing foot turns out a little in a wide stance
  if (st > 0.5) p.toeR = [1, 0.45, 0];
  p.handR = sc(key.hR);
  if (key.pitch !== undefined) {
    const dir = toolDir(key.pitch, key.yaw ?? 0);
    p.tool = { hand: 'R', dir };
    if (key.grip)
      p.handL = [
        p.handR[0] + dir[0] * key.grip * s,
        p.handR[1] + dir[1] * key.grip * s,
        p.handR[2] + dir[2] * key.grip * s,
      ];
  }
  if (key.hL) p.handL = sc(key.hL);
  else if (!key.grip) p.handL = restPose(d).handL;
  return p;
}

/** frame id -> which clip and where in it */
const CLIP = new Map<number, { action: PersonAction; k: number }>();
for (const action of Object.keys(ACTION_START) as PersonAction[])
  actionKeys(action).forEach((f, i) => CLIP.set(f, { action, k: [0, 0.5, 1, 1.5, 2, 2.35, 2.7, 3][i]! }));

/** The forward roll of a dodge: crouch, tuck and turn head over heels, uncurl, rise (k 0..3). */
function dodgePose(d: Dims, k: number): Pose {
  const s = d.shoulderZ / S;
  const t = k / 3;
  // tuck: knees to the chest and the head down, most of the roll
  const tuck = Math.sin(Math.min(1, t * 1.25) * Math.PI);
  const p = keyPose(d, {
    drop: 1.5 + tuck * 3.8,
    lean: 0.5 + tuck * 0.7,
    hR: [2.4, 1.6, H - 1 - tuck * 2],
    hL: [2.4, -1.6, H - 1 - tuck * 2],
    stance: 1.6 * (1 - tuck),
  });
  if (tuck > 0.3) {
    p.footL = [0.8 * s, -d.hipHalf, tuck * 3.2 * s];
    p.footR = [0.4 * s, d.hipHalf, tuck * 2.6 * s];
  }
  // the turn itself happens between the crouch and the rise
  const spinT = Math.max(0, Math.min(1, (t - 0.12) / 0.7));
  p.spin = ease(spinT) * Math.PI * 2;
  p.spinZ = 4.2 * s;
  return p;
}

/** Falling: the knees go, the body tips back and lies still. */
function deathPose(d: Dims, k: number, dir: number): Pose {
  const s = d.shoulderZ / S;
  const p = keyPose(d, {
    drop: Math.min(1, k) * 2.6,
    lean: -0.3 * Math.min(1, k),
    twist: 0.3,
    hR: [0.6, 3.6, S - 3 - k * 2],
    hL: [0.2, -3.2, S - 4 - k * 2],
    stance: -1,
  });
  if (k > 1) {
    p.fall = Math.min(1.5, (k - 1) * 0.85);
    // fall away from the camera (up the screen, half length in the 2:1 view) and a little back, so the lying body
    // stays inside its cell in every facing
    const fr = frameOf(dir);
    const ga = -0.35 * fr.f[0],
      gb = -1 - 0.35 * fr.f[1];
    const l = Math.hypot(ga, gb) || 1;
    p.fallDir = [(ga * fr.f[0] + gb * fr.f[1]) / l, (ga * fr.r[0] + gb * fr.r[1]) / l];
    p.handR = [-1 * s, 4.4 * s, H * s];
    p.handL = [0.4 * s, -4.4 * s, H * s];
  }
  return p;
}

function sitPose(d: Dims, k: number): Pose {
  const s = d.shoulderZ / S;
  const p = restPose(d);
  p.pelvis = [-0.6 * s, 0, d.hipZ - 4.6 * s + Math.sin(k * 2) * 0.1];
  p.footL = [3.6 * s, -d.hipHalf - 0.2, 0];
  p.footR = [3.6 * s, d.hipHalf + 0.2, 0];
  p.handL = [2.6 * s, -2.4 * s, d.hipZ - 3 * s];
  p.handR = [2.6 * s, 2.4 * s, d.hipZ - 3 * s];
  return p;
}

/** Treading water: a slow breast stroke, legs kicking below the surface. */
function swimPose(d: Dims, k: number): Pose {
  const s = d.shoulderZ / S;
  const a = (k / 3) * Math.PI * 2;
  const p = restPose(d);
  p.lean = 0.35;
  const sweep = Math.sin(a);
  p.handL = [(3.4 + sweep) * s, (-1.6 - Math.max(0, -sweep) * 2) * s, (S - 4) * s];
  p.handR = [(3.4 + sweep) * s, (1.6 + Math.max(0, -sweep) * 2) * s, (S - 4) * s];
  p.footL = [Math.sin(a + 1) * 1.5 * s, -d.hipHalf, Math.max(0, Math.cos(a)) * 1.2];
  p.footR = [-Math.sin(a + 1) * 1.5 * s, d.hipHalf, Math.max(0, -Math.cos(a)) * 1.2];
  return p;
}

/** The pose for one of the game's person frame ids (see art/actors.ts and art/person-actions.ts). */
export function poseOf(d: Dims, frame: number, dir = 0): Pose {
  if (frame === 0) return restPose(d);
  if (frame === 9) return { ...restPose(d), shrug: 0.35 };
  if (frame >= 1 && frame <= 8) return gaitPose(d, (frame - 1) / 8, false);
  if (frame >= RUN0 && frame < RUN0 + 8) return gaitPose(d, (frame - RUN0) / 8, true);
  if (frame >= ATTACK0 && frame < ATTACK0 + 4)
    return keyPose(d, sampleKeys(KEYS.slash!, [1, 2, 2.5, 3][frame - ATTACK0]!));
  if (frame >= SHOT0 && frame < SHOT0 + 4) {
    const i = frame - SHOT0;
    return keyPose(d, {
      drop: 0.5,
      lean: [0.05, 0.1, -0.12, 0][i],
      stance: 1.6,
      hR: [
        [2.6, 1.0, S - 3.4],
        [3.4, 0.6, S - 2.6],
        [2.6, 0.6, S - 2.4],
        [2.6, 1.2, H + 4],
      ][i] as V3,
      hL: [
        [3.6, -0.6, S - 3.6],
        [5.0, -0.2, S - 2.6],
        [4.8, -0.2, S - 2.4],
        [2.4, -1.4, H + 4],
      ][i] as V3,
      pitch: [0.1, 0, 0.12, 0.3][i],
    });
  }
  if (frame >= CAST0 && frame < CAST0 + 4) {
    const i = frame - CAST0;
    return keyPose(d, sampleKeys(KEYS.channel!, [0, 1, 2, 3][i]!));
  }
  const clip = CLIP.get(frame);
  if (!clip) return restPose(d);
  const { action, k } = clip;
  if (action === 'dodge') return dodgePose(d, k);
  if (action === 'death') return deathPose(d, k, dir);
  if (action === 'sit') return sitPose(d, k);
  if (action === 'swim') return swimPose(d, k);
  const keys = KEYS[action];
  return keys ? keyPose(d, sampleKeys(keys, k)) : restPose(d);
}
