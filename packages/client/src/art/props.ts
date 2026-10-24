/**
 * Furniture, stations and town props, modelled in true isometric (see isokit): every piece has real top and side
 * planes on the game's 2:1 grid, sits on its tile's floor diamond and, when it stands against a wall, is laid out for
 * that wall ('sw' = backed onto the north-east wall, 'se' = backed onto the north-west wall).
 */
import { Texture } from 'pixi.js';
import { mulberry32 } from '@eigenlands/shared';
import type { ObjSprite } from './objects';
import type { ObjSpriteDef } from './worldobjs';
import { blob, C, makeCanvas, outline, poly, polish, put, undithered, type Ctx, type Ramp } from './shade';
import { DARKWOOD, IRONM, Iso, Prop, STONEM, WOODM, rampAt, type Detail, type Facing, type PMat } from './isokit';

const LIGHTWOOD: Ramp = [C.e1, C.e2, C.e3, C.e4, C.e5, C.e6];
const BRICK: Ramp = [C.r0, C.r1, C.r2, C.r3, C.r4, C.e6];
const LINEN: Ramp = [C.steel, C.mist, C.fog, C.pale, C.white, C.white];
const STRAW: Ramp = [C.e2, C.e3, C.e4, C.e5, C.e6, C.e7];
const LEAF: Ramp = [C.g0, C.g1, C.g2, C.g3, C.g4, C.g5];
const WATER: Ramp = [C.w1, C.w2, C.w3, C.w4, C.w5, C.w6];
const BRASS: Ramp = [C.e2, C.e3, C.e4, C.e5, C.e6, C.e7];
const BOOKS: Array<[number, number]> = [[C.r2, C.r3], [C.w2, C.w3], [C.g2, C.g3], [C.q2, C.q3], [C.e3, C.e4], [C.r4, C.r5], [C.slate, C.steel]];
const FIRE = [C.r3, C.r5, C.r6, C.r7, C.e7, C.white];

const hash = (a: number, b: number, k = 0) => (((a * 73856093) ^ (b * 19349663) ^ (k * 83492791)) >>> 0) % 1000 / 1000;

/** Build one prop sprite: tile anchor at (W/2, H-10), outline + rim light + contact shadow. */
function iso(W: number, H: number, face: Facing, draw: (p: Prop, ctx: Ctx) => void, o: { flat?: boolean; post?: (p: Prop, ctx: Ctx) => void } = {}): ObjSprite {
  const { canvas, ctx } = makeCanvas(W, H);
  const ax = Math.floor(W / 2), ay = H - 10;
  undithered(() => {
    const p = new Prop(ctx, ax, ay, face);
    draw(p, ctx);
    if (!o.flat) outline(ctx, W, H, C.night);
    polish(ctx, W, H, { rim: !o.flat, ao: o.flat ? null : { ax, ay, rx: Math.min(14, W * 0.36) } });
    o.post?.(p, ctx);
  });
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  return { tex, ax, ay };
}
const nf = (n: number, mk: (f: number) => ObjSprite): ObjSprite[] => Array.from({ length: n }, (_, f) => mk(f));

/** plank seams every `step` px up a face of height h */
const planks = (h: number, step = 3): Detail => (s, t, c) => (Math.round(t * h) % step === 0 && t > 0.08 && t < 0.92 ? c(-1) : null);
/** four short legs under a top that spans (a0..a0+da, b0..b0+db) */
function legs(p: Prop, a0: number, b0: number, da: number, db: number, h: number, m: PMat, w = 1.6): void {
  for (const [a, b] of [[a0, b0], [a0 + da - w, b0], [a0, b0 + db - w], [a0 + da - w, b0 + db - w]] as const) p.box(a, b, 0, w, w, h, m);
}

// ───────────────────────── storage ─────────────────────────
function bookcase(face: Facing): ObjSprite {
  return iso(36, 52, face, (p) => {
    const A0 = 1.5, DA = 13, D = 5, H = 28;
    p.box(A0, 0.5, 0, DA, D, H, {
      ramp: DARKWOOD,
      front: (s, t, c, _x, _y, lit) => {
        const px = s * DA, pz = t * H;
        if (px < 1.1 || px > DA - 1.1 || pz > H - 1.4 || pz < 1.6) return c(1);
        const row = Math.floor((pz - 1.6) / 6.4), fz = pz - 1.6 - row * 6.4;
        if (fz < 1) return c(1);
        const col = Math.floor(px - 1.1), bh = 3 + hash(col, row, 3) * 2.2;
        if (hash(col, row, 9) < 0.12 || fz - 1 > bh) return C.ink;                           // gaps and the dark back
        const bk = BOOKS[Math.floor(hash(col, row, 5) * BOOKS.length)]!;
        return fz - 1 > bh - 0.8 ? (lit ? C.pale : C.mist) : lit ? bk[1] : bk[0];           // page tops catch the light
      },
    });
    p.box(A0 - 0.5, 0.3, H, DA + 1, D + 0.6, 1.4, { ramp: DARKWOOD });
    p.box(A0 - 0.2, 0.5, 0, DA + 0.4, D + 0.4, 1.5, { ramp: WOODM }); // worn plinth
    // A bound folio and scrolls on the top, all seated on the cornice.
    p.box(3, 1, H + 1.4, 4, 3.2, 1.1, { ramp: [C.w0, C.w1, C.w2, C.w3], front: () => C.e6 });
    p.line(8, 1.8, H + 2, 11.5, 1.8, H + 2, C.e6);
    p.line(8, 2.8, H + 2, 11, 2.8, H + 2, C.pale);
    p.dot(10, 2.4, H + 2.2, C.r2); // binding ribbon
  });
}

function wardrobe(face: Facing): ObjSprite {
  return iso(36, 52, face, (p) => {
    const A0 = 2, DA = 12, D = 6, H = 27;
    p.box(A0, 0.5, 0, DA, D, H, {
      ramp: WOODM,
      front: (s, t, c) => {
        const px = s * DA, pz = t * H;
        if (pz < 2) return c(-1);
        if (Math.abs(px - DA / 2) < 0.5) return c(-2);                                         // the doors meet
        if (Math.abs(px - DA / 2) < 1.6 && Math.abs(pz - 14) < 1) return C.e6;                 // brass pulls
        const inset = (px > 1.5 && px < DA / 2 - 1.2) || (px > DA / 2 + 1.2 && px < DA - 1.5);
        if (inset && ((pz > 4 && pz < 12.5) || (pz > 15.5 && pz < 24))) return (pz > 11.5 && pz < 12.5) || (pz > 23 && pz < 24) ? c(1) : c(-1);
        return null;
      },
      end: planks(27, 5),
    });
    p.box(A0 - 0.6, 0.2, H, DA + 1.2, D + 0.7, 1.5, { ramp: WOODM });
    p.box(A0 - 0.4, 0.3, 1, DA + 0.8, D + 0.4, 1.2, { ramp: DARKWOOD });
    p.box(4, 1, H + 1.5, 6, 3.5, 1.6, { ramp: LINEN, front: (s) => s > 0.68 && s < 0.82 ? C.w3 : null });
    for (const a of [A0 + 0.6, A0 + DA - 0.8]) for (const z of [7, 21]) {
      p.line(a, D + 0.55, z, a + 0.8, D + 0.55, z, C.e5); // hinge straps
    }
  });
}

function shelf(face: Facing): ObjSprite {
  return iso(34, 40, face, (p) => {
    const A0 = 2.5, DA = 11, D = 4.5, H = 17;
    p.box(A0, 0.5, 0, DA, D, H, {
      ramp: WOODM,
      front: (s, t, c, _x, _y, lit) => {
        const px = s * DA, pz = t * H;
        if (px < 1 || px > DA - 1 || pz < 1.5 || pz > H - 1.2) return c(1);
        const row = Math.floor((pz - 1.5) / 7.5), fz = pz - 1.5 - row * 7.5;
        if (fz < 1) return c(1);
        const col = Math.floor((px - 1) / 3);
        const jar = ((px - 1) % 3) < 2.2 && fz < 4.5;
        if (!jar) return C.ink;
        const cols = [[C.w3, C.w5], [C.g3, C.g5], [C.r3, C.r5], [C.e5, C.e7]][(col + row) % 4]!;
        if (fz > 3.7) return C.e1; // cork
        if (fz > 1.4 && fz < 2.7) return lit ? C.e7 : C.e5; // paper label
        return lit ? cols[1] : cols[0];
      },
    });
    p.box(A0 - 0.3, 0.3, H, DA + 0.6, D + 0.4, 1, { ramp: LIGHTWOOD });
    p.cyl(5.5, 2.4, H + 1, 1.3, 2.2, [C.r0, C.r1, C.r2, C.r3], [C.e1, C.e2]);
    p.cyl(10, 2.4, H + 1, 1, 3, [C.w0, C.w1, C.w2, C.w3], [C.e2, C.e3]);
  });
}

