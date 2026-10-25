import { Container, Graphics, RenderTexture, Sprite, Texture, type Renderer } from 'pixi.js';
import { PALETTE, TILE_SIZE } from '@eigenlands/shared';
import { makeCanvas } from '../art/draw';

export interface Light {
  x: number;
  y: number;
  radius: number;
  color: number;
  intensity: number;
}

const hex = (r: number, g: number, b: number) =>
  (Math.round(Math.min(1, r) * 255) << 16) | (Math.round(Math.min(1, g) * 255) << 8) | Math.round(Math.min(1, b) * 255);
const paletteInt = (i: number) => parseInt(PALETTE[i]!.slice(1), 16);

/** Day/night: a low-res lightmap (ambient colour + additive point lights) multiplied over the world. */
export class Lighting {
  readonly sprite: Sprite;
  private rt: RenderTexture;
  private scene = new Container();
  private base = new Graphics();
  private pool: Sprite[] = [];
  private glow: Texture;
  private w = 0;
  private h = 0;
  private ambientHex = -1;

  constructor(private renderer: Renderer) {
    const { canvas, ctx } = makeCanvas(128, 128);
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    this.glow = Texture.from(canvas);
    this.rt = RenderTexture.create({ width: 16, height: 16, resolution: 0.5 });
    // Pixi must invalidate the submitted sprite quad when this render target resizes.
    this.rt.dynamic = true;
    this.sprite = new Sprite(this.rt);
    this.sprite.blendMode = 'multiply';
    this.scene.addChild(this.base);
  }

  /** Size of the lightmap in world pixels (one lightmap texel per world pixel). */
  resize(wPx: number, hPx: number): void {
    wPx = Math.ceil(wPx);
    hPx = Math.ceil(hPx);
    if (wPx === this.w && hPx === this.h) return;
    this.w = wPx;
    this.h = hPx;
    this.rt.resize(wPx, hPx, 0.5);
    this.ambientHex = -1;
    this.rt.source.scaleMode = 'linear';
  }

  render(ambient: [number, number, number], lights: Light[]): void {
    const color = hex(ambient[0], ambient[1], ambient[2]);
    if (color !== this.ambientHex) {
      this.ambientHex = color;
      this.base.clear().rect(0, 0, this.w, this.h).fill(color);
    }
    while (this.pool.length < lights.length) {
      const s = new Sprite(this.glow);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      this.scene.addChild(s);
      this.pool.push(s);
    }
    for (let i = 0; i < this.pool.length; i++) {
      const s = this.pool[i]!;
      const l = lights[i];
      s.visible = !!l;
      if (!l) continue;
      s.x = l.x;
      s.y = l.y;
      s.width = l.radius * 22.6 * 2;
      s.height = l.radius * 11.3 * 2; // a round pool of light on the ground is an ellipse in iso
      s.tint = l.color;
      s.alpha = l.intensity;
    }
    this.renderer.render({ container: this.scene, target: this.rt, clear: false });
  }

  static colorOf(paletteIndex: number): number {
    return paletteInt(paletteIndex);
  }
}
