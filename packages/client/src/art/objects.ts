import { Rectangle, Texture } from 'pixi.js';
import { hash2, mulberry32 } from '@eigenlands/shared';
import { bayer, blob, C, line, makeCanvas, poly, polish, put, R, slab, type Ctx } from './shade';

export interface ObjSprite { tex: Texture; ax: number; ay: number }
export type SeasonIdx = 0 | 1 | 2 | 3;

function toSprite(canvas: HTMLCanvasElement, ax: number, ay: number, o: { ao?: boolean; rim?: boolean; fringe?: boolean } = {}): ObjSprite {
  const ctx = canvas.getContext('2d')!;
  polish(ctx, canvas.width, canvas.height, { rim: o.rim ?? true, fringe: o.fringe, ao: o.ao === false ? null : { ax, ay, rx: Math.min(14, canvas.width * 0.34) } });
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  return { tex, ax, ay };
}

function trunk(ctx: Ctx, cx: number, top: number, bot: number, w: number, seed: number): void {
  const x0 = cx - Math.floor(w / 2);
  slab(ctx, x0, top, w, bot - top, R.bark, seed, 0.5);
  // bark ridges: darker vertical furrows with lit edges, plus a few knots
  for (let i = 1; i < w - 1; i += 2) for (let y = top; y < bot; y++) { if (hash2(seed, i, y, 11) > 0.35) { put(ctx, x0 + i, y, C.e0); if (hash2(seed, i, y, 12) > 0.6) put(ctx, x0 + i - 1, y, C.e4); } }
  put(ctx, x0, top, C.e4, 1, bot - top);
  put(ctx, x0 + Math.floor(w / 2), top + Math.floor((bot - top) * 0.45), C.e0, 2, 2);
  // root flare
  slab(ctx, x0 - 2, bot - 3, w + 4, 3, R.bark, seed + 3, 0.4);
  put(ctx, x0 - 3, bot - 1, C.e1, 1, 1); put(ctx, x0 + w + 2, bot - 1, C.e1, 1, 1);
  put(ctx, x0 - 2, bot - 3, C.e4, 1, 1);
}

function branches(ctx: Ctx, rng: () => number, x: number, y: number, ang: number, len: number, depth: number, snow: boolean): void {
  if (depth === 0 || len < 2) return;
  const x2 = Math.round(x + Math.cos(ang) * len), y2 = Math.round(y - Math.sin(ang) * len);
  line(ctx, Math.round(x), Math.round(y), x2, y2, depth > 2 ? C.e2 : C.e1);
  if (snow && rng() > 0.4) put(ctx, x2, y2 - 1, C.white);
  branches(ctx, rng, x2, y2, ang + 0.5 + rng() * 0.35, len * 0.72, depth - 1, snow);
  branches(ctx, rng, x2, y2, ang - 0.5 - rng() * 0.35, len * 0.72, depth - 1, snow);
}

/** 48x60 broadleaf tree (anchor: trunk base). Seasonal: blossom, lush, autumn colours, bare + snow. */
function drawBroadleaf(ctx: Ctx, seed: number, season: SeasonIdx): void {
  const rng = mulberry32(seed * 7919 + 13);
  trunk(ctx, 24, season === 3 ? 26 : 32, 58, 7, seed);
  if (season === 3) {
    for (let i = 0; i < 5; i++) branches(ctx, rng, 24, 38 - i * 3, Math.PI / 2 + (i - 2) * 0.5, 14 - i * 1.5, 5, true);
    blob(ctx, 24, 58, 9, 3, R.snow, { seed, noise: 0.2, edgeDark: 0.1 });
    return;
  }
  const blobs: Array<[number, number, number, number]> = [];
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.6;
    const r = 7 + rng() * 9;
    blobs.push([24 + Math.cos(a) * r * 1.1, 21 + Math.sin(a) * r * 0.8, 8 + rng() * 5, 6.5 + rng() * 5]);
  }
  blobs.sort((a, b) => a[1] - b[1]);
  blobs.forEach(([x, y, rx, ry], i) => {
    let ramp = season === 0 ? R.leafSpring : R.leaf;
    if (season === 2) {
      const h = hash2(seed, i, 0, 5);
      ramp = h < 0.35 ? R.leafAutumnO : h < 0.6 ? R.leafAutumnR : h < 0.85 ? R.leafAutumnY : R.leaf;
    }
    blob(ctx, x, y, rx, ry, ramp, { seed: seed + i * 31, noise: 0.5, bright: season === 2 ? 0.02 : 0 });
  });
  // leaf clusters: small bright/dark clumps break the blobs into foliage
  for (let i = 0; i < 26; i++) {
    const lx = 10 + rng() * 28, ly = 6 + rng() * 26, up = ly < 18;
    const ramp = season === 2 ? R.leafAutumnY : season === 0 ? R.leafSpring : R.leaf;
    put(ctx, lx, ly, ramp[up ? ramp.length - 1 : 1]!, 2 + Math.floor(rng() * 2), 1 + Math.floor(rng() * 2));
  }
  blob(ctx, 20, 12, 8, 5.5, season === 2 ? R.leafAutumnY : season === 0 ? R.leafSpring : R.leaf, { seed: seed + 5, noise: 0.45, bright: 0.2, edgeDark: 0.1 });
  if (season === 0) for (let i = 0; i < 24; i++) put(ctx, 8 + rng() * 32, 7 + rng() * 22, rng() > 0.5 ? C.r6 : C.q6);
  if (season === 2) for (let i = 0; i < 9; i++) put(ctx, 8 + rng() * 32, 44 + rng() * 12, rng() > 0.5 ? C.e5 : C.r4);
}

