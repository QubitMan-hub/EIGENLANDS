/**
 * Isometric art for the catalog's placeables (stations, furniture, decor, pens). Each row of shared/catalog/home.ts names a
 * shape and two material ramps; the shapes are drawn here with the prop kit, so a new piece of furniture is one data row
 * unless it needs a new shape. Everything sits on its tile's floor diamond and backs onto the wall it faces.
 */
import { PROP_SPECS, type PropShape, type PropSpec, type RampKey } from '@eigenlands/shared';
import { blob, C, put, type Ramp } from './shade';
import { DARKWOOD, IRONM, STONEM, WOODM, type Facing } from './isokit';
import { BRASS, BRONZE, FIRE, LEAF, LINEN, PROPS, STRAW, anim, iso as baseIso, one, type Mk } from './props';
import type { ObjSprite } from './objects';
import { paintStatue } from './body/statues';
import { DIR_DOWN_LEFT, DIR_DOWN_RIGHT } from './actors';

const RAMPS: Record<RampKey, Ramp> = {
  oak: [C.e1, C.e2, C.e3, C.e4, C.e5, C.e6],
  pine: [C.e2, C.e3, C.e4, C.e5, C.e6, C.e7],
  birch: [C.e3, C.e5, C.e6, C.e7, C.pale, C.white],
  cedar: [C.r0, C.r1, C.r2, C.r3, C.e3, C.e4],
  ebony: [C.ink, C.night, C.e0, C.e1, C.e2, C.e3],
  ironwood: [C.e0, C.g0, C.g1, C.e2, C.e3, C.g3],
  willow: [C.g1, C.g2, C.e3, C.e4, C.g4, C.e5],
  bamboo: [C.g2, C.g3, C.g4, C.g5, C.e6, C.e7],
  stone: STONEM,
  marble: [C.mist, C.fog, C.pale, C.pale, C.white, C.white],
  granite: [C.ink, C.night, C.slate, C.steel, C.mist, C.fog],
  sandstone: [C.e2, C.e3, C.e4, C.e5, C.e6, C.e7],
  brick: [C.r0, C.r1, C.r2, C.r3, C.r4, C.r5],
  iron: IRONM,
  brass: BRASS,
  copper: [C.e1, C.r1, C.r2, C.r3, C.r4, C.e6],
  linen: LINEN,
  wool: [C.mist, C.fog, C.pale, C.white, C.white, C.white],
  crimson: [C.r0, C.r1, C.r2, C.r3, C.r4, C.r5],
  azure: [C.w0, C.w1, C.w2, C.w3, C.w4, C.w5],
  violet: [C.q0, C.q1, C.q2, C.q3, C.q4, C.q5],
  forest: LEAF,
  gold: [C.e3, C.e4, C.e5, C.e6, C.e7, C.white],
  straw: STRAW,
  bronze: BRONZE,
};
const GLASS: Ramp = [C.w1, C.w3, C.w4, C.w5, C.w6, C.white];
const darker = (r: Ramp): Ramp => [r[0]!, r[0]!, r[1]!, r[2]!, r[3]!, r[4]!];

type Draw = (s: { main: Ramp; trim: Ramp; tint: number }, face: Facing, f: number) => ObjSprite;
const m = (ramp: Ramp) => ({ ramp });
const flame = (f: number, h = 0): number => (f % 2 ? C.e7 : C.r6) - h * 0;

const iso: typeof baseIso = (w, h, face, draw, options = {}) =>
  baseIso(w + 8, h + 8, face, draw, { ...options, margin: (options.margin ?? 10) + 4 });

