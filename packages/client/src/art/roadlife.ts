/**
 * Small props carried by road travellers and wild workers, in native 2:1 iso: a two-wheeled handcart piled with
 * sacks, a fisher's stool with a creel, and a lantern glow for those who travel after dark.
 */
import { Texture } from 'pixi.js';
import { C } from './shade';
import { DARKWOOD, WOODM, type Facing } from './isokit';
import { iso } from './props';
import type { ObjSprite } from './objects';
import { makeCanvas, put } from './shade';

const cache = new Map<string, ObjSprite>();
const once = (k: string, mk: () => ObjSprite): ObjSprite => {
  let s = cache.get(k);
  if (!s) cache.set(k, (s = mk()));
  return s;
};

/** `face` 'sw' rolls along x, 'se' along y. */
export function handcartSprite(face: Facing, wheel: number): ObjSprite {
  return once(`cart:${face}:${wheel}`, () =>
    iso(
      48,
      40,
      face,
      (p) => {
        const spoke = (s: number, t: number) => {
          const dx = (s - 0.5) * 2,
            dy = (t - 0.5) * 2,
            r = Math.hypot(dx, dy);
          if (r > 1) return -1;
          if (r > 0.72) return C.e1;
          const a = Math.atan2(dy, dx) + (wheel * Math.PI) / 4;
          return Math.abs(Math.sin(a * 2)) < 0.3 ? C.e2 : -1;
        };
        p.box(2, 1.5, 0, 6, 0.8, 6, { ramp: DARKWOOD, front: spoke, end: () => -1, top: () => -1 });
        p.box(-2, 2.5, 3.5, 12, 6, 1.2, { ramp: WOODM });
        p.box(-2, 2.5, 4.7, 12, 0.8, 2.4, { ramp: WOODM });
        p.box(-2, 7.7, 4.7, 12, 0.8, 2.4, { ramp: WOODM });
        // sacks
        p.box(0, 3.3, 4.7, 4, 4.4, 3.6, { ramp: [C.e3, C.e4, C.e5, C.e6] });
        p.box(4.2, 3.6, 4.7, 4, 4, 3, { ramp: [C.e2, C.e3, C.e4, C.e5] });
        // the shafts the carter holds
        p.box(10, 3, 4, 6, 0.6, 0.6, { ramp: WOODM });
        p.box(10, 7.4, 4, 6, 0.6, 0.6, { ramp: WOODM });
        p.box(2, 8.7, 0, 6, 0.8, 6, { ramp: DARKWOOD, front: spoke, end: () => -1, top: () => -1 });
      },
      { margin: 8 },
    ),
  );
}

export function stoolSprite(face: Facing): ObjSprite {
  return once(`stool:${face}`, () =>
    iso(
      28,
      24,
      face,
      (p) => {
        p.box(3, 3, 0, 1, 1, 3, { ramp: DARKWOOD });
        p.box(6, 3, 0, 1, 1, 3, { ramp: DARKWOOD });
        p.box(3, 6, 0, 1, 1, 3, { ramp: DARKWOOD });
        p.box(2.5, 2.5, 3, 5, 5, 1, { ramp: WOODM });
        p.box(9, 2, 0, 4, 4, 3.5, { ramp: [C.e3, C.e4, C.e5, C.e6], top: () => C.e1 }); // the creel
      },
      { margin: 6 },
    ),
  );
}

let glowTex: Texture | null = null;
/** a soft lantern glow (additive-looking warm dot) */
export function lanternGlow(): Texture {
  if (glowTex) return glowTex;
  const { canvas, ctx } = makeCanvas(9, 9);
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 9; x++) {
      const r = Math.hypot(x - 4, y - 4);
      if (r < 1.2) put(ctx, x, y, C.white);
      else if (r < 2.4) put(ctx, x, y, C.e7);
      else if (r < 3.6 && (x + y) % 2 === 0) put(ctx, x, y, C.e6);
    }
  glowTex = Texture.from(canvas);
  glowTex.source.scaleMode = 'nearest';
  return glowTex;
}
