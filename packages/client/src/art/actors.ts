import { Rectangle, Texture } from 'pixi.js';
import { NPCS } from '@eigenlands/shared';
import { blob, C, limb, makeCanvas, outline, PixBuf, polish, poly, put, rampAt, type Ctx, type Ramp } from './shade';

/**
 * Characters, enemies and fauna. People are 24x32 frames in 8 iso directions with an idle pair (breathing) and an
 * 8-frame walk. Every direction is drawn (never mirrored) so the key light always comes from the top-left.
 */
export const DIR_DOWN = 0, DIR_UP = 1, DIR_LEFT = 2, DIR_RIGHT = 3;
export const DIR_DOWN_LEFT = 4, DIR_DOWN_RIGHT = 5, DIR_UP_LEFT = 6, DIR_UP_RIGHT = 7;
/** frame 0 = idle, 1..8 = walk cycle */
export const WALK_FRAMES = 9;
export const PERSON_W = 24;
export const PERSON_H = 32;
const COLS = WALK_FRAMES + 1;          // + a second idle (breathing) frame

/** Screen-space facing vector -> one of 8 directions. */
export function dirOf(fx: number, fy: number): number {
  if (fx === 0 && fy === 0) return DIR_DOWN;
  const a = Math.atan2(fy, fx);                       // 0 = right, +pi/2 = down
  const o = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  return [DIR_RIGHT, DIR_DOWN_RIGHT, DIR_DOWN, DIR_DOWN_LEFT, DIR_LEFT, DIR_UP_LEFT, DIR_UP, DIR_UP_RIGHT][o]!;
}

export type HairStyle = 'short' | 'long' | 'bun' | 'bald' | 'braids' | 'curly' | 'ponytail';
export type HatStyle = 'cap' | 'brim' | 'beret';
export interface Outfit {
  shirt: Ramp; pants: Ramp; hair: Ramp; skin: Ramp; boots: Ramp;
  longHair?: boolean; hat?: Ramp;
  /** NPC extras */
  hairStyle?: HairStyle; hatStyle?: HatStyle; beard?: Ramp; moustache?: boolean; glasses?: boolean; apron?: Ramp; scarf?: Ramp;
  /** px by which the body is shorter (children) */
  shorten?: number; headband?: number;
  /** quantum adventurer trim: glowing seams on the tunic */
  glow?: number; cape?: Ramp; vest?: Ramp;
}

const SKIN_LIGHT = [C.e3, C.e4, C.e5, C.e6, C.e7] as Ramp;
const SKIN_MID = [C.e3, C.e4, C.e5, C.e6, C.e7] as Ramp;
const SKIN_DARK = [C.e1, C.e2, C.e3, C.e4, C.e5] as Ramp;
const HAIR = {
  brown: [C.e0, C.e1, C.e2, C.e3, C.e4] as Ramp, black: [C.ink, C.night, C.slate, C.steel] as Ramp,
  blond: [C.e3, C.e4, C.e5, C.e6, C.e7] as Ramp, red: [C.r0, C.r1, C.r2, C.r3, C.r4] as Ramp,
  white: [C.steel, C.mist, C.fog, C.pale, C.white] as Ramp, violet: [C.q0, C.q1, C.q2, C.q3, C.q4] as Ramp,
};
const cloth = (a: number[]) => a as Ramp;
const PANTS = { brown: cloth([C.e0, C.e1, C.e2, C.e3]), slate: cloth([C.night, C.slate, C.steel, C.mist]), navy: cloth([C.w0, C.w1, C.w2, C.w3]), olive: cloth([C.g0, C.g1, C.g2, C.g3]) };
const BOOTS = cloth([C.ink, C.e0, C.e1, C.e2]);

/** Player appearance presets (chosen from the session id) and NPC outfits. */
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

const rmp = (a: number[]) => a as Ramp;
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

// ───────────────────────── people ─────────────────────────
interface View { turn: number; s: number }      // turn 0 front .. 1 profile .. 2 back; s = +1 facing right, -1 left
const VIEWS: View[] = [
  { turn: 0, s: 1 },     // DOWN
  { turn: 2, s: 1 },     // UP
  { turn: 1, s: -1 },    // LEFT
  { turn: 1, s: 1 },     // RIGHT
  { turn: 0.5, s: -1 },  // DOWN_LEFT
  { turn: 0.5, s: 1 },   // DOWN_RIGHT
  { turn: 1.5, s: -1 },  // UP_LEFT
  { turn: 1.5, s: 1 },   // UP_RIGHT
];

