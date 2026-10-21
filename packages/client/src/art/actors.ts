import { Rectangle, Texture } from 'pixi.js';
import { blob, C, makeCanvas, put, R, slab, type Ctx, type Ramp } from './shade';

export const DIR_DOWN = 0, DIR_UP = 1, DIR_LEFT = 2, DIR_RIGHT = 3;
export const WALK_FRAMES = 8;
export const PERSON_H = 24;

export function dirOf(fx: number, fy: number): number {
  if (Math.abs(fx) > Math.abs(fy)) return fx < 0 ? DIR_LEFT : DIR_RIGHT;
  return fy < 0 ? DIR_UP : DIR_DOWN;
}

export interface Outfit { shirt: Ramp; pants: Ramp; hair: Ramp; skin: Ramp; boots: Ramp; longHair?: boolean; hat?: Ramp }

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
  const by = -bob;
  const liftL = moving ? Math.max(0, swing) * 2 : 0;
  const liftR = moving ? Math.max(0, -swing) * 2 : 0;

  // legs + boots
  if (!side) {
    const lh = 5 - Math.round(liftL), rh = 5 - Math.round(liftR);
    slab(ctx, 5, 17 + (5 - lh), 3, lh, o.pants, seed + 1, 0.15);
    slab(ctx, 8, 17 + (5 - rh), 3, rh, o.pants, seed + 2, 0.15);
    slab(ctx, 4, 22 - Math.round(liftL), 4, 2, o.boots, seed + 3, 0.1);
    slab(ctx, 8, 22 - Math.round(liftR), 4, 2, o.boots, seed + 4, 0.1);
  } else {
    const off = Math.round(swing * 2.5);
    slab(ctx, 6 + off, 17 + Math.round(liftL), 3, 5 - Math.round(liftL), o.pants, seed + 1, 0.15);
    slab(ctx, 7 - off, 17 + Math.round(liftR), 3, 5 - Math.round(liftR), o.pants, seed + 2, 0.15);
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

  // neck + head
  put(ctx, 7, 10 + by, o.skin[1]!, 2, 1);
  blob(ctx, 8, 6 + by, side ? 3.2 : 3.6, 4.2, o.skin, { seed: seed + 8, noise: 0.05, edgeDark: 0.2 });

  // hair
  clip(ctx, 0, 0, 16, 6 + by + 1, () => blob(ctx, 8, 4.4 + by, side ? 3.9 : 4.1, 3.7, o.hair, { seed: seed + 9, noise: 0.3, edgeDark: 0.15 }));
  if (dir === DIR_UP) blob(ctx, 8, 6 + by, 3.9, 4.4, o.hair, { seed: seed + 10, noise: 0.3, edgeDark: 0.15 });
  if (!side) {
    if (dir === DIR_DOWN) { slab(ctx, 4, 5 + by, 1, o.longHair ? 6 : 3, o.hair, seed + 11, 0.2); slab(ctx, 11, 5 + by, 1, o.longHair ? 6 : 3, o.hair, seed + 12, 0.2); }
    else if (o.longHair) slab(ctx, 4, 8 + by, 8, 4, o.hair, seed + 13, 0.3);
  } else {
    slab(ctx, 4, 5 + by, 2, o.longHair ? 7 : 4, o.hair, seed + 11, 0.2);
  }
  if (o.hat) {
    clip(ctx, 0, 0, 16, 5 + by, () => blob(ctx, 8, 3 + by, 5, 2.4, o.hat!, { seed: seed + 14, noise: 0.2, edgeDark: 0.1 }));
    put(ctx, 3, 4 + by, o.hat[0]!, 10, 1);
  }

  // face
  if (dir === DIR_DOWN) {
    put(ctx, 6, 7 + by, C.ink); put(ctx, 9, 7 + by, C.ink);
    put(ctx, 6, 6 + by, o.skin[4]!); put(ctx, 9, 6 + by, o.skin[4]!);
    put(ctx, 7, 9 + by, o.skin[0]!, 2, 1);
  } else if (side) {
    put(ctx, 10, 7 + by, C.ink); put(ctx, 11, 8 + by, o.skin[3]!); put(ctx, 9, 9 + by, o.skin[0]!, 2, 1);
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
  const cache = new Map<string, Texture>();
  const sub = (key: string, x: number, y: number, hh: number) => {
    let t = cache.get(key);
    if (!t) { t = new Texture({ source: base.source, frame: new Rectangle(x, y, 16, hh) }); cache.set(key, t); }
    return t;
  };
  return {
    person: (o, d, f) => sub(`p${o}.${d}.${f}`, f * 16, (o * 4 + d) * PERSON_H, PERSON_H),
    // ART WORKER: replace these stubs with real NPC / fauna art
    npc: (_id, d, f) => sub(`p0.${d}.${f}`, f * 16, (0 * 4 + d) * PERSON_H, PERSON_H),
    rabbit: (f) => sub(`h0.${f}`, (f % 4) * 16, baseY + 32, 16),
    deer: (f) => sub(`h1.${f}`, (f % 4) * 16, baseY + 48, 16),
    slime: (n, f) => sub(`s${n}.${f}`, (f % 4) * 16, baseY + (n ? 16 : 0), 16),
    hopper: (n, f) => sub(`h${n}.${f}`, (f % 4) * 16, baseY + (n ? 48 : 32), 16),
    orb: (f) => sub(`o${f}`, (f % 2) * 16, baseY + 64, 16),
  };
}
