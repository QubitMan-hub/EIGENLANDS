/** Original 2:1 livestock models. Rebuild orientation in model space; keep hooves fixed during idles. */
import { Texture } from 'pixi.js';
import { type LivestockSpecies } from '@eigenlands/shared';
import { Iso, mat, type BoxMat } from './isokit';
import { C, makeCanvas, put } from './shade';
const canvases = new Map<string, HTMLCanvasElement>(),
  textures = new Map<string, Texture>();
export function livestockCanvas(species: LivestockSpecies, frame = 0, facing = 0): HTMLCanvasElement {
  const key = `${species}:${frame}:${facing}`;
  const cached = canvases.get(key);
  if (cached) return cached;
  const { canvas, ctx } = makeCanvas(48, 56),
    iso = new Iso(ctx, 24, 41);
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
  const turn = (x: number, y: number): [number, number] => {
    if (facing & 1) [x, y] = [y, x];
    return facing >= 2 ? [16 - x, 16 - y] : [x, y];
  };
  const box = (x: number, y: number, z: number, w: number, d: number, h: number, m: BoxMat = coat) => {
    if (facing & 1) {
      [x, y] = [y, x];
      [w, d] = [d, w];
    }
    if (facing >= 2) {
      x = 16 - x - w;
      y = 16 - y - d;
    }
    iso.box(x, y, z, w, d, h, m);
  };
  const dot = (x: number, y: number, z: number, c: number, w = 1, h = 1) => {
    const [u, v] = turn(x, y);
    iso.dot(u, v, z, c, w, h);
  };
  // Ray-intersect rounded volumes in the same 2:1 model axes as the legs and props.
  const body = (
    cx: number,
    cy: number,
    cz: number,
    rx: number,
    ry: number,
    rz: number,
    colors: readonly number[] = ramp,
    patch = false,
  ) => {
    if (facing & 1) {
      [cx, cy] = [cy, cx];
      [rx, ry] = [ry, rx];
    }
    if (facing >= 2) {
      cx = 16 - cx;
      cy = 16 - cy;
    }
    const sx = 24 + cx - cy,
      sy = 41 + (cx + cy) / 2 - cz,
      xx = rx + ry,
      yy = (rx + ry) / 2 + rz;
    const A = 1 / (rx * rx) + 1 / (ry * ry) + 1 / (rz * rz);
    for (let py = Math.floor(sy - yy); py <= Math.ceil(sy + yy); py++)
      for (let px = Math.floor(sx - xx); px <= Math.ceil(sx + xx); px++) {
        const dx = px + 0.5 - 24,
          dy = py + 0.5 - 41,
          u = dx / 2 + dy - cx,
          v = dy - dx / 2 - cy;
        const B = 2 * (u / (rx * rx) + v / (ry * ry) - cz / (rz * rz)),
          D = B * B - 4 * A * ((u * u) / (rx * rx) + (v * v) / (ry * ry) + (cz * cz) / (rz * rz) - 1);
        if (D < 0) continue;
        const z = (-B + Math.sqrt(D)) / (2 * A),
          nx = (u + z) / (rx * rx),
          ny = (v + z) / (ry * ry),
          nz = (z - cz) / (rz * rz),
          length = Math.hypot(nx, ny, nz);
        const light = 0.48 + ((-nx * 0.3 + ny * 0.2 + nz * 0.8) / length) * 0.46;
        const color =
          patch && ((u + z > 0 && v + z > 0) || (u + z < -2 && v + z < -1))
            ? C.slate
            : colors[Math.max(0, Math.min(colors.length - 1, Math.floor(light * colors.length)))]!;
        put(ctx, px, py, color);
      }
  };
  if (bird) {
    box(6, 6, 0, 1, 1, 3, mat([C.e2, C.e3, C.e4, C.e5, C.e6]));
    box(10, 8, 0, 1, 1, 3, mat([C.e2, C.e3, C.e4, C.e5, C.e6]));
    body(7, 8, 6.5, 5, 3.5, 4);
    body(11, 7, 11, 2.8, 2.3, 3);
    box(12, 5, 10, 3, 2, 1, mat([C.e3, C.e4, C.e5, C.e6, C.e7]));
    box(10, 6, 13, 2, 1, 2, mat([C.r0, C.r1, C.r2, C.r3, C.r4]));
    dot(12, 8, 12, C.ink);
    box(1, 5, 6, 3, 3, 3);
  } else {
    for (const x of [3, 11])
      for (const y of [5, 10]) {
        const stride = frame >= 2 ? (((x === 3) === (y === 5)) === (frame === 2) ? 0.7 : -0.7) : 0;
        box(x + stride, y, 0, 1.5, 1.5, 3, hoof);
        box(x + stride * 0.5, y, 3, 1.5, 1.5, horse ? 5 : 3);
      }
    const z = horse ? 7 : 5;
    body(7.5, 8, z + 3, 6, 4, wool ? 5 : 3.8, ramp, species === 'cow');
    const head = frame === 1 ? z + 1 : z + 4;
    if (horse || magic) body(11.5, 7, z + 6, 2, 2.4, 5);
    body(13, 6.5, head + 2, 3, 2.5, 3);
    body(15, 6.5, head + 1, 2.6, 2, 1.6);
    box(12, 4, head + 4, 1, 2, frame === 1 ? 1 : 3);
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
    } else box(1, 6, z + 1, 1, 1, frame === 1 ? 3 : 2, coat);
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
