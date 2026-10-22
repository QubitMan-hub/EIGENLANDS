import { Rectangle, Texture } from 'pixi.js';
import { PALETTE, hash2, mulberry32 } from '@eigenlands/shared';
import { C, line, lump, makeCanvas, poly, polish, put, stonePile, type Ctx, type Ramp } from './shade';

/**
 * Tile objects in the painterly block-tile style: no outlines, forms read by value alone (lit from the top-left,
 * cool navy-leaning shadows), clean dither-free bands, leaf clusters and rounded stones.
 */
export interface ObjSprite { tex: Texture; ax: number; ay: number }
export type SeasonIdx = 0 | 1 | 2 | 3;

function toSprite(canvas: HTMLCanvasElement, ax: number, ay: number, o: { ao?: boolean; rim?: boolean; fringe?: boolean } = {}): ObjSprite {
  const ctx = canvas.getContext('2d')!;
  polish(ctx, canvas.width, canvas.height, { rim: o.rim ?? true, fringe: o.fringe, ao: o.ao === false ? null : { ax, ay, rx: Math.min(14, canvas.width * 0.34) } });
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  return { tex, ax, ay };
}

// ───────── ramps (dark -> light) ─────────
const LEAF: Ramp = [C.g0, C.g1, C.g2, C.g3, C.g5, C.g6];
const LEAF_SPRING: Ramp = [C.g1, C.g2, C.g3, C.g5, C.g6, C.g7];
const LEAF_AUT_O: Ramp = [C.e1, C.r0, C.r1, C.r4, C.r5, C.r6];
const LEAF_AUT_R: Ramp = [C.e0, C.r0, C.r2, C.r3, C.r4, C.r5];
const LEAF_AUT_Y: Ramp = [C.g1, C.g3, C.g5, C.r5, C.r6, C.r7];
const PINE: Ramp = [C.g0, C.g0, C.g1, C.g2, C.g3, C.g4];
const SNOW: Ramp = [C.mist, C.fog, C.pale, C.white, C.white];
const BARK: Ramp = [C.e0, C.e1, C.e2, C.e3, C.e4];
const WOOD: Ramp = [C.e1, C.e2, C.e3, C.e4, C.e5];
const STONE: Ramp = [C.steel, C.mist, C.fog, C.fog, C.pale];
const MOSS: Ramp = [C.g1, C.g2, C.g3, C.g4, C.g5];

function trunk(ctx: Ctx, cx: number, top: number, bot: number, w: number, seed: number): void {
  const x0 = cx - Math.floor(w / 2);
  for (let y = top; y < bot; y++) for (let i = 0; i < w; i++) {
    const u = i / Math.max(1, w - 1);
    let c = u < 0.25 ? C.e3 : u < 0.7 ? C.e2 : C.e1;
    if (i === 0 && hash2(seed, i, y >> 1, 2) > 0.3) c = C.e4;               // lit edge
    if (i > 0 && i < w - 1 && (i + (y >> 2)) % 3 === 0 && hash2(seed, i, y >> 1, 3) > 0.35) c = u < 0.5 ? C.e2 : C.e0;  // bark furrows
    put(ctx, x0 + i, y, c);
  }
  // root flare
  for (let i = -2; i < w + 2; i++) { const yy = bot - 1 - (i < 0 || i >= w ? 0 : 1); put(ctx, x0 + i, yy, i < w / 2 ? C.e2 : C.e1); }
  put(ctx, x0 - 2, bot - 1, C.e3); put(ctx, x0 + w + 1, bot - 1, C.e0);
  put(ctx, x0 + Math.floor(w / 2), top + Math.floor((bot - top) * 0.5), C.e0, 2, 2);          // knot
}

function branches(ctx: Ctx, rng: () => number, x: number, y: number, ang: number, len: number, depth: number, snow: boolean): void {
  if (depth === 0 || len < 2) return;
  const x2 = Math.round(x + Math.cos(ang) * len), y2 = Math.round(y - Math.sin(ang) * len);
  line(ctx, Math.round(x), Math.round(y), x2, y2, depth > 3 ? C.e2 : depth > 1 ? C.e1 : C.e2);
  if (depth > 3) line(ctx, Math.round(x) - 1, Math.round(y), x2 - 1, y2, C.e3);
  if (snow && rng() > 0.35) { put(ctx, x2, y2 - 1, C.white); put(ctx, x2 - 1, y2 - 1, C.pale); }
  branches(ctx, rng, x2, y2, ang + 0.45 + rng() * 0.35, len * 0.72, depth - 1, snow);
  branches(ctx, rng, x2, y2, ang - 0.45 - rng() * 0.35, len * 0.72, depth - 1, snow);
}

