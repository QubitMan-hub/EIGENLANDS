import { Texture } from 'pixi.js';
import { C } from './shade';
import { capsule, ellipsoid, rbox, renderModel, type Prim, type Ramp, type Heading } from './voxel';

export type VillageAnimal = 'cat' | 'dog' | 'chicken' | 'pigeon';
export const VILLAGE_W = 40,
  VILLAGE_H = 36,
  VILLAGE_AX = 20,
  VILLAGE_AY = 28;
const FUR: Ramp = [C.e0, C.e1, C.e2, C.e3, C.e4];
const WHITE: Ramp = [C.steel, C.mist, C.fog, C.white];
const GREY: Ramp = [C.night, C.slate, C.steel, C.mist];
const DARK: Ramp = [C.ink, C.ink, C.night, C.slate];
const GOLD: Ramp = [C.e3, C.e4, C.e5, C.e6];
const RED: Ramp = [C.r1, C.r2, C.r3, C.r4];

/** One anatomical model per animal, rotated under the same camera/light as farm livestock. */
export function villageModel(kind: VillageAnimal, frame: number): Prim[] {
  const cat = kind === 'cat',
    dog = kind === 'dog';
  if (cat || dog) {
    const sleep = cat && frame === 3,
      sit = cat ? frame === 0 : frame === 3;
    const walk = frame === 1 || frame === 2;
    const stride = walk ? (frame === 1 ? 1 : -1) : 0;
    const length = cat ? 4.2 : 5.4,
      hip = sleep ? 1.5 : 4.2;
    const p: Prim[] = [rbox([0, 0, hip + 1.3], [length, 1.9, sleep ? 1.5 : 2], 1.2, FUR)];
    for (const a of [-length + 1, length - 1])
      for (const b of [-1.4, 1.4]) {
        const swing = stride * (a * b > 0 ? 1 : -1);
        const z = sit && a < 0 ? 1.2 : 0.6;
        p.push(capsule([a, b, hip], [a + swing, b, z], 0.7, FUR));
        p.push(ellipsoid([a + swing + 0.4, b, z], [1, 0.7, 0.5], cat ? WHITE : DARK));
      }
    const hz = sleep ? 2.5 : sit ? 8 : 7;
    p.push(capsule([length - 1, 0, hip + 1], [length, 0, hz], 1.5, FUR));
    p.push(rbox([length + 0.4, 0, hz], [1.9, 1.7, 1.8], 0.8, FUR));
    p.push(ellipsoid([length + 2, 0, hz - 0.7], [cat ? 0.8 : 1.5, 1.1, 0.8], WHITE));
    p.push(ellipsoid([length + (cat ? 2.6 : 3.4), 0, hz - 0.4], [0.4, 0.5, 0.4], DARK));
    for (const b of [-1.3, 1.3]) {
      p.push(capsule([length, b, hz + 1], [length - 0.4, b * 1.2, hz + (cat ? 3 : -1)], cat ? 0.8 : 1.1, FUR, 0.25));
      if (!sleep) p.push(ellipsoid([length + 1.1, b, hz + 0.4], [0.4, 0.35, 0.4], DARK));
    }
    p.push(capsule([-length, 0, hip + 1], [-length - 2, 0, sleep ? 1.2 : 7 + stride * 0.5], 0.6, FUR, 0.4));
    return p;
  }
  const hen = kind === 'chicken',
    peck = frame === 1;
  const feather = hen ? WHITE : GREY;
  const hz = peck ? 3 : 7;
  const p: Prim[] = [ellipsoid([0, 0, 4], [3.2, 2, 2.4], feather)];
  for (const side of [-1, 1]) {
    const step = frame >= 2 ? (frame === 2 ? 1 : -1) * side : 0;
    p.push(capsule([0, side, 3], [step, side, 0.6], 0.35, hen ? GOLD : RED));
    p.push(capsule([step - 0.4, side, 0.4], [step + 1, side, 0.4], 0.3, GOLD));
    const fly = !hen && frame >= 2;
    p.push(
      ellipsoid([-0.5, side * (fly ? 3 : 1.7), fly ? (frame === 2 ? 7 : 2) : 4], [2.2, fly ? 2 : 0.7, 0.8], feather),
    );
  }
  p.push(capsule([1.5, 0, 4], [2.8, 0, hz], 1, feather));
  p.push(ellipsoid([3, 0, hz], [1.3, 1.2, 1.4], feather));
  p.push(capsule([4, 0, hz], [5, 0, hz - 0.2], 0.6, GOLD, 0.2));
  for (const b of [-1, 1]) p.push(ellipsoid([3.4, b, hz + 0.3], [0.3, 0.3, 0.3], DARK));
  p.push(capsule([-2, 0, 4.5], [-4.2, 0, 6], 1.1, feather, 0.5));
  if (hen) p.push(capsule([2.5, 0, hz + 1.1], [3.5, 0, hz + 1.7], 0.7, RED));
  return p;
}

const cache = new Map<string, Texture>();
const frames = new WeakMap<Texture, { kind: VillageAnimal; frame: number }>();
export function villageTexture(kind: VillageAnimal, frame: number, heading = 0): Texture {
  const key = `${kind}:${frame & 3}:${heading & 3}`;
  let tex = cache.get(key);
  if (!tex) {
    tex = Texture.from(
      renderModel(villageModel(kind, frame & 3), (heading & 3) as Heading, VILLAGE_W, VILLAGE_H, VILLAGE_AX, VILLAGE_AY)
        .canvas,
    );
    tex.source.scaleMode = 'nearest';
    frames.set(tex, { kind, frame: frame & 3 });
    cache.set(key, tex);
  }
  return tex;
}
/** Reorient a legacy ambient frame without changing its action/frame semantics. */
export function faceVillageTexture(tex: Texture, heading: number): Texture | null {
  const info = frames.get(tex);
  return info ? villageTexture(info.kind, info.frame, heading) : null;
}
export function villageHeading(dx: number, dy: number): number {
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 0 : 2) : dy >= 0 ? 1 : 3;
}
