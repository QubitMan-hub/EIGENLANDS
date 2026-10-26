/**
 * Bridge railings, native 2:1 iso: square posts with a top rail and a mid rail along one edge of a deck tile, and a
 * taller lantern post where the deck meets land. One sprite per side (and per end), anchored at the tile centre.
 */
import { Texture } from 'pixi.js';
import { Iso, DARKWOOD, WOODM, mat } from './isokit';
import { C, makeCanvas, outline, undithered } from './shade';

const W = 40,
  H = 48,
  AX = 20,
  AY = 36; // the tile centre (u = v = 8) lands here

function railCanvas(side: 0 | 1 | 2 | 3, end: boolean): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(W, H);
  undithered(() => {
    const iso = new Iso(ctx, AX, AY - 8);
    const post = mat(DARKWOOD),
      rail = mat(WOODM);
    // the edge runs along u for sides 0/2 (at v = 0.4 or 15.6), along v for sides 1/3
    const alongU = side === 0 || side === 2;
    const e = side === 0 || side === 3 ? 0.3 : 14.9;
    const box = (a: number, z: number, da: number, dz: number, w = 0.8, m = rail) =>
      alongU ? iso.box(a, e, z, da, w, dz, m) : iso.box(e, a, z, w, da, dz, m);
    for (const a of [0.4, 7.6, 14.8]) box(a, 0, 1.2, 7, 1.1, post);
    box(0, 6.4, 16, 1);
    box(0, 3.4, 16, 0.8);
    if (end) {
      const a = 7.6;
      box(a - 0.2, 0, 1.6, 12, 1.4, post);
      box(a - 0.6, 12, 2.4, 0.6, 2, post);
      box(a - 0.2, 12.6, 1.6, 2.4, 1.4, mat([C.e2, C.e4, C.e6, C.e7, C.white]));
    }
    outline(ctx, W, H, C.night);
  });
  return canvas;
}

const cache = new Map<string, { tex: Texture; ax: number; ay: number }>();
export function railSprite(side: 0 | 1 | 2 | 3, end: boolean): { tex: Texture; ax: number; ay: number } {
  const key = `${side}:${end ? 1 : 0}`;
  let s = cache.get(key);
  if (!s) {
    const tex = Texture.from(railCanvas(side, end));
    tex.source.scaleMode = 'nearest';
    s = { tex, ax: AX, ay: AY };
    cache.set(key, s);
  }
  return s;
}
