/**
 * Hair, hats and beards, modelled as small volumes around the skull and ray-cast with the game's camera, so one cut
 * reads correctly from all eight directions (a front-view drawing cannot be mirrored or rotated into a back view).
 *
 * Head space: a = forward, b = right, z = up, origin at the skull's centre (4 rows above the chin), art pixels. The
 * skull is an ellipsoid of radii (3.5, 3.6, 4.0). A cut is the part of a shell around it that lies above a hairline
 * (high over the brow, lower at the temples, at the nape behind), plus extra volumes (long hair, tails, buns, braids).
 *
 * The result is a stamp: per pixel around the head's centre, a ramp tone, a material and the surface's nearness to the
 * camera, so hair falling down the back hides behind the body and a fringe sits over the face.
 */
import { frameOf } from './skeleton';

export type CutId =
  | 'bald'
  | 'buzz'
  | 'short'
  | 'crop'
  | 'side_part'
  | 'swept'
  | 'quiff'
  | 'spiky'
  | 'messy'
  | 'curly'
  | 'afro'
  | 'mohawk'
  | 'bob'
  | 'shoulder'
  | 'long'
  | 'long_wavy'
  | 'ponytail'
  | 'high_pony'
  | 'bun'
  | 'top_knot'
  | 'braids'
  | 'braid_back'
  | 'twintail'
  | 'pigtail_buns'
  | 'undercut'
  | 'mullet'
  | 'fringe'
  | 'pixie'
  | 'receding';
/** the cuts in the order of the appearance index (1-based in the packed appearance; 0 = derive from the old style) */
export const CUTS: CutId[] = [
  'short',
  'buzz',
  'crop',
  'side_part',
  'swept',
  'quiff',
  'spiky',
  'messy',
  'curly',
  'afro',
  'mohawk',
  'bob',
  'shoulder',
  'long',
  'long_wavy',
  'ponytail',
  'high_pony',
  'bun',
  'top_knot',
  'braids',
  'braid_back',
  'twintail',
  'pigtail_buns',
  'undercut',
  'mullet',
  'fringe',
  'pixie',
  'receding',
  'bald',
];

export type HatId =
  'cap' | 'brim' | 'beret' | 'helm' | 'hood' | 'circlet' | 'bandana' | 'crown' | 'wizard' | 'straw' | 'tricorn';
export type BeardId = 'stubble' | 'short' | 'full' | 'long' | 'goatee' | 'moustache';

type V = [number, number, number];
/** material ids in a stamp */
export const M_HAIR = 1,
  M_HAT = 2,
  M_TRIM = 3,
  M_BEARD = 4,
  /** a sculpted (statue) head's own surface and its eye sockets */
  M_SKIN = 5,
  M_EYE = 6;

export interface StampPx {
  dx: number;
  dy: number;
  /** 0 dark .. 3 light */
  tone: number;
  mat: number;
  /** nearness to the camera relative to the skull's centre (body/skeleton.ts `project`) */
  depth: number;
}

interface Shape {
  inside(p: V): boolean;
  mat: number;
  /** centre used for the shading normal */
  c?: V;
  /** stripe the surface into strands */
  strands?: boolean;
}

const SKULL: V = [3.5, 3.6, 3.7];
const ell = (p: V, c: V, r: V) =>
  ((p[0] - c[0]) / r[0]) ** 2 + ((p[1] - c[1]) / r[1]) ** 2 + ((p[2] - c[2]) / r[2]) ** 2;
const inSkull = (p: V, grow = 0) => ell(p, [0, 0, 0], [SKULL[0] + grow, SKULL[1] + grow, SKULL[2] + grow]) <= 1;
function capsule(p: V, a: V, b: V, r0: number, r1 = r0): boolean {
  const d: V = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const l2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2 || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / l2));
  const r = r0 + (r1 - r0) * t;
  return (p[0] - a[0] - d[0] * t) ** 2 + (p[1] - a[1] - d[1] * t) ** 2 + (p[2] - a[2] - d[2] * t) ** 2 <= r * r;
}

