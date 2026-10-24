/**
 * Inventory icons (16x16 pixel art) drawn procedurally from each item's `icon: {g, a, b}` spec.
 * Every glyph is shaded from the item's two palette colours and gets a 1px dark outline so icons stay readable
 * on any panel colour. Unknown ids get a "?" box.
 */
import { ITEMS, type Glyph } from '@eigenlands/shared';
import { blob, C, dk, line, lt, makeCanvas, outline, poly, put, ramp4, slab, undithered, type Ctx } from './shade';

type Draw = (ctx: Ctx, a: number, b: number) => void;
const WOOD = [C.e1, C.e2, C.e3, C.e4, C.e5] as const;
const STEEL = [C.slate, C.steel, C.mist, C.fog, C.pale] as const;

/** shaded disc helper */
const ball = (ctx: Ctx, x: number, y: number, r: number, c: number, seed = 1) => blob(ctx, x, y, r, r, ramp4(c), { seed, noise: 0.08, edgeDark: 0.25 });

const G: Record<Glyph, Draw> = {
  log: (c, a, b) => {
    slab(c, 2, 5, 11, 7, ramp4(a), 3, 0.3); put(c, 2, 5, lt(a), 11, 1);
    for (const x of [5, 8, 11]) put(c, x, 6, dk(dk(a)), 1, 5);
    blob(c, 3.5, 8.5, 2.6, 3.6, ramp4(b), { seed: 2, noise: 0.05, edgeDark: 0.1 }); put(c, 3, 8, dk(b)); put(c, 4, 9, dk(b));
  },
  plank: (c, a, b) => {
    slab(c, 1, 3, 14, 5, ramp4(a), 4, 0.25); slab(c, 2, 9, 13, 5, ramp4(a), 5, 0.25);
    put(c, 1, 3, lt(a), 14, 1); put(c, 2, 9, lt(a), 13, 1); put(c, 3, 5, dk(b), 5, 1); put(c, 9, 11, dk(b), 4, 1); put(c, 2, 5, C.steel); put(c, 13, 11, C.steel);
  },
  stone: (c, a, b) => {
    poly(c, [[2,9],[5,4],[10,3],[14,8],[12,13],[6,14],[2,12]], dk(a));
    poly(c, [[2,9],[5,4],[10,3],[12,7],[7,10]], a);
    poly(c, [[5,4],[10,3],[12,7],[7,6]], b);
    line(c,3,10,6,12,lt(a)); line(c,8,10,11,8,dk(a));
  },
  coal: (c, a, b) => {
    poly(c, [[2,7],[6,3],[11,4],[14,9],[11,13],[5,14],[2,11]], C.ink);
    poly(c, [[2,7],[6,3],[9,6],[7,10]], C.slate);
    poly(c, [[9,6],[11,4],[14,9],[10,11]], C.night);
    line(c,3,7,6,4,C.mist); line(c,10,6,12,8,C.slate); put(c,5,11,b,2,1);
  },
  ore: (c, a, b) => {
    poly(c, [[2,10],[4,5],[9,3],[13,6],[14,11],[10,14],[4,13]], C.slate);
    poly(c, [[4,5],[9,3],[13,6],[8,9],[2,10]], C.steel);
    poly(c, [[8,9],[13,6],[14,11],[10,14]], C.ink);
    for (const [x,y] of [[5,6],[9,5],[10,10],[5,10]]) {
      put(c,x,y,a,3,2); put(c,x,y,b,2,1);
    }
  },
  ingot: (c, a, b) => {
    const bar = (x: number, y: number) => { poly(c, [[x + 2, y], [x + 11, y], [x + 13, y + 4], [x, y + 4]], (px, py) => (py === y ? b : py === y + 1 ? lt(a) : a)); put(c, x, y + 4, dk(a), 14, 1); put(c, x + 13, y + 3, dk(dk(a))); put(c, x + 1, y + 2, b); };
    bar(1, 4); bar(1, 9);
  },
  gem: (c, a, b) => {
    poly(c, [[8, 2], [13, 6], [8, 14], [3, 6]], (x, y) => (x < 8 ? (y < 6 ? lt(a) : a) : (y < 6 ? a : dk(a))));
    poly(c, [[8, 2], [11, 6], [5, 6]], b); line(c, 3, 6, 13, 6, lt(a)); line(c, 8, 6, 8, 13, dk(a)); put(c, 6, 4, C.white); put(c, 7, 3, C.white);
  },
  seed: (c, a, b) => {
    blob(c, 8, 10, 5, 4.4, ramp4(b), { seed: 8, noise: 0.25, edgeDark: 0.2 }); put(c, 6, 5, dk(b), 5, 2); put(c, 7, 4, b, 3, 1);
    for (const [x, y] of [[6, 9], [9, 8], [8, 11], [10, 11], [5, 11]] as const) { put(c, x, y, a, 1, 2); put(c, x, y, lt(a)); }
  },
  sprout: (c, a, b) => {
    blob(c, 8, 13, 5, 2, ramp4(C.e2), { seed: 9, noise: 0.3 }); line(c, 8, 12, 8, 7, C.g3);
    blob(c, 5.5, 7, 2.6, 1.8, ramp4(a), { seed: 10, noise: 0.2 }); blob(c, 10.5, 6, 2.6, 1.8, ramp4(b), { seed: 11, noise: 0.2 });
  },
  leaf: (c, a, b) => {
    poly(c, [[3, 13], [3, 8], [8, 3], [13, 3], [13, 8], [8, 13]], (x, y) => (x + y < 14 ? lt(a) : x + y < 17 ? a : dk(a)));
    line(c, 4, 12, 12, 4, b); line(c, 7, 9, 7, 7, b); line(c, 9, 7, 11, 7, b);
  },
  fruit: (c, a, b) => { blob(c, 8, 9.5, 5.6, 5, ramp4(a), { seed: 12, noise: 0.1, edgeDark: 0.28 }); put(c, 5, 6, C.white); put(c, 6, 6, lt(lt(a))); line(c, 8, 4, 9, 2, C.e2); blob(c, 11, 3.5, 2.2, 1.4, [C.g2, C.g3, b], { seed: 3, noise: 0 }); },
  root: (c, a, b) => {
    poly(c, [[4, 6], [12, 6], [10, 11], [8, 14], [6, 11]], (x, y) => (x < 7 ? lt(a) : x < 10 ? a : dk(a)));
    put(c, 5, 6, lt(lt(a)), 5, 1);
    for (let i = 0; i < 4; i++) { const dx = -3 + i * 2; line(c, 8, 6, 8 + dx, 1 + (i % 2), i % 2 ? C.g4 : C.g3); put(c, 8 + dx, 1 + (i % 2), C.g5); }
    put(c, 7, 12, dk(a)); put(c, 9, 9, b);
  },
  berry: (c, a, b) => {
    for (const [x, y] of [[5.5, 9], [10.5, 9], [8, 12], [8, 6.5]] as const) { ball(c, x, y, 2.6, a, x + y); put(c, Math.round(x) - 1, Math.round(y) - 1, C.white); }
    blob(c, 8, 3.5, 3, 1.5, [C.g2, C.g3, b], { seed: 3, noise: 0.1 }); line(c, 8, 4, 8, 5, C.g2);
  },
  mushroom: (c, a, b) => {
    slab(c, 6, 8, 4, 6, [C.fog, C.pale, C.white], 2, 0.1); put(c, 6, 13, C.fog, 4, 1);
    blob(c, 8, 7, 6, 4.4, ramp4(a), { seed: 13, noise: 0.2, shape: 2.2, edgeDark: 0.25 }); put(c, 3, 9, dk(a), 10, 1);
    for (const [x, y] of [[6, 5], [10, 6], [8, 4], [5, 7]] as const) put(c, x, y, b, 2, 2);
  },
  flower: (c, a, b) => {
    line(c, 8, 14, 8, 8, C.g3); blob(c, 6, 12, 2.4, 1.2, [C.g2, C.g3, C.g4], { seed: 1, noise: 0 }); blob(c, 10.5, 11, 2.4, 1.2, [C.g2, C.g3, C.g4], { seed: 2, noise: 0 });
    for (const [x, y] of [[8, 4.2], [8, 8.2], [5.6, 6.2], [10.4, 6.2]] as const) ball(c, x, y, 2.1, a, x * 3 + y);
    ball(c, 8, 6.2, 1.8, b, 7);
  },
  fish: (c, a, b) => {
    blob(c, 7.5, 8, 5.6, 3.6, ramp4(a), { seed: 14, noise: 0.15, shape: 2.2, edgeDark: 0.2 });
    blob(c, 7.5, 9.5, 4.4, 1.8, [b, lt(b), C.white], { seed: 5, noise: 0.05, edgeDark: 0 });
    poly(c, [[12, 8], [15, 4], [15, 12]], (x) => (x < 14 ? a : dk(a)));
    poly(c, [[6, 5], [9, 2], [10, 5]], dk(a)); put(c, 4, 7, C.white); put(c, 4, 7, C.ink); put(c, 5, 7, C.white);
    for (let i = 0; i < 3; i++) put(c, 7 + i * 1, 6 + i, lt(a));
  },
  bug: (c, a, b) => {
    blob(c, 5, 6, 3.4, 2.6, [lt(b), b, C.white], { seed: 1, noise: 0.05, edgeDark: 0.15 }); blob(c, 11, 6, 3.4, 2.6, [lt(b), b, C.white], { seed: 2, noise: 0.05, edgeDark: 0.15 });
    blob(c, 5, 10, 2.6, 2, [dk(b), b, lt(b)], { seed: 3, noise: 0 }); blob(c, 11, 10, 2.6, 2, [dk(b), b, lt(b)], { seed: 4, noise: 0 });
    slab(c, 7, 4, 2, 9, ramp4(a), 3, 0.1); put(c, 7, 3, a, 2, 1); line(c, 7, 3, 5, 1, C.slate); line(c, 8, 3, 10, 1, C.slate); put(c, 8, 3, C.white);
  },
  meat: (c, a, b) => {
    blob(c, 6, 7, 5, 4.4, ramp4(a), { seed: 15, noise: 0.25, edgeDark: 0.25 }); put(c, 4, 5, b, 3, 1); put(c, 7, 8, dk(a), 3, 1);
    line(c, 9, 10, 13, 14, C.pale); put(c, 12, 14, C.white, 2, 2); put(c, 14, 13, C.fog); put(c, 11, 11, C.fog);
  },
  hide: (c, a, b) => {
    poly(c, [[2, 5], [5, 3], [8, 4], [11, 3], [14, 6], [12, 9], [14, 13], [9, 12], [6, 14], [3, 11], [4, 8]], (x, y) => (x + y < 13 ? lt(a) : x + y < 18 ? a : dk(a)));
    for (let i = 0; i < 4; i++) put(c, 5 + i * 2, 8, b);
  },
  feather: (c, a, b) => {
    poly(c, [[3, 14], [4, 9], [7, 4], [13, 2], [12, 8], [8, 12]], (x, y) => (x + y < 13 ? b : x + y < 16 ? a : dk(a)));
    line(c, 3, 14, 12, 3, C.fog); for (let i = 0; i < 4; i++) { put(c, 6 + i, 10 - i * 2, dk(a)); }
  },
  egg: (c, a, b) => {
    blob(c, 8, 9, 4.4, 5.4, [dk(a), a, lt(a), b], { seed: 16, noise: 0.05, edgeDark: 0.22 }); put(c, 6, 6, C.white); put(c, 6, 7, C.white); put(c, 9, 11, dk(dk(a)), 2, 1);
  },
  waterskin: (c,a,b) => {
    line(c,3,4,2,11,C.e2);line(c,2,11,5,14,C.e2);
    poly(c,[[6,3],[10,3],[11,6],[13,9],[12,13],[9,15],[4,14],[3,10],[5,6]],(x,y)=>x<7?lt(a):x<10?a:dk(a));
    slab(c,6,1,4,3,[C.e2,C.e3,C.e5],2,.1);line(c,5,7,5,12,C.e5);put(c,8,8,b,2,4);put(c,7,10,b,4,2);
  },
  bottle: (c, a, b) => {
    slab(c, 6, 1, 4, 3, [C.e2, C.e3, C.e4], 1, 0.1);                       // cork
    put(c, 7, 4, C.pale, 2, 3);
    blob(c, 8, 10.5, 5, 4.6, [C.fog, C.pale, C.white], { seed: 17, noise: 0, shape: 2.4, edgeDark: 0.1 });
    blob(c, 8, 11.4, 4, 3.4, ramp4(a), { seed: 18, noise: 0.05, edgeDark: 0.15, shape: 2.4 });
    put(c, 5, 8, b, 1, 4); put(c, 9, 10, b); put(c, 7, 6, C.white);
  },
  bowl: (c, a, b) => {
    blob(c, 8, 7, 5.4, 2.2, ramp4(a), { seed: 19, noise: 0.5 }); put(c, 6, 6, b); put(c, 9, 7, b, 2, 1); put(c, 11, 6, lt(b));
    poly(c, [[2, 8], [14, 8], [12, 13], [4, 13]], (x, y) => (x < 7 ? C.mist : x < 11 ? C.steel : C.slate)); put(c, 2, 8, C.pale, 12, 1);
    put(c, 7, 4, C.pale); put(c, 9, 3, C.fog); put(c, 6, 2, C.pale);
  },
  pie: (c, a, b) => {
    blob(c, 8, 9, 7, 4, ramp4(a), { seed: 20, noise: 0.25, shape: 2.2, edgeDark: 0.25 });
    blob(c, 8, 8, 5, 2.6, ramp4(b), { seed: 21, noise: 0.2, edgeDark: 0 });
    for (let i = -1; i <= 1; i++) line(c, 4 + i * 2, 6, 12 + i * 2, 10, a); for (let i = -1; i <= 1; i++) line(c, 12 + i * 2, 6, 4 + i * 2, 10, lt(a));
    put(c, 2, 11, dk(a), 12, 1);
  },
  bread: (c, a, b) => {
    blob(c, 8, 9, 6.6, 4.4, [C.e2, C.e3, C.e4, C.e5, C.e6], { seed: 22, noise: 0.25, shape: 2.4, edgeDark: 0.25 });
    for (const x of [5, 8, 11]) line(c, x - 1, 6, x + 1, 9, C.e7);
  },
  jar: (c, a, b) => {
    slab(c, 5, 2, 6, 3, [C.e3, C.e4, C.e5], 1, 0.1); put(c, 4, 4, C.e2, 8, 1);
    blob(c, 8, 9.5, 5, 4.6, [C.fog, C.pale, C.white], { seed: 23, noise: 0, shape: 2.5, edgeDark: 0.1 });
    blob(c, 8, 10, 4, 3.8, ramp4(a), { seed: 24, noise: 0.1, shape: 2.5, edgeDark: 0.15 }); put(c, 5, 8, b, 1, 4); put(c, 8, 6, C.white);
    put(c, 6, 11, b); put(c, 9, 9, lt(a));
  },
  cloth: (c, a, b) => {
    slab(c, 2, 9, 12, 4, ramp4(a), 1, 0.15); slab(c, 3, 5, 11, 4, ramp4(a), 2, 0.15); put(c, 2, 9, lt(a), 12, 1); put(c, 3, 5, lt(a), 11, 1);
    for (const x of [5, 9, 13]) { put(c, x, 6, b, 1, 2); put(c, x - 1, 10, b, 1, 2); }
  },
  axe: (c, a, b) => {
    line(c, 3, 14, 11, 3, b); line(c, 4, 14, 12, 3, dk(b)); line(c, 4, 13, 11, 4, lt(b));
    poly(c, [[8, 2], [14, 3], [15, 8], [11, 8], [9, 6]], (x, y) => (x + y < 14 ? lt(a) : a)); line(c, 14, 3, 15, 8, C.pale); put(c, 9, 3, C.white);
  },
  pickaxe: (c, a, b) => {
    line(c, 4, 14, 12, 5, b); line(c, 5, 14, 13, 5, dk(b));
    poly(c, [[2, 5], [5, 2], [11, 2], [14, 5], [13, 6], [10, 4], [6, 4], [3, 7]], (x, y) => (y < 4 ? lt(a) : a)); put(c, 6, 2, C.white, 3, 1);
  },
  hoe: (c, a, b) => {
    line(c, 3, 14, 12, 2, b); line(c, 4, 14, 13, 2, dk(b));
    poly(c, [[10, 2], [15, 3], [14, 8], [12, 7], [13, 5], [10, 4]], (x, y) => (y < 5 ? lt(a) : a)); put(c, 11, 2, C.white);
  },
  can: (c, a, b) => {
    poly(c, [[3, 6], [11, 6], [12, 14], [2, 14]], (x, y) => (x < 6 ? lt(a) : x < 10 ? a : dk(a))); put(c, 3, 6, b, 8, 1); put(c, 2, 14, dk(dk(a)), 10, 1);
    line(c, 11, 8, 15, 4, a); line(c, 11, 9, 15, 5, dk(a)); put(c, 14, 3, b, 2, 2);
    put(c, 4, 3, a, 1, 3); put(c, 9, 3, a, 1, 3); put(c, 4, 3, b, 6, 1); put(c, 5, 9, b, 1, 3);
  },
  rod: (c, a, b) => {
    line(c, 2, 14, 12, 2, a); line(c, 3, 14, 13, 2, dk(a)); put(c, 4, 12, C.e1, 1, 1); put(c, 7, 8, C.e1);
    line(c, 13, 2, 14, 11, C.pale); poly(c, [[13, 11], [15, 11], [14, 14]], b); put(c, 14, 11, C.white);
  },
  net: (c, a, b) => {
    line(c, 2, 14, 8, 7, a); line(c, 3, 14, 9, 7, dk(a));
    blob(c, 11, 5, 4.4, 4, ramp4(C.fog), { seed: 3, noise: 0, shape: 2, edgeDark: 0 });
    for (let i = -3; i <= 3; i += 2) { line(c, 11 + i, 1, 11 + i, 9, b); line(c, 7, 5 + i, 15, 5 + i, b); }
    put(c, 7, 3, a, 8, 1); put(c, 7, 9, a, 8, 1);
  },
  spear: (c, a, b) => {
    line(c,2,14,10,5,C.e1);line(c,3,14,11,5,b);
    poly(c,[[10,3],[13,1],[14,5],[10,8],[9,6]],C.steel);
    poly(c,[[10,3],[13,1],[11,6],[9,6]],C.pale);line(c,7,8,9,10,C.e6);put(c,13,2,C.white);
  },
  battle_axe: (c, a, b) => {
    line(c,3,14,9,3,C.e1);line(c,4,14,10,3,C.e4);line(c,4,12,6,9,b);
    poly(c,[[8,3],[12,2],[14,5],[13,10],[10,8],[9,5]],C.steel);
    poly(c,[[12,2],[14,5],[13,10],[12,8],[12,5],[10,3]],C.pale);put(c,9,4,C.e6,2,2);
  },
  warhammer: (c, a, b) => {
    line(c,3,14,10,5,C.e1);line(c,4,14,11,5,C.e4);line(c,3,12,5,10,b);
    poly(c,[[5,2],[10,1],[14,4],[10,7]],C.pale);
    poly(c,[[5,2],[10,7],[10,10],[5,6]],C.steel);
    poly(c,[[10,7],[14,4],[14,7],[10,10]],C.slate);line(c,6,2,10,2,C.white);
  },
  sword: (c, a, b) => {
    line(c, 13, 2, 4, 11, C.pale); line(c, 12, 2, 3, 11, C.fog); line(c, 14, 3, 5, 12, C.steel); put(c, 13, 2, C.white, 2, 1);
    put(c, 2, 9, b, 5, 2); put(c, 3, 8, dk(b), 3, 1);
    line(c, 3, 12, 1, 14, C.e2); line(c, 4, 12, 2, 14, C.e3); put(c, 1, 14, b, 2, 1);
  },
  staff: (c, a, b) => {
    line(c, 3, 14, 11, 4, C.e3); line(c, 4, 14, 12, 4, C.e4); line(c, 2, 14, 10, 4, C.e2);              // shaft
    blob(c, 12, 4, 3.4, 3.4, ramp4(a), { seed: 31, noise: 0.05, edgeDark: 0.2 });                        // focus gem
    put(c, 11, 3, C.white, 1, 1); put(c, 10, 6, dk(b), 5, 1); put(c, 9, 7, b, 2, 1);                      // cradle
    put(c, 14, 1, lt(a), 1, 1); put(c, 15, 4, lt(a), 1, 1);
  },
  crossbow: (c, a, b) => {
    poly(c, [[2, 7], [13, 7], [13, 9], [2, 9]], (x, y) => (y === 7 ? C.e5 : C.e3));                       // stock
    put(c, 1, 8, b, 2, 1);
    for (let i = 0; i < 5; i++) { put(c, 11 - i, 3 + i, a, 1, 1); put(c, 11 - i, 13 - i, a, 1, 1); }       // limbs
    line(c, 6, 3, 6, 13, C.pale);                                                                          // string
    line(c, 6, 8, 15, 8, C.fog); put(c, 15, 8, C.white); put(c, 14, 7, C.steel); put(c, 14, 9, C.steel);   // bolt
  },
  helm: (c, a, b) => {
    blob(c, 8, 8, 5.6, 5.4, ramp4(a), { seed: 32, noise: 0.05, edgeDark: 0.25 });
    put(c, 3, 9, dk(dk(a)), 10, 5); put(c, 5, 10, C.ink, 6, 1);                                           // visor slit
    put(c, 7, 2, b, 2, 3); put(c, 4, 6, lt(a), 2, 1);
  },
  cuirass: (c, a, b) => {
    poly(c, [[4, 2], [12, 2], [15, 5], [13, 8], [12, 7], [12, 14], [4, 14], [4, 7], [3, 8], [1, 5]], (x, y) => (x < 6 ? lt(a) : x < 10 ? a : dk(a)));
    put(c, 4, 6, dk(dk(a)), 8, 1); put(c, 4, 10, dk(dk(a)), 8, 1); put(c, 7, 3, b, 2, 10); put(c, 6, 3, lt(b), 1, 3);
  },
  greaves: (c, a, b) => {
    poly(c, [[4, 2], [12, 2], [12, 14], [9, 14], [8, 6], [7, 14], [4, 14]], (x, y) => (x < 6 ? lt(a) : x < 9 ? a : dk(a)));
    put(c, 4, 2, b, 8, 1); put(c, 4, 8, dk(dk(a)), 3, 1); put(c, 9, 8, dk(dk(a)), 3, 1);
  },
  boots: (c, a, b) => {
    poly(c, [[4, 3], [9, 3], [9, 9], [14, 11], [14, 14], [4, 14]], (x, y) => (y > 12 ? dk(dk(a)) : x < 7 ? lt(a) : a));
    put(c, 4, 3, b, 5, 1); put(c, 5, 6, dk(a), 4, 1); put(c, 12, 11, lt(a), 2, 1);
  },
  ring: (c, a, b) => {
    blob(c, 8, 10, 5.2, 4.6, ramp4(a), { seed: 25, noise: 0.05, edgeDark: 0.2 }); blob(c, 8, 10.5, 3, 2.6, [C.ink, C.night, C.night], { seed: 1, noise: 0, edgeDark: 0 });
    poly(c, [[8, 2], [11, 5], [8, 8], [5, 5]], (x, y) => (x < 8 ? lt(b) : y < 5 ? b : dk(b))); put(c, 7, 4, C.white);
  },
  shirt: (c, a, b) => {
    poly(c, [[5, 2], [11, 2], [15, 5], [13, 8], [12, 7], [12, 14], [4, 14], [4, 7], [3, 8], [1, 5]], (x, y) => (x < 6 ? lt(a) : x < 10 ? a : dk(a)));
    poly(c, [[6, 2], [10, 2], [8, 5]], b); put(c, 4, 12, b, 8, 1); put(c, 2, 5, lt(a), 2, 1);
  },
  box: (c, a, b) => {
    slab(c, 2, 6, 12, 8, ramp4(a), 3, 0.3); blob(c, 8, 6, 6, 3.2, ramp4(a), { seed: 4, noise: 0.2, shape: 3, edgeDark: 0.1 }); put(c, 2, 8, dk(dk(a)), 12, 1);
    for (const x of [4, 10]) put(c, x, 3, C.steel, 2, 11); put(c, 7, 8, b, 2, 3);
  },
  bench: (c, a, b) => {
    for (const x of [2, 12]) slab(c, x, 8, 2, 6, ramp4(a), x, 0.2); slab(c, 1, 5, 14, 4, ramp4(a), 3, 0.2); put(c, 1, 5, lt(lt(a)), 14, 1);
    slab(c, 3, 2, 6, 3, [C.mist, C.fog, C.pale], 3, 0.1); put(c, 11, 3, b, 3, 2); put(c, 13, 2, C.white);
  },
  furnace: (c, a, b) => {
    slab(c, 5, 0, 4, 4, ramp4(a), 1, 0.3); slab(c, 2, 3, 12, 11, ramp4(a), 2, 0.4);
    poly(c, [[5, 13], [5, 9], [7, 7], [9, 7], [11, 9], [11, 13]], C.ink); put(c, 6, 11, C.r3, 4, 2); put(c, 7, 9, b, 2, 3); put(c, 8, 8, C.e7);
  },
  anvil: (c, a, b) => {
    poly(c, [[1, 3], [15, 3], [13, 6], [10, 6], [10, 8], [12, 11], [4, 11], [6, 8], [6, 6], [3, 6]], (x, y) => (y < 4 ? C.pale : y < 6 ? C.fog : x < 8 ? C.steel : C.slate));
    put(c, 2, 3, C.white, 12, 1); slab(c, 3, 11, 10, 3, STEEL, 2, 0.2); put(c, 12, 5, b, 2, 1);
  },
  pot: (c, a, b) => {
    blob(c, 8, 9, 6.2, 5, [C.ink, C.night, a, C.steel], { seed: 26, noise: 0.1, edgeDark: 0.3 }); put(c, 2, 5, C.fog, 12, 1); put(c, 3, 4, C.mist, 10, 1);
    put(c, 1, 7, a, 2, 2); put(c, 13, 7, a, 2, 2); put(c, 4, 4, b, 8, 1); put(c, 6, 1, C.pale); put(c, 9, 0, C.fog); put(c, 8, 2, C.pale);
  },
  loom: (c, a, b) => {
    slab(c, 2, 2, 2, 12, ramp4(a), 1, 0.2); slab(c, 12, 2, 2, 12, ramp4(a), 2, 0.2); slab(c, 2, 2, 12, 2, ramp4(a), 3, 0.2); slab(c, 2, 12, 12, 2, ramp4(a), 4, 0.2);
    for (let x = 5; x < 12; x += 2) line(c, x, 5, x, 11, C.fog); for (let y = 8; y < 12; y++) for (let x = 5; x < 12; x++) put(c, x, y, (x + y) % 2 ? b : lt(b));
  },
  chair: (c, a, b) => {
    slab(c, 3, 1, 3, 9, ramp4(a), 1, 0.2); slab(c, 3, 1, 7, 2, ramp4(a), 2, 0.2); slab(c, 3, 8, 9, 3, ramp4(a), 3, 0.2); put(c, 3, 8, lt(lt(a)), 9, 1);
    for (const x of [3, 10]) slab(c, x, 11, 2, 4, ramp4(a), x, 0.2); put(c, 4, 6, b, 4, 1);
  },
  table: (c, a, b) => {
    for (const x of [2, 12]) slab(c, x, 8, 2, 7, ramp4(a), x, 0.2); slab(c, 1, 5, 14, 4, ramp4(a), 3, 0.2); put(c, 1, 5, lt(lt(a)), 14, 1);
    blob(c, 11, 3.6, 2.2, 1.6, [C.w2, C.w3, C.w5], { seed: 2, noise: 0 }); put(c, 3, 6, b, 4, 1);
  },
  bed: (c, a, b) => {
    slab(c, 1, 3, 14, 11, ramp4(C.e2), 3, 0.2); slab(c, 2, 4, 12, 4, [C.fog, C.pale, C.white], 3, 0.1); slab(c, 2, 8, 12, 5, ramp4(a), 4, 0.2); put(c, 2, 8, b, 12, 1);
    for (const x of [4, 8, 12]) put(c, x, 10, dk(a), 1, 3);
  },
  lamp: (c, a, b) => {
    slab(c, 7, 8, 2, 7, [C.e1, C.e2, C.e3], 1, 0.1); slab(c, 4, 13, 8, 2, [C.e1, C.e2, C.e3], 2, 0.1);
    poly(c, [[3, 8], [5, 1], [11, 1], [13, 8]], (x) => (x < 8 ? a : dk(a))); put(c, 5, 2, b, 4, 5); put(c, 7, 3, C.white, 2, 2); put(c, 3, 8, C.e3, 10, 1);
  },
  shelf: (c, a, b) => {
    slab(c, 1, 1, 14, 14, ramp4(a), 3, 0.3); for (const y of [6, 11]) put(c, 1, y, dk(dk(a)), 14, 1);
    const books = [C.r3, C.w3, C.g4, C.q3, b, C.r5, C.w5];
    for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) put(c, 2 + i * 2, 2 + r * 5, books[(i + r * 3) % 7]!, 2, 4);
    ball(c, 5, 13, 1.4, C.w4); ball(c, 11, 13, 1.4, C.e5);
  },
  rug: (c, a, b) => {
    for (let y = 2; y < 14; y++) for (let x = 1; x < 15; x++) put(c, x, y, (x === 1 || y === 2 || x === 14 || y === 13) ? dk(dk(a)) : (x === 2 || y === 3 || x === 13 || y === 12) ? b : ((x + y) % 4 < 2 ? a : dk(a)));
    put(c, 7, 7, C.e6, 2, 2); for (let x = 1; x < 15; x += 2) { put(c, x, 1, C.e6); put(c, x, 14, C.e6); }
  },
  sprinkler: (c, a, b) => {
    slab(c, 7, 7, 2, 8, ramp4(a), 1, 0.1); slab(c, 5, 5, 6, 3, ramp4(a), 2, 0.1); put(c, 5, 5, C.white, 6, 1);
    for (const [x, y] of [[2, 3], [13, 3], [3, 1], [12, 1], [8, 1]] as const) put(c, x, y, b);
    put(c, 4, 4, C.w6); put(c, 11, 4, C.w6);
  },
  coop: (c, a, b) => {
    slab(c, 2, 8, 12, 7, [C.e2, C.e3, C.e4, C.e5], 3, 0.3);
    poly(c, [[0, 9], [8, 1], [16, 9], [14, 10], [8, 4], [2, 10]], (x) => (x < 8 ? b : lt(b))); put(c, 6, 10, C.ink, 4, 5); put(c, 4, 14, C.e6, 8, 1);
  },
  barn: (c, a, b) => {
    slab(c, 2, 6, 12, 9, [dk(a), a, lt(a)], 3, 0.3);
    poly(c, [[0, 7], [3, 2], [8, 0], [13, 2], [16, 7], [14, 7], [12, 4], [8, 2], [4, 4], [2, 7]], C.slate);
    slab(c, 5, 9, 6, 6, [C.e5, C.e6, C.e7], 4, 0.1); line(c, 5, 9, 10, 14, C.pale); line(c, 10, 9, 5, 14, C.pale); put(c, 7, 4, C.e6, 2, 2);
  },
  chicken: (c, a, b) => {
    blob(c, 7.5, 9.5, 5, 4.2, [C.fog, C.pale, C.white, C.white], { seed: 27, noise: 0.1, edgeDark: 0.2 });
    blob(c, 11.5, 5.5, 2.6, 2.6, [C.pale, C.white, C.white], { seed: 28, noise: 0, edgeDark: 0.1 }); put(c, 12, 3, b, 2, 1); put(c, 11, 2, b, 1, 1);
    put(c, 14, 6, C.e5, 2, 1); put(c, 12, 5, C.ink); put(c, 12, 8, b, 1, 1);
    poly(c, [[2, 7], [0, 5], [2, 11]], C.fog); line(c, 6, 14, 6, 15, C.e5); line(c, 9, 14, 9, 15, C.e5); put(c, 5, 15, C.e5, 2, 1); put(c, 8, 15, C.e5, 2, 1);
  },
  cow: (c, a, b) => {
    slab(c, 2, 5, 11, 6, [C.fog, C.pale, C.white], 3, 0.1); slab(c, 11, 3, 4, 5, [C.pale, C.white, C.white], 4, 0.1);
    put(c, 4, 6, b, 3, 3); put(c, 8, 8, b, 3, 2); put(c, 12, 3, b, 3, 2); put(c, 14, 6, C.r4, 2, 2); put(c, 13, 4, C.ink); put(c, 12, 2, C.e6, 1, 2); put(c, 14, 2, C.e6, 1, 2);
    for (const x of [3, 5, 9, 11]) put(c, x, 11, C.fog, 1, 4); put(c, 1, 6, b, 1, 4);
  },
  sign: (c, a, b) => {
    slab(c, 7, 7, 2, 8, ramp4(a), 1, 0.2); slab(c, 2, 2, 12, 6, ramp4(a), 2, 0.3); put(c, 2, 2, lt(lt(a)), 12, 1);
    put(c, 4, 4, dk(dk(a)), 8, 1); put(c, 4, 6, dk(dk(a)), 6, 1); put(c, 3, 3, b);
  },
  fence: (c, a, b) => {
    for (const x of [2, 7, 12]) { slab(c, x, 3, 2, 11, ramp4(a), x, 0.2); put(c, x, 3, lt(lt(a)), 2, 1); }
    slab(c, 1, 5, 14, 2, ramp4(a), 5, 0.2); slab(c, 1, 10, 14, 2, ramp4(a), 6, 0.2); put(c, 1, 5, b, 14, 1);
  },
  gel: (c, a, b) => {
    blob(c, 8, 10, 6, 4.4, ramp4(a), { seed: 29, noise: 0.05, edgeDark: 0.2, shape: 2.2 }); blob(c, 8, 8, 3.4, 2.6, [lt(a), b, C.white], { seed: 30, noise: 0, edgeDark: 0 });
    put(c, 5, 8, C.white, 2, 1); put(c, 6, 9, C.white); put(c, 11, 11, b);
  },
  tooth: (c, a, b) => {
    poly(c, [[4, 2], [12, 2], [11, 8], [9, 14], [8, 9], [7, 14], [5, 8]], (x, y) => (x < 8 ? (y < 5 ? C.white : a) : (y < 5 ? a : dk(a)))); put(c, 5, 3, b, 1, 4); put(c, 6, 3, C.white);
  },
  bag: (c, a, b) => {
    blob(c, 8, 10, 5.8, 4.8, ramp4(a), { seed: 31, noise: 0.25, edgeDark: 0.25 }); poly(c, [[5, 5], [11, 5], [10, 7], [6, 7]], dk(a)); put(c, 5, 5, b, 6, 1); put(c, 7, 4, C.e2, 2, 1);
    put(c, 5, 9, lt(a), 2, 3); for (let i = 0; i < 4; i++) put(c, 6 + i * 2, 10 + (i % 2), b);
  },
  orb: (c, a, b) => {
    ball(c, 8, 8, 5.6, a, 32); blob(c, 8, 8, 3.2, 3.2, [lt(a), b, C.white], { seed: 33, noise: 0, edgeDark: 0 }); put(c, 5, 5, C.white, 2, 2);
    put(c, 13, 2, b); put(c, 12, 3, C.pale); put(c, 14, 3, C.pale); put(c, 13, 4, C.pale); put(c, 2, 12, C.q7);
  },
  book: (c, a, b) => {
    slab(c, 3, 2, 10, 12, ramp4(a), 3, 0.2); put(c, 3, 2, lt(lt(a)), 10, 1); slab(c, 2, 2, 2, 12, [dk(dk(a)), dk(a)], 4, 0.1); put(c, 4, 13, C.pale, 9, 1);
    put(c, 6, 5, b, 5, 1); put(c, 6, 7, b, 4, 1); put(c, 7, 9, b, 2, 2);
  },
};