// ───────────────────────── tables, desks, counters ─────────────────────────
function table(face: Facing, items = true): ObjSprite {
  return iso(36, 34, face, (p, ctx) => {
    legs(p, 2.5, 3, 11, 10, 8, { ramp: DARKWOOD });
    p.box(1.5, 2, 8, 13, 12, 1.6, { ramp: LIGHTWOOD, top: (s, t, c) => (Math.round(s * 13) % 4 === 0 ? c(-1) : null) });
    if (items) {
      p.cyl(5, 6, 9.6, 1.6, 2.5, [C.slate, C.steel, C.mist, C.fog], [C.e2, C.e3]);         // a mug
      p.cyl(10, 10, 9.6, 2.3, 0.5, LINEN, LINEN); // earthenware plate
      p.cyl(10, 10, 10.1, 1.5, 1.2, STRAW, STRAW); // bread
      p.line(9.4, 9.5, 11.3, 10.4, 10.5, 11.3, C.e7);
      p.box(8, 7, 9.6, 4.5, 3.5, 0.6, { ramp: LINEN });                                    // a folded cloth
      void ctx;
    }
  });
}

function desk(face: Facing): ObjSprite {
  return iso(36, 36, face, (p) => {
    p.box(1.5, 1, 0, 4.5, 7, 8.5, { ramp: WOODM, front: (s, t, c) => (Math.abs(t - 0.5) < 0.06 ? c(-2) : Math.abs(s - 0.5) < 0.12 && Math.abs(t - 0.72) < 0.07 ? C.e6 : null) });   // drawer pedestal
    p.box(12.5, 1, 0, 1.5, 1.5, 8.5, { ramp: WOODM }); p.box(12.5, 6.5, 0, 1.5, 1.5, 8.5, { ramp: WOODM });
    p.box(1, 0.5, 8.5, 14, 8, 1.4, { ramp: WOODM, top: (s, t, c) => (s > 0.55 && s < 0.85 && t > 0.25 && t < 0.75 ? (t > 0.7 || s > 0.82 ? C.mist : C.pale) : null) });   // parchment
    p.cyl(4, 3.5, 9.9, 1.2, 2, [C.ink, C.night, C.slate], [C.ink]);                         // inkpot
    p.line(4.6, 3.5, 12, 6.5, 2.5, 16, C.white);                                             // quill
    p.dot(6.5, 2.5, 16, C.fog);
    // An open ledger: its two page planes rise toward the spine.
    p.box(8, 2, 9.9, 5.5, 4.5, 0.5, { ramp: [C.r0, C.r1, C.r2, C.r3] });
    p.box(8.3, 2.2, 10.4, 4.9, 4, 0.4, { ramp: LINEN,
      top: (s, t) => Math.abs(s - 0.5) < 0.09 ? C.e3 : t > 0.25 && t < 0.8 && Math.floor(t * 12) % 3 === 0 && s > 0.1 && s < 0.9 ? C.e4 : C.e7 });
    p.line(10.8, 2.3, 11, 10.8, 6.3, 11, C.e3);
    p.dot(12.5, 6.6, 10.5, C.r2); // wax seal
  });
}

function counter(face: Facing): ObjSprite {
  return iso(36, 38, face, (p) => {
    p.box(0.5, 2, 0, 15, 7, 11, { ramp: WOODM, front: (s, t, c) => (Math.round(s * 15) % 5 === 0 ? c(-1) : t > 0.25 && t < 0.8 && Math.round(s * 15) % 5 === 1 ? c(1) : null), end: planks(11) });
    p.box(0, 1.5, 11, 16, 8, 1.5, { ramp: LIGHTWOOD });
    p.cyl(4, 5, 12.5, 1.8, 3, [C.e1, C.e2, C.e3, C.e4], [C.e4, C.e5]);                       // a bread loaf basket
    p.box(9, 3.5, 12.5, 3, 3, 2, { ramp: BRASS });                                            // scale
    p.dot(10.5, 5, 16.5, C.e7);
  });
}

// ───────────────────────── seats & beds ─────────────────────────
function chair(face: Facing): ObjSprite {
  return iso(32, 36, face, (p) => {
    legs(p, 4.5, 4.5, 7, 7, 6, { ramp: DARKWOOD }, 1.3);
    p.box(4, 4, 6, 8, 8, 1.3, { ramp: WOODM });
    p.box(4, 3.4, 7.3, 1.3, 8.6, 9, { ramp: WOODM, front: (s, t, c) => (t > 0.2 && t < 0.8 && Math.abs(s - 0.5) > 0.2 && Math.abs(s - 0.5) < 0.35 ? c(-2) : null) });
  });
}

function stool(face: Facing): ObjSprite {
  return iso(28, 28, face, (p) => {
    for (const [a, b] of [[6, 6], [10, 6], [6, 10], [10, 10]] as const) p.box(a - 0.6, b - 0.6, 0, 1.2, 1.2, 6, { ramp: DARKWOOD });
    p.cyl(8.6, 8.6, 6, 3.6, 1.6, WOODM, LIGHTWOOD);
  });
}

function bed(face: Facing): ObjSprite {
  return iso(48,44,face,p=>{
    const QUILT:Ramp=[C.r0,C.r1,C.r2,C.r3,C.r4,C.r5];
    // Backboard and feet sit on the same floor; mattress and quilt stack above the rails.
    p.box(1,0,0,14,1.2,13,{ramp:DARKWOOD});
    for(const u of[1,13.5])for(const v of[1,17.5])p.box(u,v,0,1.5,1.5,5,{ramp:DARKWOOD});
    p.box(1,1,3,14,18,2,{ramp:DARKWOOD});
    p.box(2,1.5,5,12,16.5,2,{ramp:LINEN});
    p.box(3,2,7,10,3.5,1.5,{ramp:LINEN});
    p.box(1.8,6,7,12.4,12,1,{ramp:QUILT,top:(s,t,c)=>t<.13?C.pale:s<.08||s>.92||t>.92?C.e6:(Math.floor(s*4)+Math.floor(t*5))%2?c(-1):c(1)});
    p.box(1,18.5,2,14,1,5,{ramp:DARKWOOD});
  });
}

function bench(face: Facing): ObjSprite {
  return iso(38, 36, face, (p) => {
    for (const a of [1.5, 13]) { p.box(a, 4, 0, 1.6, 6, 5.5, { ramp: IRONM }); p.box(a, 3, 5.5, 1.6, 1.2, 8, { ramp: IRONM }); }
    for (let k = 0; k < 3; k++) p.box(0.5, 4.2 + k * 2, 5.5, 15, 1.6, 0.9, { ramp: LIGHTWOOD });
    for (let k = 0; k < 2; k++) p.box(0.5, 2.6, 8.5 + k * 3, 15, 0.9, 1.8, { ramp: LIGHTWOOD });
  });
}

function rug(face: Facing): ObjSprite {
  return iso(36, 22, face, (p) => {
    const RUG: Ramp = [C.r0, C.r1, C.r2, C.r3, C.r4, C.e6];
    p.box(1, 1, 0, 14, 14, 0, {
      ramp: RUG, rim: false,
      top: (s, t, c) => {
        const e = Math.min(s, t, 1 - s, 1 - t);
        if (e < 0.06) return C.e6;                                                         // fringe
        if (e < 0.14) return c(-2);
        if (e < 0.18) return C.e5;
        const d = Math.abs(s - 0.5) + Math.abs(t - 0.5);
        return d < 0.12 ? C.e6 : d < 0.2 ? c(-2) : Math.round(d * 30) % 3 === 0 ? c(-1) : null;   // a medallion
      },
    });
  }, { flat: true });
}

// ───────────────────────── boxes ─────────────────────────
function crate(face: Facing): ObjSprite {
  return iso(32, 34, face, (p) => {
    const brace: Detail = (s, t, c) => (s < 0.12 || s > 0.88 || t < 0.12 || t > 0.88 ? c(1) : Math.abs(s - t) < 0.1 ? c(1) : Math.round(t * 11) % 4 === 0 ? c(-1) : null);
    p.box(2.5, 2.5, 0, 11, 11, 10, { ramp: LIGHTWOOD, front: brace, end: brace, top: (s, t, c) => (Math.round(s * 11) % 4 === 0 ? c(-1) : null) });
  });
}

function chest(face: Facing): ObjSprite {
  return iso(32, 32, face, (p) => {
    const band: Detail = (s, t, c) => (Math.abs(s - 0.2) < 0.05 || Math.abs(s - 0.8) < 0.05 ? C.e6 : null);
    p.box(2.5, 3.5, 0, 11, 8, 6.5, { ramp: WOODM, front: (s, t, c, x, y, lit) => (Math.abs(s - 0.5) < 0.08 && t > 0.55 ? C.e7 : band(s, t, c, x, y, lit)), end: band });
    p.box(2.2, 3.2, 6.5, 11.6, 8.6, 3, { ramp: WOODM, front: band, end: band, top: (s, t, c) => (Math.abs(s - 0.2) < 0.05 || Math.abs(s - 0.8) < 0.05 ? C.e5 : null) });
  });
}

