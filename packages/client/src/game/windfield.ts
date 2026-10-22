import { gust, sway, windBase, type Weather, type Wind } from '@eigenlands/shared';

/** The client's view of the world wind (see shared/wind.ts): updated once per frame, sampled by every swaying thing. */
export class WindField {
  w: Wind = { dx: 1, dy: 0, strength: 0.3 };
  t = 0;
  weather: Weather = 'clear';

  /** `wallSec` (shared world clock) steers heading and strength; `localSec` is the render clock the terrain shader also uses for gust fronts. */
  update(seed: number, wallSec: number, localSec: number, weather: Weather): void {
    this.t = localSec;
    this.weather = weather;
    this.w = windBase(seed, wallSec, weather);
  }

  /** Skew (radians-ish) for a plant of flexibility `amp` at tile (x, y). */
  sway(x: number, y: number, phase: number, amp: number): number { return sway(this.w, x, y, this.t, phase) * amp; }
  gust(x: number, y: number): number { return gust(this.w, x, y, this.t); }
}

/** Calm wind for places without a world (art lab, tests). */
export const CALM = new WindField();
