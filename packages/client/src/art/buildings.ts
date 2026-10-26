/**
 * Project-Zomboid-style isometric buildings for Hadamere, rendered procedurally in world space.
 *
 * Walls are thin slabs on the OUTER half of the perimeter tiles, height WALL_H px. They are rasterised analytically
 * (each pixel inverse-projected onto the top / south / east face of an axis-aligned box) so every surface is textured
 * in world coordinates: plaster with timber framing, stone courses, painted siding, windows with shutters and sills,
 * door frames. Each wall TILE becomes its own sprite so it y-sorts correctly against people walking around it.
 *
 *  - back walls (north row + west column): always drawn; you see their inner faces when the roof is lifted
 *  - front walls (south "face" row + east column): full height, plus a CUT variant (8px stub) used while the
 *    player is inside, and a NIGHT variant whose window glass glows
 *  - roof: one sprite (gabled, overhanging eaves, fascia, gable end with an attic window, chimney), faded away
 *    while the player is inside or standing behind the building
 *  - a soft ground shadow cast to the lower right, and a hanging shop sign
 */
import { Texture } from 'pixi.js';
import { Iso } from './isokit';
import type { Building } from '@eigenlands/shared';
import { hash2, isCaveY, isDiveY } from '@eigenlands/shared';
import {
  bigTextC,
  bigTextWidth,
  C,
  makeCanvas,
  put,
  rasterPixels,
  rampAt,
  undithered,
  type Ctx,
  type Ramp,
} from './shade';

export const WALL_H = 44;
const CUT_H = 8;
const T = 0.5; // wall thickness in tiles (outer half of the perimeter tiles)

export interface WallPiece {
  tx: number;
  ty: number;
  front: boolean;
  /** sprite top-left in iso art pixels */
  x: number;
  y: number;
  day: Texture;
  night: Texture;
  cut: Texture | null;
  door: boolean;
}
export interface BuildingArt {
  walls: WallPiece[];
  roof: { tex: Texture; night: Texture | null; x: number; y: number };
  shadow: { tex: Texture; x: number; y: number };
  sign: { tex: Texture; x: number; y: number; tx: number; ty: number } | null;
  /** chimney top in iso art pixels (smoke origin) */
  chimney: { x: number; y: number } | null;
  /** window light positions in tile space (outside, at the glass) */
  windows: Array<{ x: number; y: number }>;
}

const tex = (canvas: HTMLCanvasElement): Texture => {
  const t = Texture.from(canvas);
  t.source.scaleMode = 'nearest';
  return t;
};

interface Style {
  wall: Ramp;
  timber: Ramp | null;
  kind: 'plaster' | 'stone' | 'siding';
  shutter: Ramp | null;
  roof: Ramp;
  roofKind: 'thatch' | 'slate' | 'tile' | 'shingle';
  trim: number;
  /** roof geometry (default: gable) */
  shape?: RoofShape;
}
export type RoofShape = 'gable' | 'hip' | 'pagoda' | 'dome' | 'flat' | 'spire';
/** How a gabled house's roof is cut: a plain ridge, a cross-gable wing, two-slope gambrel, rolled barrel, swept curve or clipped hip. */
type Form = 'plain' | 'cross' | 'gambrel' | 'barrel' | 'swoop' | 'jerkin';
const FORMS_BY_REALM: Form[][] = [
  ['plain', 'cross', 'cross', 'jerkin', 'gambrel', 'plain'], // aurelion: timbered gables
  ['barrel', 'swoop', 'barrel', 'cross', 'swoop', 'plain'], // sylvaris: living, curved roofs
  ['plain', 'jerkin', 'gambrel', 'plain', 'cross', 'jerkin'], // khardum: steep and heavy
  ['swoop', 'cross', 'swoop', 'jerkin', 'plain', 'barrel'], // raijin
  ['barrel', 'barrel', 'swoop', 'cross', 'gambrel', 'barrel'], // thalassara
  ['jerkin', 'cross', 'plain', 'gambrel', 'jerkin', 'cross'], // nethrakar
];
/** Roof colours a house can wear instead of its kingdom's default: terracotta, teal, violet slate, blue, moss, honey thatch. */
const ALT_ROOFS: Array<{ ramp: Ramp; kind: Style['roofKind'] }> = [
  { ramp: [C.w1, C.t0, C.t1, C.t2, C.w5], kind: 'tile' },
  { ramp: [C.q0, C.q1, C.q2, C.q3, C.q4], kind: 'slate' },
  { ramp: [C.c0, C.c1, C.c2, C.c3, C.e5], kind: 'tile' },
  { ramp: [C.w1, C.b0, C.b1, C.w5, C.w6], kind: 'tile' },
  { ramp: [C.g1, C.n1, C.n2, C.n3, C.n4], kind: 'shingle' },
  { ramp: [C.e2, C.e4, C.e5, C.e6, C.e7], kind: 'thatch' },
  { ramp: [C.r1, C.r2, C.r3, C.e5, C.e6], kind: 'tile' },
];
/** An extra solid on a building's roof sprite (a corner tower), tested before the roof along every ray. */
interface Vol {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  zmin: number;
  ztop: number;
  /** colour at a point inside the bounding box and below `ztop`, or -1 where the volume is empty */
  hit: (x: number, y: number, z: number, px: number, py: number) => number;
}
const x1Of = (b: Building) => b.x + b.w;
const HOUSE_KINDS = ['house', 'farmhouse', 'inn', 'store', 'hall', 'smithy'];
const STYLES: Style[] = [
  {
    wall: [C.e4, C.e5, C.e6, C.e7, C.white],
    timber: [C.e0, C.e1, C.e2, C.e3],
    kind: 'plaster',
    shutter: [C.g1, C.g2, C.g3, C.g4],
    roof: [C.e1, C.e2, C.e3, C.e4, C.e5, C.e6],
    roofKind: 'thatch',
    trim: C.e1,
  },
  {
    wall: [C.slate, C.steel, C.mist, C.fog, C.pale],
    timber: null,
    kind: 'stone',
    shutter: null,
    roof: [C.night, C.slate, C.steel, C.mist, C.fog],
    roofKind: 'slate',
    trim: C.slate,
  },
  {
    wall: [C.w0, C.slate, C.w1, C.steel, C.mist],
    timber: null,
    kind: 'siding',
    shutter: [C.fog, C.pale, C.white, C.white],
    roof: [C.e0, C.r0, C.r1, C.r2, C.r3, C.r4],
    roofKind: 'tile',
    trim: C.pale,
  },
  {
    wall: [C.mist, C.fog, C.pale, C.white, C.white],
    timber: [C.e0, C.e1, C.e2, C.e3],
    kind: 'plaster',
    shutter: [C.g1, C.g2, C.g3, C.g4],
    roof: [C.e0, C.e1, C.e2, C.e3, C.e4],
    roofKind: 'shingle',
    trim: C.e1,
  },
];
const mk = (
  wall: Ramp,
  timber: Ramp | null,
  kind: Style['kind'],
  shutter: Ramp | null,
  roof: Ramp,
  roofKind: Style['roofKind'],
  trim: number,
  shape: RoofShape = 'gable',
): Style => ({ wall, timber, kind, shutter, roof, roofKind, trim, shape });
const rp = (a: number[]) => a as Ramp;
/**
 * Five looks per kingdom (style = 4 + realm * 5 + variant): three common houses, a civic/merchant look and the grand
 * look of palaces, keeps and temples. Realm order: aurelion, sylvaris, khardum, raijin, thalassara, nethrakar.
 */