function barrel(face: Facing): ObjSprite {
  return iso(28, 34, face, (p) => {
    p.cyl(8, 8, 0, 4.6, 13, WOODM, LIGHTWOOD, (t) => (Math.abs(t - 0.22) < 0.05 || Math.abs(t - 0.8) < 0.05 ? C.slate : null));
  });
}

function basket(face: Facing): ObjSprite {
  return iso(28, 26, face, (p, ctx) => {
    p.cyl(8, 8, 0, 4, 5, STRAW, [C.e1, C.e2], (t) => (Math.round(t * 10) % 2 === 0 ? C.e3 : null));
    const rng = mulberry32(4);
    for (let i = 0; i < 6; i++) blob(ctx, p.X(8, 8) - 3 + rng() * 6, p.Y(8, 8, 5.5) + rng() * 2 - 1, 1.6, 1.3, [C.r2, C.r3, C.r4, C.r5], { seed: i, noise: 0.05, bright: 0.2 });
  });
}

// ───────────────────────── fire & heat ─────────────────────────
function hearth(face: Facing, f: number): ObjSprite {
  return iso(40, 64, face, (p, ctx) => {
    const stones: Detail = (s, t, c) => {
      const px = s * 16, pz = t * 34, row = Math.floor(pz / 3);
      return Math.round(pz) % 3 === 0 || Math.round(px + (row % 2) * 2) % 4 === 0 ? c(-1) : null;
    };
    // chimney breast up the wall, the firebox with its dark mouth, a mantel shelf
    p.box(1.5, 0, 0, 13, 4, 34, { ramp: STONEM, front: stones, end: stones });
    p.box(0, 0, 0, 16, 7, 12, {
      ramp: STONEM,
      front: (s, t, c) => {
        const px = s * 16, pz = t * 12;
        if (px > 3.5 && px < 12.5 && pz < 8.5 - Math.max(0, Math.abs(px - 8) - 3) * 0.8) {
          const flame = pz < 2.2 + ((px * 3 + f * 5) % 4) * 0.9 + (Math.abs(px - 8) < 2 ? 2.2 : 0);
          return flame ? FIRE[Math.min(5, Math.floor((2.6 - Math.abs(px - 8) * 0.5) + (f % 2)))] ?? C.r5 : pz < 1 ? C.e1 : C.ink;
        }
        return Math.round(pz) % 3 === 0 || Math.round(px) % 4 === 0 ? c(-1) : null;
      },
    });
    p.box(-0.5, 0, 12, 17, 8, 1.6, { ramp: WOODM });
    void ctx;
  });
}

function stove(face: Facing, f: number): ObjSprite {
  return iso(32, 48, face, (p) => {
    p.box(3, 2, 0, 10, 8, 11, {
      ramp: IRONM,
      front: (s, t) => (s > 0.25 && s < 0.75 && t > 0.2 && t < 0.6 ? (Math.round(s * 10 + f) % 2 === 0 ? C.r6 : C.r5) : null),
    });
    p.box(2.5, 1.5, 11, 11, 9, 1, { ramp: IRONM });
    p.cyl(10, 4.5, 12, 1.4, 16, IRONM, [C.ink]);                                              // flue
    p.cyl(6, 6, 12, 2.4, 2.5, [C.slate, C.steel, C.mist, C.fog], [C.ink, C.night]);           // a kettle
  });
}

function furnace(face: Facing, f: number): ObjSprite {
  return iso(36, 56, face, (p) => {
    const bricks: Detail = (s, t, c) => (Math.round(t * 18) % 3 === 0 || Math.round(s * 12 + (Math.floor(t * 6) % 2) * 2) % 4 === 0 ? c(-1) : null);
    p.box(1.5, 1.5, 0, 13, 12, 18, {
      ramp: STONEM, end: bricks,
      front: (s, t, c, x, y, lit) => {
        const px = s * 13, pz = t * 18;
        if (px > 3.5 && px < 9.5 && pz > 2 && pz < 9 - Math.max(0, Math.abs(px - 6.5) - 1.5)) return pz < 3.5 + ((px + f) % 2) ? C.r7 : pz < 6 ? C.r5 : C.r3;
        return bricks(s, t, c, x, y, lit);
      },
    });
    p.box(4.5, 4, 18, 7, 7, 10, { ramp: STONEM, front: bricks, end: bricks });                  // stack
    p.box(4, 3.5, 28, 8, 8, 1.2, { ramp: STONEM });
  });
}

function forge(face: Facing, f: number): ObjSprite {
  return iso(40, 46, face, (p) => {
    p.box(0.5, 1.5, 0, 9, 11, 8, { ramp: BRICK, front: (s, t, c) => (Math.round(t * 8) % 3 === 0 || Math.round(s * 9) % 4 === 0 ? c(-1) : null) });
    p.box(1.5, 2.5, 8, 7, 9, 0.6, { ramp: [C.ink, C.r1, C.r3, C.r5, C.r6, C.r7], top: (s, t) => (hash(Math.round(s * 7), Math.round(t * 9), f) > 0.55 ? C.r7 : hash(Math.round(s * 7), Math.round(t * 9), 2) > 0.5 ? C.r4 : C.ink) });
    // the anvil on a stump
    p.cyl(12.5, 7, 0, 2.6, 4.5, WOODM, LIGHTWOOD);
    p.box(10.5, 5.5, 4.5, 4.5, 3, 2.2, { ramp: IRONM });
    p.box(9.8, 6, 6.7, 6, 2, 1.4, { ramp: IRONM });
  });
}

function cauldron(face: Facing, f: number): ObjSprite {
  return iso(28, 30, face, (p, ctx) => {
    for (const [a, b] of [[5, 5], [11, 5], [8, 11]] as const) p.box(a - 0.5, b - 0.5, 0, 1, 1, 3, { ramp: IRONM });
    p.cyl(8, 8, 2, 4.8, 6, IRONM, [C.q1, C.q2, C.q3, C.q4, C.q5]);
    const cx = p.X(8, 8), cy = p.Y(8, 8, 8);
    for (let i = 0; i < 3; i++) { const a = f * 1.7 + i * 2.1; put(ctx, Math.round(cx + Math.cos(a) * 3), Math.round(cy + Math.sin(a) * 1.2), C.q7); }
    put(ctx, Math.round(cx - 1), Math.round(cy - 4 - f), C.q6); put(ctx, Math.round(cx + 2), Math.round(cy - 6 - ((f + 1) % 3)), C.q4);
  });
}

function cookingPot(face: Facing, f: number): ObjSprite {
  return iso(34, 40, face, (p, ctx) => {
    // a ring of stones round the embers, two forked posts, a crossbar and the pot hanging over the fire
    for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.283; p.cyl(8 + Math.cos(a) * 5.2, 8 + Math.sin(a) * 5.2, 0, 1.4, 1.8, STONEM); }
    p.iso.cyl(...p.uv(8, 8), 0, 3.6, 0.5, [C.ink, C.r1], [C.r1, C.r3, C.r5, C.r6]);
    p.box(1, 7.4, 0, 1.2, 1.2, 15, { ramp: DARKWOOD });
    p.line(1.6, 8, 15, 15, 8, 15, C.e2);
    p.line(8, 8, 15, 8, 8, 9.5, C.slate);
    p.cyl(8, 8, 5, 3.4, 4.5, IRONM, [C.e3, C.e4, C.e5]);
    p.box(14, 7.4, 0, 1.2, 1.2, 15, { ramp: DARKWOOD });
    blob(ctx, p.X(8, 8), p.Y(8, 8, 1.5), 2.6, 1.2, [C.r5, C.r6, C.r7, C.e7], { seed: f + 3, noise: 0.4, bright: 0.2 });
    put(ctx, Math.round(p.X(8, 8)) - 1 + (f % 2), Math.round(p.Y(8, 8, 12 + f)), C.fog);            // steam
  });
}

// ───────────────────────── crafting ─────────────────────────
function workbench(face: Facing): ObjSprite {
  return iso(36, 40, face, (p) => {
    legs(p, 1.5, 2, 13, 9, 9, { ramp: DARKWOOD }, 1.8);
    p.box(1.5, 2.5, 2.5, 13, 8, 0.8, { ramp: DARKWOOD });                                       // lower shelf
    p.box(0.5, 1.5, 9, 15, 11, 1.8, { ramp: LIGHTWOOD, top: (s, t, c) => (Math.round(s * 15) % 5 === 0 ? c(-1) : null) });
    p.box(11.5, 2, 10.8, 2.5, 3, 2.5, { ramp: IRONM });                                          // vice
    p.line(3, 6, 11, 8, 6, 11, C.steel); p.line(3, 6.5, 11, 8, 6.5, 11, C.mist);                 // a saw blade
    p.box(2.2, 6, 11, 1.4, 1.4, 1.2, { ramp: WOODM });
    p.box(5, 9, 10.8, 5, 2, 1.2, { ramp: LIGHTWOOD });                                          // a plank offcut
  });
}

