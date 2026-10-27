/**
 * Farm animals, modelled in 3D (voxel.ts) and drawn in the strict 2:1 isometric projection for each heading.
 *
 * Proportions follow classic isometric farm art: a cow is a long, deep box of a body on four straight legs, its head
 * held forward with a pink muzzle; a sheep a cloud of wool on thin dark legs; a horse long-legged with an arched neck,
 * mane and a long tail. Every heading is cut from the same model, so an animal never changes shape as it turns.
 *
 * Frames: 0 standing, 1 grazing (head down), 2 and 3 walking (diagonal legs swinging).
 */
import { Texture } from 'pixi.js';
import { type LivestockSpecies } from '@eigenlands/shared';
import { C } from './shade';
import {
  capsule,
  ellipsoid,
  patchNoise,
  rbox,
  renderModel,
  scaled,
  turn,
  type Heading,
  type Prim,
  type Ramp,
} from './voxel';

/** canvas and anchor (the ground under the animal's middle) shared by every species */
export const LIVESTOCK_W = 80,
  LIVESTOCK_H = 72,
  LIVESTOCK_AX = 40,
  LIVESTOCK_AY = 56;

const HOOF: Ramp = [C.ink, C.night, C.slate, C.steel];
const WHITE: Ramp = [C.mist, C.fog, C.pale, C.white];
const BLACK: Ramp = [C.ink, C.night, C.slate, C.steel];
const PINK: Ramp = [C.r1, C.r2, C.q6, C.r6];
const PIG: Ramp = [C.r1, C.r2, C.r3, C.q6, C.r6];
const WOOL: Ramp = [C.fog, C.pale, C.e7, C.white];
const FACE: Ramp = [C.ink, C.night, C.e1, C.slate];
const CHESTNUT: Ramp = [C.r0, C.r1, C.r2, C.r3, C.r4];
const MANE: Ramp = [C.ink, C.e0, C.e1, C.e2];
const HORN: Ramp = [C.e3, C.e5, C.e6, C.e7];
const GOAT: Ramp = [C.e2, C.e3, C.e4, C.e5, C.e6];
const COMB: Ramp = [C.c0, C.c1, C.c2, C.c2];
const BEAK: Ramp = [C.e4, C.c3, C.c4, C.c4];
const TURKEY: Ramp = [C.e0, C.e1, C.e2, C.e3, C.r2];
const GLIMMER: Ramp = [C.q1, C.q2, C.w3, C.w5, C.q7];
const GLOW: Ramp = [C.w5, C.w6, C.q7, C.white];
const SADDLE: Ramp = [C.e0, C.e1, C.e2, C.e3];
const BLANKET: Ramp = [C.c0, C.c1, C.c2, C.c3];

/** a cow's coat: white with black patches (stable on the model, so the same cow from every side) */
const holstein = (a: number, b: number, z: number): Ramp => (patchNoise(a, b, z, 3) > 0.12 ? BLACK : WHITE);

export type FarmLook = LivestockSpecies | 'turkey';

/** legs: four capsules from the hips to the ground, the diagonal pairs swinging on walking frames */
function legs(
  front: number,
  back: number,
  spread: number,
  hip: number,
  r: number,
  coat: Ramp | Prim['ramp'],
  frame: number,
  hoof = 1.4,
  hoofRamp: Ramp = HOOF,
): Prim[] {
  const out: Prim[] = [];
  for (const [a, b] of [
    [front, spread],
    [front, -spread],
    [back, spread],
    [back, -spread],
  ] as Array<[number, number]>) {
    const pairA = (a === front) === b > 0;
    const swing = frame === 2 ? (pairA ? 1.8 : -1.8) : frame === 3 ? (pairA ? -1.8 : 1.8) : 0;
    const lift = frame >= 2 && swing > 0 ? 0.8 : 0;
    out.push(capsule([a, b, hip], [a + swing, b, hoof + lift], r, coat, r * 0.9));
    out.push(capsule([a + swing, b, hoof + lift], [a + swing, b, 0.6 + lift], r * 0.95, hoofRamp));
  }
  return out;
}

