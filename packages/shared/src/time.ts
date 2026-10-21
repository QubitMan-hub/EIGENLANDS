import { DAYS_PER_SEASON, DAY_MS, SEASONS } from './constants';

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

/** In-game hour [0,24). The world epoch starts at 06:00 (dawn). */
export function gameHour(nowMs: number): number {
  const t = (((nowMs % DAY_MS) + DAY_MS) % DAY_MS) / DAY_MS;
  return (t * 24 + 6) % 24;
}

/** The world was founded at this instant; day 1 starts here (a game day is 24 real minutes). */
export const WORLD_EPOCH_MS = Date.UTC(2026, 9, 21);

export function dayNumber(nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - WORLD_EPOCH_MS) / DAY_MS));
}

export function season(nowMs: number): (typeof SEASONS)[number] {
  return SEASONS[Math.floor(dayNumber(nowMs) / DAYS_PER_SEASON) % 4]!;
}

export function dayPhase(hour: number): DayPhase {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 18) return 'day';
  if (hour >= 18 && hour < 20) return 'dusk';
  return 'night';
}

export const isNight = (nowMs: number) => dayPhase(gameHour(nowMs)) === 'night';

export function formatClock(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

type RGB = [number, number, number];
/** Ambient multiply colour keyframes by hour, built from palette-adjacent hues. */
const KEYS: Array<[number, RGB]> = [
  [0, [0.3, 0.34, 0.6]],
  [4.5, [0.32, 0.36, 0.62]],
  [6, [0.95, 0.65, 0.6]],
  [8, [1, 0.98, 0.92]],
  [12, [1, 1, 1]],
  [17, [1, 0.95, 0.85]],
  [19, [0.95, 0.55, 0.5]],
  [20.5, [0.34, 0.36, 0.62]],
  [24, [0.3, 0.34, 0.6]],
];

/** Smooth ambient colour (0..1 per channel) for an in-game hour. */
export function ambientColor(hourIn: number): RGB {
  const hour = ((hourIn % 24) + 24) % 24;
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [h0, c0] = KEYS[i]!;
    const [h1, c1] = KEYS[i + 1]!;
    if (hour >= h0 && hour <= h1) {
      let t = (hour - h0) / (h1 - h0);
      t = t * t * (3 - 2 * t);
      return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
    }
  }
  return [1, 1, 1];
}

/** 0 = pitch dark, 1 = full light. Used for lamp intensity. */
export function darkness(hour: number): number {
  const [r, g, b] = ambientColor(hour);
  return 1 - (r + g + b) / 3;
}