/** Draw one 24x32 person frame. frame 0 idle, 1..8 walk, 9 idle-breath. */
function drawPerson(ctx: Ctx, dir: number, frame: number, o: Outfit, seed: number): void {
  const v = VIEWS[dir]!;
  const s = v.s, turn = v.turn;
  const back = turn > 1.2, front = turn < 0.8, profile = turn === 1;
  const moving = frame >= 1 && frame <= 8;
  const p = moving ? ((frame - 1) / 8) * Math.PI * 2 : 0;
  const sw = moving ? Math.sin(p) : 0;
  const cosp = moving ? Math.cos(p) : 0;
  const bob = moving ? (Math.abs(sw) < 0.6 ? -1 : 0) : frame === 9 ? 1 : 0;
  const sh = o.shorten ?? 0;
  const cx = 12;
  const foot = 30;
  const hip = 18.5 + sh;
  const top = bob;                       // vertical shift of the upper body
  const tw = profile ? 3.1 : front || back ? 4.1 : 3.7;     // torso half width
  // depth ordering helpers: "near" side is the one toward the camera (screen down); for side views the s side leads
  const legX = (k: number) => (profile ? cx + (k ? 0.5 : -0.5) * s : cx + (k ? 1.7 : -1.7) + (turn === 0.5 || turn === 1.5 ? 0.5 * s : 0));
  const legSwing = (k: number) => (k ? -sw : sw);
  const drawLeg = (k: number) => {
    const sk = legSwing(k);
    const lift = moving ? Math.max(0, (k ? -cosp : cosp)) * 2.2 : 0;
    const dx = profile ? sk * 3.2 * s : turn === 0.5 || turn === 1.5 ? sk * 1.8 * s : 0;
    const dy = profile ? 0 : front ? sk * 0.9 : back ? -sk * 0.9 : sk * 0.6;
    const x0 = legX(k), ax = x0 + dx, ay = foot - 2 - lift + dy;
    limb(ctx, x0, hip + top * 0.5, ax, ay, 2.0, 1.7, o.pants, seed + k, k ? -0.08 : 0);
    const toe = profile ? 1.3 * s : turn === 0.5 || turn === 1.5 ? 0.7 * s : 0;
    blob(ctx, ax + toe, ay + 1.2, profile ? 2.5 : 2.0, 1.5, o.boots, { seed: seed + 5 + k, noise: 0.04, edgeDark: 0.2, bright: 0.05 });
  };
  const armSwing = (k: number) => (k ? sw : -sw);
  const drawArm = (k: number) => {
    // k: 0 = left side of the screen, 1 = right side (front/back views); for profile, 1 = near arm
    const sk = armSwing(k);
    let sx: number, hx: number, hy: number;
    if (profile) { sx = cx + (k ? -0.6 : 0.6) * s; hx = sx + sk * 2.6 * s; hy = 19.4 + Math.abs(sk) * -0.8; }
    else { sx = cx + (k ? tw + 0.4 : -tw - 0.4); hx = sx + (k ? 0.7 : -0.7) + (turn === 0.5 || turn === 1.5 ? sk * 1.2 * s : 0); hy = 19.4 + (front ? sk : back ? -sk : sk * 0.8) * 1.5; }
    limb(ctx, sx, 12.4 + top + sh * 0.6, hx, hy - 1 + top + sh * 0.6, 1.5, 1.25, o.shirt, seed + 10 + k, k ? -0.06 : 0.04);
    blob(ctx, hx, hy + top + sh * 0.6, 1.2, 1.2, o.skin, { seed: seed + 12 + k, noise: 0, edgeDark: 0.2 });
  };

  // cape behind everything (front views) / over the back (back views)
  const capeDraw = () => {
    if (!o.cape) return;
    const flutter = moving ? Math.sin(p * 2) * 0.8 : 0;
    if (back) poly(ctx, [[cx - tw - 0.5, 11.5 + top], [cx + tw + 0.5, 11.5 + top], [cx + tw + 1.8, 25 + flutter], [cx - tw - 1.8, 25 - flutter]], (x, y) => rampAt(o.cape!, 0.75 - (x - cx + tw) / 14 - (y - 11.5) / 40 + ((x + y) % 4 === 0 ? -0.15 : 0), x, y));
    else if (!front) poly(ctx, [[cx - 1.5 * s, 11.5 + top], [cx - 3.5 * s, 12.5 + top], [cx - 6 * s + flutter * s, 24], [cx - 2 * s, 25]], (x, y) => rampAt(o.cape!, 0.5 - (y - 11.5) / 40, x, y));
    else { put(ctx, Math.round(cx - tw - 1.5), 12 + top, o.cape[1]!, 1, 9); put(ctx, Math.round(cx + tw + 0.5), 12 + top, o.cape[0]!, 1, 9); }
  };
  if (!back) capeDraw();

  // far limbs first
  if (profile) { drawArm(0); drawLeg(s > 0 ? 0 : 1); drawLeg(s > 0 ? 1 : 0); }
  else { drawLeg(0); drawLeg(1); }

  // torso (slightly tapered tunic), belt
  const ty0 = 11 + top + sh * 0.6, ty1 = hip + 1 + top * 0.5;
  poly(ctx, [[cx - tw, ty0], [cx + tw, ty0], [cx + tw - 0.6, ty1], [cx - tw + 0.6, ty1]], (x, y) => {
    const u = (x + 0.5 - (cx - tw)) / (2 * tw);
    const lit = 0.9 - u * 0.65 - (y - ty0) / 28 + (front || back ? 0 : 0);
    return rampAt(o.shirt, lit, x, y);
  });
  // shoulders rounded
  blob(ctx, cx - tw + 0.9, ty0 + 0.8, 1.7, 1.3, o.shirt, { seed: seed + 20, noise: 0, bright: 0.12, edgeDark: 0.1 });
  blob(ctx, cx + tw - 0.9, ty0 + 0.8, 1.7, 1.3, o.shirt, { seed: seed + 21, noise: 0, bright: -0.1, edgeDark: 0.1 });
  if (o.vest && !back) poly(ctx, [[cx - tw, ty0 + 1], [cx - 1, ty0 + 1], [cx - 1.5, ty1 - 1], [cx - tw + 0.6, ty1 - 1]], (x, y) => rampAt(o.vest!, 0.7 - (y - ty0) / 30, x, y));
  if (o.vest && !back && !profile) poly(ctx, [[cx + 1, ty0 + 1], [cx + tw, ty0 + 1], [cx + tw - 0.6, ty1 - 1], [cx + 1.5, ty1 - 1]], (x, y) => rampAt(o.vest!, 0.35 - (y - ty0) / 30, x, y));
  const beltY = Math.round(ty1 - 1.5);
  put(ctx, Math.round(cx - tw + 0.6), beltY, C.e0, Math.round(2 * tw - 1.2), 1);
  if (!back) put(ctx, Math.round(cx + (profile ? 1 * s : 0)) - (profile ? 0 : 0), beltY, C.r6, 1, 1);
  // quantum trim: a glowing seam down the tunic
  if (o.glow !== undefined && !back) { const gx = Math.round(cx + (profile ? 1.6 * s : turn === 0.5 ? 1.2 * s : 0)); for (let y = Math.round(ty0) + 2; y < beltY; y += 2) put(ctx, gx, y, o.glow); }
  // apron
  if (o.apron) {
    if (front || turn === 0.5) poly(ctx, [[cx - tw + 1.2 + (turn === 0.5 ? s : 0), ty0 + 3], [cx + tw - 1.2 + (turn === 0.5 ? s : 0), ty0 + 3], [cx + tw - 0.6, hip + 5], [cx - tw + 0.6, hip + 5]], (x, y) => rampAt(o.apron!, 0.85 - (x - cx + tw) / 12 - (y - ty0) / 40, x, y));
    else if (profile) poly(ctx, [[cx + 1 * s, ty0 + 3], [cx + 2.6 * s, ty0 + 3], [cx + 3.4 * s, hip + 5], [cx + 1.2 * s, hip + 5]], o.apron[2]!);
    else { put(ctx, Math.round(cx - 1), Math.round(ty1 - 3), o.apron[1]!, 3, 2); put(ctx, Math.round(cx - tw + 1), Math.round(ty0), o.apron[1]!, 1, 4); put(ctx, Math.round(cx + tw - 2), Math.round(ty0), o.apron[1]!, 1, 4); }
  }
  if (back) capeDraw();

  // near limbs
  if (profile) drawArm(1);
  else { drawArm(0); drawArm(1); }

  // neck + head
  const hx = cx + (profile ? 0.8 * s : turn === 0.5 || turn === 1.5 ? 0.4 * s : 0);
  const hy = 6.3 + top + sh * 0.5;
  put(ctx, Math.round(hx) - 1, Math.round(hy + 3), o.skin[1]!, 2, 2);
  if (o.scarf) { blob(ctx, cx, ty0 + 0.6, tw - 0.6, 1.6, o.scarf, { seed: seed + 30, noise: 0.1, edgeDark: 0.15 }); if (!back) put(ctx, Math.round(cx + (profile ? -1.5 * s : 1.5)), Math.round(ty0 + 1), o.scarf[1]!, 1, 4); }
  blob(ctx, hx, hy, profile ? 3.3 : 3.5, 3.9, o.skin, { seed: seed + 31, noise: 0.02, edgeDark: 0.16, bright: 0.04 });
  // ear (profile / three-quarter)
  if (!front || turn === 0.5) if (!back || turn === 1.5) put(ctx, Math.round(hx - 1.2 * s), Math.round(hy + 0.3), o.skin[1]!, 1, 2);

  // hair
  const style: HairStyle = o.hairStyle ?? (o.longHair ? 'long' : 'short');
  const H = o.hair;
  if (style !== 'bald') {
    const big = style === 'curly' ? 1 : 0;
    // cap of hair: covers the top of the head; front views leave the face clear below the fringe
    for (let y = Math.floor(hy - 4.6 - big); y <= Math.ceil(hy + 3.8); y++) for (let x = Math.floor(hx - 4.8 - big); x <= Math.ceil(hx + 4.8 + big); x++) {
      const nx = (x + 0.5 - hx) / (3.9 + big * 0.9), ny = (y + 0.5 - (hy - 0.4)) / (4.1 + big * 0.9);
      if (nx * nx + ny * ny > 1) continue;
      const fringe = hy - 1.0 + Math.sin(x * 1.7) * 0.5;
      let cover: boolean;
      if (back) cover = y < hy + 2.8;
      else if (front) cover = y < fringe || (Math.abs(nx) > 0.8 && y < hy + 1.4);
      else if (profile) cover = y < fringe - 0.4 || (x - hx) * s < -0.6;
      else cover = y < fringe || ((x - hx) * s < -1.6 && y < hy + 2.2) || (turn === 1.5 && y < hy + 2.8 && (x - hx) * s < 1.1);
      if (!cover) continue;
      const lam = -nx * 0.6 - ny * 0.7;
      const n = ((x * 7 + y * 13 + seed) % 5) / 5;
      put(ctx, x, y, rampAt(H, 0.55 + lam * 0.5 + (big ? (n - 0.5) * 0.5 : (n - 0.5) * 0.15) + (y === Math.floor(hy - 3.8) ? 0.1 : 0), x, y));
    }
    const longLen = style === 'long' ? 7 : style === 'braids' ? 8.5 : 0;
    if (longLen) {
      if (back) poly(ctx, [[hx - 3.6, hy], [hx + 3.6, hy], [hx + 3.3, hy + longLen - 2], [hx - 3.3, hy + longLen - 2]], (x, y) => rampAt(H, 0.65 - (y - hy) / 20 - (x - hx + 5) / 25 + (x % 2 ? 0.08 : 0), x, y));
      else if (front || turn === 0.5) { for (const sx of style === 'braids' ? [-3.8, 3] : [-4, 3.3]) for (let y = 0; y < longLen - 1; y++) put(ctx, Math.round(hx + sx + (sx < 0 ? 0 : 0)), Math.round(hy + y), rampAt(H, 0.5 - y / 20 + (sx < 0 ? 0.15 : 0), 0, y), style === 'braids' ? 1 : 2, 1); }
      else poly(ctx, [[hx - 0.8 * s, hy - 1], [hx - 3.6 * s, hy - 1], [hx - 3.3 * s, hy + longLen - 2], [hx - 1.2 * s, hy + longLen - 3]], (x, y) => rampAt(H, 0.45 - (y - hy) / 25, x, y));
    }
    if (style === 'bun') blob(ctx, hx - (profile ? 2.2 * s : 0), hy - 4.6 + (back ? 1 : 0), 2.0, 1.8, H, { seed: seed + 40, noise: 0.15, edgeDark: 0.2 });
    if (style === 'ponytail') {
      if (back) limb(ctx, hx, hy - 1, hx + 0.5, hy + 5.5, 1.5, 1.0, H, seed + 41);
      else if (!front) limb(ctx, hx - 3 * s, hy - 1.5, hx - 4.6 * s, hy + 4, 1.4, 0.9, H, seed + 41);
      else { put(ctx, Math.round(hx + 3.6), Math.round(hy - 1.5), H[1]!, 1, 4); }
    }
  } else {
    put(ctx, Math.round(hx - 1.5), Math.round(hy - 3), o.skin[4]!, 2, 1);      // scalp shine
  }
  if (o.headband !== undefined) put(ctx, Math.round(hx - 3.5), Math.round(hy - 1.5), o.headband, 7, 1);

  // face
  const ey = Math.round(hy + 0.5);
  if (front) {
    for (const ex of [-2, 1]) { put(ctx, Math.round(hx) + ex, ey, C.ink, 1, 2); put(ctx, Math.round(hx) + ex, ey, C.night, 1, 1); }
    put(ctx, Math.round(hx - 3), ey + 2, C.r4); put(ctx, Math.round(hx + 2), ey + 2, C.r4);
    put(ctx, Math.round(hx) - 1, ey + 2, o.skin[0]!, 2, 1);
  } else if (turn === 0.5) {
    const e1 = Math.round(hx + 0.0 * s), e2 = Math.round(hx + 2.4 * s);
    put(ctx, e1 - (s < 0 ? 1 : 0), ey, C.ink, 1, 2); put(ctx, e2 - (s < 0 ? 1 : 0), ey, C.ink, 1, 2);
    put(ctx, Math.round(hx - 1.8 * s), ey + 2, C.r4);
    put(ctx, Math.round(hx + 1.5 * s), ey + 2, o.skin[0]!, 1, 1);
  } else if (profile) {
    put(ctx, Math.round(hx + 1.9 * s) - (s < 0 ? 1 : 0), ey, C.ink, 1, 2);
    put(ctx, Math.round(hx + 3.4 * s) - (s < 0 ? 1 : 0), ey + 1, o.skin[2]!, 1, 1);           // nose
    put(ctx, Math.round(hx + 2.4 * s) - (s < 0 ? 1 : 0), ey + 2, o.skin[0]!, 1, 1);
  }
  if (o.glasses && !back) {
    if (front) { for (const ex of [-3, 0]) { put(ctx, Math.round(hx + ex) - 0, ey - 1, C.night, 3, 1); put(ctx, Math.round(hx + ex), ey + 2, C.night, 3, 1); put(ctx, Math.round(hx + ex + 1), ey - 0, C.w6); } }
    else put(ctx, Math.round(hx + (turn === 0.5 ? 1 : 2) * s) - 1, ey - 1, C.night, 3, 1);
  }
  if (o.beard && !back) {
    const bx = hx + (profile ? 1.8 * s : turn === 0.5 ? 1 * s : 0);
    blob(ctx, bx, hy + 2.6, profile ? 1.9 : 2.5, 1.7, o.beard, { seed: seed + 50, noise: 0.3, edgeDark: 0.15 });
    put(ctx, Math.round(bx) - 1, Math.round(hy + 1.9), o.skin[0]!, 2, 1);
  }
  if (o.moustache && !back) put(ctx, Math.round(hx + (profile ? 2.5 * s : turn === 0.5 ? 1.3 * s : 0)) - 2, Math.round(hy + 1.9), (o.beard ?? o.hair)[1]!, 3, 1);

  // hats
  if (o.hat) {
    const hs = o.hatStyle ?? 'cap';
    const hh = o.hat;
    if (hs === 'brim') {
      blob(ctx, hx, hy - 2.8, 5.6, 1.7, hh, { seed: seed + 60, noise: 0.25, edgeDark: 0.2 });
      blob(ctx, hx, hy - 4.2, 3.1, 2.1, hh, { seed: seed + 61, noise: 0.25, bright: 0.12, edgeDark: 0.12 });
      put(ctx, Math.round(hx - 3), Math.round(hy - 3.4), C.r3, 6, 1);
    } else if (hs === 'beret') {
      blob(ctx, hx - 0.6 * s, hy - 3.4, 4.2, 1.9, hh, { seed: seed + 62, noise: 0.15, edgeDark: 0.15 });
      put(ctx, Math.round(hx - 0.4 * s), Math.round(hy - 5.6), hh[0]!, 1, 1);
    } else {
      blob(ctx, hx, hy - 3.4, 3.9, 2.3, hh, { seed: seed + 63, noise: 0.1, edgeDark: 0.12 });
      if (!back) blob(ctx, hx + (profile ? 3 * s : turn === 0.5 ? 1.5 * s : 0), hy - 1.8 + (front ? 0.4 : 0), profile ? 2.4 : 3, 1, hh, { seed: seed + 64, noise: 0, edgeDark: 0.3 });
    }
  }
}

