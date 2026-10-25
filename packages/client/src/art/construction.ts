/** Original modular architecture. All faces are rebuilt in model space, never rotated sprites. */
import { Texture } from 'pixi.js';
import { type BuildPiece, BUILD_PIECES } from '@eigenlands/shared';
import { C, makeCanvas, put, type Ctx } from './shade';
import { Iso, mat, WOODM, STONEM, type Paint } from './isokit';

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
  if (layer === 'floor') {
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
  } else if (layer === 'wall') {
    const h = cut ? 6 : 36,
      door = id === 'timber_door',
      along = axis === 0;
    const panel = (a: number, b: number, z: number, w: number, d: number, hh: number, m = wood) =>
      along ? iso.box(a, b, z, w, d, hh, m) : iso.box(b, a, z, d, w, hh, m);
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
      const m =
        id === 'stone_wall'
          ? stone
          : {
              top: C.e4,
              left: ((s, t) =>
                s < 0.13 || s > 0.87 || t < 0.09 || t > 0.93 || Math.abs(s - t) < 0.045 ? C.e1 : C.e6) as Paint,
              right: ((s, t) => (s < 0.13 || s > 0.87 || t < 0.09 || t > 0.93 ? C.e0 : C.e4)) as Paint,
            };
      panel(0, 6, 0, 16, 4, h, m);
      if (id === 'stone_wall' && !cut)
        for (let z = 6; z < h; z += 7) {
          along ? iso.line3(0, 10, z, 16, 10, z, C.slate) : iso.line3(10, 0, z, 10, 16, z, C.night);
          for (let s = z % 14 === 6 ? 3 : 7; s < 16; s += 8)
            along ? iso.line3(s, 10, z, s, 10, z + 6, C.steel) : iso.line3(10, s, z, 10, s, z + 6, C.slate);
        }
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
    const m = wood;
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
    const thatch = id === 'thatch_roof',
      ramp = thatch ? [C.e1, C.e2, C.e3, C.e4, C.e5] : [C.night, C.slate, C.w1, C.steel, C.mist];
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
    stone = piece.material === 'stone' || piece.material === 'slate',
    m = mat(stone ? STONEM : WOODM),
    iso = new Iso(c, 8, 5);
  if (piece.layer === 'floor') {
    iso.box(0, 0, 0, 6, 6, 2, m);
    iso.line3(0, 3, 2, 6, 3, 2, C.e1);
  } else if (piece.layer === 'roof') {
    iso.para(3, 8, 6, -5, 5, 3, stone ? C.steel : C.e4);
    iso.para(9, 3, 4, 5, -5, 3, stone ? C.w1 : C.e2);
    put(c, 6, 7, stone ? C.fog : C.e6, 2, 1);
  } else if (piece.layer === 'stairs') {
    const stairs = new Iso(c, 8, 7);
    for (let i = 2; i >= 0; i--) stairs.box(i * 2, 0, 0, 2, 6, 2 * (3 - i), m);
  } else if (id === 'timber_door') {
    put(c, 4, 2, C.e1, 8, 12);
    put(c, 5, 3, C.e4, 6, 10);
    put(c, 5, 5, C.slate, 6, 1);
    put(c, 5, 10, C.slate, 6, 1);
    put(c, 9, 8, C.e6);
  } else {
    const wall = new Iso(c, 8, 9);
    wall.box(0, 0, 0, 6, 3, 7, m);
    if (!stone) {
      put(c, 5, 5, C.e1, 1, 5);
      put(c, 10, 7, C.e1, 1, 5);
    } else {
      put(c, 4, 6, C.slate, 5, 1);
      put(c, 8, 9, C.night, 4, 1);
    }
  }
}
