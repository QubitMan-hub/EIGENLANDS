/**
 * The Statue of QubitMan, Hadamere's plaza centrepiece: a stepped iso plinth (props.ts) with braziers and runes, and
 * a weathered stone guardian holding the qubit aloft. The other town props live in props.ts.
 */
import { Texture } from 'pixi.js';
import { mulberry32 } from '@eigenlands/shared';
import type { ObjSprite } from './objects';
import type { ObjSpriteDef } from './worldobjs';
import {
  blob,
  C,
  line,
  makeCanvas,
  outline,
  pixelText,
  poly,
  polish,
  put,
  rampAt,
  undithered,
  type Ctx,
  type Ramp,
} from './shade';
import { Iso, mat } from './isokit';
import { PLINTH, statueInscription, statuePlinth } from './props';

const BRONZE: Ramp = [C.e1, C.r0, C.r1, C.r4, C.r5, C.r6];

function finish(canvas: HTMLCanvasElement, ax: number, ay: number): ObjSprite {
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  return { tex, ax, ay };
}
function make(
  w: number,
  h: number,
  ax: number,
  ay: number,
  draw: (ctx: Ctx) => void,
  post?: (ctx: Ctx) => void,
  o: { outline?: number; ao?: boolean } = {},
): ObjSprite {
  const { canvas, ctx } = makeCanvas(w, h);
  undithered(() => {
    draw(ctx);
    if (o.outline !== undefined) outline(ctx, w, h, o.outline);
    polish(ctx, w, h, { rim: true, ao: o.ao === false ? null : { ax, ay, rx: Math.min(16, w * 0.32) } });
    post?.(ctx);
  });
  return finish(canvas, ax, ay);
}

/** QubitMan himself, cast in painted bronze: a wide hat with a glowing teal plume, a heavy red scarf, a long dark coat
 * over a crimson waistcoat, white puffed sleeves, gold studs and a gold scroll case at the hip. Drawn in a 108x128 frame
 * with the feet at y=114, facing the viewer. */