const REALM_STYLES: Style[] = [
  // Aurelion: honey stone, half-timber, blue slate, gilt trim
  mk(
    rp([C.e4, C.e5, C.e6, C.e7, C.white]),
    rp([C.e0, C.e1, C.e2, C.e3]),
    'plaster',
    rp([C.w1, C.w2, C.w3, C.w4]),
    rp([C.r0, C.r1, C.r2, C.r3, C.r4]),
    'tile',
    C.e1,
  ),
  mk(
    rp([C.e3, C.e4, C.e5, C.e6, C.pale]),
    null,
    'stone',
    rp([C.w1, C.w2, C.w3, C.w4]),
    rp([C.w0, C.w1, C.w2, C.w3, C.w4]),
    'slate',
    C.e6,
  ),
  mk(
    rp([C.pale, C.white, C.white, C.fog]),
    rp([C.e0, C.e1, C.e2, C.e3]),
    'plaster',
    rp([C.g1, C.g2, C.g3, C.g4]),
    rp([C.e1, C.e2, C.e3, C.e4, C.e5, C.e6]),
    'thatch',
    C.e1,
  ),
  mk(
    rp([C.e3, C.e4, C.e5, C.e6, C.pale]),
    null,
    'stone',
    rp([C.w1, C.w2, C.w3, C.w4]),
    rp([C.w0, C.w1, C.w2, C.w3, C.w4]),
    'slate',
    C.e7,
    'hip',
  ),
  mk(
    rp([C.fog, C.pale, C.white, C.white, C.white]),
    null,
    'stone',
    rp([C.w2, C.w3, C.w4, C.w5]),
    rp([C.w1, C.w2, C.w3, C.w4, C.w5]),
    'slate',
    C.e7,
    'hip',
  ),
  // Sylvaris: living wood, moss thatch, green shingle
  mk(
    rp([C.e0, C.e1, C.e2, C.g1, C.g2]),
    rp([C.e0, C.e1, C.e2, C.e3]),
    'siding',
    rp([C.g3, C.g4, C.g5, C.g6]),
    rp([C.g0, C.g1, C.g2, C.g3, C.g4, C.g5]),
    'thatch',
    C.g3,
  ),
  mk(
    rp([C.e1, C.e2, C.e3, C.e4, C.e5]),
    rp([C.e0, C.e1, C.e2, C.e3]),
    'siding',
    rp([C.g2, C.g3, C.g4, C.g5]),
    rp([C.g1, C.g2, C.g3, C.g4, C.g5]),
    'shingle',
    C.g4,
  ),
  mk(
    rp([C.mist, C.fog, C.pale, C.white, C.white]),
    rp([C.g0, C.g1, C.g2, C.g3]),
    'plaster',
    rp([C.g3, C.g4, C.g5, C.g6]),
    rp([C.g0, C.g1, C.g2, C.g3, C.g4]),
    'thatch',
    C.g2,
  ),
  mk(
    rp([C.e1, C.e2, C.e3, C.e4, C.e5]),
    rp([C.e0, C.e1, C.e2, C.e3]),
    'siding',
    rp([C.g3, C.g4, C.g5, C.g6]),
    rp([C.g1, C.g2, C.g3, C.g4, C.g5]),
    'shingle',
    C.g5,
    'hip',
  ),
  mk(
    rp([C.e0, C.e1, C.e2, C.e3, C.g2]),
    rp([C.g1, C.g2, C.g3, C.g4]),
    'siding',
    rp([C.g4, C.g5, C.g6, C.g7]),
    rp([C.g1, C.g2, C.g3, C.g4, C.g5, C.g6]),
    'thatch',
    C.g6,
    'dome',
  ),
  // Khar-Dum: dark riveted stone, iron roofs, forge-red trim
  mk(
    rp([C.night, C.slate, C.steel, C.mist, C.fog]),
    rp([C.slate, C.steel, C.mist, C.fog]),
    'stone',
    rp([C.r1, C.r2, C.r3, C.r4]),
    rp([C.ink, C.night, C.slate, C.steel, C.mist]),
    'slate',
    C.r3,
  ),
  mk(
    rp([C.slate, C.steel, C.mist, C.fog, C.pale]),
    null,
    'stone',
    rp([C.r1, C.r2, C.r3, C.r4]),
    rp([C.night, C.slate, C.steel, C.mist, C.fog]),
    'slate',
    C.e5,
  ),
  mk(
    rp([C.r0, C.r1, C.r2, C.r3, C.mist]),
    rp([C.night, C.slate, C.steel, C.mist]),
    'stone',
    null,
    rp([C.ink, C.night, C.slate, C.steel]),
    'slate',
    C.e4,
  ),
  mk(
    rp([C.night, C.slate, C.steel, C.mist, C.fog]),
    rp([C.e1, C.e2, C.e3, C.e4]),
    'stone',
    rp([C.e2, C.e3, C.e4, C.e5]),
    rp([C.ink, C.night, C.slate, C.steel, C.mist]),
    'slate',
    C.e5,
    'hip',
  ),
  mk(
    rp([C.ink, C.night, C.slate, C.steel, C.mist]),
    rp([C.slate, C.steel, C.mist, C.fog]),
    'stone',
    rp([C.r2, C.r3, C.r4, C.r5]),
    rp([C.night, C.slate, C.steel, C.mist]),
    'slate',
    C.e6,
    'flat',
  ),
  // Raijin: lacquered red timber, white plaster, dark curved tile
  mk(
    rp([C.pale, C.white, C.fog, C.white, C.white]),
    rp([C.r1, C.r2, C.r3, C.r4]),
    'plaster',
    rp([C.r2, C.r3, C.r4, C.r5]),
    rp([C.ink, C.night, C.slate, C.steel, C.mist]),
    'tile',
    C.r3,
  ),
  mk(
    rp([C.e2, C.e3, C.e4, C.e5, C.e6]),
    rp([C.e0, C.e1, C.e2, C.e3]),
    'siding',
    rp([C.e1, C.e2, C.e3, C.e4]),
    rp([C.night, C.slate, C.steel, C.mist, C.fog]),
    'tile',
    C.e1,
    'hip',
  ),
  mk(
    rp([C.white, C.white, C.pale, C.fog]),
    rp([C.night, C.slate, C.steel, C.mist]),
    'plaster',
    rp([C.night, C.slate, C.steel, C.mist]),
    rp([C.e0, C.e1, C.e2, C.e3, C.e4]),
    'shingle',
    C.slate,
  ),
  mk(
    rp([C.pale, C.white, C.fog, C.white, C.white]),
    rp([C.r1, C.r2, C.r3, C.r4]),
    'plaster',
    rp([C.r2, C.r3, C.r4, C.r5]),
    rp([C.night, C.slate, C.steel, C.mist, C.fog]),
    'tile',
    C.r4,
    'pagoda',
  ),
  mk(
    rp([C.r1, C.r2, C.r3, C.r4, C.r5]),
    rp([C.ink, C.night, C.slate, C.steel]),
    'plaster',
    rp([C.e4, C.e5, C.e6, C.e7]),
    rp([C.ink, C.night, C.slate, C.steel, C.mist]),
    'tile',
    C.e6,
    'pagoda',
  ),
  // Thalassara: coral plaster, pearl stone, teal tile
  mk(
    rp([C.r4, C.r5, C.r6, C.pale, C.white]),
    rp([C.w1, C.w2, C.w3, C.w4]),
    'plaster',
    rp([C.w2, C.w3, C.w4, C.w5]),
    rp([C.w1, C.w2, C.w3, C.w4, C.w5, C.w6]),
    'tile',
    C.pale,
  ),
  mk(
    rp([C.white, C.white, C.pale, C.fog]),
    rp([C.w2, C.w3, C.w4, C.w5]),
    'plaster',
    rp([C.w3, C.w4, C.w5, C.w6]),
    rp([C.w2, C.w3, C.w4, C.w5, C.w6]),
    'tile',
    C.w4,
  ),
  mk(
    rp([C.e5, C.e6, C.e7, C.pale, C.white]),
    null,
    'stone',
    rp([C.w2, C.w3, C.w4, C.w5]),
    rp([C.e1, C.e2, C.e3, C.e4, C.e5]),
    'thatch',
    C.w3,
  ),
  mk(
    rp([C.pale, C.white, C.white, C.fog]),
    rp([C.w2, C.w3, C.w4, C.w5]),
    'plaster',
    rp([C.w2, C.w3, C.w4, C.w5]),
    rp([C.w2, C.w3, C.w4, C.w5, C.w6]),
    'tile',
    C.e6,
    'hip',
  ),
  mk(
    rp([C.white, C.white, C.pale, C.fog, C.mist]),
    null,
    'stone',
    rp([C.w3, C.w4, C.w5, C.w6]),
    rp([C.w1, C.w2, C.w3, C.w4, C.w5, C.w6]),
    'tile',
    C.e7,
    'dome',
  ),
  // Nethrakar: obsidian, crimson trim and tile, violet glass
  mk(
    rp([C.ink, C.night, C.slate, C.night, C.slate]),
    rp([C.r0, C.r1, C.r2, C.r3]),
    'stone',
    rp([C.q1, C.q2, C.q3, C.q4]),
    rp([C.r0, C.r1, C.r2, C.r3, C.r4]),
    'tile',
    C.r4,
  ),
  mk(
    rp([C.night, C.slate, C.q0, C.q1, C.q2]),
    null,
    'stone',
    rp([C.r2, C.r3, C.r4, C.r5]),
    rp([C.q0, C.q1, C.q2, C.q3]),
    'slate',
    C.r5,
  ),
  mk(
    rp([C.slate, C.steel, C.mist, C.steel, C.slate]),
    rp([C.r0, C.r1, C.r2, C.r3]),
    'stone',
    rp([C.e3, C.e4, C.e5, C.e6]),
    rp([C.ink, C.night, C.slate, C.steel]),
    'slate',
    C.e5,
  ),
  mk(
    rp([C.ink, C.night, C.slate, C.night, C.slate]),
    rp([C.r1, C.r2, C.r3, C.r4]),
    'stone',
    rp([C.q2, C.q3, C.q4, C.q5]),
    rp([C.r1, C.r2, C.r3, C.r4, C.r5]),
    'tile',
    C.r5,
    'hip',
  ),
  mk(
    rp([C.ink, C.ink, C.night, C.slate, C.night]),
    rp([C.r1, C.r2, C.r3, C.r4]),
    'stone',
    rp([C.r3, C.r4, C.r5, C.r6]),
    rp([C.r0, C.r1, C.r2, C.r3, C.r4, C.r5]),
    'tile',
    C.r6,
    'flat',
  ),
];
const GRANITE: Ramp = [C.slate, C.steel, C.mist, C.fog, C.pale];
const GLASS_DAY: Ramp = [C.w1, C.w2, C.w3, C.w5, C.w6];
const GLASS_NIGHT: Ramp = [C.r4, C.r5, C.r6, C.r7, C.r7];
const BRICK: Ramp = [C.r0, C.r1, C.r2, C.r3];

