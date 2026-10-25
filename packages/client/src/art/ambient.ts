import { Texture } from 'pixi.js';
import { blob, C, limb, makeCanvas, outline, polish, put, type Ctx, type Ramp } from './shade';

/** Tiny procedural creatures for the living-world layer: village animals, insects and birds. All face right (flip to face left). */
export interface AmbientArt {
  chicken: Texture[]; // 0 stand, 1 peck, 2 walk A, 3 walk B
  cat: Texture[]; // 0 sit, 1 walk A, 2 walk B, 3 sleep
  dog: Texture[]; // 0 stand, 1 walk A, 2 walk B, 3 sit
  pigeon: Texture[]; // 0 stand, 1 walk, 2 fly up, 3 fly down
  butterfly: Texture[]; // 0 open, 1 closed (white; tint per instance)
  bird: Texture[]; // flying silhouette: 0 up, 1 mid, 2 down
  fish: Texture[]; // jumping fish: 0 up, 1 level, 2 down
  glow: Texture; // soft round glow (fireflies)
}

const mk = (w: number, h: number, draw: (c: Ctx) => void, o: { rim?: boolean; outline?: boolean } = {}): Texture => {
  const { canvas, ctx } = makeCanvas(w, h);
  draw(ctx);
  if (o.outline !== false) outline(ctx, w, h, C.night);
  polish(ctx, w, h, { rim: o.rim ?? true, ao: null });
  const t = Texture.from(canvas);
  t.source.scaleMode = 'nearest';
  return t;
};

const FEATHER: Ramp = [C.pale, C.fog, C.white, C.white];
const COMB = C.r4;
const BEAK = C.e6;

function chicken(f: number, c: Ctx): void {
  const peck = f === 1,
    step = f === 2 ? 1 : f === 3 ? -1 : 0;
  blob(c, 6, 7, 4.2, 3.2, FEATHER, { seed: 3, noise: 0.1, edgeDark: 0.25 }); // body
  put(c, 1, 5, C.pale, 2, 2); // tail feathers (left)
  const hx = peck ? 10 : 9,
    hy = peck ? 6 : 3;
  blob(c, hx, hy, 1.8, 1.8, FEATHER, { seed: 5, noise: 0, edgeDark: 0.2 });
  put(c, hx, hy - 2, COMB, 1, 2);
  put(c, hx + 1, hy - 1, COMB, 1, 1); // comb
  put(c, hx + 2, hy, BEAK, 1, 1);
  put(c, hx + 1, hy + 1, C.r3, 1, 1); // beak + wattle
  put(c, hx, hy, C.ink); // eye
  if (!peck) put(c, 8, 5, C.e5, 2, 1); // neck blend
  put(c, 5 + step, 10, C.e5, 1, 2);
  put(c, 7 - step, 10, C.e5, 1, 2); // legs
}

function cat(f: number, c: Ctx): void {
  const FUR: Ramp = [C.e1, C.e2, C.e3, C.e4];
  if (f === 3) {
    blob(c, 7, 8, 5.5, 2.8, FUR, { seed: 6, noise: 0.2, edgeDark: 0.3 });
    blob(c, 11, 8, 2, 1.8, FUR, { seed: 7, noise: 0 });
    put(c, 12, 7, FUR[0], 1, 1);
    return;
  }
  if (f === 0) {
    blob(c, 6, 8, 3.4, 3.6, FUR, { seed: 8, noise: 0.2, edgeDark: 0.3 }); // sitting body
    blob(c, 7, 4, 2.4, 2.2, FUR, { seed: 9, noise: 0.1 }); // head
    put(c, 6, 1, FUR[1], 1, 2);
    put(c, 9, 1, FUR[1], 1, 2); // ears
    put(c, 8, 4, C.g5);
    put(c, 6, 4, C.g5); // eyes
    put(c, 2, 10, FUR[2], 4, 1);
    put(c, 1, 9, FUR[2], 1, 1); // curled tail
    return;
  }
  const s = f === 1 ? 1 : -1;
  blob(c, 8, 6, 4.6, 2.2, FUR, { seed: 10, noise: 0.2, edgeDark: 0.3 });
  blob(c, 13, 5, 2, 1.8, FUR, { seed: 11, noise: 0 });
  put(c, 12, 2, FUR[1], 1, 2);
  put(c, 14, 2, FUR[1], 1, 2);
  put(c, 14, 5, C.g5);
  limb(c, 3, 5, 0, 2, 1, 0.8, FUR, 5); // tail up
  put(c, 5 + s, 8, FUR[1], 1, 3);
  put(c, 7 - s, 8, FUR[1], 1, 3);
  put(c, 10 + s, 8, FUR[1], 1, 3);
  put(c, 12 - s, 8, FUR[1], 1, 3);
}

