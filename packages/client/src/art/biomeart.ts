import { drawOutcrop } from './geology';
import { hash2, mulberry32, type Biome } from '@eigenlands/shared';
import {
  branches,
  buildFlowers,
  buildRocks,
  buildStump,
  buildTallGrass,
  crown,
  drawBroadleaf,
  drawPine,
  toSprite,
  trunk,
  type ObjSprite,
  type SeasonIdx,
} from './objects';
import { C, line, lump, makeCanvas, poly, put, type Ctx, type Ramp } from './shade';

/**
 * Biome flora in the same painterly block-tile style as objects.ts: each biome swaps the sprites of the shared
 * tile kinds (tree, rock, tallgrass, flowers, stump) for its own. Seasonal biomes (Bloch Tundra is always snowed in,
 * Amberwood always golden) reuse the seasonal builders; the rest are drawn here.
 */
export type BiomeArt = Partial<
  Record<Biome, Partial<Record<'tree' | 'rock' | 'tallgrass' | 'flowers' | 'stump', ObjSprite[]>>>
>;

const BARK_DARK: Ramp = [C.night, C.e0, C.e1, C.e2];
const WILLOW: Ramp = [C.g0, C.g1, C.g2, C.g3, C.g4, C.g5];
const GLADE: Ramp = [C.q0, C.w0, C.w1, C.w2, C.w3, C.w5];
const GLADE_HI: Ramp = [C.w2, C.w3, C.w5, C.q7, C.w7];
const VOID_BARK: Ramp = [C.ink, C.q0, C.q1, C.slate, C.steel];
const CRY: Ramp = [C.q0, C.q1, C.q2, C.q3, C.q4, C.q6];
const SANDSTONE: Ramp = [C.e2, C.e3, C.e4, C.e5, C.e6, C.e7];
const CACTUS: Ramp = [C.g0, C.g1, C.g2, C.g3, C.g4, C.g5];
const OBSIDIAN: Ramp = [C.ink, C.night, C.q0, C.q1, C.slate, C.steel];

/** Fen willow: a short gnarled trunk under a drooping curtain of strands. */
function drawWillow(ctx: Ctx, seed: number): void {
  const rng = mulberry32(seed);
  trunk(ctx, 24, 36, 60, 7, seed);
  line(ctx, 22, 40, 14, 31, C.e1);
  line(ctx, 26, 39, 33, 31, C.e2);
  crown(ctx, rng, 24, 24, 19, 12, 12, () => WILLOW, seed);
  // hanging strands, lit on the left, fading into shade low down
  for (let i = 0; i < 30; i++) {
    const x = 7 + Math.floor(rng() * 34),
      y0 = 22 + Math.floor(rng() * 10),
      len = 10 + Math.floor(rng() * 16);
    for (let j = 0; j < len; j++) {
      const k = j / len;
      put(
        ctx,
        x + (j > len * 0.7 ? (x < 24 ? -1 : 1) : 0),
        y0 + j,
        k < 0.3 ? (x < 24 ? C.g4 : C.g3) : k < 0.7 ? C.g2 : C.g1,
      );
    }
  }
}

/** Fen snag: a dead, leaning trunk with a few bare limbs and shelf fungus. */
function drawSnag(ctx: Ctx, seed: number, ramp: Ramp, fungus: number): void {
  const rng = mulberry32(seed);
  for (let y = 22; y < 61; y++) {
    const lean = Math.round((61 - y) * 0.12);
    for (let i = 0; i < 5; i++)
      put(ctx, 22 + lean + i, y, ramp[Math.min(ramp.length - 1, i === 0 ? 3 : i < 3 ? 2 : 1)]!);
  }
  put(ctx, 20, 60, ramp[1]!, 9, 1);
  for (let i = 0; i < 4; i++)
    branches(
      ctx,
      rng,
      25 + Math.round((61 - (30 + i * 6)) * 0.12),
      30 + i * 6,
      Math.PI / 2 + (i % 2 ? 0.7 : -0.7),
      9 - i,
      3,
      false,
    );
  for (let i = 0; i < 3; i++) {
    const y = 40 + i * 6;
    put(ctx, 27 + Math.round((61 - y) * 0.12), y, fungus, 3, 1);
    put(ctx, 28 + Math.round((61 - y) * 0.12), y + 1, C.e1, 2, 1);
  }
}