function model(species: FarmLook, frame: number, tack: boolean): Prim[] {
  const graze = frame === 1;
  switch (species) {
    case 'cow': {
      const hz = graze ? 7 : 13;
      return [
        ...legs(6.5, -6.5, 2.6, 9, 1.3, WHITE, frame),
        rbox([0, 0, 12.5], [10, 4.6, 4.4], 2.6, holstein),
        ellipsoid([-3, 0, 7.6], [2.2, 1.8, 1.3], PINK), // udder
        capsule([8.5, 0, 14], [11.4, 0, hz + 1], 3, holstein, 2.7, true),
        rbox([13.2, 0, hz], [3.2, 2.8, 3], 1.4, (a, b, z) => (patchNoise(a, b, z, 9) > 0.35 ? BLACK : WHITE), true),
        rbox([16.2, 0, hz - 1.4], [1.5, 2.4, 1.7], 0.9, PINK, true),
        ellipsoid([17.4, 1, hz - 1.4], [0.3, 0.35, 0.4], [C.r0, C.r0, C.r0, C.r0], true),
        ellipsoid([17.4, -1, hz - 1.4], [0.3, 0.35, 0.4], [C.r0, C.r0, C.r0, C.r0], true),
        rbox([11.8, 3.9, hz + 1.8], [0.9, 1.5, 0.6], 0.3, BLACK, true), // ears
        rbox([11.8, -3.9, hz + 1.8], [0.9, 1.5, 0.6], 0.3, BLACK, true),
        capsule([12.4, 1.8, hz + 2.8], [11.8, 2.8, hz + 4.6], 0.55, HORN, 0.4, true),
        capsule([12.4, -1.8, hz + 2.8], [11.8, -2.8, hz + 4.6], 0.55, HORN, 0.4, true),
        ellipsoid([14.8, 2.3, hz + 1], [0.55, 0.45, 0.6], BLACK, true), // eyes
        ellipsoid([14.8, -2.3, hz + 1], [0.55, 0.45, 0.6], BLACK, true),
        capsule([-10, 0, 15], [-11.2, 0, 8.5], 0.55, WHITE),
        ellipsoid([-11.3, 0, 7.8], [0.9, 0.9, 1.4], BLACK),
      ];
    }
    case 'sheep': {
      const hz = graze ? 6 : 11;
      const wool: Prim[] = [];
      // a cloud of wool: overlapping puffs round the body
      for (const [a, b, z, r] of [
        [-5, 0, 11, 4.4],
        [0, 0, 12, 4.8],
        [5, 0, 11.4, 4.4],
        [-3, 2.4, 9.6, 3.4],
        [-3, -2.4, 9.6, 3.4],
        [3, 2.6, 9.8, 3.4],
        [3, -2.6, 9.8, 3.4],
        [0, 0, 15, 3],
        [-6.5, 0, 9, 3],
      ] as Array<[number, number, number, number]>)
        wool.push(ellipsoid([a, b, z], [r, r * 0.95, r * 0.9], WOOL));
      return [
        ...legs(4.6, -4.6, 2.1, 7, 0.85, FACE, frame, 1),
        ...wool,
        rbox([9, 0, hz], [2.3, 1.8, 2.2], 1.1, FACE, true),
        ellipsoid([8.2, 0, hz + 2.2], [2, 2.2, 1.4], WOOL, true), // woolly cap
        rbox([8.4, 2.6, hz + 0.6], [0.6, 1.2, 0.4], 0.3, FACE, true),
        rbox([8.4, -2.6, hz + 0.6], [0.6, 1.2, 0.4], 0.3, FACE, true),
        ellipsoid([10.4, 1.3, hz + 0.6], [0.35, 0.3, 0.35], [C.pale, C.white, C.white, C.white], true),
        ellipsoid([10.4, -1.3, hz + 0.6], [0.35, 0.3, 0.35], [C.pale, C.white, C.white, C.white], true),
      ];
    }
    case 'pig': {
      const hz = graze ? 5 : 8;
      return [
        ...legs(4.6, -4.6, 2.3, 5, 1.1, PIG, frame, 1),
        ellipsoid([0, 0, 8.2], [8.6, 4.6, 4.4], PIG),
        ellipsoid([8.2, 0, hz], [2.8, 3.2, 3], PIG, true),
        capsule([10.6, 0, hz - 0.6], [11.6, 0, hz - 0.6], 1.7, PINK, 1.7, true),
        ellipsoid([12.1, 0.6, hz - 0.5], [0.3, 0.3, 0.4], [C.r0, C.r0, C.r0, C.r0], true),
        ellipsoid([12.1, -0.6, hz - 0.5], [0.3, 0.3, 0.4], [C.r0, C.r0, C.r0, C.r0], true),
        capsule([7.8, 2.4, hz + 2.4], [9.6, 2.8, hz + 2], 0.9, PIG, 0.3, true), // ears
        capsule([7.8, -2.4, hz + 2.4], [9.6, -2.8, hz + 2], 0.9, PIG, 0.3, true),
        ellipsoid([9.9, 1.7, hz + 0.9], [0.35, 0.35, 0.35], BLACK, true),
        ellipsoid([9.9, -1.7, hz + 0.9], [0.35, 0.35, 0.35], BLACK, true),
        capsule([-8.4, 0, 9.4], [-9.6, 0.8, 10.8], 0.5, PIG), // curled tail
        capsule([-9.6, 0.8, 10.8], [-9.2, -0.4, 11.6], 0.5, PIG),
      ];
    }
    case 'goat': {
      const hz = graze ? 7 : 13;
      return [
        ...legs(5, -5, 2, 7.5, 0.9, GOAT, frame, 1.2),
        rbox([0, 0, 10.4], [7.4, 3.4, 3.4], 2, GOAT),
        capsule([6.4, 0, 12], [8.6, 0, hz], 2, GOAT, 1.8, true),
        rbox([10, 0, hz], [2.2, 1.6, 1.8], 1, GOAT, true),
        capsule([10.6, 0, hz - 1.6], [10.4, 0, hz - 3.6], 0.6, [C.e1, C.e2, C.e3, C.e4], 0.3, true), // beard
        capsule([9.2, 0.9, hz + 1.6], [7.4, 1.4, hz + 4.2], 0.55, HORN, 0.35, true),
        capsule([9.2, -0.9, hz + 1.6], [7.4, -1.4, hz + 4.2], 0.55, HORN, 0.35, true),
        rbox([8.8, 2.3, hz + 0.6], [0.6, 1, 0.4], 0.3, GOAT, true),
        rbox([8.8, -2.3, hz + 0.6], [0.6, 1, 0.4], 0.3, GOAT, true),
        ellipsoid([11, 1.2, hz + 0.8], [0.35, 0.3, 0.35], BLACK, true),
        ellipsoid([11, -1.2, hz + 0.8], [0.35, 0.3, 0.35], BLACK, true),
        capsule([-7, 0, 12.6], [-8, 0, 14.4], 0.7, GOAT),
      ];
    }
    case 'horse':
    case 'phasehart': {
      const magic = species === 'phasehart';
      const coat = magic ? GLIMMER : CHESTNUT;
      const hz = graze ? 9 : 25.5;
      const neckTop: [number, number, number] = graze ? [13, 0, 12] : [12.6, 0, 23.4];
      const prims: Prim[] = [
        ...legs(7, -7, 2.3, 12, 1.25, coat, frame, 1.6),
        rbox([0, 0, 15.6], [10.4, 3.8, 3.9], 3, coat),
        capsule([7.6, 0, 17], neckTop, 3, coat, 2.3, true),
        capsule([neckTop[0] + 0.4, 0, hz], [neckTop[0] + 5.2, 0, hz - 4.6], 2.4, coat, 1.7, true),
        ellipsoid([neckTop[0] + 5.6, 0, hz - 5], [1.9, 1.7, 1.6], magic ? GLOW : [C.r0, C.r1, C.r2, C.r2], true),
        ellipsoid([neckTop[0] + 6.8, 0.8, hz - 4.6], [0.3, 0.3, 0.3], BLACK, true),
        ellipsoid([neckTop[0] + 6.8, -0.8, hz - 4.6], [0.3, 0.3, 0.3], BLACK, true),
        ellipsoid([neckTop[0] + 1.8, 1.9, hz - 0.4], [0.5, 0.4, 0.5], BLACK, true),
        ellipsoid([neckTop[0] + 1.8, -1.9, hz - 0.4], [0.5, 0.4, 0.5], BLACK, true),
        capsule([neckTop[0], 1, hz + 2], [neckTop[0] - 0.4, 1.2, hz + 3.8], 0.5, coat, 0.3, true), // ears
        capsule([neckTop[0], -1, hz + 2], [neckTop[0] - 0.4, -1.2, hz + 3.8], 0.5, coat, 0.3, true),
        // mane along the crest of the neck, and a long tail
        capsule([7, 0, 20.4], [neckTop[0] - 0.8, 0, neckTop[2] + 2.4], 1.2, magic ? GLOW : MANE, 1.1, true),
        capsule([neckTop[0] + 0.4, 0, hz + 2.2], [neckTop[0] + 1.6, 0, hz + 1.4], 0.8, magic ? GLOW : MANE, 0.6, true), // forelock
        capsule([-10.2, 0, 17.6], [-12, 0, 10], 1.2, magic ? GLOW : MANE, 0.9),
      ];
      if (magic)
        for (const s of [1, -1]) {
          prims.push(
            capsule([neckTop[0], 0.8 * s, hz + 2.4], [neckTop[0] - 1, 2.4 * s, hz + 6], 0.45, GLOW, 0.35, true),
          );
          prims.push(
            capsule([neckTop[0] - 1, 2.4 * s, hz + 6], [neckTop[0] - 2.6, 3.4 * s, hz + 8], 0.35, GLOW, 0.3, true),
          );
        }
      if (tack) {
        prims.push(rbox([-0.6, 0, 19.2], [3.4, 4.2, 0.7], 0.4, BLANKET)); // saddle cloth
        prims.push(rbox([-0.6, 0, 20.2], [2.4, 3, 0.8], 0.6, SADDLE)); // seat
        prims.push(rbox([1.6, 0, 21.2], [0.6, 1.4, 0.8], 0.4, SADDLE)); // pommel
        prims.push(capsule([neckTop[0] + 3, 1.6, hz - 1.6], [7.6, 1.8, 19], 0.25, SADDLE, 0.25, true)); // reins
        prims.push(capsule([neckTop[0] + 3, -1.6, hz - 1.6], [7.6, -1.8, 19], 0.25, SADDLE, 0.25, true));
      }
      return prims;
    }
    case 'chicken': {
      const hz = graze ? 4.4 : 8;
      // (drawn at 1.4× below)
      return [
        capsule([0.6, 0.9, 3], [0.6, 0.9, 0.3], 0.35, BEAK),
        capsule([0.6, -0.9, 3], [0.6, -0.9, 0.3], 0.35, BEAK),
        ellipsoid([0, 0, 4.6], [3, 2.4, 2.4], WHITE),
        ellipsoid([-2.6, 0, 6.2], [1.4, 1.4, 2], WHITE), // tail
        ellipsoid([2.2, 0, hz], [1.5, 1.3, 1.6], WHITE),
        ellipsoid([2, 0, hz + 1.8], [1, 0.4, 0.8], COMB),
        ellipsoid([3.5, 0, hz - 0.3], [0.7, 0.4, 0.4], BEAK),
        ellipsoid([3.1, 0, hz - 1.3], [0.4, 0.35, 0.6], COMB),
        ellipsoid([2.9, 0.8, hz + 0.3], [0.3, 0.25, 0.3], BLACK),
        ellipsoid([2.9, -0.8, hz + 0.3], [0.3, 0.25, 0.3], BLACK),
      ];
    }
    case 'turkey': {
      const hz = graze ? 5 : 10;
      // the fanned tail: a half-disc of feathers with pale tips
      const fan = (a: number, b: number, z: number): Ramp =>
        Math.hypot(b, z - 8) > 4.3
          ? [C.e4, C.e5, C.e6, C.e7]
          : Math.hypot(b, z - 8) > 3.5
            ? [C.e0, C.e1, C.e1, C.e2]
            : TURKEY;
      return [
        capsule([0.6, 1, 3.4], [0.6, 1, 0.3], 0.4, BEAK),
        capsule([0.6, -1, 3.4], [0.6, -1, 0.3], 0.4, BEAK),
        ellipsoid([0, 0, 5.6], [3.6, 3, 3], TURKEY),
        ellipsoid([-3.2, 0, 8], [0.9, 5, 5], fan),
        capsule([2.4, 0, 7], [3.2, 0, hz], 0.9, [C.w3, C.w4, C.q6, C.q6]),
        ellipsoid([3.4, 0, hz + 0.4], [1, 0.8, 0.9], [C.w3, C.w4, C.q6, C.q6]),
        ellipsoid([4.4, 0, hz + 0.2], [0.6, 0.3, 0.3], BEAK),
        capsule([4, 0, hz - 0.2], [4.2, 0, hz - 2], 0.4, COMB), // wattle
        ellipsoid([3.6, 0.7, hz + 0.6], [0.25, 0.2, 0.25], BLACK),
        ellipsoid([3.6, -0.7, hz + 0.6], [0.25, 0.2, 0.25], BLACK),
      ];
    }
  }
  return [];
}

