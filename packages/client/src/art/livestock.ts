/** Original 2:1 livestock models. Rebuild orientation in model space; keep hooves fixed during idles. */
import { Texture } from 'pixi.js';
import { LIVESTOCK, type LivestockSpecies } from '@eigenlands/shared';
import { Iso, mat, type BoxMat } from './isokit';
import { C, makeCanvas } from './shade';
const canvases = new Map<string, HTMLCanvasElement>(),
  textures = new Map<string, Texture>();
export function livestockCanvas(species: LivestockSpecies, frame = 0, facing = 0): HTMLCanvasElement {
  const key = `${species}:${frame}:${facing}`;
  const cached = canvases.get(key);
  if (cached) return cached;
  const { canvas, ctx } = makeCanvas(48, 48),
    iso = new Iso(ctx, 24, 37);
  const wool = species === 'sheep',
    bird = species === 'chicken',
    pig = species === 'pig',
    horse = species === 'horse',
    magic = species === 'phasehart';
  const ramp = magic
    ? [C.q1, C.q2, C.w3, C.w5, C.q7]
    : pig
      ? [C.r1, C.r2, C.r3, C.r4, C.r5]
      : horse
        ? [C.e0, C.e1, C.e2, C.e3, C.e4]
        : [C.slate, C.mist, C.fog, C.pale, C.white];
  const coat = mat(ramp),
    hoof = mat([C.ink, C.night, C.slate, C.steel, C.mist]);
  const box = (x: number, y: number, z: number, w: number, d: number, h: number, m: BoxMat = coat) =>
    facing ? iso.box(y, x, z, d, w, h, m) : iso.box(x, y, z, w, d, h, m);
  const dot = (x: number, y: number, z: number, c: number, w = 1, h = 1) =>
    facing ? iso.dot(y, x, z, c, w, h) : iso.dot(x, y, z, c, w, h);
  if (bird) {
    box(6, 6, 0, 1, 1, 3, mat([C.e2, C.e3, C.e4, C.e5, C.e6]));
    box(10, 8, 0, 1, 1, 3, mat([C.e2, C.e3, C.e4, C.e5, C.e6]));
    box(3, 4, 3, 9, 7, 4);
    box(5, 5, 7, 7, 5, 3);
    box(9, 5, 8, 4, 4, 5);
    box(12, 5, 10, 3, 2, 1, mat([C.e3, C.e4, C.e5, C.e6, C.e7]));
    box(10, 6, 13, 2, 1, 2, mat([C.r0, C.r1, C.r2, C.r3, C.r4]));
    dot(12, 8, 12, C.ink);
    box(1, 5, 6, 3, 3, 3);
  } else {
    for (const x of [3, 11])
      for (const y of [5, 10]) {
        box(x, y, 0, 1.5, 1.5, 3, hoof);
        box(x, y, 3, 1.5, 1.5, horse ? 5 : 3);
      }
    const z = horse ? 7 : 5;
    box(2, 4, z, 11, 8, 4);
    box(3, 5, z + 4, 9, 6, wool ? 3 : 2);
    box(3, 5, z - 1, 9, 6, 1);
    const head = frame ? z + 1 : z + 4;
    if (horse || magic) box(10, 5, z + 2, 3, 4, 7);
    box(11, 4, head, 5, 5, 4);
    box(14, 4, head, 3, 4, 2, pig ? mat([C.r1, C.r2, C.r3, C.r4, C.r5]) : coat);
    box(12, 4, head + 4, 1, 2, frame ? 1 : 3);
    box(14, 7, head + 4, 1, 2, 2);
    dot(15, 8, head + 3, C.ink);
    if (species === 'cow') {
      box(4, 4, z + 3, 3, 2, 2, hoof);
      box(8, 10, z + 2, 3, 2, 2, hoof);
    }
    if (wool) for (const x of [4, 7, 10]) for (const y of [5, 8, 10]) dot(x, y, z + 7, C.white, 2, 2);
    if (species === 'goat' || magic) {
      for (const y of [5, 8]) {
        box(11, y, head + 4, 1, 1, 4, hoof);
        dot(10, y, head + 8, magic ? C.q7 : C.e5);
      }
      if (species === 'goat') box(14, 7, head - 2, 1, 1, 3);
    }
    if (horse) {
      box(9, 5, z + 6, 2, 1, 4, hoof);
      box(0, 7, z, 1, 2, 5, hoof);
    } else box(1, 6, z + 1, 1, 1, frame ? 3 : 2, coat);
    if (pig) {
      dot(17, 7, head + 1, C.r0);
      dot(16, 6, head + 1, C.r0);
    }
  }
  canvases.set(key, canvas);
  return canvas;
}
export function livestockTexture(species: LivestockSpecies, frame = 0, facing = 0): Texture {
  const key = `${species}:${frame}:${facing}`;
  let tex = textures.get(key);
  if (!tex) {
    tex = Texture.from(livestockCanvas(species, frame, facing));
    tex.source.scaleMode = 'nearest';
    textures.set(key, tex);
  }
  return tex;
}
export function livestockPortrait(species: LivestockSpecies): string {
  return livestockCanvas(species).toDataURL();
}
void LIVESTOCK;
