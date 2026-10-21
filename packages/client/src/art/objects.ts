import { Rectangle, Texture } from 'pixi.js';
import { hash2, mulberry32 } from '@eigenlands/shared';
import { bayer, blob, C, line, makeCanvas, put, R, slab, type Ctx } from './shade';

export interface ObjSprite { tex: Texture; ax: number; ay: number }
export type SeasonIdx = 0 | 1 | 2 | 3;

function toSprite(canvas: HTMLCanvasElement, ax: number, ay: number): ObjSprite {
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  return { tex, ax, ay };
}

function trunk(ctx: Ctx, cx: number, top: number, bot: number, w: number, seed: number): void {
  slab(ctx, cx - Math.floor(w / 2), top, w, bot - top, R.bark, seed, 0.45);
  // root flare
  put(ctx, cx - Math.ceil(w / 2) - 1, bot - 1, C.e1, 1, 1);
  put(ctx, cx + Math.floor(w / 2) + 1, bot - 1, C.e1, 1, 1);
  slab(ctx, cx - Math.floor(w / 2) - 1, bot - 2, w + 2, 2, R.bark, seed + 3, 0.3);
}

function branches(ctx: Ctx, rng: () => number, x: number, y: number, ang: number, len: number, depth: number, snow: boolean): void {
  if (depth === 0 || len < 2) return;
  const x2 = Math.round(x + Math.cos(ang) * len), y2 = Math.round(y - Math.sin(ang) * len);
  line(ctx, Math.round(x), Math.round(y), x2, y2, depth > 2 ? C.e2 : C.e1);
  if (snow && rng() > 0.4) put(ctx, x2, y2 - 1, C.white);
  branches(ctx, rng, x2, y2, ang + 0.5 + rng() * 0.35, len * 0.72, depth - 1, snow);
  branches(ctx, rng, x2, y2, ang - 0.5 - rng() * 0.35, len * 0.72, depth - 1, snow);
}

/** 32x40 broadleaf tree (anchor: trunk base). Seasonal: blossom, lush, autumn colours, bare + snow. */
function drawBroadleaf(ctx: Ctx, seed: number, season: SeasonIdx): void {
  const rng = mulberry32(seed * 7919 + 13);
  trunk(ctx, 16, season === 3 ? 18 : 22, 38, 5, seed);
  if (season === 3) {
    for (let i = 0; i < 4; i++) branches(ctx, rng, 16, 24 - i * 2, Math.PI / 2 + (i - 1.5) * 0.55, 8 - i, 4, true);
    blob(ctx, 16, 39, 6, 2, R.snow, { seed, noise: 0.2, edgeDark: 0.1 });
    return;
  }
  const blobs: Array<[number, number, number, number]> = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.6;
    const r = 5 + rng() * 5;
    blobs.push([16 + Math.cos(a) * r, 13 + Math.sin(a) * r * 0.75, 6 + rng() * 3, 5 + rng() * 3]);
  }
  blobs.sort((a, b) => a[1] - b[1]);
  blobs.forEach(([x, y, rx, ry], i) => {
    let ramp = season === 0 ? R.leafSpring : R.leaf;
    if (season === 2) {
      const h = hash2(seed, i, 0, 5);
      ramp = h < 0.35 ? R.leafAutumnO : h < 0.6 ? R.leafAutumnR : h < 0.85 ? R.leafAutumnY : R.leaf;
    }
    blob(ctx, x, y, rx, ry, ramp, { seed: seed + i * 31, noise: 0.45, bright: season === 2 ? 0.02 : 0 });
  });
  blob(ctx, 14, 9, 5, 3.5, season === 2 ? R.leafAutumnY : season === 0 ? R.leafSpring : R.leaf, { seed: seed + 5, noise: 0.4, bright: 0.18, edgeDark: 0.1 });
  if (season === 0) for (let i = 0; i < 16; i++) put(ctx, 6 + rng() * 20, 5 + rng() * 15, rng() > 0.5 ? C.r6 : C.q6);
  if (season === 2) for (let i = 0; i < 7; i++) put(ctx, 6 + rng() * 20, 30 + rng() * 8, rng() > 0.5 ? C.e5 : C.r4);
}