function carpenter(face: Facing): ObjSprite {
  return iso(36, 40, face, (p) => {
    legs(p, 1, 3, 14, 8, 8, { ramp: DARKWOOD }, 1.8);
    p.box(0.5, 2.5, 8, 15, 9, 1.8, { ramp: LIGHTWOOD });
    p.box(1.5, 4, 9.8, 13, 3, 1.2, { ramp: STRAW });                                            // a board being planed
    p.box(6, 4.5, 11, 3, 2, 1.6, { ramp: WOODM });                                              // the plane
    for (let k = 0; k < 4; k++) p.dot(3 + k * 3, 9 + (k % 2), 9.8, C.e6);                      // shavings
  });
}

function jeweler(face: Facing): ObjSprite {
  return iso(36, 40, face, (p, ctx) => {
    legs(p, 2, 3, 12, 8, 9, { ramp: DARKWOOD });
    p.box(1.5, 2.5, 9, 13, 9, 1.4, { ramp: [C.q0, C.q1, C.q2, C.q3, C.q4, C.q5], top: (s, t) => (s < 0.08 || t < 0.08 || s > 0.92 || t > 0.92 ? C.e5 : null) });   // velvet top
    const gems = [C.r6, C.w6, C.g6, C.q7, C.e7];
    for (let i = 0; i < 5; i++) { put(ctx, Math.round(p.X(4 + i * 1.8, 6 + (i % 2) * 2)), Math.round(p.Y(4 + i * 1.8, 6 + (i % 2) * 2, 10.6)), gems[i]!); }
    p.cyl(12, 5, 10.4, 0.6, 7, BRASS, BRASS); p.cyl(12, 5, 17, 1.6, 1.6, BRASS, [C.e7, C.white]);   // a loupe lamp
  });
}

function alchemy(face: Facing, f: number): ObjSprite {
  return iso(36, 42, face, (p, ctx) => {
    legs(p, 2, 3, 12, 8, 9, { ramp: DARKWOOD });
    p.box(1.5, 2.5, 9, 13, 9, 1.4, { ramp: WOODM });
    const flask = (a: number, b: number, r: number, h: number, liq: Ramp) => { p.cyl(a, b, 10.4, r, h, liq, [C.fog, C.pale]); p.cyl(a, b, 10.4 + h, 0.5, 2, [C.mist, C.fog], [C.e3]); };
    flask(4.5, 6, 1.7, 3, [C.g2, C.g3, C.g5, C.g6]);
    flask(8, 5, 1.3, 4.5, [C.q2, C.q3, C.q5, C.q7]);
    flask(11.5, 7, 1.6, 2.5, [C.r2, C.r3, C.r5, C.r6]);
    put(ctx, Math.round(p.X(8, 5)), Math.round(p.Y(8, 5, 18 + f)), C.q6);                     // a rising bubble
  });
}

function loom(face: Facing): ObjSprite {
  return iso(36, 52, face, (p) => {
    for (const a of [1, 13.5]) { p.box(a, 2, 0, 1.5, 1.5, 24, { ramp: WOODM }); p.box(a, 9, 0, 1.5, 1.5, 12, { ramp: WOODM }); p.box(a, 2, 10, 1.5, 8.5, 1.4, { ramp: WOODM }); }
    p.box(1, 2, 22.5, 14, 1.5, 1.6, { ramp: WOODM });                                            // top beam
    p.box(2.5, 2.8, 4, 11, 0.3, 18, {                                                           // the warp with a woven panel
      ramp: [C.q0, C.q1, C.q2, C.w3, C.w5, C.white],
      front: (s, t, c) => (t > 0.45 ? (Math.round(s * 22) % 2 === 0 ? C.pale : C.mist) : (Math.round(s * 11) + Math.round(t * 18)) % 3 === 0 ? c(-2) : c(Math.round(t * 18) % 4 === 0 ? 1 : 0)),
    });
    p.box(1, 9, 9, 14, 1.5, 1.4, { ramp: LIGHTWOOD });                                          // the breast beam
  });
}

function rack(face: Facing): ObjSprite {
  return iso(36, 44, face, (p) => {
    for (const a of [1.5, 13]) p.box(a, 1, 0, 1.6, 2, 20, { ramp: DARKWOOD });
    for (const z of [6, 15]) p.box(1.5, 1.2, z, 13, 1.6, 1.4, { ramp: WOODM });
    // three blades and a spear leaning in the rack
    for (const [a, c1, c2] of [[4.5, C.mist, C.fog], [8, C.steel, C.pale], [11, C.mist, C.white]] as const) { p.line(a, 2.6, 2, a, 2.6, 19, c1); p.line(a + 0.6, 2.6, 3, a + 0.6, 2.6, 18, c2); p.box(a - 1, 2.2, 14, 2.6, 0.8, 0.8, { ramp: BRASS }); }
  });
}

function board(face: Facing): ObjSprite {
  return iso(36, 44, face, (p) => {
    for (const a of [2, 12.5]) p.box(a, 3, 0, 1.6, 1.6, 22, { ramp: DARKWOOD });
    p.box(1, 4.6, 9, 14, 0.9, 12, {
      ramp: LIGHTWOOD,
      front: (s, t, c) => {
        const px = s * 14, pz = t * 12;
        if (px < 0.8 || px > 13.2 || pz < 0.8 || pz > 11.2) return c(-2);
        for (const [x0, z0, w, h] of [[1.8, 5.5, 4, 5], [6.5, 6.5, 3.5, 4], [10.5, 3, 2.5, 6.5], [3, 1.5, 6, 3]] as const) {
          if (px >= x0 && px < x0 + w && pz >= z0 && pz < z0 + h) return Math.round(pz) % 2 === 0 && px > x0 + 0.5 && px < x0 + w - 0.5 ? C.steel : C.pale;   // notices
        }
        return null;
      },
    });
    p.box(0.5, 4.2, 21, 15, 1.8, 1.2, { ramp: WOODM });
  });
}

function trophy(face: Facing): ObjSprite {
  return iso(26, 34, face, (p) => {
    p.box(5, 5, 0, 6, 6, 5, { ramp: DARKWOOD });
    p.cyl(8, 8, 5, 0.8, 3, BRASS, BRASS);
    p.cyl(8, 8, 8, 2.6, 4, BRASS, [C.e3, C.e5]);
  });
}

// ───────────────────────── light ─────────────────────────
function candles(face: Facing, f: number): ObjSprite {
  return iso(26, 38, face, (p, ctx) => {
    p.cyl(8, 8, 0, 2.6, 1.2, BRASS, BRASS);
    p.cyl(8, 8, 1, 0.6, 12, BRASS, BRASS);
    p.line(5, 8, 13, 11, 8, 13, C.e5);
    for (const a of [5, 8, 11]) {
      p.cyl(a, 8, 13, 0.7, 3, LINEN, [C.white]);
      put(ctx, Math.round(p.X(a, 8)), Math.round(p.Y(a, 8, 17 + ((a + f) % 2))), f % 2 ? C.e7 : C.r6);
      put(ctx, Math.round(p.X(a, 8)), Math.round(p.Y(a, 8, 16)), C.white);
    }
  });
}

function floorLamp(face: Facing, f: number): ObjSprite {
  return iso(26, 50, face, (p) => {
    p.cyl(8, 8, 0, 2.6, 1.2, DARKWOOD, WOODM);
    p.cyl(8, 8, 1, 0.6, 22, DARKWOOD, DARKWOOD);
    p.cyl(8, 8, 21, 4, 6, [C.e3, C.e5, C.e6, C.e7, C.white], [C.e6, C.e7, C.white], (t) => (t < 0.15 ? (f ? C.e7 : C.e6) : null));
  });
}

function plant(face: Facing): ObjSprite {
  return iso(28, 36, face, (p, ctx) => {
    p.cyl(8, 8, 0, 3.4, 5, [C.r0, C.r1, C.r2, C.r3, C.r4], [C.e0, C.e1]);
    const cx = p.X(8, 8), cy = p.Y(8, 8, 6);
    for (const [dx, dy, r] of [[0, -6, 4.6], [-4, -3, 3.4], [4, -3, 3.4], [0, -10, 3]] as const) blob(ctx, cx + dx, cy + dy, r, r * 0.85, LEAF, { seed: dx + 9, noise: 0.5, bright: dy < -8 ? 0.15 : 0 });
  });
}