interface Cut {
  /** shell thickness over the skull */
  vol: number;
  /** hairline height (head space z) at the brow, the temples and the nape */
  front: number;
  side: number;
  back: number;
  /** a fringe (bangs) reaching down to this z over the forehead */
  bangs?: number;
  /** spikes / curls / tousle on the outer surface */
  spikes?: number;
  curls?: number;
  messy?: number;
  /** only a strip of this half-width along the crown (mohawk), the sides shaved to `shaved` thickness */
  strip?: number;
  shaved?: number;
  /** hair hanging down to this z (below the chin is negative), and how far it spreads */
  drape?: number;
  drapeW?: number;
  wavy?: boolean;
  /** extra volumes */
  extra?: Array<(p: V) => boolean>;
  /** a side parting: which side the hair sweeps toward */
  part?: number;
  /** top lift (quiff) */
  lift?: number;
}

const CUT: Record<CutId, Cut | null> = {
  bald: null,
  buzz: { vol: 0.35, front: 1.6, side: 0.4, back: -1.2 },
  short: { vol: 0.8, front: 1.5, side: 0.2, back: -1.8 },
  crop: { vol: 0.6, front: 1.2, side: 0.4, back: -1.5, bangs: 1.0 },
  side_part: { vol: 0.9, front: 1.4, side: 0.0, back: -1.8, part: 1 },
  swept: { vol: 1.0, front: 1.3, side: 0.0, back: -2.0, part: -1, lift: 0.6 },
  quiff: { vol: 0.8, front: 1.6, side: 0.4, back: -1.6, lift: 1.6 },
  spiky: { vol: 0.9, front: 1.5, side: 0.4, back: -1.6, spikes: 1.4 },
  messy: { vol: 1.1, front: 0.9, side: -0.4, back: -2.2, messy: 0.8, bangs: 0.6 },
  curly: { vol: 1.3, front: 1.2, side: -0.6, back: -2.4, curls: 0.7 },
  afro: { vol: 2.4, front: 1.4, side: -1.0, back: -2.8, curls: 0.6 },
  mohawk: { vol: 0.5, front: 1.8, side: 0.2, back: -1.4, strip: 1.1, shaved: 0.2, spikes: 0.9, lift: 1.4 },
  bob: { vol: 1.2, front: 1.0, side: -3.2, back: -3.6, bangs: 0.8, drapeW: 0.4 },
  shoulder: { vol: 0.9, front: 1.4, side: -3.0, back: -3.0, drape: -6.5, drapeW: 3.3 },
  long: { vol: 0.9, front: 1.5, side: -3.0, back: -3.0, drape: -10, drapeW: 3.3 },
  long_wavy: { vol: 1.1, front: 1.4, side: -3.0, back: -3.0, drape: -10, drapeW: 3.7, wavy: true },
  ponytail: {
    vol: 0.9,
    front: 1.6,
    side: 0.0,
    back: -1.6,
    extra: [(p) => capsule(p, [-3.6, 0, 0.6], [-4.6, 0, -8.5], 1.5, 0.9)],
  },
  high_pony: {
    vol: 0.9,
    front: 1.6,
    side: 0.0,
    back: -1.4,
    extra: [
      (p) => capsule(p, [-3.2, 0, 3.0], [-5.2, 0, -5.0], 1.5, 0.8),
      (p) => ell(p, [-3.2, 0, 3.0], [1.4, 1.4, 1.2]) <= 1,
    ],
  },
  bun: { vol: 0.9, front: 1.6, side: 0.0, back: -1.6, extra: [(p) => ell(p, [-3.4, 0, 1.6], [1.8, 1.9, 1.8]) <= 1] },
  top_knot: {
    vol: 0.8,
    front: 1.6,
    side: 0.2,
    back: -1.5,
    extra: [(p) => ell(p, [-1.0, 0, 5.4], [1.6, 1.6, 1.5]) <= 1],
  },
  braids: {
    vol: 0.9,
    front: 1.5,
    side: -1.0,
    back: -2.0,
    extra: [
      (p) => capsule(p, [-0.6, -3.6, -1.6], [0.6, -3.4, -9.5], 1.0, 0.7),
      (p) => capsule(p, [-0.6, 3.6, -1.6], [0.6, 3.4, -9.5], 1.0, 0.7),
    ],
  },
  braid_back: {
    vol: 0.9,
    front: 1.6,
    side: 0.0,
    back: -1.8,
    extra: [(p) => capsule(p, [-3.6, 0, -0.6], [-4.0, 0, -10.5], 1.2, 0.7)],
  },
  twintail: {
    vol: 0.9,
    front: 1.5,
    side: 0.0,
    back: -1.8,
    bangs: 0.6,
    extra: [
      (p) => capsule(p, [-1.6, -3.6, 1.6], [-2.6, -4.6, -7.5], 1.3, 0.8),
      (p) => capsule(p, [-1.6, 3.6, 1.6], [-2.6, 4.6, -7.5], 1.3, 0.8),
    ],
  },
  pigtail_buns: {
    vol: 0.9,
    front: 1.5,
    side: 0.0,
    back: -1.8,
    bangs: 0.8,
    extra: [
      (p) => ell(p, [-1.2, -3.4, 3.0], [1.5, 1.5, 1.5]) <= 1,
      (p) => ell(p, [-1.2, 3.4, 3.0], [1.5, 1.5, 1.5]) <= 1,
    ],
  },
  undercut: { vol: 1.0, front: 1.6, side: 1.8, back: 1.2, shaved: 0.25, part: 1, lift: 0.6 },
  mullet: { vol: 0.9, front: 1.4, side: -0.6, back: -3.0, drape: -6.5, drapeW: 2.6 },
  fringe: { vol: 1.0, front: 0.6, side: -1.8, back: -2.6, bangs: -0.4 },
  pixie: { vol: 0.8, front: 1.0, side: -0.8, back: -1.6, bangs: 0.6, part: -1 },
  receding: { vol: 0.6, front: 3.2, side: 0.0, back: -1.6 },
};

