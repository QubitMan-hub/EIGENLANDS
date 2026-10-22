/**
 * Procedural sprites for world objects (crops, stations, shelters, sprinklers, chests, furniture, town deco).
 * Everything is drawn from the fixed palette with Lambert-shaded blobs/slabs; `worldObjDef` caches per look.
 */
import { Texture } from 'pixi.js';
import { CROPS, cropStage, type CropData, type CropDef, type WorldObj, mulberry32 } from '@eigenlands/shared';
import type { ObjSprite } from './objects';
import { TOWN_DECO } from './town';
import { blob, C, line, makeCanvas, pixelText, poly, polish, put, R, ramp4, slab, dk, lt, undithered, type Ctx, type Ramp } from './shade';

export interface ObjSpriteDef {
  frames: ObjSprite[];
  /** animation speed in frames per second (0 = static) */
  fps: number;
  /** no cast shadow (flat on the ground, tiny, or low crops) */
  noShadow?: boolean;
  /** gentle wind sway amount (skew radians) */
  sway?: number;
}

const VIOLET = [C.q0, C.q1, C.q2, C.q3, C.q4, C.pale] as const;
const WOOD: Ramp = [C.e1, C.e2, C.e3, C.e4, C.e5];
const WOODL: Ramp = [C.e2, C.e3, C.e4, C.e5, C.e6];
const IRON: Ramp = [C.night, C.slate, C.steel, C.mist, C.fog];
const STONE = R.stone;
const BRASS: Ramp = [C.e2, C.e3, C.e4, C.e5, C.e6];

interface SpriteOpts { flat?: boolean; fringe?: boolean; plain?: boolean }
/** Draw a sprite, then add rim light + contact shadow (unless flat/plain) and optional quantum fringe. */
function sprite(w: number, h: number, ax: number, ay: number, draw: (ctx: Ctx) => void, o: SpriteOpts = {}): ObjSprite {
  const { canvas, ctx } = makeCanvas(w, h);
  undithered(() => {
    draw(ctx);
    if (!o.plain) polish(ctx, w, h, { rim: !o.flat, fringe: o.fringe, ao: o.flat ? null : { ax, ay, rx: Math.min(13, w * 0.3) } });
  });
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  return { tex, ax, ay };
}
const frames = (n: number, mk: (f: number) => ObjSprite): ObjSprite[] => Array.from({ length: n }, (_, f) => mk(f));
const still = (s: ObjSprite, o: Partial<ObjSpriteDef> = {}): ObjSpriteDef => ({ frames: [s], fps: 0, ...o });
const anim = (fs: ObjSprite[], fps: number, o: Partial<ObjSpriteDef> = {}): ObjSpriteDef => ({ frames: fs, fps, ...o });

/** wooden board with a lit top edge and dark bottom edge */
function plank(ctx: Ctx, x: number, y: number, w: number, h: number, seed = 1): void {
  slab(ctx, x, y, w, h, WOOD, seed, 0.3);
  put(ctx, x, y, C.e5, w, 1);
  put(ctx, x, y + h - 1, C.e0, w, 1);
}
function brick(ctx: Ctx, x: number, y: number, w: number, h: number, seed = 1): void {
  slab(ctx, x, y, w, h, STONE, seed, 0.45);
  for (let j = 2; j < h; j += 3) { for (let i = (j / 3) % 2 ? 2 : 0; i < w; i += 5) put(ctx, x + i, y + j - 1, C.slate, 1, 1); put(ctx, x, y + j, C.slate, w, 1); }
}

// ───────────────────────── crops ─────────────────────────
const GROUND_FRUIT = new Set(['melon', 'pumpkin']);
const HANGING_FRUIT = new Set(['eggplant']);

function leavesRamp(season?: number): Ramp { return season === 2 ? R.leafAutumnY : R.leaf; }