const cache = new Map<string, string>();
const canvasCache = new Map<string, HTMLCanvasElement>();

/** Discoveries get their own silhouettes rather than recoloured generic fish. */
const SEA_ICONS: Record<string, Draw> = {
  sailfin: (c, a, b) => {
    G.fish(c, a, b);
    poly(c, [[5, 5], [6, 1], [8, 2], [11, 5]], a);
    for (const x of [6, 8, 10]) line(c, x, 4, x - 1, 2, b);
    line(c, 2, 8, 0, 8, C.pale);
  },
  moonray: (c, a, b) => {
    poly(c, [[8, 3], [13, 4], [15, 8], [10, 10], [8, 12], [6, 10], [1, 8], [3, 4]], (x, y) => x < 8 ? lt(a) : y < 7 ? a : dk(a));
    poly(c, [[8, 4], [10, 8], [8, 11], [6, 8]], b);
    line(c, 8, 10, 9, 14, a); put(c, 6, 5, C.ink); put(c, 10, 5, C.ink);
  },
  prism_nautilus: (c, a, b) => {
    blob(c, 8, 7, 5, 5, ramp4(a), { seed: 81, noise: 0, edgeDark: .2 });
    line(c, 5, 4, 10, 3, b); line(c, 10, 3, 12, 7, b); line(c, 12, 7, 8, 10, b);
    line(c, 8, 10, 5, 7, b); line(c, 5, 7, 8, 5, b); line(c, 8, 5, 9, 7, b);
    for (const x of [5, 8, 11]) line(c, 8, 11, x, 14, C.q5);
    put(c, 5, 4, C.white); put(c, 9, 12, C.ink);
  },
};

