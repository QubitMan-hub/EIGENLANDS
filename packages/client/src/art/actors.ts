import { Rectangle, Texture } from 'pixi.js';
import { NPCS } from '@eigenlands/shared';
import { blob, C, dk, line, lt, makeCanvas, put, R, slab, type Ctx, type Ramp } from './shade';

export const DIR_DOWN = 0, DIR_UP = 1, DIR_LEFT = 2, DIR_RIGHT = 3;
export const WALK_FRAMES = 8;
export const PERSON_H = 24;

export function dirOf(fx: number, fy: number): number {
  if (Math.abs(fx) > Math.abs(fy)) return fx < 0 ? DIR_LEFT : DIR_RIGHT;
  return fy < 0 ? DIR_UP : DIR_DOWN;
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
}

const SKIN_LIGHT = [C.e3, C.e4, C.e5, C.e6, C.e7] as Ramp;
const SKIN_MID = [C.e2, C.e3, C.e4, C.e5, C.e6] as Ramp;
const SKIN_DARK = [C.e0, C.e1, C.e2, C.e3, C.e4] as Ramp;
const HAIR = {
  brown: [C.e0, C.e1, C.e2, C.e3] as Ramp, black: [C.ink, C.night, C.slate, C.steel] as Ramp,
  blond: [C.e3, C.e4, C.e5, C.e6] as Ramp, red: [C.r1, C.r2, C.r3, C.r4] as Ramp,
  white: [C.steel, C.mist, C.fog, C.pale] as Ramp, violet: [C.q1, C.q2, C.q3, C.q4] as Ramp,
};
const cloth = (a: number[]) => a as Ramp;
const PANTS = { brown: cloth([C.e0, C.e1, C.e2]), slate: cloth([C.night, C.slate, C.steel]), navy: cloth([C.w0, C.w1, C.w2]), olive: cloth([C.g0, C.g1, C.g2]) };
const BOOTS = cloth([C.ink, C.e0, C.e1]);

/** Player appearance presets (chosen from the session id) and NPC outfits. */
export const OUTFITS: Outfit[] = [
  { shirt: cloth([C.w1, C.w2, C.w3, C.w4]), pants: PANTS.brown, hair: HAIR.brown, skin: SKIN_LIGHT, boots: BOOTS },
  { shirt: cloth([C.r1, C.r2, C.r3, C.r4]), pants: PANTS.slate, hair: HAIR.black, skin: SKIN_MID, boots: BOOTS, longHair: true },
  { shirt: cloth([C.q1, C.q2, C.q3, C.q4]), pants: PANTS.navy, hair: HAIR.blond, skin: SKIN_LIGHT, boots: BOOTS },
  { shirt: cloth([C.g1, C.g2, C.g3, C.g4]), pants: PANTS.brown, hair: HAIR.red, skin: SKIN_MID, boots: BOOTS, longHair: true },
  { shirt: cloth([C.e3, C.e4, C.e5, C.e6]), pants: PANTS.olive, hair: HAIR.violet, skin: SKIN_DARK, boots: BOOTS },
  { shirt: cloth([C.steel, C.mist, C.fog, C.pale]), pants: PANTS.slate, hair: HAIR.white, skin: SKIN_DARK, boots: BOOTS, longHair: true },
  { shirt: cloth([C.r2, C.r3, C.r4, C.r5]), pants: PANTS.navy, hair: HAIR.black, skin: SKIN_LIGHT, boots: BOOTS },
  { shirt: cloth([C.w2, C.w3, C.w4, C.w5]), pants: PANTS.brown, hair: HAIR.blond, skin: SKIN_DARK, boots: BOOTS, hat: cloth([C.e1, C.e2, C.e3]) },
];

function clip(ctx: Ctx, x: number, y: number, w: number, h: number, fn: () => void): void {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); fn(); ctx.restore();
}