/** Draw one plant of `def` at stage 0..3 with its base at (cx, base). */
function drawPlant(ctx: Ctx, def: CropDef, stage: number, cx: number, base: number, seed: number, dead: boolean): void {
  const rng = mulberry32(seed);
  const fruit = ramp4(def.color);
  if (dead) {
    const h = [3, 5, 7, 9][stage]!;
    for (let i = 0; i < 4; i++) {
      const dx = (i - 1.5) * 1.6, droop = 1 + (i % 2);
      for (let j = 0; j < h; j++) { const t = j / h; put(ctx, cx + Math.round(dx * (0.4 + t) + (t > 0.6 ? droop : 0)), base - j + (t > 0.7 ? 1 : 0), j % 2 ? C.e2 : C.e3); }
    }
    put(ctx, cx - 2, base, C.e1, 5, 1);
    return;
  }
  put(ctx, cx - 2, base, C.e1, 5, 1); // soil shadow at the foot
  if (stage === 0) {
    blob(ctx, cx, base - 1, 2.6, 1.6, R.bark, { seed, noise: 0.2, edgeDark: 0.1 });
    put(ctx, cx, base - 3, C.g5); put(ctx, cx - 1, base - 3, C.g4); put(ctx, cx + 1, base - 4, C.g6);
    return;
  }
  switch (def.shape) {
    case 'root': {
      const n = 3 + stage, len = [0, 4, 6, 8][stage]!;
      for (let i = 0; i < n; i++) {
        const a = -0.9 + (1.8 * i) / (n - 1);
        for (let j = 0; j < len; j++) {
          const t = j / len;
          put(ctx, Math.round(cx + Math.sin(a) * t * len * 0.8), Math.round(base - 1 - Math.cos(a) * j * 0.9), t < 0.5 ? C.g3 : t < 0.85 ? C.g4 : C.g5);
          if (j > 1 && j < len - 1 && i % 2 === 0) put(ctx, Math.round(cx + Math.sin(a) * t * len * 0.8) + 1, Math.round(base - 1 - Math.cos(a) * j * 0.9), C.g4);
        }
      }
      if (stage === 3) blob(ctx, cx, base - 1.5, 3, 2.4, fruit, { seed: seed + 2, noise: 0.15, edgeDark: 0.3 });
      break;
    }
    case 'vine': {
      const grd = GROUND_FRUIT.has(def.id);
      if (!grd) { const h = [0, 7, 11, 14][stage]!; slab(ctx, cx, base - h, 1, h, WOOD, seed, 0.2); }
      const lv = stage * 2 + 2;
      for (let i = 0; i < lv; i++) {
        const side = i % 2 ? 1 : -1, h = grd ? 1 + (i % 3) : 2 + Math.floor((i / lv) * ([0, 7, 11, 14][stage]! - 2));
        blob(ctx, cx + side * (2 + (i % 3)), base - h - 1, 2.4, 1.7, R.leaf, { seed: seed + i * 3, noise: 0.45, bright: i % 3 ? 0 : 0.1 });
      }
      if (stage >= 2) for (let i = 0; i < 3; i++) put(ctx, cx + (i - 1) * 3, base - 4 - i * 2, stage === 2 ? C.white : def.color);
      if (stage === 3) {
        if (grd) { const r = def.id === 'pumpkin' ? 3.6 : 3.4; blob(ctx, cx, base - r + 0.5, r + 0.6, r, fruit, { seed: seed + 9, noise: 0.15, edgeDark: 0.3 }); for (const dx of [-1.4, 0, 1.4]) line(ctx, Math.round(cx + dx), Math.round(base - r * 1.7), Math.round(cx + dx * 1.6), Math.round(base - 1), dk(def.color)); put(ctx, cx, Math.round(base - r * 2 + 0.5), C.g3, 1, 2); }
        else for (let i = 0; i < 3; i++) blob(ctx, cx + (i - 1) * 3.2, base - 4 - i * 2.4 + 1.5, 1.8, 2, fruit, { seed: seed + i, noise: 0.1, bright: 0.1, edgeDark: 0.25 });
      }
      break;
    }
    case 'stalk': {
      const h = [0, 7, 12, 16][stage]!;
      slab(ctx, cx, base - h, 2, h, [C.g2, C.g3, C.g4, C.g5], seed, 0.2);
      for (let i = 0; i < stage * 2 + 1; i++) {
        const side = i % 2 ? 1 : -1, y = base - 2 - i * 2;
        for (let j = 1; j <= 4; j++) put(ctx, cx + (side > 0 ? 1 + j : -j), y - Math.floor(j / 2) + (j > 3 ? 1 : 0), j % 2 ? C.g4 : C.g5);
      }
      if (stage >= 2) { put(ctx, cx, base - h - 1, C.e6); put(ctx, cx + 1, base - h - 2, C.e5); put(ctx, cx - 1, base - h - 2, C.e5); }
      if (stage === 3) { blob(ctx, cx + 3, base - 8, 1.8, 3.4, fruit, { seed: seed + 4, noise: 0.3, edgeDark: 0.2 }); blob(ctx, cx - 2, base - 6, 1.6, 3, fruit, { seed: seed + 5, noise: 0.3 }); put(ctx, cx + 3, base - 11, C.g4, 2, 2); put(ctx, cx - 2, base - 9, C.g4, 2, 2); }
      break;
    }
    case 'bush':
    default: {
      const r = [0, 3, 4.4, 5][stage]!;
      blob(ctx, cx, base - r, r + 1, r, R.leaf, { seed, noise: 0.5 });
      blob(ctx, cx - 1, base - r - 1, r * 0.7, r * 0.6, R.leafSpring, { seed: seed + 1, noise: 0.35, bright: 0.12, edgeDark: 0.1 });
      if (stage === 2) for (let i = 0; i < 4; i++) put(ctx, cx - 3 + Math.floor(rng() * 7), base - 3 - Math.floor(rng() * 5), C.white);
      if (stage === 3) {
        if (HANGING_FRUIT.has(def.id)) for (let i = 0; i < 3; i++) blob(ctx, cx + (i - 1) * 3.2, base - r + 1.4 + (i % 2), 1.6, 3, fruit, { seed: seed + i, noise: 0.1, bright: 0.1, edgeDark: 0.25 });
        else for (let i = 0; i < 7; i++) { const bx = cx - r + Math.floor(rng() * r * 2), by = base - r * 1.6 + Math.floor(rng() * r * 1.4); put(ctx, bx, by, def.color, 2, 2); put(ctx, bx, by, lt(def.color)); put(ctx, bx + 1, by + 1, dk(def.color)); }
      }
    }
  }
}

