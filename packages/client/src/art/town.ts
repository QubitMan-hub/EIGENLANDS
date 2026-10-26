/**
 * The Statue of QubitMan, Hadamere's plaza centrepiece: a stepped iso plinth (props.ts) with braziers and runes, and
 * a carved adventurer beneath a floating qubit. The other town props live in props.ts.
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
  undithered,
  type Ctx,
  type Ramp,
} from './shade';
import { Iso, mat } from './isokit';
import { PLINTH, statueInscription, statuePlinth } from './props';

const BRONZE: Ramp = [C.e1, C.r0, C.r1, C.r4, C.r5, C.r6];
const ORB: Ramp = [C.q2, C.q3, C.q7, C.w7, C.white];

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

/** Original three-quarter adventurer sculpture: coat, tricorn, scarf and star.
 * References inform tailoring and stance, not traced pixels. Both boots meet
 * the existing plinth; stone planes are lit from the same upper-left source. */
let stoneGuardian: HTMLCanvasElement | null = null;
function drawStoneGuardian(ctx: Ctx): void {
  if (!stoneGuardian) {
    const { canvas, ctx: c } = makeCanvas(108, 128);
    const shape = (pts: Array<[number, number]>, colour: number) => poly(c, pts, colour);
    const dark = C.g0,
      shadow = C.slate,
      stone = C.steel,
      mid = C.mist,
      light = C.fog;
    const bronze = C.e3,
      gold = C.e5;
    // Rear cape and split coat tails leave space around both legs.
    shape(
      [
        [41, 42],
        [58, 41],
        [68, 49],
        [69, 78],
        [80, 106],
        [69, 110],
        [55, 96],
        [35, 108],
        [26, 102],
        [36, 73],
      ],
      dark,
    );
    shape(
      [
        [63, 50],
        [68, 55],
        [66, 78],
        [76, 103],
        [70, 103],
        [59, 82],
      ],
      shadow,
    );
    // Trousers and two planted boots in a three-quarter stance.
    shape(
      [
        [43, 74],
        [53, 75],
        [51, 94],
        [46, 108],
        [37, 107],
        [41, 92],
      ],
      shadow,
    );
    shape(
      [
        [53, 75],
        [62, 72],
        [64, 92],
        [69, 108],
        [61, 111],
        [54, 94],
      ],
      dark,
    );
    shape(
      [
        [43, 81],
        [47, 83],
        [45, 97],
        [41, 106],
        [38, 105],
      ],
      stone,
    );
    shape(
      [
        [57, 83],
        [60, 81],
        [62, 96],
        [66, 106],
        [63, 107],
      ],
      shadow,
    );
    shape(
      [
        [37, 105],
        [46, 106],
        [47, 111],
        [39, 114],
        [29, 111],
        [30, 108],
      ],
      dark,
    );
    shape(
      [
        [60, 106],
        [68, 106],
        [75, 111],
        [73, 115],
        [62, 114],
        [58, 111],
      ],
      dark,
    );
    line(c, 31, 109, 40, 111, stone);
    line(c, 63, 111, 71, 112, shadow);
    // Sculpted waistcoat and tailored lapels.
    shape(
      [
        [42, 43],
        [51, 40],
        [62, 45],
        [65, 61],
        [60, 78],
        [46, 81],
        [38, 65],
      ],
      stone,
    );
    shape(
      [
        [43, 48],
        [51, 46],
        [55, 65],
        [49, 78],
        [41, 72],
      ],
      mid,
    );
    shape(
      [
        [55, 47],
        [61, 48],
        [62, 65],
        [57, 75],
        [53, 65],
      ],
      shadow,
    );
    shape(
      [
        [40, 50],
        [48, 52],
        [49, 65],
        [40, 91],
        [33, 100],
        [36, 76],
      ],
      shadow,
    );
    shape(
      [
        [57, 51],
        [63, 49],
        [61, 73],
        [70, 101],
        [62, 98],
        [51, 77],
      ],
      dark,
    );
    line(c, 40, 63, 35, 95, bronze);
    line(c, 58, 72, 67, 98, bronze);
    shape(
      [
        [44, 53],
        [49, 55],
        [46, 62],
        [49, 66],
        [43, 73],
      ],
      light,
    );
    shape(
      [
        [57, 52],
        [60, 55],
        [55, 63],
        [57, 68],
        [52, 72],
      ],
      stone,
    );
    // Belts wrap diagonally around the turned torso.
    shape(
      [
        [41, 70],
        [59, 66],
        [61, 70],
        [42, 75],
      ],
      dark,
    );
    shape(
      [
        [48, 69],
        [54, 68],
        [55, 73],
        [49, 74],
      ],
      bronze,
    );
    put(c, 50, 70, gold, 3, 2);
    // Far sleeve, then nearer sleeve with angular shoulder armour and cuff.
    shape(
      [
        [61, 47],
        [68, 50],
        [70, 65],
        [75, 80],
        [70, 84],
        [63, 67],
      ],
      dark,
    );
    shape(
      [
        [63, 48],
        [71, 47],
        [75, 54],
        [66, 58],
        [60, 53],
      ],
      shadow,
    );
    line(c, 64, 49, 71, 49, mid);
    shape(
      [
        [69, 76],
        [75, 76],
        [77, 82],
        [72, 86],
        [68, 82],
      ],
      stone,
    );
    line(c, 71, 80, 74, 82, light);
    shape(
      [
        [39, 46],
        [43, 53],
        [37, 66],
        [31, 77],
        [25, 74],
        [30, 60],
      ],
      stone,
    );
    shape(
      [
        [37, 46],
        [43, 48],
        [40, 55],
        [30, 58],
        [29, 54],
      ],
      mid,
    );
    line(c, 31, 53, 39, 48, light);
    shape(
      [
        [26, 72],
        [32, 75],
        [29, 81],
        [23, 80],
        [22, 76],
      ],
      shadow,
    );
    shape(
      [
        [24, 79],
        [29, 80],
        [28, 86],
        [24, 88],
        [21, 85],
        [21, 82],
      ],
      mid,
    );
    put(c, 23, 83, light, 1, 3);
    // A planted walking staff, separate from the legs and coat.
    line(c, 23, 84, 20, 111, dark);
    line(c, 24, 85, 21, 110, bronze);
    // Neck and a turned face with cheek, nose and one readable eye.
    shape(
      [
        [47, 33],
        [56, 34],
        [57, 43],
        [51, 47],
        [45, 42],
      ],
      shadow,
    );
    shape(
      [
        [45, 23],
        [53, 20],
        [59, 24],
        [59, 30],
        [63, 33],
        [59, 35],
        [58, 39],
        [53, 43],
        [47, 39],
        [44, 32],
      ],
      stone,
    );
    shape(
      [
        [49, 25],
        [55, 24],
        [57, 29],
        [56, 33],
        [60, 33],
        [56, 36],
        [55, 39],
        [51, 39],
        [48, 34],
      ],
      light,
    );
    line(c, 53, 29, 57, 29, dark);
    put(c, 57, 30, dark);
    line(c, 55, 37, 58, 36, shadow);
    // Swept hair beneath an asymmetric, sculpted tricorn brim.
    shape(
      [
        [43, 25],
        [45, 21],
        [51, 20],
        [49, 27],
        [47, 32],
        [47, 38],
        [44, 35],
        [42, 29],
      ],
      dark,
    );
    line(c, 45, 25, 44, 32, shadow);
    shape(
      [
        [33, 24],
        [41, 16],
        [47, 15],
        [54, 7],
        [60, 14],
        [67, 12],
        [65, 24],
        [57, 28],
        [46, 26],
        [38, 29],
      ],
      dark,
    );
    shape(
      [
        [35, 23],
        [45, 20],
        [53, 11],
        [55, 17],
        [64, 15],
        [60, 23],
        [48, 23],
        [39, 27],
      ],
      shadow,
    );
    line(c, 36, 24, 46, 22, stone);
    line(c, 46, 22, 53, 13, mid);
    line(c, 55, 24, 63, 21, stone);
    put(c, 42, 19, bronze, 2, 2);
    // Carved scarf winds around the collar, a restrained oxblood inlay.
    shape(
      [
        [44, 38],
        [51, 41],
        [59, 37],
        [65, 40],
        [62, 47],
        [52, 51],
        [41, 48],
        [37, 44],
      ],
      C.r0,
    );
    shape(
      [
        [40, 42],
        [48, 44],
        [58, 42],
        [62, 40],
        [60, 45],
        [49, 48],
        [41, 46],
      ],
      C.r1,
    );
    line(c, 42, 44, 49, 46, C.e2);
    shape(
      [
        [59, 45],
        [66, 47],
        [63, 57],
        [59, 63],
        [58, 55],
      ],
      C.r0,
    );
    // Star medal and two belt seals: original heraldic silhouette.
    shape(
      [
        [52, 51],
        [54, 54],
        [59, 55],
        [55, 58],
        [55, 63],
        [52, 60],
        [48, 62],
        [49, 58],
        [46, 55],
        [51, 54],
      ],
      bronze,
    );
    line(c, 52, 53, 52, 58, gold);
    put(c, 52, 55, C.e6, 2, 2);
    for (const [x, y] of [
      [39, 72],
      [37, 79],
    ]) {
      shape(
        [
          [x, y - 2],
          [x + 3, y - 1],
          [x + 4, y + 2],
          [x + 1, y + 4],
          [x - 2, y + 2],
          [x - 2, y],
        ],
        bronze,
      );
      put(c, x, y, gold, 2, 2);
    }
    // A few deliberate chips follow carved folds, never random speckle.
    line(c, 35, 91, 38, 88, dark);
    line(c, 64, 95, 67, 98, stone);
    stoneGuardian = canvas;
  }
  ctx.drawImage(stoneGuardian, 0, 0);
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
      // emissive bits after the outline: chest emblem (a tiny Bloch circle) and the glowing orb
      const pulse = [0, 1, 2, 1][f]!;
      const ox = 73,
        oy = 8;
      blob(ctx, ox, oy, 6 + pulse * 0.35, 6 + pulse * 0.35, ORB, {
        seed: 30 + f,
        noise: 0.05,
        bright: -0.12 + pulse * 0.06,
        edgeDark: 0.12,
      });
      put(ctx, ox - 3, oy - 3, C.white, 2, 1);
      put(ctx, ox - 3, oy - 2, C.white);
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * 6.283;
        const x = ox + Math.cos(a) * 11,
          y = oy + Math.sin(a) * 3 - Math.cos(a) * 2;
        const front = Math.sin(a) > 0;
        if (front || Math.hypot(x - ox, y - oy) > 6.5) put(ctx, Math.round(x), Math.round(y), front ? C.q4 : C.q2);
      }
      const ma = (f / 4) * 6.283;
      put(
        ctx,
        Math.round(ox + Math.cos(ma) * 11) - 1,
        Math.round(oy + Math.sin(ma) * 3 - Math.cos(ma) * 2) - 1,
        C.q6,
        2,
        2,
      );
      const rng = mulberry32(100 + f);
      for (let i = 0; i < 5; i++) {
        const x = Math.round(ox - 13 + rng() * 26),
          y = Math.round(oy - 7 + rng() * 18);
        const c = [C.q7, C.q6, C.white, C.q4][(i + f) % 4]!;
        if (x >= 1 && y >= 1) {
          put(ctx, x, y, c);
          if (i % 2 === 0) {
            put(ctx, x - 1, y, C.q3);
            put(ctx, x + 1, y, C.q3);
            put(ctx, x, y - 1, C.q3);
            put(ctx, x, y + 1, C.q3);
          }
        }
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