// ───────────────────────── outdoors ─────────────────────────
function stall(face: Facing, f: number): ObjSprite {
  return iso(46, 62, face, (p, ctx) => {
    // counter of crates heaped with produce
    p.box(0.5, 5, 0, 15, 9, 10, { ramp: LIGHTWOOD, front: (s, t, c) => (Math.round(t * 10) % 3 === 0 ? c(-1) : Math.round(s * 15) % 5 === 0 ? c(-2) : null), end: planks(10) });
    p.box(0, 4.5, 10, 16, 10, 1.2, { ramp: WOODM });
    const prod: Ramp[] = [[C.r2, C.r3, C.r4, C.r5], [C.e4, C.e5, C.e6, C.e7], [C.g3, C.g4, C.g5, C.g6], [C.q1, C.q2, C.q3, C.q4]];
    const rng = mulberry32(5);
    for (let k = 0; k < 4; k++) {
      p.box(1 + k * 3.7, 6.5, 11.2, 3.2, 6, 1.6, { ramp: WOODM });                              // produce crates
      for (let i = 0; i < 5; i++) blob(ctx, p.X(2.6 + k * 3.7 + (rng() - 0.5) * 2, 8 + rng() * 3.5), p.Y(2.6 + k * 3.7, 9, 13.4), 1.3, 1.1, prod[k]!, { seed: i + k * 5, noise: 0.05, bright: 0.2 });
    }
    // posts and the striped awning sloping out toward the customers
    for (const [a, b, h] of [[0.5, 0.5, 30], [14, 0.5, 30], [0.5, 14, 24], [14, 14, 24]] as const) p.box(a, b, 0, 1.4, 1.4, h, { ramp: DARKWOOD });
    const lift = f ? 0.6 : 0;
    const back = 30, front = 22.5 + lift;
    const [u0, v0] = p.uv(-0.5, 0), [ua, va] = p.uv(17, 0), [ub, vb] = p.uv(-0.5, 16.5);
    const I = p.iso, ax = I.X(u0, v0), ay = I.Y(u0, v0, back);
    const e1x = I.X(ua, va) - ax, e1y = I.Y(ua, va, back) - ay, e2x = I.X(ub, vb) - ax, e2y = I.Y(ub, vb, front) - ay;
    I.para(ax, ay, e1x, e1y, e2x, e2y, (s, t) => {
      const red = Math.floor(s * 17 / 2.8) % 2 === 0;
      const lit = p.facing === 'sw' ? 1 : 0;
      return red ? [C.r2, C.r3][lit]! : [C.e6, C.e7][lit]!;
    });
    // scalloped valance along the front edge
    for (let a = -0.5; a < 17; a += 1) {
      const red = Math.floor((a + 0.5) / 2.8) % 2 === 0;
      const drop = (Math.round(a) % 2 === 0 ? 2 : 1);
      for (let d = 0; d < drop + 1; d++) p.dot(a, 16.5, front - d, red ? C.r1 : C.e5);
    }
  });
}

function planter(face: Facing): ObjSprite {
  return iso(36, 40, face, (p, ctx) => {
    const st: Detail = (s, t, c) => (Math.round(t * 7) % 3 === 0 || Math.round(s * 14) % 5 === 0 ? c(-1) : null);
    p.box(1, 2, 0, 14, 12, 7, { ramp: STONEM, front: st, end: st, top: (s, t) => (s > 0.1 && s < 0.9 && t > 0.1 && t < 0.9 ? C.e1 : null) });
    const cx = p.X(8, 8), cy = p.Y(8, 8, 7);
    for (const [dx, dy, r] of [[-5, 0, 5], [5, 0, 5], [0, -2, 5.5], [0, 2, 4.5]] as const) blob(ctx, cx + dx, cy + dy - 2, r, r * 0.7, LEAF, { seed: dx * 3 + dy + 20, noise: 0.45 });
    const rng = mulberry32(7), cols = [[C.r3, C.r5], [C.q5, C.q6], [C.w7, C.white], [C.e6, C.e7]];
    for (let i = 0; i < 12; i++) { const x = Math.round(cx - 9 + rng() * 18), y = Math.round(cy - 6 + rng() * 6), c = cols[i % 4]!; put(ctx, x, y, c[0]!); put(ctx, x + 1, y, c[1]!); put(ctx, x, y - 1, c[1]!); }
  });
}

function hay(face: Facing): ObjSprite {
  return iso(34, 32, face, (p) => {
    const straw: Detail = (s, t, c, x, y) => (Math.abs(t - 0.3) < 0.07 || Math.abs(t - 0.75) < 0.07 ? C.e2 : (x * 3 + y * 5) % 7 === 0 ? c(1) : (x + y * 3) % 5 === 0 ? c(-1) : null);
    p.box(1.5, 3, 0, 13, 9, 8, { ramp: STRAW, front: straw, end: straw, top: (s, t, c, x, y) => ((x * 3 + y) % 6 === 0 ? c(1) : null) });
  });
}

function trough(face: Facing): ObjSprite {
  return iso(36, 30, face, (p) => {
    p.box(0.5, 4, 0, 15, 8, 5, { ramp: WOODM, front: planks(5, 2), end: planks(5, 2) });
    p.box(1.5, 5, 4.4, 13, 6, 0.4, { ramp: WATER, rim: false, top: (s, t) => (Math.round(s * 13 + t * 4) % 6 === 0 ? C.w6 : null) });
  });
}

function woodpile(face: Facing): ObjSprite {
  return iso(36, 34, face, (p, ctx) => {
    // stacked logs: round end grain on the lit end, bark along the side
    for (let row = 0; row < 3; row++) for (let k = 0; k < 4 - row; k++) {
      const b = 4 + k * 2.8 + row * 1.4, z = 1.5 + row * 2.6;
      p.box(1, b - 1.3, z - 1.4, 13, 2.6, 2.6, { ramp: [C.ink, C.e0, C.e1, C.e2, C.e3, C.e4] });
      const ex = p.X(14, b), ey = p.Y(14, b, z);
      blob(ctx, ex, ey, 1.5, 1.4, [C.e3, C.e4, C.e5, C.e6], { seed: row * 4 + k, noise: 0, edgeDark: 0.4 });
      put(ctx, Math.round(ex), Math.round(ey), C.e3);
    }
  });
}

function mailbox(face: Facing): ObjSprite {
  return iso(26, 38, face, (p) => {
    p.box(7, 7, 0, 1.6, 1.6, 12, { ramp: DARKWOOD });
    p.box(4, 5, 12, 8, 5, 5, { ramp: [C.w0, C.w1, C.w2, C.w3, C.w4, C.w5], front: (s, t) => (Math.abs(t - 0.55) < 0.1 && s > 0.2 && s < 0.8 ? C.ink : null) });
    p.box(3.6, 4.6, 17, 8.8, 5.8, 1, { ramp: [C.w0, C.w1, C.w2, C.w3, C.w4, C.w5] });
    p.box(12, 7, 15, 0.6, 0.6, 4, { ramp: [C.r2, C.r3, C.r4, C.r5, C.r6, C.r7] });             // the flag is up
    p.box(12, 7, 18, 0.6, 2.6, 1.6, { ramp: [C.r2, C.r3, C.r4, C.r5, C.r6, C.r7] });
  });
}

function signpost(face: Facing): ObjSprite {
  return iso(40, 50, face, (p) => {
    p.box(7.2, 7.2, 0, 1.6, 1.6, 30, { ramp: DARKWOOD });
    // two arrow boards along the iso axes, one down each street
    const I = p.iso, arrow = (alongU: boolean, z: number, len: number, ramp: Ramp) => {
      for (let k = 0; k <= len; k++) {
        const w = k > len - 2 ? (len - k) * 1.5 : 3;
        for (let d = -w / 2; d <= w / 2; d += 0.5) {
          const [u, v] = alongU ? [8 + k * 0.6, 8] : [8, 8 + k * 0.6];
          put(I.ctx, Math.floor(I.X(u, v)), Math.floor(I.Y(u, v, z + d + 1.5)), d > 1 ? ramp[4]! : d < -1 ? ramp[1]! : ramp[2]!);
        }
      }
    };
    arrow(true, 21, 14, LIGHTWOOD);
    arrow(false, 15, 14, [C.r0, C.r1, C.r2, C.r3, C.r4, C.r5]);
    p.box(6.8, 6.8, 30, 2.4, 2.4, 1, { ramp: DARKWOOD });
  });
}

function sign(face: Facing): ObjSprite {
  return iso(32, 40, face, (p) => {
    p.box(7.2, 7.2, 0, 1.6, 1.6, 12, { ramp: DARKWOOD });
    p.box(2, 8.8, 9, 12, 1, 9, { ramp: LIGHTWOOD, front: (s, t, c) => (s < 0.08 || s > 0.92 || t < 0.1 || t > 0.9 ? c(-1) : Math.abs(t - 0.6) < 0.06 && s > 0.2 && s < 0.8 ? C.e1 : Math.abs(t - 0.35) < 0.06 && s > 0.25 && s < 0.65 ? C.e1 : null) });
  });
}

function well(face: Facing): ObjSprite {
  return iso(40, 56, face, (p) => {
    p.cyl(8, 8, 0, 7, 8, STONEM, STONEM, (t) => (Math.round(t * 8) % 3 === 0 ? C.slate : null));
    p.iso.cyl(8, 8, 8, 5.2, 0.3, [C.ink], [C.w0, C.w1, C.w2]);                           // dark water deep down
    for (const a of [1.5, 13]) p.box(a, 7.2, 8, 1.4, 1.4, 16, { ramp: DARKWOOD });
    p.box(1.5, 7.6, 21, 13, 0.6, 0.6, { ramp: DARKWOOD });                                        // windlass
    p.line(8, 8, 21, 8, 8, 13, C.e5);
    p.cyl(8, 8, 11, 1.4, 2.5, WOODM, LIGHTWOOD);                                                   // bucket
    // a little shingle roof, ridge along a
    const RO: Ramp = [C.r0, C.r1, C.r2, C.r3, C.r4, C.r5];
    for (let k = 0; k < 5; k++) {
      p.box(0.5, 2.5 + k, 24 + k, 15, 1, 0.9, { ramp: RO });
      p.box(0.5, 12.5 - k, 24 + k, 15, 1, 0.9, { ramp: RO });
    }
  });
}