// ───────────────────────── fauna & enemies ─────────────────────────
const FUR: Ramp = [C.e1, C.e2, C.e3, C.e4, C.e5, C.e6];
const FUR_DEER: Ramp = [C.e0, C.e1, C.e2, C.e3, C.e4, C.e5];
const CREAM: Ramp = [C.e5, C.e6, C.e7, C.white];

/** 20x18 hopping rabbit facing right. frames: 0 crouch, 1 launch, 2 peak, 3 land. */
function drawRabbit(ctx: Ctx, frame: number): void {
  const air = [0, 2, 4, 1][frame]!;
  const st = [0, 1.5, 1, -0.5][frame]!;     // stretch (+) / squash (-)
  const by = 14 - air;
  blob(ctx, 6 - st, by - 0.5, 4.4, 3.4 - st * 0.3, FUR, { seed: 4, noise: 0.15, edgeDark: 0.25 });           // haunch
  blob(ctx, 10, by - 2.4, 5.6 + st * 0.6, 3.8 - st * 0.4, FUR, { seed: 5, noise: 0.15, edgeDark: 0.22 });     // body
  blob(ctx, 10.5, by - 0.8, 4, 1.6, CREAM, { seed: 6, noise: 0.05, edgeDark: 0 });
  blob(ctx, 2.6 - st, by - 3.4, 2, 2, [C.fog, C.pale, C.white, C.white], { seed: 3, noise: 0.05, edgeDark: 0.15 });  // tail
  blob(ctx, 15 + st * 0.5, by - 5, 3.4, 3, FUR, { seed: 7, noise: 0.1, edgeDark: 0.2, bright: 0.05 });       // head
  const ear = frame === 2 ? 1 : 0;
  limb(ctx, 13.5 + st * 0.5, by - 7, 12.5 - ear, by - 12 + ear, 1.2, 1.1, FUR, 8);
  limb(ctx, 15.2 + st * 0.5, by - 7, 15.8 - ear, by - 12.5 + ear, 1.2, 1.1, FUR, 9, 0.1);
  put(ctx, Math.round(15.7 + st * 0.5 - ear), by - 11, C.r5, 1, 3);
  put(ctx, Math.round(16.6 + st * 0.5), by - 6, C.ink, 1, 2); put(ctx, Math.round(16.6 + st * 0.5), by - 6, C.night);
  put(ctx, Math.round(18.2 + st * 0.5), by - 4, C.r5);
  // feet
  put(ctx, Math.round(13 + st), by + 1 + Math.min(air, 1), FUR[2]!, 3, 1);
  put(ctx, Math.round(3 - st * 2), by + 1, FUR[1]!, 5, 1);
}