/** Saguaro and barrel cacti on the dunes. */
function drawCactus(ctx: Ctx, seed: number, tall: boolean): void {
  const rng = mulberry32(seed);
  const rib = (x: number, y0: number, y1: number, w: number) => {
    for (let y = y0; y < y1; y++)
      for (let i = 0; i < w; i++) {
        const u = i / (w - 1);
        let c: number = u < 0.25 ? CACTUS[4]! : u < 0.6 ? CACTUS[3]! : CACTUS[1]!;
        if ((i === 1 || i === w - 2) && y % 2 === 0) c = CACTUS[2]!; // ribs
        if (y === y0) c = CACTUS[5]!;
        put(ctx, x + i, y, c);
      }
    for (let y = y0 + 2; y < y1; y += 3) put(ctx, x - 1, y, C.e7); // spines catching light
  };
  if (tall) {
    rib(21, 18, 60, 7);
    rib(12, 30, 42, 5);
    put(ctx, 12, 41, CACTUS[2]!, 10, 3); // left arm + elbow
    rib(31, 24, 36, 5);
    put(ctx, 27, 35, CACTUS[2]!, 9, 3);
    if (rng() > 0.4) {
      put(ctx, 23, 16, C.r3, 3, 2);
      put(ctx, 24, 15, C.r6);
    } // bloom
  } else {
    lump(ctx, 24, 54, 9, 7, CACTUS, { seed, rough: 0.08, edge: 0.2 });
    for (let i = -6; i <= 6; i += 3) line(ctx, 24 + i, 48, 24 + Math.round(i * 1.2), 60, CACTUS[2]!);
    put(ctx, 22, 46, C.q5, 2, 2);
    put(ctx, 26, 47, C.r6);
  }
  put(ctx, 18, 61, C.e4, 13, 1); // drifted sand at the foot
}

/** Glade tree: a pale trunk under a luminous teal crown hung with glowing fruit. */
function drawGladeTree(ctx: Ctx, seed: number): void {
  const rng = mulberry32(seed);
  for (let y = 34; y < 60; y++)
    for (let i = 0; i < 5; i++) put(ctx, 22 + i, y, i === 0 ? C.pale : i < 3 ? C.fog : C.mist);
  put(ctx, 19, 59, C.mist, 11, 1);
  crown(ctx, rng, 24, 24, 20, 16, 15, (i) => (hash2(seed, i, 1, 2) > 0.7 ? GLADE_HI : GLADE), seed);
  for (let i = 0; i < 7; i++) {
    const x = 10 + rng() * 28,
      y = 16 + rng() * 20;
    put(ctx, x, y, C.q7, 2, 2);
    put(ctx, x, y, C.white);
  }
}

/** Decohered tree: a black, splitting trunk with crystal shards growing from its wounds. */
function drawVoidTree(ctx: Ctx, seed: number): void {
  const rng = mulberry32(seed);
  drawSnag(ctx, seed, VOID_BARK, C.q5);
  for (let i = 0; i < 3; i++) {
    const x = 18 + Math.floor(rng() * 14),
      y = 26 + Math.floor(rng() * 26),
      h = 5 + Math.floor(rng() * 5);
    poly(
      ctx,
      [
        [x, y],
        [x + 2, y - h],
        [x + 4, y],
      ],
      (px) => (px < x + 2 ? CRY[4]! : CRY[2]!),
    );
    put(ctx, x + 1, y - h + 2, C.q6);
  }
}

function list(n: number, draw: (ctx: Ctx, v: number) => void, w = 48, h = 64, ax = 24, ay = 61): ObjSprite[] {
  const out: ObjSprite[] = [];
  for (let v = 0; v < n; v++) {
    const { canvas, ctx } = makeCanvas(w, h);
    draw(ctx, v);
    out.push(toSprite(canvas, ax, ay));
  }
  return out;
}

/** Rocks of one colour ramp (sandstone, obsidian), in the same pile shapes as the meadow boulders. */
function rocksOf(ramp: Ramp, crystal: boolean): ObjSprite[] {
  return list(
    4,
    (ctx, v) => {
      drawOutcrop(ctx, v, undefined, false, 0, ramp);
      if (crystal)
        poly(
          ctx,
          [
            [18, 23],
            [20, 12],
            [23, 23],
          ],
          (px) => (px < 20 ? CRY[5]! : CRY[2]!),
        );
    },
    40,
    40,
    20,
    29,
  );
}

