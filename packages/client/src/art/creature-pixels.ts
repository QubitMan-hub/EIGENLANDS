import { C, PALETTE } from '@eigenlands/shared';

/** RGB values for renderers which shade materials rather than painting palette indices. */
export const ART_RGB = Object.fromEntries(
  Object.entries(C).map(([name, index]) => [name, parseInt(PALETTE[index]!.slice(1), 16)]),
) as { readonly [K in keyof typeof C]: number };
const colors = PALETTE.map((hex) => parseInt(hex.slice(1), 16));

/** Called while baking atlases only. No global colour cache that grows with visited regions. */
export function paletteColor(rgb: number): number {
  let best = colors[0]!,
    distance = Infinity;
  for (const color of colors) {
    const r = ((rgb >> 16) & 255) - ((color >> 16) & 255);
    const g = ((rgb >> 8) & 255) - ((color >> 8) & 255);
    const b = (rgb & 255) - (color & 255);
    const d = 2 * r * r + 4 * g * g + b * b;
    if (d < distance) {
      best = color;
      distance = d;
    }
  }
  return best;
}

/** Selective inner contour: shaded right/lower edges, no swollen silhouette or filled leg gaps. */
export function contour(data: Uint8ClampedArray, w: number, h: number, eligible?: (pixel: number) => boolean): void {
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3]! >= 128;
  const marks: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!solid(x, y) || (eligible && !eligible(i))) continue;
      if ((!solid(x + 1, y) && solid(x - 1, y)) || (!solid(x, y + 1) && solid(x, y - 1))) marks.push(i * 4);
    }
  for (const i of marks) {
    // Preserve darker ink details instead of lightening them into an inverted rim.
    if (
      2 * data[i]! + 4 * data[i + 1]! + data[i + 2]! <=
      2 * ((ART_RGB.night >> 16) & 255) + 4 * ((ART_RGB.night >> 8) & 255) + (ART_RGB.night & 255)
    )
      continue;
    data[i] = (ART_RGB.night >> 16) & 255;
    data[i + 1] = (ART_RGB.night >> 8) & 255;
    data[i + 2] = ART_RGB.night & 255;
  }
}

/** Imported body art uses crisp coverage; engine-rendered ground shadows remain separate. */
export function normalizeBody(data: Uint8ClampedArray, w: number, h: number, shadowLift = 0): void {
  const remap = new Map<number, number>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 128) {
      data.fill(0, i, i + 4);
      continue;
    }
    const rgb = (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!;
    let c = remap.get(rgb);
    if (c === undefined) {
      // Dark fur needs separated midtones after reduction to 48 colours. Retain bright accent colours.
      const lift = shadowLift * (1 - Math.max(data[i]!, data[i + 1]!, data[i + 2]!) / 255);
      const channel = (n: number) => Math.min(255, Math.round(n + lift));
      c = paletteColor((channel(data[i]!) << 16) | (channel(data[i + 1]!) << 8) | channel(data[i + 2]!));
      remap.set(rgb, c);
    }
    data[i] = (c >> 16) & 255;
    data[i + 1] = (c >> 8) & 255;
    data[i + 2] = c & 255;
    data[i + 3] = 255;
  }
  contour(data, w, h);
}

/** One layout for an entire species, based on its idle silhouette, never the changing bounds of each pose. */
export function critterLayout(fw: number, fh: number, ax: number, ay: number, bodyWidth: number, bodyHeight: number) {
  const scale = Math.min(1, 32 / Math.max(1, bodyWidth), 32 / Math.max(1, bodyHeight));
  const width = Math.max(1, Math.round(fw * scale)),
    height = Math.max(1, Math.round(fh * scale));
  return { width, height, ax: Math.round(ax * width) / width, ay: Math.round(ay * height) / height };
}
