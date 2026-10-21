import { Rectangle, Texture } from 'pixi.js';
import { C, makeCanvas, px, type Ctx } from './draw';

export const DIR_DOWN = 0, DIR_UP = 1, DIR_LEFT = 2, DIR_RIGHT = 3;
export const WALK_FRAMES = 8;

export function dirOf(fx: number, fy: number): number {
  if (Math.abs(fx) > Math.abs(fy)) return fx < 0 ? DIR_LEFT : DIR_RIGHT;
  return fy < 0 ? DIR_UP : DIR_DOWN;
}

export interface Outfit { shirt: number; shirtDark: number; hair: number; skin: number }

export const OUTFITS: Outfit[] = [
  { shirt: C.w4, shirtDark: C.w2, hair: C.e2, skin: C.e6 },
  { shirt: C.r4, shirtDark: C.r2, hair: C.e0, skin: C.e5 },
  { shirt: C.q3, shirtDark: C.q1, hair: C.e6, skin: C.e6 },
  { shirt: C.g5, shirtDark: C.g2, hair: C.e1, skin: C.e4 },
  { shirt: C.e5, shirtDark: C.e3, hair: C.q6, skin: C.e6 },
  { shirt: C.q7, shirtDark: C.w2, hair: C.slate, skin: C.e5 },
];

function drawPerson(ctx: Ctx, dir: number, frame: number, o: Outfit): void {
  const ph = (frame / WALK_FRAMES) * Math.PI * 2;
  const stepL = frame === 0 ? 0 : Math.sin(ph);
  const stepR = frame === 0 ? 0 : -Math.sin(ph);
  const bob = frame !== 0 && (frame === 2 || frame === 6) ? 1 : 0;
  const by = -bob;

  const legs = (lx: number, rx: number, side = false) => {
    const liftL = Math.max(0, stepL) * 2, liftR = Math.max(0, stepR) * 2;
    const hL = 3 - Math.round(liftL), hR = 3 - Math.round(liftR);
    if (side) {
      const off = Math.round(stepL * 2);
      px(ctx, 6 + off, 13, C.night, 2, 3 - Math.round(liftL)); px(ctx, 8 - off, 13, C.slate, 2, 3 - Math.round(liftR));
    } else {
      px(ctx, lx, 13 + (3 - hL), C.night, 2, hL); px(ctx, rx, 13 + (3 - hR), C.night, 2, hR);
    }
  };

  if (dir === DIR_DOWN || dir === DIR_UP) {
    legs(5, 9);
    // torso
    px(ctx, 5, 8 + by, o.shirt, 6, 5); px(ctx, 5, 11 + by, o.shirtDark, 6, 1); px(ctx, 5, 12 + by, C.e2, 6, 1);
    // arms
    const aL = Math.round(stepL * 1), aR = Math.round(stepR * 1);
    px(ctx, 4, 8 + by + aL, o.shirtDark, 1, 4); px(ctx, 11, 8 + by + aR, o.shirtDark, 1, 4);
    px(ctx, 4, 12 + by + aL, o.skin); px(ctx, 11, 12 + by + aR, o.skin);
    // head
    px(ctx, 5, 2 + by, o.skin, 6, 6);
    if (dir === DIR_DOWN) {
      px(ctx, 5, 2 + by, o.hair, 6, 2); px(ctx, 4, 3 + by, o.hair, 1, 3); px(ctx, 11, 3 + by, o.hair, 1, 3);
      px(ctx, 6, 5 + by, C.ink); px(ctx, 9, 5 + by, C.ink);
      px(ctx, 7, 7 + by, C.e4, 2, 1);
    } else {
      px(ctx, 5, 2 + by, o.hair, 6, 5); px(ctx, 4, 3 + by, o.hair, 1, 4); px(ctx, 11, 3 + by, o.hair, 1, 4);
    }
  } else {
    const flip = dir === DIR_LEFT ? -1 : 1;
    const X = (x: number) => (flip === 1 ? x : 15 - x);
    const pxf = (x: number, y: number, c: number, w = 1, h = 1) => px(ctx, flip === 1 ? x : 16 - x - w, y, c, w, h);
    void X;
    legs(0, 0, true);
    pxf(5, 8 + by, o.shirt, 6, 5); pxf(5, 11 + by, o.shirtDark, 6, 1); pxf(5, 12 + by, C.e2, 6, 1);
    const sw = Math.round(stepL * 2);
    pxf(7 + sw, 8 + by, o.shirtDark, 2, 4); pxf(7 + sw, 12 + by, o.skin, 2, 1);
    pxf(5, 2 + by, o.skin, 6, 6);
    pxf(4, 2 + by, o.hair, 5, 3); pxf(4, 3 + by, o.hair, 2, 4);
    pxf(9, 5 + by, C.ink); pxf(11, 6 + by, C.e4);
  }
}