let qubitMan: HTMLCanvasElement | null = null;
function drawStoneGuardian(ctx: Ctx): void {
  if (!qubitMan) {
    const { canvas, ctx: c } = makeCanvas(108, 128);
    // light falls from the upper left: ramps run light -> dark left to right, with an optional top-down term
    const shade =
      (ramp: Ramp, x0: number, x1: number, y0 = 0, y1 = 0, bias = 0) =>
      (x: number, y: number) =>
        rampAt(
          ramp,
          Math.max(
            0.04,
            Math.min(
              0.96,
              0.8 + bias - ((x - x0) / Math.max(1, x1 - x0)) * 0.5 - (y1 > y0 ? ((y - y0) / (y1 - y0)) * 0.22 : 0),
            ),
          ),
          x,
          y,
        );
    const fill = (pts: Array<[number, number]>, ramp: Ramp, bias = 0, vertical = false) => {
      const xs = pts.map((p) => p[0]),
        ys = pts.map((p) => p[1]);
      poly(
        c,
        pts,
        shade(
          ramp,
          Math.min(...xs),
          Math.max(...xs),
          vertical ? Math.min(...ys) : 0,
          vertical ? Math.max(...ys) : 0,
          bias,
        ),
      );
    };
    const COAT: Ramp = [C.ink, C.e0, C.e1, C.e2, C.e3];
    const GREY: Ramp = [C.night, C.slate, C.e1, C.steel, C.mist];
    const RED: Ramp = [C.c0, C.c1, C.c2, C.r3, C.c3];
    const WHITE: Ramp = [C.steel, C.mist, C.fog, C.pale, C.white];
    const NAVY: Ramp = [C.w0, C.w1, C.w2, C.b0];
    const SKIN: Ramp = [C.e2, C.e3, C.e4, C.e5, C.e6];
    const GOLD: Ramp = [C.e3, C.c3, C.c4, C.e6, C.e7];
    const TEAL: Ramp = [C.t0, C.t1, C.t2, C.w6, C.q7];
    const diamond = (x: number, y: number) => {
      put(c, x, y - 2, C.c4);
      put(c, x - 1, y - 1, C.c4, 3, 1);
      put(c, x - 2, y, C.c3, 5, 1);
      put(c, x - 1, y + 1, C.c4, 3, 1);
      put(c, x, y + 2, C.c3);
      put(c, x, y, C.e7);
    };

    // ── the long coat behind everything: wide at the shoulder, tight at the waist, flaring to the knee
    fill(
      [
        [30, 34],
        [78, 34],
        [70, 62],
        [82, 96],
        [26, 96],
        [38, 62],
      ],
      COAT,
      -0.12,
      true,
    );
    // ── legs: navy trousers into tall black boots with pointed toes and gold ankle plates
    fill(
      [
        [43, 70],
        [53, 70],
        [52, 104],
        [42, 104],
      ],
      NAVY,
    );
    fill(
      [
        [55, 70],
        [65, 70],
        [67, 102],
        [56, 104],
      ],
      NAVY,
      -0.1,
    );
    fill(
      [
        [40, 92],
        [53, 92],
        [54, 108],
        [50, 115],
        [32, 116],
        [38, 106],
      ],
      [C.ink, C.e0, C.e1, C.e2],
      0,
      true,
    );
    fill(
      [
        [56, 92],
        [69, 92],
        [71, 106],
        [78, 116],
        [60, 115],
        [55, 108],
      ],
      [C.ink, C.e0, C.e1, C.e2],
      -0.1,
      true,
    );
    line(c, 41, 95, 52, 94, C.e3);
    line(c, 57, 94, 68, 95, C.e2);
    diamond(44, 104);
    diamond(66, 104);
    // ── the red waistcoat, long and open, with tan piping and a darker centre seam
    fill(
      [
        [46, 32],
        [62, 32],
        [62, 62],
        [66, 94],
        [42, 94],
        [46, 62],
      ],
      RED,
      0.06,
      true,
    );
    line(c, 54, 38, 54, 92, C.c0);
    line(c, 46, 34, 46, 62, C.e4);
    line(c, 62, 34, 62, 62, C.e3);
    // ── coat fronts: heavy panels folding back from the waist, edged in tan, the left one lit
    fill(
      [
        [33, 50],
        [45, 56],
        [47, 66],
        [43, 98],
        [24, 99],
      ],
      COAT,
      0.1,
      true,
    );
    fill(
      [
        [63, 56],
        [75, 50],
        [84, 99],
        [65, 98],
        [62, 66],
      ],
      COAT,
      -0.1,
      true,
    );
    line(c, 45, 58, 43, 96, C.e5);
    line(c, 46, 58, 44, 96, C.e3);
    line(c, 63, 58, 65, 96, C.e3);
    line(c, 24, 98, 33, 52, C.e4);
    line(c, 84, 98, 75, 52, C.e2);
    // ── belt and buckle
    fill(
      [
        [40, 60],
        [68, 60],
        [68, 65],
        [40, 65],
      ],
      [C.ink, C.e0, C.e1, C.e2],
    );
    line(c, 40, 60, 68, 60, C.e3);
    put(c, 52, 60, C.c4, 5, 5);
    put(c, 53, 61, C.e7, 3, 3);
    put(c, 54, 62, C.c3);
    // ── the gold scroll case hanging at the left hip, two rolls strapped together
    fill(
      [
        [25, 64],
        [43, 67],
        [42, 74],
        [24, 71],
      ],
      GOLD,
    );
    fill(
      [
        [26, 72],
        [44, 75],
        [43, 81],
        [25, 78],
      ],
      GOLD,
      -0.14,
    );
    line(c, 25, 65, 42, 68, C.e7);
    line(c, 26, 73, 43, 76, C.e6);
    blob(c, 24, 70, 2.2, 3.2, GOLD, { seed: 3, noise: 0, edgeDark: 0.25 });
    blob(c, 25, 77, 2.2, 3, GOLD, { seed: 4, noise: 0, edgeDark: 0.25 });
    line(c, 33, 66, 33, 80, C.e2);
    // ── broad shoulder mantle in grey-brown with a tan border, gold diamonds, then the white puffed sleeves
    fill(
      [
        [24, 40],
        [42, 30],
        [49, 35],
        [47, 47],
        [27, 51],
      ],
      GREY,
      0.12,
      true,
    );
    fill(
      [
        [59, 35],
        [66, 30],
        [84, 40],
        [81, 51],
        [61, 47],
      ],
      GREY,
      -0.1,
      true,
    );
    line(c, 24, 41, 42, 31, C.e5);
    line(c, 66, 31, 84, 41, C.e4);
    line(c, 27, 51, 47, 47, C.e3);
    line(c, 61, 47, 81, 51, C.e2);
    diamond(31, 45);
    diamond(77, 45);
    blob(c, 28, 56, 6, 7, WHITE, { seed: 4, noise: 0.04, bright: 0.12, edgeDark: 0.2 });
    blob(c, 80, 56, 6, 7, WHITE, { seed: 5, noise: 0.04, bright: -0.08, edgeDark: 0.22 });
    // ── forearms in dark bracers with gold studs, bare hands
    fill(
      [
        [22, 60],
        [33, 60],
        [32, 78],
        [23, 78],
      ],
      GREY,
      0.08,
      true,
    );
    fill(
      [
        [75, 60],
        [86, 60],
        [85, 78],
        [76, 78],
      ],
      GREY,
      -0.1,
      true,
    );
    line(c, 22, 62, 33, 62, C.e5);
    line(c, 75, 62, 86, 62, C.e4);
    diamond(27, 70);
    diamond(81, 70);
    blob(c, 27, 82, 3, 3.6, SKIN, { seed: 7, noise: 0.04, edgeDark: 0.22 });
    blob(c, 81, 82, 3, 3.6, SKIN, { seed: 8, noise: 0.04, edgeDark: 0.22 });
    // ── the great scarf: two fat coils at the neck, one long tail down the chest
    blob(c, 54, 35, 19, 6.5, RED, { seed: 9, noise: 0.08, bright: 0.04, edgeDark: 0.22 });
    blob(c, 54, 32, 13, 5.5, RED, { seed: 10, noise: 0.08, bright: 0.18, edgeDark: 0.2 });
    fill(
      [
        [40, 36],
        [50, 38],
        [48, 66],
        [39, 62],
      ],
      RED,
      0.12,
      true,
    );
    line(c, 44, 40, 43, 62, C.c0);
    line(c, 41, 38, 41, 58, C.c3);
    put(c, 38, 64, C.c4, 7, 1);
    put(c, 38, 65, C.c0, 7, 1);
    // ── head: lean jaw, dark swept hair, brows, eyes, nose and a calm mouth
    fill(
      [
        [46, 18],
        [62, 18],
        [61, 29],
        [57, 33],
        [51, 33],
        [47, 29],
      ],
      SKIN,
      0.1,
    );
    fill(
      [
        [45, 15],
        [49, 17],
        [48, 27],
        [45, 23],
      ],
      [C.ink, C.e0, C.e1],
    );
    fill(
      [
        [63, 15],
        [63, 23],
        [60, 27],
        [59, 17],
      ],
      [C.ink, C.e0, C.e1],
    );
    put(c, 48, 22, C.e1, 4, 1);
    put(c, 56, 22, C.e1, 4, 1);
    put(c, 49, 24, C.ink, 3, 1);
    put(c, 57, 24, C.ink, 3, 1);
    put(c, 50, 24, C.white);
    put(c, 58, 24, C.white);
    put(c, 53, 25, C.e3, 2, 4);
    put(c, 52, 29, C.e2, 4, 1);
    line(c, 51, 31, 57, 31, C.e1);
    // ── tricorn: broad brim dipping at the right, lifted at the left, a tall crown and a tan band
    fill(
      [
        [28, 17],
        [40, 12],
        [54, 15],
        [72, 11],
        [82, 16],
        [72, 22],
        [54, 22],
        [40, 21],
      ],
      [C.ink, C.e0, C.e1, C.e2],
      0,
      true,
    );
    line(c, 30, 17, 40, 13, C.e2);
    line(c, 56, 15, 72, 12, C.e1);
    fill(
      [
        [44, 16],
        [45, 3],
        [54, 1],
        [63, 3],
        [65, 16],
      ],
      [C.ink, C.e0, C.e1, C.e2],
      0.06,
      true,
    );
    line(c, 44, 15, 65, 15, C.e4);
    line(c, 45, 16, 64, 16, C.e3);
    put(c, 48, 14, C.c4, 3, 2);
    line(c, 47, 4, 54, 2, C.e2);
    line(c, 54, 2, 62, 4, C.e2);
    // ── the teal plume sweeping up and back from the hat
    fill(
      [
        [44, 8],
        [34, -1],
        [22, -6],
        [18, 1],
        [28, 8],
        [38, 14],
      ],
      TEAL,
      0.1,
    );
    fill(
      [
        [40, 8],
        [30, 3],
        [21, -3],
        [25, 4],
        [33, 10],
      ],
      [C.w3, C.t2, C.w6, C.q7],
    );
    line(c, 44, 8, 20, -5, C.white);
    line(c, 38, 10, 27, 4, C.w7);
    qubitMan = canvas;
  }
  ctx.drawImage(qubitMan, 0, 0);
}