type Face = 'top' | 'south' | 'east';
/** material callback: palette index, -1 transparent, or GLASS + ramp index (night-swappable) */
type Mat = (face: Face, x: number, y: number, z: number) => number;
const GLASS = 1000;

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
  mat: Mat;
}

/** Rasterise boxes (painter's order) into a canvas whose top-left is iso pixel (left, top). Returns glass pixels. */
function drawBoxes(
  ctx: Ctx,
  w: number,
  h: number,
  left: number,
  top: number,
  boxes: Box[],
  glass: Array<[number, number, number]>,
): void {
  for (const b of boxes) {
    for (let py = 0; py < h; py++)
      for (let px = 0; px < w; px++) {
        const P = (px + 0.5 + left) / 16; // x - y
        const sy = py + 0.5 + top;
        let c = -2;
        // top face
        {
          const Q = (sy + b.z1) / 8,
            x = (Q + P) / 2,
            y = (Q - P) / 2;
          if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) c = b.mat('top', x, y, b.z1);
        }
        if (c === -2) {
          const x = P + b.y1,
            z = (x + b.y1) * 8 - sy;
          if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) c = b.mat('south', x, b.y1, z);
        }
        if (c === -2) {
          const y = b.x1 - P,
            z = (b.x1 + y) * 8 - sy;
          if (y >= b.y0 && y <= b.y1 && z >= b.z0 && z <= b.z1) c = b.mat('east', b.x1, y, z);
        }
        if (c < 0) continue;
        if (c >= GLASS) {
          glass.push([px, py, c - GLASS]);
          c = GLASS_DAY[c - GLASS]!;
        }
        put(ctx, px, py, c);
      }
  }
}

export const buildingRealm = (b: Building): 'surface' | 'cave' | 'sea' =>
  isDiveY(b.y) ? 'sea' : isCaveY(b.y) ? 'cave' : 'surface';
const CAVE_STYLE: Style = {
  wall: [C.night, C.slate, C.steel, C.mist, C.fog],
  timber: null,
  kind: 'stone',
  shutter: null,
  roof: [C.night, C.slate, C.steel, C.mist, C.fog],
  roofKind: 'slate',
  trim: C.e3,
};
const SEA_STYLE: Style = {
  wall: [C.w0, C.w1, C.w2, C.mist, C.pale],
  timber: null,
  kind: 'stone',
  shutter: null,
  roof: [C.w0, C.w1, C.w2, C.w3, C.w5],
  roofKind: 'tile',
  trim: C.pale,
};
/** Shutter and trim colours a house may be painted with, whatever its kingdom. */
const SHUTTERS: Ramp[] = [
  [C.g1, C.g2, C.g3, C.g4],
  [C.w1, C.b0, C.b1, C.w5],
  [C.r0, C.r1, C.r2, C.r3],
  [C.t0, C.t1, C.t2, C.w6],
  [C.q0, C.q1, C.q2, C.q3],
  [C.e0, C.e1, C.e2, C.e3],
  [C.c0, C.c1, C.c2, C.c3],
];
/** Plaster washes: honey, rose, sky, sage, sand, lilac, buttermilk. */
const PLASTERS: Ramp[] = [
  [C.e4, C.e5, C.e6, C.e7, C.white],
  [C.r4, C.r5, C.r6, C.e6, C.white],
  [C.w4, C.w5, C.w6, C.pale, C.white],
  [C.g4, C.g5, C.g6, C.pale, C.white],
  [C.e3, C.e4, C.e5, C.e6, C.pale],
  [C.q3, C.q4, C.q5, C.pale, C.white],
  [C.e5, C.e6, C.e7, C.white, C.white],
];
/** A house's own paint: a third of plastered houses take another wash, most take their own shutter colour. */
function paint(b: Building, st: Style): Style {
  if (!HOUSE_KINDS.includes(b.kind) || buildingRealm(b) !== 'surface') return st;
  const h = (k: number) => hash2(b.x * 31 + b.y * 17, k, 55, 93);
  const out = { ...st };
  if (st.kind === 'plaster' && h(1) < 0.45) out.wall = PLASTERS[Math.floor(h(2) * PLASTERS.length)]!;
  if (st.shutter && h(3) < 0.75) out.shutter = SHUTTERS[Math.floor(h(4) * SHUTTERS.length)]!;
  if (st.timber && h(5) < 0.25) out.timber = [C.ink, C.night, C.slate, C.steel];
  return out;
}
const styleFor = (b: Building) =>
  buildingRealm(b) === 'cave'
    ? CAVE_STYLE
    : buildingRealm(b) === 'sea'
      ? SEA_STYLE
      : b.style >= 4
        ? paint(b, realmStyle(b))
        : paint(b, STYLES[b.style % 4]!);
function realmStyle(b: Building): Style {
  const st = REALM_STYLES[(b.style - 4) % REALM_STYLES.length]!;
  return (b.kind as string) === 'tower' ? { ...st, shape: 'spire' } : st;
}

