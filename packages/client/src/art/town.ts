/**
 * Hadamere's town furnishing: the Statue of QubitMan (the plaza centrepiece), its plaque, benches, flowerbeds,
 * market stalls, signposts and street lamps. All iso-correct (lit from the top-left) and drawn from the palette.
 */
import { Texture } from 'pixi.js';
import { mulberry32 } from '@eigenlands/shared';
import type { ObjSprite } from './objects';
import type { ObjSpriteDef } from './worldobjs';
import { blob, C, cyl, isoBox, limb, line, makeCanvas, outline, bigTextC, poly, polish, put, rampAt, undithered, type Ctx, type Ramp } from './shade';

const MARBLE: Ramp = [C.steel, C.mist, C.fog, C.pale, C.white];
const MARBLE_D: Ramp = [C.slate, C.steel, C.mist, C.fog, C.pale];
const GRANITE: Ramp = [C.night, C.slate, C.steel, C.mist, C.fog];
const BRONZE: Ramp = [C.e1, C.r0, C.r1, C.r4, C.r5, C.r6];
const WOOD: Ramp = [C.e1, C.e2, C.e3, C.e4, C.e5];
const IRON: Ramp = [C.ink, C.night, C.slate, C.steel];
const ORB: Ramp = [C.q2, C.q3, C.q7, C.w7, C.white];

function finish(canvas: HTMLCanvasElement, ax: number, ay: number): ObjSprite {
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  return { tex, ax, ay };
}
function make(w: number, h: number, ax: number, ay: number, draw: (ctx: Ctx) => void, post?: (ctx: Ctx) => void, o: { outline?: number; ao?: boolean } = {}): ObjSprite {
  const { canvas, ctx } = makeCanvas(w, h);
  undithered(() => {
    draw(ctx);
    if (o.outline !== undefined) outline(ctx, w, h, o.outline);
    polish(ctx, w, h, { rim: true, ao: o.ao === false ? null : { ax, ay, rx: Math.min(16, w * 0.32) } });
    post?.(ctx);
  });
  return finish(canvas, ax, ay);
}