/** One 16x24 walk frame. Side views are drawn facing right and mirrored for left. */
function drawPerson(ctx: Ctx, dir: number, frame: number, o: Outfit, seed: number): void {
  const ph = (frame / WALK_FRAMES) * Math.PI * 2;
  const moving = frame !== 0;
  const swing = moving ? Math.sin(ph) : 0;
  const bob = moving && (frame === 2 || frame === 6) ? 1 : 0;
  const side = dir === DIR_LEFT || dir === DIR_RIGHT;
  if (dir === DIR_LEFT) { ctx.translate(16, 0); ctx.scale(-1, 1); }
  const sh = o.shorten ?? 0;
  const by = -bob + sh;
  const liftL = moving ? Math.max(0, swing) * 2 : 0;
  const liftR = moving ? Math.max(0, -swing) * 2 : 0;

  // legs + boots
  if (!side) {
    const lh = 5 - sh - Math.round(liftL), rh = 5 - sh - Math.round(liftR);
    slab(ctx, 5, 17 + (5 - lh), 3, lh, o.pants, seed + 1, 0.15);
    slab(ctx, 8, 17 + (5 - rh), 3, rh, o.pants, seed + 2, 0.15);
    slab(ctx, 4, 22 - Math.round(liftL), 4, 2, o.boots, seed + 3, 0.1);
    slab(ctx, 8, 22 - Math.round(liftR), 4, 2, o.boots, seed + 4, 0.1);
  } else {
    const off = Math.round(swing * 2.5);
    slab(ctx, 6 + off, 17 + sh + Math.round(liftL), 3, 5 - sh - Math.round(liftL), o.pants, seed + 1, 0.15);
    slab(ctx, 7 - off, 17 + sh + Math.round(liftR), 3, 5 - sh - Math.round(liftR), o.pants, seed + 2, 0.15);
    slab(ctx, 6 + off, 22 - Math.round(liftL) * 0, 4, 2, o.boots, seed + 3, 0.1);
    slab(ctx, 7 - off, 22, 4, 2, o.boots, seed + 4, 0.1);
  }

  // torso (+ belt)
  const tx = side ? 5 : 4, tw = side ? 6 : 8;
  slab(ctx, tx, 11 + by, tw, 6, o.shirt, seed + 5, 0.2);
  put(ctx, tx, 16 + by, C.e1, tw, 1);
  put(ctx, tx + Math.floor(tw / 2), 16 + by, C.e6, 1, 1);

  // arms
  if (!side) {
    const aL = Math.round(swing * 1.5), aR = -aL;
    slab(ctx, 2, 11 + by + aL, 2, 5, o.shirt, seed + 6, 0.1);
    slab(ctx, 12, 11 + by + aR, 2, 5, o.shirt, seed + 7, 0.1);
    put(ctx, 2, 16 + by + aL, o.skin[2]!, 2, 1);
    put(ctx, 12, 16 + by + aR, o.skin[2]!, 2, 1);
  } else {
    const ax = Math.round(swing * 2);
    slab(ctx, 6 + ax, 11 + by, 3, 5, o.shirt, seed + 6, 0.1);
    put(ctx, 6 + ax, 16 + by, o.skin[2]!, 3, 1);
  }

  // apron / scarf (NPC extras)
  if (o.apron) {
    if (!side) {
      if (dir === DIR_DOWN) { slab(ctx, 5, 12 + by, 6, 12 - sh - Math.round(0), o.apron, seed + 20, 0.1); put(ctx, 5, 12 + by, lt(o.apron[o.apron.length - 1]!), 6, 1); put(ctx, 4, 11 + by, o.apron[1]!, 1, 3); put(ctx, 11, 11 + by, o.apron[1]!, 1, 3); }
      else { put(ctx, 4, 11 + by, o.apron[1]!, 1, 4); put(ctx, 11, 11 + by, o.apron[1]!, 1, 4); put(ctx, 7, 15 + by, o.apron[2]!, 2, 2); } // strap + bow from behind
    } else slab(ctx, 9, 12 + by, 2, 11 - sh, o.apron, seed + 21, 0.1);
  }
  if (o.scarf) put(ctx, side ? 6 : 5, 10 + by, o.scarf[2]!, side ? 5 : 6, 2);

  // neck + head
  put(ctx, 7, 10 + by, o.skin[1]!, 2, 1);
  blob(ctx, 8, 6 + by, side ? 3.2 : 3.6, 4.2, o.skin, { seed: seed + 8, noise: 0.05, edgeDark: 0.2 });

  // hair
  const style: HairStyle = o.hairStyle ?? (o.longHair ? 'long' : 'short');
  const bald = style === 'bald';
  if (!bald) {
    const big = style === 'curly';
    clip(ctx, 0, 0, 16, 6 + by + 1, () => blob(ctx, 8, 4.4 + by, side ? 3.9 : big ? 4.8 : 4.1, big ? 4.1 : 3.7, o.hair, { seed: seed + 9, noise: big ? 0.6 : 0.3, edgeDark: 0.15 }));
    if (dir === DIR_UP) blob(ctx, 8, 6 + by, big ? 4.6 : 3.9, 4.4, o.hair, { seed: seed + 10, noise: big ? 0.6 : 0.3, edgeDark: 0.15 });
    if (style === 'bun') blob(ctx, side ? 6.4 : 8, 1.6 + by, 2.3, 2, o.hair, { seed: seed + 15, noise: 0.2, edgeDark: 0.2 });
    if (!side) {
      const len = style === 'long' ? 6 : style === 'braids' ? 9 : 3;
      if (dir === DIR_DOWN) { if (style !== 'bun' && style !== 'ponytail') { slab(ctx, 4, 5 + by, 1, len, o.hair, seed + 11, 0.2); slab(ctx, 11, 5 + by, 1, len, o.hair, seed + 12, 0.2); } else { put(ctx, 4, 5 + by, o.hair[1]!, 1, 3); put(ctx, 11, 5 + by, o.hair[1]!, 1, 3); } }
      else if (style === 'long') slab(ctx, 4, 8 + by, 8, 4, o.hair, seed + 13, 0.3);
      else if (style === 'braids') { slab(ctx, 4, 8 + by, 2, 7, o.hair, seed + 13, 0.3); slab(ctx, 10, 8 + by, 2, 7, o.hair, seed + 14, 0.3); }
      else if (style === 'ponytail') { slab(ctx, 7, 9 + by, 2, 6, o.hair, seed + 13, 0.3); put(ctx, 6, 9 + by, o.hair[3]!, 4, 1); }
      if (style === 'braids' && dir === DIR_DOWN) { for (const x of [4, 10]) for (let j = 0; j < 4; j++) put(ctx, x + (j % 2), 9 + by + j * 2, o.hair[(j % 3) + 1]!, 2, 1); }
    } else {
      slab(ctx, 4, 5 + by, 2, style === 'long' || style === 'braids' ? 8 : style === 'ponytail' ? 6 : 4, o.hair, seed + 11, 0.2);
      if (style === 'ponytail') { slab(ctx, 2, 6 + by, 2, 6, o.hair, seed + 12, 0.2); put(ctx, 4, 6 + by, o.hair[3]!, 1, 2); }
    }
  }
  if (o.headband != null) put(ctx, side ? 5 : 4, 4 + by, o.headband, side ? 6 : 8, 1);
  if (o.hat) {
    const hs = o.hatStyle ?? 'cap';
    if (hs === 'brim') {
      blob(ctx, 8, 3.2 + by, 7.2, 2.2, o.hat, { seed: seed + 14, noise: 0.3, edgeDark: 0.12 }); blob(ctx, 8, 1.6 + by, 3.8, 2.6, o.hat, { seed: seed + 16, noise: 0.3, bright: 0.1, edgeDark: 0.1 }); put(ctx, 5, 2 + by, o.hat[0]!, 6, 1);
    } else if (hs === 'beret') {
      blob(ctx, 8, 2.4 + by, 5.4, 2.2, o.hat, { seed: seed + 14, noise: 0.2, edgeDark: 0.12 }); put(ctx, 8, 0 + by, o.hat[0]!);
    } else {
      clip(ctx, 0, 0, 16, 5 + by, () => blob(ctx, 8, 3 + by, 5, 2.4, o.hat!, { seed: seed + 14, noise: 0.2, edgeDark: 0.1 }));
      put(ctx, 3, 4 + by, o.hat[0]!, 10, 1);
    }
  }

  // face
  if (dir === DIR_DOWN) {
    put(ctx, 6, 7 + by, C.ink); put(ctx, 9, 7 + by, C.ink);
    put(ctx, 6, 6 + by, o.skin[4]!); put(ctx, 9, 6 + by, o.skin[4]!);
    put(ctx, 7, 9 + by, o.skin[0]!, 2, 1);
  } else if (side) {
    put(ctx, 10, 7 + by, C.ink); put(ctx, 11, 8 + by, o.skin[3]!); put(ctx, 9, 9 + by, o.skin[0]!, 2, 1);
  }
  // face extras
  if (o.glasses && dir !== DIR_UP) {
    const lens = (x: number) => { put(ctx, x, 6 + by, C.slate, 3, 1); put(ctx, x, 8 + by, C.slate, 3, 1); put(ctx, x, 7 + by, C.slate); put(ctx, x + 2, 7 + by, C.slate); put(ctx, x + 1, 7 + by, C.w7); };
    if (!side) { lens(5); lens(8); put(ctx, 8, 7 + by, C.slate); }
    else { lens(9); put(ctx, 8, 7 + by, C.slate); }
  }
  if (o.beard && dir !== DIR_UP) {
    const bd = o.beard;
    if (!side) { blob(ctx, 8, 9.6 + by, 3.2, 2.3, bd, { seed: seed + 30, noise: 0.35, edgeDark: 0.1 }); put(ctx, 7, 8 + by, o.skin[1]!, 2, 1); }
    else { blob(ctx, 9.6, 9.2 + by, 2.4, 2.4, bd, { seed: seed + 30, noise: 0.35, edgeDark: 0.1 }); }
  }
  if (o.moustache && dir !== DIR_UP) { if (!side) put(ctx, 6, 8 + by, (o.beard ?? o.hair)[2]!, 4, 1); else put(ctx, 10, 8 + by, (o.beard ?? o.hair)[2]!, 2, 1); }
  void dk; void line;
}


