/**
 * Horizontal bar painter for the vitals HUD: each gauge is a beveled brass/stone trough filled left to right, drawn
 * with nearest-neighbour pixels from the fixed 48-colour palette (lit top-left edge, shaded bottom-right edge).
 */
import { C } from '@eigenlands/shared';
import { put as spx, rasterPixels, type Ctx } from '../art/shade';
import type { GaugeId, NeedTone } from './vitals-model';

interface VialStyle {
  /** bar length in art px */
  w: number;
  /** bar thickness in art px */
  h: number;
  /** liquid, dark → light: shaded, shadow, base, lit, highlight */
  liquid: readonly number[];
  /** frame: shade, lit, highlight */
  frame: readonly [number, number, number];
  ticks: number;
}

/** Horizontal gauges: a recessed trough with a brass or stone frame, filled left to right. */
export const VIAL_STYLES: Record<GaugeId, VialStyle> = {
  health: { w: 70, h: 9, liquid: [C.r0, C.r1, C.r2, C.r3, C.r5], frame: [C.e2, C.e4, C.e6], ticks: 3 },
  mana: { w: 70, h: 8, liquid: [C.q1, C.q2, C.q3, C.q4, C.q7], frame: [C.steel, C.mist, C.pale], ticks: 3 },
  stamina: { w: 70, h: 8, liquid: [C.g1, C.g2, C.g3, C.g5, C.g6], frame: [C.slate, C.steel, C.fog], ticks: 1 },
  food: { w: 70, h: 6, liquid: [C.e3, C.e4, C.r5, C.r6, C.r7], frame: [C.e1, C.e3, C.e5], ticks: 0 },
  water: { w: 70, h: 6, liquid: [C.w1, C.w2, C.w3, C.w4, C.w6], frame: [C.steel, C.mist, C.fog], ticks: 0 },
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
  /** dash charges lit on the frame (stamina bar only) */
  pips: number;
  pipMax: number;
  /** class resource is full (ultimate ready) */
  ready: boolean;
  /** seconds, drives pulses; 0 for reduced motion */
  t: number;
}

export interface VialPlace {
  id: GaugeId;
  /** top-left of the bar in canvas px */
  x: number;
  y: number;
  w: number;
  h: number;
}

const GAP = 3;
const PAD = 1;

/** Top-to-bottom stack of bars; pure so the DOM labels (one row each, `pitch` px tall) can follow it. */
export function vitalsLayout(ids: readonly GaugeId[]): { width: number; height: number; places: VialPlace[] } {
  let y = PAD;
  const places: VialPlace[] = [];
  let widest = 0;
  for (const id of ids) {
    const s = VIAL_STYLES[id];
    places.push({ id, x: PAD, y, w: s.w, h: s.h + 2 });
    y += s.h + 2 + GAP;
    widest = Math.max(widest, s.w);
  }
  return { width: widest + PAD * 2, height: Math.max(1, y - GAP + PAD), places };
}

const at = (r: readonly number[], i: number) => r[Math.max(0, Math.min(r.length - 1, i))]!;

function paintBar(ctx: Ctx, place: VialPlace, v: VialSpec): void {
  const s = VIAL_STYLES[v.id];
  const { w } = s,
    h = place.h;
  const x0 = place.x,
    y0 = place.y;
  const px = (x: number, y: number, c: number, ww = 1, hh = 1) => spx(ctx, x0 + x, y0 + y, c, ww, hh);
  const [fShade, fLit, fHi] = s.frame;
  const pulse = v.t > 0 && v.low ? (Math.sin(v.t * 7) > 0 ? 1 : 0) : v.low ? 1 : 0;
  const frameShade = pulse ? C.r2 : fShade,
    frameLit = pulse ? C.r4 : fLit,
    frameHi = pulse ? C.r6 : fHi;
  // frame: lit top/left, shaded bottom/right, corner studs
  px(0, 0, frameLit, w, h);
  px(0, 0, frameHi, w, 1);
  px(0, 0, frameHi, 1, h);
  px(0, h - 1, frameShade, w, 1);
  px(w - 1, 0, frameShade, 1, h);
  // trough
  const iw = w - 4,
    ih = h - 4,
    ix = 2,
    iy = 2;
  px(ix - 1, iy - 1, C.ink, iw + 2, ih + 2);
  px(ix, iy, C.night, iw, ih);
  const trailW = Math.round(v.trail * iw),
    fillW = Math.round(v.shown * iw);
  if (trailW > fillW) px(ix + fillW, iy, v.flash > 0 ? C.white : C.pale, trailW - fillW, ih);
  if (fillW > 0) {
    const dull = v.tone === 'low' ? 1 : 0;
    const body = v.flash > 0.45 ? C.pale : at(s.liquid, 2 - dull),
      lit = v.flash > 0.45 ? C.white : at(s.liquid, 3 - dull),
      shade = at(s.liquid, 1 - dull);
    px(ix, iy, body, fillW, ih);
    px(ix, iy, lit, fillW, 1); // lit upper edge
    if (ih > 4) px(ix, iy + ih - 1, shade, fillW, 1); // shaded lower edge
    if (fillW > 1) px(ix + fillW - 1, iy, at(s.liquid, 4), 1, ih); // meniscus at the leading edge
  }
  // gradation marks
  for (let k = 1; k <= s.ticks; k++) {
    const tx = ix + Math.round((iw * k) / (s.ticks + 1));
    px(tx, iy, tx < ix + fillW ? at(s.liquid, 0) : C.slate, 1, ih);
  }
  // dash charges: studs set into the right end of the frame
  for (let i = 0; i < v.pipMax; i++) px(w - 5 - i * 4, 0, i < v.pips ? C.g6 : C.night, 2, 1);
  // class resource full: a spark rides the leading edge
  if (v.id === 'mana' && v.ready) {
    const k = v.t > 0 ? Math.floor(v.t * 5) % 3 : 0;
    px(ix + iw - 2 - k, iy - 1, C.white);
    px(ix + iw - 1, iy + 1 + (k % 2), C.q7);
  }
  // circuit aura: a glass outline around the health bar
  if (v.aura) {
    const col = v.aura === 'shield' ? C.w6 : v.aura === 'ward' ? C.r6 : C.white;
    const blink = v.t > 0 && v.aura === 'mirror' && Math.floor(v.t * 6) % 2 === 0;
    const c = blink ? C.pale : col;
    px(-1, -1, c, w + 2, 1);
    px(-1, h, c, w + 2, 1);
    px(-1, -1, c, 1, h + 2);
    px(w, -1, c, 1, h + 2);
  }
}

/** Paint every bar onto `ctx` (a canvas of the layout's size); the canvas is cleared by the raster upload. */
export function renderVitals(
  ctx: Ctx,
  size: { width: number; height: number },
  places: readonly VialPlace[],
  specs: Readonly<Record<GaugeId, VialSpec>>,
): void {
  rasterPixels(ctx, size.width, size.height, () => {
    for (const p of places) paintBar(ctx, p, specs[p.id]);
  });
}