// ───────────────────────── the Statue of QubitMan ─────────────────────────
function statueFrame(f: number): ObjSprite {
  const W = 108, H = 182, AX = 52, AY = 168;
  return make(W, H, AX, AY, (ctx) => {
    // stepped round pedestal
    cyl(ctx, 52, 160, 49, 13, 6, GRANITE, GRANITE, 3);
    cyl(ctx, 52, 152, 42, 11.5, 8, GRANITE, MARBLE_D, 4);
    cyl(ctx, 52, 143, 34, 9.5, 6, MARBLE_D, MARBLE, 5);
    cyl(ctx, 52, 115, 29, 8, 30, MARBLE, MARBLE, 6);
    cyl(ctx, 52, 111, 34, 9.5, 5, MARBLE_D, MARBLE, 7);
    for (const dx of [-27, -25, 25, 27]) for (let y = 120; y < 145; y++) put(ctx, 52 + dx, y + Math.round(Math.abs(dx) * 0.08), dx < 0 ? C.mist : C.steel);
    // bronze plaque: ALL HAIL / QUBITMAN in engraved 5x7 capitals
    for (let y = 119; y < 141; y++) for (let x = 26; x < 79; x++) {
      const edge = x === 26 || x === 78 || y === 119 || y === 140;
      put(ctx, x, y, edge ? C.e1 : rampAt(BRONZE, 1.0 - (x - 26) / 75 - (y - 119) / 90, x, y));
    }
    put(ctx, 27, 120, C.r7, 51, 1); put(ctx, 27, 139, C.r0, 51, 1);
    for (const [x, y] of [[28, 121], [76, 121], [28, 138], [76, 138]] as const) put(ctx, x, y, C.e2);
    bigTextC(ctx, 'ALL HAIL', 52.5, 122, C.e0, C.r6);
    bigTextC(ctx, 'QUBITMAN', 52.5, 131, C.e0, C.r6);

    // ── QubitMan (marble), feet on the cap at y≈110; the cape billows to the left in a quantum wind
    poly(ctx, [[42, 41], [63, 41], [67, 62], [66, 102], [52, 108], [33, 112], [17, 104], [21, 84], [30, 60]], (x, y) => {
      const fold = Math.sin(x * 0.42 + y * 0.1 + 0.6);
      const t = 0.66 - (x - 17) / 110 + (fold > 0.6 ? 0.2 : fold < -0.55 ? -0.24 : 0) - (y - 41) / 300;
      return rampAt(MARBLE_D, t, x, y);
    });
    for (let y = 100; y < 112; y++) for (let x = 18; x < 60; x++) if (Math.abs(y - (104 + (x - 17) * 0.15 + Math.sin(x * 0.5) * 1.5)) < 0.6) put(ctx, x, y, C.slate);
    // legs: heroic stance
    limb(ctx, 47, 72, 42, 90, 5.6, 4.6, MARBLE, 11);
    limb(ctx, 42, 90, 40, 104, 4.4, 3.8, MARBLE, 12);
    limb(ctx, 58, 72, 61, 90, 5.6, 4.6, MARBLE_D, 13);
    limb(ctx, 61, 90, 63, 104, 4.4, 3.8, MARBLE_D, 14);
    blob(ctx, 40, 106, 5.2, 3.4, MARBLE, { seed: 15, noise: 0.04, edgeDark: 0.3 });
    blob(ctx, 64, 106, 5.2, 3.4, MARBLE_D, { seed: 16, noise: 0.04, edgeDark: 0.3 });
    put(ctx, 36, 101, C.fog, 8, 1); put(ctx, 60, 101, C.mist, 8, 1);             // boot cuffs
    // torso: broad chest, narrow belted waist
    poly(ctx, [[39, 43], [66, 43], [62, 58], [60, 71], [45, 71], [42, 58]], (x, y) => rampAt(MARBLE, 0.98 - (x - 39) / 32 - (y - 43) / 110, x, y));
    blob(ctx, 47, 50, 6.4, 4.6, MARBLE, { seed: 17, noise: 0.02, bright: 0.14, edgeDark: 0.18 });
    blob(ctx, 58, 50, 6.2, 4.6, MARBLE, { seed: 18, noise: 0.02, bright: -0.04, edgeDark: 0.22 });
    for (const y of [59, 63]) { put(ctx, 48, y, C.mist, 3, 1); put(ctx, 55, y, C.steel, 3, 1); }
    put(ctx, 52, 56, C.steel, 1, 13);
    put(ctx, 44, 69, C.steel, 17, 3); put(ctx, 44, 69, C.mist, 17, 1);           // belt
    // left fist on the hip
    limb(ctx, 41, 46, 34, 58, 4.6, 4, MARBLE, 19);
    limb(ctx, 34, 58, 43, 67, 4, 3.4, MARBLE, 20);
    blob(ctx, 43, 67, 3.4, 3, MARBLE_D, { seed: 21, noise: 0.03 });
    // shoulders
    blob(ctx, 41, 45, 5.6, 4.4, MARBLE, { seed: 22, noise: 0.02, bright: 0.12, edgeDark: 0.22 });
    blob(ctx, 64, 45, 5.6, 4.4, MARBLE_D, { seed: 23, noise: 0.02, edgeDark: 0.22 });
    // neck + head, chin up toward the orb
    put(ctx, 50, 36, C.mist, 6, 6); put(ctx, 50, 36, C.fog, 2, 6);
    blob(ctx, 53.5, 30, 6.2, 7, MARBLE, { seed: 24, noise: 0.02, edgeDark: 0.18 });
    poly(ctx, [[49, 33], [60, 31], [59, 37], [54, 39], [49, 37]], (x, y) => rampAt(MARBLE, 0.8 - (x - 49) / 20 - (y - 31) / 25, x, y));
    blob(ctx, 50.5, 25.5, 6.6, 4.6, MARBLE_D, { seed: 25, noise: 0.18, bright: 0.18, edgeDark: 0.12 });
    for (const [x, y] of [[44, 26], [43, 28], [45, 23]] as const) put(ctx, x, y, C.mist, 2, 1);   // swept-back hair
    put(ctx, 56, 29, C.slate, 2, 1); put(ctx, 57, 28, C.steel); put(ctx, 60, 31, C.fog); put(ctx, 59, 34, C.steel, 2, 1);
    // raised right arm holding the qubit aloft
    limb(ctx, 64, 46, 70, 31, 4.6, 4.2, MARBLE_D, 26);
    limb(ctx, 70, 31, 72, 18, 4.2, 3.6, MARBLE, 27, 0.05);
    blob(ctx, 72.5, 16, 4.4, 4, MARBLE, { seed: 28, noise: 0.03, edgeDark: 0.2 });
  }, (ctx) => {
    // emissive bits after the outline: chest emblem (a tiny Bloch circle) and the glowing orb
    const pulse = [0, 1, 2, 1][f]!;
    for (let a = 0; a < 16; a++) put(ctx, Math.round(52.5 + Math.cos((a / 16) * 6.283) * 3.6), Math.round(53 + Math.sin((a / 16) * 6.283) * 3), C.q7);
    put(ctx, 53, 52, C.white); put(ctx, 54, 51, C.q6);
    const ox = 73, oy = 8;
    blob(ctx, ox, oy, 6 + pulse * 0.35, 6 + pulse * 0.35, ORB, { seed: 30 + f, noise: 0.05, bright: -0.12 + pulse * 0.06, edgeDark: 0.12 });
    put(ctx, ox - 3, oy - 3, C.white, 2, 1); put(ctx, ox - 3, oy - 2, C.white);
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * 6.283;
      const x = ox + Math.cos(a) * 11, y = oy + Math.sin(a) * 3 - Math.cos(a) * 2;
      const front = Math.sin(a) > 0;
      if (front || Math.hypot(x - ox, y - oy) > 6.5) put(ctx, Math.round(x), Math.round(y), front ? C.q4 : C.q2);
    }
    const ma = (f / 4) * 6.283;
    put(ctx, Math.round(ox + Math.cos(ma) * 11) - 1, Math.round(oy + Math.sin(ma) * 3 - Math.cos(ma) * 2) - 1, C.q6, 2, 2);
    const rng = mulberry32(100 + f);
    for (let i = 0; i < 5; i++) {
      const x = Math.round(ox - 13 + rng() * 26), y = Math.round(oy - 7 + rng() * 18);
      const c = [C.q7, C.q6, C.white, C.q4][(i + f) % 4]!;
      if (x >= 1 && y >= 1) { put(ctx, x, y, c); if (i % 2 === 0) { put(ctx, x - 1, y, C.q3); put(ctx, x + 1, y, C.q3); put(ctx, x, y - 1, C.q3); put(ctx, x, y + 1, C.q3); } }
    }
  });
}