const cropCache = new Map<string, ObjSpriteDef>();
/** Three plants per tile (back-left, back-right, front) so crops fill an iso diamond. */
const PLANT_SPOTS: Array<[number, number]> = [[10, 17], [22, 16], [16, 23]];
function drawCluster(ctx: Ctx, def: CropDef, stage: number, seed: number, dead: boolean, dx = 0): void {
  const spots = stage === 0 ? PLANT_SPOTS : PLANT_SPOTS;
  spots.forEach(([x, y], i) => drawPlant(ctx, def, stage, x + dx, y, seed + i * 11, dead));
}
function cropDef(d: CropData | undefined, sub: string): ObjSpriteDef {
  const a = (d?.crop ?? sub.replace('*', '').split('+')[0]!) as string;
  const b = d?.alt ?? (sub.startsWith('*') ? sub.slice(1).split('+')[1] : undefined);
  const def = CROPS[a] ?? CROPS.turnip!;
  const dead = !!d?.dead;
  const stage = d ? cropStage(d) : 3;
  const key = `crop:${a}:${b ?? ''}:${stage}:${dead}`;
  const hit = cropCache.get(key);
  if (hit) return hit;
  let out: ObjSpriteDef;
  if (!b || dead) {
    out = still(sprite(32, 30, 16, 23, (ctx) => drawCluster(ctx, def, stage, a.length * 31 + stage, dead), { flat: true }), { noShadow: def.shape !== 'stalk', sway: def.shape === 'stalk' ? 0.05 : 0.04 });
  } else {
    // superposition: both crops overlaid on a flickering checkerboard that swaps every frame, with q-sparkles
    const defB = CROPS[b] ?? def;
    const mk = (par: number) => sprite(32, 30, 16, 23, (ctx) => {
      const A = makeCanvas(32, 30), B = makeCanvas(32, 30);
      drawCluster(A.ctx, def, stage, a.length * 31 + stage, false, -1);
      drawCluster(B.ctx, defB, Math.min(3, stage), b.length * 17 + stage, false, 2);
      const ia = A.ctx.getImageData(0, 0, 32, 30).data, ib = B.ctx.getImageData(0, 0, 32, 30).data;
      const o = ctx.createImageData(32, 30);
      for (let y = 0; y < 30; y++) for (let x = 0; x < 32; x++) {
        const i = (y * 32 + x) * 4, pickA = ((x + y + par) & 1) === 0;
        const src = pickA ? (ia[i + 3]! ? ia : ib) : (ib[i + 3]! ? ib : ia);
        for (let k = 0; k < 4; k++) o.data[i + k] = src[i + k]!;
      }
      ctx.putImageData(o, 0, 0);
      for (let i = 0; i < 5; i++) put(ctx, 4 + ((i * 7 + par * 5) % 24), 4 + ((i * 5 + par * 3) % 20), i % 2 ? C.q7 : C.q5);
    }, { flat: true, fringe: true });
    out = anim([mk(0), mk(1)], 3, { noShadow: true });
  }
  cropCache.set(key, out);
  return out;
}

// ───────────────────────── stations ─────────────────────────
function gem(ctx: Ctx, x: number, y: number, c: number): void { put(ctx, x, y, c, 2, 2); put(ctx, x, y, lt(c)); put(ctx, x + 1, y + 1, dk(c)); }

