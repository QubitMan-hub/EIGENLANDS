/**
 * Isometric vial painter for the vitals HUD. Each gauge is a small glass-and-metal prism built with the same Iso kit
 * the props use: 2:1 projection, a lit left face, a shaded right face, a top face, nearest-neighbour pixels and the
 * fixed 48-colour palette. Fill height is the gauge value, so the readout is a block rising out of a plinth, the same
 * visual language as the world's elevation.
 */
import { C } from '@eigenlands/shared';
import { Iso } from '../art/isokit';
import { rasterPixels, type Ctx } from '../art/shade';
import type { GaugeId, NeedTone } from './vitals-model';

interface VialStyle {
  /** footprint edge in tile units (screen width = 2w) */
  w: number;
  /** glass height in px */
  h: number;
  /** liquid, dark → light: shaded, shadow, base, lit, highlight */
  liquid: readonly number[];
  /** frame: shade, lit, highlight */
  frame: readonly [number, number, number];
  ticks: number;
}

export const VIAL_STYLES: Record<GaugeId, VialStyle> = {
  health: { w: 9, h: 22, liquid: [C.r0, C.r0, C.r1, C.r2, C.r3], frame: [C.e2, C.e4, C.e6], ticks: 3 },
  mana: { w: 6, h: 26, liquid: [C.q1, C.q2, C.q3, C.q4, C.q7], frame: [C.steel, C.mist, C.pale], ticks: 3 },
  stamina: { w: 6, h: 18, liquid: [C.g1, C.g2, C.g3, C.g5, C.g6], frame: [C.slate, C.steel, C.fog], ticks: 1 },
  food: { w: 5, h: 14, liquid: [C.e3, C.e4, C.r5, C.r6, C.r7], frame: [C.e1, C.e3, C.e5], ticks: 0 },
  water: { w: 5, h: 14, liquid: [C.w1, C.w2, C.w3, C.w4, C.w6], frame: [C.steel, C.mist, C.fog], ticks: 0 },
};

export interface VialSpec {
  id: GaugeId;
  shown: number;
  trail: number;
  flash: number;
  gain: number;
  /** warning state: low health, low need */
  low: boolean;
  tone: NeedTone;
  aura: 'shield' | 'ward' | 'mirror' | null;
  /** class resource is full (ultimate ready) */
  ready: boolean;
  /** seconds, drives pulses; 0 for reduced motion */
  t: number;
}

export interface VialPlace {
  id: GaugeId;
  /** screen centre of the prism and of its plinth's bottom corner */
  cx: number;
  bottom: number;
  w: number;
  h: number;
}

const PLINTH = 2;
const GAP = 5;
const SPIRE = 5;

/** Left-to-right row of vials on a shared ground line; pure so the DOM labels can follow it. */
export function vitalsLayout(ids: readonly GaugeId[]): { width: number; height: number; places: VialPlace[] } {
  let x = 1;
  const places: VialPlace[] = [];
  let tallest = 0;
  for (const id of ids) {
    const s = VIAL_STYLES[id];
    const half = s.w + 1;
    places.push({ id, cx: x + half, bottom: 0, w: s.w, h: s.h });
    x += half * 2 + GAP;
    tallest = Math.max(tallest, PLINTH + s.h + (id === 'mana' ? SPIRE : 0) + 1);
  }
  const maxFoot = Math.max(...ids.map((i) => VIAL_STYLES[i].w + 1), 0);
  const height = tallest + maxFoot + 3;
  for (const p of places) p.bottom = height - 1;
  return { width: Math.max(1, x - GAP + 1), height, places };
}

const at = (r: readonly number[], i: number) => r[Math.max(0, Math.min(r.length - 1, i))]!;

