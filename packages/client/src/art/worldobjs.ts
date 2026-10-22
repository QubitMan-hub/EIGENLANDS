/**
 * Procedural sprites for world objects (crops, stations, shelters, sprinklers, chests, furniture, town deco).
 * Everything is drawn from the fixed palette with Lambert-shaded blobs/slabs; `worldObjDef` caches per look.
 */
import { Texture } from 'pixi.js';
import { CROPS, cropStage, type CropData, type CropDef, type WorldObj, mulberry32 } from '@eigenlands/shared';
import type { ObjSprite } from './objects';
import type { Facing } from './isokit';
import { PROPS, ruinIso } from './props';
import { TOWN_DECO as TOWN_ART } from './town';
import { blob, C, line, makeCanvas, poly, polish, put, R, ramp4, slab, dk, lt, undithered, type Ctx, type Ramp } from './shade';

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

// ───────────────────────── crops ─────────────────────────
const GROUND_FRUIT = new Set(['melon', 'pumpkin']);
const HANGING_FRUIT = new Set(['eggplant']);


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
    // A stable primary silhouette and a coherent alternate echo, rather than swapping single-pixel checkers.
    const defB = CROPS[b] ?? def;
    const mk = (phase: number) => sprite(32, 30, 16, 23, (ctx) => {
      const A = makeCanvas(32, 30), B = makeCanvas(32, 30);
      drawCluster(A.ctx, def, stage, a.length * 31 + stage, false, -1);
      drawCluster(B.ctx, defB, Math.min(3, stage), b.length * 17 + stage, false, 2);
      ctx.save(); ctx.globalAlpha = 0.36; ctx.drawImage(B.canvas, 0, 0); ctx.restore();
      ctx.drawImage(A.canvas, 0, 0);
      // One restrained strand links the two states; sparse motes move, the plants do not flicker.
      for (let i = 0; i < 12; i++) {
        const x = 9 + i, y = 10 + Math.round(Math.sin(i * 0.45) * 2);
        if (i % 3 !== 0) put(ctx, x, y, i < 6 ? C.q4 : C.w5);
      }
      for (let i = 0; i < 3; i++) put(ctx, 6 + i * 9, 5 + ((i * 5 + phase * 2) % 12), i % 2 ? C.q7 : C.q6);
    }, { flat: true });
    out = anim([mk(0), mk(1), mk(2), mk(3)], 1, { noShadow: true, sway: 0.025 });
  }
  cropCache.set(key, out);
  return out;
}



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
  lamp: () => anim(frames(2, (f) => sprite(14, 30, 7, 28, (ctx) => {
    slab(ctx, 6, 9, 2, 19, [C.e1, C.e2, C.e3], 1, 0.15); slab(ctx, 3, 26, 8, 2, [C.e1, C.e2, C.e3], 2, 0.1);
    poly(ctx, [[2, 10], [4, 2], [10, 2], [12, 10]], (x) => (x < 7 ? C.e6 : C.e5));
    put(ctx, 3, 3, C.e7, 4, 5); put(ctx, 5 + f, 4, C.white, 2, 2);
    put(ctx, 2, 10, C.e3, 10, 1);
  })), 3, { noShadow: false }),
  phase_lantern: () => anim(frames(3, (f) => sprite(16, 30, 8, 28, (ctx) => {
    slab(ctx, 7, 12, 2, 16, IRON, 1, 0.1); slab(ctx, 4, 26, 8, 2, IRON, 2, 0.1);
    poly(ctx, [[3, 12], [5, 4], [11, 4], [13, 12]], (x, y) => VIOLET[Math.min(5, Math.max(0, 2 + (x > 8 ? -1 : 1) + (y < 7 ? 1 : 0) + (f === 1 ? 1 : 0)))]!);
    blob(ctx, 8, 8, 2.8, 3.4, [C.q3, C.q4, C.pale, C.white, C.white], { seed: f, noise: 0.05, bright: 0.2, edgeDark: 0 });
    put(ctx, 4, 4, C.steel, 8, 1); put(ctx, 3, 12, C.steel, 10, 1); put(ctx, 7, 2, C.slate, 2, 2);
    for (let i = 0; i < 3; i++) put(ctx, 2 + ((i * 5 + f * 3) % 12), 1 + ((i * 3 + f * 2) % 8), i % 2 ? C.q7 : C.q5);
  })), 3),
};



