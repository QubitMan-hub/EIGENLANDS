/** Original modular architecture. All faces are rebuilt in model space, never rotated sprites. */
import { Texture } from 'pixi.js';
import { type BuildPiece, BUILD_PIECES, isDoor } from '@eigenlands/shared';
import { C, makeCanvas, put, type Ctx } from './shade';
import { Iso, mat, WOODM, STONEM, type Paint } from './isokit';
import type { Ramp } from './shade';

/** The catalog's building materials: a ramp (dark to light) and how the surface is laid. */
type Pattern =
  | 'brick'
  | 'ashlar'
  | 'plaster'
  | 'log'
  | 'tile'
  | 'veined'
  | 'parquet'
  | 'speckle'
  | 'glass'
  | 'plate'
  | 'reed'
  | 'copper';
interface Look {
  ramp: Ramp;
  pattern: Pattern;
  /** the line between courses / planks */
  seam: number;
}
const LOOK: Record<string, Look> = {
  moss: { ramp: [C.g0, C.g1, C.g2, C.g3, C.g4, C.g5], pattern: 'reed', seam: C.g1 },
  oak: { ramp: [C.e1, C.e2, C.e3, C.e4, C.e5, C.e6], pattern: 'parquet', seam: C.e1 },
  brick: { ramp: [C.r0, C.r1, C.r2, C.r3, C.r4, C.r5], pattern: 'brick', seam: C.fog },
  tile: { ramp: [C.r1, C.r2, C.r3, C.r4, C.r5, C.e6], pattern: 'tile', seam: C.r1 },
  marble: { ramp: [C.mist, C.fog, C.pale, C.white, C.white, C.white], pattern: 'veined', seam: C.fog },
  sandstone: { ramp: [C.e2, C.e3, C.e4, C.e5, C.e6, C.e7], pattern: 'ashlar', seam: C.e3 },
  granite: { ramp: [C.night, C.slate, C.steel, C.mist, C.fog, C.pale], pattern: 'speckle', seam: C.night },
  plaster: { ramp: [C.steel, C.mist, C.fog, C.pale, C.white, C.white], pattern: 'plaster', seam: C.e3 },
  log: { ramp: [C.e0, C.e1, C.e2, C.e3, C.e4, C.e5], pattern: 'log', seam: C.e0 },
  glass: { ramp: [C.e1, C.e2, C.e3, C.w4, C.w5, C.w6], pattern: 'glass', seam: C.e2 },
  iron: { ramp: [C.ink, C.night, C.slate, C.steel, C.mist, C.fog], pattern: 'plate', seam: C.night },
  copper: { ramp: [C.g1, C.g2, C.g3, C.w3, C.w4, C.w5], pattern: 'copper', seam: C.g1 },
};
const h2 = (a: number, b: number): number => (((a * 73) ^ (b * 151)) & 255) / 255;
/** Colour of a vertical or top face of a material at (s, t) in 0..1 across a face `w` px wide and `h` px tall. */
function surface(look: Look, s: number, t: number, w: number, h: number, shade: number): number {
  const r = look.ramp,
    at = (i: number): number => r[Math.max(0, Math.min(r.length - 1, i + shade))]!;
  const px = Math.floor(s * w),
    py = Math.floor(t * h);
  switch (look.pattern) {
    case 'brick': {
      const row = Math.floor(py / 4);
      if (py % 4 === 0 || (px + (row % 2) * 4) % 8 === 0) return look.seam;
      return at(2 + (h2(Math.floor((px + (row % 2) * 4) / 8), row) < 0.35 ? -1 : h2(row, px >> 3) > 0.7 ? 1 : 0));
    }
    case 'ashlar': {
      const row = Math.floor(py / 6);
      if (py % 6 === 0 || (px + (row % 2) * 5) % 10 === 0) return look.seam;
      return at(2 + (h2(px >> 2, row) < 0.25 ? -1 : 0));
    }
    case 'tile': {
      const cx = Math.floor(px / 4),
        cy = Math.floor(py / 4);
      return px % 4 === 0 || py % 4 === 0 ? look.seam : at(2 + ((cx + cy) % 2));
    }
    case 'veined':
      return (px + py * 2) % 11 === 0 && h2(px, py) > 0.4
        ? r[1]!
        : (Math.floor(px / 8) + Math.floor(py / 8)) % 2
          ? at(3)
          : at(2);
    case 'speckle':
      return h2(px, py) < 0.12 ? at(4) : h2(py, px) < 0.1 ? at(0) : at(2);
    case 'plaster':
      return py % 12 === 0 || px === 0 || px === w - 1 ? look.seam : h2(px, py) < 0.06 ? at(1) : at(3);
    case 'log':
      return py % 4 === 0 ? look.seam : py % 4 === 1 ? at(4) : at(3 + (h2(px >> 3, py >> 2) < 0.3 ? -1 : 0));
    case 'parquet':
      return px % 4 === 0 || (py + (Math.floor(px / 4) % 2) * 2) % 8 === 0
        ? look.seam
        : at(2 + (h2(Math.floor(px / 4), Math.floor(py / 8)) < 0.5 ? 1 : 0));
    case 'glass':
      return px < 2 || px > w - 3 || py < 2 || py > h - 3 || px === w >> 1 || py === h >> 1
        ? look.seam
        : (px + py) % 9 === 0
          ? r[5]!
          : at(2);
    case 'plate':
      return py % 8 === 0 || px % 8 === 0 ? look.seam : h2(px >> 1, py >> 1) < 0.05 ? r[5]! : at(2);
    case 'reed':
      return px % 2 === 0 ? at(2) : at(3);
    case 'copper':
      return py % 6 === 0 ? look.seam : (px + Math.floor(py / 6) * 3) % 6 === 0 ? at(1) : at(h2(px, py) < 0.2 ? 3 : 2);
  }
}
const lookMat = (look: Look): { top: Paint; left: Paint; right: Paint } => ({
  top: (s, t) => surface(look, s, t, 16, 16, 1),
  left: (s, t) => surface(look, s, 1 - t, 16, 36, 1),
  right: (s, t) => surface(look, s, 1 - t, 16, 36, -1),
});