function wallMat(b: Building, st: Style, seed: number, interior: boolean, capC: number): Mat {
  const x1 = b.x + b.w,
    y1 = b.y + b.h;
  const winTile = (face: Face, x: number, y: number): boolean => {
    if (face === 'south') {
      const tx = Math.floor(x - 1e-6);
      if (!interior && (Math.abs(tx - b.doorX) <= 1 || tx <= b.x || tx >= x1 - 1)) return false;
      if (interior && (tx <= b.x || tx >= x1 - 1)) return false;
      return (tx - b.x) % 2 === 1 || (interior && (tx - b.x) % 3 === 1);
    }
    const ty = Math.floor(y - 1e-6);
    if (ty <= b.y || ty >= y1 - 1) return false;
    return (ty - b.y) % 2 === 1;
  };
  return (face, x, y, z) => {
    const lightOff = face === 'top' ? 0.18 : face === 'south' ? 0.1 : -0.3;
    if (face === 'top') return capC;
    const u = face === 'south' ? x : y; // along the face, tiles
    const fu = u - Math.floor(u);
    const upx = u * 16; // along the face, px
    const ix = Math.floor(upx),
      iz = Math.floor(z);
    // Dark timber jambs make the open entrance readable against pale plaster.
    if (face === 'south' && Math.floor(x) === b.doorX && z > 1.5 && z < 34 && (fu < 0.15 || fu > 0.85))
      return fu < 0.15 ? C.e3 : C.e1;
    // foundation course
    if (z < 6) {
      const brick = Math.floor((upx + (iz < 3 ? 0 : 5)) / 10);
      if (iz === 2 || Math.floor(upx + (iz < 3 ? 0 : 5)) % 10 === 0) return face === 'east' ? C.slate : C.steel;
      return rampAt(GRANITE, 0.55 + lightOff + (hash2(seed, brick, iz < 3 ? 0 : 1, 3) - 0.5) * 0.3, ix, iz);
    }
    // windows
    if (winTile(face, x, y) && z >= 15 && z < 33) {
      const realm = buildingRealm(b);
      const inU = fu >= 0.28 && fu <= 0.72 && (realm === 'surface' || Math.hypot((fu - 0.5) * 28, (z - 24) * 0.65) < 5),
        inZ = z >= 17 && z < 31;
      if (inU && inZ) {
        const frame =
          fu < 0.34 || fu > 0.66 || z < 18 || z >= 30 || Math.abs(fu - 0.5) < 0.03 || Math.abs(z - 24) < 0.6;
        if (frame) return st.kind === 'siding' ? C.pale : st.timber ? st.timber[1]! : C.slate;
        const refl = ix % 8 < 2 && iz > 22;
        const gi = refl ? 4 : z > 25 ? 3 : z > 21 ? 2 : 1;
        return GLASS + Math.max(0, Math.min(4, gi + (face === 'east' ? -1 : 0)));
      }
      if (z < 17 && z >= 15 && fu > 0.24 && fu < 0.76)
        return z < 16 ? C.steel : st.kind === 'siding' ? C.white : C.pale; // sill
      if (st.shutter && inZ && ((fu > 0.14 && fu < 0.28) || (fu > 0.72 && fu < 0.86))) {
        return iz % 3 === 0 ? st.shutter[0]! : rampAt(st.shutter, 0.6 + lightOff, ix, iz);
      }
    }
    // corner quoins / posts at the building corners
    const atCorner =
      (face === 'south' && (x < b.x + 0.12 || x > x1 - 0.12)) || (face === 'east' && (y < b.y + 0.12 || y > y1 - 0.12));
    if (st.kind === 'stone') {
      const row = Math.floor((z - 6) / 6);
      const off = row % 2 ? 6 : 0;
      if (Math.floor(z - 6) % 6 === 5 || Math.floor(upx + off) % 12 === 0) return C.steel;
      const blk = Math.floor((upx + off) / 12);
      return rampAt(
        st.wall,
        0.55 + lightOff + (hash2(seed, blk, row, 4) - 0.5) * 0.35 + (Math.floor(z - 6) % 6 === 0 ? 0.15 : 0),
        ix,
        iz,
      );
    }
    if (st.kind === 'siding') {
      if (atCorner) return rampAt([C.mist, C.fog, C.pale, C.white], 0.7 + lightOff, ix, iz);
      if (z >= WALL_H - 3) return C.white;
      const bz = Math.floor(z - 6) % 5;
      if (bz === 4) return st.wall[0]!;
      return rampAt(
        st.wall,
        0.5 +
          lightOff +
          (bz === 0 ? 0.18 : 0) +
          (hash2(seed, Math.floor(upx / 22), Math.floor((z - 6) / 5), 5) - 0.5) * 0.12,
        ix,
        iz,
      );
    }
    // a stone ground floor under a plastered, timbered upper storey (a third of the plastered houses)
    if (st.kind === 'plaster' && hash2(seed, 3, 7, 88) < 0.34 && z < 19) {
      const row = Math.floor((z - 6) / 6);
      const off = row % 2 ? 6 : 0;
      if (Math.floor(z - 6) % 6 === 5 || Math.floor(upx + off) % 12 === 0) return C.steel;
      const blk = Math.floor((upx + off) / 12);
      return rampAt(GRANITE, 0.6 + lightOff + (hash2(seed, blk, row, 4) - 0.5) * 0.3, ix, iz);
    }
    // plaster + timber framing
    const tim = st.timber!;
    const post = fu < 0.07 || fu > 0.93 || atCorner;
    const beam = (z >= 6 && z < 8) || z >= WALL_H - 3 || (z >= 34 && z < 36);
    const brace =
      !winTile(face, x, y) &&
      z >= 8 &&
      z < 34 &&
      Math.abs((fu - 0.08) * 16 * 1.6 - (z - 8)) < 1.4 &&
      !(face === 'south' && Math.floor(x) === b.doorX);
    if (post || beam || brace) return rampAt(tim, 0.55 + lightOff + (post && fu < 0.07 ? 0.15 : 0), ix, iz);
    const n = hash2(seed, ix >> 1, iz >> 1, 6);
    return rampAt(st.wall, 0.6 + lightOff + (n - 0.5) * 0.12 - (z > 30 ? 0.05 : 0), ix, iz);
  };
}