// ───────────────────────── town decor (Hadamere) ─────────────────────────










// ───────────────────────── village life props ─────────────────────────



function scarecrow(): ObjSpriteDef {
  return still(sprite(30, 40, 15, 37, (ctx) => {
    slab(ctx, 14, 10, 2, 27, WOOD, 5, 0.3); put(ctx, 4, 15, C.e3, 22, 2); put(ctx, 4, 15, C.e5, 22, 1);       // post and arms
    poly(ctx, [[9, 16], [21, 16], [19, 27], [11, 27]], (x, y) => (y < 20 ? C.r3 : y < 24 ? C.r2 : C.r1));      // ragged shirt
    for (const [x, y] of [[8, 18], [22, 18], [10, 28], [19, 28]] as const) put(ctx, x, y, C.e6, 2, 3);          // straw cuffs
    blob(ctx, 15, 9, 4.4, 4.4, [C.e4, C.e5, C.e6, C.e7], { seed: 8, noise: 0.3, edgeDark: 0.2 });
    put(ctx, 13, 8, C.ink, 1, 2); put(ctx, 17, 8, C.ink, 1, 2); put(ctx, 14, 12, C.ink, 3, 1);
    blob(ctx, 15, 4, 7, 2, [C.e1, C.e2, C.e3, C.e4], { seed: 9, noise: 0.2 }); blob(ctx, 15, 2, 3.6, 2.4, [C.e1, C.e2, C.e3, C.e4], { seed: 10, noise: 0.2 });
    put(ctx, 9, 27, C.q5, 1, 1);
  }), { sway: 0.05 });
}






// ───────────────────────── shrines ─────────────────────────



const TOWN_DECO: Record<string, () => ObjSpriteDef> = { statue: TOWN_ART.statue!, scarecrow };

const objCache = new Map<string, ObjSpriteDef>();

/** Sprite definition for a world object. Crops depend on growth stage / dead / superposition. */
// ───────────────────────── ruins (one style per biome) ─────────────────────────
/** Stone of a ruin: weathered fieldstone, snow-capped granite, fen-black basalt, sandstone, glade crystal, void glass. */
function ruinStone(biome: string): { ramp: Ramp; cap: Ramp | null; moss: Ramp | null; glow: number | null } {
  switch (biome) {
    case 'taiga': return { ramp: [C.steel, C.mist, C.fog, C.pale], cap: [C.fog, C.pale, C.white, C.white], moss: null, glow: null };
    case 'swamp': return { ramp: [C.night, C.slate, C.steel, C.mist], cap: null, moss: [C.g0, C.g1, C.g2, C.g3], glow: null };
    case 'desert': return { ramp: [C.e3, C.e4, C.e5, C.e6, C.e7], cap: null, moss: null, glow: null };
    case 'enchanted': return { ramp: [C.w1, C.w2, C.w3, C.w5, C.q7], cap: null, moss: [C.g2, C.w3, C.w5], glow: C.q7 };
    case 'corrupted': return { ramp: [C.ink, C.q0, C.q1, C.q2, C.q3], cap: null, moss: null, glow: C.q5 };
    case 'autumn': return { ramp: R.stone, cap: null, moss: [C.r0, C.r1, C.r4], glow: null };
    default: return { ramp: R.stone, cap: null, moss: [C.g1, C.g2, C.g3, C.g4], glow: null };
  }
}

