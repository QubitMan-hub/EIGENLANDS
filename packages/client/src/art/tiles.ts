import { Rectangle, Texture } from 'pixi.js';
import { T, TILE_DEFS, TILE_SIZE } from '@eigenlands/shared';
import { C, makeCanvas, mulberry32, px, speckle, type Ctx } from './draw';

const VARIANTS = 4;
const FRAMES = 2;
const COLS = 16;

function grass(ctx: Ctx, r: () => number, tall = false): void {
  px(ctx, 0, 0, C.g4, 16, 16);
  speckle(ctx, r, 14, C.g3);
  speckle(ctx, r, 10, C.g5);
  speckle(ctx, r, 3, C.g6);
  if (tall) {
    for (let i = 0; i < 7; i++) {
      const x = 1 + Math.floor(r() * 14), y = 5 + Math.floor(r() * 9);
      px(ctx, x, y, C.g2, 1, 3);
      px(ctx, x, y - 1, C.g6, 1, 1);
      px(ctx, x + 1, y + 1, C.g3, 1, 2);
    }
  }
}

function drawTile(ctx: Ctx, id: number, variant: number, frame: number): void {
  const r = mulberry32(id * 977 + variant * 131 + 7);
  switch (id) {
    case T.GRASS: grass(ctx, r); break;
    case T.GRASS_TALL: grass(ctx, r, true); break;
    case T.FLOWERS: {
      grass(ctx, r);
      const petals = [C.r5, C.e6, C.q4, C.w6];
      for (let i = 0; i < 4; i++) {
        const x = 2 + Math.floor(r() * 11), y = 2 + Math.floor(r() * 11);
        const c = petals[(variant + i) % petals.length]!;
        px(ctx, x, y, c); px(ctx, x - 1, y, c); px(ctx, x + 1, y, c); px(ctx, x, y - 1, c); px(ctx, x, y + 1, c);
        px(ctx, x, y, C.e7);
      }
      break;
    }
    case T.SAND:
      px(ctx, 0, 0, C.e6, 16, 16);
      speckle(ctx, r, 18, C.e5); speckle(ctx, r, 8, C.e7); speckle(ctx, r, 3, C.e4);
      break;
    case T.WATER:
    case T.DEEP_WATER: {
      const deep = id === T.DEEP_WATER;
      px(ctx, 0, 0, deep ? C.w2 : C.w3, 16, 16);
      speckle(ctx, r, 10, deep ? C.w1 : C.w2);
      for (let i = 0; i < 3; i++) {
        const y = 2 + i * 5 + (frame ? 1 : 0), x = (i * 5 + variant * 3 + (frame ? 3 : 0)) % 12;
        px(ctx, x, y, deep ? C.w3 : C.w5, 4, 1);
        px(ctx, x + 1, y - 1, deep ? C.w2 : C.w4, 2, 1);
      }
      break;
    }
    case T.TREE: {
      grass(ctx, r);
      px(ctx, 7, 10, C.e2, 2, 5); px(ctx, 7, 12, C.e1, 1, 3); // trunk
      px(ctx, 4, 13, C.g1, 8, 2); // roots shadow
      const cx = 8, cy = 6;
      for (let y = -5; y <= 5; y++) for (let x = -6; x <= 6; x++) {
        const d = (x * x) / 36 + (y * y) / 25;
        if (d < 1) {
          const shade = x + y < -2 ? C.g6 : x + y > 2 ? C.g2 : C.g4;
          px(ctx, cx + x, cy + y, d > 0.8 ? C.g1 : shade);
        }
      }
      speckle(ctx, r, 5, C.g7, 4, 2, 8, 6);
      break;
    }
    case T.ROCK: {
      grass(ctx, r);
      for (let y = 0; y < 9; y++) for (let x = 0; x < 12; x++) {
        const d = ((x - 5.5) ** 2) / 36 + ((y - 4) ** 2) / 20;
        if (d < 1) px(ctx, 2 + x, 5 + y, d > 0.75 ? C.slate : (x + y < 8 ? C.fog : C.mist));
      }
      px(ctx, 5, 6, C.pale, 3, 1); px(ctx, 4, 7, C.pale, 1, 1);
      px(ctx, 3, 13, C.g1, 10, 1);
      break;
    }
    case T.SHIMMER: {
      grass(ctx, r);
      for (let i = 0; i < 5; i++) {
        const x = 1 + Math.floor(r() * 13), y = 1 + Math.floor(r() * 13);
        const on = (i + frame) % 2 === 0;
        px(ctx, x, y, on ? C.q7 : C.q3);
        if (on) { px(ctx, x - 1, y, C.q5); px(ctx, x + 1, y, C.q5); px(ctx, x, y - 1, C.q5); px(ctx, x, y + 1, C.q5); }
      }
      break;
    }
    case T.PATH:
      px(ctx, 0, 0, C.e4, 16, 16);
      for (let i = 0; i < 6; i++) {
        const x = Math.floor(r() * 12), y = Math.floor(r() * 12);
        px(ctx, x, y, C.e5, 4, 3); px(ctx, x, y + 3, C.e3, 4, 1);
      }
      speckle(ctx, r, 8, C.e6);
      break;
    case T.STUMP:
      grass(ctx, r);
      px(ctx, 5, 8, C.e3, 6, 5); px(ctx, 5, 8, C.e5, 6, 2); px(ctx, 6, 9, C.e6, 4, 1); px(ctx, 5, 13, C.e1, 6, 1);
      break;
    case T.TORCH: {
      px(ctx, 0, 0, C.e4, 16, 16);
      speckle(ctx, r, 10, C.e5);
      px(ctx, 7, 7, C.e2, 2, 8); px(ctx, 6, 14, C.e1, 4, 1); px(ctx, 6, 6, C.e3, 4, 2); // pole + brazier
      const f = frame ? 1 : 0;
      px(ctx, 5, 2 - f, C.e4, 6, 5);        // outer flame
      px(ctx, 6, 1 - f, C.e5, 4, 5);
      px(ctx, 7, 0, C.e6, 2, 5 - f);
      px(ctx, 7, 3, C.e7, 2, 3);            // hot core
      px(ctx, 5 + f * 5, 3, C.e5, 1, 2);
      break;
    }
    default:
      px(ctx, 0, 0, C.r5, 16, 16);
  }
}

