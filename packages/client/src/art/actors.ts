import type { Texture } from 'pixi.js';
import { NPCS, PALETTE } from '@eigenlands/shared';
import { C, type Ramp as IdxRamp } from './shade';
import { D4_SE, D4_SW, Scene, Sheet, add, lerp3, mute, ramp, rampOf, rotX, rotY, rotZ, type M3, type Mat, type Ramp, type V3 } from './sprite';
import { critter, orbTex } from './foes';

/**
 * Characters: the player outfits and the Hadamere villagers, modelled once (see sprite.ts) and rendered in 8 iso
 * directions: an idle pair (breathing), an 8-frame walk, a 3-frame swing, a hurt recoil and a 4-frame fall.
 * No outlines: forms read by value with a top-left key light; colours are muted versions of each look's palette.
 */
export const DIR_DOWN = 0, DIR_UP = 1, DIR_LEFT = 2, DIR_RIGHT = 3;
export const DIR_DOWN_LEFT = 4, DIR_DOWN_RIGHT = 5, DIR_UP_LEFT = 6, DIR_UP_RIGHT = 7;
/** frame 0 = idle, 1..8 = walk cycle */
export const WALK_FRAMES = 9;
export const PERSON_W = 44;
export const PERSON_H = 40;
/** extra poses beyond idle/walk */
export type Pose = 'attack' | 'hurt' | 'death';
export const POSE_FRAMES: Record<Pose, number> = { attack: 3, hurt: 1, death: 4 };
const COL_BREATH = 9, COL_ATTACK = 10, COL_HURT = 13, COL_DEATH = 14;
const COLS = 18;

/** Screen-space facing vector -> one of 8 directions. */
export function dirOf(fx: number, fy: number): number {
  if (fx === 0 && fy === 0) return DIR_DOWN;
  const a = Math.atan2(fy, fx);                       // 0 = right, +pi/2 = down
  const o = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  return [DIR_RIGHT, DIR_DOWN_RIGHT, DIR_DOWN, DIR_DOWN_LEFT, DIR_LEFT, DIR_UP_LEFT, DIR_UP, DIR_UP_RIGHT][o]!;
}
/** world yaw of each 8-way direction (0 = world +x = screen lower-right) */
const YAW = [Math.PI / 4, -3 * Math.PI / 4, 3 * Math.PI / 4, -Math.PI / 4, Math.PI / 2, 0, Math.PI, -Math.PI / 2];

export type HairStyle = 'short' | 'long' | 'bun' | 'bald' | 'braids' | 'curly' | 'ponytail';
export type HatStyle = 'cap' | 'brim' | 'beret';
/** Looks are authored as palette-index ramps (shared with item icons); the sprite uses muted versions of them. */
export interface Outfit {
  shirt: IdxRamp; pants: IdxRamp; hair: IdxRamp; skin: IdxRamp; boots: IdxRamp;
  longHair?: boolean; hat?: IdxRamp;
  /** NPC extras */
  hairStyle?: HairStyle; hatStyle?: HatStyle; beard?: IdxRamp; moustache?: boolean; glasses?: boolean; apron?: IdxRamp; scarf?: IdxRamp;
  /** px by which the body is shorter (children) */
  shorten?: number; headband?: number;
  /** quantum adventurer trim: glowing seams on the tunic */
  glow?: number; cape?: IdxRamp; vest?: IdxRamp;
}

const SKIN_LIGHT = [C.e3, C.e4, C.e5, C.e6, C.e7] as IdxRamp;
const SKIN_MID = [C.e2, C.e3, C.e4, C.e5, C.e6] as IdxRamp;
const SKIN_DARK = [C.e1, C.e2, C.e3, C.e4, C.e5] as IdxRamp;
const HAIR = {
  brown: [C.e0, C.e1, C.e2, C.e3, C.e4] as IdxRamp, black: [C.ink, C.night, C.slate, C.steel] as IdxRamp,
  blond: [C.e3, C.e4, C.e5, C.e6, C.e7] as IdxRamp, red: [C.r0, C.r1, C.r2, C.r3, C.r4] as IdxRamp,
  white: [C.steel, C.mist, C.fog, C.pale, C.white] as IdxRamp, violet: [C.q0, C.q1, C.q2, C.q3, C.q4] as IdxRamp,
};
const cloth = (a: number[]) => a as IdxRamp;
const PANTS = { brown: cloth([C.e0, C.e1, C.e2, C.e3]), slate: cloth([C.night, C.slate, C.steel, C.mist]), navy: cloth([C.w0, C.w1, C.w2, C.w3]), olive: cloth([C.g0, C.g1, C.g2, C.g3]) };
const BOOTS = cloth([C.ink, C.e0, C.e1, C.e2]);

