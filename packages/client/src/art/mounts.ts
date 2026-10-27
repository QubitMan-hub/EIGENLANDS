/**
 * Riding mounts (master plan §14): a saddled horse and the Moonlit Stag, modelled in the game's 2:1 iso space like the
 * livestock (ray-traced ellipsoid bodies, box legs) but built for each of the four screen headings, so light always
 * comes from the upper left. Frame 0 stands; frames 1-4 are a gallop with the legs in a rotary gather and a body bob.
 *
 * Model space: a runs from tail to nose, b across the body, z up; (8, 8, 0) is the anchor between the hooves.
 */
import { Texture } from 'pixi.js';
import { Iso, type BoxMat, mat } from './isokit';
import { C, makeCanvas, outline, put } from './shade';

export type MountKind = 'horse' | 'stag' | 'griffin';
/** heading index: 0 SE (+u), 1 SW (+v), 2 NW (-u), 3 NE (-v) */
export type MountDir = 0 | 1 | 2 | 3;
export const MOUNT_FRAMES = 5;
/** how high the rider's hips sit above the ground, in art pixels */
export const SADDLE_Z = 14;
/** how high a griffin carries its rider above its shadow, in art pixels */
export const FLY_Z = 18;

const W = 72,
  H = 64,
  OX = 36,
  OY = 44; // Iso origin: the anchor (u = v = 8) lands at (OX, OY + 8)
export const MOUNT_AX = OX,
  MOUNT_AY = OY + 8;

interface Look {
  coat: number[];
  dark: number[];
  hoof: number[];
  saddle: number[];
  cloth: number[];
}
const LOOKS: Record<MountKind, Look> = {
  horse: {
    coat: [C.e0, C.e1, C.e2, C.e3, C.e4],
    dark: [C.ink, C.night, C.e0, C.e1],
    hoof: [C.ink, C.night, C.slate, C.steel],
    saddle: [C.e0, C.e1, C.r1, C.r2, C.r3],
    cloth: [C.b0, C.b0, C.b1, C.w6, C.pale],
  },
  stag: {
    coat: [C.night, C.slate, C.steel, C.mist, C.fog, C.pale],
    dark: [C.q1, C.q2, C.q3, C.q4],
    hoof: [C.ink, C.night, C.q2, C.q3],
    saddle: [C.night, C.q1, C.q2, C.q3, C.q4],
    cloth: [C.q2, C.q3, C.q4, C.q5, C.q6],
  },
  griffin: {
    coat: [C.e1, C.e2, C.e3, C.e4, C.e5, C.e6],
    dark: [C.mist, C.fog, C.pale, C.white],
    hoof: [C.e3, C.e4, C.e5, C.e6],
    saddle: [C.e0, C.c0, C.c1, C.c2, C.c3],
    cloth: [C.b0, C.b0, C.b1, C.w6, C.pale],
  },
};

type Part = { depth: number; draw: () => void };