// ───────────────────────── the Statue of QubitMan ─────────────────────────
function statueFrame(f: number): ObjSprite {
  // A projected stone plinth and a sculpted hero, both seated on the same ground plane.
  const W = 156,
    H = 240,
    AX = 78,
    AY = 202; // retain ground anchor, leave room under the lowest plinth edge
  const FX = AX - 52,
    FY = AY - PLINTH.top - 112; // figure offset (feet at y≈112 in its own frame)
  const brazier = (ctx: Ctx, u: number, v: number) => {
    const I = new Iso(ctx, AX, AY - 8);
    I.cyl(u, v, PLINTH.z2, 2.6, 1.2, BRONZE, BRONZE);
    I.cyl(u, v, PLINTH.z2 + 1.2, 0.8, 5, BRONZE, BRONZE);
    I.cyl(u, v, PLINTH.z2 + 6.2, 3.2, 2.6, [C.e0, C.e1, C.r0, C.r1, C.e2], [C.ink, C.r0, C.r1]);
  };
  const corners: Array<[number, number]> = [
    [8 - 28.5, 8 + 28.5],
    [8 + 28.5, 8 - 28.5],
    [8 + 28.5, 8 + 28.5],
  ];
  return make(
    W,
    H,
    AX,
    AY,
    (ctx) => {
      statuePlinth(ctx, AX, AY, f);
      for (const [u, v] of corners) brazier(ctx, u, v);
      ctx.save();
      ctx.translate(FX, FY);
      drawStoneGuardian(ctx);
      ctx.restore();
    },
    (ctx) => {
      statueInscription(ctx, AX, AY, ['ALL HAIL', 'QUBITMAN'], pixelText);
      // brazier flames and their sparks
      const I = new Iso(ctx, AX, AY - 8);
      corners.forEach(([u, v], k) => {
        const x = Math.round(I.X(u, v)),
          y = Math.round(I.Y(u, v, PLINTH.z2 + 8.8));
        const h = 7 + ((f + k) % 3);
        for (let j = 0; j < h; j++) {
          const w = Math.max(0, Math.round(Math.min(3, (h - j) * 0.45)));
          const sway = j > 3 ? ((f + k + (j >> 1)) % 3) - 1 : 0;
          for (let i = -w; i <= w; i++) {
            const edge = Math.abs(i) === w;
            put(
              ctx,
              x + i + sway,
              y - j,
              edge ? C.r4 : j < 2 ? C.r6 : Math.abs(i) <= w - 2 || w < 2 ? (j < h - 3 ? C.white : C.e7) : C.r7,
            );
          }
        }
        put(ctx, x + ((f * 3 + k) % 5) - 2, y - h - 2 - (f % 2), C.e7);
        put(ctx, x - ((f + k) % 3) + 1, y - h - 5, C.r6);
      });
      ctx.save();
      ctx.translate(FX, FY);
      // emissive bits after the outline: the plume glimmers and a spark drifts off its tip
      const pulse = [0, 1, 2, 1][f]!;
      put(ctx, 28 + pulse, 3, C.white);
      put(ctx, 33, 8 - pulse, C.q7);
      put(ctx, 38 - pulse, 12, C.w7);
      put(ctx, 24 + ((f * 3) % 7), -2 + (f % 2), C.q7);
      const rng = mulberry32(100 + f);
      for (let i = 0; i < 3; i++) {
        const x = Math.round(20 + rng() * 22),
          y = Math.round(-4 + rng() * 14);
        if (x >= 1 && y >= 1) put(ctx, x, y, [C.q7, C.white, C.q6][(i + f) % 3]!);
      }
      ctx.restore();
      // runes orbiting the plinth: behind the statue they dim, in front they burn
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 6.283 + f * 0.26;
        const x = AX + Math.cos(a) * 58,
          y = AY - 30 + Math.sin(a) * 16;
        const front = Math.sin(a) > 0;
        put(ctx, Math.round(x), Math.round(y), front ? C.q7 : C.q3);
        put(ctx, Math.round(x) + 1, Math.round(y) - 1, front ? C.q5 : C.q2);
        if (front) put(ctx, Math.round(x) - 1, Math.round(y) + 1, C.q4);
      }
    },
    { ao: false },
  );
}