function drawSlime(ctx: Ctx, frame: number, night: boolean): void {
  const body = night ? C.q3 : C.w4, dark = night ? C.q1 : C.w2, light = night ? C.q5 : C.w6, eye = night ? C.q7 : C.ink;
  const squash = [0, 1, 2, 1][frame % 4]!;
  const h = 9 - squash, w = 12 + squash;
  const x0 = 8 - Math.floor(w / 2), y0 = 15 - h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x - (w - 1) / 2) / (w / 2), dy = (y - (h - 1)) / h;
    if (dx * dx + dy * dy * 1.1 < 1) px(ctx, x0 + x, y0 + y, y > h - 3 ? dark : x < 3 && y < 3 ? light : body);
  }
  px(ctx, x0 + 3, y0 + 3, eye, 2, 2); px(ctx, x0 + w - 5, y0 + 3, eye, 2, 2);
  px(ctx, x0 + 3, y0 + 3, C.white, 1, 1);
  px(ctx, x0 + 2, y0 + 1, light, 2, 1);
}

function drawHopper(ctx: Ctx, frame: number, night: boolean): void {
  const body = night ? C.r3 : C.e5, dark = night ? C.r1 : C.e3, light = night ? C.r5 : C.e7;
  const air = frame === 2 ? 3 : 0;
  const squat = frame === 1 ? 2 : 0;
  px(ctx, 4, 8 + squat - air, body, 8, 5 - squat); px(ctx, 5, 7 + squat - air, body, 6, 1); px(ctx, 4, 12 - air, dark, 8, 1);
  px(ctx, 5, 8 + squat - air, light, 2, 1);
  px(ctx, 5, 9 + squat - air, C.ink); px(ctx, 10, 9 + squat - air, C.ink);
  px(ctx, 5, 5 + squat - air, body, 1, 2); px(ctx, 10, 5 + squat - air, body, 1, 2); // ears
  px(ctx, 5, 4 + squat - air, light); px(ctx, 10, 4 + squat - air, light);
  px(ctx, 3, 13 - air, dark, 3, 2 + squat); px(ctx, 10, 13 - air, dark, 3, 2 + squat); // legs
}

function drawOrb(ctx: Ctx, frame: number): void {
  const r = frame ? 3 : 4;
  for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
    const d = x * x + y * y;
    if (d <= r * r) px(ctx, 8 + x, 8 + y, d <= 4 ? C.white : d <= 9 ? C.q6 : C.q3);
  }
}

export interface Sheets {
  person(outfit: number, dir: number, frame: number): Texture;
  slime(night: boolean, frame: number): Texture;
  hopper(night: boolean, frame: number): Texture;
  orb(frame: number): Texture;
}

export function buildActorSheets(): Sheets {
  const nOut = OUTFITS.length;
  const personH = nOut * 4 * 16;
  const total = { w: 16 * WALK_FRAMES, h: personH + 16 * 4 + 16 * 4 + 16 };
  const { canvas, ctx } = makeCanvas(total.w, total.h);
  for (let o = 0; o < nOut; o++) for (let d = 0; d < 4; d++) for (let f = 0; f < WALK_FRAMES; f++) {
    ctx.save();
    ctx.translate(f * 16, (o * 4 + d) * 16);
    ctx.beginPath(); ctx.rect(0, 0, 16, 16); ctx.clip();
    drawPerson(ctx, d, f, OUTFITS[o]!);
    ctx.restore();
  }
  const base = Texture.from(canvas);
  base.source.scaleMode = 'nearest';
  for (const [night, rowS, rowH] of [[false, 0, 0], [true, 1, 1]] as const) {
    for (let f = 0; f < 4; f++) {
      ctx.save(); ctx.translate(f * 16, personH + rowS * 16); ctx.beginPath(); ctx.rect(0, 0, 16, 16); ctx.clip();
      drawSlime(ctx, f, night); ctx.restore();
      ctx.save(); ctx.translate(f * 16, personH + 32 + rowH * 16); ctx.beginPath(); ctx.rect(0, 0, 16, 16); ctx.clip();
      drawHopper(ctx, f, night); ctx.restore();
    }
  }
  for (let f = 0; f < 2; f++) {
    ctx.save(); ctx.translate(f * 16, personH + 64); ctx.beginPath(); ctx.rect(0, 0, 16, 16); ctx.clip();
    drawOrb(ctx, f); ctx.restore();
  }
  // canvas was drawn after the texture was created: re-upload
  base.source.update();

  const cache = new Map<string, Texture>();
  const sub = (key: string, x: number, y: number) => {
    let t = cache.get(key);
    if (!t) { t = new Texture({ source: base.source, frame: new Rectangle(x, y, 16, 16) }); cache.set(key, t); }
    return t;
  };
  return {
    person: (o, d, f) => sub(`p${o}.${d}.${f}`, f * 16, (o * 4 + d) * 16),
    slime: (n, f) => sub(`s${n}.${f}`, (f % 4) * 16, personH + (n ? 16 : 0)),
    hopper: (n, f) => sub(`h${n}.${f}`, (f % 4) * 16, personH + 32 + (n ? 16 : 0)),
    orb: (f) => sub(`o${f}`, (f % 2) * 16, personH + 64),
  };
}
