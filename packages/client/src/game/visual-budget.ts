import type { Weather } from '@eigenlands/shared';
export type GraphicsMode = 'auto' | 'economy' | 'high';
export type WeatherDetail = 'gentle' | 'full' | 'off';
export const validGraphics = (v: unknown): GraphicsMode => (v === 'economy' || v === 'high' ? v : 'auto');
export const validWeather = (v: unknown): WeatherDetail => (v === 'off' || v === 'full' ? v : 'gentle');
export const economyGraphics = (mode: GraphicsMode, touch: boolean, cores = 8, memory = 8): boolean =>
  mode === 'economy' || (mode === 'auto' && (touch || cores <= 4 || memory <= 4));
/** The browser upscale is an integer even at fractional device DPR (125%, 175%, etc.). */
export function pixelResolution(dpr: number, economy: boolean): number {
  const physical = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  return physical / Math.ceil(physical / (economy ? 1 : 3));
}
/** Cosmetic budget only. Rain still waters crops and weather still affects the simulation. */
export function weatherBudget(
  weather: Weather,
  detail: WeatherDetail,
  economy: boolean,
  reduced: boolean,
  w: number,
  h: number,
) {
  const area = Math.min(1, Math.sqrt((w * h) / (1280 * 720))),
    k = area * (economy ? 0.6 : 1),
    on = detail !== 'off',
    full = detail === 'full';
  return {
    rain:
      !on || (weather !== 'rain' && weather !== 'storm')
        ? 0
        : reduced
          ? 8
          : Math.round((weather === 'storm' ? (full ? 144 : 72) : full ? 90 : 44) * k),
    snow: !on || weather !== 'snow' ? 0 : reduced ? 10 : Math.round((full ? 96 : 56) * k),
    leaves: on && !reduced ? Math.round((full ? 24 : 12) * k) : 0,
    flash: on && full && !economy && !reduced && weather === 'storm',
  };
}