/** the hairline height at the direction (a, b) around the head */
function hairline(c: Cut, a: number, b: number): number {
  const l = Math.hypot(a, b) || 1;
  const f = a / l;
  return f >= 0 ? c.side + (c.front - c.side) * f : c.side + (c.back - c.side) * -f;
}

function cutShapes(id: CutId): Shape[] {
  const c = CUT[id];
  if (!c) return [];
  const out: Shape[] = [];
  const v = c.vol;
  out.push({
    mat: M_HAIR,
    strands: true,
    inside(p) {
      let g = v;
      const l = Math.hypot(p[0], p[1], p[2]) || 1;
      const up = p[2] / l;
      if (c.lift && p[0] > -1) g += c.lift * Math.max(0, up) * Math.max(0, p[0] / 3.5 + 0.3);
      if (c.spikes)
        g += c.spikes * Math.max(0, up + 0.2) * (0.5 + 0.5 * Math.sin(Math.atan2(p[1], p[0]) * 5 + p[2] * 1.3));
      if (c.curls) g += c.curls * (0.5 + 0.5 * Math.sin(p[0] * 2.1 + p[2] * 1.7) * Math.sin(p[1] * 2.3 - p[2] * 1.1));
      if (c.messy) g += c.messy * Math.max(0, Math.sin(p[1] * 2.7 + p[0] * 1.3) * Math.cos(p[2] * 1.9));
      if (c.part) g += 0.35 * Math.max(0, up) * (p[1] * c.part > 0 ? 1 : -0.4);
      if (c.strip !== undefined && Math.abs(p[1]) > c.strip) g = c.shaved ?? 0.2;
      else if (c.shaved !== undefined && c.strip === undefined && p[2] < c.side + 1.2 && p[0] < 2.5) g = c.shaved;
      if (!inSkull(p, g)) return false;
      let line = hairline(c, p[0], p[1]);
      if (c.bangs !== undefined && p[0] > 0.8) line = Math.min(line, c.bangs + (0.6 * Math.abs(p[1])) / 3.6);
      if (c.shaved !== undefined && c.strip === undefined && g === c.shaved) line = Math.min(line, c.back + 0.5);
      return p[2] >= line;
    },
  });
  // hair falling past the jaw: a soft sheet behind the head, curving around the shoulders
  if (c.drape !== undefined || c.drapeW !== undefined) {
    const bottom = c.drape ?? -4.6,
      w = c.drapeW ?? 3.8;
    out.push({
      mat: M_HAIR,
      strands: true,
      c: [-1.5, 0, (bottom + 1) / 2],
      inside(p) {
        if (p[2] > 1 || p[2] < bottom) return false;
        const k = (1 - p[2]) / (1 - bottom);
        const wave = c.wavy ? 0.5 * Math.sin(p[2] * 1.4 + p[1]) : 0;
        const half = SKULL[1] + v * 0.8 + k * (w - SKULL[1]) * 0.6 + wave;
        if (Math.abs(p[1]) > half) return false;
        // in front, it stops at the cheeks (the face stays open)
        const front = 0.6 - k * 0.8 + (Math.abs(p[1]) > 2.6 ? 1.8 : -0.4);
        const back = -SKULL[0] - v - k * 0.4;
        return p[0] <= front && p[0] >= back && (p[2] < -3.3 ? p[0] <= -0.6 + (Math.abs(p[1]) > 2.4 ? 2.4 : 0) : true);
      },
    });
  }
  for (const e of c.extra ?? []) out.push({ mat: M_HAIR, strands: true, inside: e });
  return out;
}

