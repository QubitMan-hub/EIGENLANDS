/**
 * The Statue of QubitMan, Hadamere's plaza centrepiece: a stepped iso plinth (props.ts) with braziers and runes, and
 * a weathered stone guardian holding the qubit aloft. The other town props live in props.ts.
 */
import { Texture } from 'pixi.js';
import { mulberry32 } from '@eigenlands/shared';
import type { ObjSprite } from './objects';
import type { ObjSpriteDef } from './worldobjs';
import { blob, C, line, makeCanvas, outline, pixelText, poly, polish, put, undithered, type Ctx, type Ramp } from './shade';
import { Iso, mat } from './isokit';
import { PLINTH, statueInscription, statuePlinth } from './props';

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

/** An authored stone guardian: three-quarter face, overlapping carved cloth and a planted staff.
 * The reference informs pose/material only; every silhouette and fold below is original pixel geometry. */
let stoneGuardian: HTMLCanvasElement | null = null;
function drawStoneGuardian(ctx: Ctx): void {
  if (!stoneGuardian) {
    const { canvas, ctx: c } = makeCanvas(108, 128);
    const shape = (pts: Array<[number, number]>, colour: number) => poly(c, pts, colour);
    const dark = C.g0, shadow = C.g1, stone = C.g2, mid = C.g3, light = C.g5, edge = C.fog;
    // Rear mantle: broad shoulder and trailing, broken hem. Negative space separates staff and body.
    shape([[46, 43], [58, 43], [70, 54], [72, 77], [82, 99], [77, 107], [66, 103], [34, 110], [27, 104], [35, 88], [36, 59]], dark);
    shape([[44, 49], [49, 48], [44, 76], [35, 103], [29, 104], [37, 85]], stone);
    shape([[63, 51], [68, 55], [67, 78], [78, 100], [72, 102], [60, 83]], shadow);
    // Staff is seated on the same projected base as the robe; sculpted bifurcated finial.
    shape([[24, 32], [27, 32], [25, 108], [22, 107]], shadow);
    line(c, 24, 35, 23, 104, C.e5);
    shape([[25, 21], [30, 27], [28, 34], [23, 37], [18, 32], [18, 26], [21, 22], [20, 29], [24, 32], [27, 28]], light);
    put(c, 24, 27, C.q7, 2, 3);
    // Long robe flares into a projected, stepped hem, with the weight over the right foot.
    shape([[44, 61], [61, 61], [62, 82], [68, 106], [57, 112], [38, 108], [34, 103], [41, 81]], stone);
    shape([[44, 65], [49, 68], [46, 91], [40, 105], [35, 103]], light);
    shape([[49, 69], [53, 68], [50, 99], [47, 109], [41, 107]], mid);
    shape([[55, 68], [58, 68], [59, 99], [64, 107], [57, 110], [53, 95]], light);
    shape([[60, 70], [62, 83], [67, 105], [64, 106], [58, 91]], shadow);
    shape([[50, 74], [52, 77], [49, 103], [47, 108]], shadow);
    line(c, 36, 103, 56, 110, C.e5); line(c, 56, 110, 67, 105, C.e3);
    // Sandalled feet peek from the hem, planted on the plinth rather than floating above it.
    shape([[40, 106], [46, 108], [46, 112], [38, 112], [36, 110]], mid);
    shape([[58, 109], [63, 107], [69, 110], [67, 114], [58, 114]], stone);
    line(c, 38, 110, 44, 111, edge); line(c, 59, 112, 66, 112, mid);
    // Torso is draped, not an exposed muscular mannequin. Lit diagonal sash crosses the chest.
    shape([[43, 44], [50, 41], [59, 44], [63, 53], [60, 66], [51, 70], [42, 64], [40, 53]], mid);
    shape([[43, 45], [47, 44], [46, 57], [56, 64], [51, 67], [41, 58]], light);
    shape([[56, 45], [60, 47], [60, 60], [56, 64], [52, 61]], stone);
    shape([[46, 43], [50, 43], [60, 59], [57, 62], [50, 54]], edge);
    line(c, 43, 62, 52, 67, C.e5); line(c, 52, 67, 60, 63, C.e3);
    put(c, 52, 64, C.e6, 3, 3);
    // Left sleeve, elbow and fingers curl around the staff.
    shape([[42, 45], [47, 50], [39, 65], [34, 67], [25, 59], [28, 54], [35, 58]], stone);
    shape([[41, 48], [43, 51], [36, 62], [28, 57], [28, 55], [35, 59]], light);
    shape([[25, 53], [29, 55], [28, 61], [24, 60], [22, 57]], mid);
    put(c, 24, 55, edge, 2, 1); line(c, 24, 58, 27, 59, shadow);
    // Right arm bends upward into a clear supporting palm under the qubit.
    shape([[59, 45], [63, 43], [68, 34], [68, 23], [72, 20], [76, 23], [74, 37], [68, 50], [64, 54]], shadow);
    shape([[62, 44], [66, 35], [69, 24], [72, 24], [71, 37], [65, 48]], light);
    shape([[69, 21], [67, 18], [68, 16], [72, 19], [77, 16], [80, 17], [77, 22], [72, 24]], mid);
    line(c, 69, 19, 74, 21, edge);
    // Neck, jaw, cheek and a turned nose establish a calm human face at native resolution.
    shape([[49, 35], [56, 35], [56, 43], [52, 47], [47, 42]], stone);
    shape([[46, 24], [51, 20], [57, 23], [59, 28], [62, 31], [59, 33], [58, 38], [53, 41], [48, 37]], mid);
    shape([[49, 25], [53, 23], [57, 25], [56, 30], [59, 32], [56, 34], [56, 37], [52, 38], [49, 34]], light);
    line(c, 54, 29, 57, 29, shadow); put(c, 56, 30, dark);
    line(c, 56, 35, 58, 35, stone); put(c, 59, 31, edge);
    // Swept stone hair and circlet, with a distinct ear and locks behind the jaw.
    shape([[45, 29], [44, 23], [47, 19], [54, 17], [58, 21], [59, 25], [54, 23], [49, 24], [48, 32], [49, 37], [46, 35]], shadow);
    line(c, 47, 23, 52, 20, mid); line(c, 46, 26, 46, 31, stone);
    line(c, 47, 24, 53, 22, C.e5); line(c, 53, 22, 58, 25, C.e3);
    put(c, 49, 30, stone, 1, 3);
    // Deliberate chips and hairline fractures follow folds; no random surface speckle.
    line(c, 39, 90, 42, 87, shadow); line(c, 42, 87, 42, 83, shadow);
    line(c, 64, 96, 61, 93, dark); put(c, 61, 92, mid);
    stoneGuardian = canvas;
  }
  ctx.drawImage(stoneGuardian, 0, 0);
}