/** A rounded crown of leaf clusters, back to front; lower clusters sit in the crown's own shade. */
function crown(ctx: Ctx, rng: () => number, cx: number, cy: number, rx: number, ry: number, n: number, rampOf: (i: number) => Ramp, seed: number): void {
  const cl: Array<[number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng());
    cl.push([cx + Math.cos(a) * r * (rx - 5), cy + Math.sin(a) * r * (ry - 4), 5 + rng() * 3.5]);
  }
  cl.sort((a, b) => a[1] - b[1]);
  // dark core so gaps between clusters read as depth
  lump(ctx, cx, cy + 2, rx - 2, ry - 2, [C.g0, C.g0, C.g1, C.g1], { seed, leafy: 0.4, edge: 0 });
  cl.forEach(([x, y, r], i) => {
    const low = (y - (cy - ry)) / (2 * ry);           // 0 top .. 1 bottom
    lump(ctx, x, y, r, r * 0.82, rampOf(i), { seed: seed + i * 13, leafy: 0.55, bright: 0.12 - low * 0.32, edge: 0.25 });
  });
  // sun-caught leaf clumps on the upper-left shoulder
  for (let i = 0; i < 4; i++) {
    const x = cx - rx * 0.35 + (rng() - 0.5) * rx * 0.7, y = cy - ry * 0.5 + (rng() - 0.5) * ry * 0.4;
    lump(ctx, x, y, 3 + rng() * 1.5, 2.4, rampOf(99 + i), { seed: seed + 50 + i, leafy: 0.6, bright: 0.32, edge: 0.1 });
  }
}

/** 48x64 broadleaf tree (anchor: trunk base). Seasonal: blossom, lush, autumn colours, bare + snow. */
function drawBroadleaf(ctx: Ctx, seed: number, season: SeasonIdx): void {
  const rng = mulberry32(seed * 7919 + 13);
  trunk(ctx, 24, season === 3 ? 26 : 34, 59, 6, seed);
  if (season === 3) {
    for (let i = 0; i < 5; i++) branches(ctx, rng, 24, 38 - i * 3, Math.PI / 2 + (i - 2) * 0.5, 13 - i * 1.4, 5, true);
    lump(ctx, 24, 58.5, 8, 2.2, SNOW, { seed, edge: 0 });
    return;
  }
  const rampOf = (i: number): Ramp => {
    if (season === 0) return LEAF_SPRING;
    if (season === 2) { const h = hash2(seed, i, 0, 5); return h < 0.4 ? LEAF_AUT_O : h < 0.62 ? LEAF_AUT_R : h < 0.88 ? LEAF_AUT_Y : LEAF; }
    return LEAF;
  };
  // a couple of limbs reaching into the crown
  line(ctx, 23, 38, 16, 30, C.e2); line(ctx, 25, 37, 31, 29, C.e1);
  crown(ctx, rng, 24, 25, 21, 18, 16, rampOf, seed);
  if (season === 0) for (let i = 0; i < 16; i++) { const x = 8 + rng() * 32, y = 8 + rng() * 24; put(ctx, x, y, rng() > 0.4 ? C.q6 : C.white); if (rng() > 0.5) put(ctx, x + 1, y, C.q5); }
  if (season === 2) for (let i = 0; i < 8; i++) put(ctx, 10 + rng() * 28, 52 + rng() * 6, rng() > 0.5 ? C.r5 : C.r4, 2, 1);
  // a shaded trunk under the crown
  for (let y = 40; y < 45; y++) for (let x = 21; x < 27; x++) put(ctx, x, y, y < 43 ? C.e0 : C.e1);
}

/** Layered conifer (48x64); keeps its needles in winter and gains snow. */
function drawPine(ctx: Ctx, seed: number, season: SeasonIdx): void {
  trunk(ctx, 24, 48, 62, 4, seed);
  const tiers: Array<[number, number]> = [[46, 15], [37, 12.5], [28.5, 10.5], [20.5, 8], [13, 5.5]];
  tiers.forEach(([y, rx], k) => {
    // each tier: a drooping fan of needles, dark beneath, lit on the upper left
    poly(ctx, [[24 - rx, y + 4], [24, y - 7], [24 + rx, y + 4], [24 + rx * 0.5, y + 6], [24, y + 5], [24 - rx * 0.5, y + 6]], (x, yy) => {
      const u = (x - (24 - rx)) / (2 * rx), v = (yy - (y - 7)) / 13;
      const lit = 0.75 - u * 0.65 - v * 0.35 + (hash2(seed + k, x >> 1, yy, 6) - 0.5) * 0.35;
      return PINE[Math.max(0, Math.min(PINE.length - 1, Math.floor(lit * PINE.length)))]!;
    });
    for (let i = 0; i < 5; i++) { const x = 24 - rx + 2 + ((i * 7 + k * 3) % Math.floor(rx * 2 - 3)); put(ctx, x, y + 3 + (i % 2), C.g0, 2, 1); }   // needle shadows
    for (let i = 0; i < 3; i++) put(ctx, 24 - rx * 0.55 + i * 2, y - 2 + i, C.g4);                                                        // lit needle tips
    if (season === 3) poly(ctx, [[24 - rx * 0.8, y + 1], [24, y - 7], [24 + rx * 0.6, y], [24, y - 2]], (x) => (x < 24 ? C.white : C.pale));
  });
}