function cart(face: Facing): ObjSprite {
  return iso(42, 38, face, (p, ctx) => {
    p.box(1, 3, 5, 14, 10, 1.2, { ramp: WOODM });
    p.box(1, 3, 6.2, 14, 1, 4, { ramp: LIGHTWOOD, front: planks(4, 2) }); p.box(1, 12, 6.2, 14, 1, 4, { ramp: LIGHTWOOD, front: planks(4, 2) });
    p.box(14, 3, 6.2, 1, 10, 4, { ramp: LIGHTWOOD, front: planks(4, 2) });
    for (let i = 0; i < 6; i++) blob(ctx, p.X(4 + i * 1.7, 8), p.Y(4 + i * 1.7, 8, 9), 2, 1.6, STRAW, { seed: i, noise: 0.3 });
    // wheels: ellipses on the long sides
    for (const b of [2.3, 13.7]) for (let k = 0; k < 24; k++) { const a = (k / 24) * 6.283; p.dot(8 + Math.cos(a) * 4, b, 4 + Math.sin(a) * 4, k % 6 === 0 ? C.e1 : C.e3); }
    p.line(1, 6, 5.5, -3, 6, 3, C.e2); p.line(1, 10, 5.5, -3, 10, 3, C.e2);                     // shafts
  });
}

function hedge(face: Facing): ObjSprite {
  return iso(36, 36, face, (p, ctx) => {
    // a clipped hedge: a leafy block whose crown and edges break up into clumps
    p.box(1.5, 3.5, 0, 13, 9, 7, { ramp: LEAF, front: (s, t, c, x, y) => ((x * 7 + y * 3) % 5 === 0 ? c(-1) : (x + y * 7) % 9 === 0 ? c(1) : null), end: (s, t, c, x, y) => ((x * 5 + y * 3) % 4 === 0 ? c(-1) : null) });
    const rng = mulberry32(11);
    for (let i = 0; i < 9; i++) {
      const a = 2.5 + (i % 5) * 2.8 + rng(), b = 4.5 + Math.floor(i / 5) * 4 + rng() * 2;
      blob(ctx, p.X(a, b), p.Y(a, b, 7.5), 3.2, 2.4, [C.g1, C.g2, C.g3, C.g4, C.g5], { seed: i + 30, noise: 0.45, bright: 0.12 });
    }
  });
}

function beehive(face: Facing): ObjSprite {
  return iso(30, 34, face, (p) => {
    p.box(3.5, 3.5, 0, 9, 9, 2, { ramp: DARKWOOD });
    for (let k = 0; k < 4; k++) p.cyl(8, 8, 2 + k * 2.6, 4.6 - k * 0.9, 2.6, STRAW, STRAW);
    p.dot(8, 12.5, 3.5, C.ink, 2, 1);
  });
}

function banner(face: Facing, f: number): ObjSprite {
  return iso(34, 60, face, (p) => {
    const VIO: Ramp = [C.q0, C.q1, C.q2, C.q3, C.q4, C.q5];
    p.cyl(8, 8, 0, 1.6, 1.4, STONEM, STONEM);
    p.cyl(8, 8, 1.4, 0.7, 34, DARKWOOD, DARKWOOD);
    p.cyl(8, 8, 35.4, 1.2, 1.2, BRASS, BRASS);
    p.box(2.5, 8.2, 31.5, 11, 0.8, 0.8, { ramp: DARKWOOD });
    // the cloth hangs in the plane of the crossbar, swallow-tailed, with a stitched qubit emblem; it ripples
    p.box(3, 8.6, 12, 10, 0.3, 19.5, {
      ramp: VIO,
      front: (s, t, c) => {
        const tail = t < 0.16 && Math.abs(s - 0.5) < (0.16 - t) * 2.2;
        if (tail) return -1;
        const ripple = Math.round(s * 10 + f) % 4 === 0 ? -1 : 0;
        if (s < 0.08 || s > 0.92) return C.e6;                                                    // gold edging
        const dx = (s - 0.5) * 10, dz = (t - 0.62) * 19.5, d = Math.hypot(dx, dz);
        if (Math.abs(d - 3) < 0.6) return C.pale;
        if (d < 1.3) return C.q7;
        return c(ripple);
      },
    });
  });
}

function laundry(face: Facing, f: number): ObjSprite {
  return iso(40, 44, face, (p) => {
    for (const a of [0.5, 14.5]) p.box(a, 7.5, 0, 1.2, 1.2, 20, { ramp: DARKWOOD });
    const sag = (a: number) => 19 - Math.sin((a / 15) * Math.PI) * 2;
    for (let a = 1; a < 15; a += 0.5) p.dot(a, 8, sag(a), C.mist);
    // sheets and shirts pegged on the line, swinging a little
    const items: Array<[number, number, number, Ramp]> = [[2, 4, 8, LINEN], [6.5, 3, 5, [C.w1, C.w2, C.w3, C.w4, C.w5, C.w6]], [10, 3.5, 7, [C.r1, C.r2, C.r3, C.r4, C.r5, C.r6]]];
    items.forEach(([a, w, h, r], k) => p.box(a + ((f + k) % 2) * 0.3, 8.3, sag(a + w / 2) - h, w, 0.3, h, { ramp: r, front: (s, t, c) => (t > 0.9 ? c(1) : Math.round(s * w * 2) % 3 === 0 ? c(-1) : null) }));
  });
}

function plaque(face: Facing): ObjSprite {
  return iso(32, 30, face, (p) => {
    p.box(3, 4, 0, 10, 8, 5, { ramp: STONEM });
    // a bronze reading plate tilted toward the passer-by
    const I = p.iso;
    const pt = (a: number, b: number, z: number): [number, number] => { const [u, v] = p.uv(a, b); return [I.X(u, v), I.Y(u, v, z)]; };
    const [ax, ay] = pt(3.5, 4.5, 9), [bx, by] = pt(12.5, 4.5, 9), [cx, cy] = pt(3.5, 11.5, 5.2);
    I.para(ax, ay, bx - ax, by - ay, cx - ax, cy - ay, (s, t) => (s < 0.06 || s > 0.94 || t < 0.08 || t > 0.92 ? C.e1 : Math.round(t * 7) % 2 === 0 && s > 0.15 && s < 0.85 ? C.e2 : t < 0.3 ? C.r5 : C.r4));
    p.box(3.5, 4.5, 5, 9, 1, 4, { ramp: STONEM });
  });
}

// ───────────────────────── shrines & ruins ─────────────────────────
function shrineAltar(face: Facing, f: number): ObjSprite {
  return iso(40, 52, face, (p, ctx) => {
    const glow = [C.q5, C.q6, C.q7, C.q6][f % 4]!;
    const rune: Detail = (s, t) => (Math.abs(t - 0.45) < 0.08 && Math.round(s * 12) % 3 !== 0 ? glow : null);
    p.box(0.5, 0.5, 0, 15, 15, 3, { ramp: STONEM });                                            // a broad step
    p.box(2.5, 2.5, 3, 11, 11, 7, { ramp: STONEM, front: rune, end: rune });
    p.box(4, 4, 10, 8, 8, 1.5, { ramp: [C.e1, C.e2, C.e3, C.e4, C.e5] });
    p.cyl(8, 8, 11.5, 3.2, 1.5, [C.e1, C.e2, C.e4, C.e5], [C.q0, C.q1, C.q2]);
    // A recessed brass cradle and a suspended, faceted qubit. Orbit threads have a back and a front half.
    const ox = p.X(8, 8), oy = p.Y(8, 8, 21);
    const orbit = (front: boolean) => {
      for (let i = 0; i < 32; i++) {
        const a = i / 32 * Math.PI * 2;
        if ((Math.sin(a) >= 0) !== front) continue;
        const x = Math.round(ox + Math.cos(a) * 8), y = Math.round(oy + Math.sin(a) * 3);
        if (i % 4 !== 0) put(ctx, x, y, front ? C.q4 : C.q2);
      }
      const a = f * Math.PI / 2 + (front ? 0 : Math.PI);
      put(ctx, Math.round(ox + Math.cos(a) * 8), Math.round(oy + Math.sin(a) * 3), front ? C.q7 : C.q5);
    };
    orbit(false);
    poly(ctx, [[ox, oy - 6], [ox + 4, oy], [ox, oy + 5], [ox - 4, oy]], C.q3);
    poly(ctx, [[ox, oy - 6], [ox - 4, oy], [ox, oy + 1]], C.q6);
    poly(ctx, [[ox, oy - 6], [ox + 4, oy], [ox, oy + 1]], C.q4);
    put(ctx, Math.round(ox - 1), Math.round(oy - 3), C.white, 1, 2);
    orbit(true);
    for (const a of [3, 12]) p.dot(a, 13, 4, C.e6);
  });
}

