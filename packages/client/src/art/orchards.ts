import { type CropDef, type CropData, cropStage, isRipe } from '@eigenlands/shared';
import { Iso, mat, WOODM } from './isokit';
import { makeCanvas, C } from './shade';
export function orchardCanvas(def: CropDef, data: CropData): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(48, 76),
    iso = new Iso(ctx, 24, 62),
    wood = mat(WOODM);
  const stage = cropStage(data),
    mature = data.established || stage >= 2,
    h = mature ? 24 : 10 + stage * 4;
  const leaf = [C.g0, C.g1, C.g2, C.g3, C.g4, C.g5];
  if (def.shape === 'trellis') {
    for (const x of [1, 14]) iso.box(x, 6, 0, 1.4, 2, 29, wood);
    for (const z of [12, 23, 29]) iso.box(1, 6, z, 14, 1, 1.2, wood);
    iso.line3(3, 7, 0, 10, 7, 25, C.g2);
    if (!data.dormant)
      for (const x of [3, 7, 11])
        for (const z of [9, 17, 25]) {
          iso.box(x, 5, z, 3, 3, 2, mat(leaf));
          if (isRipe(data)) {
            iso.dot(x + 1, 8, z - 2, def.color, 2, 3);
            iso.dot(x + 2, 8, z - 4, def.color - 1, 1, 2);
          }
        }
  } else {
    iso.box(7, 7, 0, 2.5, 2.5, h, wood);
    iso.line3(8, 8, h - 7, 3, 7, h + 1, C.e2);
    iso.line3(8, 8, h - 6, 12, 11, h, C.e1);
    if (!data.dormant) {
      const r = mature ? 7 : 4;
      for (const [radius, z] of [
        [r, h - 2],
        [r - 1, h + 2],
        [r - 3, h + 6],
      ])
        iso.cyl(8, 8, z!, radius!, 4, leaf, leaf);
      if (isRipe(data))
        for (const [x, y, z] of [
          [3, 8, h + 1],
          [7, 13, h],
          [11, 10, h + 4],
          [8, 3, h + 5],
        ]) {
          iso.dot(x!, y!, z!, def.color, 2, 2);
          iso.dot(x!, y!, z! + 1, def.color + 1);
        }
    }
  }
  return canvas;
}