/** 34x34 walking stag facing right. 4-frame walk cycle. */
function drawDeer(ctx: Ctx, frame: number): void {
  const sw = [2, 0, -2, 0][frame]!;
  const bob = frame % 2 === 0 ? 0 : 1;
  const B = 18 - bob;
  for (const [lx, d, ramp] of [[11, -sw, [C.e0, C.e1, C.e2]], [23, sw, [C.e0, C.e1, C.e2]], [9, sw, FUR_DEER], [25, -sw, FUR_DEER]] as const) {
    limb(ctx, lx, B + 2, lx + d * 0.6, 30, 1.8, 1.1, ramp as Ramp, lx);
    put(ctx, Math.round(lx + d * 0.6) - 1, 31, C.ink, 2, 2);
  }
  blob(ctx, 17, B - 1, 10, 5, FUR_DEER, { seed: 12, noise: 0.12, edgeDark: 0.25 });
  blob(ctx, 16, B + 2, 7, 2, CREAM, { seed: 13, noise: 0.05, edgeDark: 0 });
  for (let i = 0; i < 5; i++) put(ctx, 11 + i * 3, B - 3 + (i % 2), C.e6);
  blob(ctx, 7, B - 3, 2, 2.4, [C.pale, C.white, C.white], { seed: 14, noise: 0 });
  limb(ctx, 24, B - 2, 27, B - 10, 3.2, 2.4, FUR_DEER, 15, 0.08);
  blob(ctx, 28.5, B - 11.5, 3.6, 2.8, FUR_DEER, { seed: 16, noise: 0.08, edgeDark: 0.2, bright: 0.06 });
  blob(ctx, 31.3, B - 10.5, 1.6, 1.4, [C.e1, C.e2, C.e3], { seed: 17, noise: 0 });
  put(ctx, 29, B - 13, C.ink, 1, 2); put(ctx, 32, B - 10, C.ink);
  put(ctx, 25, B - 14, FUR_DEER[1]!, 2, 2);
  // antlers
  const ant = [[27, B - 14, 25, B - 20], [25, B - 20, 23, B - 23], [25, B - 20, 27, B - 23], [28, B - 14, 30, B - 19], [30, B - 19, 29, B - 23], [30, B - 19, 32, B - 21]] as const;
  for (const [x0, y0, x1, y1] of ant) limb(ctx, x0, y0, x1, y1, 0.7, 0.6, [C.e4, C.e5, C.e6, C.e7], 18);
}

