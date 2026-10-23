import { mulberry32 } from '@eigenlands/shared';
import type { SceneryKind } from '../game/scenery';
import { Iso, Prop, WOODM, STONEM, mat } from './isokit';
import { toSprite, type ObjSprite } from './objects';
import { C, line, makeCanvas, poly, put, undithered } from './shade';

/** Low silhouettes leave the walkable surface readable; all bases use the same tile-centre anchor. */
export function buildSceneryArt(): Record<SceneryKind, ObjSprite[]> {
  const kinds: SceneryKind[] = ['wild_ferns', 'wild_reeds', 'wild_clover', 'wild_leaves', 'wild_bough', 'wild_driftwood', 'wild_scree', 'wild_stalagmite', 'wild_glowcap'];
  return Object.fromEntries(kinds.map(kind => [kind, Array.from({ length: 3 }, (_, v) => {
    const { canvas, ctx } = makeCanvas(40, 32), I = new Iso(ctx, 20, 16), rng = mulberry32(510 + v * 19);
    undithered(() => {
      if (kind === 'wild_reeds') {
        for (let i = 0; i < 7; i++) {
          const u = 5 + rng() * 6, w = 5 + rng() * 5;
          const x = I.X(u, w), y = I.Y(u, w, 0), h = 7 + rng() * 8;
          line(ctx, x, y, x + (i % 3 - 1), y - h, i % 2 ? C.g3 : C.g4);
          line(ctx, x, y - 3, x + (i % 2 ? 3 : -3), y - h * 0.7, C.g2);
          if (i % 3 === 0) line(ctx, x + i % 3 - 1, y - h - 2, x + i % 3 - 1, y - h + 1, C.e2);
        }
      } else if (kind === 'wild_ferns') {
        for (let i = 0; i < 5; i++) {
          const x = I.X(8, 8), y = I.Y(8, 8, 0), dx = (i - 2) * 3, h = 6 - Math.abs(i - 2);
          line(ctx, x, y, x + dx, y - h, C.g2);
          for (let j = 1; j < 4; j++) {
            const fx = x + dx * j / 4, fy = y - h * j / 4;
            line(ctx, fx, fy, fx - 2, fy - 2, i < 3 ? C.g4 : C.g3);
            line(ctx, fx, fy, fx + 2, fy - 1, C.g3);
          }
        }
      } else if (kind === 'wild_bough' || kind === 'wild_driftwood') {
        const wood = new Prop(ctx, 20, 24, v === 1 ? 'se' : 'sw'), length = 13 - v;
        wood.box(1, 6, 0, length, 3, 2.5, { ramp: kind === 'wild_driftwood' ? [C.e2, C.e3, C.e4, C.e5, C.e6] : WOODM, end: () => C.e5 });
        for (const u of [4, 10 - v]) wood.line(u, 7, 2, u - 2, 3 + v, 1, C.e3);
        wood.dot(length + 1, 7, 1, C.e2);
        if (kind === 'wild_bough') for (const u of [2 + v, 6, 8]) wood.dot(u, 6, 3, C.g3, 2);
        else { I.dot(11, 12, 0, C.pale, 2); I.dot(3, 11, 0, C.e6); }
      } else if (kind === 'wild_scree' || kind === 'wild_stalagmite') {
        for (let i = 0; i < 5; i++) {
          const u = 3 + rng() * 10, w = 3 + rng() * 9, h = kind === 'wild_stalagmite' ? 3 + rng() * 8 : 1 + rng() * 2;
          const x = I.X(u, w), y = I.Y(u, w, 0);
          poly(ctx, [[x - 2, y], [x - 1, y - h], [x + 2, y]], px => px < x ? C.mist : C.slate);
          if (kind === 'wild_scree' && i === 0) I.box(u, w, 0, 3, 2, 2, mat(STONEM));
        }
      } else if (kind === 'wild_glowcap') {
        for (let i = 0; i < 4; i++) {
          const u = 3 + rng() * 9, w = 3 + rng() * 9, x = I.X(u, w), y = I.Y(u, w, 0), h = 3 + i % 2;
          line(ctx, x, y, x, y - h, C.w3);
          poly(ctx, [[x - 3, y - h], [x - 1, y - h - 2], [x + 1, y - h - 2], [x + 3, y - h]], py => py < x ? C.w5 : C.w2);
          put(ctx, Math.round(x - 1), Math.round(y - h - 1), C.q7);
        }
      } else {
        for (let i = 0; i < 11; i++) {
          const u = 1 + rng() * 14, w = 1 + rng() * 14;
          if (kind === 'wild_leaves') {
            const x = I.X(u, w), y = I.Y(u, w, 0), c = [C.r2, C.r4, C.r5, C.e4][i % 4]!;
            poly(ctx, [[x - 2, y], [x, y - 1], [x + 2, y], [x, y + 1]], c);
          } else {
            I.dot(u, w, 0, i % 2 ? C.g3 : C.g4, 2); I.dot(u + 1, w, 1, C.g5);
            if (i % 4 === 0) I.dot(u, w, 2, C.e7);
          }
        }
      }
    });
    return toSprite(canvas, 20, 24, { ao: false, rim: false });
  })])) as Record<SceneryKind, ObjSprite[]>;
}