function ruinDef(sub: string, biome: string): ObjSpriteDef {
  const st = ruinStone(biome);
  const n = sub === 'ruin_cache' ? 2 : st.glow !== null && (sub === 'ruin_obelisk' || sub === 'ruin_monolith') ? 3 : 1;
  if (ruinIso(sub, st, biome, 0)) return anim(frames(n, (f) => ruinIso(sub, st, biome, f)!), 2);
  const topping = (ctx: Ctx, cx: number, y: number, w: number) => {
    if (st.cap) blob(ctx, cx, y, w, 2.2, st.cap, { seed: 3, noise: 0.1, edgeDark: 0 });
    else if (st.moss) blob(ctx, cx - w * 0.2, y, w * 0.6, 1.8, st.moss, { seed: 5, noise: 0.4, edgeDark: 0 });
  };
  const column = (ctx: Ctx, x: number, top: number, bot: number, w: number) => {
    slab(ctx, x, top, w, bot - top, st.ramp, x + top, 0.25);
    for (let y = top + 3; y < bot; y += 4) put(ctx, x, y, st.ramp[0]!, w, 1);       // drum joints
    put(ctx, x, top, st.ramp[st.ramp.length - 1]!, w, 1);
  };
  switch (sub) {
    case 'ruin_pillar': return still(sprite(14, 34, 7, 32, (ctx) => {
      column(ctx, 3, 8 + (biome.length % 3) * 3, 31, 8); put(ctx, 1, 30, st.ramp[1]!, 12, 3);
      put(ctx, 9, 10, st.ramp[0]!, 2, 1); topping(ctx, 7, 9 + (biome.length % 3) * 3, 4);
    }));
    case 'ruin_wall': return still(sprite(26, 26, 13, 24, (ctx) => {
      for (let r = 0; r < 4; r++) for (let i = 0; i < 4 - (r === 3 ? 2 : r === 2 ? 1 : 0); i++) {
        const x = 1 + i * 6 + (r % 2) * 3, y = 20 - r * 5;
        slab(ctx, x, y, 6, 5, st.ramp, r * 7 + i, 0.3); put(ctx, x, y + 4, st.ramp[0]!, 6, 1); put(ctx, x + 5, y, st.ramp[0]!, 1, 5);
      }
      topping(ctx, 9, 6, 6);
    }));
    case 'ruin_rubble': return still(sprite(20, 12, 10, 10, (ctx) => {
      for (const [x, y, r] of [[6, 7, 3], [12, 8, 2.4], [15, 5, 2], [9, 4, 1.8]] as const) blob(ctx, x, y, r, r * 0.75, st.ramp, { seed: x, noise: 0.25 });
    }, { flat: true }));
    case 'ruin_cache': return anim(frames(2, (f) => sprite(18, 18, 9, 16, (ctx) => {
      slab(ctx, 2, 6, 14, 10, WOODL, 4, 0.3); put(ctx, 2, 6, C.e7, 14, 1);
      slab(ctx, 2, 2, 14, 5, WOOD, 6, 0.25); put(ctx, 2, 6, C.e1, 14, 1);
      for (const x of [2, 15]) put(ctx, x, 2, C.e6, 1, 14);                            // brass corners
      put(ctx, 8, 7, C.e6, 2, 3); put(ctx, 8, 8, C.ink);                               // lock
      if (st.moss) blob(ctx, 5, 3, 3, 1.3, st.moss, { seed: 2, noise: 0.5, edgeDark: 0 });
      put(ctx, 4 + f * 9, 1 - f, C.white); put(ctx, 13 - f * 8, 5 + f, C.e7);          // a glint that calls you over
    })), 2);
    default: {
      // the monument: arch, cairn, idol, obelisk, crystal arch, monolith
      const h = sub === 'ruin_cairn' ? 30 : sub === 'ruin_idol' ? 34 : 46;
      return anim(frames(st.glow !== null ? 3 : 1, (f) => sprite(40, h + 4, 20, h + 2, (ctx) => {
        if (sub === 'ruin_arch' || sub === 'ruin_crystal') {
          column(ctx, 5, 12, h + 1, 7); column(ctx, 28, 16, h + 1, 7);
          poly(ctx, [[4, 14], [20, 4], [36, 14], [35, 18], [20, 9], [5, 18]], (x) => (x < 20 ? st.ramp[st.ramp.length - 2]! : st.ramp[1]!));
          for (let i = 0; i < 6; i++) put(ctx, 8 + i * 4, 7 + Math.abs(i - 2.5) * 1.6, st.ramp[0]!, 1, 3);   // voussoirs
          blob(ctx, 31, h, 5, 2, st.ramp, { seed: 4, noise: 0.3 });                      // a fallen block
          topping(ctx, 20, 5, 7);
        } else if (sub === 'ruin_cairn') {
          for (const [x, y, r] of [[20, 27, 9], [15, 22, 6], [25, 21, 6], [20, 15, 6], [19, 9, 4.5], [21, 4.5, 3]] as const) blob(ctx, x, y, r, r * 0.72, st.ramp, { seed: x + y, noise: 0.2, edgeDark: 0.3 });
          topping(ctx, 20, 3, 4); topping(ctx, 15, 18, 4);
          put(ctx, 18, 12, C.r3, 4, 1);                                                   // a faded prayer cloth
        } else if (sub === 'ruin_idol') {
          blob(ctx, 20, 24, 10, 9, st.ramp, { seed: 7, noise: 0.2, edgeDark: 0.25 });     // body
          blob(ctx, 20, 11, 7, 7, st.ramp, { seed: 9, noise: 0.15, edgeDark: 0.25 });     // head
          put(ctx, 16, 10, C.ink, 2, 2); put(ctx, 22, 10, C.ink, 2, 2); put(ctx, 17, 15, st.ramp[0]!, 6, 1);
          put(ctx, 16 + f, 10, C.g4); put(ctx, 22 + f, 10, C.g4);                         // eyes catch the fen-light
          for (let i = 0; i < 9; i++) put(ctx, 9 + i * 3, h - 2 - (i % 3), C.g2, 2, 3);     // half-sunk in reeds
          topping(ctx, 18, 5, 5);
        } else {
          // obelisk / monolith: a tall tapering block with carved bands
          poly(ctx, [[13, h + 1], [15, 6], [20, 1], [25, 6], [27, h + 1]], (x, y) => (x < 20 ? st.ramp[Math.min(st.ramp.length - 1, 3 - (y > h / 2 ? 1 : 0))]! : st.ramp[1]!));
          for (let y = 10; y < h; y += 7) put(ctx, 15, y, st.ramp[0]!, 11, 1);
          if (sub === 'ruin_obelisk') { put(ctx, 9, h, C.e5, 22, 2); put(ctx, 6, h + 1, C.e4, 28, 1); }  // drifting sand
          if (sub === 'ruin_monolith') for (let i = 0; i < 4; i++) { const x = 8 + i * 8, y = h - 3 - (i % 2) * 4; poly(ctx, [[x, y + 4], [x + 2, y - 4], [x + 4, y + 4]], (px) => (px < x + 2 ? C.q4 : C.q2)); }
        }
        if (st.glow !== null) {
          const g = st.glow;
          for (let i = 0; i < 5; i++) put(ctx, 12 + ((i * 7 + f * 5) % 18), 8 + ((i * 11 + f * 3) % (h - 10)), i % 2 ? g : C.white);
          put(ctx, 19, Math.round(h * 0.45), g, 3, 3); put(ctx, 20, Math.round(h * 0.45) + 1, C.white);
        }
      }, { fringe: st.glow !== null })), 2);
    }
  }
}