const GEL: Ramp = [C.w1, C.w2, C.w3, C.w4, C.w5, C.w6, C.w7];
const GEL_N: Ramp = [C.q0, C.q1, C.q2, C.q3, C.q4, C.q6, C.white];

/** Wisp Slime, 24x20: wobbly jelly with a floating wisp-core and squash/stretch. */
function drawSlime(ctx: Ctx, frame: number, night: boolean): void {
  const ramp = night ? GEL_N : GEL;
  const squash = [0, 1.4, 2.4, 1][frame % 4]!;
  const ry = 7.2 - squash * 0.9, rx = 8 + squash * 0.9;
  const cy = 19 - ry;
  // gooey base puddle
  blob(ctx, 12, 18.4, rx + 1.2, 1.6, ramp, { seed: 2, noise: 0.05, bright: -0.25, edgeDark: 0.1 });
  blob(ctx, 12, cy, rx, ry, ramp, { seed: night ? 7 : 3, noise: 0.06, bright: 0.02, edgeDark: 0.42, shape: 2.15 });
  // translucent core with a wisp inside
  blob(ctx, 12.6, cy + 1.5, rx * 0.45, ry * 0.4, ramp, { seed: 4, noise: 0.05, bright: 0.25, edgeDark: 0.05 });
  const wy = Math.round(cy + 1 - (frame % 2));
  put(ctx, 12, wy, night ? C.q7 : C.w7, 2, 2); put(ctx, 13, wy - 1, C.white);
  // highlights
  put(ctx, Math.round(12 - rx * 0.55), Math.round(cy - ry * 0.55), C.white, 2, 1);
  put(ctx, Math.round(12 - rx * 0.62), Math.round(cy - ry * 0.4), C.white, 1, 1);
  // face
  const ey = Math.round(cy - ry * 0.12);
  for (const ex of [8, 15]) { put(ctx, ex, ey, C.ink, 2, 3); put(ctx, ex, ey, night ? C.q7 : C.white); }
  put(ctx, 11, ey + 3, C.ink, 3, 1);
  if (frame % 4 === 2) put(ctx, 12, ey + 4, C.r4);   // a tongue on the big squash
}