function hatShapes(id: HatId): { shapes: Shape[]; hides: number } {
  // `hides`: hair above this head-space z is hidden by the hat
  switch (id) {
    case 'cap':
      return {
        hides: 0.8,
        shapes: [
          { mat: M_HAT, inside: (p) => inSkull(p, 0.7) && p[2] >= 0.8 },
          { mat: M_HAT, c: [4, 0, 1.4], inside: (p) => ell(p, [3.4, 0, 1.2], [2.6, 3.0, 0.45]) <= 1 && p[0] > 1.5 },
          { mat: M_TRIM, inside: (p) => inSkull(p, 0.9) && p[2] >= 0.8 && p[2] < 1.6 },
        ],
      };
    case 'brim':
    case 'straw':
      return {
        hides: 1.0,
        shapes: [
          { mat: M_HAT, inside: (p) => ell(p, [0, 0, 2.2], [3.6, 3.7, 3.4]) <= 1 && p[2] >= 1 },
          { mat: M_HAT, c: [0, 0, 3], inside: (p) => ell(p, [0, 0, 1.4], [6.4, 6.4, 0.6]) <= 1 },
          { mat: M_TRIM, inside: (p) => ell(p, [0, 0, 2.2], [3.8, 3.9, 3.4]) <= 1 && p[2] >= 1.7 && p[2] < 2.5 },
        ],
      };
    case 'beret':
      return {
        hides: 1.4,
        shapes: [
          { mat: M_HAT, inside: (p) => ell(p, [-0.4, 0.8, 3.0], [4.4, 4.4, 2.0]) <= 1 && p[2] >= 1.4 },
          { mat: M_TRIM, inside: (p) => inSkull(p, 0.5) && p[2] >= 1.2 && p[2] < 1.9 },
        ],
      };
    case 'helm':
      return {
        hides: -10,
        shapes: [
          { mat: M_HAT, inside: (p) => inSkull(p, 0.9) && (p[2] >= 0.6 || p[0] < 1.4) && p[2] > -3.4 },
          { mat: M_TRIM, inside: (p) => inSkull(p, 1.0) && p[2] >= 0.6 && p[2] < 1.4 },
          {
            mat: M_TRIM,
            inside: (p) => p[0] > 2.6 && Math.abs(p[1]) < 0.5 && p[2] < 1 && p[2] > -1.6 && inSkull(p, 1.0),
          },
          { mat: M_TRIM, inside: (p) => Math.abs(p[1]) < 0.6 && inSkull(p, 1.5) && p[2] > 2.2 },
        ],
      };
    case 'hood': {
      // the face opening, and a band of the hood's edge around it
      const open = (p: V, m = 0) => p[0] > 1.2 - m && Math.abs(p[1]) < 2.5 + m && p[2] < 1.6 + m && p[2] > -4.6 - m;
      const shell = (p: V) => inSkull(p, 1.1) || ell(p, [-1.2, 0, -4.6], [3.6, 5.2, 2.2]) <= 1;
      return {
        hides: -10,
        shapes: [
          { mat: M_TRIM, inside: (p) => shell(p) && !open(p) && open(p, 0.8) },
          { mat: M_HAT, inside: (p) => shell(p) && !open(p) },
        ],
      };
    }
    case 'circlet':
      return {
        hides: 99,
        shapes: [
          { mat: M_TRIM, inside: (p) => inSkull(p, 1.0) && !inSkull(p, 0.5) && p[2] >= 1.4 && p[2] < 2.2 },
          {
            mat: M_HAT,
            inside: (p) => p[0] > 3 && Math.abs(p[1]) < 0.7 && p[2] >= 1.4 && p[2] < 2.4 && inSkull(p, 1.2),
          },
        ],
      };
    case 'bandana':
      return {
        hides: 1.0,
        shapes: [
          { mat: M_HAT, inside: (p) => inSkull(p, 0.6) && p[2] >= 1.0 },
          { mat: M_HAT, inside: (p) => capsule(p, [-3.8, 0.4, 1.4], [-5.2, 1.4, -1.4], 0.7, 0.5) },
          { mat: M_TRIM, inside: (p) => inSkull(p, 0.7) && p[2] >= 1.0 && p[2] < 1.7 },
        ],
      };
    case 'crown':
      return {
        hides: 99,
        shapes: [
          {
            mat: M_TRIM,
            inside: (p) => {
              const r = Math.hypot(p[0] / 3.9, p[1] / 4.0);
              if (r > 1 || r < 0.78) return false;
              const peak = 3.6 + 1.4 * Math.max(0, Math.cos(Math.atan2(p[1], p[0]) * 5));
              return p[2] >= 2.0 && p[2] <= peak;
            },
          },
          { mat: M_HAT, inside: (p) => p[0] > 3.2 && Math.abs(p[1]) < 0.7 && p[2] >= 2.4 && p[2] < 3.2 },
        ],
      };
    case 'tricorn':
      // a low crown in a brim turned up on three sides, one corner over the brow
      return {
        hides: 1.0,
        shapes: [
          { mat: M_HAT, inside: (p) => ell(p, [0, 0, 2.0], [3.7, 3.8, 2.8]) <= 1 && p[2] >= 1.0 },
          {
            mat: M_HAT,
            c: [0, 0, 1],
            inside: (p) => {
              const r = Math.hypot(p[0], p[1]);
              const th = Math.atan2(p[1], p[0]);
              const reach = 4.6 + 1.5 * Math.max(0, Math.cos(3 * th));
              if (r < 3.2 || r > reach) return false;
              const lip = 1.1 + (r - 3.2) * 0.75 * (1 - 0.6 * Math.max(0, Math.cos(3 * th)));
              return p[2] >= lip - 0.7 && p[2] <= lip + 0.4;
            },
          },
          { mat: M_TRIM, inside: (p) => ell(p, [0, 0, 2.0], [3.9, 4.0, 2.8]) <= 1 && p[2] >= 1.2 && p[2] < 1.9 },
        ],
      };
    case 'wizard':
      return {
        hides: 1.0,
        shapes: [
          {
            mat: M_HAT,
            inside: (p) => {
              if (p[2] < 1.2 || p[2] > 11) return false;
              const k = (p[2] - 1.2) / 9.8;
              const r = 4.2 * (1 - k);
              return Math.hypot(p[0] + k * 2.4, p[1]) <= r;
            },
          },
          { mat: M_HAT, inside: (p) => ell(p, [0, 0, 1.4], [6.0, 6.0, 0.55]) <= 1 },
          { mat: M_TRIM, inside: (p) => p[2] >= 1.7 && p[2] < 2.5 && Math.hypot(p[0], p[1]) <= 4.1 },
        ],
      };
  }
}