/** Cave mouths (a timbered mine entrance in a rocky knoll, a lantern on the lintel) and the ladder back up. */
function caveDef(sub: string, biome: string): ObjSpriteDef {
  const st = ruinStone(biome);
  if (sub === 'cave_ladder') return anim(frames(2, (f) => sprite(22, 46, 11, 44, (ctx) => {
    for (let y = 0; y < 40; y++) for (let x = 3 + Math.floor(y / 14); x < 19 - Math.floor(y / 14); x++) if (((x + y + f) & 1) === 0 || (y < 12 && (x + y) % 3 === 0)) put(ctx, x, y, y < 10 ? C.pale : C.fog);   // daylight falling down the shaft
    for (const x of [6, 14]) { put(ctx, x, 2, C.e3, 2, 41); put(ctx, x, 2, C.e5, 1, 41); }
    for (let y = 6; y < 42; y += 5) { put(ctx, 7, y, C.e4, 7, 1); put(ctx, 7, y + 1, C.e1, 7, 1); }
    for (const [x, y, r] of [[5, 42, 2.6], [16, 42, 2.2], [11, 43, 1.8]] as const) blob(ctx, x, y, r, r * 0.6, R.stone, { seed: x, noise: 0.2 });
  }, { plain: true })), 2, { noShadow: true });
  return anim(frames(2, (f) => sprite(52, 40, 26, 36, (ctx) => {
    // the knoll
    for (const [x, y, rx, ry] of [[26, 22, 21, 14], [12, 28, 10, 8], [40, 27, 11, 9], [22, 13, 9, 6], [33, 15, 8, 6]] as const) blob(ctx, x, y, rx, ry, st.ramp, { seed: x + y, noise: 0.18, edgeDark: 0.25 });
    if (st.cap) blob(ctx, 24, 11, 12, 4, st.cap, { seed: 9, noise: 0.15, edgeDark: 0 });
    else if (st.moss) { blob(ctx, 20, 12, 10, 3.5, st.moss, { seed: 4, noise: 0.45, edgeDark: 0 }); blob(ctx, 40, 22, 5, 2.4, st.moss, { seed: 6, noise: 0.5, edgeDark: 0 }); }
    // the dark mouth, deepening inward
    poly(ctx, [[17, 36], [17, 24], [20, 20], [32, 20], [35, 24], [35, 36]], (x, y) => (y > 33 ? C.night : Math.abs(x - 26) < 5 && y > 24 ? C.ink : y < 23 ? C.night : C.ink));
    put(ctx, 22, 34, C.slate, 8, 1); put(ctx, 24, 33, C.night, 4, 1);                                         // rails leading in
    // timbers: two posts and a lintel
    for (const x of [15, 35]) { put(ctx, x, 19, C.e2, 3, 17); put(ctx, x, 19, C.e4, 1, 17); put(ctx, x + 2, 19, C.e0, 1, 17); }
    put(ctx, 13, 17, C.e3, 27, 3); put(ctx, 13, 17, C.e5, 27, 1); put(ctx, 13, 19, C.e1, 27, 1);
    for (const x of [16, 36]) put(ctx, x, 18, C.slate);                                                        // iron spikes
    // lantern on a hook, flame breathing
    put(ctx, 38, 20, C.night, 1, 2); put(ctx, 37, 22, C.e1, 3, 1); put(ctx, 37, 23, f ? C.e7 : C.e6, 3, 3); put(ctx, 38, 24, C.white); put(ctx, 37, 26, C.e1, 3, 1);
    // spoil heap of the old diggings
    for (const [x, y, r] of [[7, 35, 3], [11, 36, 2.4], [44, 35, 2.6]] as const) blob(ctx, x, y, r, r * 0.7, R.stone, { seed: x * 3, noise: 0.3 });
  })), 2.5);
}