const rmp = (a: number[]) => a as Ramp;
/** One distinctive look per village NPC (ids from shared NPCS). */
export const NPC_LOOKS: Record<string, Outfit> = {
  orla: { shirt: rmp([C.q0, C.q1, C.q2, C.q3]), pants: rmp([C.night, C.slate, C.steel]), hair: rmp([C.steel, C.mist, C.fog, C.pale]), skin: SKIN_MID, boots: BOOTS, hairStyle: 'bun', glasses: true, scarf: rmp([C.e4, C.e5, C.e6, C.e7]) },
  tobin: { shirt: rmp([C.e4, C.e5, C.e6, C.e7]), pants: PANTS.brown, hair: HAIR.brown, skin: SKIN_LIGHT, boots: BOOTS, apron: rmp([C.g1, C.g2, C.g3, C.g4]), moustache: true, beard: rmp([C.e0, C.e1, C.e2, C.e3]) },
  brannoch: { shirt: rmp([C.r0, C.r1, C.r2, C.r3]), pants: PANTS.slate, hair: HAIR.black, skin: SKIN_DARK, boots: BOOTS, hairStyle: 'bald', beard: rmp([C.e0, C.e1, C.e2, C.e3]), apron: rmp([C.night, C.slate, C.steel, C.mist]), headband: C.r3 },
  maribel: { shirt: rmp([C.r2, C.r3, C.r4, C.r5]), pants: PANTS.brown, hair: HAIR.brown, skin: SKIN_LIGHT, boots: BOOTS, hairStyle: 'bun', apron: rmp([C.fog, C.pale, C.white, C.white]) },
  fenwick: { shirt: rmp([C.r3, C.r4, C.r5, C.r6]), pants: PANTS.navy, hair: HAIR.blond, skin: SKIN_LIGHT, boots: BOOTS, hat: rmp([C.e4, C.e5, C.e6, C.e7]), hatStyle: 'brim', beard: rmp([C.e3, C.e4, C.e5, C.e6]) },
  sedge: { shirt: rmp([C.e5, C.e6, C.e7, C.pale]), pants: PANTS.olive, hair: HAIR.white, skin: SKIN_MID, boots: BOOTS, hat: rmp([C.w1, C.w2, C.w3]), hatStyle: 'cap', beard: rmp([C.mist, C.fog, C.pale, C.white]) },
  wren: { shirt: rmp([C.g1, C.g2, C.g3, C.g4]), pants: PANTS.slate, hair: HAIR.violet, skin: SKIN_MID, boots: BOOTS, hairStyle: 'braids', hat: rmp([C.q0, C.q1, C.q2]), hatStyle: 'beret', scarf: rmp([C.q3, C.q4, C.q5, C.q6]) },
  pippa: { shirt: rmp([C.q3, C.q4, C.q5, C.q6]), pants: PANTS.navy, hair: rmp([C.r3, C.r4, C.r5, C.r6]), skin: SKIN_DARK, boots: BOOTS, hairStyle: 'ponytail', scarf: rmp([C.w4, C.w5, C.w6, C.w7]) },
  odo: { shirt: rmp([C.w2, C.w3, C.w4, C.w5]), pants: PANTS.brown, hair: HAIR.red, skin: SKIN_LIGHT, boots: BOOTS, hairStyle: 'bald', beard: rmp([C.r2, C.r3, C.r4, C.r5]), moustache: true, apron: rmp([C.e1, C.e2, C.e3, C.e4]) },
  juniper: { shirt: rmp([C.g3, C.g4, C.g5, C.g6]), pants: PANTS.brown, hair: rmp([C.e4, C.e5, C.e6, C.e7]), skin: SKIN_MID, boots: BOOTS, hairStyle: 'ponytail', shorten: 3, hat: rmp([C.r2, C.r3, C.r4]), hatStyle: 'beret' },
};