/** Layered conifer (48x64); keeps its needles in winter and gains snow. */
function drawPine(ctx: Ctx, seed: number, season: SeasonIdx): void {
  trunk(ctx, 24, 48, 62, 5, seed);
  const tiers = [[46, 16], [37, 13.5], [29, 11.5], [21, 9], [13, 6]];
  for (const [y, rx] of tiers) {
    blob(ctx, 24, y!, rx!, 8.5, R.pine, { seed: seed + y!, noise: 0.55, shape: 1.6, edgeDark: 0.3 });
    for (let k = 0; k < 6; k++) put(ctx, 24 - rx! + 2 + ((k * 7 + y!) % Math.floor(rx! * 2 - 3)), y! + 3 + (k % 3), C.g0, 3, 1);   // needle shadows
    if (season === 3) blob(ctx, 23.5, y! - 3.4, rx! * 0.8, 3.6, R.snow, { seed: seed + y! + 1, noise: 0.25, shape: 1.8, edgeDark: 0.05 });
  }
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

/** Faceted boulder: a low-poly fan around the centre, each facet lit by its own normal. */
export function facetRock(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, seed: number, snow: boolean): void {
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
    const { canvas, ctx } = makeCanvas(34, 26);
    const big = v % 3 === 0;
    facetRock(ctx, big ? 17 : 13, big ? 15 : 16, big ? 13.5 : 9.5, big ? 9.5 : 7, 40 + v * 13, season === 3);
    if (v % 3 === 1) facetRock(ctx, 23, 17, 8, 6.4, 90 + v * 7, season === 3);
    out.push(toSprite(canvas, 17, 23));
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
    out.push(toSprite(canvas, 8, 15, { ao: false, rim: false }));
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
    out.push(toSprite(canvas, 8, 15, { ao: false, rim: false }));
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
    out.push(toSprite(canvas, 8, 15, { fringe: true }));
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

// ───────── Phase 2 tile objects ─────────
const ORE_STYLE: Record<string, { vein: number[]; seed: number; glint?: boolean }> = {
  ore_copper: { vein: [C.e4, C.e5, C.e6], seed: 210 },
  ore_iron: { vein: [C.steel, C.w4, C.w5], seed: 230 },
  ore_silver: { vein: [C.fog, C.pale, C.w7], seed: 250, glint: true },
  ore_gold: { vein: [C.e5, C.e6, C.e7], seed: 270, glint: true },
};

/** Rock with coloured metal veins and nuggets; silver and gold glint on a second frame. */
export function buildOre(kind: keyof typeof ORE_STYLE, season: SeasonIdx): ObjSprite[] {
  const st = ORE_STYLE[kind]!;
  const out: ObjSprite[] = [];
  for (let v = 0; v < 3; v++) {
    for (let f = 0; f < (st.glint ? 2 : 1); f++) {
      const { canvas, ctx } = makeCanvas(34, 26);
      const rng = mulberry32(st.seed + v * 17);
      facetRock(ctx, 17, 15, v === 1 ? 11 : 13, 9.5, st.seed + v, season === 3);
      for (let i = 0; i < 6; i++) {
        let x = 8 + Math.floor(rng() * 16), y = 9 + Math.floor(rng() * 9);
        const len = 4 + Math.floor(rng() * 5), dx = rng() > 0.5 ? 1 : -1;
        for (let j = 0; j < len; j++) {
          put(ctx, x, y, st.vein[j % 3]!);
          if (j % 2 === 0) put(ctx, x, y + 1, st.vein[0]!);
          x += dx; y += rng() > 0.6 ? 1 : 0;
        }
      }
      for (let i = 0; i < 5; i++) {
        const x = 8 + Math.floor(rng() * 17), y = 9 + Math.floor(rng() * 9);
        put(ctx, x, y, st.vein[1]!, 2, 2); put(ctx, x, y, st.vein[2]!); put(ctx, x + 1, y + 1, st.vein[0]!);
      }
      if (st.glint) { const gx = 9 + ((v * 5 + f * 7) % 15), gy = 9 + ((v * 3 + f * 3) % 7); put(ctx, gx, gy, C.white); put(ctx, gx - 1, gy, st.vein[2]!); put(ctx, gx + 1, gy, st.vein[2]!); put(ctx, gx, gy - 1, st.vein[2]!); put(ctx, gx, gy + 1, st.vein[2]!); }
      out.push(toSprite(canvas, 17, 23, { fringe: kind === 'ore_silver' }));
    }
  }
  return out;
}

const CRYSTAL = [C.q0, C.q1, C.q2, C.q3, C.q4, C.pale, C.white] as const;

/** Faceted violet crystal cluster with an inner glow; three shimmer frames. */
export function buildCrystal(): ObjSprite[] {
  const out: ObjSprite[] = [];
  for (let v = 0; v < 2; v++) {
    for (let f = 0; f < 3; f++) {
      const { canvas, ctx } = makeCanvas(34, 40);
      const prism = (cx: number, base: number, w: number, h: number, lean: number) => {
        const top = base - h;
        const pts: Array<[number, number]> = [[cx - w / 2, base], [cx - w / 2 + lean, top + w * 0.7], [cx + lean, top], [cx + w / 2 + lean, top + w * 0.7], [cx + w / 2, base]];
        poly(ctx, pts, (x, y) => {
          const t = (x - (cx - w / 2)) / w;
          const glow = Math.max(0, 1 - Math.hypot(x - cx, y - (base - h * 0.45)) / (h * 0.55));
          let i = t < 0.34 ? 4 : t < 0.7 ? 5 : 2;
          i += glow > 0.55 ? 1 : 0;
          if (y < top + w * 0.7 && t > 0.45) i = 6;
          if (((x + y + f) % 7) === 0 && glow > 0.2) i = Math.min(6, i + 1);
          return CRYSTAL[Math.max(0, Math.min(6, i))]!;
        });
        line(ctx, Math.round(cx + lean), top, Math.round(cx + lean), base - 1, C.q1);
        line(ctx, Math.round(cx - w / 2 + lean * 0.5), top + Math.round(w * 0.7), Math.round(cx - w / 2), base - 1, C.q3);
      };
      prism(8, 36, 9, 15, -1); prism(25, 36, 9, 18, 1); prism(16, 38, 12, 28, 0);
      if (v) prism(30, 36, 6, 11, 1);
      for (let i = 0; i < 5; i++) {
        const sx = 7 + ((i * 7 + f * 5 + v * 3) % 20), sy = 8 + ((i * 5 + f * 9) % 24);
        if ((i + f) % 3 === 0) { put(ctx, sx, sy, C.white); put(ctx, sx - 1, sy, C.q7); put(ctx, sx + 1, sy, C.q7); put(ctx, sx, sy - 1, C.q7); put(ctx, sx, sy + 1, C.q7); }
      }
      out.push(toSprite(canvas, 17, 37, { fringe: true }));
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
      const fx = 4 + v * 3; line(ctx, fx, 14, fx, 8, C.g3); put(ctx, fx - 1, 7, C.e6); put(ctx, fx + 1, 7, C.e6); put(ctx, fx, 6, C.e6); put(ctx, fx, 8, C.e6); put(ctx, fx, 7, C.e4);
    } else if (season === 1) {
      blob(ctx, 8, 10, 6.5, 5, R.leaf, { seed: 40 + v, noise: 0.5 });
      blob(ctx, 7, 8, 4, 3, R.leafSpring, { seed: 44 + v, noise: 0.4, bright: 0.1 });
      for (let i = 0; i < 7; i++) { const bx = 4 + Math.floor(rng() * 9), by = 7 + Math.floor(rng() * 6); put(ctx, bx, by, C.q2, 2, 2); put(ctx, bx, by, C.q4); }
    } else if (season === 2) {
      for (let i = 0; i < 3; i++) {
        const x = 4 + i * 4 + (v % 2), h = 4 + ((i + v) % 3);
        put(ctx, x, 14 - h, C.pale, 2, h); put(ctx, x, 14 - h, C.mist);
        blob(ctx, x + 1, 14 - h, 3.2 - (i % 2) * 0.6, 2.2, [C.e2, C.e3, C.e4, C.e5, C.e6], { seed: 55 + i + v, noise: 0.25, edgeDark: 0.2 });
        put(ctx, x, 13 - h, C.e7); put(ctx, x + 2, 14 - h, C.e7);
      }
      for (let i = 0; i < 2; i++) { const nx = 2 + Math.floor(rng() * 11); put(ctx, nx, 14, C.e3, 2, 2); put(ctx, nx, 14, C.e5); }
    } else {
      blob(ctx, 8, 13, 6.5, 2.6, R.snow, { seed: 70 + v, noise: 0.2, edgeDark: 0.05 });
      for (let i = 0; i < 3; i++) { const x = 4 + i * 4 + (v % 2); line(ctx, x, 13, x, 9, C.g2); put(ctx, x - 1, 8, C.q5); put(ctx, x + 1, 8, C.q5); put(ctx, x, 8, C.q6); put(ctx, x, 7, C.q4); }
      put(ctx, 12, 12, C.e3, 2, 1);
    }
    out.push(toSprite(canvas, 8, 15, { rim: false }));
  }
  return out;
}

/** 16 connection variants (mask: N=1, E=2, S=4, W=8). */
export function buildFence(): ObjSprite[] {
  const out: ObjSprite[] = [];
  for (let m = 0; m < 16; m++) {
    const { canvas, ctx } = makeCanvas(16, 20);
    const rail = (x: number, w: number) => { slab(ctx, x, 6, w, 2, R.bark, m + 1, 0.2); slab(ctx, x, 11, w, 2, R.bark, m + 5, 0.2); put(ctx, x, 6, C.e5, w, 1); put(ctx, x, 11, C.e5, w, 1); };
    if (m & 8) rail(0, 7);
    if (m & 2) rail(9, 7);
    if (m & 1) { slab(ctx, 6, 0, 4, 6, R.bark, m + 9, 0.2); put(ctx, 7, 1, C.e5, 2, 1); }       // runs "up" behind the post
    if (m & 4) { slab(ctx, 6, 14, 4, 5, R.bark, m + 13, 0.2); put(ctx, 6, 14, C.e5, 4, 1); }    // runs "down" in front
    slab(ctx, 6, 3, 4, 12, R.bark, 3, 0.35);
    put(ctx, 6, 3, C.e5, 4, 1); put(ctx, 7, 2, C.e4, 2, 1);
    put(ctx, 6, 15, C.e0, 4, 1);
    out.push(toSprite(canvas, 8, 16));
  }
  return out;
}

/** Everything that depends on the season, rebuilt when the season changes. */
export interface ObjectArt {
  tree: ObjSprite[]; rock: ObjSprite[]; flowers: ObjSprite[]; tallgrass: ObjSprite[];
  bloom: ObjSprite[]; torch: ObjSprite[]; stump: ObjSprite[];
  ore_copper: ObjSprite[]; ore_iron: ObjSprite[]; ore_silver: ObjSprite[]; ore_gold: ObjSprite[];
  crystal: ObjSprite[]; forage: ObjSprite[]; fence: ObjSprite[];
}
/** Kinds whose sprite list is [variant][frame] flattened with this many frames per variant (animated). */
export const FRAMES_PER_VARIANT: Record<string, number> = { crystal: 3, ore_silver: 2, ore_gold: 2, torch: 2, bloom: 2 };

export function buildObjectArt(season: SeasonIdx): ObjectArt {
  return {
    tree: buildTrees(season), rock: buildRocks(season), flowers: buildFlowers(season), tallgrass: buildTallGrass(season),
    bloom: buildBloom(), torch: buildTorch(), stump: buildStump(season),
    ore_copper: buildOre('ore_copper', season), ore_iron: buildOre('ore_iron', season),
    ore_silver: buildOre('ore_silver', season), ore_gold: buildOre('ore_gold', season),
    crystal: buildCrystal(), forage: buildForage(season), fence: buildFence(),
  };
}

export function destroyObjectArt(a: ObjectArt): void {
  for (const list of Object.values(a)) for (const s of list) s.tex.destroy(true);
}

export { Rectangle };
