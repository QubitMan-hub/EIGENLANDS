import { Texture } from 'pixi.js';
import { villageTexture } from './village-animals';
import { blob, C, makeCanvas, outline, polish, put, type Ctx, type Ramp } from './shade';

/** Tiny procedural creatures for the living-world layer: village animals, insects and birds. Village animals share the farm renderer; small sky effects remain screen-space sprites. */
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
    chicken: [0, 1, 2, 3].map((f) => villageTexture('chicken', f)),
    cat: [0, 1, 2, 3].map((f) => villageTexture('cat', f)),
    dog: [0, 1, 2, 3].map((f) => villageTexture('dog', f)),
    pigeon: [0, 1, 2, 3].map((f) => villageTexture('pigeon', f)),
    butterfly: [0, 1].map((f) => mk(7, 6, (c) => butterfly(f, c), { rim: false, outline: false })),
    bird: [0, 1, 2].map((f) => mk(12, 8, (c) => bird(f, c), { rim: false, outline: false })),
    fish: [0, 1, 2].map((f) => mk(11, 8, (c) => fish(f, c), { rim: false })),
    glow: glowTex(),
  };
}
