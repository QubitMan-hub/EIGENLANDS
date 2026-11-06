import { Texture } from 'pixi.js';
import catalog from './reference-trees.json';
import type { ObjSprite } from './objects';
export type ReferenceTree = keyof typeof catalog.frames;
/** Decodes the prepared, palette-indexed sprite once when seasonal object art is built. */
export function referenceTree(name: ReferenceTree): ObjSprite {
  const f = catalog.frames[name];
  const c = document.createElement('canvas');
  c.width = f.w;
  c.height = f.h;
  const ctx = c.getContext('2d')!;
  const image = ctx.createImageData(f.w, f.h);
  let pixel = 0;
  for (let i = 0; i < f.runs.length; i += 2) {
    const count = f.runs[i]!,
      index = f.runs[i + 1]!,
      color = f.palette[index]!;
    for (let n = 0; n < count; n++, pixel++) {
      if (!index) continue;
      image.data[pixel * 4] = (color >> 16) & 255;
      image.data[pixel * 4 + 1] = (color >> 8) & 255;
      image.data[pixel * 4 + 2] = color & 255;
      image.data[pixel * 4 + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const tex = Texture.from(c);
  tex.source.scaleMode = 'nearest';
  return { tex, ax: f.ax, ay: f.ay };
}
export function referenceForest(season: number): ObjSprite[] {
  const names: ReferenceTree[] =
    season === 3
      ? ['bare', 'bare', 'bare', 'bare', 'snow_spruce', 'snow_spruce']
      : season === 2
        ? ['maple', 'red_oak', 'maple', 'red_oak', 'spruce', 'pine']
        : ['oak', 'birch', 'oak', 'birch', 'spruce', 'pine'];
  return names.map(referenceTree);
}
