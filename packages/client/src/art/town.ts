/**
 * The Statue of QubitMan, Hadamere's plaza centrepiece: a stepped iso plinth (props.ts) with braziers and runes, and
 * the marble hero holding the qubit aloft. The other town props live in props.ts.
 */
import { Texture } from 'pixi.js';
import { mulberry32 } from '@eigenlands/shared';
import type { ObjSprite } from './objects';
import type { ObjSpriteDef } from './worldobjs';
import { blob, C, limb, makeCanvas, outline, pixelText, poly, polish, put, rampAt, undithered, type Ctx, type Ramp } from './shade';
import { Iso } from './isokit';
import { PLINTH, statueInscription, statuePlinth } from './props';

const MARBLE: Ramp = [C.steel, C.mist, C.fog, C.pale, C.white];
const MARBLE_D: Ramp = [C.slate, C.steel, C.mist, C.fog, C.pale];
const BRONZE: Ramp = [C.e1, C.r0, C.r1, C.r4, C.r5, C.r6];
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
  // a grand square plinth in true iso, the marble hero on top; the old figure art is re-seated onto the cap
  const W = 156, H = 236, AX = 78, AY = H - 34;
  const FX = AX - 52, FY = AY - PLINTH.top - 108;                                    // figure offset (feet at y≈108 in its own frame)
  const brazier = (ctx: Ctx, u: number, v: number) => {
    const I = new Iso(ctx, AX, AY - 8);
    I.cyl(u, v, PLINTH.z2, 2.6, 1.2, BRONZE, BRONZE);
    I.cyl(u, v, PLINTH.z2 + 1.2, 0.8, 5, BRONZE, BRONZE);
    I.cyl(u, v, PLINTH.z2 + 6.2, 3.2, 2.6, [C.e0, C.e1, C.r0, C.r1, C.e2], [C.ink, C.r0, C.r1]);
  };
  const corners: Array<[number, number]> = [[8 - 28.5, 8 + 28.5], [8 + 28.5, 8 - 28.5], [8 + 28.5, 8 + 28.5]];
  return make(W, H, AX, AY, (ctx) => {
    statuePlinth(ctx, AX, AY, f);
    for (const [u, v] of corners) brazier(ctx, u, v);
    ctx.save(); ctx.translate(FX, FY);
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
    // gold leaf: circlet, cape clasp, belt buckle, boot trims
    put(ctx, 47, 24, C.e6, 12, 1); put(ctx, 52, 22, C.e7, 2, 2);
    put(ctx, 39, 44, C.e6, 3, 3); put(ctx, 40, 45, C.e7);
    put(ctx, 51, 69, C.e6, 3, 3); put(ctx, 52, 70, C.e7);
    put(ctx, 36, 101, C.e5, 8, 1); put(ctx, 60, 101, C.e4, 8, 1);
    ctx.restore();
  }, (ctx) => {
    statueInscription(ctx, AX, AY, ['ALL HAIL', 'QUBITMAN'], pixelText);
    // brazier flames and their sparks
    const I = new Iso(ctx, AX, AY - 8);
    corners.forEach(([u, v], k) => {
      const x = Math.round(I.X(u, v)), y = Math.round(I.Y(u, v, PLINTH.z2 + 8.8));
      const h = 7 + ((f + k) % 3);
      for (let j = 0; j < h; j++) {
        const w = Math.max(0, Math.round(Math.min(3, (h - j) * 0.45)));
        const sway = j > 3 ? ((f + k + (j >> 1)) % 3) - 1 : 0;
        for (let i = -w; i <= w; i++) {
          const edge = Math.abs(i) === w;
          put(ctx, x + i + sway, y - j, edge ? C.r4 : j < 2 ? C.r6 : Math.abs(i) <= w - 2 || w < 2 ? (j < h - 3 ? C.white : C.e7) : C.r7);
        }
      }
      put(ctx, x + ((f * 3 + k) % 5) - 2, y - h - 2 - (f % 2), C.e7); put(ctx, x - ((f + k) % 3) + 1, y - h - 5, C.r6);
    });
    ctx.save(); ctx.translate(FX, FY);
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
    ctx.restore();
    // runes orbiting the plinth: behind the statue they dim, in front they burn
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 6.283 + f * 0.26;
      const x = AX + Math.cos(a) * 58, y = AY - 30 + Math.sin(a) * 16;
      const front = Math.sin(a) > 0;
      put(ctx, Math.round(x), Math.round(y), front ? C.q7 : C.q3); put(ctx, Math.round(x) + 1, Math.round(y) - 1, front ? C.q5 : C.q2);
      if (front) put(ctx, Math.round(x) - 1, Math.round(y) + 1, C.q4);
    }
  }, { ao: false });
}

const frames = (n: number, mk: (f: number) => ObjSprite): ObjSprite[] => Array.from({ length: n }, (_, f) => mk(f));

/** Town pieces by `sub` (deco/sign/furniture). Each call builds fresh textures; callers cache. */
export const TOWN_DECO: Record<string, () => ObjSpriteDef> = {
  statue: () => ({ frames: frames(4, statueFrame), fps: 4 }),
};