export function buildTrees(season: SeasonIdx): ObjSprite[] {
  const out: ObjSprite[] = [];
  for (let v = 0; v < 6; v++) {
    const { canvas, ctx } = makeCanvas(48, 64);
    if (v >= 4) drawPine(ctx, 100 + v, season); else drawBroadleaf(ctx, 10 + v * 17, season);
    out.push(toSprite(canvas, 24, 61));
  }
  return out;
}

/**
 * Quantum "superposition" tree: an oak and a crystal conifer occupying the same spot. Frames run
 * oak -> dithered superposition -> crystal pine -> superposition, so the tree flickers between its two forms.
 */
export function buildQTree(season: SeasonIdx): ObjSprite[] {
  const out: ObjSprite[] = [];
  const CRY: Ramp = [C.q0, C.q1, C.q2, C.q3, C.q4, C.q6, C.q7];
  const oak = makeCanvas(48, 64), pine = makeCanvas(48, 64);
  drawBroadleaf(oak.ctx, 77, season === 3 ? 1 : season);
  drawPine(pine.ctx, 91, 1);
  const recolor = (ctx: Ctx, map: (i: number) => number) => {
    const img = ctx.getImageData(0, 0, 48, 64);
    const d = img.data;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 48; x++) {
      const i = (y * 48 + x) * 4;
      if (!d[i + 3]) continue;
      const hex = '#' + [d[i]!, d[i + 1]!, d[i + 2]!].map((v) => v.toString(16).padStart(2, '0')).join('');
      const idx = PALETTE.indexOf(hex as (typeof PALETTE)[number]);
      if (idx >= 8 && idx < 16) put(ctx, x, y, map(idx));
    }
  };
  const TEAL = [C.q0, C.w0, C.w0, C.w1, C.w2, C.w3, C.w5, C.q7];
  recolor(oak.ctx, (i) => TEAL[i - 8]!);
  recolor(pine.ctx, (i) => CRY[Math.min(6, Math.max(0, i - 8))]!);
  const a = oak.ctx.getImageData(0, 0, 48, 64).data, b = pine.ctx.getImageData(0, 0, 48, 64).data;
  const mix = (mode: number): ObjSprite => {
    const { canvas, ctx } = makeCanvas(48, 64);
    const img = ctx.createImageData(48, 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 48; x++) {
      const i = (y * 48 + x) * 4;
      const pickA = mode === 0 ? true : mode === 2 ? false : ((x >> 1) + (y >> 1) + (mode === 1 ? 0 : 1)) % 2 === 0;
      const src = pickA ? (a[i + 3] ? a : b) : (b[i + 3] ? b : a);
      if (mode === 0 && !a[i + 3]) continue;
      if (mode === 2 && !b[i + 3]) continue;
      for (let k = 0; k < 4; k++) img.data[i + k] = src[i + k]!;
    }
    ctx.putImageData(img, 0, 0);
    return toSprite(canvas, 24, 61);
  };
  out.push(mix(0), mix(1), mix(2), mix(3));
  return out;
}

/** Rounded boulder pile (kept for callers): `rx`/`ry` bound the pile; a few stones of decreasing size. */
export function facetRock(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, seed: number, snow: boolean): void {
  const rng = mulberry32(seed);
  const stones: Array<[number, number, number, number]> = [[cx - rx * 0.12, cy - ry * 0.1, rx * 0.72, ry * 0.88]];
  const n = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    stones.push([cx + side * rx * (0.35 + rng() * 0.25), cy + ry * (0.15 + rng() * 0.3), rx * (0.35 + rng() * 0.2), ry * (0.42 + rng() * 0.2)]);
  }
  stonePile(ctx, stones, STONE, { seed, rough: 0.14, edge: 0.22, flat: 0.25 });
  // weathering: a darker base course where the stone meets the ground, a few chips
  for (let i = 0; i < 4; i++) put(ctx, Math.round(cx - rx * 0.4 + rng() * rx * 0.8), Math.round(cy + ry * 0.2 + rng() * ry * 0.4), C.steel, 2, 1);
  if (snow) lump(ctx, cx - rx * 0.1, cy - ry * 0.6, rx * 0.6, ry * 0.32, SNOW, { seed, edge: 0, flat: 0.6 });
  else if (hash2(seed, 1, 1, 8) > 0.4) lump(ctx, cx - rx * 0.32, cy - ry * 0.62, rx * 0.36, ry * 0.24, MOSS, { seed, leafy: 0.5, bright: 0.1, edge: 0 });
}