/** Roof surfaces: height field of a gabled roof with overhangs, plus a chimney. */
function buildRoof(
  b: Building,
  st: Style,
  seed: number,
): {
  canvas: HTMLCanvasElement;
  left: number;
  top: number;
  chimney: { x: number; y: number } | null;
  windows: Array<{ x: number; y: number }>;
  night: HTMLCanvasElement | null;
} {
  const o = 0.4;
  const X0 = b.x - o,
    X1 = b.x + b.w + o,
    Y0 = b.y - o,
    Y1 = b.y + b.h + o;
  const alongX = b.w >= b.h;
  const span = alongX ? b.h / 2 + o : b.w / 2 + o;
  const realm = buildingRealm(b);
  const shape: RoofShape = realm === 'surface' ? (b.kind === 'church' ? 'gable' : (st.shape ?? 'gable')) : 'gable';
  const hv = (k: number) => hash2(seed, k, 77, 91);
  const realmIdx = b.style >= 4 ? Math.floor((b.style - 4) / 5) % FORMS_BY_REALM.length : 0;
  const house = realm === 'surface' && shape === 'gable' && HOUSE_KINDS.includes(b.kind);
  const form: Form = house ? FORMS_BY_REALM[realmIdx]![Math.floor(hv(1) * 6)]! : 'plain';
  const church = b.kind === 'church' && realm === 'surface';
  const pitch = house ? 0.85 + hv(2) * 0.7 : church ? 1.9 : 1;
  // a third of the houses wear another colour of roof than their kingdom's default
  const alt = house && hv(3) < 0.4 ? ALT_ROOFS[Math.floor(hv(4) * ALT_ROOFS.length)]! : null;
  const rk = alt ? alt.kind : st.roofKind;
  const baseRise = Math.min(span * 11 * pitch * (form === 'gambrel' ? 1.2 : 1), church ? 76 : 54);
  const rise =
    shape === 'spire'
      ? Math.min(span * 15, 54)
      : shape === 'pagoda'
        ? baseRise * 1.15
        : shape === 'dome'
          ? Math.min(span * 9, 34)
          : shape === 'flat'
            ? 7
            : baseRise;
  const zE = WALL_H,
    zR = zE + rise;
  const mid = alongX ? b.y + b.h / 2 : b.x + b.w / 2;
  const aMid = alongX ? b.x + b.w / 2 : b.y + b.h / 2;
  const alongHalf = (alongX ? b.w : b.h) / 2 + o;
  /** 0 at the eave .. 1 at the ridge, for the shaped roofs */
  const shapeH = (x: number, y: number): number => {
    const across = Math.min(1, Math.abs((alongX ? y : x) - mid) / span),
      along = Math.min(1, Math.abs((alongX ? x : y) - aMid) / alongHalf);
    if (shape === 'hip' || shape === 'pagoda')
      return Math.max(0, Math.min(1 - across, ((1 - along) * alongHalf) / span));
    if (shape === 'spire') return 1 - Math.max(across, along);
    if (shape === 'dome') return Math.sqrt(Math.max(0, 1 - across * across - along * along));
    return 1;
  };
  /** distance from the ridge across the slope, 0 at the ridge to 1 at the eave, and the form's height over it */
  const profile = (d: number): number => {
    if (form === 'gambrel') return d < 0.4 ? 1 - d * 0.55 : 0.78 - (d - 0.4) * 1.3;
    if (form === 'barrel') return Math.sqrt(Math.max(0, 1 - d * d));
    if (form === 'swoop') return Math.pow(1 - d, 1.8) + (d > 0.88 ? (d - 0.88) * 0.5 : 0);
    return 1 - d;
  };
  const mainZ = (x: number, y: number): number => {
    const d = Math.min(1, Math.abs((alongX ? y : x) - mid) / span);
    let h = profile(d);
    if (form === 'jerkin') h = Math.min(h, (alongHalf - Math.abs((alongX ? x : y) - aMid)) / (span * 0.62));
    return zE + rise * Math.max(0, h);
  };
  // a cross-gable wing: a second, lower ridge running across the main one toward the street
  const wing =
    form === 'cross'
      ? {
          a: aMid + (hv(5) - 0.5) * alongHalf * 0.7,
          half: Math.min(span * 0.9, alongHalf * 0.42),
          rise: rise * 0.8,
        }
      : null;
  const wingZ = (x: number, y: number): number => {
    if (!wing) return -Infinity;
    const a = alongX ? x : y,
      n = alongX ? y : x;
    if (n < mid || Math.abs(a - wing.a) > wing.half) return -Infinity;
    return zE + wing.rise * (1 - Math.abs(a - wing.a) / wing.half);
  };
  const roofZ = (x: number, y: number) => {
    const d = Math.min(1, Math.abs((alongX ? y : x) - mid) / span);
    if (realm === 'cave') return zE + 18 * Math.sqrt(Math.max(0, 1 - d * d));
    if (realm === 'sea') return zE + 28 * Math.sqrt(Math.max(0, 1 - d * d));
    if (shape === 'gable') return Math.max(mainZ(x, y), wingZ(x, y));
    if (shape === 'flat') {
      // crenellated parapet around a low platform
      const ex = Math.min(x - b.x, b.x + b.w - x),
        ey = Math.min(y - b.y, b.y + b.h - y);
      const edge = Math.min(ex, ey);
      const merlon = Math.floor((x + y) * 2) % 2 === 0;
      return zE + (edge < 0.7 ? (merlon ? rise : rise - 4.5) : 1.5);
    }
    const h = shapeH(x, y);
    if (shape === 'pagoda') {
      // concave sweep with upturned eaves
      const lip = h < 0.1 ? ((0.1 - h) / 0.1) * 5 : 0;
      return zE + rise * Math.pow(h, 1.45) + lip;
    }
    return zE + rise * h;
  };
  const inFoot = (x: number, y: number) => x >= X0 && x <= X1 && y >= Y0 && y <= Y1;
  const inWalls = (x: number, y: number) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  const big =
    b.kind === 'hall' || b.kind === 'inn' || b.kind === 'smithy' || b.kind === 'farmhouse' || b.kind === 'house';
  const ch =
    realm === 'surface' && big && (shape === 'gable' || shape === 'hip')
      ? { x0: alongX ? b.x + b.w * 0.7 : mid + 0.2, y0: alongX ? mid - 0.9 : b.y + b.h * 0.3, s: 0.75 }
      : null;
  const chTop = zR + 8;
  // a round corner tower under a cone of roof tiles, on some of the larger houses (the kingdoms of keeps favour them)
  const R0 = alt ? alt.ramp : st.roof;
  const turretOdds = realmIdx === 2 || realmIdx === 0 || realmIdx === 5 ? 0.3 : 0.16;
  const towered = house && b.w >= 7 && b.h >= 6 && form !== 'barrel' && hv(7) < turretOdds;
  const vols: Vol[] = [];
  if (church) {
    // the bell tower: a square stone shaft at the front corner, louvred belfry openings, a tall slate spire and a cross
    const half = Math.min(1.7, b.w * 0.2),
      cx = b.x + half + 0.1,
      cy = b.y + b.h - half - 0.1,
      bodyTop = zE + rise + 12,
      spireH = 58;
    vols.push({
      x0: cx - half - 0.3,
      x1: cx + half + 0.3,
      y0: cy - half - 0.3,
      y1: cy + half + 0.3,
      zmin: 0,
      ztop: bodyTop + spireH + 10,
      hit: (x, y, z, px, py) => {
        const dx = x - cx,
          dy = y - cy;
        const m = Math.max(Math.abs(dx), Math.abs(dy));
        // the cross on the spire's tip
        if (Math.abs(dx) < 0.08 && Math.abs(dy) < 0.08 && z > bodyTop + spireH - 2 && z < bodyTop + spireH + 9)
          return C.e6;
        if (Math.abs(dy) < 0.08 && Math.abs(dx) < 0.35 && z > bodyTop + spireH + 4 && z < bodyTop + spireH + 6)
          return C.e6;
        if (z >= bodyTop - 1) {
          const h = bodyTop + spireH * (1 - m / (half + 0.3));
          if (m > half + 0.3 || z > h) return -1;
          const southFace = dy > dx;
          const course = Math.floor((bodyTop + spireH - z) / 4) % 2;
          return rampAt(R0, (southFace ? 0.7 : 0.35) + (course ? -0.08 : 0.06), px, py);
        }
        if (m > half) return -1;
        const southFace = dy >= dx;
        const along = southFace ? dx : dy;
        // belfry openings and a clock face
        if (z > bodyTop - 16 && z < bodyTop - 4 && Math.abs(along) < half * 0.45)
          return Math.floor(z) % 3 === 0 ? C.e1 : C.ink;
        if (Math.abs(z - (bodyTop - 26)) < 4.5 && Math.hypot(along * 16, z - (bodyTop - 26)) < 4.5)
          return Math.hypot(along * 16, z - (bodyTop - 26)) < 1 ? C.ink : C.pale;
        if (z > bodyTop - 4) return C.fog; // cornice
        const row = Math.floor(z / 6);
        const blk = Math.floor((along + half) * 2 + (row % 2) * 0.5);
        if (Math.floor(z) % 6 === 5) return C.steel;
        return rampAt(GRANITE, (southFace ? 0.66 : 0.32) + (hash2(seed, blk, row, 23) - 0.5) * 0.22, px, py);
      },
    });
  }
  if (towered) {
    const cx = b.doorX - b.x > b.w / 2 ? b.x + 1.3 : x1Of(b) - 1.3,
      cy = b.y + b.h - 1.3,
      r = 1.5,
      bodyTop = zE + 8,
      coneH = 30;
    const mask = [R0[1]!, R0[2]!, R0[3]!, R0[4]!];
    vols.push({
      x0: cx - r - 0.5,
      x1: cx + r + 0.5,
      y0: cy - r - 0.5,
      y1: cy + r + 0.5,
      zmin: 0,
      ztop: bodyTop + coneH,
      hit: (x, y, z, px, py) => {
        const dx = x - cx,
          dy = y - cy,
          rho = Math.hypot(dx, dy);
        if (rho > r + 0.4) return -1;
        const lit = -(dx - dy) / (Math.SQRT2 * Math.max(rho, 0.001)); // +1 faces the light (screen left)
        const cone = bodyTop + coneH * (1 - rho / (r + 0.4));
        if (z >= bodyTop - 1.5 && z <= cone) {
          if (z > bodyTop + coneH - 3 && rho < 0.2) return C.e6; // finial
          const course = Math.floor((r + 0.4 - rho) * 16) % 4;
          const ang = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * 14);
          const t =
            0.5 +
            lit * 0.26 +
            (course === 0 ? -0.16 : 0.06) +
            (hash2(seed, ang, Math.floor((r + 0.4 - rho) * 4), 21) - 0.5) * 0.14;
          return rampAt(R0, Math.max(0.1, Math.min(0.95, t)), px, py);
        }
        if (rho <= r && z < bodyTop - 1.5) {
          const ang = Math.atan2(dy, dx);
          if (Math.abs(ang - Math.PI / 4) < 0.16 && z > bodyTop - 17 && z < bodyTop - 7)
            return Math.abs(ang - Math.PI / 4) < 0.07 ? GLASS_DAY[2]! : C.night; // an arrow-slit
          if (z > bodyTop - 5) return rampAt(st.wall, 0.45 + lit * 0.25, px, py); // plaster collar
          const row = Math.floor(z / 5);
          const blk = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 18 + (row % 2) * 0.5);
          if (Math.floor(z) % 5 === 4) return C.steel;
          return rampAt(GRANITE, 0.55 + lit * 0.3 + (hash2(seed, blk, row, 22) - 0.5) * 0.25, px, py);
        }
        return -1;
      },
    });
    void mask;
  }
  let L = Math.floor((X0 - Y1) * 16) - 2,
    R = Math.ceil((X1 - Y0) * 16) + 2;
  let vTop = chTop,
    vBot = zE;
  for (const v of vols) {
    L = Math.min(L, Math.floor((v.x0 - v.y1) * 16) - 2);
    R = Math.max(R, Math.ceil((v.x1 - v.y0) * 16) + 2);
    vTop = Math.max(vTop, v.ztop);
    vBot = Math.min(vBot, v.zmin);
  }
  const hasCanopy =
    realm === 'surface' && (b.kind === 'hall' || b.kind === 'inn' || b.kind === 'store' || b.id === 'bakery');
  const top = Math.floor(Math.min((X0 + Y0) * 8 - chTop, ...vols.map((v) => (v.x0 + v.y0) * 8 - v.ztop))) - 3,
    bot =
      Math.ceil(
        Math.max((X1 + Y1) * 8 - zE + (hasCanopy ? 28 : 6) - 6, ...vols.map((v) => (v.x1 + v.y1) * 8 - v.zmin)),
      ) + 6;
  // Small cross-gables emerge from the camera-facing slope. Their volume is
  // intersected by the same world-space rays as the main roof, so valleys and
  // chimney occlusion remain correct in both ridge orientations.
  const count =
    realm !== 'surface' || shape !== 'gable' || form === 'cross' || form === 'barrel' || form === 'swoop'
      ? 0
      : b.kind === 'inn' || b.kind === 'hall'
        ? 2
        : b.kind === 'farmhouse' || b.id === 'library'
          ? 1
          : 0;
  const dormers = Array.from({ length: count }, (_, i) => {
    const a = (alongX ? b.x : b.y) + (alongX ? b.w : b.h) * ((i + 1) / (count + 1));
    const n = mid + span * 0.63;
    const x = alongX ? a : n,
      y = alongX ? n : a;
    return { a, n0: n - 1.05, n1: n, half: 0.72, eave: roofZ(x, y) + 11 };
  });
  const w = R - L,
    h = bot - top;
  const { canvas, ctx } = makeCanvas(w, h);
  const windows: Array<{ x: number; y: number }> = [];
  const glass: Array<[number, number, number]> = [];
  // Rays move (+1/16,+1/16) in tile space per vertical pixel. Intersect their
  // bounding volumes and roof planes before sampling, keeping the original half-pixel grid.
  // Empty space above/beside a roof used to consume almost the entire raster budget.
  const boxCap = (ax: number, ay: number, x0: number, y0: number, x1: number, y1: number, cap: number): number => {
    const lo = Math.max(zE - 4, (x0 - ax) * 16, (y0 - ay) * 16),
      hi = Math.min(cap, (x1 - ax) * 16, (y1 - ay) * 16);
    return hi >= lo ? hi : -Infinity;
  };
  const gableCap = (base: number, centre: number, eave: number, height: number, slope: number): number =>
    Math.min(
      (eave + height - slope * (base - centre)) / (1 + slope / 16),
      (eave + height + slope * (base - centre)) / (1 - slope / 16),
    );
  rasterPixels(ctx, w, h, () => {
    for (let py = 0; py < h; py++)
      for (let px = 0; px < w; px++) {
        const P = (px + 0.5 + L) / 16,
          sy = py + 0.5 + top;
        const ax = (sy / 8 + P) / 2,
          ay = (sy / 8 - P) / 2;
        let cap = boxCap(
          ax,
          ay,
          X0,
          Y0,
          X1,
          Y1,
          realm === 'surface'
            ? shape === 'gable' && form === 'plain'
              ? gableCap(alongX ? ay : ax, mid, zE, rise, rise / span)
              : zE + rise + 6
            : zE + (realm === 'cave' ? 18 : 28),
        );
        if (ch) cap = Math.max(cap, boxCap(ax, ay, ch.x0, ch.y0, ch.x0 + ch.s, ch.y0 + ch.s, chTop));
        for (const v of vols) cap = Math.max(cap, boxCap(ax, ay, v.x0, v.y0, v.x1, v.y1, v.ztop));
        for (const d of dormers)
          cap = Math.max(
            cap,
            boxCap(
              ax,
              ay,
              alongX ? d.a - d.half : d.n0,
              alongX ? d.n0 : d.a - d.half,
              alongX ? d.a + d.half : d.n1,
              alongX ? d.n1 : d.a + d.half,
              gableCap(alongX ? ax : ay, d.a, d.eave, 9, 9 / d.half),
            ),
          );
        if (!Number.isFinite(cap)) continue;
        const start = chTop - Math.max(0, Math.floor((chTop - cap) * 2)) * 0.5;
        for (let z = start; z >= vBot - 1 && z >= (vols.length ? 0 : zE - 4); z -= 0.5) {
          const Q = (sy + z) / 8,
            x = (Q + P) / 2,
            y = (Q - P) / 2;
          // chimney (a brick box poking through the roof)
          if (ch && x >= ch.x0 && x <= ch.x0 + ch.s && y >= ch.y0 && y <= ch.y0 + ch.s && z <= chTop && z >= zE) {
            const fx = x - ch.x0,
              fy = y - ch.y0;
            const isTop = z > chTop - 0.6;
            const face = isTop ? 'top' : ch.s - fy < ch.s - fx ? 'south' : 'east';
            let c: number;
            if (isTop) c = fx > 0.15 && fx < ch.s - 0.15 && fy > 0.15 && fy < ch.s - 0.15 ? C.night : C.fog;
            else {
              const u = (face === 'south' ? x : y) * 16,
                row = Math.floor((chTop - z) / 3);
              c =
                Math.floor(chTop - z) % 3 === 2 || Math.floor(u + (row % 2) * 3) % 6 === 0
                  ? C.r0
                  : rampAt(
                      BRICK,
                      (face === 'south' ? 0.75 : 0.35) +
                        (hash2(seed, Math.floor((u + (row % 2) * 3) / 6), row, 8) - 0.5) * 0.3,
                      px,
                      py,
                    );
              if (z > chTop - 3) c = face === 'south' ? C.mist : C.steel;
            }
            put(ctx, px, py, c);
            break;
          }
          let volHit = false;
          for (const v of vols) {
            if (x < v.x0 || x > v.x1 || y < v.y0 || y > v.y1 || z > v.ztop) continue;
            const c = v.hit(x, y, z, px, py);
            if (c < 0) continue;
            put(ctx, px, py, c);
            volHit = true;
            break;
          }
          if (volHit) break;
          let dormerHit = false;
          for (const d of dormers) {
            const a = alongX ? x : y,
              n = alongX ? y : x;
            const da = Math.abs(a - d.a),
              cap = d.eave + 9 * (1 - da / d.half);
            if (da > d.half || n < d.n0 || n > d.n1 || z > cap || z < roofZ(x, y) - 0.5) continue;
            let c: number;
            if (z > cap - 1.3) {
              const lit = a < d.a === alongX;
              c = rampAt(R0, lit ? 0.78 : 0.38, px, py);
              if (Math.floor((n - d.n0) * 16) % 5 === 0) c = R0[1]!;
            } else {
              const front = n > d.n1 - 0.08;
              const u = (a - d.a) * 16,
                wz = z - (d.eave - 6);
              const pane = front && Math.abs(u) < 5 && wz > -4 && wz < 4.5;
              const frame = Math.abs(u) > 3.7 || Math.abs(u) < 0.6 || wz < -3 || wz > 3.4 || Math.abs(wz) < 0.5;
              if (pane && !frame) {
                const gi = wz > 1 ? 3 : 1;
                glass.push([px, py, gi]);
                c = GLASS_DAY[gi]!;
              } else if (pane || (front && z < d.eave - 9)) c = st.trim;
              else c = rampAt(st.wall, front ? 0.78 : 0.4, px, py);
              if (front && Math.abs(u) > 9) c = st.trim;
            }
            put(ctx, px, py, c);
            dormerHit = true;
            break;
          }
          if (dormerHit) break;
          if (!inFoot(x, y)) continue;
          const rz = roofZ(x, y);
          if (z > rz) continue;
          const slab = z >= rz - 3;
          if (slab) {
            const edge = z < rz - 0.75; // fascia/barge board (the slab's thickness)
            if (edge) {
              put(ctx, px, py, alongX ? (y > mid ? st.trim : R0[0]!) : x > mid ? st.trim : R0[0]!);
              break;
            }
            // roof surface: courses run along the ridge (of the cross-gable wing where that is the higher surface)
            const onWing = !!wing && wingZ(x, y) > mainZ(x, y);
            const ridgeX = onWing ? !alongX : alongX,
              ridgeAt = onWing ? wing!.a : mid;
            const along = ridgeX ? x : y,
              down = Math.abs((ridgeX ? y : x) - ridgeAt);
            const side = (ridgeX ? y : x) > ridgeAt ? 1 : -1; // +1 = south/east slope (faces the camera)
            const lit = ridgeX ? (side > 0 ? 0.18 : -0.02) : side > 0 ? -0.25 : 0.12;
            const dpx =
                shape === 'gable' || shape === 'flat' ? down * 16 : (1 - Math.min(1, (rz - zE) / rise)) * span * 16,
              apx = along * 16;
            let t = 0.55 + lit;
            let c: number;
            if (
              (shape === 'gable' || shape === 'hip') &&
              form !== 'barrel' &&
              form !== 'swoop' &&
              Math.abs(down) < 0.12
            ) {
              c = rampAt(R0, 0.85 + lit, px, py);
              put(ctx, px, py, c);
              break;
            } // ridge cap
            if (realm === 'cave') {
              const rib = Math.floor(apx) % 32;
              t += (rib < 3 ? 0.32 : rib < 5 ? -0.2 : 0) + (Math.floor(dpx) % 7 === 0 ? -0.12 : 0);
            } else if (realm === 'sea') {
              const rib = Math.floor(apx) % 24;
              t += (rib < 2 ? 0.25 : 0) + (Math.floor(dpx) % 6 === 0 ? -0.12 : 0);
            } else if (rk === 'thatch') {
              const strand = hash2(seed, Math.floor(apx / 3), Math.floor(dpx / 4), 9);
              const course = Math.floor(dpx) % 10;
              t += (strand - 0.5) * 0.14 + (course === 0 ? -0.18 : course < 2 ? 0.1 : 0);
            } else {
              const rowH = rk === 'slate' ? 6 : rk === 'tile' ? 5 : 5;
              const row = Math.floor(dpx / rowH);
              const len = rk === 'tile' ? 8 : rk === 'slate' ? 11 : 8;
              const off = (row % 2) * (len / 2);
              const k = Math.floor((apx + off) / len);
              const fr = apx + off - k * len,
                fz = dpx - row * rowH;
              if (rk === 'tile') {
                // scalloped clay tiles: each tile is a rounded fish-scale lit from the upper left, overlapped by the next row
                const u = (fr / len - 0.5) * 2,
                  v = fz / rowH;
                const arc = 0.5 + 0.5 * Math.sqrt(Math.max(0, 1 - u * u));
                if (v > arc) t -= 0.34;
                else if (v > arc - 0.24) t -= 0.14;
                else t += 0.1 * (1 - v) - u * 0.05 + (hash2(seed, k, row, 10) - 0.5) * 0.22;
              } else if (fz < 0.7)
                t -= 0.18; // course shadow line
              else {
                if (fr < 0.7) t -= 0.14;
                t += (hash2(seed, k, row, 10) - 0.5) * 0.16 + (fz > rowH - 1.5 ? 0.1 : 0);
              }
              if (rk === 'shingle' && hash2(seed, k, row, 11) > 0.93) t -= 0.25; // the odd mossy shingle
            }
            // eave darkening: the lowest course reads as an overhang
            if (dpx > span * 16 - 3) t -= 0.18;
            c = rampAt(R0, t, px, py);
            put(ctx, px, py, c);
            break;
          }
          // below the slab: the gable wall (only the part above the walls, inside the wall footprint)
          if (shape === 'gable' && z >= zE && inWalls(x, y)) {
            let gableFace: 'east' | 'south' | null = alongX
              ? x > b.x + b.w - 0.05
                ? 'east'
                : null
              : y > b.y + b.h - 0.05
                ? 'south'
                : null;
            let cu = mid,
              zMid = zE + rise * 0.35;
            // the cross-gable wing shows its own triangle on the street side
            if (wing) {
              const a = alongX ? x : y;
              if (alongX ? y > b.y + b.h - 0.05 : x > b.x + b.w - 0.05) {
                if (Math.abs(a - wing.a) <= wing.half) {
                  gableFace = alongX ? 'south' : 'east';
                  cu = wing.a;
                  zMid = zE + wing.rise * 0.35;
                } else if (!gableFace) continue;
              }
            }
            if (!gableFace) continue;
            const u = gableFace === 'east' ? y : x;
            if (church) {
              // a rose window high in the west front: a ring of coloured lights round a golden boss
              const rz = zE + rise * 0.42,
                rr = Math.hypot((u - cu) * 16, z - rz);
              if (rr < 9) {
                const ang = Math.atan2(z - rz, (u - cu) * 16);
                const petal = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 12);
                put(
                  ctx,
                  px,
                  py,
                  rr > 8
                    ? C.fog
                    : rr < 2
                      ? C.c4
                      : Math.abs(((ang + Math.PI) / (Math.PI * 2)) * 12 - petal - 0.5) > 0.4
                        ? C.slate
                        : [C.b0, C.c1, C.c4, C.n2, C.q2, C.t1][petal % 6]!,
                );
                break;
              }
            }
            const win = Math.abs(u - cu) < 0.32 && Math.abs(z - zMid) < 5;
            let c: number;
            if (win) {
              const r = Math.hypot((u - cu) * 16, z - zMid);
              c =
                r > 4.2
                  ? C.e1
                  : r < 1 || Math.abs((u - cu) * 16) < 0.5 || Math.abs(z - zMid) < 0.5
                    ? C.e1
                    : z > zMid
                      ? C.w4
                      : C.w2;
            } else if (st.kind === 'stone') c = rampAt(st.wall, gableFace === 'east' ? 0.35 : 0.65, px, py);
            else {
              const boards = Math.floor((u * 16) / 3);
              c =
                Math.floor(u * 16) % 3 === 0
                  ? C.e1
                  : rampAt(
                      [C.e1, C.e2, C.e3, C.e4],
                      (gableFace === 'east' ? 0.35 : 0.7) + (hash2(seed, boards, 0, 12) - 0.5) * 0.25,
                      px,
                      py,
                    );
            }
            put(ctx, px, py, c);
            break;
          }
        }
      }
    if (hasCanopy) {
      const iso = new Iso(ctx, -L, -top);
      const u = b.doorX * 16 - 4,
        v = (b.y + b.h) * 16 - 1;
      // Cantilevered entry cover: a sloping plane with actual fascia and brackets.
      for (const x of [u + 1, u + 23]) iso.line3(x, v, 24, x, v + 11, 31, C.e1);
      iso.para(iso.X(u, v), iso.Y(u, v, 36), 24, 12, -12, 10, (s, t) => {
        if (b.kind === 'inn' || b.id === 'bakery')
          return Math.floor(s * 6) % 2 ? (t > 0.8 ? C.e5 : C.e7) : t > 0.8 ? C.r1 : C.r2;
        return Math.floor(t * 12) % 4 === 0 ? R0[1]! : R0[3]!;
      });
      iso.left(u, v + 12, 30, 24, 2, st.trim);
    }
    for (const d of dormers) windows.push({ x: alongX ? d.a : d.n1, y: alongX ? d.n1 : d.a });
  });
  const night = glass.length ? makeCanvas(w, h) : null;
  if (night) {
    night.ctx.drawImage(canvas, 0, 0);
    for (const [x, y, gi] of glass) put(night.ctx, x, y, GLASS_NIGHT[gi]!);
  }
  const chimney = ch
    ? { x: (ch.x0 + ch.s / 2 - (ch.y0 + ch.s / 2)) * 16, y: (ch.x0 + ch.y0 + ch.s) * 8 - chTop }
    : null;
  return { canvas, left: L, top, chimney, windows, night: night?.canvas ?? null };
}