function beardShapes(id: BeardId): Shape[] {
  const jaw = (p: V, grow: number, top: number, bottom: number, front = 0.6) =>
    inSkull(p, grow) && p[2] <= top && p[2] >= bottom && p[0] >= front && !inSkull(p, -0.1);
  switch (id) {
    case 'stubble':
      return [{ mat: M_BEARD, inside: (p) => jaw(p, 0.25, -1.8, -4.2) }];
    case 'short':
      return [
        {
          mat: M_BEARD,
          strands: true,
          inside: (p) => jaw(p, 0.6, -1.6, -4.6) || capsule(p, [3.2, 0, -4], [3.0, 0, -4.8], 1.6),
        },
      ];
    case 'full':
      return [
        {
          mat: M_BEARD,
          strands: true,
          inside: (p) => jaw(p, 0.9, -1.0, -5.0, 0) || capsule(p, [2.8, 0, -4.0], [2.6, 0, -5.8], 2.2, 1.6),
        },
      ];
    case 'long':
      return [
        {
          mat: M_BEARD,
          strands: true,
          inside: (p) => jaw(p, 0.9, -1.0, -5.0, 0) || capsule(p, [2.8, 0, -4.0], [3.4, 0, -8.6], 2.4, 1.0),
        },
      ];
    case 'goatee':
      return [{ mat: M_BEARD, inside: (p) => capsule(p, [3.4, 0, -3.4], [3.2, 0, -5.0], 1.1, 0.8) || moustache(p) }];
    case 'moustache':
      return [{ mat: M_BEARD, inside: moustache }];
  }
}
const moustache = (p: V) =>
  p[0] > 2.6 && Math.abs(p[1]) < 2.0 && p[2] <= -1.6 && p[2] >= -2.5 && inSkull(p, 0.7) && !inSkull(p, -0.2);

