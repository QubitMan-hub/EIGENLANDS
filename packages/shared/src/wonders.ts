/**
 * Wonders and hunts (master plan §19 "small discoverable stories"): rare nights when stars fall, the morning rainbow
 * after a rainy day, aurora over the northern pines, the rest you only get in a bed under your own roof, and the
 * beast each town posts a bounty on today. All pure functions of the seed, the day and the clock, so the server, every
 * client and the tests agree without storing anything.
 */
import { hash2 } from './rng';
import { sanctuaryAt } from './sanctuary';
import { townsNear, type Town } from './town';
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

/**
 * What makes a bounty beast more than a big animal: one signature move per kind, run by the server (features/wonders)
 * on top of the creature's ordinary attacks, and a look of its own (client combatview). `dmg` is at level 1 and grows
 * 6% a level; `cd` is the seconds between uses; a telegraph of `warn` seconds always comes first.
 */
export interface BountySignature {
  name: string;
  /** what the town says about it (the notice board and the spotted toast) */
  lore: string;
  cd: number;
  warn: number;
  radius: number;
  dmg: number;
}
export const BOUNTY_SIGNATURE: Record<BountyKind, BountySignature> = {
  wolf: {
    name: 'Call of the Pack',
    lore: 'When it is hurt it howls, and the pack comes.',
    cd: 14,
    warn: 1,
    radius: 0,
    dmg: 0,
  },
  boar: {
    name: 'Rampage',
    lore: 'It charges whatever it hates, and it hates everything.',
    cd: 7,
    warn: 0.9,
    radius: 1.8,
    dmg: 16,
  },
  brute: {
    name: 'Earthshaker',
    lore: 'It beats the ground until the ground gives way.',
    cd: 8,
    warn: 1.1,
    radius: 3.5,
    dmg: 20,
  },
  badger: {
    name: 'Burrow',
    lore: 'Wound it and it goes underground, and comes up behind you.',
    cd: 11,
    warn: 0.7,
    radius: 1.4,
    dmg: 12,
  },
  thornling: {
    name: 'Bramble Ring',
    lore: 'Thorns burst from the earth around it; they leave you bleeding.',
    cd: 9,
    warn: 1,
    radius: 4,
    dmg: 8,
  },
};
/** The bounty a marked beast of `kind` near (x, y) belongs to today (the nearest posted one), for its name. */
export function bountyNear(seed: number, day: number, kind: BountyKind, x: number, y: number): Bounty | null {
  let best: Bounty | null = null,
    bd = 40;
  for (const t of townsNear(seed, x - 100, y - 100, x + 100, y + 100)) {
    const b = bountyOf(seed, t, day);
    if (!b || b.kind !== kind) continue;
    const d = Math.hypot(b.x - x, b.y - y);
    if (d < bd) ((bd = d), (best = b));
  }
  return best;
}
/** a bounty beast's signature damage at its level */
export const bountySignatureDamage = (kind: BountyKind, level: number): number =>
  Math.round(BOUNTY_SIGNATURE[kind].dmg * (1 + 0.06 * Math.max(0, level - 1)));
/** how a bounty beast is drawn: larger than its kind, and marked (a tint over its own sprite) */
export const BOUNTY_LOOK: Record<BountyKind, { scale: number; tint: number }> = {
  wolf: { scale: 1.55, tint: 0xd9dbe6 },
  boar: { scale: 1.5, tint: 0xf0a888 },
  brute: { scale: 1.4, tint: 0xc9bfa8 },
  badger: { scale: 1.6, tint: 0xb6a6c0 },
  thornling: { scale: 1.5, tint: 0xa8e090 },
};
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
  let r = 48 + h(3) * 22;
  // out in the wild, never inside a ward (its own town's or a neighbour's): a warded beast would be dispersed the
  // moment it appeared. Walk the sighting further out along the same bearing until it is clear.
  for (let k = 0; k < 40 && sanctuaryAt(seed, town.cx + Math.cos(a) * r, town.cy + Math.sin(a) * r); k++) r += 3;
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