function dog(f: number, c: Ctx): void {
  const FUR: Ramp = [C.e0, C.e1, C.e2, C.e3, C.e4];
  const s = f === 1 ? 1 : f === 2 ? -1 : 0;
  if (f === 3) {
    blob(c, 7, 9, 3.6, 4, FUR, { seed: 12, noise: 0.2, edgeDark: 0.3 });
    blob(c, 9, 4, 2.6, 2.4, FUR, { seed: 13, noise: 0.1 });
    put(c, 7, 2, FUR[0], 2, 3);
    put(c, 11, 4, C.ink, 1, 1);
    put(c, 12, 5, C.ink, 1, 1);
    put(c, 3, 12, FUR[2], 4, 1);
    return;
  }
  blob(c, 9, 7, 5.4, 3, FUR, { seed: 14, noise: 0.2, edgeDark: 0.3 });
  blob(c, 15, 5, 2.6, 2.3, FUR, { seed: 15, noise: 0.1 });
  put(c, 14, 2, FUR[0], 2, 3);
  put(c, 17, 5, C.ink, 1, 1);
  put(c, 18, 6, C.ink, 1, 1); // ear, eye, nose
  limb(c, 4, 6, 2, 3 + s, 1.3, 0.8, FUR, 6); // wagging tail
  put(c, 6 + s, 9, FUR[1], 1, 3);
  put(c, 8 - s, 9, FUR[1], 1, 3);
  put(c, 12 + s, 9, FUR[1], 1, 3);
  put(c, 14 - s, 9, FUR[1], 1, 3);
}

function pigeon(f: number, c: Ctx): void {
  const G: Ramp = [C.slate, C.steel, C.mist, C.fog];
  if (f >= 2) {
    const up = f === 2;
    blob(c, 7, 6, 3.2, 2, G, { seed: 16, noise: 0.1 });
    blob(c, 11, 5, 1.6, 1.5, G, { seed: 17, noise: 0 });
    put(c, 12, 5, C.e6, 1, 1);
    for (const x of [4, 6, 8]) limb(c, x, 5, x + 1, up ? 0 : 9, 1.3, 0.7, [C.steel, C.mist, C.fog], x);
    return;
  }
  blob(c, 5, 6, 3, 2.4, G, { seed: 18, noise: 0.1, edgeDark: 0.25 });
  blob(c, 8, 4, 1.6, 1.6, G, { seed: 19, noise: 0 });
  put(c, 9, 4, C.e6, 1, 1);
  put(c, 8, 4, C.ink, 1, 1);
  put(c, 6, 5, C.q4, 1, 2); // iridescent neck
  put(c, 4 + (f === 1 ? 1 : 0), 8, C.r4, 1, 2);
  put(c, 6 - (f === 1 ? 1 : 0), 8, C.r4, 1, 2);
}

function butterfly(f: number, c: Ctx): void {
  if (f === 0) {
    put(c, 1, 1, C.white, 2, 2);
    put(c, 4, 1, C.white, 2, 2);
    put(c, 1, 3, C.fog, 2, 2);
    put(c, 4, 3, C.fog, 2, 2);
    put(c, 3, 1, C.ink, 1, 4);
  } else {
    put(c, 3, 1, C.white, 1, 3);
    put(c, 2, 2, C.fog, 1, 2);
    put(c, 4, 2, C.fog, 1, 2);
    put(c, 3, 1, C.ink, 1, 1);
  }
}

function bird(f: number, c: Ctx): void {
  const col = C.night;
  put(c, 5, 3, col, 2, 2); // body
  if (f === 0) {
    put(c, 1, 0, col, 4, 1);
    put(c, 7, 0, col, 4, 1);
    put(c, 2, 1, col, 3, 1);
    put(c, 7, 1, col, 3, 1);
  } else if (f === 1) {
    put(c, 0, 2, col, 5, 1);
    put(c, 7, 2, col, 5, 1);
  } else {
    put(c, 1, 5, col, 4, 1);
    put(c, 7, 5, col, 4, 1);
    put(c, 2, 4, col, 3, 1);
    put(c, 7, 4, col, 3, 1);
  }
  put(c, 7, 3, col, 1, 1);
}

function fish(f: number, c: Ctx): void {
  const S: Ramp = [C.w3, C.w5, C.w6, C.pale];
  const y = f === 0 ? 3 : f === 1 ? 4 : 5;
  blob(c, 5, y, 3.4, 1.6, S, { seed: 20, noise: 0.1 });
  put(c, 1, y - 1, C.w4, 1, 3);
  put(c, 8, y, C.ink, 1, 1);
}

function glowTex(): Texture {
  const { canvas, ctx } = makeCanvas(9, 9);
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 9; x++) {
      const d = Math.hypot(x - 4, y - 4);
      if (d < 1) put(ctx, x, y, C.white);
      else if (d < 2.2) put(ctx, x, y, C.e7);
      else if (d < 3.4 && (x + y) % 2 === 0) put(ctx, x, y, C.e6);
      else if (d < 4.2 && (x + y) % 3 === 0) put(ctx, x, y, C.e5);
    }
  const t = Texture.from(canvas);
  t.source.scaleMode = 'nearest';
  return t;
}

export function buildAmbientArt(): AmbientArt {
  return {
    chicken: [0, 1, 2, 3].map((f) => mk(13, 13, (c) => chicken(f, c))),
    cat: [0, 1, 2, 3].map((f) => mk(17, 13, (c) => cat(f, c))),
    dog: [0, 1, 2, 3].map((f) => mk(21, 15, (c) => dog(f, c))),
    pigeon: [0, 1, 2, 3].map((f) => mk(14, 12, (c) => pigeon(f, c))),
    butterfly: [0, 1].map((f) => mk(7, 6, (c) => butterfly(f, c), { rim: false, outline: false })),
    bird: [0, 1, 2].map((f) => mk(12, 8, (c) => bird(f, c), { rim: false, outline: false })),
    fish: [0, 1, 2].map((f) => mk(11, 8, (c) => fish(f, c), { rim: false })),
    glow: glowTex(),
  };
}