const STATIONS: Record<string, () => ObjSpriteDef> = {
  workbench: () => still(sprite(22, 22, 11, 20, (ctx) => {
    for (const x of [2, 17]) slab(ctx, x, 12, 3, 8, WOOD, x, 0.3);
    slab(ctx, 3, 15, 16, 2, WOOD, 5, 0.2);
    plank(ctx, 1, 8, 20, 5, 3);
    for (let i = 0; i < 4; i++) put(ctx, 3 + i * 5, 9, C.e2, 1, 3);
    plank(ctx, 3, 5, 9, 3, 7); put(ctx, 4, 5, C.e6, 7, 1);                       // a plank being worked
    slab(ctx, 14, 3, 5, 3, IRON, 2, 0.1); for (let i = 0; i < 5; i++) put(ctx, 14 + i, 6, i % 2 ? C.slate : C.steel); // saw
    put(ctx, 18, 5, WOOD[1]!, 2, 3);
    slab(ctx, 16, 7, 3, 2, IRON, 4, 0.1);                                          // vise
  })),
  furnace: () => anim(frames(3, (f) => sprite(20, 28, 10, 26, (ctx) => {
    brick(ctx, 4, 0, 6, 10, 2); brick(ctx, 2, 8, 16, 18, 4);                       // chimney + body
    put(ctx, 2, 8, C.pale, 16, 1); put(ctx, 3, 9, C.fog, 14, 1);
    // arched mouth with a glowing coal bed and flame tongues
    poly(ctx, [[5, 25], [5, 17], [7, 14], [13, 14], [15, 17], [15, 25]], C.ink);
    put(ctx, 6, 23, C.r2, 8, 2); put(ctx, 6, 24, C.r3, 8, 1);
    for (let i = 0; i < 4; i++) put(ctx, 6 + i * 2 + (f % 2), 22, i % 2 ? C.r4 : C.r3, 2, 1);
    const tongues = [[7, 5 + (f % 3)], [10, 7 - (f % 2)], [12, 4 + ((f + 1) % 3)]] as const;
    for (const [x, h] of tongues) { for (let j = 0; j < h; j++) put(ctx, x, 22 - j, j < 2 ? C.e5 : j < h - 1 ? C.e6 : C.e7, j < h - 2 ? 2 : 1); put(ctx, x + 1, 21 - Math.floor(h / 2), C.r4); }
    put(ctx, 6, 14, C.slate, 8, 1);

    for (const x of [3, 16]) put(ctx, x, 10, C.steel, 2, 15);                      // iron straps
    if (f === 1) { put(ctx, 6, 1, C.fog); put(ctx, 7, 0, C.pale); }                // smoke
  })), 5),
  forge: () => anim(frames(3, (f) => sprite(28, 24, 14, 22, (ctx) => {
    brick(ctx, 1, 10, 13, 12, 3);                                                  // hearth
    slab(ctx, 2, 9, 11, 3, [C.night, C.slate, C.steel], 6, 0.3);
    blob(ctx, 7.5, 10, 4.5, 1.8, [C.r2, C.r3, C.r4, C.e5, C.e6], { seed: 20 + f, noise: 0.5, bright: 0.2 });
    for (let i = 0; i < 4; i++) put(ctx, 4 + ((i * 3 + f * 2) % 8), 7 - ((i + f) % 3), i % 2 ? C.e7 : C.e6); // embers
    slab(ctx, 17, 14, 8, 8, WOOD, 9, 0.5);                                         // stump
    poly(ctx, [[14, 12], [27, 12], [25, 14], [23, 14], [22, 16], [18, 16], [18, 14], [15, 14]], (x, y) => (y < 13 ? IRON[4]! : y < 15 ? IRON[3]! : IRON[2]!));
    put(ctx, 14, 12, C.white, 13, 1); put(ctx, 26, 12, IRON[3]!, 2, 1);

  })), 6),
  cooking_pot: () => anim(frames(3, (f) => sprite(20, 26, 10, 24, (ctx) => {
    for (const [x0, x1] of [[3, 8], [17, 12], [10, 10]] as const) line(ctx, x0, 22, x1, 8, C.e1);   // tripod
    put(ctx, 6, 22, C.slate, 8, 1);
    blob(ctx, 10, 20, 4, 1.6, [C.r3, C.r4, C.e5, C.e6], { seed: f + 2, noise: 0.5 });
    blob(ctx, 10, 13, 5.2, 4.4, IRON, { seed: 4, noise: 0.1, edgeDark: 0.35 });
    put(ctx, 5, 9, C.fog, 10, 1); put(ctx, 6, 8, C.mist, 8, 1);
    blob(ctx, 10, 9, 4, 1, [C.e3, C.e4, C.e5], { seed: 8, noise: 0.3 });
    put(ctx, 9 + (f === 1 ? 1 : 0), 18 - (f % 2), C.e6); put(ctx, 12 - (f === 2 ? 1 : 0), 19, C.e7);
    for (let i = 0; i < 3; i++) { const y = 5 - i * 2 - f; put(ctx, 9 + ((i + f) % 3) - 1, y, i === 0 ? C.pale : C.fog); }
  })), 4, { noShadow: false }),
  alchemy: () => anim(frames(2, (f) => sprite(24, 26, 12, 24, (ctx) => {
    for (const x of [2, 19]) slab(ctx, x, 14, 3, 10, WOOD, x, 0.3);
    plank(ctx, 1, 11, 22, 4, 6);
    slab(ctx, 3, 15, 18, 2, WOOD, 3, 0.2);
    // round flask (green), tall tube (violet), small flask (red)
    blob(ctx, 6, 7, 3.6, 3.6, [C.w2, C.w3, C.w5, C.w6], { seed: 1, noise: 0.05, bright: 0.1, edgeDark: 0.2 }); put(ctx, 5, 2, C.pale, 2, 3);
    blob(ctx, 6, 8.5, 3, 2.2, [C.g3, C.g4, C.g5, C.g6], { seed: 3, noise: 0.1 });
    slab(ctx, 11, 1, 4, 10, [C.w2, C.w3, C.w5], 2, 0.05); slab(ctx, 11, 5, 4, 6, [C.q2, C.q3, C.q4], 2, 0.1);
    blob(ctx, 19, 8, 2.8, 2.8, [C.w2, C.w3, C.w5], { seed: 5, noise: 0.05 }); blob(ctx, 19, 9, 2.2, 1.8, [C.r3, C.r4, C.r5], { seed: 6, noise: 0.1 }); put(ctx, 18, 3, C.pale, 2, 3);
    for (let i = 0; i < 3; i++) put(ctx, 5 + ((i * 3 + f * 2) % 4), 6 - ((i + f) % 3) , C.white);
    for (let i = 0; i < 2; i++) put(ctx, 12 + ((i + f) % 2) * 2, 4 - ((i * 2 + f) % 3), C.q6);
    put(ctx, 9, 9, C.e6, 2, 2);                                                    // mortar
  })), 3),
  loom: () => still(sprite(26, 28, 13, 26, (ctx) => {
    for (const x of [2, 20]) slab(ctx, x, 2, 4, 24, WOOD, x, 0.3);
    plank(ctx, 1, 1, 24, 3, 2); plank(ctx, 1, 20, 24, 3, 4);
    const cols = [C.pale, C.q4, C.r4, C.w4, C.pale];
    for (let x = 7; x < 20; x += 2) line(ctx, x, 5, x, 19, C.fog);
    for (let y = 12; y < 19; y++) for (let x = 7; x < 20; x++) put(ctx, x, y, ((Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? cols[(x >> 2) % 5]! : lt(cols[(x >> 2) % 5]!)));
    slab(ctx, 8, 24, 10, 3, WOOD, 7, 0.3); put(ctx, 11, 22, C.q5, 4, 2);          // bench + shuttle
  })),
  jeweler: () => still(sprite(22, 22, 11, 20, (ctx) => {
    for (const x of [2, 17]) slab(ctx, x, 12, 3, 8, [C.e0, C.e1, C.e2, C.e3], x, 0.3);
    plank(ctx, 1, 8, 20, 5, 9);
    slab(ctx, 3, 7, 12, 2, [C.q1, C.q2, C.q3], 3, 0.15);                           // velvet
    gem(ctx, 4, 6, C.r5); gem(ctx, 7, 5, C.w5); gem(ctx, 10, 6, C.g5); gem(ctx, 13, 5, C.q6);
    blob(ctx, 17, 5, 2.4, 2.4, IRON, { seed: 3, noise: 0.05 }); blob(ctx, 17, 5, 1.4, 1.4, [C.w4, C.w6, C.white], { seed: 4, noise: 0 }); line(ctx, 17, 7, 17, 9, C.steel);
  })),
  carpenter: () => still(sprite(24, 22, 12, 20, (ctx) => {
    for (const x of [2, 19]) slab(ctx, x, 12, 3, 8, WOOD, x, 0.3);
    plank(ctx, 1, 8, 22, 5, 11);
    plank(ctx, 3, 5, 11, 3, 13); put(ctx, 3, 5, C.e7, 11, 1);                      // plank on the bench
    for (let i = 0; i < 6; i++) put(ctx, 4 + i * 2, 4 - (i % 2), C.e7);            // shavings
    slab(ctx, 16, 2, 6, 3, IRON, 2, 0.1); for (let i = 0; i < 6; i++) put(ctx, 16 + i, 5, i % 2 ? C.slate : C.steel); put(ctx, 22, 3, WOOD[2]!, 1, 4); // saw
    slab(ctx, 1, 6, 4, 2, IRON, 3, 0.1); line(ctx, 3, 7, 3, 9, C.e3);              // hammer head
  })),
};

// ───────────────────────── other objects ─────────────────────────
function sprinkler(tier2: boolean, watering: boolean): ObjSpriteDef {
  const body = tier2 ? BRASS : IRON;
  const mk = (f: number) => sprite(20, 22, 10, 20, (ctx) => {
    slab(ctx, 8, 9, 3, 11, body, 1, 0.1);
    slab(ctx, 6, 6, 7, 4, body, 2, 0.1); put(ctx, 6, 6, tier2 ? C.e7 : C.white, 7, 1);
    put(ctx, 9, 3, tier2 ? C.e5 : C.steel, 1, 3);
    if (tier2) { put(ctx, 4, 8, C.e5, 2, 1); put(ctx, 13, 8, C.e5, 2, 1); }
    put(ctx, 6, 20, C.e1, 8, 1);
    if (watering) {
      const arms = tier2 ? 8 : 4;
      for (let k = 0; k < arms; k++) {
        const a = (k / arms) * Math.PI * 2 + (f * 0.4);
        for (let r = 3; r <= 8; r++) { const x = Math.round(10 + Math.cos(a) * r * 1.1), y = Math.round(5 - Math.sin(a * 0.6) * 1 + Math.abs(Math.sin(a)) * r * 0.6 - (r < 6 ? r * 0.4 : 3 - (r - 6) * -1)); if (r % 2 === f % 2) put(ctx, x, y, r > 6 ? C.w6 : C.w7); }
      }
    }
  });
  return watering ? anim(frames(3, mk), 8, { noShadow: true }) : still(mk(0), { noShadow: true });
}

function coop(): ObjSpriteDef {
  return still(sprite(30, 30, 15, 28, (ctx) => {
    slab(ctx, 3, 14, 24, 14, WOODL, 5, 0.4);
    for (let x = 6; x < 26; x += 4) put(ctx, x, 15, C.e2, 1, 13);
    poly(ctx, [[0, 15], [15, 3], [30, 15], [27, 17], [15, 7], [3, 17]], (x, y) => (x < 15 ? [C.r1, C.r2, C.r3][y % 3 === 0 ? 0 : 1]! : [C.r2, C.r3, C.r4][y % 3 === 0 ? 0 : 1]!));
    put(ctx, 15, 3, C.r5, 1, 3);
    slab(ctx, 11, 18, 8, 10, [C.e0, C.e1, C.e2], 3, 0.2); put(ctx, 12, 19, C.night, 6, 8);   // pop-hole
    slab(ctx, 9, 26, 12, 2, WOOD, 4, 0.2);                                                  // ramp
    blob(ctx, 5, 26, 3, 2, [C.e5, C.e6, C.e7], { seed: 6, noise: 0.6 });                  // hay
    blob(ctx, 25, 26, 2.8, 2, [C.e5, C.e6, C.e7], { seed: 7, noise: 0.6 });
    // a chicken on the ramp
    blob(ctx, 20, 25, 2.4, 2, [C.pale, C.white, C.white], { seed: 8, noise: 0 }); put(ctx, 22, 23, C.white, 2, 2); put(ctx, 23, 22, C.r4); put(ctx, 24, 24, C.e5);
  }));
}
function barn(): ObjSpriteDef {
  return still(sprite(40, 40, 20, 38, (ctx) => {
    slab(ctx, 3, 18, 34, 20, [C.r1, C.r2, C.r3, C.r4], 3, 0.35);
    for (let x = 6; x < 36; x += 3) put(ctx, x, 19, C.r1, 1, 19);
    poly(ctx, [[0, 20], [6, 9], [20, 2], [34, 9], [40, 20], [36, 20], [32, 12], [20, 7], [8, 12], [4, 20]], (x, y) => (x < 20 ? [C.night, C.slate, C.steel][(y >> 1) % 3]! : [C.slate, C.steel, C.mist][(y >> 1) % 3]!));
    slab(ctx, 13, 17, 14, 21, [C.e5, C.e6, C.e7], 4, 0.1);                               // doors
    line(ctx, 13, 17, 27, 37, C.pale); line(ctx, 27, 17, 13, 37, C.pale); put(ctx, 20, 17, C.pale, 1, 21);
    put(ctx, 13, 17, C.white, 14, 1); put(ctx, 13, 37, C.pale, 14, 1);
    slab(ctx, 16, 9, 8, 7, [C.e5, C.e6, C.e7], 5, 0.1); put(ctx, 17, 10, C.night, 6, 5);  // loft
    blob(ctx, 8, 36, 4, 2.4, [C.e5, C.e6, C.e7], { seed: 6, noise: 0.6 });

  }));
}
function chest(): ObjSpriteDef {
  return still(sprite(18, 18, 9, 16, (ctx) => {
    slab(ctx, 2, 8, 14, 8, WOOD, 3, 0.35);
    blob(ctx, 9, 8, 7, 4.2, WOODL, { seed: 4, noise: 0.25, shape: 3, edgeDark: 0.15 });
    put(ctx, 2, 8, C.e1, 14, 1);
    for (const x of [4, 12]) { put(ctx, x, 5, C.steel, 2, 11); put(ctx, x, 5, C.fog); }
    put(ctx, 8, 9, C.e6, 3, 4); put(ctx, 9, 10, C.e2);

  }));
}
function sign(): ObjSpriteDef {
  return still(sprite(18, 22, 9, 20, (ctx) => {
    slab(ctx, 8, 7, 2, 13, WOOD, 3, 0.3);
    plank(ctx, 2, 2, 14, 8, 5); put(ctx, 4, 4, C.e1, 10, 1); put(ctx, 4, 6, C.e1, 8, 1); put(ctx, 4, 8, C.e1, 6, 1);
    put(ctx, 3, 3, C.fog); put(ctx, 14, 8, C.fog);
  }));
}

const SEATS: Record<string, () => ObjSpriteDef> = {
  chair: () => still(sprite(14, 18, 7, 16, (ctx) => {
    slab(ctx, 3, 2, 8, 7, WOOD, 2, 0.3); put(ctx, 4, 3, C.e1, 6, 1); put(ctx, 4, 5, C.e1, 6, 1);
    plank(ctx, 2, 8, 10, 3, 4);
    for (const x of [3, 10]) slab(ctx, x, 11, 2, 5, WOOD, x, 0.2);
  })),
  table: () => still(sprite(24, 18, 12, 16, (ctx) => {
    for (const x of [3, 19]) slab(ctx, x, 9, 2, 7, WOOD, x, 0.2);
    plank(ctx, 1, 5, 22, 5, 8); put(ctx, 6, 6, C.e6, 4, 1); put(ctx, 14, 7, C.e2, 5, 1);
    blob(ctx, 17, 3, 2.2, 1.6, [C.w2, C.w3, C.w5], { seed: 2, noise: 0.1 });         // a cup
  })),
  bed: () => still(sprite(18, 28, 9, 26, (ctx) => {
    slab(ctx, 1, 2, 16, 24, WOOD, 3, 0.3);
    slab(ctx, 2, 4, 14, 8, [C.pale, C.white, C.white], 4, 0.1); blob(ctx, 9, 6.5, 5, 2.6, [C.fog, C.pale, C.white], { seed: 5, noise: 0.05 }); // pillow
    slab(ctx, 2, 12, 14, 13, [C.r2, C.r3, C.r4, C.r5], 6, 0.2); put(ctx, 2, 12, C.r6, 14, 1);
    for (let i = 0; i < 3; i++) put(ctx, 4 + i * 4, 16, C.r2, 2, 7);

  })),
  lamp: () => anim(frames(2, (f) => sprite(14, 30, 7, 28, (ctx) => {
    slab(ctx, 6, 9, 2, 19, [C.e1, C.e2, C.e3], 1, 0.15); slab(ctx, 3, 26, 8, 2, [C.e1, C.e2, C.e3], 2, 0.1);
    poly(ctx, [[2, 10], [4, 2], [10, 2], [12, 10]], (x) => (x < 7 ? C.e6 : C.e5));
    put(ctx, 3, 3, C.e7, 4, 5); put(ctx, 5 + f, 4, C.white, 2, 2);
    put(ctx, 2, 10, C.e3, 10, 1);
  })), 3, { noShadow: false }),
  shelf: () => still(sprite(18, 26, 9, 24, (ctx) => {
    slab(ctx, 1, 2, 16, 22, WOOD, 3, 0.3);
    for (const y of [8, 15, 22]) put(ctx, 1, y, C.e0, 16, 1);
    const books = [C.r3, C.w3, C.g4, C.q3, C.e5, C.r5, C.w5];
    for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) put(ctx, 2 + i * 2 + (r ? 1 : 0), 3 + r * 7 + (i % 3 === 0 ? 1 : 0), books[(i + r * 3) % 7]!, 2, 6 - (i % 3 === 0 ? 1 : 0));
    blob(ctx, 5, 19, 2.4, 2.4, [C.w2, C.w3, C.w5], { seed: 1, noise: 0 }); blob(ctx, 12, 19, 2.2, 2.2, [C.e3, C.e5, C.e6], { seed: 2, noise: 0.1 });
  })),
  rug: () => still(sprite(16, 16, 8, 16, (ctx) => {
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) put(ctx, x, y, (x === 1 || y === 1 || x === 14 || y === 14) ? C.q1 : (x === 2 || y === 2 || x === 13 || y === 13) ? C.r4 : ((x + y) % 4 < 2 ? C.q3 : C.q2));
    put(ctx, 7, 7, C.e6, 2, 2); put(ctx, 6, 8, C.e5); put(ctx, 9, 7, C.e5);
    for (let x = 1; x < 15; x += 2) { put(ctx, x, 0, C.e6); put(ctx, x, 15, C.e6); }
  }), { noShadow: true }),
  phase_lantern: () => anim(frames(3, (f) => sprite(16, 30, 8, 28, (ctx) => {
    slab(ctx, 7, 12, 2, 16, IRON, 1, 0.1); slab(ctx, 4, 26, 8, 2, IRON, 2, 0.1);
    poly(ctx, [[3, 12], [5, 4], [11, 4], [13, 12]], (x, y) => VIOLET[Math.min(5, Math.max(0, 2 + (x > 8 ? -1 : 1) + (y < 7 ? 1 : 0) + (f === 1 ? 1 : 0)))]!);
    blob(ctx, 8, 8, 2.8, 3.4, [C.q3, C.q4, C.pale, C.white, C.white], { seed: f, noise: 0.05, bright: 0.2, edgeDark: 0 });
    put(ctx, 4, 4, C.steel, 8, 1); put(ctx, 3, 12, C.steel, 10, 1); put(ctx, 7, 2, C.slate, 2, 2);
    for (let i = 0; i < 3; i++) put(ctx, 2 + ((i * 5 + f * 3) % 12), 1 + ((i * 3 + f * 2) % 8), i % 2 ? C.q7 : C.q5);
  })), 3),
};

