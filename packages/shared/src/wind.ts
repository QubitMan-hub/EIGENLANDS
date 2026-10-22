import { hash2 } from './rng';
import type { Weather } from './weather';

/**
 * One global wind for the whole world: a slowly turning direction, a strength set by the weather, and gust fronts
 * that travel across the map. Everything is a pure function of (seed, world time, weather), so the server (sailing,
 * arrows) and every client agree, and the terrain shader mirrors `gust` exactly (see terrain.frag.ts).
 */
export interface Wind {
  /** unit direction the wind blows towards, in world (tile) axes */
  dx: number; dy: number;
  /** 0 calm .. 1 storm */
  strength: number;
}

const BASE: Record<Weather, number> = { clear: 0.28, cloudy: 0.42, rain: 0.6, storm: 1, snow: 0.38, fog: 0.1 };
const SLICE_S = 6 * 60; // the direction drifts to a new heading every 6 real minutes

const smooth = (a: number, b: number, t: number): number => a + (b - a) * t * t * (3 - 2 * t);

/** Direction + strength at world time `tSec` (seconds). */
export function windBase(seed: number, tSec: number, weather: Weather): Wind {
  const k = Math.floor(tSec / SLICE_S), f = tSec / SLICE_S - k;
  const a0 = hash2(seed, k, 3, 811) * Math.PI * 2, a1 = hash2(seed, k + 1, 3, 811) * Math.PI * 2;
  // interpolate along the short arc
  let d = a1 - a0; d = Math.atan2(Math.sin(d), Math.cos(d));
  const ang = a0 + smooth(0, d, f);
  const s = smooth(hash2(seed, k, 5, 812), hash2(seed, k + 1, 5, 812), f);
  return { dx: Math.cos(ang), dy: Math.sin(ang), strength: Math.min(1, BASE[weather] * (0.8 + 0.45 * s)) };
}

/** Radians/second the gust fronts travel at. */
export const gustSpeed = (strength: number): number => 0.6 + 1.6 * strength;

/** Gust front intensity 0..1 at tile (x, y): bands travelling with the wind, bent by a slow cross-wave. */
export function gust(w: Wind, x: number, y: number, tSec: number): number {
  const along = x * w.dx + y * w.dy, across = -x * w.dy + y * w.dx;
  const ph = along * 0.72 - tSec * gustSpeed(w.strength) + 1.7 * Math.sin(across * 0.32);
  return 0.5 + 0.5 * Math.sin(ph);
}

/** Screen-space horizontal push (-1..1) of the wind for iso sprites: world (dx,dy) projects to x = dx - dy. */
export const windScreenX = (w: Wind): number => (w.dx - w.dy) * Math.SQRT1_2;

/**
 * How far a plant leans at (x, y): steady lean with the wind plus gust-driven flutter, in -1..1 units that callers
 * scale by how flexible the plant is. `phase` de-synchronises neighbours.
 */
export function sway(w: Wind, x: number, y: number, tSec: number, phase: number): number {
  const g = gust(w, x, y, tSec);
  const lean = windScreenX(w) * w.strength * (0.55 + 0.7 * g);
  const flutter = Math.sin(tSec * (2.2 + 3.5 * w.strength) + phase) * (0.1 + 0.5 * g) * (0.25 + 0.75 * w.strength);
  return lean + flutter * 0.5;
}