/** where a rider sits on a saddled horse, in model space */
const SADDLE_POINT: [number, number, number] = [-0.6, 0, 20.6];

const canvases = new Map<string, { body: HTMLCanvasElement; front: HTMLCanvasElement | null }>();
function render(species: FarmLook, frame: number, facing: number, tack: boolean) {
  const key = `${species}:${frame}:${facing}:${tack ? 1 : 0}`;
  let r = canvases.get(key);
  if (!r) {
    const h = (facing & 3) as Heading;
    const [u, v] = turn(h, SADDLE_POINT[0], SADDLE_POINT[1]);
    const prims = model(species, frame, tack);
    const out = renderModel(
      species === 'chicken' ? scaled(prims, 1.5) : species === 'turkey' ? scaled(prims, 1.35) : prims,
      h,
      LIVESTOCK_W,
      LIVESTOCK_H,
      LIVESTOCK_AX,
      LIVESTOCK_AY,
      tack ? u + v + SADDLE_POINT[2] + 1 : undefined,
    );
    r = { body: out.canvas, front: out.front };
    canvases.set(key, r);
  }
  return r;
}

/** facing: 0 SE, 1 SW, 2 NW, 3 NE (screen headings) */
export function livestockCanvas(species: FarmLook, frame = 0, facing = 0): HTMLCanvasElement {
  return render(species, frame, facing, false).body;
}