// ───────────────────────── small town pieces ─────────────────────────
function plaque(): ObjSprite {
  return make(30, 22, 15, 18, (ctx) => {
    isoBox(ctx, 15, 21, 10, 10, 5, (u, v, x, y) => rampAt(GRANITE, 0.8 - u * 0.3, x, y), (u, v, x, y) => rampAt(GRANITE, 0.42 - u * 0.2, x, y), (s2, t, x, y) => rampAt(MARBLE_D, 0.75 - t * 0.3, x, y));
    // a slanted bronze reading plate on top
    poly(ctx, [[6, 11], [24, 11], [22, 4], [8, 4]], (x, y) => rampAt(BRONZE, 0.95 - (x - 6) / 30 - (11 - y) / 30, x, y));
    for (let i = 0; i < 3; i++) put(ctx, 10 - (i === 0 ? 0 : 1), 6 + i * 2, C.e1, 11 + (i === 0 ? 0 : 2), 1);
  });
}

function bench(): ObjSprite {
  return make(36, 28, 19, 22, (ctx) => {
    // iron legs at both ends, slatted seat and back rest (runs along the x axis)
    for (const [lx, ly] of [[6, 18], [25, 24]] as const) { put(ctx, lx, ly - 7, C.night, 2, 7); put(ctx, lx + 3, ly - 8, C.slate, 1, 6); }
    // seat slats
    for (let k = 0; k < 3; k++) isoBox(ctx, 26 + k * 1, 17 - k * 0.5 - 0, 18, 1, 1, (u, v, x, y) => rampAt(WOOD, 0.85 - u * 0.4 - k * 0.12, x, y), C.e2, (s, t, x, y) => rampAt(WOOD, 0.95 - s * 0.3 - k * 0.1, x, y));
    // back rest: two slats higher up at the back edge
    for (let k = 0; k < 2; k++) isoBox(ctx, 29, 12 - k * 4, 18, 1, 2, (u, v, x, y) => rampAt(WOOD, 0.8 - u * 0.4, x, y), C.e2, (s, t, x, y) => rampAt(WOOD, 0.9 - s * 0.3, x, y));
    put(ctx, 12, 5, C.night, 1, 10); put(ctx, 29, 13, C.night, 1, 9);               // back posts
  });
}

