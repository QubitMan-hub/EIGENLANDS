import type { Container } from 'pixi.js';
import type { Weather } from '@eigenlands/shared';

/**
 * Screen-space weather particles (rain, storm, snow, fog) drawn above the world, below the HUD.
 * ART WORKER: implement; keep this API.
 */
export class WeatherFx {
  constructor(_parent: Container) {}
  /** viewW/viewH in CSS px; hour is the in-game hour (lightning/fog tint) */
  update(_dt: number, _weather: Weather, _viewW: number, _viewH: number, _reduced: boolean, _hour: number): void {}
  /** multiplier applied to the lightmap ambient colour (overcast/storm darkening) */
  ambient(_weather: Weather): [number, number, number] { return [1, 1, 1]; }
}