/** Glint Hopper, 22x22: a crystal-backed jumping critter; frames 0 idle, 1 squat, 2 air, 3 land. */
function drawHopper(ctx: Ctx, frame: number, night: boolean): void {
  const ramp: Ramp = night ? [C.r0, C.r1, C.r2, C.r3, C.r4, C.r5] : FUR;
  const air = frame === 2 ? 4 : 0, squat = frame === 1 ? 2 : frame === 3 ? 1 : 0;
  const by = 20 - air;
  blob(ctx, 11, by - 5 + squat * 0.5, 7 + squat * 0.5, 5 - squat * 0.4 + (frame === 2 ? 0.8 : 0), ramp, { seed: night ? 5 : 2, noise: 0.15, edgeDark: 0.3 });
  blob(ctx, 11, by - 3 + squat * 0.4, 5, 2.2, CREAM, { seed: 3, noise: 0.05, edgeDark: 0, bright: -0.1 });
  // glinting crystal crest
  for (const [x, h] of [[7, 4], [10, 6], [13, 5], [15, 3]] as const) {
    const y0 = by - 9 + squat;
    poly(ctx, [[x - 1.2, y0 + 1], [x, y0 - h], [x + 1.2, y0 + 1]], (px) => (px < x ? (night ? C.q6 : C.q7) : (night ? C.q3 : C.w5)));
  }
  // ears + eyes
  limb(ctx, 7, by - 8 + squat, 4.5, by - 13 + squat + (frame === 2 ? 2 : 0), 1.3, 1, ramp, 8);
  limb(ctx, 15, by - 8 + squat, 17.5, by - 13 + squat + (frame === 2 ? 2 : 0), 1.3, 1, ramp, 9);
  const ey = by - 6 + squat;
  put(ctx, 8, ey, C.ink, 2, 2); put(ctx, 13, ey, C.ink, 2, 2);
  put(ctx, 8, ey, night ? C.r6 : C.white); put(ctx, 13, ey, night ? C.r6 : C.white);
  put(ctx, 10, ey + 2, C.r3, 3, 1);
  // feet
  blob(ctx, 6, by - 0.5, 2.6, 1.4, ramp, { seed: 11, noise: 0.05 }); blob(ctx, 16, by - 0.5, 2.6, 1.4, ramp, { seed: 12, noise: 0.05 });
}

