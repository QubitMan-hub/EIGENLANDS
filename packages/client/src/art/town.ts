/**
 * The Statue of QubitMan, Hadamere's plaza centrepiece: a stepped iso plinth (props.ts) with braziers and runes, and
 * the marble hero holding the qubit aloft. The other town props live in props.ts.
 */
import { Texture } from 'pixi.js';
import { Scene, rampOf, type Mat } from './sprite';
import { mulberry32, PALETTE } from '@eigenlands/shared';
import type { ObjSprite } from './objects';
import type { ObjSpriteDef } from './worldobjs';
import { blob, C, makeCanvas, outline, pixelText, poly, polish, put, undithered, type Ctx, type Ramp } from './shade';
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

/** Sculpted as actual volumes through the same 2:1 camera as creatures, with a quiet carved face. */
let marbleHero: HTMLCanvasElement | null = null;
function drawMarbleHero(ctx: Ctx): void {
  if (!marbleHero) {
    const { canvas, ctx: c } = makeCanvas(108, 128);
    const colour = (i: number) => parseInt(PALETTE[i]!.slice(1), 16);
    const marble: Mat = { r: rampOf(MARBLE.map(colour), 2) };
    const shade: Mat = { r: rampOf(MARBLE_D.map(colour), 2) };
    const gold: Mat = { r: rampOf([C.e2, C.e3, C.e4, C.e5, C.e6].map(colour), 2) };
    // A restrained wind-swept mantle, with a folded hem and separate lit/shaded masses.
    poly(c, [[39, 47], [47, 48], [49, 65], [43, 95], [36, 108], [25, 108], [23, 103], [28, 85], [33, 64]], (x, y) => {
      const fold = (x - 17) / 45 + (y - 48) / 130;
      return MARBLE_D[Math.max(0, Math.min(4, Math.floor(4.2 - fold * 2.8) - (x > 31 && x < 35 ? 1 : 0)))]!;
    });
    const s = new Scene(108, 128, 52, 110, 0);
    // Weight over the planted leg, the other knee relaxed; feet share the plinth's actual projected plane.
    s.cap([0, 5, 35], [0, 11, 20], 3.9, 3.1, marble);
    s.cap([0, 11, 20], [4, 13, 4], 3.1, 2.4, marble);
    s.ell([6, 13, 2.3], [5.3, 2.8, 2.4], marble);
    s.cap([0, -5, 35], [-1, -10, 20], 3.8, 2.9, shade);
    s.cap([-1, -10, 20], [1, -13, 4], 2.9, 2.3, shade);
    s.ell([3, -13, 2.3], [5, 2.7, 2.4], shade);
    s.ell([0, 0, 36], [5.2, 6.8, 7], marble);
    s.ell([0, 0, 50], [5.5, 8.5, 12.5], marble);
    // Tunic folds and a short sculpted hem avoid the old bodybuilder chest/etched abs.
    s.ell([1, 0, 37], [6.1, 7.4, 5], shade);
    s.cap([4.8, -3, 43], [5.3, -3, 55], 0.55, 0.7, shade);
    s.cap([5, 3, 43], [5.5, 4, 56], 0.5, 0.7, marble);
    s.ell([0.5, 0, 40.5], [5.8, 7, 1.5], shade);
    s.ell([6, 0, 40.5], [1, 1.5, 1.7], gold);
    // Resting hand gently closes over the cloak at the waist.
    s.cap([0, 8, 58], [0, 13, 47], 3.4, 2.8, marble);
    s.cap([0, 13, 47], [5, 6, 43], 2.7, 2.1, marble);
    s.ell([5, 5, 43], [2.1, 2.2, 2.7], marble);
    // Raised arm has distinct upper arm, elbow, forearm and supporting palm.
    s.cap([0, -7, 59], [2, -16, 73], 3.4, 2.7, shade);
    s.cap([2, -16, 73], [7, -22, 87], 2.7, 2.1, marble);
    s.ell([7.5, -22, 89], [2.8, 2.5, 1.6], marble);
    s.cap([7, -24, 88.5], [9, -25, 91], 0.8, 0.65, marble);
    s.cap([1, 0, 61], [2, 0, 67], 2.5, 2.3, marble);
    s.ell([2, 0, 73], [4.7, 4.2, 6.4], marble);
    s.ell([5.8, 0, 72.8], [1.6, 1.1, 2], marble); // nose with a visible side plane
    s.ell([1.4, 0, 78], [4.9, 4.4, 3.6], shade);
    for (const y of [-3, 0, 3]) s.cap([4.7, y, 78], [-1.5, y, 80], 0.6, 0.8, marble);
    for (const y of [-2.7, 2.7]) {
      s.cap([5.4, y - 0.4, 75.4], [5.5, y + 0.4, 75.4], 0.55, 0.5, shade);
      s.dot([5.8, y, 74.7], colour(C.steel), 1, 1, 1.2);
    }
    s.cap([3.7, 3.7, 77], [5.8, 0, 77], 0.5, 0.5, gold);
    s.cap([6.2, -1, 70.4], [6.2, 1, 70.4], 0.45, 0.45, shade);
    s.ell([2, 6.5, 59], [1.3, 1.6, 1.3], gold);
    const data = c.createImageData(108, 128);
    new Uint32Array(data.data.buffer).set(s.resolve({ topLight: true }));
    // Composite the body over the mantle, retaining transparent negative space between the limbs.
    const body = makeCanvas(108, 128); body.ctx.putImageData(data, 0, 0); c.drawImage(body.canvas, 0, 0);
    marbleHero = canvas;
  }
  ctx.drawImage(marbleHero, 0, 0);
}

// ───────────────────────── the Statue of QubitMan ─────────────────────────
function statueFrame(f: number): ObjSprite {
  // A projected stone plinth and a sculpted hero, both seated on the same ground plane.
  const W = 156, H = 240, AX = 78, AY = 202; // retain ground anchor, leave room under the lowest plinth edge
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
    drawMarbleHero(ctx);
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
    for (let a = 0; a < 16; a++) put(ctx, Math.round(56 + Math.cos((a / 16) * 6.283) * 3.6), Math.round(57 + Math.sin((a / 16) * 6.283) * 3), C.q7);
    put(ctx, 56, 56, C.white); put(ctx, 57, 55, C.q6);
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