export function buildRocks(season: SeasonIdx): ObjSprite[] {
  const out: ObjSprite[] = [];
  const snow = season === 3;
  for (let v = 0; v < 6; v++) {
    const { canvas, ctx } = makeCanvas(40, 34);
    const rng = mulberry32(400 + v * 37);
    const piles: Array<Array<[number, number, number, number]>> = [
      [[18, 17, 10, 11], [27, 22, 7, 7], [11, 24, 6, 5]],                       // tall boulder with companions
      [[15, 22, 8, 7], [25, 22, 8, 7.5], [20, 26, 6, 4.5]],                      // low pair
      [[20, 15, 8, 12], [12, 24, 6, 5.5], [28, 25, 5, 4]],                       // standing stone
      [[20, 20, 12, 9.5]],                                                         // big round boulder
      [[13, 23, 6, 5], [22, 21, 7, 6.5], [29, 25, 4.5, 3.6], [17, 27, 5, 3.4]], // scattered pile
      [[20, 21, 13, 7], [14, 18, 6, 5]],                                         // flat slab
    ];
    stonePile(ctx, piles[v]!, STONE, { seed: 60 + v * 11, rough: 0.14, edge: 0.2, flat: v === 5 ? 0.7 : 0.25 });
    const top = piles[v]![0]!;
    if (snow) lump(ctx, top[0] - 1, top[1] - top[3] * 0.55, top[2] * 0.75, top[3] * 0.35, SNOW, { seed: v, edge: 0, flat: 0.7 });
    else if (v % 2 === 0) lump(ctx, top[0] - top[2] * 0.3, top[1] - top[3] * 0.6, top[2] * 0.45, top[3] * 0.28, MOSS, { seed: v + 3, leafy: 0.6, bright: 0.12, edge: 0 });
    // grass tufts at the base (summer) so the rock sits in the turf
    if (!snow) for (let i = 0; i < 3; i++) { const x = 8 + Math.floor(rng() * 24); put(ctx, x, 29, C.g3); put(ctx, x - 1, 28, C.g4); put(ctx, x + 1, 28, C.g2); }
    out.push(toSprite(canvas, 20, 29));
  }
  return out;
}

const PETALS: Array<[number, number]> = [[C.r3, C.r6], [C.r5, C.r7], [C.q5, C.q6], [C.white, C.r6], [C.r2, C.r4], [C.q3, C.q4]];

/** Flower clumps: a leafy tuft with a few saturated blossoms (lit petal, darker petal, bright centre). */
export function buildFlowers(season: SeasonIdx): ObjSprite[] {
  const out: ObjSprite[] = [];
  for (let v = 0; v < 6; v++) {
    const { canvas, ctx } = makeCanvas(20, 16);
    const rng = mulberry32(v * 313 + 11);
    const leaf: Ramp = season === 3 ? [C.mist, C.fog, C.pale] : season === 2 ? [C.e1, C.e2, C.e3, C.r1] : [C.g1, C.g2, C.g3, C.g4, C.g5];
    // leaves: little pointed blades fanning out of the clump
    for (let i = 0; i < 9; i++) {
      const x = 4 + Math.floor(rng() * 12), y = 11 + Math.floor(rng() * 4), h = 2 + Math.floor(rng() * 3), lean = rng() > 0.5 ? 1 : -1;
      for (let j = 0; j < h; j++) put(ctx, x + (j > 1 ? lean : 0), y - j, leaf[Math.min(leaf.length - 1, 1 + j)]!);
      put(ctx, x, y + 1, leaf[0]!);
    }
    if (season === 3) { for (let i = 0; i < 3; i++) put(ctx, 6 + i * 4, 9 + (i % 2), C.white, 2, 1); out.push(toSprite(canvas, 10, 15, { ao: false, rim: false })); continue; }
    const n = 3 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) {
      const x = 4 + Math.floor(rng() * 12), y = 5 + Math.floor(rng() * 5);
      const [p0, p1] = PETALS[(v + i) % PETALS.length]!;
      line(ctx, x, y + 2, x + (rng() > 0.5 ? 1 : 0), y + 6, leaf[2]!);
      if (season === 2 && rng() > 0.4) { put(ctx, x, y, C.r1, 2, 2); put(ctx, x, y, C.r4); continue; }
      // five-pixel blossom + lit top petal
      put(ctx, x - 1, y, p0); put(ctx, x + 1, y, p0); put(ctx, x, y + 1, p0); put(ctx, x, y - 1, p1); put(ctx, x - 1, y - 1, p1);
      put(ctx, x, y, p0 === C.white ? C.r6 : C.r7);
    }
    out.push(toSprite(canvas, 10, 15, { ao: false, rim: false }));
  }
  return out;
}

