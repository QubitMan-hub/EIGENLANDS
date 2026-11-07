import { Texture } from 'pixi.js';
import { C, makeCanvas } from './shade';
import { Iso } from './isokit';
import { paintFlora } from './nature';
import { PROPS } from './props';
import type { ObjSprite } from './objects';
import type { ArrivalProp } from '../game/arrival-plan';
/** Small ground details with the same projection and palette as the shrine and settlements. */
export function arrivalArt(kind: ArrivalProp['kind'], variant: number, season: number): ObjSprite {
  if (kind === 'board') return PROPS.sign!('sw').frames[0]!;
  const w = kind === 'stone' ? 36 : 40,
    h = kind === 'stone' ? 28 : 40,
    ax = w / 2,
    ay = kind === 'stone' ? 14 : 34;
  const { canvas, ctx } = makeCanvas(w, h);
  if (kind === 'flower') {
    const I = new Iso(ctx, ax, ay - 8);
    I.top(3, 3, 0, 10, 10, C.e1);
    for (const [u, v] of [
      [2, 2],
      [12, 2],
      [2, 12],
      [12, 12],
    ])
      I.box(u!, v!, 0, 2, 2, 1, { left: C.steel, right: C.slate, top: C.mist });
    paintFlora(ctx, ['poppy', 'bluebell', 'oxeye_daisy'][variant % 3]!, variant, season);
  } else {
    const I = new Iso(ctx, ax, ay - 8);
    if (kind === 'stone')
      I.top(0, 0, 0, 16, 16, (s, t) => {
        const a = Math.floor(s * 16),
          b = Math.floor(t * 16);
        const row = b < 5 ? 0 : b < 11 ? 1 : 2,
          edge = (a + (row === 1 ? 5 : 0)) % 9;
        if (b === 5 || b === 11 || edge === 0) return C.steel;
        if (edge === 1 && (b + variant) % 6 === 1) return C.fog;
        return C.mist;
      });
    else {
      I.top(2, 2, 0.2, 12, 12, (s, t) => (s < 0.1 || s > 0.9 || t < 0.1 || t > 0.9 ? C.e6 : C.w3));
      I.top(3, 3, 0.3, 10, 10, (s, t) => (Math.floor(s * 8) % 3 === 0 || Math.floor(t * 8) % 3 === 0 ? C.w4 : C.w3));
      I.cyl(6, 7, 0.5, 1.5, 1, [C.e3, C.e4, C.e5, C.e6]);
      I.cyl(10, 9, 0.5, 1, 0.8, [C.r2, C.r3, C.r4]);
    }
  }
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  return { tex, ax, ay };
}
