/**
 * How dangerous a place is: the world's progression is laid out on the map, not scaled to the traveller.
 *
 * The Hearthlands around the crossroads are gentle; the further out (and the deeper down), the stronger and more
 * numerous the creatures, up to the Far Reaches and the realms beyond the gates, which stay deadly even at the
 * highest level. Nothing is gated: anyone may walk anywhere from the start, and the land tells them what it holds.
 */
import { isCaveY } from './caves';
import { otherworldOf } from './otherworlds';
import { CAVE_OY } from './undercroft';

export type DangerTier = 1 | 2 | 3 | 4 | 5;
export interface Danger {
  tier: DangerTier;
  /** the region's name, as the traveller hears it on crossing in */
  name: string;
  /** the creature level here (1..15), and the band of the whole region */
  level: number;
  band: readonly [number, number];
}

/** the rings around the crossroads: outer radius (tiles), name, creature level from the inner to the outer edge */
const RINGS: ReadonlyArray<{ r: number; name: string; band: readonly [number, number] }> = [
  { r: 260, name: 'the Hearthlands', band: [1, 3] },
  { r: 900, name: 'the Borderwilds', band: [3, 6] },
  { r: 2000, name: 'the Kingdom Wilds', band: [6, 9] },
  { r: 4000, name: 'the Frontier', band: [9, 12] },
  { r: 9000, name: 'the Far Reaches', band: [12, 15] },
];
export const DANGER_MAX_LEVEL = 15;

/**
 * The danger at (x, y). Underground counts from the surface point above, a step more dangerous; the realms beyond the
 * gates are as dangerous as the Far Reaches. `corrupt` land and `night` each add a level.
 */
export function dangerAt(x: number, y: number, o: { night?: boolean; corrupt?: boolean } = {}): Danger {
  const realm = otherworldOf(y);
  if (realm) {
    const band = RINGS[4]!.band;
    return { tier: 5, name: 'a realm beyond the gates', level: clamp(band[0] + 1 + bonus(o)), band };
  }
  const cave = isCaveY(y);
  const sy = cave ? y - CAVE_OY : y;
  const d = Math.hypot(x, sy);
  let i = RINGS.findIndex((r) => d < r.r);
  if (i < 0) i = RINGS.length - 1;
  const ring = RINGS[i]!,
    inner = i ? RINGS[i - 1]!.r : 0;
  const t = Math.max(0, Math.min(1, (d - inner) / (ring.r - inner)));
  let level = ring.band[0] + (ring.band[1] - ring.band[0]) * t;
  let tier = (i + 1) as DangerTier;
  let name = ring.name;
  if (cave) {
    level += 2;
    tier = Math.min(5, tier + 1) as DangerTier;
    name = `the deeps under ${ring.name.replace(/^the /, '')}`;
  }
  return { tier, name, level: clamp(Math.round(level) + bonus(o)), band: ring.band };
}

const bonus = (o: { night?: boolean; corrupt?: boolean }) => (o.night ? 1 : 0) + (o.corrupt ? 1 : 0);
const clamp = (l: number) => Math.max(1, Math.min(DANGER_MAX_LEVEL, l));

/** How much harder a region pushes: extra spawn budget, pack room, and how much sooner the next encounter comes. */
export function dangerPressure(tier: DangerTier): { budget: number; headroom: number; pace: number } {
  return { budget: [0, 0, 1, 1.5, 2.5][tier - 1]!, headroom: [0, 0, 1, 2, 3][tier - 1]!, pace: 1 + 0.18 * (tier - 1) };
}
