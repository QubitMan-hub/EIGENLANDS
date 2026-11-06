import { Texture } from 'pixi.js';
import type { ObjSprite } from './objects';
export interface PreparedSprite {
  w: number;
  h: number;
  ax: number;
  ay: number;
  palette: number[];
  runs: number[];
}
/** Palette/RLE inputs are prepared offline. Transparent samples never retain a backdrop colour. */
export function preparedSprite(f: PreparedSprite): ObjSprite {
  const c = document.createElement('canvas');
  c.width = f.w;
  c.height = f.h;
  const ctx = c.getContext('2d')!,
    image = ctx.createImageData(f.w, f.h);
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