function drawOrb(ctx: Ctx, frame: number): void {
  const r = frame ? 4.6 : 3.8;
  blob(ctx, 8, 8, r, r, [C.q2, C.q3, C.q4, C.q6, C.white], { seed: 1, noise: 0, bright: 0.15, edgeDark: 0.1 });
  put(ctx, 6, 6, C.white, 2, 1);
  put(ctx, frame ? 2 : 13, 8, C.q7); put(ctx, 8, frame ? 13 : 2, C.q7);
}

export interface Sheets {
  /** frame 0 = idle (breathes on its own), 1..WALK_FRAMES-1 = walk; dir = one of the 8 DIR_* constants */
  person(outfit: number, dir: number, frame: number): Texture;
  /** unique sprite per village NPC; same layout as `person` */
  npc(npcId: string, dir: number, frame: number): Texture;
  /** passive fauna: 4 frames, always drawn facing right (flip the sprite to face left) */
  rabbit(frame: number, dir: number): Texture;
  deer(frame: number, dir: number): Texture;
  slime(night: boolean, frame: number): Texture;
  hopper(night: boolean, frame: number): Texture;
  orb(frame: number): Texture;
}

function polished(buf: PixBuf, ax: number, ay: number, rx: number): void {
  outline(buf.ctx, buf.width, buf.height, C.night);
  polish(buf.ctx, buf.width, buf.height, { rim: true, ao: { ax, ay, rx } });
}

function personSheet(looks: Outfit[], seedBase: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(PERSON_W * COLS, looks.length * 8 * PERSON_H);
  looks.forEach((o, i) => {
    for (let d = 0; d < 8; d++) for (let f = 0; f < COLS; f++) {
      const buf = new PixBuf(PERSON_W, PERSON_H);
      drawPerson(buf.ctx, d, f, o, seedBase + i * 37 + d * 13);
      polished(buf, 12, 31, 6);
      buf.blit(ctx, f * PERSON_W, (i * 8 + d) * PERSON_H);
    }
  });
  return canvas;
}