// ───────── fauna ─────────
const FUR: Ramp = [C.e1, C.e2, C.e3, C.e4, C.e5, C.e6];
const FUR_DEER: Ramp = [C.e0, C.e1, C.e2, C.e3, C.e4, C.e5];

/** 16x16 hopping rabbit facing right. frames: 0 crouch, 1 launch, 2 peak, 3 land. */
function drawRabbit(ctx: Ctx, frame: number): void {
  const air = [0, 2, 3, 1][frame]!;
  const stretch = [0, 1, 1, 0][frame]!;
  put(ctx, 3, 15, C.night, 10, 1);
  // rear leg + haunch
  blob(ctx, 5 - stretch * 1.5, 12.2 - air, 3.4, 3, FUR, { seed: 4, noise: 0.25, edgeDark: 0.25 });
  put(ctx, 3 - stretch * 2, 14 - air, FUR[1]!, 4, 1);
  // body
  blob(ctx, 8.4, 10.6 - air, 4.8, 3.2, FUR, { seed: 5, noise: 0.25, edgeDark: 0.25 });
  blob(ctx, 8.6, 11.8 - air, 3.4, 1.6, [C.pale, C.white, C.white], { seed: 6, noise: 0.1, edgeDark: 0 });
  // tail
  ball2(ctx, 2.4, 10.4 - air, 1.8, [C.fog, C.pale, C.white, C.white]);
  // head and ears
  blob(ctx, 12.2, 8.2 - air, 2.8, 2.5, FUR, { seed: 7, noise: 0.15, edgeDark: 0.2 });
  blob(ctx, 10.8, 3.8 - air, 1.1, 3.4, FUR, { seed: 8, noise: 0.1 }); blob(ctx, 13.2, 3.4 - air, 1.1, 3.4, FUR, { seed: 9, noise: 0.1 });
  put(ctx, 10, 3 - air, C.r5, 1, 3); put(ctx, 13, 2 - air, C.r5, 1, 3);
  put(ctx, 13, 7 - air, C.ink); put(ctx, 15, 9 - air, C.r5); put(ctx, 14, 9 - air, C.pale);
  // front leg
  put(ctx, 11 + stretch, 13 - air, FUR[3]!, 2, 2 + air); put(ctx, 11 + stretch, 14, FUR[1]!, 3, 1);
}
function ball2(ctx: Ctx, x: number, y: number, r: number, ramp: Ramp): void { blob(ctx, x, y, r, r, ramp, { seed: 3, noise: 0.1, edgeDark: 0.2 }); }