/** Reeds, dry scrub, glow ferns and ash thorns: per-biome replacements for tall grass. */
function bladesOf(ramp: Ramp, seed: number, opts: { tall: number; heads?: number; glow?: number }): ObjSprite[] {
  return list(
    4,
    (ctx, v) => {
      const rng = mulberry32(seed + v * 31);
      for (let i = 0; i < 14; i++) {
        const x = 3 + Math.floor(rng() * 14),
          h = opts.tall * (0.5 + rng() * 0.6),
          lean = (rng() - 0.5) * 4;
        for (let j = 0; j < h; j++) {
          const t = j / h;
          put(ctx, x + Math.round(lean * t * t), 23 - j, ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))]!);
        }
        if (opts.heads !== undefined && rng() > 0.5) {
          const tx = x + Math.round(lean),
            ty = 23 - Math.floor(h);
          put(ctx, tx, ty - 2, opts.heads, 1, 3);
        }
        if (opts.glow !== undefined && rng() > 0.7) put(ctx, x + Math.round(lean), 23 - Math.floor(h), opts.glow);
      }
    },
    20,
    24,
    10,
    23,
  );
}

/** Toadstools and glowcaps: replacements for flowers in the fen and the glade. */
function mushroomsOf(cap: Ramp, stem: number, spots: number, seed: number): ObjSprite[] {
  return list(
    4,
    (ctx, v) => {
      const rng = mulberry32(seed + v * 17);
      const n = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const x = 4 + Math.floor(rng() * 12),
          y = 10 + Math.floor(rng() * 4),
          r = 2 + rng() * 1.6;
        line(ctx, x, y, x, y + 4, stem);
        lump(ctx, x + 0.5, y, r, r * 0.65, cap, { seed: seed + i, edge: 0.1 });
        put(ctx, x - 1, y - 1, spots);
      }
    },
    20,
    16,
    10,
    15,
  );
}

/** Every biome's flora, built once (biome sprites do not change with the calendar). */
export function buildBiomeArt(season: SeasonIdx): BiomeArt {
  const snowS: SeasonIdx = 3,
    autS: SeasonIdx = 2;
  const taigaTrees = list(
    5,
    (ctx, v) => {
      if (v < 4) drawPine(ctx, 200 + v, snowS);
      else drawBroadleaf(ctx, 230, snowS);
    },
    48,
    64,
    24,
    60,
  );
  const autumnTrees = list(5, (ctx, v) => drawBroadleaf(ctx, 300 + v * 23, autS), 48, 64, 24, 60);
  const forestTrees = list(
    6,
    (ctx, v) => {
      if (v % 3 === 2) drawPine(ctx, 400 + v, season);
      else drawBroadleaf(ctx, 410 + v * 19, season);
    },
    48,
    64,
    24,
    60,
  );
  return {
    forest: { tree: forestTrees, flowers: mushroomsOf([C.e1, C.r2, C.r3, C.r4], C.pale, C.white, 50) },
    autumn: {
      tree: autumnTrees,
      tallgrass: buildTallGrass(autS),
      flowers: buildFlowers(autS),
      stump: buildStump(autS),
    },
    taiga: {
      tree: taigaTrees,
      rock: buildRocks(snowS),
      tallgrass: buildTallGrass(snowS),
      flowers: buildFlowers(snowS),
      stump: buildStump(snowS),
    },
    swamp: {
      tree: list(4, (ctx, v) => (v < 2 ? drawWillow(ctx, 500 + v) : drawSnag(ctx, 520 + v, BARK_DARK, C.r6))),
      tallgrass: bladesOf([C.g0, C.g1, C.g2, C.g3, C.e3], 60, { tall: 16, heads: C.e1 }),
      flowers: mushroomsOf([C.e2, C.e3, C.e4, C.e5], C.fog, C.e7, 70),
    },
    desert: {
      tree: list(3, (ctx, v) => drawCactus(ctx, 600 + v, v < 2)),
      rock: rocksOf(SANDSTONE, false),
      tallgrass: bladesOf([C.e2, C.e3, C.e4, C.e5, C.e6], 80, { tall: 9 }),
    },
    enchanted: {
      tree: list(4, (ctx, v) => drawGladeTree(ctx, 700 + v * 11)),
      tallgrass: bladesOf([C.g1, C.w1, C.w2, C.w3, C.w5], 90, { tall: 12, glow: C.q7 }),
      flowers: mushroomsOf([C.w2, C.w3, C.w5, C.q7], C.pale, C.white, 95),
    },
    corrupted: {
      tree: list(3, (ctx, v) => drawVoidTree(ctx, 800 + v * 13)),
      rock: rocksOf(OBSIDIAN, true),
      tallgrass: bladesOf([C.ink, C.night, C.q0, C.slate, C.steel], 99, { tall: 10, glow: C.q5 }),
      flowers: mushroomsOf([C.q0, C.q1, C.q2, C.q3], C.slate, C.q6, 105),
    },
  };
}

export function destroyBiomeArt(a: BiomeArt): void {
  for (const kinds of Object.values(a))
    for (const l of Object.values(kinds ?? {})) for (const s of l ?? []) s.tex.destroy(true);
}