const cache = new Map<string, Texture>();
export const BUILD_AX = 24,
  BUILD_AY = 80;
export function constructionCanvas(
  id: BuildPiece,
  turn = 0,
  cut = false,
  open = false,
  profile: [number, number, number] = [0, 4, 8],
): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(48, 96),
    iso = new Iso(ctx, BUILD_AX, BUILD_AY - 8),
    layer = BUILD_PIECES[id].layer;
  const wood = mat(WOODM),
    stone = mat(STONEM),
    axis = turn % 2;
  const look = LOOK[BUILD_PIECES[id].material];
  if (layer === 'floor' && look) {
    const m = lookMat(look);
    iso.box(0, 0, -1, 16, 16, 1, { top: m.top, left: m.left, right: m.right });
    iso.top(0, 0, 0, 16, 16, (s, t) => surface(look, s, t, 16, 16, 1));
  } else if (layer === 'floor') {
    iso.box(0, 0, -1, 16, 16, 1, id === 'stone_floor' ? stone : wood);
    iso.top(0, 0, 0, 16, 16, (s, t) => {
      if (id === 'stone_floor') {
        const row = Math.floor(t * 4),
          x = (s * 16 + (row % 2) * 4) % 8;
        return (t * 16) % 4 < 0.7 || x < 0.7 ? C.slate : (row + Math.floor(s * 2)) % 3 === 0 ? C.fog : C.mist;
      }
      return (t * 16) % 4 < 0.7
        ? C.e1
        : s < 0.06 || s > 0.94
          ? C.e2
          : Math.floor(s * 11 + t * 5) % 13 === 0
            ? C.e4
            : C.e3;
    });
    if (id === 'irrigation_channel') {
      iso.top(2, 2, 0.1, 12, 12, C.w2);
      iso.box(0, 0, 0, 16, 2, 2, stone);
      iso.box(0, 14, 0, 16, 2, 2, stone);
      iso.line3(3, 7, 0.2, 9, 7, 0.2, C.w4);
    }
  } else if (layer === 'wall') {
    const h = cut ? 6 : 36,
      door = isDoor(id),
      along = axis === 0;
    const dm = look ? lookMat(look) : wood;
    const panel = (
      a: number,
      b: number,
      z: number,
      w: number,
      d: number,
      hh: number,
      m: ReturnType<typeof mat> = dm,
    ) => (along ? iso.box(a, b, z, w, d, hh, m) : iso.box(b, a, z, d, w, hh, m));
    if (door) {
      panel(0, 6, 0, 3, 4, h);
      panel(13, 6, 0, 3, 4, h);
      if (!cut) {
        panel(3, 6, 31, 10, 4, 5);
        if (open) {
          along ? iso.box(2, 7, 0, 2, 10, 30, wood) : iso.box(7, 2, 0, 10, 2, 30, wood);
        } else {
          panel(3, 7, 0, 10, 2, 31);
          for (const z of [6, 25]) panel(3, 6.8, z, 10, 2.4, 2, stone);
          if (along) iso.dot(11, 10, 16, C.e6, 2, 2);
          else iso.dot(10, 11, 16, C.e6, 2, 2);
        }
      }
    } else {
      const m: ReturnType<typeof mat> = look
        ? lookMat(look)
        : id === 'stone_wall' || id === 'stone_window'
          ? stone
          : {
              top: C.e4,
              left: ((s, t) =>
                s < 0.13 || s > 0.87 || t < 0.09 || t > 0.93 || Math.abs(s - t) < 0.045 ? C.e1 : C.e6) as Paint,
              right: ((s, t) => (s < 0.13 || s > 0.87 || t < 0.09 || t > 0.93 ? C.e0 : C.e4)) as Paint,
            };
      panel(0, 6, 0, 16, 4, h, m);
      if ((id === 'stone_wall' || id === 'stone_window') && !cut)
        for (let z = 6; z < h; z += 7) {
          along ? iso.line3(0, 10, z, 16, 10, z, C.slate) : iso.line3(10, 0, z, 10, 16, z, C.night);
          for (let s = z % 14 === 6 ? 3 : 7; s < 16; s += 8)
            along ? iso.line3(s, 10, z, s, 10, z + 6, C.steel) : iso.line3(10, s, z, 10, s, z + 6, C.slate);
        }
    }
    if (['window_wall', 'timber_window', 'stone_window'].includes(id) && !cut) {
      panel(3, 9.7, 10, 10, 0.8, 17, mat([C.w0, C.w1, C.w2, C.w4, C.w5]));
      panel(2, 9.3, 8, 12, 2, 2, stone);
      panel(7, 9.1, 10, 1.5, 2, 17, wood);
      panel(3, 9.1, 18, 10, 2, 1.5, wood);
      panel(2, 9.1, 27, 12, 2, 1.5, wood);
    }
  } else if (layer === 'stairs') {
    if (open) {
      iso.top(1, 1, 0, 14, 14, C.night);
      for (let i = 3; i >= 0; i--)
        axis === 0
          ? iso.box(2 + i * 3, 2, -i * 2 - 1, 3, 12, 1, wood)
          : iso.box(2, 2 + i * 3, -i * 2 - 1, 12, 3, 1, wood);
      iso.line3(1, 1, 7, 15, 1, 7, C.e4);
      return canvas;
    }
    const m = look ? lookMat(look) : wood;
    for (let i = 7; i >= 0; i--) {
      const a = turn < 2 ? i * 2 : 14 - i * 2,
        h = (8 - i) * 3;
      axis === 0 ? iso.box(a, 2, 0, 2, 12, h, m) : iso.box(2, a, 0, 12, 2, h, m);
    }
    const sign = turn < 2 ? 1 : -1;
    axis === 0
      ? iso.line3(sign > 0 ? 0 : 16, 2, 29, sign > 0 ? 16 : 0, 2, 5, C.e5)
      : iso.line3(2, sign > 0 ? 0 : 16, 29, 2, sign > 0 ? 16 : 0, 5, C.e5);
  } else {
    const thatch = BUILD_PIECES[id].material === 'thatch',
      ramp =
        id === 'tile_roof'
          ? [C.r0, C.r1, C.r2, C.r3, C.r4]
          : look
            ? look.ramp.slice(0, 5)
            : thatch
              ? [C.e1, C.e2, C.e3, C.e4, C.e5]
              : [C.night, C.slate, C.w1, C.steel, C.mist];
    const paint: Paint = (s, t) => {
      const row = Math.floor(t * 24),
        seam = (s * 16 + (Math.floor(row / 4) % 2) * 3) % 6;
      return row % 4 === 0 ? ramp[1]! : seam < 0.65 ? ramp[2]! : ramp[3]!;
    };
    for (let half = 0; half < 2; half++) {
      const a = half * 8,
        z0 = 36 + profile[half]!,
        z1 = 36 + profile[half + 1]!;
      if (axis === 0) {
        for (let u = 0; u < 8; u++)
          iso.left(a + u, 16, 35, 1, Math.max(1, z0 + ((z1 - z0) * u) / 8 - 35), thatch ? C.e2 : C.e3);
        iso.para(iso.X(a, 0), iso.Y(a, 0, z0), 8, 4 - (z1 - z0), -16, 8, paint);
        iso.line3(a, 16, z0, a + 8, 16, z1, thatch ? C.e5 : C.fog);
      } else {
        for (let v = 0; v < 8; v++) iso.right(16, a + v, 35, 1, Math.max(1, z0 + ((z1 - z0) * v) / 8 - 35), C.e1);
        iso.para(iso.X(0, a), iso.Y(0, a, z0), 16, 8, -8, 4 - (z1 - z0), paint);
        iso.line3(16, a, z0, 16, a + 8, z1, thatch ? C.e4 : C.steel);
      }
    }
  }
  return canvas;
}
export function constructionTexture(
  id: BuildPiece,
  turn = 0,
  cut = false,
  open = false,
  profile?: [number, number, number],
): Texture {
  const key = `${id}:${turn}:${cut}:${open}:${profile ?? ''}`;
  let t = cache.get(key);
  if (!t) {
    t = Texture.from(constructionCanvas(id, turn, cut, open, profile));
    t.source.scaleMode = 'nearest';
    cache.set(key, t);
  }
  return t;
}
/** Distinct native 16px inventory silhouettes, kept inside the outline budget. */
export function constructionIcon(c: Ctx, id: BuildPiece): void {
  const piece = BUILD_PIECES[id],
    lk = LOOK[piece.material],
    stone = piece.material === 'stone' || piece.material === 'slate',
    m = lk ? lookMat(lk) : mat(stone ? STONEM : WOODM),
    iso = new Iso(c, 8, 5);
  if (piece.layer === 'floor') {
    iso.box(0, 0, 0, 6, 6, 2, m);
    iso.line3(0, 3, 2, 6, 3, 2, C.e1);
    if (id === 'irrigation_channel') iso.top(1, 1, 2.1, 4, 4, C.w3);
  } else if (piece.layer === 'roof') {
    iso.para(3, 8, 6, -5, 5, 3, lk ? lk.ramp[3]! : stone ? C.steel : C.e4);
    iso.para(9, 3, 4, 5, -5, 3, lk ? lk.ramp[1]! : stone ? C.w1 : C.e2);
    put(c, 6, 7, lk ? lk.ramp[4]! : stone ? C.fog : C.e6, 2, 1);
  } else if (piece.layer === 'stairs') {
    const stairs = new Iso(c, 8, 7);
    for (let i = 2; i >= 0; i--) stairs.box(i * 2, 0, 0, 2, 6, 2 * (3 - i), m);
  } else if (isDoor(id)) {
    put(c, 4, 2, lk ? lk.ramp[0]! : C.e1, 8, 12);
    put(c, 5, 3, lk ? lk.ramp[3]! : C.e4, 6, 10);
    put(c, 5, 5, C.slate, 6, 1);
    put(c, 5, 10, C.slate, 6, 1);
    put(c, 9, 8, C.e6);
  } else {
    const wall = new Iso(c, 8, 9);
    wall.box(0, 0, 0, 6, 3, 7, m);
    if (['window_wall', 'timber_window', 'stone_window'].includes(id)) {
      wall.left(1.5, 3, 2, 3, 4, C.w3);
      wall.line3(3, 3, 2, 3, 3, 6, C.e3);
    }
    if (lk) {
      put(c, 3, 6, lk.seam, 5, 1);
      put(c, 8, 9, lk.seam, 4, 1);
    } else if (!stone) {
      put(c, 5, 5, C.e1, 1, 5);
      put(c, 10, 7, C.e1, 1, 5);
    } else {
      put(c, 4, 6, C.slate, 5, 1);
      put(c, 8, 9, C.night, 4, 1);
    }
  }
}