function shrinePillar(face: Facing): ObjSprite {
  return iso(30, 64, face, (p) => {
    const rune: Detail = (s, t) => (Math.abs(s - 0.5) < 0.2 && [0.3, 0.5, 0.7].some((r) => Math.abs(t - r) < 0.03) ? C.q5 : null);
    p.box(3, 3, 0, 10, 10, 4, { ramp: STONEM });
    const channel: Detail = (s, t, c, x, y, lit) => rune(s, t, c, x, y, lit) ?? (Math.abs(s - 0.5) < 0.2 && t > 0.16 && t < 0.85 ? c(-1) : null);
    p.box(4.5, 4.5, 4, 7, 7, 28, { ramp: STONEM, front: channel, end: channel });
    for (const z of [8, 28]) p.box(4, 4, z, 8, 8, 1, { ramp: [C.e1, C.e2, C.e3, C.e4, C.e5] });
    p.box(3.5, 3.5, 32, 9, 9, 3, { ramp: STONEM });
  });
}

/** Ruin pieces in iso, from a biome's stone. Returns null for the organic monuments (cairn, idol, crystal arch). */
export function ruinIso(sub: string, st: { ramp: Ramp; cap: Ramp | null; moss: Ramp | null; glow: number | null }, biome: string, f: number): ObjSprite | null {
  const R6 = st.ramp;
  const joints = (h: number, step = 4): Detail => (s, t, c) => (Math.round(t * h) % step === 0 && t < 0.95 ? c(-1) : null);
  const topping = (ctx: Ctx, x: number, y: number, w: number) => {
    if (st.cap) blob(ctx, x, y, w, 1.8, st.cap, { seed: 3, noise: 0.1, edgeDark: 0 });
    else if (st.moss) blob(ctx, x - w * 0.2, y, w * 0.7, 1.6, st.moss, { seed: 5, noise: 0.45, edgeDark: 0 });
  };
  const sparks = (ctx: Ctx, cx: number, top: number, h: number) => {
    if (st.glow === null) return;
    for (let i = 0; i < 5; i++) put(ctx, Math.round(cx - 9 + ((i * 7 + f * 5) % 18)), Math.round(top + ((i * 11 + f * 3) % Math.max(4, h))), i % 2 ? st.glow : C.white);
  };
  const H0 = 16 + (biome.length % 3) * 4;
  switch (sub) {
    case 'ruin_pillar': return iso(30, H0 + 30, 'sw', (p, ctx) => {
      p.box(3.5, 3.5, 0, 9, 9, 2.5, { ramp: R6 });
      p.box(5, 5, 2.5, 6, 6, H0, { ramp: R6, front: joints(H0), end: joints(H0), top: (s, t, c) => ((Math.round(s * 6) + Math.round(t * 6)) % 3 === 0 ? c(-1) : null) });   // a broken drum on top
      topping(ctx, p.X(8, 8), p.Y(8, 8, H0 + 2.5), 3.5);
    });
    case 'ruin_wall': return iso(36, 40, 'sw', (p, ctx) => {
      const hs = [12, 15, 10, 7, 4];
      hs.forEach((h, k) => p.box(0.5 + k * 3, 6, 0, 3, 4, h + (biome.length % 2) * 2, { ramp: R6, front: (s, t, c) => (Math.round(t * h) % 3 === 0 || (Math.round(t * h / 3) + k) % 2 === 0 && s > 0.9 ? c(-1) : null) }));
      topping(ctx, p.X(4, 8), p.Y(4, 8, 15), 4);
    });
    case 'ruin_cache': return iso(32, 32, 'sw', (p, ctx) => {
      const band: Detail = (s) => (Math.abs(s - 0.2) < 0.05 || Math.abs(s - 0.8) < 0.05 ? C.e5 : null);
      p.box(2.5, 3.5, 0, 11, 8, 6.5, { ramp: WOODM, front: (s, t, c, x, y, l) => (Math.abs(s - 0.5) < 0.08 && t > 0.55 ? C.e6 : band(s, t, c, x, y, l)), end: band });
      p.box(2.2, 3.2, 6.5, 11.6, 8.6, 3, { ramp: WOODM, front: band, end: band });
      if (st.moss) blob(ctx, p.X(5, 6), p.Y(5, 6, 9.5), 3, 1.3, st.moss, { seed: 2, noise: 0.5, edgeDark: 0 });
      put(ctx, Math.round(p.X(3 + f * 9, 7)), Math.round(p.Y(3 + f * 9, 7, 10.5)), C.white);    // a glint that calls you over
    });
    case 'ruin_arch': return iso(44, 62, 'sw', (p, ctx) => {
      p.box(0.5, 5, 0, 4, 4, 30, { ramp: R6, front: joints(30, 5), end: joints(30, 5) });
      p.box(11.5, 5, 0, 4, 4, 24, { ramp: R6, front: joints(24, 5), end: joints(24, 5) });        // one leg broke lower
      p.box(-0.5, 4.5, 30, 10, 5, 3.5, { ramp: R6, front: (s, t, c) => (Math.round(s * 10) % 3 === 0 ? c(-1) : null) });   // what is left of the lintel
      p.box(9, 11, 0, 5, 4, 3.5, { ramp: R6 });                                                  // the fallen block
      topping(ctx, p.X(4, 7), p.Y(4, 7, 33.5), 5);
    });
    case 'ruin_obelisk': case 'ruin_monolith': {
      const mono = sub === 'ruin_monolith', H = mono ? 40 : 44;
      return iso(36, H + 26, 'sw', (p, ctx) => {
        p.box(2.5, 2.5, 0, 11, 11, 3, { ramp: R6 });
        if (mono) p.box(4, 6, 3, 8, 4, H - 3, { ramp: R6, front: (s, t) => (Math.abs(s - 0.5 - Math.sin(t * 9) * 0.15) < 0.05 ? (st.glow ?? C.q5) : null) });   // a glowing fault
        else {
          for (let k = 0; k < 6; k++) { const w = 7 - k * 0.6; p.box(8 - w / 2, 8 - w / 2, 3 + k * 6.5, w, w, 6.5, { ramp: R6, front: (s, t, c) => (t > 0.85 ? c(-1) : null) }); }
          p.box(6.5, 6.5, 42, 3, 3, 2, { ramp: [C.e3, C.e4, C.e5, C.e6, C.e7] });               // a gilded cap
        }
        sparks(ctx, p.X(8, 8), p.Y(8, 8, H), H - 6);
      });
    }
    default: return null;
  }
}

// ───────────────────────── farm shelters ─────────────────────────
/** A gable roof whose ridge runs along a: the near slope as a plane, the gable end as a triangle on the +a end. */
function gable(p: Prop, ctx: Ctx, a0: number, b0: number, da: number, db: number, z0: number, rise: number, roof: Ramp, wall: Ramp, oh = 1.5): void {
  const I = p.iso;
  const pt = (a: number, b: number, z: number): [number, number] => { const [u, v] = p.uv(a, b); return [I.X(u, v), I.Y(u, v, z)]; };
  // gable end (wall planks), then the near roof slope with shingle courses
  const [g0x, g0y] = pt(a0 + da, b0, z0), [g1x, g1y] = pt(a0 + da, b0 + db, z0), [gax, gay] = pt(a0 + da, b0 + db / 2, z0 + rise);
  const lit = p.facing === 'se';
  poly(ctx, [[g0x, g0y], [gax, gay], [g1x, g1y]], (x, y) => (Math.round(y) % 3 === 0 ? wall[lit ? 2 : 0]! : wall[lit ? 3 : 1]!));
  const [rx, ry] = pt(a0 - oh, b0 + db / 2, z0 + rise), [r2x, r2y] = pt(a0 + da + oh, b0 + db / 2, z0 + rise), [ex, ey] = pt(a0 - oh, b0 + db + oh, z0 - oh * rise / (db / 2));
  I.para(rx, ry, r2x - rx, r2y - ry, ex - rx, ey - ry, (s, t) => {
    const course = Math.round(t * 8) % 2 === 0;
    const n = roof.length - 1;
    return t < 0.08 ? roof[n]! : t > 0.94 ? roof[0]! : course ? roof[Math.max(0, n - 3)]! : roof[lit ? n - 2 : n - 1]!;
  });
}

function coop(face: Facing): ObjSprite {
  return iso(40, 48, face, (p, ctx) => {
    for (const [a, b] of [[2, 3], [13, 3], [2, 13], [13, 13]] as const) p.box(a, b, 0, 1.4, 1.4, 3, { ramp: DARKWOOD });   // stilts
    const walls: Detail = (s, t, c) => (Math.round(s * 13) % 3 === 0 ? c(-1) : null);
    p.box(1.5, 2.5, 3, 13, 12, 9, { ramp: LIGHTWOOD, end: walls, front: (s, t, c, x, y, l) => (s > 0.38 && s < 0.62 && t < 0.62 ? (t > 0.56 ? c(1) : C.ink) : walls(s, t, c, x, y, l)) });
    p.line(8, 15, 3, 8, 19, 0, C.e3); p.line(9, 15, 3, 9, 19, 0, C.e4);                         // the ramp
    gable(p, ctx, 1.5, 2.5, 13, 12, 12, 7, [C.r0, C.r1, C.r2, C.r3, C.r4, C.r5], LIGHTWOOD);
    p.dot(4, 15, 5, C.white); p.dot(5, 15, 5, C.e6);                                           // a curious hen at the door
  });
}