const DECO: Record<string, () => ObjSpriteDef> = {
  well: () => still(sprite(32, 34, 16, 32, (ctx) => {
    for (const x of [5, 25]) slab(ctx, x, 6, 3, 20, WOOD, x, 0.3);
    poly(ctx, [[1, 8], [16, 0], [31, 8], [28, 10], [16, 4], [4, 10]], (x) => (x < 16 ? C.r2 : C.r3));
    for (let x = 4; x < 29; x += 3) put(ctx, x, 7, C.r1, 1, 2);
    blob(ctx, 16, 24, 11, 6, STONE, { seed: 4, noise: 0.35, edgeDark: 0.3 });
    blob(ctx, 16, 22, 8.4, 3.6, [C.w1, C.w2, C.w3, C.w4], { seed: 6, noise: 0.15, edgeDark: 0 });
    put(ctx, 12, 21, C.w6, 3, 1); put(ctx, 18, 23, C.w5, 3, 1);
    for (let i = 0; i < 5; i++) put(ctx, 6 + i * 4, 26, C.slate, 2, 1);
    line(ctx, 16, 8, 16, 18, C.e2); slab(ctx, 14, 16, 5, 4, WOOD, 3, 0.2);          // rope + bucket

  })),
  board: () => still(sprite(26, 30, 13, 28, (ctx) => {
    for (const x of [3, 21]) slab(ctx, x, 6, 3, 22, WOOD, x, 0.3);
    plank(ctx, 1, 2, 24, 16, 5); slab(ctx, 3, 4, 20, 12, [C.e3, C.e4, C.e5], 3, 0.4);
    const paper = (x: number, y: number, w: number, h: number, c: number) => { put(ctx, x, y, c, w, h); put(ctx, x, y, lt(c), w, 1); put(ctx, x + Math.floor(w / 2), y, C.r4); for (let k = 2; k < h; k += 2) put(ctx, x + 1, y + k, C.slate, w - 2, 1); };
    paper(5, 5, 6, 8, C.pale); paper(12, 6, 5, 6, C.e7); paper(18, 5, 4, 9, C.w7);
    poly(ctx, [[0, 2], [13, -2], [26, 2], [24, 3], [13, 0], [2, 3]], C.e2);

  })),
  counter: () => still(sprite(18, 18, 9, 16, (ctx) => {
    slab(ctx, 0, 6, 18, 10, WOOD, 5, 0.3); put(ctx, 0, 6, C.e6, 18, 2);
    for (let x = 3; x < 18; x += 6) put(ctx, x, 9, C.e1, 1, 7);
    slab(ctx, 2, 3, 6, 3, [C.w2, C.w3, C.w4], 3, 0.2);                              // cloth runner
    put(ctx, 12, 3, C.e6, 3, 3); put(ctx, 13, 4, C.e7);
  })),
  desk: () => still(sprite(26, 20, 13, 18, (ctx) => {
    slab(ctx, 1, 8, 24, 10, [C.e0, C.e1, C.e2, C.e3], 5, 0.3); put(ctx, 1, 8, C.e4, 24, 2);
    put(ctx, 4, 6, C.pale, 7, 3); put(ctx, 4, 6, C.white, 7, 1); put(ctx, 6, 5, C.fog, 6, 1);
    blob(ctx, 19, 6, 1.8, 1.8, [C.night, C.slate, C.w3], { seed: 1, noise: 0 }); line(ctx, 21, 5, 24, 1, C.pale);   // inkwell + quill

  })),
  barrel: () => still(sprite(16, 20, 8, 18, (ctx) => {
    blob(ctx, 8, 11, 6, 7, WOODL, { seed: 3, noise: 0.25, shape: 2.6, edgeDark: 0.25 });
    for (const y of [5, 11, 16]) put(ctx, 3, y, C.steel, 10, 1);
    for (let x = 5; x < 12; x += 3) put(ctx, x, 3, C.e1, 1, 14);
    put(ctx, 4, 3, C.e5, 8, 1);
  })),
  stove: () => anim(frames(2, (f) => sprite(18, 28, 9, 26, (ctx) => {
    slab(ctx, 6, 0, 4, 9, IRON, 3, 0.1);
    slab(ctx, 2, 8, 14, 17, IRON, 4, 0.2); put(ctx, 2, 8, C.fog, 14, 1);
    put(ctx, 5, 14, C.ink, 8, 6); put(ctx, 6 + f, 16, f ? C.e6 : C.e5, 5, 3); put(ctx, 8, 15, C.e7, 2, 2);
    for (const x of [4, 12]) put(ctx, x, 25, C.slate, 2, 1);
  })), 4),
  bed: () => SEATS.bed!(),
  trophy: () => still(sprite(14, 18, 7, 16, (ctx) => {
    slab(ctx, 4, 12, 6, 3, WOOD, 1, 0.2); slab(ctx, 6, 8, 2, 5, BRASS, 2, 0.1); poly(ctx, [[3, 2], [11, 2], [10, 8], [4, 8]], BRASS[3]!);
  })),
  crate: () => still(sprite(16, 16, 8, 14, (ctx) => {
    slab(ctx, 2, 4, 12, 10, WOODL, 3, 0.3); put(ctx, 2, 4, C.e7, 12, 1); put(ctx, 2, 8, C.e1, 12, 1); line(ctx, 2, 4, 13, 13, C.e1); line(ctx, 13, 4, 2, 13, C.e1);
  })),
};