export function buildActorSheets(): Sheets {
  const base = Texture.from(personSheet(OUTFITS, 1)); base.source.scaleMode = 'nearest';
  const npcIds = NPCS.map((n) => n.id);
  const npcBase = Texture.from(personSheet(npcIds.map((id, i) => NPC_LOOKS[id] ?? OUTFITS[i % OUTFITS.length]!), 700)); npcBase.source.scaleMode = 'nearest';

  // creatures: slime 24x20 (day/night x4), hopper 22x22 (x4 x2), orb 16x16 x2, rabbit 20x18 x4, deer 34x34 x4
  const cw = 34 * 4, ch = 20 * 2 + 22 * 2 + 16 + 18 + 34;
  const { canvas: cc, ctx: cctx } = makeCanvas(cw, ch);
  const stamp = (w: number, h: number, x: number, y: number, draw: (c: Ctx) => void, ao: [number, number, number] | null) => {
    const buf = new PixBuf(w, h);
    draw(buf.ctx);
    outline(buf.ctx, w, h, C.night);
    polish(buf.ctx, w, h, { rim: true, ao: ao ? { ax: ao[0], ay: ao[1], rx: ao[2] } : null });
    buf.blit(cctx, x, y);
  };
  const Y = { slime: 0, hopper: 40, orb: 84, rabbit: 100, deer: 118 };
  for (let f = 0; f < 4; f++) {
    stamp(24, 20, f * 24, Y.slime, (c) => drawSlime(c, f, false), null);
    stamp(22, 22, f * 22, Y.hopper, (c) => drawHopper(c, f, false), null);
    stamp(22, 22, f * 22, Y.hopper + 22, (c) => drawHopper(c, f, true), null);
    stamp(20, 18, f * 20, Y.rabbit, (c) => drawRabbit(c, f), null);
    stamp(34, 34, f * 34, Y.deer, (c) => drawDeer(c, f), null);
  }
  // night slimes go in the second slime row
  const slimeN = makeCanvas(96, 20);
  for (let f = 0; f < 4; f++) { const buf = new PixBuf(24, 20); drawSlime(buf.ctx, f, true); outline(buf.ctx, 24, 20, C.night); polish(buf.ctx, 24, 20, { rim: true }); buf.blit(slimeN.ctx, f * 24, 0); }
  for (let f = 0; f < 2; f++) stamp(16, 16, f * 16, Y.orb, (c) => drawOrb(c, f), null);
  const cBase = Texture.from(cc); cBase.source.scaleMode = 'nearest';
  const nBase = Texture.from(slimeN.canvas); nBase.source.scaleMode = 'nearest';

  const cache = new Map<string, Texture>();
  const sub = (src: Texture, key: string, x: number, y: number, w: number, h: number) => {
    let t = cache.get(key);
    if (!t) { t = new Texture({ source: src.source, frame: new Rectangle(x, y, w, h) }); cache.set(key, t); }
    return t;
  };
  // idle frames alternate with a breathing frame on their own clock (phase-offset per look/direction)
  const idleCol = (k: number) => ((performance.now() / 700 + k * 0.37) % 2 < 1.15 ? 0 : COLS - 1);
  const col = (f: number, k: number) => (f <= 0 ? idleCol(k) : Math.min(WALK_FRAMES - 1, f));
  const dd = (d: number) => ((d % 8) + 8) % 8;
  return {
    person: (o, d, f) => { const c = col(f, o * 3 + d); return sub(base, `p${o}.${dd(d)}.${c}`, c * PERSON_W, (o * 8 + dd(d)) * PERSON_H, PERSON_W, PERSON_H); },
    npc: (id, d, f) => { const i = Math.max(0, npcIds.indexOf(id)); const c = col(f, i * 5 + d); return sub(npcBase, `n${i}.${dd(d)}.${c}`, c * PERSON_W, (i * 8 + dd(d)) * PERSON_H, PERSON_W, PERSON_H); },
    rabbit: (f) => sub(cBase, `r${f % 4}`, (f % 4) * 20, Y.rabbit, 20, 18),
    deer: (f) => sub(cBase, `d${f % 4}`, (f % 4) * 34, Y.deer, 34, 34),
    slime: (n, f) => (n ? sub(nBase, `sn${f % 4}`, (f % 4) * 24, 0, 24, 20) : sub(cBase, `s${f % 4}`, (f % 4) * 24, Y.slime, 24, 20)),
    hopper: (n, f) => sub(cBase, `h${n}.${f % 4}`, (f % 4) * 22, Y.hopper + (n ? 22 : 0), 22, 22),
    orb: (f) => sub(cBase, `o${f % 2}`, (f % 2) * 16, Y.orb, 16, 16),
  };
}