export interface TileAtlas {
  tex(id: number, variant: number, frame: number): Texture;
  variantOf(x: number, y: number): number;
}

export function buildTileAtlas(): TileAtlas {
  const cells = TILE_DEFS.length * VARIANTS * FRAMES;
  const rows = Math.ceil(cells / COLS);
  const { canvas, ctx } = makeCanvas(COLS * TILE_SIZE, rows * TILE_SIZE);
  const index = (id: number, v: number, f: number) => (id * VARIANTS + v) * FRAMES + f;
  for (const def of TILE_DEFS) {
    for (let v = 0; v < VARIANTS; v++) {
      for (let f = 0; f < FRAMES; f++) {
        const i = index(def.id, v, f);
        ctx.save();
        ctx.translate((i % COLS) * TILE_SIZE, Math.floor(i / COLS) * TILE_SIZE);
        ctx.beginPath(); ctx.rect(0, 0, 16, 16); ctx.clip();
        drawTile(ctx, def.id, v, def.animated ? f : 0);
        ctx.restore();
      }
    }
  }
  const base = Texture.from(canvas);
  base.source.scaleMode = 'nearest';
  const cache = new Map<number, Texture>();
  return {
    tex(id, v, f) {
      const i = index(id, v, f);
      let t = cache.get(i);
      if (!t) {
        t = new Texture({
          source: base.source,
          frame: new Rectangle((i % COLS) * TILE_SIZE, Math.floor(i / COLS) * TILE_SIZE, TILE_SIZE, TILE_SIZE),
        });
        cache.set(i, t);
      }
      return t;
    },
    variantOf: (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % VARIANTS,
  };
}