function paintVial(ctx: Ctx, place: VialPlace, v: VialSpec): void {
  const s = VIAL_STYLES[v.id];
  const { w, h } = s;
  // The prism's nearest bottom corner sits at (u,v)=(w+1,w+1), so the plinth footprint's bottom is the ground line.
  const iso = new Iso(ctx, place.cx, place.bottom - (w + 1));
  const [fShade, fLit, fHi] = s.frame;
  const pulse = v.t > 0 && v.low ? (Math.sin(v.t * 7) > 0 ? 1 : 0) : v.low ? 1 : 0;
  const frameShade = pulse ? C.r2 : fShade,
    frameLit = pulse ? C.r4 : fLit,
    frameHi = pulse ? C.r6 : fHi;
  const z0 = PLINTH;
  // carved stone plinth, one tile-step larger than the glass
  iso.box(-1, -1, 0, w + 2, w + 2, PLINTH, {
    top: (a, b) => (a < 0.1 || b < 0.1 ? C.mist : C.steel),
    left: (_a, b) => (b > 0.7 ? C.slate : C.steel),
    right: (_a, b) => (b > 0.7 ? C.night : C.slate),
  });
  const trailTop = v.trail * (h - 2.8),
    fillTop = v.shown * (h - 2.8);
  const liquidAt = (lit: boolean, inner: number): number => {
    if (v.flash > 0.45) return lit ? C.white : C.pale;
    const dull = v.tone === 'low' ? 1 : 0;
    const base = lit ? 3 : 1;
    if (inner > fillTop - 1.1) return at(s.liquid, lit ? 4 - dull : 2); // meniscus
    return at(s.liquid, base - dull + (inner < 2 ? -0 : 0));
  };
  const window = (lit: boolean): ((a: number, b: number) => number) => {
    return (a, b) => {
      const edgePx = Math.min(a, 1 - a) * w;
      const hz = b * h;
      if (edgePx < 1) return lit ? (a < 0.5 ? frameHi : frameLit) : a < 0.5 ? frameLit : frameShade; // corner posts
      if (hz < 1.2) return lit ? frameShade : C.night;
      if (hz > h - 1.6) return lit ? frameHi : frameLit;
      const inner = hz - 1.2;
      let col: number;
      if (inner <= fillTop) col = liquidAt(lit, inner);
      else if (inner <= trailTop) col = lit ? C.pale : C.fog;
      else col = lit ? C.night : C.ink;
      // glass glint on the lit face
      if (lit && edgePx > 1.4 && edgePx < 2.4 && inner > 2 && inner < h - 5 && inner > fillTop)
        col = col === C.night ? C.slate : col;
      // gradation marks
      for (let k = 1; k <= s.ticks; k++) {
        const th = ((h - 2.8) * k) / (s.ticks + 1);
        if (Math.abs(inner - th) < 0.5 && edgePx < 3.2)
          col = inner <= fillTop ? at(s.liquid, lit ? 1 : 0) : lit ? C.slate : C.night;
      }
      // leather band on the food flask
      if (v.id === 'food' && hz > h * 0.5 && hz < h * 0.5 + 2) col = lit ? C.e3 : C.e1;
      return col;
    };
  };
  iso.left(0, w, z0, w, h, window(true));
  iso.right(w, 0, z0, w, h, window(false));
  // top face: rim around the liquid surface
  iso.top(0, 0, z0 + h, w, w, (a, b) => {
    const rim = a * w < 1 || a * w > w - 1 || b * w < 1 || b * w > w - 1;
    if (rim) return v.id === 'water' || v.id === 'mana' ? frameHi : frameLit;
    if (v.shown <= 0.01) return C.night;
    return v.flash > 0.45 ? C.white : at(s.liquid, 4 - (v.tone === 'low' ? 1 : 0));
  });
  // corner rivets
  for (const [du, dv] of [
    [0, 0],
    [w, 0],
    [0, w],
    [w, w],
  ] as const)
    iso.dot(du, dv, z0 + h + 0.4, frameHi);
  // mana spire: a cut crystal that sparks when the resource is full
  if (v.id === 'mana') {
    const cu = w / 2;
    for (let i = 0; i < SPIRE; i++) iso.dot(cu, cu, z0 + h + 1 + i, i === SPIRE - 1 ? C.q7 : i % 2 ? C.q4 : C.q3);
    if (v.ready) {
      const k = v.t > 0 ? Math.floor(v.t * 5) % 3 : 0;
      iso.dot(cu - 2 + k, cu - 2 + k, z0 + h + SPIRE + 1 + (k % 2), C.white);
      iso.dot(cu + 1, cu + 1, z0 + h + SPIRE - 1, C.q7);
    }
  }
  // circuit aura: a glass cage of lines over the vial
  if (v.aura) {
    const col = v.aura === 'shield' ? C.w6 : v.aura === 'ward' ? C.r6 : C.white;
    const blink = v.t > 0 && v.aura === 'mirror' && Math.floor(v.t * 6) % 2 === 0;
    const zt = z0 + h + 3;
    const c = blink ? C.pale : col;
    iso.line3(-1, -1, zt, w + 1, -1, zt, c);
    iso.line3(w + 1, -1, zt, w + 1, w + 1, zt, c);
    iso.line3(w + 1, w + 1, zt, -1, w + 1, zt, c);
    iso.line3(-1, w + 1, zt, -1, -1, zt, c);
    for (const [du, dv] of [
      [-1, w + 1],
      [w + 1, w + 1],
      [w + 1, -1],
    ] as const)
      for (let z = z0 + 2; z < zt; z += 3) iso.dot(du, dv, z, c);
  }
}

/** Paint every vial onto `ctx` (a canvas of the layout's size); the canvas is cleared by the raster upload. */
export function renderVitals(
  ctx: Ctx,
  size: { width: number; height: number },
  places: readonly VialPlace[],
  specs: Readonly<Record<GaugeId, VialSpec>>,
): void {
  rasterPixels(ctx, size.width, size.height, () => {
    for (const p of places) paintVial(ctx, p, specs[p.id]);
  });
}