/** Tall grass: a dense clump of blades, dark at the root, sun-caught tips (like a leafy turf block's top). */
export function buildTallGrass(season: SeasonIdx): ObjSprite[] {
  const out: ObjSprite[] = [];
  const ramp: Ramp = season === 3 ? [C.steel, C.mist, C.fog, C.pale, C.white] : season === 2 ? [C.g1, C.g3, C.r1, C.r5, C.r6] : season === 0 ? [C.g1, C.g3, C.g4, C.g5, C.g6] : [C.g0, C.g1, C.g3, C.g5, C.g6];
  for (let v = 0; v < 4; v++) {
    const { canvas, ctx } = makeCanvas(20, 18);
    const rng = mulberry32(v * 457 + 3);
    for (let i = 0; i < 16; i++) {
      const x = 3 + Math.floor(rng() * 14), h = 5 + Math.floor(rng() * 8), lean = (rng() - 0.5) * 5;
      const back = i < 8;
      for (let j = 0; j < h; j++) {
        const t = j / h;
        const k = Math.min(ramp.length - 1, Math.floor((back ? 0 : 1) + t * (ramp.length - (back ? 1.5 : 1))));
        put(ctx, x + Math.round(lean * t * t), 17 - j, ramp[k]!);
      }
    }
    for (let x = 4; x < 16; x++) put(ctx, x, 17, ramp[0]!);
    out.push(toSprite(canvas, 10, 17, { ao: false, rim: false }));
  }
  return out;
}

/** Phase bloom: a leafy rosette holding a softly glowing cyan bulb ringed by magenta petals. */
export function buildBloom(): ObjSprite[] {
  const out: ObjSprite[] = [];
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    line(ctx, 8, 15, 8, 9, C.g2);
    put(ctx, 4, 13, C.g3, 3, 1); put(ctx, 5, 12, C.g4, 2, 1); put(ctx, 9, 12, C.g3, 3, 1); put(ctx, 10, 11, C.g4, 2, 1);
    for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [-2, 2], [2, 2]] as const) put(ctx, 8 + dx, 7 + dy, f ? C.q6 : C.q5, 2, 1);
    lump(ctx, 8.5, 7, 3, 2.8, [C.w3, C.w5, C.q7, C.w7], { seed: f + 1, edge: 0, bright: 0.15 + f * 0.1 });
    put(ctx, 7, 6, C.white);
    out.push(toSprite(canvas, 8, 15, { fringe: true }));
  }
  return out;
}

export function buildTorch(): ObjSprite[] {
  const out: ObjSprite[] = [];
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeCanvas(18, 34);
    // standing torch: wrapped pole, iron basket, living flame
    for (let y = 14; y < 32; y++) { put(ctx, 8, y, C.e3); put(ctx, 9, y, C.e2); put(ctx, 10, y, C.e1); }
    for (let y = 17; y < 31; y += 4) put(ctx, 8, y, C.e1, 3, 1);
    put(ctx, 5, 12, C.slate, 9, 3); put(ctx, 6, 12, C.steel, 7, 1); put(ctx, 5, 10, C.slate, 1, 3); put(ctx, 13, 10, C.slate, 1, 3);
    lump(ctx, 9.5, 7.5 - f * 0.5, 4, 5 + f * 0.6, [C.r2, C.r3, C.r4, C.r5, C.r6], { seed: f + 3, leafy: 0.4, bright: 0.12, edge: 0.05 });
    lump(ctx, 9.5, 9, 2, 2.6, [C.r6, C.r7, C.r7], { seed: 9, edge: 0, bright: 0.2 });
    put(ctx, 9 + (f ? 2 : -2), 1 + f, C.r5); put(ctx, 10 - (f ? 3 : -1), 0, C.r4);
    out.push(toSprite(canvas, 9, 31));
  }
  return out;
}