/** Player appearance presets (index = outfit item) and NPC outfits. */
export const OUTFITS: Outfit[] = [
  { shirt: cloth([C.w1, C.w2, C.w3, C.w4, C.w5]), pants: PANTS.brown, hair: HAIR.brown, skin: SKIN_LIGHT, boots: BOOTS, glow: C.q7, cape: cloth([C.q0, C.q1, C.q2, C.q3]) },
  { shirt: cloth([C.r1, C.r2, C.r3, C.r4, C.r5]), pants: PANTS.slate, hair: HAIR.black, skin: SKIN_MID, boots: BOOTS, longHair: true, glow: C.q6 },
  { shirt: cloth([C.q1, C.q2, C.q3, C.q4, C.q6]), pants: PANTS.navy, hair: HAIR.blond, skin: SKIN_LIGHT, boots: BOOTS, glow: C.q7, hairStyle: 'ponytail' },
  { shirt: cloth([C.g1, C.g2, C.g3, C.g4, C.g5]), pants: PANTS.brown, hair: HAIR.red, skin: SKIN_MID, boots: BOOTS, longHair: true, vest: cloth([C.e1, C.e2, C.e3, C.e4]) },
  { shirt: cloth([C.e3, C.e4, C.e5, C.e6, C.e7]), pants: PANTS.olive, hair: HAIR.violet, skin: SKIN_DARK, boots: BOOTS, hairStyle: 'curly', glow: C.q5 },
  { shirt: cloth([C.steel, C.mist, C.fog, C.pale, C.white]), pants: PANTS.slate, hair: HAIR.white, skin: SKIN_DARK, boots: BOOTS, longHair: true, cape: cloth([C.w0, C.w1, C.w2, C.w3]) },
  { shirt: cloth([C.r2, C.r3, C.r4, C.r5, C.r6]), pants: PANTS.navy, hair: HAIR.black, skin: SKIN_LIGHT, boots: BOOTS, hairStyle: 'bun' },
  { shirt: cloth([C.w2, C.w3, C.w4, C.w5, C.w6]), pants: PANTS.brown, hair: HAIR.blond, skin: SKIN_DARK, boots: BOOTS, hat: cloth([C.e1, C.e2, C.e3, C.e4]), hatStyle: 'brim' },
];