const SHAPES: Partial<Record<PropShape, { frames?: number; fps?: number; draw: Draw }>> = {
  table: {
    draw: (s, face) =>
      iso(40, 36, face, (p) => {
        for (const [a, b] of [
          [2.5, 4.5],
          [13.5, 4.5],
          [2.5, 11.5],
          [13.5, 11.5],
        ] as const)
          p.box(a - 0.8, b - 0.8, 0, 1.6, 1.6, 9, m(darker(s.main)));
        p.box(0.5, 3, 9, 15, 10, 1.6, m(s.main));
        p.box(1.5, 4, 10.6, 13, 8, 0.4, { ramp: s.trim, rim: false });
      }),
  },
  table_round: {
    draw: (s, face) =>
      iso(36, 34, face, (p) => {
        p.cyl(8, 8, 0, 3.6, 1.2, s.main, s.main);
        p.cyl(8, 8, 1, 1.4, 8, darker(s.main), darker(s.main));
        p.cyl(8, 8, 9, 6.6, 1.6, s.main, s.trim);
      }),
  },
  desk: {
    draw: (s, face) =>
      iso(42, 40, face, (p) => {
        p.box(1.5, 3, 0, 5, 10, 9.5, m(darker(s.main)));
        for (const [a, b] of [
          [12.5, 4],
          [12.5, 12],
        ] as const)
          p.box(a, b - 0.8, 0, 1.6, 1.6, 9.5, m(darker(s.main)));
        p.box(1, 2.5, 9.5, 14, 11, 1.5, m(s.main));
        p.box(2, 3, 11, 12, 3, 4, m(s.trim));
        p.box(3, 3.5, 11.4, 4, 1, 2, { ramp: LINEN });
        p.dot(4, 8, 12, C.r3, 2, 1);
        for (const z of [3, 6.5]) p.dot(3.5, 3, z, C.e7);
      }),
  },
  cabinet: {
    draw: (s, face) =>
      iso(36, 56, face, (p) => {
        p.box(2, 3, 0, 12, 6.5, 24, {
          ramp: s.main,
          front: (u, t, c) =>
            Math.abs(u - 0.5) < 0.03 || u < 0.06 || u > 0.94 || t < 0.06 || t > 0.94
              ? c(-2)
              : u > 0.18 && u < 0.82 && t > 0.1 && t < 0.9 && (u < 0.46 || u > 0.54)
                ? c(0)
                : c(1),
        });
        p.box(1.4, 2.4, 24, 13.2, 7.6, 2, m(s.main));
        p.dot(7, 3, 12, C.e7, 1, 2);
        p.dot(9, 3, 12, C.e7, 1, 2);
        p.box(2, 3, 0, 12, 6.5, 1.5, m(darker(s.main)));
      }),
  },
  dresser: {
    draw: (s, face) =>
      iso(40, 40, face, (p) => {
        p.box(1.5, 3, 0, 13, 7, 14, {
          ramp: s.main,
          front: (u, t, c) =>
            t < 0.06 || t > 0.94 || Math.abs(t - 0.34) < 0.025 || Math.abs(t - 0.66) < 0.025 || u < 0.05 || u > 0.95
              ? c(-2)
              : c(0),
        });
        p.box(1, 2.5, 14, 14, 8, 1.6, m(s.main));
        for (const z of [3, 7.5, 12]) {
          p.dot(5, 3, z - 0.5, C.e7, 1, 1);
          p.dot(11, 3, z - 0.5, C.e7, 1, 1);
        }
      }),
  },
  wardrobe: {
    draw: (s, face) =>
      iso(38, 62, face, (p) => {
        p.box(2, 3, 0, 12, 7, 30, {
          ramp: s.main,
          front: (u, t, c) =>
            Math.abs(u - 0.5) < 0.025 || u < 0.05 || u > 0.95 || t < 0.04 || t > 0.96
              ? c(-2)
              : u > 0.1 &&
                  u < 0.9 &&
                  t > 0.08 &&
                  t < 0.92 &&
                  ((Math.floor(t * 8) + (u > 0.5 ? 1 : 0)) % 2 === 0 ? false : true)
                ? c(1)
                : c(0),
        });
        p.box(1.3, 2.3, 30, 13.4, 8.4, 2, m(s.main));
        p.dot(7, 3, 14, C.e7, 1, 2);
        p.dot(9, 3, 14, C.e7, 1, 2);
      }),
  },
  chest: {
    draw: (s, face) =>
      iso(34, 30, face, (p) => {
        p.box(2.5, 3.5, 0, 11, 9, 7, {
          ramp: s.main,
          front: (u, t, c) => (u < 0.1 || u > 0.9 || t < 0.1 ? c(-2) : c(0)),
        });
        p.box(2, 3, 7, 12, 10, 3.2, m(s.main));
        for (const a of [3.5, 11]) p.box(a, 2.8, 0, 1.5, 10.4, 10.2, m(s.trim));
        p.dot(8, 3.2, 6.5, C.e7, 2, 2);
      }),
  },
  bed: {
    draw: (s, face) =>
      iso(48, 44, face, (p) => {
        p.box(1, 0, 0, 14, 1.2, 12, m(s.main));
        for (const u of [1, 13.5]) for (const v of [1, 17.5]) p.box(u, v, 0, 1.5, 1.5, 5, m(s.main));
        p.box(1, 1, 3, 14, 18, 2, m(s.main));
        p.box(2, 1.5, 5, 12, 16.5, 2, { ramp: LINEN });
        p.box(3, 2, 7, 10, 3.5, 1.5, { ramp: LINEN });
        p.box(1.8, 6, 7, 12.4, 12, 1, { ramp: [C.slate, s.tint - 2, s.tint - 1, s.tint, s.tint, C.pale] });
        p.box(1, 18.5, 2, 14, 1, 5, m(s.main));
      }),
  },
  bed_canopy: {
    draw: (s, face) =>
      iso(52, 78, face, (p) => {
        p.box(1, 0, 0, 14, 1.2, 15, m(s.main));
        for (const u of [1, 13.5]) for (const v of [0.5, 17.5]) p.box(u, v, 0, 1.5, 1.5, 36, m(s.main));
        p.box(1, 1, 3, 14, 18, 2, m(s.main));
        p.box(2, 1.5, 5, 12, 16.5, 2, { ramp: LINEN });
        p.box(1.8, 6, 7, 12.4, 12, 1, { ramp: [C.q1, C.q2, C.q3, s.tint, C.q5, C.pale] });
        p.box(1, 0.5, 36, 14, 18, 1.4, m(s.main));
        p.box(1.2, 0.5, 26, 1.2, 18, 10, { ramp: [C.q1, C.q2, C.q3, s.tint, C.q5, C.pale], rim: false });
        p.box(13.6, 0.5, 26, 1.2, 18, 10, { ramp: [C.q1, C.q2, C.q3, s.tint, C.q5, C.pale], rim: false });
      }),
  },
  hammock: {
    draw: (s, face) =>
      iso(46, 40, face, (p) => {
        for (const a of [1.5, 14]) p.box(a, 7.2, 0, 1.4, 1.6, 20, m(s.main));
        for (let k = 0; k < 6; k++) {
          const t = k / 5,
            z = 12 - Math.sin(t * Math.PI) * 5;
          p.box(2.5 + k * 2, 6, z, 2.4, 4, 0.8, { ramp: [C.e1, C.e3, C.e4, s.tint, C.e7, C.pale], rim: false });
        }
        p.line(1.5, 8, 19, 3, 8, 12.5, C.e5);
        p.line(14.8, 8, 19, 13.5, 8, 12.5, C.e5);
      }),
  },
  cradle: {
    draw: (s, face) =>
      iso(34, 30, face, (p) => {
        p.box(3, 3, 0, 10, 1.2, 2, m(darker(s.main)));
        p.box(3, 11, 0, 10, 1.2, 2, m(darker(s.main)));
        p.box(3.5, 4, 2, 9, 7.5, 3, m(s.main));
        p.box(4.5, 5, 5, 7, 5.5, 1.2, { ramp: LINEN });
        p.box(3.5, 3.5, 2, 9, 0.8, 8, m(s.main));
        p.box(3.5, 11, 2, 9, 0.8, 5, m(s.main));
      }),
  },
  armchair: {
    draw: (s, face) =>
      iso(32, 38, face, (p) => {
        for (const [a, b] of [
          [3, 4],
          [13, 4],
          [3, 12],
          [13, 12],
        ] as const)
          p.box(a - 0.7, b - 0.7, 0, 1.4, 1.4, 4, m(darker(s.main)));
        p.box(2.5, 3.5, 4, 11, 9, 2.2, m(s.main));
        p.box(3, 4, 6.2, 10, 8, 2.4, { ramp: [C.slate, s.tint - 2, s.tint - 1, s.tint, s.tint, C.pale] });
        p.box(2.5, 3.5, 6.2, 11, 2, 11, { ramp: [C.slate, s.tint - 2, s.tint - 1, s.tint, s.tint, C.pale] });
        for (const a of [2.5, 13]) p.box(a, 4, 6.2, 1.5, 8, 4, m(s.main));
      }),
  },
  garden_bench: {
    draw: (s, face) =>
      iso(40, 34, face, (p) => {
        for (const a of [1.5, 13.5]) {
          p.box(a, 4.5, 0, 1.4, 6, 6, m(s.trim));
          p.box(a, 3.8, 6, 1.4, 1.2, 9, m(s.trim));
        }
        for (let k = 0; k < 3; k++) p.box(0.5, 4.5 + k * 2.2, 6, 15, 1.7, 1, m(s.main));
        for (let k = 0; k < 2; k++) p.box(0.5, 3.6, 9 + k * 3.2, 15, 0.9, 2, m(s.main));
      }),
  },
  candelabra: {
    frames: 2,
    fps: 4,
    draw: (s, face, f) =>
      iso(30, 46, face, (p, ctx) => {
        p.cyl(8, 8, 0, 3, 1.4, s.main, s.main);
        p.cyl(8, 8, 1, 0.7, 14, s.main, s.main);
        p.line(4, 8, 15, 12, 8, 15, s.main[4]!);
        for (const a of [4, 6, 8, 10, 12]) {
          const z = 15 + (a === 8 ? 3 : Math.abs(a - 8) < 3 ? 1 : 0);
          p.cyl(a, 8, z, 0.7, 4, LINEN, [C.white]);
          put(ctx, Math.round(p.X(a, 8)), Math.round(p.Y(a, 8, z + 5 + ((a + f) % 2))), flame(f + a));
        }
      }),
  },
  chandelier: {
    frames: 2,
    fps: 4,
    draw: (s, face, f) =>
      iso(40, 70, face, (p, ctx) => {
        p.box(6.5, 6.5, 0, 3, 3, 2, m(s.main));
        p.box(7.4, 7.4, 2, 1.2, 1.2, 28, m(s.main));
        p.box(4, 7.4, 30, 8, 1.2, 1, m(s.main));
        p.box(7.4, 4, 30, 1.2, 8, 1, m(s.main));
        for (const [a, b] of [
          [4, 8],
          [12, 8],
          [8, 4],
          [8, 12],
          [5.5, 5.5],
          [10.5, 10.5],
        ] as const) {
          p.cyl(a, b, 31, 0.8, 3, LINEN, [C.white]);
          put(ctx, Math.round(p.X(a, b)), Math.round(p.Y(a, b, 35 + ((a + f) % 2))), flame(f + a));
        }
      }),
  },
  sconce: {
    frames: 2,
    fps: 4,
    draw: (s, face, f) =>
      iso(26, 44, face, (p, ctx) => {
        p.box(6, 0.3, 14, 4, 1, 8, m(s.main));
        p.box(6.8, 1, 18, 2.4, 3, 1, m(s.main));
        p.cyl(8, 3.6, 19, 1.2, 4, s.main, s.main);
        put(ctx, Math.round(p.X(8, 3.6)), Math.round(p.Y(8, 3.6, 24 + (f % 2))), flame(f));
        put(ctx, Math.round(p.X(8, 3.6)), Math.round(p.Y(8, 3.6, 23)), C.e7);
      }),
  },
  brazier: {
    frames: 3,
    fps: 7,
    draw: (s, face, f) =>
      iso(34, 46, face, (p, ctx) => {
        for (const [a, b] of [
          [4.5, 4.5],
          [11.5, 4.5],
          [8, 12],
        ] as const)
          p.line(a, b, 0, 8, 8, 8, s.main[3]!);
        p.cyl(8, 8, 8, 5.6, 3, s.main, [C.night, C.r2, C.r3]);
        for (let k = 0; k < 3; k++) {
          const a = 6 + k * 2;
          for (let z = 0; z < 5 + (k === 1 ? 2 : 0); z++)
            put(
              ctx,
              Math.round(p.X(a, 8)) + ((f + k + z) % 2) - 1,
              Math.round(p.Y(a, 8, 12 + z)),
              FIRE[Math.min(5, z + (f % 2))]!,
            );
        }
      }),
  },
  fireplace: {
    frames: 3,
    fps: 7,
    draw: (s, face, f) =>
      iso(44, 62, face, (p, ctx) => {
        p.box(1, 1, 0, 14, 8, 26, {
          ramp: s.main,
          front: (u, t, c) => (u > 0.22 && u < 0.78 && t > 0.06 && t < 0.52 ? C.ink : c(0)),
        });
        p.box(0, 0.5, 26, 16, 9, 2, m(s.trim));
        p.box(5, 3, 0, 6, 5, 1, { ramp: [C.night, C.r1, C.r2, C.r3, C.r4, C.r5], rim: false });
        for (let k = 0; k < 3; k++)
          for (let z = 0; z < 5 + (k === 1 ? 2 : 0); z++)
            put(
              ctx,
              Math.round(p.X(6.5 + k * 1.6, 5)) + ((f + k + z) % 2) - 1,
              Math.round(p.Y(6.5 + k * 1.6, 5, 2 + z)),
              FIRE[Math.min(5, z + (f % 2))]!,
            );
        p.box(5, 3, 28, 6, 5, 14, m(s.main));
      }),
  },
  stone_lantern: {
    draw: (s, face) =>
      iso(30, 56, face, (p) => {
        p.cyl(8, 8, 0, 3.8, 2, s.main, s.main);
        p.cyl(8, 8, 2, 1.6, 8, s.main, s.main);
        p.box(5.2, 5.2, 10, 5.6, 5.6, 2, m(s.main));
        p.box(5.8, 5.8, 12, 4.4, 4.4, 6, { ramp: [C.e1, C.e3, C.e5, C.e6, C.e7, C.white], rim: false });
        p.box(4.6, 4.6, 18, 6.8, 6.8, 2, m(s.main));
        p.box(5.8, 5.8, 20, 4.4, 4.4, 2, m(s.main));
        p.dot(8, 8, 24, s.main[4]!, 2, 1);
      }),
  },
  clock: {
    draw: (s, face) =>
      iso(34, 76, face, (p, ctx) => {
        p.box(4, 4, 0, 8, 8, 5, m(s.main));
        p.box(5, 5, 5, 6, 6, 26, {
          ramp: s.main,
          front: (u, t, c) => (u > 0.25 && u < 0.75 && t > 0.12 && t < 0.62 ? C.ink : c(0)),
        });
        p.box(4, 4, 31, 8, 8, 8, m(s.main));
        p.box(5.5, 4.2, 33, 5, 0.6, 5, { ramp: [C.e5, C.pale, C.white, C.white] });
        p.line(8, 4, 35, 8, 4, 37, C.ink);
        p.line(8, 4, 35, 10, 4, 35, C.ink);
        p.box(7.4, 5, 14, 1.2, 0.6, 9, m(s.trim));
        p.cyl(8, 5.4, 12, 1.4, 1, s.trim, s.trim);
        void ctx;
      }),
  },
  globe: {
    draw: (s, face) =>
      iso(34, 44, face, (p, ctx) => {
        for (const [a, b] of [
          [4, 4],
          [12, 4],
          [8, 12],
        ] as const)
          p.line(a, b, 0, 8, 8, 8, s.main[3]!);
        p.cyl(8, 8, 0, 3.4, 1, s.main, s.main);
        blob(ctx, p.X(8, 8), p.Y(8, 8, 15), 7, 7, [C.w1, C.w3, C.w4, C.w5], { seed: 3, noise: 0.18, edgeDark: 0.3 });
        for (const [dx, dy] of [
          [-2, -2],
          [2, 1],
          [0, 3],
          [-3, 2],
        ] as const)
          put(ctx, Math.round(p.X(8, 8)) + dx, Math.round(p.Y(8, 8, 15)) + dy, C.g4, 2, 2);
        p.line(2, 8, 18, 14, 8, 6, s.trim[4]!);
      }),
  },
  telescope: {
    draw: (s, face) =>
      iso(40, 52, face, (p) => {
        for (const [a, b] of [
          [4, 4],
          [12, 4],
          [8, 13],
        ] as const)
          p.line(a, b, 0, 8, 8, 12, s.trim[4]!);
        p.box(6.8, 6.8, 11, 2.4, 2.4, 2, m(s.main));
        p.box(1, 6.5, 13, 12, 3, 3, m(s.main));
        p.box(0, 6.2, 12.6, 2.5, 3.6, 3.8, m(s.trim));
        p.box(12, 6.6, 13.2, 1.6, 2.8, 2.6, m(s.main));
      }),
  },
  armor_stand: {
    draw: (s, face) =>
      iso(34, 64, face, (p, ctx) => {
        p.box(4, 4, 0, 8, 8, 1.6, m(s.main));
        p.box(7.4, 7.4, 1.6, 1.2, 1.2, 10, m(s.main));
        p.box(5, 6.5, 11, 6, 3, 12, m(IRONM));
        p.box(2.5, 7, 19, 11, 2, 2.4, m(IRONM));
        p.box(5.5, 6.8, 22, 5, 2.4, 3, m(s.main));
        blob(ctx, p.X(8, 8), p.Y(8, 8, 28.5), 3.4, 3.4, [C.slate, C.steel, C.mist, C.fog], { seed: 4, noise: 0.08 });
        p.dot(8, 6.5, 28, C.ink, 3, 1);
        p.dot(8, 6.5, 12, C.r3, 1, 8);
      }),
  },
  weapon_rack: {
    draw: (s, face) =>
      iso(40, 56, face, (p) => {
        for (const a of [1, 14]) p.box(a, 2, 0, 1.4, 1.6, 24, m(s.main));
        for (const z of [10, 20]) p.box(0.8, 2, z, 14.4, 1.4, 1.2, m(s.main));
        for (const [a, h] of [
          [3.5, 18],
          [6, 14],
          [9, 20],
          [11.5, 16],
        ] as const) {
          p.box(a, 3.2, 2, 0.9, 0.9, h, m(IRONM));
          p.box(a - 0.6, 3.1, 2 + h * 0.4, 2.1, 1.1, 1.1, m(s.main));
        }
        p.box(12.4, 3.2, 3, 0.9, 0.9, 22, m(s.main));
      }),
  },
  display_case: {
    draw: (s, face) =>
      iso(36, 44, face, (p) => {
        for (const [a, b] of [
          [2, 4],
          [13.5, 4],
          [2, 11.5],
          [13.5, 11.5],
        ] as const)
          p.box(a, b, 0, 1.4, 1.4, 9, m(darker(s.main)));
        p.box(1.5, 3.5, 9, 13, 9, 1.5, m(s.main));
        p.box(2, 4, 10.5, 12, 8, 7, { ramp: GLASS, rim: false });
        p.box(1.5, 3.5, 17.5, 13, 9, 1.4, m(s.main));
        p.dot(8, 7, 11, C.e7, 2, 2);
        p.dot(8, 7, 12.6, C.white, 1, 1);
      }),
  },
  mirror: {
    draw: (s, face) =>
      iso(30, 62, face, (p) => {
        for (const a of [3, 11]) p.box(a, 5, 0, 2, 3, 3, m(s.main));
        p.box(2.5, 5.4, 3, 11, 2, 28, m(s.main));
        p.box(4, 7.1, 5, 8, 0.6, 24, {
          ramp: GLASS,
          rim: false,
          front: (u, t, c) => (Math.round(u * 10 + t * 14) % 9 === 0 ? C.white : c(0)),
        });
      }),
  },
  harp: {
    draw: (s, face) =>
      iso(34, 66, face, (p) => {
        p.box(5, 6, 0, 6, 4, 2, m(s.main));
        p.box(5.4, 6.6, 2, 1.4, 2, 28, m(s.main));
        p.box(5, 6.4, 28, 8, 2.4, 2.6, m(s.main));
        p.line(6.2, 7.5, 6, 12.6, 7.5, 28, s.trim[5]!);
        for (let k = 0; k < 6; k++) p.line(7 + k * 0.9, 7.5, 7 + k * 3.4, 7 + k * 0.9, 7.5, 28 - k * 0.6, C.pale);
        p.box(9.8, 6.4, 0.6, 1.2, 2.4, 6, m(s.main));
      }),
  },
  music_box: {
    draw: (s, face) =>
      iso(28, 28, face, (p) => {
        p.box(3, 5, 0, 10, 6, 6, m(s.main));
        p.box(2.6, 4.6, 6, 10.8, 6.8, 1.6, m(s.trim));
        p.dot(13, 8, 4, C.e7, 1, 3);
        p.box(5, 6, 7.6, 3, 3, 3, { ramp: s.trim });
        p.dot(6, 7, 11, C.e7);
      }),
  },
  statue: {
    draw: (s, face) =>
      iso(36, 76, face, (p, ctx) => {
        p.box(3, 3, 0, 10, 10, 4, m(darker(s.trim)));
        p.box(4, 4, 4, 8, 8, 4, m(s.trim));
        // the figure: the shared body (art/body/statues.ts) at three-quarter life size
        paintStatue(
          ctx,
          'garden',
          face === 'sw' ? DIR_DOWN_LEFT : DIR_DOWN_RIGHT,
          { w: 36, h: 76, ax: Math.round(p.X(8, 8)), ay: Math.round(p.Y(8, 8, 8)), k: 0.75 },
          s.main,
        );
      }),
  },
  bird_bath: {
    draw: (s, face) =>
      iso(30, 44, face, (p) => {
        p.cyl(8, 8, 0, 4, 2, s.main, s.main);
        p.cyl(8, 8, 2, 1.6, 10, s.main, s.main);
        p.cyl(8, 8, 12, 6, 2.6, s.main, [C.w2, C.w4, s.tint]);
        p.dot(8, 8, 15, C.white, 1, 1);
      }),
  },
  sundial: {
    draw: (s, face) =>
      iso(30, 40, face, (p) => {
        p.box(4, 4, 0, 8, 8, 4, m(darker(s.main)));
        p.cyl(8, 8, 4, 4.4, 5, s.main, s.main);
        p.line(8, 8, 9, 12, 5, 13, s.trim[4]!);
        p.line(8, 8, 9, 8, 5, 12, s.trim[3]!);
        p.dot(8, 8, 9, C.ink, 1, 1);
      }),
  },
  trellis: {
    draw: (s, face) =>
      iso(40, 58, face, (p) => {
        for (const a of [1.5, 14]) p.box(a, 7, 0, 1.2, 1.2, 28, m(s.main));
        for (let z = 6; z < 28; z += 6) p.line(1.5, 7.5, z, 14.5, 7.5, z, s.main[4]!);
        for (let a = 4; a < 14; a += 3.5) p.line(a, 7.5, 0, a + 1.5, 7.5, 28, s.main[3]!);
        for (const [a, z] of [
          [4, 6],
          [8, 14],
          [11, 22],
          [6, 24],
          [12, 8],
          [3, 18],
        ] as const)
          p.dot(a, 7.4, z, s.trim[3]!, 2, 2);
        for (const [a, z] of [
          [5, 8],
          [9, 20],
          [13, 15],
        ] as const)
          p.dot(a, 7.3, z, C.r4, 1, 1);
      }),
  },
  topiary: {
    draw: (s, face) =>
      iso(32, 46, face, (p, ctx) => {
        p.cyl(8, 8, 0, 4, 5, s.main, [C.e1, C.e2]);
        p.cyl(8, 8, 5, 1, 4, [C.e1, C.e2, C.e3], [C.e3]);
        blob(ctx, p.X(8, 8), p.Y(8, 8, 15), 6.4, 6.2, s.trim.slice(1, 6) as number[], {
          seed: 5,
          noise: 0.14,
          edgeDark: 0.3,
        });
      }),
  },
  banner: {
    draw: (s, face) =>
      iso(34, 74, face, (p) => {
        p.box(7.4, 7.4, 0, 1.2, 1.2, 40, m(s.main));
        p.box(2.5, 7.4, 36, 11, 1.2, 1.4, m(s.main));
        p.box(3, 7.2, 14, 10, 0.8, 22, {
          ramp: s.trim,
          rim: false,
          front: (u, t, c) =>
            u > 0.35 && u < 0.65 && t > 0.45 && t < 0.78
              ? s.tint
              : t < 0.08
                ? c(-2)
                : Math.abs(u - 0.5) < 0.5 - t * 0.5 + 0.02
                  ? c(1)
                  : null,
        });
        p.box(7.4, 7.4, 40, 1.2, 1.2, 1.6, m(s.trim));
      }),
  },
  tapestry: {
    draw: (s, face) =>
      iso(38, 54, face, (p) => {
        p.box(1.5, 0.2, 29, 13, 0.8, 1.2, m(IRONM));
        p.box(2, 0.3, 10, 12, 0.6, 19, {
          ramp: s.trim,
          rim: false,
          front: (u, t, c) =>
            u < 0.07 || u > 0.93
              ? C.e6
              : Math.floor(t * 9) % 2 === 0 && u > 0.2 && u < 0.8
                ? s.tint
                : (Math.floor(u * 6) + Math.floor(t * 9)) % 2
                  ? c(1)
                  : c(-1),
        });
      }),
  },
  barrel: {
    draw: (s, face) =>
      iso(30, 40, face, (p) => {
        p.cyl(8, 8, 0, 5, 14, s.main, s.main, (t) =>
          Math.abs(t - 0.2) < 0.05 || Math.abs(t - 0.78) < 0.05 ? C.slate : null,
        );
        p.box(12.5, 7, 6, 3, 1.4, 1, m(s.trim));
        p.cyl(8, 8, 14, 3.6, 0.4, [C.w2, C.w3, C.w4], [C.w3, C.w4, C.w5]);
      }),
  },
  pen: {
    draw: (s, face) =>
      iso(52, 52, face, (p, ctx) => {
        p.box(0.5, 0.5, 0, 15, 15, 0, { ramp: STRAW, rim: false });
        for (const [a, b] of [
          [1, 1],
          [8, 1],
          [15, 1],
          [1, 8],
          [15, 8],
          [1, 15],
          [8, 15],
          [15, 15],
        ] as const)
          p.box(a - 0.6, b - 0.6, 0, 1.2, 1.2, 8, m(s.main));
        for (const z of [3, 6]) {
          p.box(1, 0.4, z, 14, 0.8, 0.8, m(s.main));
          p.box(0.4, 1, z, 0.8, 14, 0.8, m(s.main));
          p.box(1, 14.8, z, 14, 0.8, 0.8, m(s.main));
          p.box(14.8, 1, z, 0.8, 14, 0.8, m(s.main));
        }
        for (const [a, b] of [
          [5, 6],
          [10, 9],
          [6, 11],
        ] as const) {
          blob(ctx, p.X(a, b), p.Y(a, b, 4), 5.2, 3.8, [C.slate, s.tint - 1, s.tint, Math.min(63, s.tint + 1)], {
            seed: a * b,
            noise: 0.12,
          });
          put(ctx, Math.round(p.X(a, b)) - 4, Math.round(p.Y(a, b, 5)) - 1, C.ink, 1, 1);
          put(ctx, Math.round(p.X(a, b)) - 5, Math.round(p.Y(a, b, 4)), C.ink, 1, 1);
        }
        p.box(10.5, 1.5, 0, 4, 4, 8, m(s.main));
        p.box(10, 1, 8, 5, 5, 1.4, m(s.trim));
      }),
  },
  apiary: {
    draw: (s, face) =>
      iso(46, 52, face, (p, ctx) => {
        for (const a of [2, 9.5]) {
          p.box(a, 4, 0, 4.6, 8, 3, m(s.main));
          for (let k = 0; k < 3; k++)
            p.cyl(a + 2.3, 8, 3 + k * 3, 3.2 - k * 0.6, 3, [C.e3, C.e5, C.e6, C.e7], [C.e6, C.e7]);
          put(ctx, Math.round(p.X(a + 2.3, 8)), Math.round(p.Y(a + 2.3, 8, 6)), C.ink, 2, 1);
        }
        p.box(1.5, 12.5, 0, 13, 1.4, 6, m(s.trim));
        for (const [a, z] of [
          [4, 16],
          [11, 14],
        ] as const)
          put(ctx, Math.round(p.X(a, 6)), Math.round(p.Y(a, 6, z)), C.e7, 1, 1);
      }),
  },
  // ── stations
  masonry: {
    draw: (s, face) =>
      iso(46, 44, face, (p) => {
        p.box(1, 3, 0, 14, 10, 8, m(darker(s.main)));
        p.box(0.5, 2.5, 8, 15, 11, 1.6, m(s.main));
        p.box(2, 4, 9.6, 5, 4, 4, m(s.main));
        p.box(9, 6, 9.6, 5, 4, 2.6, m(s.main));
        p.box(7.4, 11, 9.6, 0.8, 0.8, 5, m(s.trim));
        p.box(7.8, 11, 14.4, 3, 0.8, 0.8, m(IRONM));
      }),
  },
  tannery: {
    draw: (s, face) =>
      iso(48, 56, face, (p) => {
        for (const a of [1.5, 13.5]) {
          p.line(a, 5, 0, a + (a < 8 ? 3 : -3), 8, 22, s.main[4]!);
          p.line(a, 11, 0, a + (a < 8 ? 3 : -3), 8, 22, s.main[3]!);
        }
        p.box(2, 7.2, 20, 12, 1.2, 1.4, m(s.main));
        p.box(3, 7.3, 6, 10, 0.6, 14, {
          ramp: [C.e1, C.e2, C.e3, C.e4, C.e5, C.e6],
          rim: false,
          front: (u, t, c) =>
            u < 0.08 || u > 0.92 || t < 0.06 ? c(-1) : (Math.floor(u * 7) + Math.floor(t * 9)) % 5 === 0 ? c(-1) : c(0),
        });
        p.box(1, 3, 0, 14, 3, 3, m(s.main));
      }),
  },
  oven: {
    frames: 3,
    fps: 6,
    draw: (s, face, f) =>
      iso(48, 56, face, (p, ctx) => {
        p.box(1, 2, 0, 14, 10, 6, m(darker(s.main)));
        p.cyl(8, 7, 6, 6.4, 4, s.main, s.main);
        p.cyl(8, 7, 10, 5, 3, s.main, s.main);
        p.cyl(8, 7, 13, 3, 3, s.main, s.main);
        p.box(5.5, 1.4, 1.5, 5, 1.2, 4, { ramp: [C.ink, C.night, C.r1, C.r2], rim: false });
        p.box(6.5, 1.4, 6, 3, 1.2, 3, { ramp: [C.ink, C.r1, C.r3, C.r5], rim: false });
        for (let z = 0; z < 4; z++)
          put(
            ctx,
            Math.round(p.X(8, 1.6)) + ((f + z) % 2) - 1,
            Math.round(p.Y(8, 1.6, 2 + z)),
            FIRE[Math.min(5, z + (f % 2))]!,
          );
        p.cyl(8, 7, 16, 1.1, 5, s.trim, s.trim);
      }),
  },
  brewery: {
    draw: (s, face) =>
      iso(54, 58, face, (p) => {
        p.cyl(4.5, 9, 0, 4.2, 12, s.main, s.main, (t) =>
          Math.abs(t - 0.2) < 0.05 || Math.abs(t - 0.8) < 0.05 ? C.slate : null,
        );
        p.cyl(11.5, 9, 0, 4.2, 12, s.main, s.main, (t) =>
          Math.abs(t - 0.2) < 0.05 || Math.abs(t - 0.8) < 0.05 ? C.slate : null,
        );
        p.cyl(8, 4, 0, 4.4, 8, s.trim, s.trim);
        p.cyl(8, 4, 8, 2.8, 5, s.trim, s.trim);
        p.cyl(8, 4, 13, 1, 5, s.trim, s.trim);
        p.line(8, 4, 17, 11.5, 9, 12, s.trim[4]!);
        p.dot(4.5, 12.6, 5, C.e7, 1, 1);
        p.dot(11.5, 12.6, 5, C.e7, 1, 1);
      }),
  },
  enchanting: {
    frames: 3,
    fps: 3,
    draw: (s, face, f) =>
      iso(46, 60, face, (p, ctx) => {
        for (const [a, b] of [
          [2.5, 4.5],
          [13.5, 4.5],
          [2.5, 11.5],
          [13.5, 11.5],
        ] as const)
          p.box(a - 0.8, b - 0.8, 0, 1.6, 1.6, 9, m(darker(s.main)));
        p.box(0.5, 3, 9, 15, 10, 1.6, m(s.main));
        p.box(1.5, 4, 10.6, 13, 8, 0.4, { ramp: s.trim, rim: false });
        p.box(7, 7, 11, 2, 2, 1, m(s.trim));
        const z = 15 + (f % 3);
        blob(ctx, p.X(8, 8), p.Y(8, 8, z), 3.2, 3.8, [C.q1, C.q3, C.q5, C.white], { seed: 2, noise: 0.05 });
        put(ctx, Math.round(p.X(8, 8)) + ((f * 3) % 5) - 2, Math.round(p.Y(8, 8, z + 5)), C.white);
        put(ctx, Math.round(p.X(8, 8)) - ((f * 2) % 5) + 2, Math.round(p.Y(8, 8, z + 2)), C.q6);
        for (const [a, b] of [
          [3, 5],
          [13, 5],
          [3, 11],
          [13, 11],
        ] as const)
          p.dot(a, b, 11, C.q5, 1, 1);
      }),
  },
  engineering: {
    draw: (s, face) =>
      iso(50, 50, face, (p, ctx) => {
        for (const [a, b] of [
          [2, 4],
          [14, 4],
          [2, 12],
          [14, 12],
        ] as const)
          p.box(a - 0.8, b - 0.8, 0, 1.6, 1.6, 9, m(darker(s.trim)));
        p.box(0.5, 3, 9, 15, 10, 2, m(s.trim));
        p.box(1.5, 4, 11, 4, 3, 5, m(s.main));
        p.box(2.2, 3.4, 16, 2.6, 1, 3, m(s.main));
        p.box(9, 5, 11, 5, 5, 3, m(IRONM));
        p.cyl(11.5, 7.5, 14, 2.4, 1.2, BRASS, BRASS);
        blob(ctx, p.X(5, 10), p.Y(5, 10, 13), 2.6, 2.6, [C.e2, C.e4, C.e5, C.e6], { seed: 6, noise: 0.05 });
        p.line(1.5, 11, 12, 6.5, 11, 12, s.main[4]!);
      }),
  },
  runeforge: {
    frames: 3,
    fps: 3,
    draw: (s, face, f) =>
      iso(46, 64, face, (p) => {
        p.box(2, 2, 0, 12, 12, 3, m(darker(s.main)));
        p.box(3, 3, 3, 10, 10, 10, {
          ramp: s.main,
          front: (u, t, c) => (u > 0.4 && u < 0.6 && t > 0.2 && t < 0.8 ? [C.q4, C.q5, C.q6][f % 3]! : c(0)),
        });
        p.box(2.5, 2.5, 13, 11, 11, 1.6, m(s.main));
        for (const [a, b] of [
          [3, 3],
          [13, 3],
          [3, 13],
          [13, 13],
        ] as const) {
          p.box(a - 0.7, b - 0.7, 14.6, 1.4, 1.4, 12, m(s.main));
          p.dot(a, b, 27.4 + (f % 2), [C.q5, C.q6, C.white][(f + a) % 3]!, 1, 1);
        }
        p.box(6, 6, 14.6, 4, 4, 1, { ramp: s.trim });
        p.dot(8, 8, 16, [C.q6, C.white, C.q5][f % 3]!, 2, 2);
      }),
  },
  dairy: {
    draw: (s, face) =>
      iso(50, 54, face, (p) => {
        p.cyl(4.5, 9, 0, 3.6, 10, s.main, s.main, (t) =>
          Math.abs(t - 0.25) < 0.05 || Math.abs(t - 0.75) < 0.05 ? C.slate : null,
        );
        p.box(4.2, 8.8, 10, 0.6, 0.6, 5, m(IRONM));
        p.box(2.5, 8.6, 15, 4, 1, 1, m(IRONM));
        p.box(8.5, 3, 0, 6.5, 8, 6, m(s.trim));
        p.box(9.5, 4.2, 6, 4.5, 5.6, 4, m(s.main));
        p.box(11, 4.6, 10, 1.2, 1.2, 8, m(IRONM));
        p.box(8.5, 4.2, 18, 5, 1, 1, m(IRONM));
        p.cyl(11.5, 7, 6, 1.6, 1, [C.pale, C.white], [C.white]);
      }),
  },
};

/** Props for every catalog placeable that names a known shape. */
export const CATALOG_PROPS: Record<string, Mk> = {};
for (const [sub, spec] of Object.entries(PROP_SPECS) as Array<[string, PropSpec]>) {
  const shape = SHAPES[spec.shape];
  if (!shape) continue;
  const s = { main: RAMPS[spec.main], trim: RAMPS[spec.trim], tint: spec.tint ?? C.e5 };
  CATALOG_PROPS[sub] = shape.frames
    ? anim(shape.frames, shape.fps ?? 4, (face, f) => shape.draw(s, face, f), { noShadow: false })
    : one((face) => shape.draw(s, face, 0));
}
// join the registry the world renderer reads
Object.assign(PROPS, CATALOG_PROPS);
void DARKWOOD;
void WOODM;