/** 24x26 walking deer (stag with antlers) facing right. 4-frame walk cycle. */
function drawDeer(ctx: Ctx, frame: number): void {
  ctx.translate(0, 4);
  const sw = [2, 0, -2, 0][frame]!;
  const bob = frame % 2 === 0 ? 0 : 1;
  put(ctx, 4, 21, C.night, 15, 1);
  // far legs (darker) then near legs
  for (const [lx, d, c] of [[7, -sw, FUR_DEER[1]!], [15, sw, FUR_DEER[1]!], [6, sw, FUR_DEER[2]!], [16, -sw, FUR_DEER[2]!]] as const) {
    slab(ctx, lx + Math.round(d * 0.6), 13 - bob, 2, 8 + bob, [c, lt(c)], lx, 0.1); put(ctx, lx + Math.round(d * 0.6), 20, C.night, 2, 1);
  }
  // body
  blob(ctx, 11, 11.6 - bob, 7.2, 3.8, FUR_DEER, { seed: 12, noise: 0.25, edgeDark: 0.28 });
  blob(ctx, 10, 13.4 - bob, 5, 1.6, [C.e5, C.e6, C.e7], { seed: 13, noise: 0.1, edgeDark: 0 });
  for (let i = 0; i < 4; i++) put(ctx, 7 + i * 2, 9 - bob + (i % 2), C.e7);                // dapples
  blob(ctx, 4.4, 10.6 - bob, 1.8, 2, [C.pale, C.white, C.white], { seed: 14, noise: 0 });    // tail patch
  // neck + head
  poly2(ctx, [[14, 9 - bob], [16, 3 - bob], [20, 3 - bob], [20, 10 - bob]], FUR_DEER);
  blob(ctx, 20.6, 3.6 - bob, 3.2, 2.6, FUR_DEER, { seed: 15, noise: 0.15, edgeDark: 0.2 });
  put(ctx, 22, 4 - bob, C.ink); put(ctx, 23, 5 - bob, C.ink); put(ctx, 19, 2 - bob, FUR_DEER[1]!, 2, 2);
  // antlers
  line(ctx, 19, 1 - bob, 18, -0 - bob, C.e6); for (const [x0, y0, x1, y1] of [[19, 1, 17, -1], [20, 1, 21, -1], [18, 0, 16, 0], [21, 0, 22, -2]] as const) line(ctx, x0, y0 - bob, x1, Math.max(0, y1) - bob, C.e6);
}
function poly2(ctx: Ctx, pts: Array<[number, number]>, ramp: Ramp): void {
  let x0 = 99, x1 = -99, y0 = 99, y1 = -99;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i]!, [xj, yj] = pts[j]!;
      if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) put(ctx, x, y, ramp[Math.min(ramp.length - 1, 1 + ((x + y) & 1))]!);
  }
}