const SIGN: Record<string, { text: string; icon: (ctx: Ctx, x: number, y: number) => void; board: Ramp }> = {
  bakery: {
    text: 'BAKER',
    board: [C.e0, C.e1, C.e2, C.e3],
    icon: (c, x, y) => {
      put(c, x + 1, y + 3, C.e4, 8, 4);
      put(c, x + 2, y + 2, C.e6, 6, 3);
      for (const dx of [3, 6]) put(c, x + dx, y + 2, C.e3, 1, 2);
    },
  },
  library: {
    text: 'BOOKS',
    board: [C.w0, C.w1, C.w2, C.w3],
    icon: (c, x, y) => {
      put(c, x, y + 1, C.e2, 9, 7);
      put(c, x + 1, y + 1, C.pale, 7, 5);
      put(c, x + 4, y + 1, C.e4, 1, 6);
    },
  },
  herbalist: {
    text: 'HERBS',
    board: [C.g0, C.g1, C.g2, C.g3],
    icon: (c, x, y) => {
      put(c, x + 4, y, C.g5, 1, 6);
      put(c, x + 2, y + 1, C.g4, 2, 2);
      put(c, x + 5, y + 2, C.g6, 2, 2);
      put(c, x + 2, y + 5, C.r3, 5, 3);
    },
  },
  tailor: {
    text: 'CLOTH',
    board: [C.r0, C.r1, C.r2, C.r3],
    icon: (c, x, y) => {
      put(c, x + 1, y + 2, C.w4, 7, 3);
      put(c, x + 3, y + 1, C.w5, 3, 7);
      put(c, x + 4, y + 1, C.pale, 1, 2);
    },
  },
  smithy: {
    text: 'SMITH',
    board: [C.e0, C.e1, C.e2, C.e3],
    icon: (c, x, y) => {
      put(c, x, y + 2, C.fog, 9, 2);
      put(c, x + 2, y + 4, C.mist, 4, 2);
      put(c, x + 1, y + 6, C.mist, 6, 1);
      put(c, x - 1, y + 2, C.fog, 2, 1);
    },
  },
  store: {
    text: 'SHOP',
    board: [C.g0, C.g1, C.g2, C.g3],
    icon: (c, x, y) => {
      put(c, x + 1, y + 2, C.e5, 7, 5);
      put(c, x + 2, y + 1, C.e4, 5, 1);
      put(c, x + 3, y, C.e2, 3, 1);
      put(c, x + 3, y + 4, C.e7, 3, 1);
    },
  },
  inn: {
    text: 'INN',
    board: [C.r0, C.r1, C.r2, C.r3],
    icon: (c, x, y) => {
      put(c, x + 1, y + 1, C.r6, 6, 6);
      put(c, x + 1, y, C.white, 6, 2);
      put(c, x + 7, y + 2, C.r5, 2, 1);
      put(c, x + 8, y + 3, C.r5, 1, 2);
      put(c, x + 7, y + 5, C.r5, 2, 1);
    },
  },
  hall: {
    text: 'HALL',
    board: [C.w0, C.w1, C.w2, C.w3],
    icon: (c, x, y) => {
      put(c, x + 3, y, C.r6, 3, 1);
      put(c, x + 2, y + 1, C.r6, 5, 4);
      put(c, x + 1, y + 5, C.r5, 7, 1);
      put(c, x + 4, y + 6, C.r4, 1, 1);
    },
  },
  farmhouse: {
    text: 'FARM',
    board: [C.e1, C.e2, C.e3, C.e4],
    icon: (c, x, y) => {
      put(c, x + 4, y, C.g5, 1, 6);
      put(c, x + 2, y + 1, C.g4, 2, 2);
      put(c, x + 5, y + 2, C.g4, 2, 2);
      put(c, x + 3, y + 6, C.e5, 3, 1);
    },
  },
};