const rmp = (a: number[]) => a as IdxRamp;
/** One distinctive look per village NPC (ids from shared NPCS). */
export const NPC_LOOKS: Record<string, Outfit> = {
  orla: { shirt: rmp([C.q0, C.q1, C.q2, C.q3, C.q4]), pants: rmp([C.night, C.slate, C.steel, C.mist]), hair: rmp([C.steel, C.mist, C.fog, C.pale, C.white]), skin: SKIN_MID, boots: BOOTS, hairStyle: 'bun', glasses: true, scarf: rmp([C.r4, C.r5, C.r6, C.r7]), cape: rmp([C.q0, C.q1, C.q2, C.q3]) },
  tobin: { shirt: rmp([C.e4, C.e5, C.e6, C.e7, C.white]), pants: PANTS.brown, hair: HAIR.brown, skin: SKIN_LIGHT, boots: BOOTS, apron: rmp([C.g1, C.g2, C.g3, C.g4]), moustache: true, beard: rmp([C.e0, C.e1, C.e2, C.e3]) },
  brannoch: { shirt: rmp([C.r0, C.r1, C.r2, C.r3, C.r4]), pants: PANTS.slate, hair: HAIR.black, skin: SKIN_DARK, boots: BOOTS, hairStyle: 'bald', beard: rmp([C.ink, C.night, C.slate, C.steel]), apron: rmp([C.e0, C.e1, C.e2, C.e3]), headband: C.r3 },
  maribel: { shirt: rmp([C.r2, C.r3, C.r4, C.r5, C.r6]), pants: PANTS.brown, hair: HAIR.brown, skin: SKIN_LIGHT, boots: BOOTS, hairStyle: 'bun', apron: rmp([C.fog, C.pale, C.white, C.white]) },
  fenwick: { shirt: rmp([C.w1, C.w2, C.w3, C.w4, C.w5]), pants: PANTS.brown, hair: HAIR.blond, skin: SKIN_LIGHT, boots: BOOTS, hat: rmp([C.e3, C.e4, C.e5, C.e6]), hatStyle: 'brim', beard: rmp([C.e3, C.e4, C.e5, C.e6]), vest: rmp([C.r1, C.r2, C.r3, C.r4]) },
  sedge: { shirt: rmp([C.e5, C.e6, C.e7, C.pale, C.white]), pants: PANTS.olive, hair: HAIR.white, skin: SKIN_MID, boots: BOOTS, hat: rmp([C.w1, C.w2, C.w3, C.w4]), hatStyle: 'cap', beard: rmp([C.mist, C.fog, C.pale, C.white]), vest: rmp([C.r5, C.r6, C.r7, C.r7]) },
  wren: { shirt: rmp([C.g1, C.g2, C.g3, C.g4, C.g5]), pants: PANTS.slate, hair: HAIR.violet, skin: SKIN_MID, boots: BOOTS, hairStyle: 'braids', hat: rmp([C.q0, C.q1, C.q2, C.q3]), hatStyle: 'beret', scarf: rmp([C.q3, C.q4, C.q5, C.q6]), glow: C.q7 },
  pippa: { shirt: rmp([C.q3, C.q4, C.q5, C.q6, C.white]), pants: PANTS.navy, hair: rmp([C.r2, C.r3, C.r4, C.r5, C.r6]), skin: SKIN_DARK, boots: BOOTS, hairStyle: 'ponytail', scarf: rmp([C.w4, C.w5, C.w6, C.w7]) },
  odo: { shirt: rmp([C.w2, C.w3, C.w4, C.w5, C.w6]), pants: PANTS.brown, hair: HAIR.red, skin: SKIN_LIGHT, boots: BOOTS, hairStyle: 'bald', beard: rmp([C.r1, C.r2, C.r3, C.r4]), moustache: true, apron: rmp([C.e2, C.e3, C.e4, C.e5]) },
  juniper: { shirt: rmp([C.g3, C.g4, C.g5, C.g6, C.g7]), pants: PANTS.brown, hair: rmp([C.e3, C.e4, C.e5, C.e6, C.e7]), skin: SKIN_MID, boots: BOOTS, hairStyle: 'ponytail', shorten: 3, hat: rmp([C.r2, C.r3, C.r4, C.r5]), hatStyle: 'beret', scarf: rmp([C.r5, C.r6, C.r7, C.r7]) },
};

// ───────────────────────── look -> materials ─────────────────────────

const hexOf = (i: number) => parseInt(PALETTE[i]!.slice(1), 16);
/** the look's key colour (middle of its index ramp), muted, as a fresh hue-shifted ramp */
function matOf(r: IdxRamp, k = 0.78, o: Partial<Mat> = {}): Mat {
  const mid = r[Math.floor((r.length - 1) / 2)]!;
  return { r: ramp(mute(hexOf(mid), k), 3, 2), ...o };
}
const darker = (m: Mat, n = 1): Mat => ({ ...m, r: rampOf(m.r.c.slice(0, m.r.c.length - n) as number[], Math.max(0, m.r.base - n)) });

interface Kit {
  shirt: Mat; shirtFar: Mat; pants: Mat; pantsFar: Mat; boots: Mat; skin: Mat; skinFar: Mat; hair: Mat; belt: Mat;
  hat?: Mat; beard?: Mat; apron?: Mat; scarf?: Mat; cape?: Mat; vest?: Mat; band?: Mat; glow?: number;
}
function kitOf(o: Outfit): Kit {
  const skin = { r: ramp(mute(hexOf(o.skin[Math.min(2, o.skin.length - 1)]!), 0.82), 3, 2, { hue: 9 }) };
  const shirt = matOf(o.shirt), pants = matOf(o.pants, 0.72);
  return {
    shirt, shirtFar: darker(shirt), pants, pantsFar: darker(pants), skin, skinFar: darker(skin),
    boots: { r: rampOf([0x1c1620, 0x2c2027, 0x433036, 0x5c4440], 2) },
    hair: matOf(o.hair, 0.7), belt: { r: rampOf([0x24181f, 0x3a2a2a, 0x54403a], 1) },
    hat: o.hat && matOf(o.hat), beard: o.beard && matOf(o.beard, 0.7), apron: o.apron && matOf(o.apron, 0.72),
    scarf: o.scarf && matOf(o.scarf), cape: o.cape && matOf(o.cape, 0.75), vest: o.vest && matOf(o.vest, 0.75),
    band: o.headband !== undefined ? { r: ramp(mute(hexOf(o.headband)), 2, 1) } : undefined,
    glow: o.glow !== undefined ? mute(hexOf(o.glow), 0.95) : undefined,
  };
}