const textures = new Map<string, Texture>();
const texOf = (key: string, c: HTMLCanvasElement): Texture => {
  let t = textures.get(key);
  if (!t) {
    t = Texture.from(c);
    t.source.scaleMode = 'nearest';
    textures.set(key, t);
  }
  return t;
};
export function livestockTexture(species: FarmLook, frame = 0, facing = 0): Texture {
  return texOf(`${species}:${frame}:${facing}`, livestockCanvas(species, frame, facing));
}

/**
 * A saddled horse (or the Glimmerhart) for riding: the body, a front layer (neck and head when they face the
 * camera, drawn over the rider), and where the rider's hips sit relative to the anchor, in art pixels.
 */
export function saddledTexture(
  species: 'horse' | 'phasehart',
  frame: number,
  facing: number,
): { body: Texture; front: Texture | null; seat: { x: number; y: number } } {
  const r = render(species, frame, facing, true);
  const [u, v] = turn((facing & 3) as Heading, SADDLE_POINT[0], SADDLE_POINT[1]);
  return {
    body: texOf(`s:${species}:${frame}:${facing}`, r.body),
    front: r.front ? texOf(`sf:${species}:${frame}:${facing}`, r.front) : null,
    seat: { x: u - v, y: (u + v) / 2 - SADDLE_POINT[2] },
  };
}

export function livestockPortrait(species: LivestockSpecies): string {
  return livestockCanvas(species).toDataURL();
}
