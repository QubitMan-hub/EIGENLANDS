import { Iso } from './isokit';
import { C, blob, hash2, line, makeCanvas, poly, put, type Ctx, type Ramp } from './shade';

/**
 * Undercroft 2 minerals and floor finds. Ore is never a bevelled stripe: it is nuggets, flecks and thin fissure
 * threads set INTO the cave rock on its top and both side faces, each nugget lit from the top-left with a dark
 * pocket around it, so a vein reads as part of the wall. Glowing kinds (silver, gold, crystal, geode) add a lit rim.
 */

interface Seam {
  /** core, mid, lit, glint, pocket (dark socket around the nugget) */
  ramp: readonly [number, number, number, number, number];
  /** nuggets per face, [min, max] */
  count: [number, number];
  /** nugget radius range in pixels */
  radius: [number, number];
  /** share of nuggets that get a bright glint pixel */
  glint: number;
  /** thin ore thread length between nuggets, 0 = none */
  thread: number;
}

const SEAMS: Record<string, Seam> = {
  cave_coal: {
    ramp: [C.ink, C.night, C.steel, C.pale, C.ink],
    count: [5, 7],
    radius: [1.4, 2.8],
    glint: 0.5,
    thread: 1,
  },
  cave_copper: { ramp: [C.r1, C.r3, C.e5, C.e6, C.night], count: [4, 6], radius: [1.3, 2.4], glint: 0.35, thread: 1 },
  cave_iron: {
    ramp: [C.e1, C.e2, C.steel, C.mist, C.night],
    count: [4, 6],
    radius: [1.4, 2.6],
    glint: 0.25,
    thread: 1,
  },
  cave_silver: {
    ramp: [C.slate, C.mist, C.pale, C.white, C.night],
    count: [3, 5],
    radius: [1.2, 2.2],
    glint: 0.7,
    thread: 1,
  },
  cave_gold: { ramp: [C.e4, C.e6, C.e7, C.white, C.night], count: [3, 5], radius: [1.2, 2.3], glint: 0.8, thread: 1 },
  cave_crystal: { ramp: [C.q2, C.q4, C.q6, C.white, C.night], count: [2, 3], radius: [2, 3.2], glint: 1, thread: 0 },
  cave_geode: { ramp: [C.q3, C.q5, C.q6, C.white, C.night], count: [1, 1], radius: [4.4, 5.2], glint: 1, thread: 0 },
};

const ROCK: Ramp = [C.ink, C.night, C.slate, C.steel, C.mist];

/** 2D coordinates on one cube face: x across, y down the face (top: depth). */
const faceXY = (face: number, s: number, t: number): [number, number] =>
  face === 0 ? [s * 16, t * 16] : [s * 16, (1 - t) * 13];

function nuggetsFor(
  kind: string,
  variant: number,
  face: number,
): Array<{ x: number; y: number; r: number; g: boolean }> {
  const seam = SEAMS[kind]!;
  const h = (i: number, k: number) => hash2(variant * 31 + face * 7 + kind.length, i, k, 4410);
  const n = seam.count[0] + Math.floor(h(0, 0) * (seam.count[1] - seam.count[0] + 1));
  const out: Array<{ x: number; y: number; r: number; g: boolean }> = [];
  // march a gently bending vein across the face so nuggets sit along a believable seam
  const a = h(1, 1) * Math.PI;
  const cx = 8,
    cy = face === 0 ? 8 : 6.5;
  for (let i = 0; i < n; i++) {
    const along = (i / Math.max(1, n - 1) - 0.5) * 17 + (h(i, 2) - 0.5) * 2;
    const off = Math.sin(along * 0.5 + variant) * 1.6 + (h(i, 3) - 0.5) * 3.4;
    const x = cx + Math.cos(a) * along - Math.sin(a) * off,
      y = cy + Math.sin(a) * along * 0.7 + Math.cos(a) * off * 0.7;
    if (x < 0.5 || x > 15.5 || y < 0.5 || y > (face === 0 ? 15.5 : 12.5)) continue;
    out.push({
      x,
      y,
      r: seam.radius[0] + h(i, 4) * (seam.radius[1] - seam.radius[0]),
      g: h(i, 5) < seam.glint,
    });
  }
  return out;
}