/** Stumps and fallen logs: warm tan wood, ring-cut tops, moss and grass at the foot. Three variants. */
export function buildStump(season: SeasonIdx): ObjSprite[] {
  const out: ObjSprite[] = [];
  const snow = season === 3;
  for (let v = 0; v < 3; v++) {
    const { canvas, ctx } = makeCanvas(26, 20);
    const rng = mulberry32(700 + v * 31);
    if (v < 2) {
      // stump: a short cylinder with roots, cut top with growth rings
      const cx = 13, top = 9, h = 6, rx = 5.5;
      for (let x = Math.floor(cx - rx); x < Math.ceil(cx + rx); x++) {
        const u = (x + 0.5 - (cx - rx)) / (2 * rx);
        for (let y = top; y < top + h + 2; y++) {
          let c = u < 0.25 ? C.e4 : u < 0.6 ? C.e3 : u < 0.85 ? C.e2 : C.e1;
          if ((x * 3 + (y >> 1)) % 5 === 0 && u > 0.15) c = C.e2;
          put(ctx, x, y, c);
        }
      }
      for (const [x, dir] of [[cx - rx - 1, -1], [cx + rx, 1]] as const) { put(ctx, x, top + h, dir < 0 ? C.e3 : C.e1, 1, 2); put(ctx, x + dir, top + h + 1, dir < 0 ? C.e2 : C.e0); }
      lump(ctx, cx, top, rx, 2.4, [C.e4, C.e5, C.e6, C.e6], { seed: v, edge: 0.1, flat: 0.9 });
      for (let a = 0; a < 20; a++) { const t = (a / 20) * 6.283; put(ctx, Math.round(cx + Math.cos(t) * 2.6), Math.round(top + Math.sin(t) * 1.1), C.e4); }
      put(ctx, cx, top, C.e3);
      if (v === 1) lump(ctx, cx + 3, top + 4, 3, 2.5, MOSS, { seed: 7, leafy: 0.6, bright: 0.05, edge: 0 });
      if (snow) lump(ctx, cx, top - 0.5, rx - 0.5, 1.8, SNOW, { seed: 2, edge: 0, flat: 1 });
    } else {
      // fallen log lying along the iso x axis, cut end facing the camera
      poly(ctx, [[3, 9], [17, 3], [22, 7], [8, 14]], (x, y) => { const d = ((x - 3) * 0.37 + (y - 9)) ; return d < -1.4 ? C.e4 : d < 1 ? C.e3 : d < 2.6 ? C.e2 : C.e1; });
      for (let i = 0; i < 4; i++) { const x = 6 + i * 3; line(ctx, x, 10 - Math.round(i * 1.2), x + 3, 9 - Math.round(i * 1.2), C.e2); }
      lump(ctx, 6, 11.5, 2.6, 2.8, [C.e3, C.e4, C.e5, C.e6], { seed: 3, edge: 0.2 });
      put(ctx, 6, 11, C.e3); put(ctx, 6, 12, C.e4);
      lump(ctx, 15, 5.5, 3, 1.6, MOSS, { seed: 5, leafy: 0.7, edge: 0 });
      if (snow) poly(ctx, [[5, 8], [17, 3], [20, 4], [8, 9]], C.white);
    }
    if (!snow) for (let i = 0; i < 5; i++) { const x = 3 + Math.floor(rng() * 20), y = 14 + Math.floor(rng() * 3); put(ctx, x, y, C.g3); put(ctx, x, y - 1, C.g4); if (i % 2) put(ctx, x + 1, y - 2, C.g5); }
    out.push(toSprite(canvas, 13, 16));
  }
  return out;
}

// ───────── ore outcrops: stone piles with glowing mineral nodules ─────────
const ORE_STYLE: Record<string, { ramp: number[]; seed: number; glint?: boolean }> = {
  ore_copper: { ramp: [C.r0, C.r1, C.r4, C.r5, C.r6], seed: 210 },
  ore_iron: { ramp: [C.e0, C.r0, C.r1, C.e4, C.e5], seed: 230 },
  ore_silver: { ramp: [C.mist, C.fog, C.pale, C.w7, C.white], seed: 250, glint: true },
  ore_gold: { ramp: [C.r1, C.r4, C.r5, C.r6, C.r7], seed: 270, glint: true },
};

/** Boulder shot through with a readable vein and chunky nuggets; silver and gold glint. */
export function buildOre(kind: keyof typeof ORE_STYLE, season: SeasonIdx): ObjSprite[] {
  const st = ORE_STYLE[kind]!;
  const out: ObjSprite[] = [];
  const M = st.ramp as unknown as Ramp;
  for (let v = 0; v < 3; v++) {
    for (let f = 0; f < (st.glint ? 2 : 1); f++) {
      const { canvas, ctx } = makeCanvas(40, 34);
      const rng = mulberry32(st.seed + v * 17);
      const piles: Array<Array<[number, number, number, number]>> = [
        [[19, 18, 11, 10], [28, 24, 6.5, 6], [11, 25, 5.5, 4.5]],
        [[16, 21, 9, 8], [26, 20, 8, 9]],
        [[20, 20, 12, 10], [9, 26, 4.5, 3.6]],
      ];
      stonePile(ctx, piles[v]!, STONE, { seed: st.seed + v, rough: 0.14, edge: 0.2, flat: 0.25 });
      if (season === 3) { const t = piles[v]![0]!; lump(ctx, t[0] - 1, t[1] - t[3] * 0.55, t[2] * 0.7, t[3] * 0.3, SNOW, { seed: v, edge: 0, flat: 0.7 }); }
      const img = ctx.getImageData(0, 0, 40, 34).data;
      const onRock = (x: number, y: number) => x >= 0 && y >= 0 && x < 40 && y < 34 && img[(y * 40 + x) * 4 + 3]! > 0;
      // a vein crack, then nuggets: lumps of mineral lit top-left with a bright glint
      let x = 10 + Math.floor(rng() * 4), y = 15 + Math.floor(rng() * 3);
      for (let j = 0; j < 20; j++) {
        if (onRock(x, y) && onRock(x, y + 1)) { put(ctx, x, y, M[1]!); put(ctx, x, y + 1, C.steel); }
        x += 1; y += rng() > 0.6 ? 1 : rng() > 0.8 ? -1 : 0;
      }
      for (let i = 0; i < 5; i++) {
        const nx = 10 + Math.floor(rng() * 20), ny = 12 + Math.floor(rng() * 12);
        if (!onRock(nx - 2, ny) || !onRock(nx + 2, ny + 2)) continue;
        lump(ctx, nx, ny, 1.9 + (i % 2) * 0.6, 1.6, M, { seed: i + v, edge: 0.15, bright: 0.05 });
        put(ctx, nx - 1, ny - 1, M[4]!);
      }
      if (st.glint) {
        const gx = 13 + ((v * 7 + f * 9) % 14), gy = 13 + ((v * 3 + f * 5) % 8);
        if (onRock(gx, gy)) { put(ctx, gx, gy, C.white); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) put(ctx, gx + dx, gy + dy, M[3]!); }
      }
      out.push(toSprite(canvas, 20, 29));
    }
  }
  return out;
}