function drawSlime(ctx: Ctx, frame: number, night: boolean): void {
  const ramp = night ? R.gelDark : R.gel;
  const squash = [0, 1.2, 2.2, 1.2][frame % 4]!;
  const ry = 6.2 - squash * 0.8, rx = 6.2 + squash * 0.7;
  put(ctx, 3, 15, C.night, 10, 1);
  blob(ctx, 8, 15 - ry, rx, ry, ramp, { seed: night ? 7 : 3, noise: 0.12, bright: 0.12, edgeDark: 0.4, shape: 2.2 });
  blob(ctx, 8, 14 - ry * 0.6, rx * 0.55, ry * 0.45, ramp, { seed: 4, noise: 0.05, bright: 0.28, edgeDark: 0.1 });  // inner glow
  put(ctx, 5, 15 - ry * 1.5, C.white, 2, 1); put(ctx, 5, 15 - ry * 1.5 + 1, C.white, 1, 1);                         // specular
  const ey = Math.round(15 - ry * 1.05);
  put(ctx, 5, ey, C.ink, 2, 2); put(ctx, 9, ey, C.ink, 2, 2);
  put(ctx, 5, ey, night ? C.q7 : C.white); put(ctx, 9, ey, night ? C.q7 : C.white);
}

function drawHopper(ctx: Ctx, frame: number, night: boolean): void {
  const ramp = night ? R.furDark : R.fur;
  const air = frame === 2 ? 3 : 0, squat = frame === 1 ? 2 : 0;
  put(ctx, 4, 15, C.night, 8, 1);
  blob(ctx, 8, 11 + squat * 0.6 - air, 5, 4 - squat * 0.3, ramp, { seed: night ? 5 : 2, noise: 0.25, edgeDark: 0.3 });
  blob(ctx, 8, 8 + squat * 0.6 - air, 3.6, 3.2, ramp, { seed: 6, noise: 0.2, bright: 0.08 });
  blob(ctx, 5.4, 3.4 + squat - air, 1.2, 3.2, ramp, { seed: 8, noise: 0.1 });
  blob(ctx, 10.6, 3.4 + squat - air, 1.2, 3.2, ramp, { seed: 9, noise: 0.1 });
  put(ctx, 5, 3 + squat - air, night ? C.r6 : C.e7); put(ctx, 10, 3 + squat - air, night ? C.r6 : C.e7);
  put(ctx, 6, 8 + squat - air, C.ink); put(ctx, 9, 8 + squat - air, C.ink);
  put(ctx, 7, 10 + squat - air, night ? C.r6 : C.e7, 2, 1);
  blob(ctx, 4.5, 14 - air, 2, 1.4, ramp, { seed: 11, noise: 0.1 }); blob(ctx, 11.5, 14 - air, 2, 1.4, ramp, { seed: 12, noise: 0.1 });
}

