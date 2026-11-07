/**
 * Short labels (names, floating numbers) in the game's own 3×5 pixel font with a one-pixel ink outline, drawn
 * as a crisp nearest-filtered sprite. Scaled by the world's whole-number art scale, its pixels sit on the same
 * grid as the art, so it stays legible at every quality tier (vector text drawn into a low-resolution
 * renderer collapses into blur).
 */
import { Sprite, Texture } from 'pixi.js';
import { C, fontWidth, makeCanvas, outline, PixBuf, pixelText } from './shade';

const cache = new Map<string, Texture>();
const MAX_CACHE = 512;

function plate(text: string, fill: number, ink: number): Texture {
  const key = `${fill}|${ink}|${text}`;
  let t = cache.get(key);
  if (t) return t;
  const w = Math.max(1, fontWidth(text)) + 4,
    h = 9;
  const buf = new PixBuf(w, h);
  pixelText(buf.ctx, text, 2, 2, fill);
  outline(buf.ctx, w, h, ink);
  const { canvas, ctx } = makeCanvas(w, h);
  buf.blit(ctx, 0, 0);
  t = Texture.from(canvas);
  t.source.scaleMode = 'nearest';
  if (cache.size >= MAX_CACHE) {
    const [oldKey, old] = cache.entries().next().value!;
    cache.delete(oldKey);
    old.destroy(true);
  }
  cache.set(key, t);
  return t;
}

export class PixelLabel extends Sprite {
  private value = '';
  constructor(
    text: string,
    private fill: number,
    private ink: number = C.ink,
  ) {
    super();
    this.text = text;
  }
  get text(): string {
    return this.value;
  }
  set text(v: string) {
    if (v === this.value && this.texture !== Texture.EMPTY) return;
    this.value = v;
    this.texture = plate(v, this.fill, this.ink);
  }
  /** change the fill colour (palette index) */
  setFill(fill: number): void {
    if (fill === this.fill) return;
    this.fill = fill;
    this.texture = plate(this.value, fill, this.ink);
  }
}
