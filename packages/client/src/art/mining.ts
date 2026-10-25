import { Texture } from 'pixi.js';
import { Iso, mat, IRONM, WOODM } from './isokit';
import { C, makeCanvas, polish, undithered } from './shade';
import type { ObjSprite } from './objects';
const rails = new Map<number, ObjSprite>(),
  carts = new Map<number, ObjSprite>();
/** Native u/v geometry: connected ends reach exactly to the neighbouring diamond. */
export function railSprite(mask: number): ObjSprite {
  const old = rails.get(mask);
  if (old) return old;
  const { canvas, ctx } = makeCanvas(36, 24),
    ax = 18,
    ay = 16;
  undithered(() => {
    const p = new Iso(ctx, ax, ay - 8),
      wood = mat(WOODM);
    const horizontal = (mask & 5) !== 0,
      vertical = (mask & 10) !== 0;
    if (horizontal) for (const u of vertical ? [mask & 1 ? 14 : 2] : [2, 8, 14]) p.box(u, 3, 0, 1.7, 10, 0.6, wood);
    if (vertical) for (const v of horizontal ? [mask & 2 ? 14 : 2] : [2, 8, 14]) p.box(3, v, 0, 10, 1.7, 0.6, wood);
    const line = (u0: number, v0: number, u1: number, v1: number) => {
      p.line3(u0, v0, 0.9, u1, v1, 0.9, C.slate);
      p.line3(u0, v0, 1.4, u1, v1, 1.4, C.mist);
    };
    if (mask === 5) {
      for (const v of [5, 11]) line(0, v, 16, v);
    } else if (mask === 10) {
      for (const u of [5, 11]) line(u, 0, u, 16);
    } else {
      // Corners have two continuous parallel L-shaped rails, with no centre dead end.
      const east = !!(mask & 1),
        south = !!(mask & 2),
        west = !!(mask & 4),
        north = !!(mask & 8);
      for (const k of [5, 11]) {
        if (east) line(k, k, 16, k);
        if (west) line(k, k, 0, k);
        if (south) line(k, k, k, 16);
        if (north) line(k, k, k, 0);
      }
    }
  });
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  const sprite = { tex, ax, ay };
  rails.set(mask, sprite);
  return sprite;
}
export function minecartSprite(axis = 0, station = false): ObjSprite {
  const key = axis + (station ? 2 : 0),
    old = carts.get(key);
  if (old) return old;
  const { canvas, ctx } = makeCanvas(44, 40),
    ax = 22,
    ay = 30;
  undithered(() => {
    const p = new Iso(ctx, ax, ay - 8),
      iron = mat(IRONM, { grain: 4 }),
      wood = mat(WOODM);
    const box = (u: number, v: number, z: number, du: number, dv: number, dz: number, m: ReturnType<typeof mat>) =>
      axis ? p.box(v, u, z, dv, du, dz, m) : p.box(u, v, z, du, dv, dz, m);
    if (station) {
      for (const k of [5, 11]) {
        p.line3(k, k, 0.8, 16, k, 0.8, C.mist);
        p.line3(k, k, 0.8, k, 16, 0.8, C.mist);
      }
    }
    // Wheel pairs, recessed bed, sloped-looking stepped iron body and reinforced rim.
    for (const u of [3, 12]) for (const v of [2, 12]) box(u, v, 0, 2.5, 2, 4, iron);
    box(1, 2, 4, 14, 12, 1.5, wood);
    box(1, 2, 5, 14, 1.5, 7, iron);
    box(1, 12.5, 5, 14, 1.5, 7, iron);
    box(1, 3.5, 5, 1.5, 9, 7, iron);
    box(13.5, 3.5, 5, 1.5, 9, 7, iron);
    box(0.5, 1.5, 12, 15, 2, 1, wood);
    box(0.5, 12, 12, 15, 2, 1, wood);
    box(0.5, 3.5, 12, 2, 8.5, 1, wood);
    box(13.5, 3.5, 12, 2, 8.5, 1, wood);
    p.dot(11, 14.1, 8, C.e5);
    p.dot(4, 14.1, 8, C.mist);
    polish(ctx, 44, 40, { rim: false, ao: { ax, ay, rx: 12 } });
  });
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  const sprite = { tex, ax, ay };
  carts.set(key, sprite);
  return sprite;
}