function planter(): ObjSprite {
  return make(34, 36, 17, 30, (ctx) => {
    isoBox(ctx, 17, 34, 14, 14, 9, (u, v, x, y) => (Math.floor(v) % 4 === 3 || Math.floor(u * 14) % 6 === 5 ? C.slate : rampAt(GRANITE, 0.9 - u * 0.3, x, y)), (u, v, x, y) => (Math.floor(v) % 4 === 3 || Math.floor(u * 14) % 6 === 5 ? C.night : rampAt(GRANITE, 0.5 - u * 0.2, x, y)), (s, t, x, y) => (s < 0.1 || t < 0.1 || s > 0.9 || t > 0.9 ? C.fog : C.e1));
    // shrubs and flowers spilling out
    blob(ctx, 13, 18, 7, 5, [C.g1, C.g2, C.g3, C.g4, C.g5], { seed: 3, noise: 0.45 });
    blob(ctx, 21, 19, 7, 5, [C.g1, C.g2, C.g3, C.g4, C.g5], { seed: 4, noise: 0.45 });
    blob(ctx, 17, 15, 6, 4.5, [C.g2, C.g3, C.g4, C.g5, C.g6], { seed: 5, noise: 0.4, bright: 0.1 });
    const rng = mulberry32(7);
    const cols = [[C.r3, C.r5], [C.q5, C.q6], [C.w7, C.white], [C.r5, C.r6]];
    for (let i = 0; i < 11; i++) {
      const x = 8 + Math.floor(rng() * 19), y = 12 + Math.floor(rng() * 9), c = cols[i % 4]!;
      put(ctx, x, y, c[0]!); put(ctx, x + 1, y, c[1]!); put(ctx, x, y - 1, c[1]!);
    }
  });
}

function stall(f: number, kind: number): ObjSprite {
  return make(44, 54, 22, 46, (ctx) => {
    // corner posts
    for (const [x, y] of [[6, 40], [22, 48], [37, 40], [22, 32]] as const) put(ctx, x, y - 30, C.e1, 2, 30);
    // counter crate with produce
    isoBox(ctx, 22, 48, 15, 15, 11, (u, v, x, y) => (Math.floor(v) % 4 === 0 ? C.e1 : rampAt(WOOD, 0.85 - u * 0.35, x, y)), (u, v, x, y) => (Math.floor(v) % 4 === 0 ? C.e0 : rampAt(WOOD, 0.45 - u * 0.25, x, y)), (s, t, x, y) => rampAt(WOOD, 0.7, x, y));
    const prod = [[C.r2, C.r3, C.r4, C.r5], [C.r4, C.r5, C.r6, C.r7], [C.g3, C.g4, C.g5, C.g6], [C.q1, C.q2, C.q3, C.q4]];
    const rng = mulberry32(kind * 13 + 5);
    for (let i = 0; i < 14; i++) {
      const x = 12 + rng() * 20, y = 30 + rng() * 9 - Math.abs(x - 22) * 0.2;
      blob(ctx, x, y, 1.8, 1.6, prod[(i + kind) % 4]!, { seed: i, noise: 0.05, bright: 0.15 });
    }
    // striped awning, gently flapping
    const lift = f ? 1 : 0;
    poly(ctx, [[2, 18 + lift], [22, 28], [42, 18 - lift], [22, 6]], (x, y) => {
      const stripe = Math.floor((x - 2 + (y - 6) * 0.5 * 0) / 4) % 2 === 0;
      const shade = x < 22 ? 0.8 : 0.45;
      return stripe ? (shade > 0.6 ? C.r3 : C.r2) : (shade > 0.6 ? C.e7 : C.e6);
    });
    for (let x = 2; x <= 42; x += 2) { const y = x <= 22 ? 18 + lift + (x - 2) / 2 : 28 - (x - 22) / 2 - lift * ((x - 22) / 20); put(ctx, x, Math.round(y), Math.floor(x / 4) % 2 ? C.r0 : C.e5, 1, 2); }
  });
}