/** Layered conifer; keeps its needles in winter and gains snow. */
function drawPine(ctx: Ctx, seed: number, season: SeasonIdx): void {
  trunk(ctx, 16, 30, 38, 4, seed);
  const tiers = [[30, 11], [24, 9], [18, 7.5], [12, 5.5], [7, 3.5]];
  for (const [y, rx] of tiers) {
    blob(ctx, 16, y!, rx!, 5.5, R.pine, { seed: seed + y!, noise: 0.5, shape: 1.6, edgeDark: 0.3 });
    if (season === 3) blob(ctx, 15.5, y! - 2.3, rx! * 0.78, 2.6, R.snow, { seed: seed + y! + 1, noise: 0.25, shape: 1.8, edgeDark: 0.05 });
  }
}

export function buildTrees(season: SeasonIdx): ObjSprite[] {
  const out: ObjSprite[] = [];
  for (let v = 0; v < 6; v++) {
    const { canvas, ctx } = makeCanvas(32, 40);
    if (v >= 4) drawPine(ctx, 100 + v, season); else drawBroadleaf(ctx, 10 + v * 17, season);
    out.push(toSprite(canvas, 16, 38));
  }
  return out;
}

/** Faceted boulder: a low-poly fan around the centre, each facet lit by its own normal. */
function facetRock(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, seed: number, snow: boolean): void {
  const rng = mulberry32(seed);
  const n = 6 + Math.floor(rng() * 3);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.5;
    const k = 0.78 + rng() * 0.25;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k * 0.95]);
  }
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const px = x + 0.5, py = y + 0.5;
      for (let i = 0; i < n; i++) {
        const [ax, ay] = pts[i]!, [bx, by] = pts[(i + 1) % n]!;
        // point inside triangle (centre, a, b)?
        const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
        const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
        const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
        if ((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)) continue;
        const mid = Math.atan2((ay + by) / 2 - cy, (ax + bx) / 2 - cx);
        const nx = Math.cos(mid) * 0.8, ny = Math.sin(mid) * 0.8, nz = 0.6 + 0.2 * Math.sin(i * 1.7 + seed);
        const lam = nx * -0.55 + ny * -0.7 + nz * 0.45;
        const topness = Math.max(0, (cy - py) / ry);
        const t = 0.45 + 0.5 * lam + 0.18 * topness + (hash2(seed, x, y, 4) - 0.5) * 0.18;
        put(ctx, x, y, R.stone[Math.max(0, Math.min(R.stone.length - 1, Math.floor(t * (R.stone.length - 1) + bayer(x, y))))]!);
        break;
      }
    }
  }
  // moss on the lit shoulder (or snow in winter)
  if (snow) blob(ctx, cx + 1, cy - ry * 0.55, rx * 0.7, ry * 0.32, R.snow, { seed, noise: 0.15, edgeDark: 0.05 });
  else if (hash2(seed, 1, 1, 8) > 0.35) blob(ctx, cx - rx * 0.25, cy - ry * 0.5, rx * 0.5, ry * 0.3, R.moss, { seed, noise: 0.5, edgeDark: 0.1 });
}

export function buildRocks(season: SeasonIdx): ObjSprite[] {
  const out: ObjSprite[] = [];
  for (let v = 0; v < 6; v++) {
    const { canvas, ctx } = makeCanvas(24, 18);
    const big = v % 3 === 0;
    facetRock(ctx, big ? 12 : 9, big ? 10 : 11, big ? 9.5 : 6.5, big ? 7 : 5, 40 + v * 13, season === 3);
    if (v % 3 === 1) facetRock(ctx, 16, 12, 5.5, 4.5, 90 + v * 7, season === 3);
    out.push(toSprite(canvas, 12, 16));
  }
  return out;
}

const PETALS: number[][] = [[C.r5, C.r6], [C.e6, C.e7], [C.q4, C.q5], [C.w5, C.w6], [C.r3, C.r4], [C.q6, C.white]];

export function buildFlowers(season: SeasonIdx): ObjSprite[] {
  const out: ObjSprite[] = [];
  for (let v = 0; v < 6; v++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    const rng = mulberry32(v * 313 + 11);
    const n = 4 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const x = 2 + Math.floor(rng() * 12), y = 7 + Math.floor(rng() * 7), h = 3 + Math.floor(rng() * 3);
      const pal = PETALS[(v + i) % PETALS.length]!;
      line(ctx, x, y, x + (rng() > 0.5 ? 1 : 0), y - h, season === 3 ? C.fog : season === 2 ? C.e3 : C.g3);
      if (season === 3) { put(ctx, x, y - h - 1, C.white); continue; }
      if (season === 2 && rng() > 0.3) { put(ctx, x, y - h - 1, C.e4); continue; }
      const px = x, py = y - h - 1;
      put(ctx, px - 1, py, pal[0]!); put(ctx, px + 1, py, pal[0]!); put(ctx, px, py - 1, pal[1]!); put(ctx, px, py + 1, pal[0]!);
      put(ctx, px, py, C.e7);
    }
    out.push(toSprite(canvas, 8, 15));
  }
  return out;
}

