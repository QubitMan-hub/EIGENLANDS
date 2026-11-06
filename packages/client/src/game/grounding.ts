import { Sprite, Texture, type Container } from 'pixi.js';
let contactTexture: Texture | null = null;
/** One shared, softly edged footprint. Cast silhouettes alone lose their thin trunk at low sun angles. */
export function contactShadow(layer: Container, radius: number): Sprite {
  if (!contactTexture) {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 16;
    const ctx = c.getContext('2d')!,
      image = ctx.createImageData(32, 16);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 32; x++) {
        const distance = ((x + 0.5 - 16) / 16) ** 2 + ((y + 0.5 - 8) / 8) ** 2;
        const i = (y * 32 + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = 255;
        image.data[i + 3] = Math.round(255 * Math.max(0, 1 - distance) ** 2);
      }
    ctx.putImageData(image, 0, 0);
    contactTexture = Texture.from(c);
    contactTexture.source.scaleMode = 'nearest';
  }
  const s = new Sprite(contactTexture);
  s.anchor.set(0.5);
  s.scale.set(radius / 16);
  s.tint = 0x1c2630;
  layer.addChild(s);
  return s;
}
/** Keep the ground point fixed while projecting the upright silhouette away from the sun. */
export function castProjection(dx: number, len: number): { scaleY: number; skewX: number } {
  const flat = 0.22 + 0.14 * len,
    horizontal = dx * len * 0.55;
  return { scaleY: -Math.hypot(flat, horizontal), skewX: Math.atan2(horizontal, flat) };
}