// ───────────────────────── the person model ─────────────────────────

interface Rig {
  /** foot targets (x forward, lift) per side: +1 = left */
  footL: [number, number]; footR: [number, number];
  handL: V3; handR: V3;
  bob: number; lean: number; twist: number; headTilt: number;
  /** whole-body fall (death): roll about the ground line, sink */
  roll: number; sink: number; kneel: number;
  blade: V3 | null;
  breath: number;
}

function rigFor(col: number): Rig {
  const r: Rig = { footL: [0, 0], footR: [0, 0], handL: [0.4, 4.3, 10.8], handR: [0.4, -4.3, 10.8], bob: 0, lean: 0, twist: 0, headTilt: 0, roll: 0, sink: 0, kneel: 0, blade: null, breath: 0 };
  if (col >= 1 && col <= 8) {
    const p = ((col - 1) / 8) * Math.PI * 2;
    const sw = Math.sin(p), cs = Math.cos(p);
    r.footL = [sw * 3.0, Math.max(0, cs) * 1.8];
    r.footR = [-sw * 3.0, Math.max(0, -cs) * 1.8];
    r.handL = [-sw * 2.6 + 0.4, 4.4, 11.2 + Math.abs(sw) * 0.5];
    r.handR = [sw * 2.6 + 0.4, -4.4, 11.2 + Math.abs(sw) * 0.5];
    r.bob = Math.abs(cs) > 0.7 ? 0.7 : 0;          // up while passing, down on contact
    r.lean = 0.05;
  } else if (col === COL_BREATH) r.breath = 0.6;
  else if (col >= COL_ATTACK && col < COL_HURT) {
    const k = col - COL_ATTACK;
    if (k === 0) { r.twist = 0.55; r.handR = [-2.6, -4.2, 18.2]; r.blade = [-4.2, -2.6, 23]; r.handL = [2.2, 3.6, 13]; r.footR = [-1.6, 0]; r.lean = -0.06; }
    else if (k === 1) { r.twist = -0.35; r.handR = [5.4, -2.0, 15.2]; r.blade = [11.5, -0.6, 14.6]; r.handL = [-1.2, 4.6, 11.6]; r.footL = [2.4, 0]; r.footR = [-1.8, 0]; r.lean = 0.16; r.bob = -0.4; }
    else { r.twist = -0.6; r.handR = [3.0, 3.0, 11.5]; r.blade = [5.0, 8.2, 9.0]; r.handL = [-1.6, 4.6, 12]; r.footL = [2.4, 0]; r.footR = [-1.4, 0]; r.lean = 0.1; }
  } else if (col === COL_HURT) {
    r.lean = -0.24; r.headTilt = -0.3; r.handL = [-1.4, 5.6, 13.5]; r.handR = [-1.4, -5.6, 13.5]; r.footL = [1.2, 0.6]; r.bob = 0.3;
  } else if (col >= COL_DEATH) {
    const k = col - COL_DEATH;
    r.kneel = [0.45, 1, 1, 1][k]!;
    r.sink = [1.6, 4.2, 4.6, 4.6][k]!;
    r.lean = [0.15, 0.35, 0.3, 0][k]!;
    r.roll = [0, 0, 0.75, Math.PI / 2][k]!;
    r.headTilt = [0.2, 0.4, 0.3, 0][k]!;
    r.handL = [2.5, 4.0, 6]; r.handR = [2.5, -4.0, 6];
  }
  return r;
}

