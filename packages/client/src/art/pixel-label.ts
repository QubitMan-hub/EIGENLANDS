/**
 * Short labels (names, floating numbers) in the game's own 3×5 pixel font with a one-pixel ink outline, drawn
 * as a crisp nearest-filtered sprite. Scaled by the world's whole-number art scale, its pixels sit on the same
 * grid as the art, so it stays legible at every quality tier (vector text drawn into a low-resolution
 * renderer collapses into blur).
 */
import { Sprite, Texture, type DestroyOptions } from 'pixi.js';
import { C, fontWidth, makeCanvas, outline, PixBuf, pixelText } from './shade';

interface Plate {
  texture: Texture;
  users: number;
}
const cache = new Map<string, Plate>();
const MAX_CACHE = 512;

/** Idle plates are disposable; sprites retain shared plates until their last owner releases them. */
function trim(): void {
  for (const [key, p] of cache) {
    if (cache.size <= MAX_CACHE) break;
    if (!p.users) {
      cache.delete(key);
      p.texture.destroy(true);
    }
  }
}
function release(p: Plate | undefined): void {
  if (p) {
    p.users--;
    trim();
  }
}
function plate(text: string, fill: number, ink: number): Plate {
  const key = `${fill}|${ink}|${text}`;
  const old = cache.get(key);
  if (old) {
    old.users++;
    cache.delete(key);
    cache.set(key, old);
    return old;
  }
  const w = Math.max(1, fontWidth(text)) + 4,
    h = 9;
  const buf = new PixBuf(w, h);
  pixelText(buf.ctx, text, 2, 2, fill);
  outline(buf.ctx, w, h, ink);
  const { canvas, ctx } = makeCanvas(w, h);
  buf.blit(ctx, 0, 0);
  const t = Texture.from(canvas);
  t.source.scaleMode = 'nearest';
  const p = { texture: t, users: 1 };
  cache.set(key, p);
  trim();
  return p;
}

export class PixelLabel extends Sprite {
  private value = '';
  private entry: Plate | undefined;
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
    this.updatePlate();
  }
  /** change the fill colour (palette index) */
  setFill(fill: number): void {
    if (fill === this.fill) return;
    this.fill = fill;
    this.updatePlate();
  }
  private updatePlate(): void {
    const old = this.entry;
    this.entry = plate(this.value, this.fill, this.ink);
    this.texture = this.entry.texture;
    release(old);
  }
  override destroy(options?: DestroyOptions): void {
    if (this.destroyed) return;
    const old = this.entry;
    this.entry = undefined;
    // Shared plate ownership belongs to this class, including when a parent requests texture destruction.
    super.destroy(
      typeof options === 'boolean'
        ? { children: options, texture: false, textureSource: false }
        : { ...options, texture: false, textureSource: false },
    );
    release(old);
  }
}