function paint(id: string, size: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(16, 16);
  const d = ITEMS[id];
  if (!d) { put(ctx, 2, 2, C.slate, 12, 12); put(ctx, 3, 3, C.mist, 10, 10); put(ctx, 7, 5, C.ink, 2, 4); put(ctx, 7, 11, C.ink, 2, 1); outline(ctx, 16, 16); }
  else { undithered(() => (SEA_ICONS[id] ?? G[d.icon.g])(ctx, d.icon.a, d.icon.b)); outline(ctx, 16, 16); }
  if (size === 16) return canvas;
  const out = makeCanvas(size, size);
  out.ctx.imageSmoothingEnabled = false;
  out.ctx.drawImage(canvas, 0, 0, size, size);
  return out.canvas;
}

/** A crisp canvas for an item id (16x16 native; other sizes are nearest-neighbour scaled). */
export function itemIconCanvas(id: string, size = 16): HTMLCanvasElement {
  const key = `${id}@${size}`;
  let c = canvasCache.get(key);
  if (!c) { c = paint(id, size); canvasCache.set(key, c); }
  return c;
}

/** Cached data URL of the 16x16 icon, for DOM <img> use (render with image-rendering: pixelated). */
export function itemIconUrl(id: string): string {
  let u = cache.get(id);
  if (!u) { u = itemIconCanvas(id, 16).toDataURL(); cache.set(id, u); }
  return u;
}