function signpost(): ObjSprite {
  return make(30, 40, 15, 36, (ctx) => {
    put(ctx, 14, 6, C.e2, 3, 31); put(ctx, 14, 6, C.e4, 1, 31);
    const board = (y: number, dir: number, c: Ramp) => {
      const x0 = dir > 0 ? 15 : 3;
      poly(ctx, dir > 0 ? [[x0, y], [x0 + 10, y], [x0 + 13, y + 3], [x0 + 10, y + 6], [x0, y + 6]] : [[x0 + 12, y], [x0 + 2, y], [x0 - 1, y + 3], [x0 + 2, y + 6], [x0 + 12, y + 6]], (x, yy) => rampAt(c, yy === y ? 0.95 : 0.6 - (yy - y) / 14, x, yy));
      put(ctx, x0 + 3, y + 3, C.e1, 6, 1);
    };
    board(8, 1, WOOD); board(17, -1, [C.e2, C.e3, C.e4, C.e5, C.e6]);
    blob(ctx, 15, 37, 5, 1.6, [C.g2, C.g3, C.g4], { seed: 2, noise: 0.5 });
  });
}

/** Victorian street lamp: iron post, glowing lantern (2 flicker frames). */
function lamp(f: number): ObjSprite {
  return make(18, 48, 9, 45, (ctx) => {
    cyl(ctx, 9, 41, 4, 1.6, 3, IRON, IRON, 2);
    put(ctx, 8, 14, C.night, 3, 27); put(ctx, 8, 14, C.slate, 1, 27);
    put(ctx, 7, 24, C.night, 5, 1); put(ctx, 7, 33, C.night, 5, 1);
    // lantern housing
    poly(ctx, [[3, 5], [15, 5], [9, 0]], C.night);
    put(ctx, 4, 5, C.slate, 10, 1);
    for (let y = 6; y < 14; y++) for (let x = 4; x < 14; x++) {
      const frame = x === 4 || x === 13 || x === 9 || y === 13;
      const g = 0.6 + 0.4 * Math.max(0, 1 - Math.hypot(x - 8.5, y - 9.5) / 4.5) + (f ? 0.08 : 0);
      put(ctx, x, y, frame ? C.night : g > 0.92 ? C.r7 : g > 0.75 ? C.r6 : C.r5);
    }
    put(ctx, 5, 14, C.slate, 8, 1);
  });
}

const frames = (n: number, mk: (f: number) => ObjSprite): ObjSprite[] => Array.from({ length: n }, (_, f) => mk(f));

/** Town pieces by `sub` (deco/sign/furniture). Each call builds fresh textures; callers cache. */
export const TOWN_DECO: Record<string, () => ObjSpriteDef> = {
  statue: () => ({ frames: frames(4, statueFrame), fps: 4 }),
  plaque: () => ({ frames: [plaque()], fps: 0 }),
  bench: () => ({ frames: [bench()], fps: 0 }),
  planter: () => ({ frames: [planter()], fps: 0, sway: 0.01 }),
  stall: () => ({ frames: frames(2, (f) => stall(f, 0)), fps: 1.2 }),
  signpost: () => ({ frames: [signpost()], fps: 0 }),
  lamp: () => ({ frames: frames(2, lamp), fps: 3 }),
};
void line;