function mountCanvas(kind: MountKind, dir: MountDir, frame: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(W, H);
  const iso = new Iso(ctx, OX, OY);
  const L = LOOKS[kind],
    stag = kind === 'stag';
  // model (a, b) -> world (u, v); swap tells whether a runs along v
  const swap = dir === 1 || dir === 3;
  const uv = (a: number, b: number): [number, number] =>
    dir === 0 ? [a, b] : dir === 1 ? [b, a] : dir === 2 ? [16 - a, b] : [b, 16 - a];
  const parts: Part[] = [];
  const depthOf = (a: number, b: number, z = 0) => {
    const [u, v] = uv(a, b);
    return u + v + z * 0.01;
  };
  /** an axis-aligned box in model space */
  const box = (a0: number, b0: number, z0: number, da: number, db: number, dz: number, m: BoxMat) => {
    const [u1, v1] = uv(a0, b0),
      [u2, v2] = uv(a0 + da, b0 + db);
    const u0 = Math.min(u1, u2),
      v0 = Math.min(v1, v2);
    parts.push({
      depth: depthOf(a0 + da / 2, b0 + db / 2, z0),
      draw: () => iso.box(u0, v0, z0, Math.abs(u2 - u1), Math.abs(v2 - v1), dz, m),
    });
  };
  /** a ray-traced ellipsoid (centre and radii in model space) */
  const ell = (a: number, b: number, z: number, ra: number, rb: number, rz: number, ramp: number[], spots = false) => {
    const [cu, cv] = uv(a, b);
    const [ru, rv] = swap ? [rb, ra] : [ra, rb];
    parts.push({
      depth: depthOf(a, b, z),
      draw: () => {
        const sx = OX + cu - cv,
          sy = OY + (cu + cv) / 2 - z;
        const xx = ru + rv,
          yy = (ru + rv) / 2 + rz;
        const A = 1 / (ru * ru) + 1 / (rv * rv) + 1 / (rz * rz);
        for (let py = Math.floor(sy - yy); py <= Math.ceil(sy + yy); py++)
          for (let px = Math.floor(sx - xx); px <= Math.ceil(sx + xx); px++) {
            const dx = px + 0.5 - OX,
              dy = py + 0.5 - OY,
              u = dx / 2 + dy - cu,
              v = dy - dx / 2 - cv;
            const B = 2 * (u / (ru * ru) + v / (rv * rv) - z / (rz * rz)),
              D = B * B - 4 * A * ((u * u) / (ru * ru) + (v * v) / (rv * rv) + (z * z) / (rz * rz) - 1);
            if (D < 0) continue;
            const t = (-B + Math.sqrt(D)) / (2 * A),
              nx = (u + t) / (ru * ru),
              ny = (v + t) / (rv * rv),
              nz = (t - z) / (rz * rz),
              len = Math.hypot(nx, ny, nz);
            const light = 0.5 + ((-nx * 0.3 + ny * 0.25 + nz * 0.8) / len) * 0.45;
            let c = ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(light * ramp.length)))]!;
            if (spots && ((Math.floor((u + t) * 0.9) + Math.floor((v + t) * 0.9)) & 3) === 0 && nz > 0.1) c = C.w6;
            put(ctx, px, py, c);
          }
      },
    });
  };

  if (kind === 'griffin') {
    drawGriffin(L, frame, box, ell);
    parts.sort((p, q) => p.depth - q.depth);
    for (const p of parts) p.draw();
    const [eu, ev] = uv(17.6, 9);
    put(ctx, Math.floor(OX + eu - ev), Math.floor(OY + (eu + ev) / 2 - 19.4), C.ink);
    outline(ctx, W, H, C.night);
    return canvas;
  }
  const gallop = frame > 0;
  const k = (frame - 1) / 4; // 0..0.75 through the stride
  const bob = gallop ? [0, 1, 0, -0.5][frame - 1]! : 0;
  const coat = mat(L.coat),
    hoof = mat(L.hoof);
  // legs: rotary gallop, each leg a quarter of a stride behind the last
  const legs: Array<[number, number, number]> = [
    [3.4, 6.4, 0],
    [3.4, 9.6, 0.25],
    [12.6, 6.4, 0.5],
    [12.6, 9.6, 0.75],
  ];
  for (const [a, b, ph] of legs) {
    const s = Math.sin((k + ph) * Math.PI * 2);
    const da = gallop ? s * 2.2 : 0,
      lift = gallop ? Math.max(0, Math.cos((k + ph) * Math.PI * 2)) * 2.5 : 0;
    const len = stag ? 11 : 10.5;
    box(a + da - 0.6, b - 0.55, lift, 1.3, 1.1, 1.5, hoof);
    box(a + da * 0.6 - 0.6, b - 0.55, lift + 1.5, 1.2, 1.1, len - lift - 1.5 + bob, coat);
  }
  const z = (stag ? 12 : 11.5) + bob;
  // tail
  if (stag) ell(0.8, 8, z + 2, 1.2, 1, 1.2, [C.fog, C.pale, C.white]);
  else {
    ell(0.4, 8, z + 0.6, 1.2, 0.9, 1.8, L.dark);
    ell(-0.6, 8, z - 2.4 + (gallop ? 1 : 0), 1, 0.8, 2.4, L.dark);
  }
  // rump, barrel and chest: a slimmer body than the farm stock
  ell(3.4, 8, z + 0.9, 3.1, 2.7, 3.1, L.coat, stag);
  ell(8, 8, z + 0.5, 6, 2.6, 2.9, L.coat, stag);
  ell(12.4, 8, z + 1.1, 2.9, 2.5, 3.2, L.coat, stag);
  // saddle cloth and saddle
  box(5.6, 5.1, z + 2.6, 5.6, 5.8, 1.2, mat(L.cloth));
  box(6.3, 5.7, z + 3.8, 4.2, 4.6, 0.9, mat(L.saddle));
  box(9.6, 6.6, z + 4.5, 1, 2.8, 1.5, mat(L.saddle));
  // neck rising to a long head
  const lift = gallop ? [0, -0.6, 0, 0.6][frame - 1]! : 0;
  ell(14.2, 8, z + 3.8 + lift, 2.1, 1.7, 3, L.coat);
  ell(15.6, 8, z + 7 + lift, 1.8, 1.5, 2.8, L.coat);
  ell(16.8, 8, z + 9.8 + lift, 1.7, 1.4, 2, L.coat);
  ell(18.4, 8, z + 9.6 + lift, 2.4, 1.3, 1.4, L.coat);
  ell(19.9, 8, z + 8.9 + lift, 1.3, 1.1, 1.1, L.coat);
  if (!stag) {
    // mane along the neck crest, a forelock and ears
    for (let i = 0; i < 5; i++) ell(13.4 + i * 0.85, 8, z + 5.6 + i * 1.3 + lift, 0.9, 0.6, 1.1, L.dark);
    box(16.4, 7.3, z + 11.3 + lift, 0.7, 0.5, 1.7, mat(L.coat));
    box(16.4, 8.3, z + 11.3 + lift, 0.7, 0.5, 1.7, mat(L.coat));
    box(19.2, 7.6, z + 8.4 + lift, 0.6, 0.8, 0.6, mat(L.dark)); // bridle noseband
  } else {
    // the Stag's antlers: spreading, branching tines of moonlight
    const tine = mat([C.t1, C.t2, C.w6, C.pale, C.white]);
    for (const side of [-1, 1]) {
      const b = 8 + side * 0.8;
      box(16.4, b - 0.3, z + 11.2 + lift, 0.6, 0.6, 2.4, tine);
      box(16, b - 0.3 + side * 1, z + 13.4 + lift, 0.6, 0.6, 2.2, tine);
      box(15.4, b - 0.3 + side * 2, z + 15.2 + lift, 0.6, 0.6, 2.2, tine);
      box(16.6, b - 0.3 + side * 2.4, z + 15.8 + lift, 0.6, 0.6, 1.6, tine);
      box(14.8, b - 0.3 + side * 2.8, z + 17 + lift, 0.6, 0.6, 1.4, tine);
    }
  }
  parts.sort((p, q) => p.depth - q.depth);
  for (const p of parts) p.draw();
  // the eye, on the near side
  const [eu, ev] = uv(18.2, 9.2);
  put(ctx, Math.floor(OX + eu - ev), Math.floor(OY + (eu + ev) / 2 - (z + 10.2 + lift)), C.ink);
  outline(ctx, W, H, C.night);
  return canvas;
}