/** Which prop sub draws from the isometric prop set (furniture lamps stay street lamps). */
function propSub(o: WorldObj): string | null {
  const sub = o.kind === 'chest' ? 'chest' : o.sub;
  if (!PROPS[sub] || (o.kind === 'furniture' && sub === 'lamp')) return null;
  return o.kind === 'deco' || o.kind === 'furniture' || o.kind === 'station' || o.kind === 'chest' || o.kind === 'sign' ? sub : null;
}

export function worldObjDef(o: WorldObj, facing: Facing = 'sw'): ObjSpriteDef {
  if (o.kind === 'crop') return cropDef(o.data as unknown as CropData | undefined, o.sub);
  const ps = propSub(o);
  if (ps) {
    const k = `prop:${ps}:${facing}`;
    let pd = objCache.get(k);
    if (!pd) { pd = PROPS[ps]!(facing); objCache.set(k, pd); }
    return pd;
  }
  const ruinBiome = o.sub.startsWith('ruin_') ? String((o.data as { biome?: string } | undefined)?.biome ?? 'meadow') : '';
  const key = o.kind === 'sprinkler' ? `sprinkler:${o.sub}:${(o.data as { watering?: boolean } | undefined)?.watering ? 1 : 0}` : ruinBiome ? `ruin:${o.sub}:${ruinBiome}` : o.sub === 'cave_mouth' ? `cave:${String((o.data as { biome?: string } | undefined)?.biome)}` : `${o.kind}:${o.sub}`;
  let d = objCache.get(key);
  if (!d) {
    if (ruinBiome) d = ruinDef(o.sub, ruinBiome);
    else if (o.sub === 'cave_mouth' || o.sub === 'cave_ladder') d = caveDef(o.sub, String((o.data as { biome?: string } | undefined)?.biome ?? 'meadow'));
    else if ((o.kind === 'deco' || o.kind === 'sign' || o.kind === 'furniture') && TOWN_DECO[o.sub]) d = TOWN_DECO[o.sub]!();
    else if (o.kind === 'station') d = PROPS.crate!(facing);
    else if (o.kind === 'sprinkler') d = sprinkler(o.sub === 'sprinkler2', !!(o.data as { watering?: boolean } | undefined)?.watering);
    else if (o.kind === 'shelter') d = PROPS[o.sub === 'barn' ? 'barn' : 'coop']!(facing);
    else if (o.kind === 'chest') d = chest();
    else if (o.kind === 'sign') d = (TOWN_DECO[o.sub] ?? sign)();
    else d = TOWN_DECO[o.sub]?.() ?? SEATS[o.sub]?.() ?? PROPS.crate!(facing);
    objCache.set(key, d);
  }
  return d;
}