function drawOrb(ctx: Ctx, frame: number): void {
  blob(ctx, 8, 8, frame ? 4.4 : 3.6, frame ? 4.4 : 3.6, R.crystal, { seed: 1, noise: 0, bright: 0.35, edgeDark: 0.05 });
  put(ctx, 7, 7, C.white, 2, 2);
}

export interface Sheets {
  person(outfit: number, dir: number, frame: number): Texture;
  /** unique sprite per village NPC (distinct hair/hat/apron); 8 walk frames x 4 dirs like `person` */
  npc(npcId: string, dir: number, frame: number): Texture;
  /** passive fauna: 4 walk frames; dir only matters for left/right flip (DIR_* constants) */
  rabbit(frame: number, dir: number): Texture;
  deer(frame: number, dir: number): Texture;
  slime(night: boolean, frame: number): Texture;
  hopper(night: boolean, frame: number): Texture;
  orb(frame: number): Texture;
}

export function buildActorSheets(): Sheets {
  const nOut = OUTFITS.length;
  const personRows = nOut * 4;
  const w = 16 * WALK_FRAMES;
  const h = personRows * PERSON_H + 16 * 4 + 16;
  const { canvas, ctx } = makeCanvas(w, h);
  for (let o = 0; o < nOut; o++) for (let d = 0; d < 4; d++) for (let f = 0; f < WALK_FRAMES; f++) {
    ctx.save();
    ctx.translate(f * 16, (o * 4 + d) * PERSON_H);
    ctx.beginPath(); ctx.rect(0, 0, 16, PERSON_H); ctx.clip();
    drawPerson(ctx, d, f, OUTFITS[o]!, o * 101 + d * 13);
    ctx.restore();
  }
  const baseY = personRows * PERSON_H;
  for (const [night, rowS, rowH] of [[false, 0, 2], [true, 1, 3]] as const) {
    for (let f = 0; f < 4; f++) {
      ctx.save(); ctx.translate(f * 16, baseY + rowS * 16); ctx.beginPath(); ctx.rect(0, 0, 16, 16); ctx.clip(); drawSlime(ctx, f, night); ctx.restore();
      ctx.save(); ctx.translate(f * 16, baseY + rowH * 16); ctx.beginPath(); ctx.rect(0, 0, 16, 16); ctx.clip(); drawHopper(ctx, f, night); ctx.restore();
    }
  }
  for (let f = 0; f < 2; f++) {
    ctx.save(); ctx.translate(f * 16, baseY + 64); ctx.beginPath(); ctx.rect(0, 0, 16, 16); ctx.clip(); drawOrb(ctx, f); ctx.restore();
  }
  const base = Texture.from(canvas);
  base.source.scaleMode = 'nearest';

  // NPC atlas: one row per (npc, dir); fauna atlas: rabbit 16x16 and deer 24x22, right- and left-facing
  const npcIds = NPCS.map((n) => n.id);
  const nc = makeCanvas(16 * WALK_FRAMES, npcIds.length * 4 * PERSON_H);
  npcIds.forEach((id, i) => {
    const look = NPC_LOOKS[id] ?? OUTFITS[i % OUTFITS.length]!;
    for (let d = 0; d < 4; d++) for (let f = 0; f < WALK_FRAMES; f++) {
      nc.ctx.save(); nc.ctx.translate(f * 16, (i * 4 + d) * PERSON_H); nc.ctx.beginPath(); nc.ctx.rect(0, 0, 16, PERSON_H); nc.ctx.clip();
      drawPerson(nc.ctx, d, f, look, 700 + i * 37 + d * 13); nc.ctx.restore();
    }
  });
  const npcBase = Texture.from(nc.canvas); npcBase.source.scaleMode = 'nearest';
  const fc = makeCanvas(24 * 4, 16 * 2 + 26 * 2);
  for (let f = 0; f < 4; f++) {
    for (const [mirror, row] of [[false, 0], [true, 1]] as const) {
      fc.ctx.save(); fc.ctx.translate(f * 24 + (mirror ? 16 : 0), row * 16); if (mirror) fc.ctx.scale(-1, 1);
      fc.ctx.beginPath(); fc.ctx.rect(0, 0, 16, 16); fc.ctx.clip(); drawRabbit(fc.ctx, f); fc.ctx.restore();
      fc.ctx.save(); fc.ctx.translate(f * 24 + (mirror ? 24 : 0), 32 + row * 26); if (mirror) fc.ctx.scale(-1, 1);
      fc.ctx.beginPath(); fc.ctx.rect(0, 0, 24, 26); fc.ctx.clip(); drawDeer(fc.ctx, f); fc.ctx.restore();
    }
  }
  const faunaBase = Texture.from(fc.canvas); faunaBase.source.scaleMode = 'nearest';
  const cache = new Map<string, Texture>();
  const subOf = (src: Texture, key: string, x: number, y: number, w: number, hh: number) => {
    let t = cache.get(key);
    if (!t) { t = new Texture({ source: src.source, frame: new Rectangle(x, y, w, hh) }); cache.set(key, t); }
    return t;
  };
  const sub = (key: string, x: number, y: number, hh: number) => {
    let t = cache.get(key);
    if (!t) { t = new Texture({ source: base.source, frame: new Rectangle(x, y, 16, hh) }); cache.set(key, t); }
    return t;
  };
  return {
    person: (o, d, f) => sub(`p${o}.${d}.${f}`, f * 16, (o * 4 + d) * PERSON_H, PERSON_H),
    npc: (id, d, f) => { const i = Math.max(0, npcIds.indexOf(id)); return subOf(npcBase, `n${i}.${d}.${f}`, f * 16, (i * 4 + d) * PERSON_H, 16, PERSON_H); },
    rabbit: (f, d) => subOf(faunaBase, `r${d === DIR_LEFT ? 1 : 0}.${f % 4}`, (f % 4) * 24, d === DIR_LEFT ? 16 : 0, 16, 16),
    deer: (f, d) => subOf(faunaBase, `d${d === DIR_LEFT ? 1 : 0}.${f % 4}`, (f % 4) * 24, 32 + (d === DIR_LEFT ? 26 : 0), 24, 26),
    slime: (n, f) => sub(`s${n}.${f}`, (f % 4) * 16, baseY + (n ? 16 : 0), 16),
    hopper: (n, f) => sub(`h${n}.${f}`, (f % 4) * 16, baseY + (n ? 48 : 32), 16),
    orb: (f) => sub(`o${f}`, (f % 2) * 16, baseY + 64, 16),
  };
}