function drawPerson(s: Scene, col: number, o: Outfit, K: Kit): void {
  const r = rigFor(col);
  const child = (o.shorten ?? 0) > 0;
  const k = child ? 0.84 : 1;
  const sc: M3 = [k, 0, 0, 0, k, 0, 0, 0, k];
  s.push(sc);
  s.push(rotX(r.roll), [0, -3.6, 0]);
  // legs: two segments, knees bow forward
  const hipZ = 9.6 - r.sink;
  const legs: Array<[number, [number, number]]> = [[1, r.footL], [-1, r.footR]];
  for (const [sd, [fx, lift]] of legs) {
    const pm = sd < 0 ? K.pantsFar : K.pants;
    const p = s.newPart();
    const hip: V3 = [0, sd * 1.75, hipZ];
    let foot: V3 = [fx, sd * 1.9, 1.3 + lift];
    let knee: V3 = [fx * 0.5 + 0.9 + lift * 0.5, sd * 1.85, (hipZ + 1.3) / 2 + lift * 0.4];
    if (r.kneel > 0) { knee = [2.6 * r.kneel, sd * 2, Math.max(1.4, hipZ - 4 + 3 * (1 - r.kneel))]; foot = [-2.6 * r.kneel + fx, sd * 2, 1.0]; }
    s.cap(hip, knee, 1.75, 1.55, pm, p);
    s.cap(knee, foot, 1.55, 1.35, pm, p);
    s.ell(add(foot, [0.7, 0, -0.2]), [2.0, 1.3, 1.15], K.boots, I_, p);
  }
  // upper body pivots at the hips (lean, twist), breathes
  s.push(mul3(rotZ(r.twist), rotY(r.lean)), [0, 0, hipZ], [0, 0, 0]);
  const bz = hipZ + r.bob;
  s.ell([0, 0, bz + 0.8], [2.3, 3.2, 2.0], K.pants);                              // seat / hips
  const ty = bz + 5.2 + r.breath * 0.4;
  const beltLo = -0.92, beltHi = -0.72;
  s.ell([0, 0, ty], [2.5, 3.5, 4.5 + r.breath * 0.2], (q) => {
    if (q[2] > beltLo && q[2] < beltHi) return K.belt;
    if (K.vest && q[0] > -0.35 && Math.abs(q[1]) > 0.22 && q[2] > beltHi) return K.vest;
    return q[1] < -0.6 ? K.shirtFar : K.shirt;
  });
  if (K.glow !== undefined) for (let z = ty - 2.5; z < ty + 3; z += 2) s.dot([2.45, 0, z], K.glow, 1, 1, 1.5);
  if (K.apron) s.ell([0.9, 0, ty - 2.6], [1.9, 3.15, 4.8], (q) => (q[0] > 0.45 ? K.apron! : null));
  if (K.cape) {
    const fl = col >= 1 && col <= 8 ? Math.sin(((col - 1) / 8) * Math.PI * 4) * 0.1 : 0;
    s.ell([-2.7, 0, ty - 3], [0.9, 3.9, 6.8], K.cape, rotY(-0.2 - fl - (col >= 1 && col <= 8 ? 0.12 : 0)));
  }
  // arms: sleeve + hand; the near (left, +y) arm lighter
  const sh = ty + 2.7;
  for (const [sd, hand] of [[1, r.handL], [-1, r.handR]] as const) {
    const m = sd < 0 ? K.shirtFar : K.shirt;
    const p = s.newPart();
    const shoulder: V3 = [0, sd * 3.7, sh];
    const h: V3 = [hand[0], hand[1], hand[2] + (bz - 9.6)];
    const elbow = lerp3(shoulder, h, 0.5);
    elbow[0] -= 0.6;
    s.cap(shoulder, elbow, 1.35, 1.2, m, p);
    s.cap(elbow, h, 1.2, 1.05, m, p);
    s.sph(h, 1.15, sd < 0 ? K.skinFar : K.skin, p);
    if (sd < 0 && r.blade) {
      const b: V3 = [r.blade[0], r.blade[1], r.blade[2] + (bz - 9.6)];
      s.line(h, b, (t) => (t < 0.18 ? 0x5a4234 : t > 0.8 ? 0xf2efe2 : 0xb9c2c8), 3);
    }
  }
  if (K.scarf) {
    s.ell([0.2, 0, sh + 0.9], [2.6, 3.3, 1.3], K.scarf);
    s.cap([2.2, 1.2, sh + 0.3], [2.6, 1.6, sh - 3.4], 0.75, 0.65, K.scarf);
  }
  // head
  s.push(rotY(r.headTilt), [0, 0, sh + 1.5]);
  const hz = sh + 5.6 + (child ? 0.4 : 0);
  const hr = child ? 4.45 : 4.2;
  s.cap([0, 0, sh], [0.3, 0, hz - 3], 1.3, 1.3, K.skinFar);
  s.sph([0.3, 0, hz], hr, K.skin);
  const H = K.hair;
  const style: HairStyle = o.hairStyle ?? (o.longHair ? 'long' : 'short');
  const band = K.band;
  if (style !== 'bald') {
    const big = style === 'curly' ? 0.5 : 0;
    s.ell([-0.15, 0, hz + 0.45], [hr + 0.5 + big, hr + 0.45 + big, hr + 0.45 + big], (q) => {
      const front = q[0] > 0.18;
      if (front && q[2] < 0.42 - Math.abs(q[1]) * 0.25) return null;              // the face
      if (!front && q[2] < (style === 'short' ? -0.45 : -0.75) && q[0] > -0.6) return null;
      if (Math.abs(q[1]) > 0.62 && q[2] < 0.05 && q[0] > -0.25) return null;        // ears / cheeks
      if (band && q[2] > 0.2 && q[2] < 0.42) return band;
      return H;
    });
    if (style === 'curly') for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      s.sph([-0.6 + Math.cos(a) * 3.6, Math.sin(a) * 3.8, hz + 2.6 + Math.sin(a * 3) * 0.6], 1.9, H);
    }
    if (style === 'long') s.ell([-2.4, 0, hz - 3.2], [1.9, hr, 4.4], H);
    if (style === 'bun') s.sph([-2.6, 0, hz + 3.4], 2.1, H);
    if (style === 'ponytail') s.cap([-3.8, 0, hz + 1.6], [-5.4, 0, hz - 5.6], 1.5, 0.95, H);
    if (style === 'braids') for (const sd of [1, -1]) s.cap([-0.6, sd * 3.9, hz - 1.5], [0.6, sd * 4.3, hz - 9.0], 1.05, 0.85, sd < 0 ? darker(H) : H);
  } else if (band) s.ell([0.3, 0, hz + 0.3], [hr + 0.25, hr + 0.25, 1.0], band);
  // face: eyes, a hint of cheek; facial hair
  const eye = 0x1b1722;
  for (const sd of [1, -1]) s.dot([0.3 + hr * 0.86, sd * hr * 0.42, hz - 0.2], eye, 1, 2, 1.6);
  if (o.glasses) for (const sd of [1, -1]) { s.dot([0.4 + hr * 0.92, sd * hr * 0.42, hz + 0.9], 0xb8d8e0, 1, 1, 1.6); s.dot([0.4 + hr * 0.95, 0, hz + 0.6], 0x2a2330, 1, 1, 1.6); }
  if (K.beard) {
    s.ell([1.6, 0, hz - 2.4], [2.9, 3.3, 2.5], (q) => (q[0] > 0.1 ? K.beard! : null));
  }
  if (o.moustache) s.dot([0.3 + hr * 0.97, 0, hz - 1.7], (K.beard ?? K.hair).r.c[1]!, 2, 1, 2, 0.5);
  // hats
  if (K.hat) {
    const hs = o.hatStyle ?? 'cap';
    if (hs === 'brim') {
      s.ell([0, 0, hz + 3.0], [6.6, 6.6, 0.75], K.hat);
      s.ell([-0.2, 0, hz + 4.3], [3.7, 3.7, 2.3], (q) => (q[2] < -0.35 ? { r: ramp(0x8a3b34, 2, 1) } : K.hat!));
    } else if (hs === 'beret') {
      s.ell([-0.6, 0.4, hz + 3.4], [5.0, 4.9, 1.9], K.hat, rotY(-0.22));
      s.sph([-0.6, 0.4, hz + 5.3], 0.7, K.hat);
    } else {
      s.ell([-0.15, 0, hz + 0.8], [hr + 0.75, hr + 0.7, hr + 0.6], (q) => (q[2] > 0.32 ? K.hat! : null));
      s.ell([3.6, 0, hz + 2.3], [2.6, 3.3, 0.55], K.hat, rotY(0.12));
    }
  }
  s.pop();   // head
  s.pop();   // upper body
  s.pop();   // fall
  s.pop();   // scale
}
const I_: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
function mul3(a: M3, b: M3): M3 {
  const o = new Array(9).fill(0) as M3;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!;
  return o;
}