function signTexture(kind: string): HTMLCanvasElement | null {
  const s = SIGN[kind];
  if (!s) return null;
  const tw = bigTextWidth(s.text);
  const bw = tw + 18,
    bh = 13;
  const { canvas, ctx } = makeCanvas(bw + 4, bh + 8);
  // bracket + chains
  put(ctx, 0, 1, C.slate, bw + 4, 2);
  put(ctx, 0, 1, C.steel, bw + 4, 1);
  put(ctx, 3, 3, C.slate, 1, 3);
  put(ctx, bw, 3, C.slate, 1, 3);
  for (let y = 6; y < 6 + bh; y++)
    for (let x = 1; x < bw + 3; x++) {
      const edge = y === 6 || y === 5 + bh || x === 1 || x === bw + 2;
      put(ctx, x, y, edge ? s.board[0]! : rampAt(s.board, 0.85 - (y - 6) / 18, x, y));
    }
  put(ctx, 2, 7, s.board[3]!, bw, 1);
  s.icon(ctx, 4, 9);
  bigTextC(ctx, s.text, 14 + tw / 2 + 0.5, 9, C.e7, s.board[0]!);
  return canvas;
}

/** Build every texture for one building (call lazily; ~tens of ms). */
export function buildBuildingArt(b: Building): BuildingArt {
  return undithered(() => buildBuildingArtInner(b));
}
function buildBuildingArtInner(b: Building): BuildingArt {
  const seed = b.x * 31 + b.y * 17;
  const st = styleFor(b);
  const x1 = b.x + b.w,
    y1 = b.y + b.h;
  const walls: WallPiece[] = [];
  const windows: Array<{ x: number; y: number }> = [];
  const outerMat = wallMat(b, st, seed, false, st.timber ? st.timber[1]! : C.slate);
  const innerMat = wallMat(b, st, seed, true, st.timber ? st.timber[1]! : C.slate);
  const cutMat: Mat = (face, x, y, z) => (face === 'top' ? C.fog : outerMat(face, x, y, z));
  const ring: Array<[number, number]> = [];
  for (let tx = b.x; tx < x1; tx++) {
    ring.push([tx, b.y]);
    ring.push([tx, y1 - 1]);
  }
  for (let ty = b.y + 1; ty < y1 - 1; ty++) {
    ring.push([b.x, ty]);
    ring.push([x1 - 1, ty]);
  }
  for (const [tx, ty] of ring) {
    const south = ty === y1 - 1,
      east = tx === x1 - 1,
      north = ty === b.y,
      west = tx === b.x;
    const front = south || east;
    const door = south && tx === b.doorX;
    const boxes = (zTop: number, mat: Mat, inner: Mat): Box[] => {
      const out: Box[] = [];
      // back strips first (painter's order: far to near)
      if (north && !east) out.push({ x0: tx, x1: tx + 1, y0: ty, y1: ty + T, z0: 0, z1: WALL_H, mat: inner });
      if (west && !south)
        out.push({ x0: tx, x1: tx + T, y0: north ? ty + T : ty, y1: ty + 1, z0: 0, z1: WALL_H, mat: inner });
      if (north && east) out.push({ x0: tx, x1: tx + 1 - T, y0: ty, y1: ty + T, z0: 0, z1: WALL_H, mat: inner });
      if (west && south) out.push({ x0: tx, x1: tx + T, y0: ty, y1: ty + 1 - T, z0: 0, z1: WALL_H, mat: inner });
      if (east) out.push({ x0: tx + 1 - T, x1: tx + 1, y0: ty, y1: south ? ty + 1 - T : ty + 1, z0: 0, z1: zTop, mat });
      if (south) {
        if (door) {
          out.push({ x0: tx, x1: tx + 0.12, y0: ty + 1 - T, y1: ty + 1, z0: 0, z1: zTop, mat });
          out.push({ x0: tx + 0.88, x1: tx + 1, y0: ty + 1 - T, y1: ty + 1, z0: 0, z1: zTop, mat });
          if (zTop > 34)
            out.push({
              x0: tx,
              x1: tx + 1,
              y0: ty + 1 - T,
              y1: ty + 1,
              z0: 34,
              z1: zTop,
              mat: (f, x, y, z) =>
                f === 'top'
                  ? mat(f, x, y, z)
                  : z < 36
                    ? C.e1
                    : z > zTop - 2
                      ? C.e2
                      : rampAt([C.e1, C.e2, C.e3, C.e4], 0.6, Math.floor(x * 16), Math.floor(z)),
            });
          out.push({
            x0: tx + 0.12,
            x1: tx + 0.88,
            y0: ty + 1 - T,
            y1: ty + 1,
            z0: 0,
            z1: 1.5,
            mat: (f) => (f === 'top' ? C.fog : C.steel),
          });
        } else out.push({ x0: tx, x1: east ? tx + 1 - T : tx + 1, y0: ty + 1 - T, y1: ty + 1, z0: 0, z1: zTop, mat });
        if (east) out.push({ x0: tx + 1 - T, x1: tx + 1, y0: ty + 1 - T, y1: ty + 1, z0: 0, z1: zTop, mat });
      }
      // Window boxes are real projected volumes, attached below the sill.
      if (south && !east && !door && zTop > CUT_H && (tx - b.x) % 2 === 1) {
        out.push({
          x0: tx + 0.2,
          x1: tx + 0.8,
          y0: ty + 0.93,
          y1: ty + 1.18,
          z0: 11,
          z1: 15,
          mat: (f, x, y, z) =>
            f === 'top'
              ? hash2(seed, Math.floor(x * 16), Math.floor(y * 16), 17) > 0.7
                ? C.r6
                : C.g3
              : z < 12
                ? C.e1
                : f === 'south'
                  ? C.e4
                  : C.e2,
        });
      }
      return out;
    };
    const left = (tx - ty - 1) * 16 - 4,
      top = (tx + ty) * 8 - WALL_H - 2;
    const W = 40,
      H = 16 + WALL_H + 7;
    const render = (zTop: number, mat: Mat, night: boolean) => {
      const { canvas, ctx } = makeCanvas(W, H);
      const glass: Array<[number, number, number]> = [];
      rasterPixels(ctx, W, H, () => {
        drawBoxes(ctx, W, H, left, top, boxes(zTop, mat, innerMat), glass);
        if (night) for (const [px, py, gi] of glass) put(ctx, px, py, GLASS_NIGHT[gi]!);
      });
      return { canvas, glass };
    };
    const dayR = render(WALL_H, outerMat, false);
    const nightR = render(WALL_H, outerMat, true);
    const cut = front ? tex(render(CUT_H, cutMat, false).canvas) : null;
    walls.push({ tx, ty, front, x: left, y: top, day: tex(dayR.canvas), night: tex(nightR.canvas), cut, door });
    // outside window lights on the front faces
    if (front && dayR.glass.length > 8)
      windows.push({ x: south ? tx + 0.5 : tx + 1.3, y: south ? ty + 1.3 : ty + 0.5 });
  }

  // roof
  const rf = buildRoof(b, st, seed);
  const chimney = rf.chimney;
  windows.push(...rf.windows);

  // ground shadow: footprint smeared to the lower right (light from the top-left)
  const sx0 = (b.x - y1) * 16 - 2,
    sx1 = (x1 + 2.2 - b.y) * 16 + 2,
    sy0 = (b.x + b.y) * 8 - 2,
    sy1 = (x1 + 2.2 + y1 + 0.6) * 8 + 2;
  const sw = Math.ceil(sx1 - sx0),
    shh = Math.ceil(sy1 - sy0);
  const sc = makeCanvas(sw, shh);
  rasterPixels(sc.ctx, sw, shh, () => {
    for (let py = 0; py < shh; py++)
      for (let px = 0; px < sw; px++) {
        const P = (px + 0.5 + sx0) / 16,
          Q = (py + 0.5 + sy0) / 8;
        const x = (Q + P) / 2,
          y = (Q - P) / 2;
        // inside the union of the footprint swept along (+2.2, +0.6)
        let hit = false;
        for (let k = 0; k <= 1 && !hit; k += 0.1) {
          const dx = 2.2 * k,
            dy = 0.6 * k;
          if (x >= b.x + dx && x <= x1 + dx && y >= b.y + dy && y <= y1 + dy) hit = true;
        }
        if (hit && !(x >= b.x && x <= x1 && y >= b.y && y <= y1)) put(sc.ctx, px, py, C.q0);
      }
  });
  const sign = signTexture(SIGN[b.id] ? b.id : b.kind);
  return {
    walls,
    roof: { tex: tex(rf.canvas), night: rf.night ? tex(rf.night) : null, x: rf.left, y: rf.top },
    shadow: { tex: tex(sc.canvas), x: sx0, y: sy0 },
    sign: sign
      ? {
          tex: tex(sign),
          x: (b.doorX + 1.35 - (y1 + 0.15)) * 16 - 2,
          y: (b.doorX + 1.35 + y1 + 0.15) * 8 - 38,
          tx: b.doorX + 1.4,
          ty: y1 + 0.2,
        }
      : null,
    chimney,
    windows,
  };
}
