import { Assets, Rectangle, Texture } from 'pixi.js';
import bossUrl from '../assets/bosses/veyr.png?url';
import { normalizeBody } from './creature-pixels';
import type { Anim } from './foes';

export const STORM_SIZE = 96;
export const STORM_FOOT = 86;
const columns: Record<Anim, number[]> = {
  idle: [0],
  move: [1, 2, 3, 4],
  windup: [5],
  attack: [6],
  hurt: [5],
  death: [7],
};
export interface StormboundArt {
  frame(dir: number, anim: Anim, phase: number): Texture;
}

/** One common scale for the whole sheet. Register each pose at its ground contact, never at its head/arms. */
export async function loadStormbound(): Promise<StormboundArt> {
  const source = await Assets.load<Texture>(bossUrl),
    image = source.source.resource as CanvasImageSource;
  const sw = source.width / 8,
    sh = source.height / 4,
    fw = Math.ceil(sw),
    fh = Math.ceil(sh);
  if (Math.abs(sw - sh) > 1) throw new Error('Veyr sheet must have eight columns and four square-cell facings');
  const sample = document.createElement('canvas');
  sample.width = fw;
  sample.height = fh;
  const ctx = sample.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  const bounds: Array<{ bottom: number; width: number; height: number }> = [];
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 8; col++) {
      ctx.clearRect(0, 0, fw, fh);
      ctx.drawImage(image, col * sw, row * sh, sw, sh, 0, 0, fw, fh);
      const data = ctx.getImageData(0, 0, fw, fh).data;
      let left = fw,
        right = 0,
        top = fh,
        bottom = 0;
      for (let y = 0; y < fh; y++)
        for (let x = 0; x < fw; x++)
          if (data[(y * fw + x) * 4 + 3]! >= 128) {
            left = Math.min(left, x);
            right = Math.max(right, x + 1);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y + 1);
          }
      if (bottom <= top) throw new Error('Veyr sheet contains an empty pose');
      bounds.push({ bottom, width: right - left, height: bottom - top });
    }
  const scale = Math.min(
    1,
    64 / Math.max(...bounds.map((b) => b.width)),
    76 / Math.max(...bounds.map((b) => b.height)),
  );
  const atlas = document.createElement('canvas');
  atlas.width = STORM_SIZE * 8;
  atlas.height = STORM_SIZE * 4;
  const target = atlas.getContext('2d')!;
  sample.width = STORM_SIZE;
  sample.height = STORM_SIZE;
  ctx.imageSmoothingEnabled = false;
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 8; col++) {
      const b = bounds[row * 8 + col]!;
      ctx.clearRect(0, 0, STORM_SIZE, STORM_SIZE);
      ctx.drawImage(
        image,
        col * sw,
        row * sh,
        sw,
        sh,
        Math.round(STORM_SIZE / 2 - (fw * scale) / 2),
        Math.round(STORM_FOOT - b.bottom * scale),
        Math.round(fw * scale),
        Math.round(fh * scale),
      );
      const data = ctx.getImageData(0, 0, STORM_SIZE, STORM_SIZE);
      normalizeBody(data.data, STORM_SIZE, STORM_SIZE);
      target.putImageData(data, col * STORM_SIZE, row * STORM_SIZE);
    }
  const texture = Texture.from(atlas);
  texture.source.scaleMode = 'nearest';
  const frames = bounds.map(
    (_, i) =>
      new Texture({
        source: texture.source,
        frame: new Rectangle((i % 8) * STORM_SIZE, Math.floor(i / 8) * STORM_SIZE, STORM_SIZE, STORM_SIZE),
      }),
  );
  return {
    frame: (dir, anim, phase) => {
      const seq = columns[anim];
      return frames[(Math.floor(dir) & 3) * 8 + seq[((Math.floor(phase) % seq.length) + seq.length) % seq.length]!]!;
    },
  };
}
