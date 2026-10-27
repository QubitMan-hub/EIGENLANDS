/**
 * Wonders and hunts (master plan §19 "small discoverable stories"): rare nights when stars fall, the morning rainbow
 * after a rainy day, aurora over the northern pines, the rest you only get in a bed under your own roof, and the
 * beast each town posts a bounty on today. All pure functions of the seed, the day and the clock, so the server, every
 * client and the tests agree without storing anything.
 */
import { hash2 } from './rng';
import type { Town } from './town';
import { weatherForDay } from './weather';

// ───────────────────────── starfall ─────────────────────────

/** Is world day `day` a starfall night? About one clear night in seven. */
export function starfallOn(seed: number, day: number): boolean {
  const w = weatherForDay(seed, day);
  return (w === 'clear' || w === 'cloudy') && hash2(seed, day, 0, 6101) < 0.15;
}
/** The hours the stars fall: from late evening until the small hours. */
export const starfallHour = (hour: number): boolean => hour >= 21 || hour < 4;
/** What a fallen star gives when broken open: star shards, sometimes a qubit crystal. */
export const FALLEN_STAR_SHARDS: [number, number] = [2, 4];

// ───────────────────────── sky ─────────────────────────

/** The morning after a rainy day, if it has cleared, a rainbow hangs over the land from 7 till 10. */
export function rainbowAt(seed: number, day: number, hour: number): boolean {
  if (day < 1) return false;
  const before = weatherForDay(seed, day - 1),
    now = weatherForDay(seed, day);
  return (before === 'rain' || before === 'storm') && (now === 'clear' || now === 'cloudy') && hour >= 7 && hour < 10;
}
/** Aurora over the taiga on clear nights. */
export const auroraAt = (biome: string, weather: string, hour: number): boolean =>
  biome === 'taiga' && (weather === 'clear' || weather === 'cloudy') && (hour >= 20 || hour < 5);

// ───────────────────────── home comforts ─────────────────────────

/** Sleeping in your own bed under your own roof: experience comes a little easier for half an hour. */
export const RESTED_SECS = 1800;
export const RESTED_XP_MULT = 1.15;

// ───────────────────────── bounties ─────────────────────────

export type BountyKind = 'wolf' | 'boar' | 'brute' | 'badger' | 'thornling';
const BEAST_NAMES: Record<BountyKind, string[]> = {
  wolf: ['Old Greymaw', 'the Widow-Wolf', 'Ash-Tooth', 'the Hollow Howler'],
  boar: ['Mother Bristle', 'the Iron Tusk', 'Old Rootgrub', 'the Red Sow'],
  brute: ['the Unmade', 'Stonefist', 'the Grey Lump', 'the Wall-Breaker'],
  badger: ['Grimclaw', 'the Old Digger', 'Burrowking', 'Sett-Lord'],
  thornling: ['the Bramble Knight', 'Thornmother', 'the Hedge-Wight', 'Briarback'],
};
const KINDS: BountyKind[] = ['wolf', 'boar', 'brute', 'badger', 'thornling'];
/** The screen compass word for a step of (dx, dy) tiles (north is up the screen), as the shrine compass names it. */
export function compassWord(dx: number, dy: number): string {
  const dirs = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
  const sx = dx - dy,
    sy = dx + dy;
  const a = (Math.atan2(sy, sx) + Math.PI * 2) % (Math.PI * 2);
  return dirs[Math.round(a / (Math.PI / 4)) % 8]!;
}

export interface Bounty {
  /** `bty:<town>:<day>` */
  id: string;
  town: string;
  name: string;
  kind: BountyKind;
  /** where it was last seen (tiles) */
  x: number;
  y: number;
  /** compass word from the town */
  dir: string;
  reward: number;
}

/** Today's bounty posted in `town`, if any (most towns post one on most days). */
export function bountyOf(seed: number, town: Town, day: number): Bounty | null {
  if (town.abandoned) return null;
  const h = (k: number) => hash2(seed, Math.round(town.cx) * 7 + day, Math.round(town.cy) * 3 - day, 6200 + k);
  if (h(0) > 0.7) return null;
  const kind = KINDS[Math.floor(h(1) * KINDS.length)]!;
  const a = h(2) * Math.PI * 2;
  const r = 48 + h(3) * 22;
  return {
    id: `bty:${town.name}:${day}`,
    town: town.name,
    name: BEAST_NAMES[kind][Math.floor(h(4) * 4)]!,
    kind,
    x: Math.round(town.cx + Math.cos(a) * r),
    y: Math.round(town.cy + Math.sin(a) * r),
    dir: compassWord(Math.cos(a), Math.sin(a)),
    reward: 120 + Math.floor(h(5) * 6) * 20,
  };
}