// ───────────────────────── sheets ─────────────────────────

function bakeLook(o: Outfit): Sheet {
  const sheet = new Sheet(PERSON_W, PERSON_H, COLS, 8);
  const K = kitOf(o);
  for (let d = 0; d < 8; d++) for (let c = 0; c < COLS; c++) {
    const s = new Scene(PERSON_W, PERSON_H, PERSON_W / 2, PERSON_H - 2, YAW[d]!);
    drawPerson(s, c, o, K);
    sheet.put(c, d, s.resolve());
  }
  return sheet;
}

export interface Sheets {
  /** frame 0 = idle (breathes on its own), 1..WALK_FRAMES-1 = walk; dir = one of the 8 DIR_* constants */
  person(outfit: number, dir: number, frame: number): Texture;
  /** attack (0..2), hurt (0), death (0..3, holds the last) for a player look */
  personPose(outfit: number, dir: number, pose: Pose, k: number): Texture;
  /** unique sprite per village NPC; same layout as `person` */
  npc(npcId: string, dir: number, frame: number): Texture;
  /** legacy fauna/foe accessors (see critters.ts for the full 4-direction animation sets) */
  rabbit(frame: number, dir: number): Texture;
  deer(frame: number, dir: number): Texture;
  slime(night: boolean, frame: number): Texture;
  hopper(night: boolean, frame: number): Texture;
  /** the player's light bolt */
  orb(frame: number): Texture;
}