// ───────────────────────── the Statue of QubitMan ─────────────────────────
function statueFrame(f: number): ObjSprite {
  // A projected stone plinth and a sculpted hero, both seated on the same ground plane.
  const W = 156, H = 240, AX = 78, AY = 202; // retain ground anchor, leave room under the lowest plinth edge
  const FX = AX - 52, FY = AY - PLINTH.top - 112;                                    // figure offset (feet at y≈112 in its own frame)
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
    drawStoneGuardian(ctx);
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
    for (let a = 0; a < 16; a++) put(ctx, Math.round(53 + Math.cos((a / 16) * 6.283) * 3.6), Math.round(55 + Math.sin((a / 16) * 6.283) * 3), C.q7);
    put(ctx, 53, 54, C.white); put(ctx, 54, 53, C.q6);
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
  sea_cache: () => ({ frames: [make(40, 40, 20, 32, ctx => {
    const I = new Iso(ctx, 20, 24), wood: Ramp = [C.e0, C.e1, C.e2, C.e3, C.e5];
    I.box(1, 4, 0, 15, 7, 2, mat(wood));
    I.box(4, 4, 2, 9, 8, 5, mat(wood));
    I.box(3.5, 3.5, 7, 10, 9, 1.5, mat([C.e2, C.e3, C.e4, C.e5, C.e6]));
    for (const u of [5, 11]) I.box(u, 3.5, 7.9, 0.8, 9, 0.7, mat([C.steel, C.mist, C.fog, C.pale]));
    I.dot(8, 12.3, 5, C.e6, 2);
    const p = [I.X(1, 7), I.Y(1, 7, 3)];
    line(ctx, p[0], p[1], p[0], p[1] - 11, C.e4);
    poly(ctx, [[p[0], p[1] - 11], [p[0] + 5, p[1] - 10], [p[0] + 4, p[1] - 7], [p[0], p[1] - 8]], C.w6);
  }, undefined, { ao: false })], fps: 0 }),
  statue: () => ({ frames: frames(4, statueFrame), fps: 4 }),
};