const objCache = new Map<string, ObjSpriteDef>();

/** Sprite definition for a world object. Crops depend on growth stage / dead / superposition. */
export function worldObjDef(o: WorldObj): ObjSpriteDef {
  if (o.kind === 'crop') return cropDef(o.data as unknown as CropData | undefined, o.sub);
  const key = o.kind === 'sprinkler' ? `sprinkler:${o.sub}:${(o.data as { watering?: boolean } | undefined)?.watering ? 1 : 0}` : `${o.kind}:${o.sub}`;
  let d = objCache.get(key);
  if (!d) {
    if ((o.kind === 'deco' || o.kind === 'sign' || o.kind === 'furniture') && TOWN_DECO[o.sub]) d = TOWN_DECO[o.sub]!();
    else if (o.kind === 'station') d = (STATIONS[o.sub] ?? DECO.crate!)();
    else if (o.kind === 'sprinkler') d = sprinkler(o.sub === 'sprinkler2', !!(o.data as { watering?: boolean } | undefined)?.watering);
    else if (o.kind === 'shelter') d = o.sub === 'barn' ? barn() : coop();
    else if (o.kind === 'chest') d = chest();
    else if (o.kind === 'sign') d = o.sub === 'board' ? DECO.board!() : sign();
    else d = (SEATS[o.sub] ?? DECO[o.sub] ?? DECO.crate!)();
    objCache.set(key, d);
  }
  return d;
}

/** Every distinct non-crop (kind, sub) the gallery should show. */
export const GALLERY_OBJECTS: Array<{ kind: WorldObj['kind']; sub: string }> = [
  ...Object.keys(STATIONS).map((sub) => ({ kind: 'station' as const, sub })),
  { kind: 'sprinkler', sub: 'sprinkler1' }, { kind: 'sprinkler', sub: 'sprinkler2' },
  { kind: 'shelter', sub: 'coop' }, { kind: 'shelter', sub: 'barn' }, { kind: 'chest', sub: 'chest' }, { kind: 'sign', sub: 'sign' },
  ...Object.keys(SEATS).map((sub) => ({ kind: 'furniture' as const, sub })),
  ...['statue', 'plaque', 'bench', 'planter', 'stall', 'signpost'].map((sub) => ({ kind: 'deco' as const, sub })),
  ...['well', 'board', 'counter', 'desk', 'barrel', 'stove', 'trophy', 'crate'].map((sub) => ({ kind: 'deco' as const, sub })),
];

export function clearWorldObjCache(): void { cropCache.clear(); objCache.clear(); }
