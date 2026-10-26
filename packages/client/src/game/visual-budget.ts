import type { Weather } from '@eigenlands/shared';
export type GraphicsMode = 'auto' | 'economy' | 'high' | 'performance';
/** What the renderer actually uses. Auto starts from a device guess and then follows measured frame times. */
export type Tier = 'high' | 'economy' | 'performance';
const TIERS: Tier[] = ['high', 'economy', 'performance'];
export type WeatherDetail = 'gentle' | 'full' | 'off';
export const validGraphics = (v: unknown): GraphicsMode =>
  v === 'economy' || v === 'high' || v === 'performance' ? v : 'auto';
export const validWeather = (v: unknown): WeatherDetail => (v === 'off' || v === 'full' ? v : 'gentle');
export const economyGraphics = (mode: GraphicsMode, touch: boolean, cores = 8, memory = 8): boolean =>
  mode === 'economy' || (mode === 'auto' && (touch || cores <= 4 || memory <= 4));
/** First tier for a mode: an explicit choice is kept; Auto guesses from the device and then adapts. */
export function initialTier(mode: GraphicsMode, touch: boolean, cores = 8, memory = 8): Tier {
  if (mode !== 'auto') return mode;
  return economyGraphics(mode, touch, cores, memory) ? 'economy' : 'high';
}

/**
 * Canvas backing pixels per CSS pixel. `artScale` is backing pixels per art pixel at the tier's normal resolution.
 * Performance draws exactly one backing pixel per art pixel and lets the browser upscale the canvas with nearest
 * neighbour, so the picture keeps its framing and pixel grid while the GPU fills 4-9x fewer pixels.
 */
export function tierResolution(dpr: number, tier: Tier, artScale = 1): number {
  const r = pixelResolution(dpr, tier !== 'high');
  return tier === 'performance' ? r / Math.max(1, Math.floor(artScale)) : r;
}

/**
 * Auto quality: lowers the tier when the measured frame interval stays slow, and raises it again only after a long
 * stretch of headroom. A tier that had to be abandoned twice is not retried this session, so it cannot oscillate.
 */
export class AdaptiveQuality {
  private window: Array<[number, number]> = [];
  private settleUntil = -1;
  private fastSince = -1;
  private failures = new Map<Tier, number>();
  constructor(
    private slowMs = 1000 / 30,
    private fastMs = 1000 / 55,
    private span = 2500,
    private settle = 4000,
    private upAfter = 30000,
  ) {}
  /** Forget samples, e.g. after a tier change, a resize or a world jump. */
  reset(now: number): void {
    this.window = [];
    this.fastSince = -1;
    this.settleUntil = now + this.settle;
  }
  /** Feed one frame; returns the tier to switch to, or null. `ceiling` is the best tier Auto may use. */
  sample(now: number, interval: number, tier: Tier, ceiling: Tier = 'high'): Tier | null {
    if (this.settleUntil < 0) this.reset(now); // the first frames compile shaders and upload textures
    // hidden tabs and debugger pauses are not load; a genuinely slow machine still produces sub-2.5s frames
    if (now < this.settleUntil || !(interval > 0) || interval > 2500) return null;
    this.window.push([now, interval]);
    while (this.window.length && this.window[0]![0] < now - this.span) this.window.shift();
    // a few frames suffice when each one is slow: at 2 fps a window only holds four or five
    if (this.window.length < 4 || now - this.window[0]![0] < this.span * 0.8) return null;
    const sorted = this.window.map((w) => w[1]).sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1]!;
    const i = TIERS.indexOf(tier);
    if (median > this.slowMs && i < TIERS.length - 1) {
      this.failures.set(tier, (this.failures.get(tier) ?? 0) + 1);
      this.reset(now);
      return TIERS[i + 1]!;
    }
    if (median < this.fastMs && i > TIERS.indexOf(ceiling)) {
      if (this.fastSince < 0) this.fastSince = now;
      const up = TIERS[i - 1]!;
      if (now - this.fastSince >= this.upAfter && (this.failures.get(up) ?? 0) < 2) {
        this.reset(now);
        return up;
      }
    } else this.fastSince = -1;
    return null;
  }
}

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