function barn(face: Facing): ObjSprite {
  return iso(56, 74, face, (p, ctx) => {
    const RED: Ramp = [C.r0, C.r1, C.r2, C.r3, C.r4, C.r5];
    const boards: Detail = (s, t, c) => (Math.round(s * 30) % 3 === 0 ? c(-1) : null);
    p.box(-6, -4, 0, 28, 24, 20, {
      ramp: RED, end: boards,
      front: (s, t, c, x, y, l) => {
        const px = s * 28, pz = t * 20;
        if (px > 8 && px < 20 && pz < 14) {                                                        // big double door with white X bracing
          if (px < 8.8 || px > 19.2 || pz > 13.2 || Math.abs(px - 14) < 0.5) return C.pale;
          const lx = (px - 8.8) / 5.2, rx = (px - 14.5) / 4.7, lz = pz / 13.2;
          if (px < 14 && (Math.abs(lx - lz) < 0.09 || Math.abs(lx - (1 - lz)) < 0.09)) return C.fog;
          if (px > 14 && (Math.abs(rx - lz) < 0.09 || Math.abs(rx - (1 - lz)) < 0.09)) return C.fog;
          return c(-1);
        }
        if (Math.abs(pz - 17) < 2 && Math.abs(px - 14) < 2.5) return Math.abs(pz - 17) > 1.4 || Math.abs(px - 14) > 2 ? C.pale : C.ink;   // hayloft window
        return boards(s, t, c, x, y, l);
      },
    });
    gable(p, ctx, -6, -4, 28, 24, 20, 13, [C.night, C.slate, C.steel, C.mist, C.fog, C.pale], RED, 2);
  });
}

// ───────────────────────── the Statue of QubitMan: a grand iso plinth ─────────────────────────
const MARB: Ramp = [C.g0, C.g1, C.g2, C.g3, C.g5, C.fog];
const GRAN: Ramp = [C.night, C.g0, C.g1, C.g2, C.g3, C.g4];
const BRONZE: Ramp = [C.e1, C.r0, C.r1, C.r4, C.r5, C.r6];

/** The plinth: a broad three-step base, a dado with bronze plaques (inscription on the lit face, a Bloch-sphere
 * emblem on the shaded one), corner pilasters and rune seams that pulse, a cornice and a cap. */
export const PLINTH = { r0: 36, r1: 31, r2: 26, dado: 22, z1: 5, z2: 10, z3: 14, z4: 36, top: 41 } as const;
export function statuePlinth(ctx: Ctx, ax: number, ay: number, f: number): void {
  const I = new Iso(ctx, ax, ay - 8);
  const P = PLINTH;
  const tier = (r: number, z: number, h: number, m: Ramp, det?: (s: number, t: number, lit: boolean) => number | null) => {
    const u0 = 8 - r, du = r * 2;
    const paint = (lit: boolean) => (s: number, t: number) => det?.(s, t, lit) ?? rampAt(m, (lit ? 0.62 : 0.3) + (t > 0.85 ? 0.16 : t < 0.12 ? -0.14 : 0));
    I.left(u0, u0 + du, z, du, h, paint(true));
    I.right(u0 + du, u0, z, du, h, paint(false));
    I.top(u0, u0, z + h, du, du, (s, t) => rampAt(m, s > 0.97 || t > 0.97 ? 0.95 : Math.abs(s - 0.28 - t * 0.16) < 0.008 && t > 0.45 ? 0.62 : 0.78));
  };
  const blocks = (s: number, t: number, lit: boolean) => (Math.round(s * 24) % 4 === 0 && t > 0.15 && t < 0.85 ? (lit ? C.slate : C.night) : null);
  tier(P.r0, 0, P.z1, GRAN, blocks);
  tier(P.r1, P.z1, P.z2 - P.z1, GRAN, blocks);
  tier(P.r2, P.z2, P.z3 - P.z2, MARB);
  const glow = [C.q4, C.q5, C.q6, C.q5][f]!;
  const W = P.dado * 2, Hd = P.z4 - P.z3;
  tier(P.dado, P.z3, Hd, MARB, (s, t, lit) => {
    if (s < 0.05 || s > 0.95) return lit ? C.g5 : C.g2;                                       // corner pilasters
    if (Math.abs(t - 0.08) < 0.03 || Math.abs(t - 0.92) < 0.03) return glow;                      // rune seams
    if (s > 0.12 && s < 0.88 && t > 0.2 && t < 0.8) {
      const e = Math.min((s - 0.12) * W, (0.88 - s) * W, (t - 0.2) * Hd, (0.8 - t) * Hd);
      if (e < 0.8) return lit ? C.e2 : C.e1;
      if (!lit) {                                                                                 // the Bloch sphere emblem
        const dx = (s - 0.5) * W, dz = (t - 0.5) * Hd, d = Math.hypot(dx, dz * 1.1);
        if (Math.abs(d - 4.6) < 0.55 || (Math.abs(dz) < 0.5 && Math.abs(dx) < 4.6) || (Math.abs(dx - dz * 0.6) < 0.5 && d < 4.6)) return glow;
      }
      return rampAt(BRONZE, (lit ? 0.58 : 0.36) + (t - 0.5) * 0.3 - (e < 1.6 ? 0.12 : 0));
    }
    return null;
  });
  tier(P.dado + 2, P.z4, 3, MARB);                                                                // cornice
  tier(P.dado - 1, P.z4 + 3, P.top - P.z4 - 3, GRAN);                                            // cap
}

/** Write on the lit plaque: each letter upright, stepped down the iso slope (1px per 2px across), engraved. */
export function statueInscription(ctx: Ctx, ax: number, ay: number, lines: string[], write: (ctx: Ctx, text: string, x: number, y: number, c: number) => number): void {
  const I = new Iso(ctx, ax, ay - 8);
  const P = PLINTH, v = 8 + P.dado;
  const zTop = P.z3 + (P.z4 - P.z3) * 0.75;
  lines.forEach((text, k) => {
    const step = 4, w = text.length * step - 1, u0 = 8 - w / 2;
    [...text].forEach((ch, n) => {
      const x = Math.round(I.X(u0 + n * step, v)), y = Math.round(I.Y(u0 + n * step, v, zTop - k * 7));
      write(ctx, ch, x, y + 1, C.e7);                                                               // highlight lip
      write(ctx, ch, x, y, C.e0);                                                                   // the cut letter
    });
  });
}

// ───────────────────────── registry ─────────────────────────
type Mk = (face: Facing) => ObjSpriteDef;
const one = (fn: (face: Facing) => ObjSprite, o: Partial<ObjSpriteDef> = {}): Mk => (face) => ({ frames: [fn(face)], fps: 0, ...o });
const anim = (n: number, fps: number, fn: (face: Facing, f: number) => ObjSprite, o: Partial<ObjSpriteDef> = {}): Mk => (face) => ({ frames: nf(n, (f) => fn(face, f)), fps, ...o });

/** Isometric props by sub. Each takes the wall it backs onto. */
export const PROPS: Record<string, Mk> = {
  bookcase: one(bookcase), wardrobe: one(wardrobe), shelf: one(shelf),
  table: one((f) => table(f)), desk: one(desk), counter: one(counter),
  chair: one(chair), stool: one(stool), bed: one(bed), bench: one(bench), rug: one(rug, { noShadow: true }),
  crate: one(crate), chest: one(chest), barrel: one(barrel), basket: one(basket),
  hearth: anim(3, 6, hearth), stove: anim(2, 4, stove), furnace: anim(2, 4, furnace), forge: anim(3, 5, forge),
  cauldron: anim(3, 3, cauldron), cooking_pot: anim(3, 4, cookingPot),
  workbench: one(workbench), carpenter: one(carpenter), jeweler: one(jeweler), alchemy: anim(2, 2, alchemy), loom: one(loom),
  rack: one(rack), board: one(board), trophy: one(trophy),
  candles: anim(2, 5, candles), lamp: anim(2, 3, floorLamp), plant: one(plant, { sway: 0.01 }),
  stall: anim(2, 1.2, stall), planter: one(planter, { sway: 0.01 }), hay: one(hay), trough: one(trough), woodpile: one(woodpile),
  shrine_altar: anim(4, 3, shrineAltar), shrine_pillar: one(shrinePillar),
  coop: one(coop), barn: one(barn), banner: anim(2, 2, banner), laundry: anim(2, 1.5, laundry), plaque: one(plaque),
  mailbox: one(mailbox), signpost: one(signpost), sign: one(sign), well: one(well), cart: one(cart), hedge: one(hedge), beehive: one(beehive),
};
