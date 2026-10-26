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

const QM_W = 120,
  QM_H = 160;
/** QubitMan himself, cast in painted bronze: a wide hat with a glowing teal plume, a heavy red scarf, a long dark coat
 * over a crimson waistcoat, white puffed sleeves, gold studs and a gold scroll case at the hip. Drawn in a 108x128 frame
 * with the feet at y=114, facing the viewer. */
let qubitMan: HTMLCanvasElement | null = null;
function drawStoneGuardian(ctx: Ctx): void {
  if (!qubitMan) {
    const { canvas, ctx: c } = makeCanvas(QM_W, QM_H);
    // light from the upper left: every ramp runs light -> dark across a shape, a little darker toward its foot
    const fill = (pts: Array<[number, number]>, ramp: Ramp, bias = 0) => {
      const xs = pts.map((p) => p[0]),
        ys = pts.map((p) => p[1]);
      const x0 = Math.min(...xs),
        x1 = Math.max(...xs),
        y0 = Math.min(...ys),
        y1 = Math.max(...ys);
      poly(c, pts, (x, y) =>
        rampAt(
          ramp,
          Math.max(
            0.04,
            Math.min(
              0.96,
              0.78 + bias - ((x - x0) / Math.max(1, x1 - x0)) * 0.5 - ((y - y0) / Math.max(1, y1 - y0)) * 0.16,
            ),
          ),
          x,
          y,
        ),
      );
    };
    const COAT: Ramp = [C.ink, C.night, C.e0, C.e1, C.e2];
    const MANTLE: Ramp = [C.ink, C.e0, C.e1, C.e2, C.e3];
    const TRIM: Ramp = [C.e2, C.e3, C.e4, C.e5];
    const RED: Ramp = [C.c0, C.c0, C.c1, C.c2, C.r3];
    const SCARF: Ramp = [C.c0, C.c1, C.c1, C.c2, C.r3];
    const WHITE: Ramp = [C.mist, C.fog, C.pale, C.white, C.white];
    const NAVY: Ramp = [C.ink, C.w0, C.w1, C.b0];
    const BOOT: Ramp = [C.ink, C.e0, C.e1, C.r0];
    const SKIN: Ramp = [C.e2, C.e3, C.e4, C.e5, C.e6];
    const HAIR: Ramp = [C.ink, C.night, C.e0, C.e1];
    const TEAL: Ramp = [C.t0, C.t1, C.t2, C.w6, C.q7];
    const gem = (x: number, y: number, big = false) => {
      put(c, x, y - 2, C.c4);
      put(c, x - 1, y - 1, C.c4, 3, 1);
      put(c, x - 2, y, C.c3, 5, 1);
      put(c, x - 1, y + 1, C.c3, 3, 1);
      put(c, x, y + 2, C.e3);
      put(c, x - 1, y, C.e7, 2, 1);
      if (big) {
        put(c, x - 3, y, C.c3);
        put(c, x + 3, y, C.e3);
      }
    };
    const edge = (pts: Array<[number, number]>, col: number) => {
      for (let i = 0; i < pts.length - 1; i++) line(c, pts[i]![0], pts[i]![1], pts[i + 1]![0], pts[i + 1]![1], col);
    };

    // ── coat tails behind the legs, flaring out to points at both sides
    fill(
      [
        [38, 60],
        [82, 60],
        [86, 96],
        [100, 140],
        [86, 146],
        [60, 140],
        [34, 146],
        [20, 140],
        [34, 96],
      ],
      COAT,
      -0.08,
    );
    edge(
      [
        [34, 96],
        [20, 140],
        [34, 146],
      ],
      C.e3,
    );
    edge(
      [
        [86, 96],
        [100, 140],
        [86, 146],
      ],
      C.e2,
    );
    gem(30, 138);
    gem(92, 138);
    // ── navy trousers into heavy boots with turned-down cuffs and gold knee plates; toes turned out
    fill(
      [
        [48, 100],
        [59, 100],
        [58, 132],
        [47, 132],
      ],
      NAVY,
      0.05,
    );
    fill(
      [
        [62, 100],
        [73, 100],
        [74, 132],
        [63, 132],
      ],
      NAVY,
      -0.1,
    );
    fill(
      [
        [44, 128],
        [60, 128],
        [60, 148],
        [58, 154],
        [38, 156],
        [34, 152],
        [44, 146],
      ],
      BOOT,
      0.05,
    );
    fill(
      [
        [61, 128],
        [77, 128],
        [77, 146],
        [88, 152],
        [84, 156],
        [64, 154],
        [61, 148],
      ],
      BOOT,
      -0.1,
    );
    fill(
      [
        [43, 126],
        [61, 126],
        [61, 131],
        [43, 131],
      ],
      [C.e0, C.e1, C.e2, C.e3],
    );
    fill(
      [
        [60, 126],
        [78, 126],
        [78, 131],
        [60, 131],
      ],
      [C.e0, C.e1, C.e2, C.e2],
    );
    gem(52, 136, true);
    gem(69, 136, true);
    line(c, 38, 155, 58, 153, C.e1);
    line(c, 64, 153, 84, 155, C.e0);
    // ── the long crimson tabard falling from the belt to a point at the knee, edged in tan
    fill(
      [
        [49, 90],
        [72, 90],
        [70, 112],
        [61, 124],
        [51, 112],
      ],
      RED,
      0.04,
    );
    edge(
      [
        [49, 92],
        [51, 112],
        [61, 124],
        [70, 112],
        [72, 92],
      ],
      C.e4,
    );
    line(c, 61, 94, 61, 121, C.c0);
    // ── coat fronts: heavy dark panels from the waist, tan piping, a gold plate at each lower corner
    fill(
      [
        [36, 62],
        [48, 66],
        [49, 92],
        [46, 120],
        [40, 132],
        [30, 128],
        [34, 96],
      ],
      COAT,
      0.08,
    );
    fill(
      [
        [73, 66],
        [84, 62],
        [86, 96],
        [90, 128],
        [80, 132],
        [74, 120],
        [72, 92],
      ],
      COAT,
      -0.12,
    );
    edge(
      [
        [48, 66],
        [49, 92],
        [46, 120],
        [40, 132],
      ],
      C.e5,
    );
    edge(
      [
        [73, 66],
        [72, 92],
        [74, 120],
        [80, 132],
      ],
      C.e3,
    );
    gem(42, 126);
    gem(79, 126);
    // ── the crimson waistcoat with a darker centre seam
    fill(
      [
        [47, 50],
        [73, 50],
        [74, 90],
        [47, 90],
      ],
      RED,
      0.06,
    );
    line(c, 60, 56, 60, 89, C.c0);
    line(c, 48, 52, 48, 88, C.e3);
    line(c, 72, 52, 73, 88, C.e2);
    // ── belt and buckle
    fill(
      [
        [44, 84],
        [77, 84],
        [77, 90],
        [44, 90],
      ],
      [C.ink, C.e0, C.e1, C.e2],
    );
    line(c, 44, 84, 77, 84, C.e3);
    put(c, 57, 84, C.c4, 7, 6);
    put(c, 58, 85, C.e7, 5, 1);
    put(c, 59, 86, C.e1, 3, 3);
    // ── two gold coins hanging from a cord at the right hip (viewer's left), glinting
    line(c, 46, 88, 42, 96, C.e4);
    blob(c, 40, 100, 4.6, 4.6, [C.e3, C.c3, C.c4, C.e6, C.e7], { seed: 3, noise: 0, bright: 0.1, edgeDark: 0.3 });
    blob(c, 43, 110, 4.6, 4.6, [C.e3, C.c3, C.c4, C.e6, C.e7], { seed: 4, noise: 0, bright: 0, edgeDark: 0.3 });
    for (const [x, y] of [
      [40, 100],
      [43, 110],
    ] as const) {
      put(c, x - 1, y - 2, C.e3, 3, 1);
      put(c, x - 2, y - 1, C.e3);
      put(c, x + 2, y + 1, C.e3);
      put(c, x - 1, y + 2, C.e3, 3, 1);
      put(c, x - 1, y - 1, C.e7);
    }
    // ── long arms: white upper sleeves, dark bracers with gold bands, bare hands hanging at the thigh
    fill(
      [
        [26, 58],
        [40, 56],
        [42, 82],
        [27, 84],
      ],
      WHITE,
      0.1,
    );
    fill(
      [
        [80, 56],
        [94, 58],
        [93, 84],
        [78, 82],
      ],
      WHITE,
      -0.12,
    );
    line(c, 33, 62, 34, 80, C.fog);
    line(c, 87, 62, 86, 80, C.mist);
    fill(
      [
        [25, 82],
        [40, 80],
        [39, 104],
        [26, 104],
      ],
      MANTLE,
      0.1,
    );
    fill(
      [
        [80, 80],
        [95, 82],
        [94, 104],
        [81, 104],
      ],
      MANTLE,
      -0.12,
    );
    for (const y of [84, 101]) {
      line(c, 25, y, 40, y - 1, C.e4);
      line(c, 80, y - 1, 95, y, C.e3);
    }
    gem(32, 92);
    gem(88, 92);
    fill(
      [
        [27, 104],
        [38, 104],
        [39, 112],
        [35, 117],
        [29, 116],
        [26, 110],
      ],
      SKIN,
      0.1,
    );
    fill(
      [
        [82, 104],
        [93, 104],
        [94, 110],
        [91, 116],
        [85, 117],
        [81, 112],
      ],
      SKIN,
      -0.1,
    );
    line(c, 30, 112, 30, 116, C.e2);
    line(c, 33, 113, 33, 117, C.e2);
    line(c, 87, 112, 87, 116, C.e2);
    line(c, 90, 113, 90, 116, C.e2);
    // ── broad shoulder mantle draping into points over the upper arms, tan-edged, with gold studs
    fill(
      [
        [22, 52],
        [46, 40],
        [54, 46],
        [50, 60],
        [40, 62],
        [24, 66],
      ],
      MANTLE,
      0.12,
    );
    fill(
      [
        [66, 46],
        [74, 40],
        [98, 52],
        [96, 66],
        [80, 62],
        [70, 60],
      ],
      MANTLE,
      -0.12,
    );
    edge(
      [
        [22, 52],
        [24, 66],
        [40, 62],
        [50, 60],
      ],
      C.e4,
    );
    edge(
      [
        [98, 52],
        [96, 66],
        [80, 62],
        [70, 60],
      ],
      C.e3,
    );
    line(c, 23, 52, 46, 41, C.e3);
    line(c, 74, 41, 97, 52, C.e2);
    gem(30, 58);
    gem(90, 58);
    // ── the great scarf: a heavy coil at the throat and one long end down the chest
    blob(c, 60, 46, 20, 7.5, SCARF, { seed: 9, noise: 0.08, bright: 0.02, edgeDark: 0.25 });
    blob(c, 59, 42, 15, 6, SCARF, { seed: 10, noise: 0.08, bright: 0.14, edgeDark: 0.22 });
    fill(
      [
        [46, 46],
        [57, 49],
        [56, 78],
        [50, 82],
        [45, 74],
      ],
      SCARF,
      0.12,
    );
    line(c, 51, 52, 50, 78, C.c0);
    line(c, 47, 50, 46, 72, C.r3);
    for (let i = 0; i < 4; i++) put(c, 46 + i * 3, 80 + (i % 2), C.c0, 1, 3);
    // a tan star brooch at the breastbone
    put(c, 64, 54, C.e5, 1, 7);
    put(c, 61, 57, C.e5, 7, 1);
    put(c, 63, 56, C.e6, 3, 3);
    put(c, 64, 57, C.e7);
    // ── head: long face, square jaw, black hair swept off the brow, dark eyes, straight nose, a faint smile
    fill(
      [
        [51, 22],
        [69, 22],
        [69, 34],
        [65, 41],
        [56, 41],
        [51, 34],
      ],
      SKIN,
      0.12,
    );
    fill(
      [
        [49, 18],
        [56, 20],
        [53, 30],
        [50, 36],
        [48, 28],
      ],
      HAIR,
      0.1,
    );
    fill(
      [
        [63, 20],
        [71, 18],
        [72, 28],
        [70, 36],
        [68, 26],
      ],
      HAIR,
      -0.05,
    );
    fill(
      [
        [51, 21],
        [62, 20],
        [56, 25],
        [52, 26],
      ],
      HAIR,
      0.1,
    );
    put(c, 54, 27, C.e1, 4, 1);
    put(c, 62, 27, C.e1, 4, 1);
    put(c, 55, 29, C.ink, 2, 2);
    put(c, 63, 29, C.ink, 2, 2);
    put(c, 55, 29, C.pale);
    put(c, 63, 29, C.pale);
    put(c, 59, 29, C.e3, 2, 5);
    put(c, 58, 34, C.e2, 4, 1);
    line(c, 56, 37, 63, 37, C.e1);
    put(c, 63, 36, C.e1);
    line(c, 66, 32, 66, 38, C.e3);
    // ── wide hat: brim swept up at the left and dipping at the right, a dented crown and a tan band
    fill(
      [
        [34, 22],
        [44, 15],
        [60, 17],
        [80, 12],
        [90, 17],
        [80, 23],
        [60, 24],
        [44, 25],
      ],
      [C.ink, C.night, C.e0, C.e1],
      0.04,
    );
    line(c, 36, 22, 44, 16, C.e2);
    line(c, 62, 17, 80, 13, C.e1);
    fill(
      [
        [49, 18],
        [50, 4],
        [58, 7],
        [64, 2],
        [72, 5],
        [73, 18],
      ],
      [C.ink, C.night, C.e0, C.e1],
      0.08,
    );
    line(c, 49, 17, 73, 17, C.e4);
    line(c, 50, 18, 73, 18, C.e3);
    put(c, 52, 16, C.c4, 2, 2);
    // ── a soft glowing teal plume rising behind the crown at the left
    blob(c, 44, 8, 8, 6.5, TEAL, { seed: 13, noise: 0.15, bright: 0.2, edgeDark: 0.1 });
    blob(c, 38, 3, 6, 5, TEAL, { seed: 14, noise: 0.18, bright: 0.3, edgeDark: 0.08 });
    blob(c, 48, 12, 5, 4, TEAL, { seed: 15, noise: 0.15, bright: 0, edgeDark: 0.15 });
    line(c, 50, 13, 37, 2, C.w7);
    qubitMan = canvas;
  }
  ctx.drawImage(qubitMan, 0, 0);
}

// ───────────────────────── the Statue of QubitMan ─────────────────────────
function statueFrame(f: number): ObjSprite {
  // A projected stone plinth and a sculpted hero, both seated on the same ground plane.
  const W = 156,
    H = 290,
    AX = 78,
    AY = 252; // retain ground anchor, leave room under the lowest plinth edge
  const FX = AX - QM_W / 2,
    FY = AY - PLINTH.top - 152; // figure offset (feet at y≈152 in its own frame)
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