/** Qubit crystal: faceted glass shards growing from a stone, glowing from within (cyan or magenta); three shimmer frames. */
export function buildCrystal(): ObjSprite[] {
  const out: ObjSprite[] = [];
  for (let v = 0; v < 2; v++) {
    // faces: [shaded, mid, lit, top facet], core glow [outer, inner]
    const face = v ? [C.q1, C.q2, C.q5, C.q6] : [C.w1, C.w2, C.w3, C.w5];
    const core = v ? [C.q6, C.white] : [C.q7, C.w7];
    for (let f = 0; f < 3; f++) {
      const { canvas, ctx } = makeCanvas(34, 40);
      stonePile(ctx, [[17, 34, 11, 4.5], [8, 35, 5, 3], [27, 35, 5, 3]], STONE, { seed: 30 + v, edge: 0.2, flat: 0.5 });
      const shard = (cx: number, base: number, w: number, h: number, lean: number) => {
        const top = base - h;
        const pts: Array<[number, number]> = [[cx - w / 2, base], [cx - w / 2 + lean, top + w * 0.6], [cx + lean, top], [cx + w / 2 + lean, top + w * 0.6], [cx + w / 2, base]];
        poly(ctx, pts, (x, y) => {
          const k = Math.max(0, Math.min(1, (y - top) / h));
          const mid = cx + lean * (1 - k);
          const u = (x + 0.5 - (mid - w / 2)) / w;
          if (y < top + w * 0.6 && u < 0.6) return face[3]!;                                // lit top facet
          let c = u < 0.5 ? face[2]! : u < 0.8 ? face[1]! : face[0]!;                        // lit / shaded faces
          const g = Math.abs(x + 0.5 - mid) < w * 0.18 && k > 0.3 && k < 0.85 - f * 0.05;      // glowing heart along the axis
          if (g) c = (k > 0.45 && k < 0.7 - f * 0.04) ? core[1]! : core[0]!;
          return c;
        });
      };
      shard(9, 34, 7, 12, -2); shard(25, 34, 7, 15, 2); shard(17, 35, 10, 26, 0);
      if (v) shard(29, 35, 5, 9, 1);
      for (let i = 0; i < 2; i++) {
        const sx = 8 + ((i * 11 + f * 5 + v * 3) % 18), sy = 5 + ((i * 7 + f * 9) % 20);
        if ((i + f) % 2 === 0) { put(ctx, sx, sy, C.white); put(ctx, sx - 1, sy, core[0]!); put(ctx, sx + 1, sy, core[0]!); put(ctx, sx, sy - 1, core[0]!); put(ctx, sx, sy + 1, core[0]!); }
      }
      out.push(toSprite(canvas, 17, 37));
    }
  }
  return out;
}