function paintFace(kind: string, variant: number, frame: number, face: number) {
  const seam = SEAMS[kind]!;
  const nuggets = nuggetsFor(kind, variant, face);
  const glows = kind === 'cave_crystal' || kind === 'cave_geode';
  return (s: number, t: number): number => {
    const [fx, fy] = faceXY(face, s, t);
    const level = face === 0 ? 3 : face === 1 ? 2 : 1;
    void level;
    // Rock is left transparent: the terrain shader already paints the wall block in this biome's own stone, so a vein
    // only adds what is embedded in it (nuggets, their dark sockets and fissure threads).
    let c = -1;
    // fissure threads between neighbouring nuggets
    if (seam.thread)
      for (let i = 1; i < nuggets.length; i++) {
        const p = nuggets[i - 1]!,
          q = nuggets[i]!;
        const dx = q.x - p.x,
          dy = q.y - p.y,
          len2 = dx * dx + dy * dy || 1;
        const k = Math.max(0, Math.min(1, ((fx - p.x) * dx + (fy - p.y) * dy) / len2));
        const d = Math.hypot(fx - (p.x + dx * k), fy - (p.y + dy * k));
        if (d < 0.5 && (Math.floor(k * 9) + variant) % 3) c = seam.ramp[4];
      }
    for (const n of nuggets) {
      const dx = fx - n.x,
        dy = fy - n.y,
        // slightly irregular rock-pocket shape rather than a perfect disc
        wob = 1 + Math.sin(Math.atan2(dy, dx) * 3 + n.x) * 0.22,
        d = Math.hypot(dx, dy) / (n.r * wob);
      if (d > 1.32) continue;
      if (d > 1) {
        c = seam.ramp[4];
        continue;
      }
      // lit from the top-left: lighter toward -x/-y
      const lit = 0.5 - (dx + dy * 0.8) / (n.r * 2.4) - d * 0.25;
      let i = lit > 0.62 ? 2 : lit > 0.34 ? 1 : 0;
      if (n.g && lit > 0.56 && d < 0.65) i = 3;
      if (glows && (frame + Math.floor(n.x + n.y)) % 3 === 0 && d < 0.5) i = 3;
      c = seam.ramp[i]!;
    }
    return c;
  };
}

/** A quarried wall block (36x44, anchor 18,34) with a believable vein embedded in all three faces. */
export function caveOreBlock(kind: string, variant: number, frame: number, mask = 3): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(36, 44),
    p = new Iso(ctx, 18, 26);
  p.box(0, 0, 0, 16, 16, 13, {
    top: paintFace(kind, variant, frame, 0),
    // a face buried against more rock is never drawn, so a vein cannot show through the wall in front of it
    left: mask & 1 ? paintFace(kind, variant, frame, 1) : () => -1,
    right: mask & 2 ? paintFace(kind, variant, frame, 2) : () => -1,
  });
  if (kind === 'cave_crystal' || kind === 'cave_geode') crystalsPoking(ctx, kind, variant, frame);
  return canvas;
}

/** Faceted shards breaking out of the top of a crystal / geode block. */
function crystalsPoking(ctx: Ctx, kind: string, variant: number, frame: number): void {
  const geode = kind === 'cave_geode';
  const faces = geode ? [C.q3, C.q5, C.q6, C.white] : [C.q2, C.q4, C.q6, C.white];
  const shard = (cx: number, base: number, w: number, h: number, lean: number) => {
    const top = base - h;
    poly(
      ctx,
      [
        [cx - w / 2, base],
        [cx - w / 2 + lean, top + w * 0.7],
        [cx + lean, top],
        [cx + w / 2 + lean, top + w * 0.7],
        [cx + w / 2, base],
      ],
      (x, y) => {
        const u = (x + 0.5 - (cx - w / 2)) / w;
        if (y < top + w * 0.7 && u < 0.55) return faces[3]!;
        const glow = Math.abs(u - 0.5) < 0.16 && y > top + w && (frame + y) % 3 !== 0;
        return glow ? faces[3]! : u < 0.45 ? faces[2]! : u < 0.78 ? faces[1]! : faces[0]!;
      },
    );
  };
  const r = (k: number) => hash2(variant, k, 3, 4412);
  shard(10 + Math.floor(r(0) * 3), 21, 4, 8 + Math.floor(r(1) * 3), -1);
  shard(21 + Math.floor(r(2) * 3), 22, 4, 9 + Math.floor(r(3) * 3), 1);
  if (geode) shard(16, 23, 6, 12, 0);
  else shard(16, 22, 5, 7 + Math.floor(r(4) * 3), 0);
}

// ── floor finds ────────────────────────────────────────────────────────────────────────────────────────────────