export function buildTallGrass(season: SeasonIdx): ObjSprite[] {
  const out: ObjSprite[] = [];
  const ramp = season === 3 ? [C.mist, C.fog, C.pale] : season === 2 ? [C.e3, C.e4, C.e5, C.e6] : season === 0 ? [C.g3, C.g4, C.g5, C.g6] : [C.g2, C.g3, C.g4, C.g5];
  for (let v = 0; v < 4; v++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    const rng = mulberry32(v * 457 + 3);
    for (let i = 0; i < 9; i++) {
      const x = 2 + Math.floor(rng() * 12), h = 4 + Math.floor(rng() * 6), lean = (rng() - 0.5) * 4;
      for (let j = 0; j < h; j++) {
        const t = j / h;
        put(ctx, x + Math.round(lean * t * t), 15 - j, ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))]!);
      }
    }
    out.push(toSprite(canvas, 8, 15));
  }
  return out;
}

export function buildBloom(): ObjSprite[] {
  const out: ObjSprite[] = [];
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    line(ctx, 8, 15, 8, 8, C.g3);
    put(ctx, 5, 12, C.g4, 3, 1); put(ctx, 9, 11, C.g4, 3, 1);
    blob(ctx, 8, 6.5, 4.5, 4, R.crystal, { seed: f + 1, noise: 0.15, bright: 0.2 + f * 0.08, edgeDark: 0.12 });
    put(ctx, 8, 6, C.white); put(ctx, 7, 5, C.q7); put(ctx, 9, 7, C.q7);
    out.push(toSprite(canvas, 8, 15));
  }
  return out;
}

export function buildTorch(): ObjSprite[] {
  const out: ObjSprite[] = [];
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeCanvas(16, 24);
    slab(ctx, 7, 11, 2, 12, R.bark, 4, 0.3);
    slab(ctx, 5, 9, 6, 3, R.gold, 5, 0.2);
    put(ctx, 4, 8, C.e2, 8, 1);
    blob(ctx, 8, 5 - f * 0.4, 3.4, 4.6 + f * 0.6, [C.r3, C.r4, C.e4, C.e5, C.e6], { seed: f + 3, noise: 0.15, bright: 0.2 });
    blob(ctx, 8, 6, 1.8, 2.8, [C.e6, C.e7, C.white], { seed: 9, noise: 0.05, bright: 0.2, edgeDark: 0 });
    put(ctx, 8 + (f ? 1 : -1), 0 + f, C.e7);
    put(ctx, 6, 22, C.e1, 4, 1);
    out.push(toSprite(canvas, 8, 23));
  }
  return out;
}

export function buildStump(season: SeasonIdx): ObjSprite[] {
  const { canvas, ctx } = makeCanvas(16, 16);
  slab(ctx, 4, 8, 8, 6, R.bark, 2, 0.4);
  blob(ctx, 8, 8, 4.5, 2.4, [C.e4, C.e5, C.e6, C.e7], { seed: 8, noise: 0.1, edgeDark: 0.2 });
  put(ctx, 6, 8, C.e3); put(ctx, 9, 8, C.e3); put(ctx, 8, 7, C.e3);
  if (season === 3) blob(ctx, 8, 7.2, 4.2, 1.6, R.snow, { seed: 2, noise: 0.1, edgeDark: 0 });
  else { put(ctx, 4, 12, C.g3, 2, 1); put(ctx, 11, 13, C.g4, 2, 1); }
  return [toSprite(canvas, 8, 14)];
}

/** Everything that depends on the season, rebuilt when the season changes. */
export interface ObjectArt {
  tree: ObjSprite[]; rock: ObjSprite[]; flowers: ObjSprite[]; tallgrass: ObjSprite[];
  bloom: ObjSprite[]; torch: ObjSprite[]; stump: ObjSprite[];
}

export function buildObjectArt(season: SeasonIdx): ObjectArt {
  return {
    tree: buildTrees(season), rock: buildRocks(season), flowers: buildFlowers(season), tallgrass: buildTallGrass(season),
    bloom: buildBloom(), torch: buildTorch(), stump: buildStump(season),
  };
}

export function destroyObjectArt(a: ObjectArt): void {
  for (const list of Object.values(a)) for (const s of list) s.tex.destroy(true);
}

export { Rectangle };