type BoxFn = (a0: number, b0: number, z0: number, da: number, db: number, dz: number, m: BoxMat) => void;
type EllFn = (a: number, b: number, z: number, ra: number, rb: number, rz: number, ramp: number[]) => void;

/**
 * The griffin, always on the wing: a lion's tawny hindquarters with a tufted tail, an eagle's white breast, head and
 * gold beak, talons and hind paws tucked under, and two broad wings whose feathers fan up and down over four frames
 * (frame 0 glides with them level).
 */
function drawGriffin(L: Look, frame: number, box: BoxFn, ell: EllFn): void {
  const bob = [0, 0.6, 1, 0.4, -0.3][frame] ?? 0;
  const z = 11.5 + bob;
  const coat = mat(L.coat),
    talon = mat(L.hoof),
    plume = L.dark;
  // tucked legs: hind paws back, talons forward
  for (const b of [6.6, 8.6]) {
    box(1.6, b, z - 4.2, 2.6, 1, 2.4, coat);
    box(12.6, b, z - 4.4, 1.2, 1, 3, talon);
  }
  // lion tail with a dark tuft
  ell(1, 8, z + 0.2, 1, 0.8, 0.9, L.coat);
  ell(-0.6, 8, z - 1.2, 0.9, 0.7, 1, L.coat);
  ell(-1.8, 8, z - 2.6, 1, 0.9, 1, [C.e0, C.e1, C.e2]);
  // body: tawny rear, feathered white breast
  ell(3.6, 8, z + 0.3, 3, 2.6, 2.8, L.coat);
  ell(8, 8, z + 0.6, 5.4, 2.6, 2.8, L.coat);
  ell(12.6, 8, z + 1.4, 3, 2.7, 3.2, plume);
  // saddle cloth and saddle
  box(5.8, 5.2, z + 2.5, 5.2, 5.6, 1.1, mat(L.cloth));
  box(6.4, 5.8, z + 3.6, 4, 4.4, 0.9, mat(L.saddle));
  // neck, eagle head, ear tufts and hooked gold beak
  ell(14.8, 8, z + 4.6, 2.1, 1.9, 2.8, plume);
  ell(17, 8, z + 7.4, 2.6, 2, 2.2, plume);
  ell(19.6, 8, z + 6.8, 1.6, 1, 1.1, [C.c2, C.c3, C.c4, C.e7]);
  box(20.4, 7.6, z + 5.4, 0.8, 0.8, 1.2, mat([C.c1, C.c2, C.c3]));
  for (const b of [6.8, 8.7]) box(15.9, b, z + 9.2, 0.7, 0.6, 2.2, mat([C.e1, C.e2, C.e3, C.e4]));
  // wings: five feather slabs from the shoulder out, each a little shorter, raised by the flap angle
  const angle = [0, -0.35, 0.45, 0.95, 0.4][frame] ?? 0;
  // brown coverts near the body, banded flight feathers further out, pale tips at the ends
  const inner = [C.e0, C.e1, C.e2, C.e3, C.e4],
    flight = [C.e1, C.e2, C.e3, C.e4, C.e5],
    tips = [C.e3, C.e5, C.fog, C.pale, C.white];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const out = 2.4 + i * 1.9 * Math.cos(angle),
        up = i * 1.9 * Math.sin(angle);
      const chord = 6.6 - i * 0.8;
      const b0 = side > 0 ? 8 + out : 8 - out - 1.9;
      const ramp = i < 2 ? inner : i < 4 ? flight : tips;
      box(6.4 + i * 0.6, b0, z + 3.2 + up, chord, 1.9, 0.8, {
        ...mat(ramp),
        top: (s2: number) => (s2 < 0.18 ? ramp[ramp.length - 1]! : ((s2 * 5) | 0) % 2 ? ramp[2]! : ramp[3]!),
      });
    }
  }
}

const cache = new Map<string, { tex: Texture; ax: number; ay: number }>();
export function mountSprite(kind: MountKind, dir: MountDir, frame: number): { tex: Texture; ax: number; ay: number } {
  const key = `${kind}:${dir}:${frame}`;
  let s = cache.get(key);
  if (!s) {
    const tex = Texture.from(mountCanvas(kind, dir, frame));
    tex.source.scaleMode = 'nearest';
    s = { tex, ax: MOUNT_AX, ay: MOUNT_AY };
    cache.set(key, s);
  }
  return s;
}

/** Heading index for a world-space facing: the four iso diagonals. */
export function mountDir(fx: number, fy: number): MountDir {
  if (Math.abs(fx) >= Math.abs(fy)) return fx >= 0 ? 0 : 2;
  return fy >= 0 ? 1 : 3;
}