export function buildActorSheets(): Sheets {
  const looks = new Map<string, Sheet>();
  const npcIds = NPCS.map((n) => n.id);
  const sheetFor = (key: string, o: Outfit) => { let s = looks.get(key); if (!s) { s = bakeLook(o); looks.set(key, s); } return s; };
  const lookOf = (i: number) => ((i % OUTFITS.length) + OUTFITS.length) % OUTFITS.length;
  // idle frames alternate with a breathing frame on their own clock (phase-offset per look/direction)
  const idleCol = (k: number) => ((performance.now() / 700 + k * 0.37) % 2 < 1.15 ? 0 : COL_BREATH);
  const col = (f: number, k: number) => (f <= 0 ? idleCol(k) : Math.min(WALK_FRAMES - 1, f));
  const dd = (d: number) => ((d % 8) + 8) % 8;
  const poseCol = (p: Pose, k: number) => (p === 'attack' ? COL_ATTACK + Math.max(0, Math.min(2, k)) : p === 'hurt' ? COL_HURT : COL_DEATH + Math.max(0, Math.min(3, k)));
  const side = (dir: number) => (dir === DIR_LEFT || dir === DIR_DOWN_LEFT || dir === DIR_UP_LEFT ? D4_SW : D4_SE);
  return {
    person: (o, d, f) => sheetFor(`p${lookOf(o)}`, OUTFITS[lookOf(o)]!).frame(col(f, o * 3 + d), dd(d)),
    personPose: (o, d, p, k) => sheetFor(`p${lookOf(o)}`, OUTFITS[lookOf(o)]!).frame(poseCol(p, k), dd(d)),
    npc: (id, d, f) => {
      const i = Math.max(0, npcIds.indexOf(id));
      return sheetFor(`n${i}`, NPC_LOOKS[id] ?? OUTFITS[i % OUTFITS.length]!).frame(col(f, i * 5 + d), dd(d));
    },
    rabbit: (f, d) => critter('rabbit', false, side(d), f > 0 ? 'move' : 'idle', Math.max(0, f - 1)),
    deer: (f, d) => critter('deer', false, side(d), f > 0 ? 'move' : 'idle', Math.max(0, f - 1)),
    slime: (n, f) => critter('slime', n, D4_SE, 'idle', f),
    hopper: (n, f) => critter('hopper', n, D4_SE, f === 1 ? 'windup' : f === 2 ? 'attack' : 'idle', f === 3 ? 1 : 0),
    orb: (f) => orbTex(0, f),
  };
}