/** Every distinct non-crop (kind, sub) the gallery should show. */
export const GALLERY_OBJECTS: Array<{ kind: WorldObj['kind']; sub: string }> = [
  ...['workbench', 'furnace', 'forge', 'cooking_pot', 'alchemy', 'loom', 'jeweler', 'carpenter'].map((sub) => ({ kind: 'station' as const, sub })),
  { kind: 'sprinkler', sub: 'sprinkler1' }, { kind: 'sprinkler', sub: 'sprinkler2' },
  { kind: 'shelter', sub: 'coop' }, { kind: 'shelter', sub: 'barn' }, { kind: 'chest', sub: 'chest' }, { kind: 'sign', sub: 'sign' },
  ...Object.keys(SEATS).map((sub) => ({ kind: 'furniture' as const, sub })),
  ...['well', 'board', 'counter', 'desk', 'barrel', 'stove', 'trophy', 'crate', 'statue', 'stall', 'bench', 'banner', 'planter', 'hay', 'signpost', 'cart', 'woodpile', 'scarecrow', 'laundry', 'beehive', 'trough', 'hedge', 'mailbox', 'shrine_altar', 'shrine_pillar', 'hearth', 'wardrobe', 'plant', 'stool', 'rack', 'basket', 'candles', 'cauldron', 'bookcase', 'lamp'].map((sub) => ({ kind: 'deco' as const, sub })),
  { kind: 'sign', sub: 'plaque' },
];

export function clearWorldObjCache(): void { cropCache.clear(); objCache.clear(); }
