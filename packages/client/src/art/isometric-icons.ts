/** Small physical items modelled on the same 2:1 plane as the world. No rotated flat glyphs. */
import type { Glyph } from '@eigenlands/shared';
import { Iso, type Paint } from './isokit';
import { C, dk, lt, type Ctx } from './shade';
class IconIso extends Iso {
  override para(ax: number, ay: number, ex: number, ey: number, fx: number, fy: number, paint: Paint): void {
    super.para(8 + (ax - 8) * 0.75, 8 + (ay - 8) * 0.75, ex * 0.75, ey * 0.75, fx * 0.75, fy * 0.75, paint);
  }
}
type Draw = (ctx: Ctx, a: number, b: number) => void;
const tool =
  (kind: string): Draw =>
  (ctx, a, b) => {
    const I = new IconIso(ctx, 8, 1);
    const box = (u: number, v: number, z: number, du: number, dv: number, dz: number, c: number) =>
      I.box(u, v, z, du, dv, dz, { top: lt(c), left: c, right: dk(c) });
    if (kind === 'can') {
      box(5, 5, 0, 6, 5, 5, a);
      box(11, 6, 2, 3, 1, 1, b);
      box(4, 6, 2, 1, 3, 3, b);
      I.top(6, 6, 5.1, 3, 2, C.slate);
      return;
    }
    if (kind === 'shield') {
      const inside = (s: number, t: number) => t < 0.45 || Math.abs(s - 0.5) < (1 - t) * 0.9;
      for (const z of [0, 1, 2]) I.top(4, 4, z, 8, 8, (s, t) => (inside(s, t) ? (z === 2 ? a : dk(a)) : -1));
      I.top(7, 5, 2.1, 1, 5, b);
      return;
    }
    if (['sword', 'greatsword', 'dagger', 'spear'].includes(kind)) {
      const start = kind === 'spear' ? 11 : kind === 'dagger' ? 8 : kind === 'greatsword' ? 4 : 6;
      const length = kind === 'spear' ? 3 : kind === 'dagger' ? 4 : kind === 'greatsword' ? 10 : 7;
      const width = kind === 'greatsword' ? 3 : 2;
      box(kind === 'dagger' ? 5 : 1, 7, 1, start - (kind === 'dagger' ? 5 : 1), 1, 1, C.e4);
      if (kind !== 'spear') box(start - 1, kind === 'greatsword' ? 4 : 5, 1, 1, kind === 'greatsword' ? 7 : 5, 1, C.e5);
      box(start, 7 - width / 2, 1, length, width, 1, a);
      I.top(start, 7 - width / 2, 2.1, length, Math.max(0.8, width / 2), b);
      return;
    }
    box(2, 7, 1, 10, 1, 1, C.e4);
    if (kind === 'pickaxe') {
      box(10, 4, 1, 2, 7, 1, a);
      box(9, 3, 1, 2, 1, 1, b);
      box(9, 11, 1, 2, 1, 1, b);
    } else if (kind === 'axe' || kind === 'battle_axe') {
      box(9, 8, 1, 3, 4, 1, a);
      I.top(9, 11, 2.1, 3, 1, b);
      if (kind === 'battle_axe') {
        box(9, 3, 1, 3, 4, 1, a);
        I.top(9, 3, 2.1, 3, 1, b);
      }
    } else if (kind === 'hoe') {
      box(10, 8, 0, 2, 4, 2, a);
      I.top(10, 11, 2.1, 2, 1, b);
    } else if (kind === 'warhammer') {
      box(9, 4, 0, 3, 7, 3, a);
      I.top(9, 4, 3.1, 1, 7, b);
    } else if (kind === 'rod') {
      box(11, 7, 1, 3, 1, 1, b);
      I.box(12, 10, 0, 1, 1, 2, { top: C.r4, left: C.r3, right: C.r2 });
      I.top(13, 8, 1, 0.6, 3, C.fog);
    } else if (kind === 'net') {
      for (const [u, v, du, dv] of [
        [9, 4, 4, 1],
        [9, 10, 4, 1],
        [9, 5, 1, 5],
        [12, 5, 1, 5],
        [10, 6, 2, 0.6],
        [10, 8, 2, 0.6],
      ])
        I.top(u!, v!, 2, du!, dv!, b);
    }
  };
export const ISO_ICONS: Partial<Record<Glyph, Draw>> = {};
for (const id of [
  'axe',
  'pickaxe',
  'hoe',
  'can',
  'rod',
  'net',
  'sword',
  'dagger',
  'greatsword',
  'spear',
  'battle_axe',
  'warhammer',
  'shield',
] as Glyph[])
  ISO_ICONS[id] = tool(id);
for (const id of ['log', 'plank', 'stone', 'ore', 'ingot', 'coal', 'brick', 'block', 'book'] as Glyph[])
  ISO_ICONS[id] = (ctx, a, b) => {
    const I = new IconIso(ctx, 8, 3);
    const face = { top: lt(a), left: a, right: dk(a) };
    if (id === 'log') {
      I.box(4, 4, 0, 8, 7, 5, face);
      I.top(5, 5, 5.1, 6, 5, b);
      I.top(6, 6, 5.2, 4, 3, a);
      I.top(7, 7, 5.3, 2, 1, b);
    } else if (id === 'plank' || id === 'ingot' || id === 'brick') {
      I.box(3, 5, 0, 10, 5, id === 'ingot' ? 3 : 2, face);
      if (id === 'plank') for (const v of [6, 8]) I.top(4, v, 2.1, 8, 0.5, b);
    } else if (id === 'book') {
      I.box(4, 4, 0, 8, 7, 2, { top: b, left: C.pale, right: C.fog });
      I.top(4, 4, 2.1, 8, 7, a);
      I.top(4, 4, 2.2, 1, 7, b);
    } else {
      I.box(4, 4, 0, 8, 8, 4, face);
      if (id === 'ore')
        for (const [u, v] of [
          [6, 6],
          [9, 5],
          [8, 9],
        ])
          I.top(u!, v!, 4.1, 2, 1, b);
    }
  };