/** A hanging-stalactite twin that has reached the floor: tapering cone cluster with banded limestone. */
function stalagmite(variant: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(36, 48);
  const stone: Ramp = [C.night, C.slate, C.steel, C.mist, C.fog];
  const cone = (cx: number, base: number, w: number, h: number, lean: number) => {
    const top = base - h;
    poly(
      ctx,
      [
        [cx - w / 2, base],
        [cx - w * 0.28 + lean, top + h * 0.4],
        [cx + lean, top],
        [cx + w * 0.28 + lean, top + h * 0.4],
        [cx + w / 2, base],
      ],
      (x, y) => {
        const u = (x + 0.5 - (cx - w / 2)) / w;
        const band = Math.floor((y + variant) / 3) % 4 === 0 ? -1 : 0;
        const lv = u < 0.34 ? 3 : u < 0.62 ? 2 : u < 0.86 ? 1 : 0;
        return stone[Math.max(0, Math.min(4, lv + band + (y < top + 3 ? 1 : 0)))]!;
      },
    );
  };
  // shadow pool at the base
  blob(ctx, 18, 38, 11, 4.5, [C.ink, C.night, C.night], { noise: 0.1, edgeDark: 0 });
  cone(13 + variant, 40, 8, 17, -1);
  cone(24 - variant, 41, 9, 22 + variant * 2, 1);
  cone(18, 42, 11, 30 - variant, 0);
  return canvas;
}

/** A cluster of luminous cave mushrooms; two frames pulse the cap spots. */
function glowcap(variant: number, frame: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(32, 36);
  const caps: Ramp[] = [
    [C.w1, C.w3, C.w5, C.w6, C.w7],
    [C.q2, C.q4, C.q5, C.q6, C.q7],
    [C.g2, C.g4, C.g5, C.g6, C.g7],
  ];
  const ramp = caps[variant % 3]!;
  blob(ctx, 16, 30, 10, 3.6, [C.ink, C.night, C.night], { noise: 0.1, edgeDark: 0 });
  const mush = (cx: number, base: number, r: number, h: number) => {
    // stem
    for (let y = base - h; y <= base; y++)
      (put(ctx, cx, y, y > base - 2 ? C.slate : C.fog), put(ctx, cx + 1, y, C.steel));
    // cap
    blob(ctx, cx + 0.5, base - h, r, r * 0.62, ramp, { seed: cx * 7 + variant, noise: 0.12, bright: 0.18 });
    // spots that pulse
    const on = (frame + cx) % 2 === 0;
    put(ctx, cx - 1, base - h - 1, on ? C.white : ramp[3]!);
    put(ctx, cx + 2, base - h, on ? ramp[4]! : ramp[3]!);
  };
  mush(10, 29, 5, 7);
  mush(21, 30, 6, 10);
  mush(16, 31, 4, 5);
  return canvas;
}

/** A fallen boulder: heavy, faceted, with a fresh pale break where it can be broken. */
function boulder(variant: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(36, 36);
  const stone: Ramp = [C.ink, C.night, C.slate, C.steel, C.mist];
  blob(ctx, 18, 28, 12, 4.5, [C.ink, C.night, C.night], { noise: 0.1, edgeDark: 0 });
  blob(ctx, 18, 22, 11 + variant, 9, stone, { seed: 5 + variant, noise: 0.3, shape: 2.6, bright: 0.04 });
  blob(ctx, 24, 25, 6, 5, stone, { seed: 11 + variant, noise: 0.25, shape: 2.4, bright: -0.12 });
  // chipped break and cracks
  line(ctx, 14, 17, 18, 22, C.ink);
  line(ctx, 18, 22, 17, 27, C.ink);
  for (let i = 0; i < 4; i++) put(ctx, 12 + i * 2 + variant, 16 + (i % 2), C.fog);
  return canvas;
}

export interface CaveSpec {
  /** [variants, frames per variant] */
  variants: number;
  frames: number;
  /** sprite anchor inside the canvas */
  ax: number;
  ay: number;
  rim: boolean;
  draw: (variant: number, frame: number) => HTMLCanvasElement;
}

/** Everything the Undercroft draws as a tile object, keyed by ObjKind. */
/** Kinds drawn as wall blocks whose variant list is [mask][layout]. */
export const CAVE_ORE_KINDS = new Set(Object.keys(SEAMS));
export const CAVE_ART: Record<string, CaveSpec> = {
  ...Object.fromEntries(
    Object.keys(SEAMS).map((k) => [
      k,
      {
        // 3 vein layouts x 4 exposure masks (bit 0: +y face open, bit 1: +x face open)
        variants: 12,
        frames: k === 'cave_crystal' || k === 'cave_geode' || k === 'cave_silver' || k === 'cave_gold' ? 2 : 1,
        ax: 18,
        ay: 34,
        rim: false,
        draw: (v: number, f: number) => caveOreBlock(k, v % 3, f, Math.floor(v / 3)),
      } satisfies CaveSpec,
    ]),
  ),
  stalagmite: { variants: 3, frames: 1, ax: 18, ay: 40, rim: true, draw: (v) => stalagmite(v) },
  glowcap: { variants: 3, frames: 2, ax: 16, ay: 30, rim: false, draw: glowcap },
  cave_boulder: { variants: 2, frames: 1, ax: 18, ay: 28, rim: true, draw: (v) => boulder(v) },
};