const frames = (n: number, mk: (f: number) => ObjSprite): ObjSprite[] => Array.from({ length: n }, (_, f) => mk(f));

/** Town pieces by `sub` (deco/sign/furniture). Each call builds fresh textures; callers cache. */
export const TOWN_DECO: Record<string, () => ObjSpriteDef> = {
  dive_gate: () => ({
    frames: [
      make(48, 64, 24, 52, (ctx) => {
        const I = new Iso(ctx, 24, 44),
          bronze = mat([C.e1, C.e2, C.e3, C.e5, C.e6]);
        I.box(2, 2, 0, 12, 12, 3, bronze);
        I.box(5, 5, 3, 6, 6, 12, bronze);
        I.box(4, 4, 15, 8, 8, 3, mat([C.w1, C.w3, C.w5, C.q7]));
        I.dot(8, 12, 13, C.q7, 3);
        I.dot(8, 12, 7, C.e6, 2);
      }),
    ],
    fps: 0,
  }),
  dive_exit: () => ({
    frames: [
      make(48, 48, 24, 38, (ctx) => {
        const I = new Iso(ctx, 24, 30),
          metal = mat([C.e1, C.e2, C.e3, C.e5, C.e6]);
        I.box(1, 1, 0, 14, 14, 2, metal);
        I.box(4, 4, 2, 8, 8, 1, mat([C.night, C.w1, C.w3]));
        for (const u of [4, 12]) I.box(u, 11, 2, 1, 1, 15, metal);
        for (let z = 3; z < 18; z += 3) I.box(4, 11, z, 9, 1, 1, metal);
      }),
    ],
    fps: 0,
  }),
  coral_column: () => ({
    frames: [
      make(56, 64, 28, 52, (ctx) => {
        const I = new Iso(ctx, 28, 44),
          stone = mat([C.w0, C.w1, C.w2, C.w3, C.w5]);
        I.box(1, 1, 0, 14, 14, 4, stone);
        I.box(4, 4, 4, 8, 8, 24, stone);
        I.box(2, 2, 28, 12, 12, 3, stone);
        for (const [u, v, z] of [
          [2, 12, 4],
          [11, 3, 8],
          [3, 5, 18],
        ]) {
          I.box(u!, v!, z!, 2, 2, 7, mat([C.r1, C.r2, C.r3, C.r5]));
          I.dot(u! + 1, v! + 1, z! + 8, C.q7, 2);
        }
      }),
    ],
    fps: 0,
  }),
  stairs_up: () => ({
    frames: [
      make(64, 64, 32, 48, (ctx) => {
        const I = new Iso(ctx, 32, 40),
          wood: Ramp = [C.e0, C.e1, C.e2, C.e4, C.e5];
        for (let i = 4; i >= 0; i--) {
          const v = 12 - i * 2.5,
            z = 3 + i * 3;
          I.box(2, v, 0, 12, 2.5, z, mat(wood));
          I.box(2, v + 2, z, 12, 0.5, 0.5, mat([C.e3, C.e4, C.e5, C.e6]));
        }
        for (const i of [4, 2, 0]) I.box(1, 12 - i * 2.5, 0, 1, 1, 10 + i * 3, mat(wood));
        line(ctx, I.X(1, 2), I.Y(1, 2, 22), I.X(1, 12), I.Y(1, 12, 10), C.e4);
      }),
    ],
    fps: 0,
  }),
  stairs_down: () => ({
    frames: [
      make(
        48,
        40,
        24,
        26,
        (ctx) => {
          const I = new Iso(ctx, 24, 18);
          I.box(1, 1, 0, 14, 14, 1, mat([C.e0, C.e1, C.e2, C.e4]));
          I.box(3, 3, 1, 10, 10, 0.5, mat([C.ink, C.night]));
          for (let i = 0; i < 4; i++) I.box(3, 3 + i * 2.5, 1.5, 10, 1, 0.5, mat([C.e0, C.e1, C.e2, C.e3]));
        },
        undefined,
        { ao: false },
      ),
    ],
    fps: 0,
  }),
  sea_cache: () => ({
    frames: [
      make(
        40,
        40,
        20,
        32,
        (ctx) => {
          const I = new Iso(ctx, 20, 24),
            wood: Ramp = [C.e0, C.e1, C.e2, C.e3, C.e5];
          I.box(1, 4, 0, 15, 7, 2, mat(wood));
          I.box(4, 4, 2, 9, 8, 5, mat(wood));
          I.box(3.5, 3.5, 7, 10, 9, 1.5, mat([C.e2, C.e3, C.e4, C.e5, C.e6]));
          for (const u of [5, 11]) I.box(u, 3.5, 7.9, 0.8, 9, 0.7, mat([C.steel, C.mist, C.fog, C.pale]));
          I.dot(8, 12.3, 5, C.e6, 2);
          const p = [I.X(1, 7), I.Y(1, 7, 3)];
          line(ctx, p[0], p[1], p[0], p[1] - 11, C.e4);
          poly(
            ctx,
            [
              [p[0], p[1] - 11],
              [p[0] + 5, p[1] - 10],
              [p[0] + 4, p[1] - 7],
              [p[0], p[1] - 8],
            ],
            C.w6,
          );
        },
        undefined,
        { ao: false },
      ),
    ],
    fps: 0,
  }),
  statue: () => ({ frames: frames(4, statueFrame), fps: 4 }),
};