export interface HeadGear {
  cut?: CutId;
  hat?: HatId;
  beard?: BeardId;
}

const stamps = new Map<string, StampPx[]>();
/**
 * The head gear's pixels for a facing, relative to the skull centre's screen position. `k` scales the head (statues);
 * `sculpt` also returns the skull itself, with a nose and eye sockets, for a carved head that has no drawn face.
 */
export function headStamp(dir: number, g: HeadGear, k = 1, sculpt = false): StampPx[] {
  const key = `${dir}|${g.cut ?? ''}|${g.hat ?? ''}|${g.beard ?? ''}|${k}|${sculpt}`;
  let s = stamps.get(key);
  if (!s) {
    s = buildStamp(dir, g, k, sculpt);
    stamps.set(key, s);
  }
  return s;
}

const nose = (p: V) => capsule(p, [3.2, 0, -0.2], [3.9, 0, -1.5], 0.55, 0.5);
const socket = (p: V) => p[0] > 2.4 && Math.abs(Math.abs(p[1]) - 1.35) < 0.6 && p[2] < -0.2 && p[2] > -1.3;

function buildStamp(dir: number, g: HeadGear, k: number, sculpt: boolean): StampPx[] {
  const fr = frameOf(dir);
  const hat = g.hat ? hatShapes(g.hat) : null;
  const shapes: Shape[] = [];
  if (hat) shapes.push(...hat.shapes);
  for (const s of cutShapes(g.cut ?? 'bald')) {
    if (!hat) shapes.push(s);
    else shapes.push({ ...s, inside: (p) => p[2] < hat.hides && s.inside(p) });
  }
  if (g.beard) shapes.push(...beardShapes(g.beard));
  if (sculpt) {
    shapes.push({ mat: M_SKIN, c: [3.2, 0, -0.8], inside: nose });
    shapes.push({ mat: M_SKIN, inside: (p) => inSkull(p) && !socket(p) });
    shapes.push({ mat: M_EYE, inside: (p) => inSkull(p, 0.01) });
  }
  const out: StampPx[] = [];
  if (!shapes.length) return out;
  // the view ray through a screen pixel runs toward the camera along ground +y: in head space a = f_y, b = r_y
  // Faces are drawn near-frontal (body/heads.ts), as pixel artists draw them, so head gear is cast with a shallow
  // look-down too; the world's full 2:1 slope would drop a forehead hairline onto the eyes.
  const ray: V = [fr.f[1], fr.r[1], 0.18];
  const rl = Math.hypot(ray[0], ray[1], ray[2]);
  const rd: V = [ray[0] / rl, ray[1] / rl, ray[2] / rl];
  // a point on the screen pixel's ray, on the vertical plane through the head centre (ground y = 0):
  // G.x = X, G.y = 0, z = -Y  ->  a = X·f_x, b = X·r_x (the ray then runs along ground y, rising gently)
  const toHead = (X: number, Y: number): V => [X * fr.f[0], X * fr.r[0], -Y];
  const step = Math.min(0.25, 0.5 / k);
  for (let dy = -Math.ceil(16 * k); dy <= Math.ceil(14 * k); dy++)
    for (let dx = -Math.ceil(9 * k); dx <= Math.ceil(9 * k); dx++) {
      const o = toHead((dx + 0.5) / k, (dy + 0.5) / k);
      // march from the camera side to the far side
      let hit: { s: Shape; p: V } | null = null;
      for (let t = 9; t >= -9; t -= step) {
        const p: V = [o[0] + rd[0] * t, o[1] + rd[1] * t, o[2] + rd[2] * t];
        let found: Shape | null = null;
        for (const s of shapes)
          if (s.inside(p)) {
            found = s;
            break;
          }
        if (found) {
          hit = { s: found, p };
          break;
        }
        if (inSkull(p, -0.05)) break; // the face / scalp is in front
      }
      if (!hit) continue;
      const { s, p } = hit;
      // shading normal: from the shape's centre (or the skull's), lit from up and to the screen's left
      const c = s.c ?? [0, 0, 0];
      const n: V = [p[0] - c[0], p[1] - c[1], (p[2] - c[2]) * 0.9];
      const nl = Math.hypot(n[0], n[1], n[2]) || 1;
      const sx = (n[0] * fr.f[0] + n[1] * fr.r[0]) / nl; // screen-right component
      const cam = (n[0] * rd[0] + n[1] * rd[1] + n[2] * rd[2]) / nl;
      let lum = 0.45 + 0.4 * (n[2] / nl) - 0.35 * sx + 0.15 * cam;
      // strands: alternate bands around the head (and down long hair)
      if (s.strands && (Math.floor(Math.atan2(p[1], p[0]) * 4.5 + p[2] * 0.35) & 1) === 0) lum -= 0.16;
      const tone = lum > 0.72 ? 3 : lum > 0.42 ? 2 : lum > 0.14 ? 1 : 0;
      const depth = (0.866 * (p[0] * fr.f[1] + p[1] * fr.r[1]) + 0.5 * p[2]) * k;
      out.push({ dx, dy, tone: s.mat === M_EYE ? 0 : tone, mat: s.mat, depth });
    }
  return out;
}