/** Seasonal forage plants: spring leeks+daffodils, summer berry bush, autumn mushrooms+nuts, winter snow yam+crocus. */
export function buildForage(season: SeasonIdx): ObjSprite[] {
  const out: ObjSprite[] = [];
  for (let v = 0; v < 3; v++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    const rng = mulberry32(900 + v * 23 + season * 5);
    if (season === 0) {
      for (let i = 0; i < 4; i++) { const x = 3 + i * 3 + Math.floor(rng() * 2); for (let j = 0; j < 7; j++) put(ctx, x + (j > 4 ? (i % 2 ? 1 : -1) : 0), 14 - j, j < 3 ? C.pale : j < 5 ? C.g5 : C.g4); put(ctx, x, 14, C.fog); }
      const fx = 4 + v * 3; line(ctx, fx, 14, fx, 8, C.g3); put(ctx, fx - 1, 7, C.r6); put(ctx, fx + 1, 7, C.r6); put(ctx, fx, 6, C.r7); put(ctx, fx, 8, C.r6); put(ctx, fx, 7, C.r4);
    } else if (season === 1) {
      lump(ctx, 8, 10, 6.5, 5, LEAF, { seed: 40 + v, leafy: 0.6 });
      lump(ctx, 7, 8, 4, 3, LEAF_SPRING, { seed: 44 + v, leafy: 0.5, bright: 0.12 });
      for (let i = 0; i < 6; i++) { const bx = 4 + Math.floor(rng() * 9), by = 7 + Math.floor(rng() * 6); put(ctx, bx, by, C.q2, 2, 2); put(ctx, bx, by, C.q4); }
    } else if (season === 2) {
      for (let i = 0; i < 3; i++) {
        const x = 4 + i * 4 + (v % 2), h = 4 + ((i + v) % 3);
        put(ctx, x, 14 - h, C.e6, 2, h); put(ctx, x + 1, 14 - h, C.e5, 1, h);
        lump(ctx, x + 1, 14 - h, 3.2 - (i % 2) * 0.6, 2.2, [C.r0, C.r1, C.r4, C.r5], { seed: 55 + i + v, edge: 0.2 });
        put(ctx, x, 13 - h, C.e7);
      }
      for (let i = 0; i < 2; i++) { const nx = 2 + Math.floor(rng() * 11); put(ctx, nx, 14, C.e3, 2, 2); put(ctx, nx, 14, C.e4); }
    } else {
      lump(ctx, 8, 13, 6.5, 2.6, SNOW, { seed: 70 + v, edge: 0.05, flat: 0.8 });
      for (let i = 0; i < 3; i++) { const x = 4 + i * 4 + (v % 2); line(ctx, x, 13, x, 9, C.g2); put(ctx, x - 1, 8, C.q3); put(ctx, x + 1, 8, C.q3); put(ctx, x, 8, C.q4); put(ctx, x, 7, C.q4); }
      put(ctx, 12, 12, C.e3, 2, 1);
    }
    out.push(toSprite(canvas, 8, 15, { rim: false }));
  }
  return out;
}

/** 16 connection variants (mask: N=1, E=2, S=4, W=8), iso: N = up-right, E = down-right, S = down-left, W = up-left. */
export function buildFence(): ObjSprite[] {
  const out: ObjSprite[] = [];
  const W = 34, H = 32, PX = 17, PY = 26;
  for (let m = 0; m < 16; m++) {
    const { canvas, ctx } = makeCanvas(W, H);
    const rail = (dx: number, dy: number, lit: boolean) => {
      for (const h of [5, 11]) {
        for (let i = 0; i <= 16; i++) {
          const x = PX + Math.sign(dx) * i, y = PY - h + Math.round((i / 16) * 8) * Math.sign(dy);
          put(ctx, x, y - 1, lit ? C.e5 : C.e4); put(ctx, x, y, lit ? C.e3 : C.e2); put(ctx, x, y + 1, C.e1);
        }
      }
    };
    // rails behind the post first (N, W), then the post, then the rails in front (E, S)
    if (m & 1) rail(1, -1, false);
    if (m & 8) rail(-1, -1, true);
    for (let y = PY - 15; y < PY + 1; y++) { put(ctx, PX - 2, y, C.e4); put(ctx, PX - 1, y, C.e3); put(ctx, PX, y, C.e2); put(ctx, PX + 1, y, C.e1); }
    put(ctx, PX - 2, PY - 16, C.e5, 4, 1); put(ctx, PX - 1, PY - 17, C.e5, 2, 1);
    if (m & 2) rail(1, 1, false);
    if (m & 4) rail(-1, 1, true);
    out.push(toSprite(canvas, PX, PY + 1));
  }
  return out;
}

/** Everything that depends on the season, rebuilt when the season changes. */
export interface ObjectArt {
  tree: ObjSprite[]; rock: ObjSprite[]; flowers: ObjSprite[]; tallgrass: ObjSprite[];
  bloom: ObjSprite[]; torch: ObjSprite[]; stump: ObjSprite[];
  ore_copper: ObjSprite[]; ore_iron: ObjSprite[]; ore_silver: ObjSprite[]; ore_gold: ObjSprite[];
  crystal: ObjSprite[]; forage: ObjSprite[]; fence: ObjSprite[];
  /** superposition trees (flux-rich groves); 4 frames per variant */
  qtree: ObjSprite[];
}
/** Kinds whose sprite list is [variant][frame] flattened with this many frames per variant (animated). */
export const FRAMES_PER_VARIANT: Record<string, number> = { qtree: 4, crystal: 3, ore_silver: 2, ore_gold: 2, torch: 2, bloom: 2 };

export function buildObjectArt(season: SeasonIdx): ObjectArt {
  return {
    tree: buildTrees(season), rock: buildRocks(season), flowers: buildFlowers(season), tallgrass: buildTallGrass(season),
    bloom: buildBloom(), torch: buildTorch(), stump: buildStump(season),
    ore_copper: buildOre('ore_copper', season), ore_iron: buildOre('ore_iron', season),
    ore_silver: buildOre('ore_silver', season), ore_gold: buildOre('ore_gold', season),
    crystal: buildCrystal(), forage: buildForage(season), fence: buildFence(), qtree: buildQTree(season),
  };
}

export function destroyObjectArt(a: ObjectArt): void {
  for (const list of Object.values(a)) for (const s of list) s.tex.destroy(true);
}

export { Rectangle };
