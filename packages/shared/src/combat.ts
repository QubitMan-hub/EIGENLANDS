import { BESTIARY_DEFS, BESTIARY_KEYS, rareSpawnEntries, type BestiaryKey, type CreatureTrait } from './bestiary';
import type { CaveBiome } from './undercroft';
import type { Biome } from './worldgen';
import { WEAPONS } from './equipment';
import { IFRAME_TIME, PERFECT_WINDOW, PROJECTILE_DAMAGE } from './constants';

/**
 * Combat rules shared by the server (authority), the client (prediction, swing arcs, telegraph decals) and tests.
 * Everything here is pure and deterministic.
 */

/**
 * One melee hit. `arc` is the cosine of the half-angle (a target whose centre is within that angle of the facing is hit),
 * `weight` drives poise, armour, hit-stop and camera shake: 0 light, 1 finisher, 2 heavy, 3 fully charged heavy.
 */
export interface ComboHit {
  damage: number;
  range: number;
  arc: number;
  knockback: number;
  poise: number;
  weight: number;
  /** forward step taken by the attacker when the hit comes out (tiles) */
  lunge: number;
  /** recovery before the next attack (s) */
  recovery: number;
}

const cosDeg = (d: number) => Math.cos((d * Math.PI) / 180);

/** Three-hit sword combo: two quick slashes and a lunging finisher. */
export const COMBO: ComboHit[] = [
  { damage: 8, range: 1.45, arc: cosDeg(55), knockback: 2.5, poise: 4, weight: 0, lunge: 0.15, recovery: 0.26 },
  { damage: 9, range: 1.45, arc: cosDeg(55), knockback: 2.5, poise: 4, weight: 0, lunge: 0.15, recovery: 0.26 },
  { damage: 16, range: 1.85, arc: cosDeg(80), knockback: 7, poise: 14, weight: 1, lunge: 0.5, recovery: 0.5 },
];

/** Charged heavy strike ("phase cleave"); `level` 0..1 is how far past CHARGE_MIN the charge went. */
export function heavyHit(level: number): ComboHit {
  const l = Math.min(1, Math.max(0, level));
  return {
    damage: Math.round(20 + 14 * l),
    range: 2.1 + 0.35 * l,
    arc: cosDeg(100),
    knockback: 8.5 + 4 * l,
    poise: Math.round(24 + 16 * l),
    weight: l >= 1 ? 3 : 2,
    lunge: 0.35 + 0.35 * l,
    recovery: 0.45,
  };
}

export const MELEE_FAMILIES = ['sword', 'spear', 'battle_axe', 'warhammer'] as const;
export type MeleeFamily = (typeof MELEE_FAMILIES)[number];
export const meleeFamily = (id: unknown): MeleeFamily => {
  if (MELEE_FAMILIES.includes(id as MeleeFamily)) return id as MeleeFamily;
  // catalog variants (a steel spear) move like the base weapon they borrow from
  const fam = typeof id === 'string' ? WEAPONS[id]?.fam : undefined;
  return MELEE_FAMILIES.includes(fam as MeleeFamily) ? (fam as MeleeFamily) : 'sword';
};
/** Sidegrades: reach, cleave or poise instead of a straight increase to sword damage per recovery. */
export const MELEE_COMBOS: Record<MeleeFamily, readonly ComboHit[]> = {
  sword: COMBO,
  spear: [
    { damage: 7, range: 2.35, arc: cosDeg(22), knockback: 2, poise: 4, weight: 0, lunge: 0.1, recovery: 0.27 },
    { damage: 8, range: 2.35, arc: cosDeg(22), knockback: 2, poise: 4, weight: 0, lunge: 0.1, recovery: 0.27 },
    { damage: 13, range: 2.75, arc: cosDeg(25), knockback: 6, poise: 12, weight: 1, lunge: 0.3, recovery: 0.46 },
  ],
  battle_axe: [
    { damage: 9, range: 1.35, arc: cosDeg(80), knockback: 3.5, poise: 6, weight: 0, lunge: 0.1, recovery: 0.36 },
    { damage: 10, range: 1.35, arc: cosDeg(80), knockback: 3.5, poise: 6, weight: 0, lunge: 0.1, recovery: 0.36 },
    { damage: 18, range: 1.65, arc: cosDeg(110), knockback: 8, poise: 18, weight: 1, lunge: 0.35, recovery: 0.58 },
  ],
  warhammer: [
    { damage: 12, range: 1.25, arc: cosDeg(45), knockback: 4, poise: 10, weight: 1, lunge: 0.08, recovery: 0.5 },
    { damage: 13, range: 1.25, arc: cosDeg(45), knockback: 4, poise: 10, weight: 1, lunge: 0.08, recovery: 0.5 },
    { damage: 22, range: 1.55, arc: cosDeg(60), knockback: 10, poise: 30, weight: 2, lunge: 0.2, recovery: 0.8 },
  ],
};
export function meleeTap(id: unknown, combo: number): ComboHit {
  return MELEE_COMBOS[meleeFamily(id)][Number.isFinite(combo) ? Math.max(0, Math.min(2, Math.floor(combo))) : 0]!;
}
export function meleeHeavy(id: unknown, level: number): ComboHit {
  const l = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
  switch (meleeFamily(id)) {
    case 'spear':
      return {
        damage: Math.round(16 + 14 * l),
        range: 3.1 + 0.3 * l,
        arc: cosDeg(25),
        knockback: 6 + 3 * l,
        poise: Math.round(18 + 14 * l),
        weight: l >= 1 ? 3 : 2,
        lunge: 0.15 + 0.2 * l,
        recovery: 0.5,
      };
    case 'battle_axe':
      return {
        damage: Math.round(22 + 12 * l),
        range: 1.8 + 0.3 * l,
        arc: cosDeg(125),
        knockback: 8 + 4 * l,
        poise: Math.round(25 + 15 * l),
        weight: l >= 1 ? 3 : 2,
        lunge: 0.25 + 0.3 * l,
        recovery: 0.62,
      };
    case 'warhammer':
      return {
        damage: Math.round(30 + 18 * l),
        range: 1.7 + 0.3 * l,
        arc: cosDeg(60),
        knockback: 10 + 5 * l,
        poise: Math.round(35 + 25 * l),
        weight: l >= 1 ? 3 : 2,
        lunge: 0.15 + 0.15 * l,
        recovery: 0.85,
      };
    default:
      return heavyHit(l);
  }
}

export const SKILL_DAMAGE = PROJECTILE_DAMAGE;
/** Outgoing physical damage, before the target's armour/critical modifiers. */
export const attackDamage = (base: number, attack: number, might = 0): number =>
  Math.max(1, Math.round((base + attack) * (1 + might)));
/** poise damage of the skill shot */
export const SKILL_POISE = 6;

// ───────────────────────── crits, poise, armour ─────────────────────────

export const CRIT_BASE = 0.08;
export const CRIT_PER_LUCK = 0.02;
export const CRIT_MULT = 1.75;
/** staggered enemies take extra damage */
export const VULNERABLE_MULT = 1.2;
/** armoured enemies take this fraction of damage from light hits, which also do no poise damage */
export const ARMOR_LIGHT_MULT = 0.6;
/** an enemy's poise refills after this long without poise damage */
export const POISE_REGEN_DELAY = 1.6;

export function critChance(luck: number): number {
  return Math.min(0.5, CRIT_BASE + CRIT_PER_LUCK * Math.max(0, luck));
}

/** Random crits only come from melee; a counter (attack after a perfect dodge) always crits. */
export function rollCrit(roll: number, luck: number, counter: boolean, melee: boolean): boolean {
  if (counter) return true;
  return melee && roll < critChance(luck);
}

export interface HitResult {
  damage: number;
  poise: number;
  knockback: number;
  flinch: boolean;
}

/** Final damage/poise/knockback of a hit on an enemy after crit, stagger vulnerability and armour. */
export function resolveHit(
  def: Pick<EnemyDef, 'armor'>,
  base: { damage: number; poise: number; knockback: number; weight: number },
  o: { crit: boolean; staggered: boolean; counter?: boolean },
): HitResult {
  let dmg = base.damage,
    poise = base.poise,
    kb = base.knockback;
  if (o.crit) dmg *= CRIT_MULT;
  if (o.counter) poise *= 1.5;
  if (o.staggered) dmg *= VULNERABLE_MULT;
  const armoured = !!def.armor && !o.staggered && base.weight < 1;
  if (armoured) {
    dmg *= ARMOR_LIGHT_MULT;
    poise = 0;
    kb *= 0.3;
  }
  return { damage: Math.max(1, Math.round(dmg)), poise, knockback: kb, flinch: !armoured };
}

// ───────────────────────── wall slam ─────────────────────────

/** knockback speed (tiles/s) at which being blocked by a wall counts as a slam */
export const SLAM_SPEED = 4.5;
export function slamDamage(speed: number): number {
  return Math.round(4 + speed * 0.9);
}
export const SLAM_POISE = 18;

// ───────────────────────── dodging ─────────────────────────

/** `ifrT` counts down from IFRAME_TIME when a dash starts. */
export function hasIframes(sim: { ifrT: number }): boolean {
  return sim.ifrT > 0;
}
export function isPerfectDodge(sim: { ifrT: number }): boolean {
  return sim.ifrT > IFRAME_TIME - PERFECT_WINDOW + 1e-9;
}

// ───────────────────────── client feel (deterministic so it can be tested) ─────────────────────────

/** Freeze-frame length (ms) for a hit of this weight. Visual only. */
export function hitStopMs(weight: number, crit: boolean, kill: boolean): number {
  const base = [28, 60, 85, 115][Math.min(3, Math.max(0, Math.floor(weight)))]!;
  return Math.min(170, base + (crit ? 35 : 0) + (kill ? 30 : 0));
}

/** Camera shake intensity 0..1 for a hit of this weight (0 when reduced motion is on). */
export function shakeFor(weight: number, crit: boolean, reduced: boolean): number {
  if (reduced) return 0;
  return Math.min(1, [0.12, 0.3, 0.5, 0.7][Math.min(3, Math.max(0, Math.floor(weight)))]! + (crit ? 0.15 : 0));
}

// ───────────────────────── geometry ─────────────────────────

export interface Circle {
  x: number;
  y: number;
  r: number;
}

/** Does a melee arc from (ox,oy) facing (fx,fy) touch the target circle? */
export function inArc(
  ox: number,
  oy: number,
  fx: number,
  fy: number,
  hit: Pick<ComboHit, 'range' | 'arc'>,
  t: Circle,
): boolean {
  const dx = t.x - ox;
  const dy = t.y - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > hit.range + t.r) return false;
  if (dist <= t.r + 0.3) return true; // point blank always hits
  return (dx * fx + dy * fy) / dist >= hit.arc;
}

/** Segment (a->b) vs circle, for projectile sweeps and charge lanes. */
export function segmentHitsCircle(ax: number, ay: number, bx: number, by: number, rad: number, c: Circle): boolean {
  const vx = bx - ax,
    vy = by - ay;
  const l2 = vx * vx + vy * vy;
  let t = l2 > 0 ? ((c.x - ax) * vx + (c.y - ay) * vy) / l2 : 0;
  t = Math.min(1, Math.max(0, t));
  const px = ax + vx * t - c.x;
  const py = ay + vy * t - c.y;
  const rr = rad + c.r;
  return px * px + py * py <= rr * rr;
}

export interface PosSample {
  tick: number;
  x: number;
  y: number;
}

/** Lag compensation: position of an entity at an earlier tick from its history. */
export function rewindPosition(history: PosSample[], tick: number): { x: number; y: number } | null {
  if (history.length === 0) return null;
  let best = history[0]!;
  for (const h of history) if (Math.abs(h.tick - tick) < Math.abs(best.tick - tick)) best = h;
  return { x: best.x, y: best.y };
}

/** Enemy strike areas. Circles for slams and bites, lanes (thick segments) for charges. */
export type StrikeShape =
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'lane'; ax: number; ay: number; bx: number; by: number; w: number };

export function shapeHits(s: StrikeShape, c: Circle): boolean {
  if (s.kind === 'circle') return Math.hypot(c.x - s.x, c.y - s.y) <= s.r + c.r;
  return segmentHitsCircle(s.ax, s.ay, s.bx, s.by, s.w, c);
}

// ───────────────────────── progression ─────────────────────────

export function xpForLevel(level: number): number {
  return 30 + 20 * (level - 1);
}

export function maxHpForLevel(level: number, base: number): number {
  return base + (level - 1) * 8;
}

// ───────────────────────── enemies ─────────────────────────

export interface DropDef {
  item: string;
  min: number;
  max: number;
  chance: number;
}
export type EnemyAi = 'melee' | 'leap' | 'caster' | 'brute' | 'swarm' | 'passive' | 'boar' | 'ambusher' | 'harrier';
export interface EnemyDef {
  trait?: CreatureTrait;
  territory?: number;
  predator?: boolean;
  mythical?: boolean;
  kind: number;
  /** passive fauna flees instead of fighting */
  passive?: boolean;
  /** wildlife that ignores you until it is hurt (then fights back); never counts against the hostile spawn budget */
  neutral?: boolean;
  drops?: DropDef[];
  name: string;
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  sight: number;
  windup: number;
  strikeRange: number;
  xp: number;
  /** behaviour */
  ai?: EnemyAi;
  /** poise: hits drain it, at 0 the enemy is staggered (interrupting any windup) */
  poise?: number;
  staggerTime?: number;
  /** armoured: light hits deal reduced damage, no poise damage, no flinch; only finishers/heavies/slams stagger */
  armor?: boolean;
  /** knockback multiplier (1 = full) */
  resist?: number;
  /** pause between attacks (s) */
  cooldown?: number;
  /** spawn budget cost (a player's area holds a few points of enemies) */
  budget?: number;
  /** boss: never despawns while players are near, gets a health bar, resists knockback */
  boss?: boolean;
  /** attack area multiplier (bosses hit wide) */
  aoe?: number;
  /** sea creature: lives on open water, land is its wall */
  sea?: boolean;
}

/** Attack ids for telegraph decals (synced as EnemyState.atk). */
export const ATK = { NONE: 0, SELF: 1, LEAP: 2, ORB: 3, CHARGE: 4, SLAM: 5, BOMB: 6 } as const;

export const LEAP_RADIUS = 1.0;
export const LEAP_TIME = 0.25;
export const ORB_SPEED = 5.2;
export const ORB_RADIUS = 0.28;
export const ORB_RANGE = 10;
/** night wisps fire a fan of three orbs this far apart (radians) */
export const ORB_SPREAD = 0.32;
export const CHARGE_SPEED = 12;
export const CHARGE_DIST = 7;
export const CHARGE_WIDTH = 0.75;
export const BRUTE_SLAM_RADIUS = 2.0;
export const BRUTE_SLAM_WINDUP = 0.8;
export const SHOCKWAVE_RADIUS = 1.9;
export const BOMB_RADIUS = 1.7;
export const BOMB_FUSE = 0.9;
/** a reflected orb flies faster and hits harder */
export const REFLECT_SPEED_MULT = 1.7;
export const REFLECT_DAMAGE = 18;

const melee = { ai: 'melee' as const };
const BASE_ENEMY_DEFS: Record<
  | 'slime'
  | 'hopper'
  | 'rabbit'
  | 'deer'
  | 'wisp'
  | 'brute'
  | 'mite'
  | 'boar'
  | 'wolf'
  | 'badger'
  | 'slime_king'
  | 'warden'
  | 'colossus'
  | 'pirate'
  | 'serpent'
  | 'fox'
  | 'otter'
  | 'tortoise'
  | 'owl'
  | 'thornling'
  | 'glasscrawler'
  | 'guild_guard'
  | 'reed_stalker'
  | 'cinder_moth'
  | 'echo_bat'
  | 'spore_sage'
  | 'prism_beetle'
  | 'blind_ram'
  | 'rime_skitter'
  | 'pool_lurker'
  | 'vault_guardian'
  | 'spore_matriarch'
  | 'bellkeeper'
  | 'veyr'
  | 'amber_gnawer'
  | 'lantern_hound'
  | 'geode_golem'
  | 'cinder_drake'
  | 'frost_wraith'
  | 'tide_eel'
  | 'geode_tyrant'
  | 'cinder_wyrm'
  | 'rime_sovereign'
  | 'tide_leviathan'
  | 'griffin'
  | 'spirit_stag'
  | 'iron_golem'
  | 'raiju'
  | 'reef_naga'
  | 'hellhound',
  EnemyDef
> = {
  slime: {
    kind: 0,
    name: 'Wisp Slime',
    hp: 30,
    speed: 2.1,
    radius: 0.4,
    damage: 7,
    sight: 7,
    windup: 0.55,
    strikeRange: 1.1,
    xp: 10,
    ...melee,
    poise: 8,
    staggerTime: 0.7,
    cooldown: 0.5,
    budget: 1,
    drops: [{ item: 'slime_gel', min: 1, max: 2, chance: 0.7 }],
  },
  hopper: {
    kind: 1,
    name: 'Glint Hopper',
    hp: 22,
    speed: 3.0,
    radius: 0.35,
    damage: 9,
    sight: 9,
    windup: 0.7,
    strikeRange: 3.0,
    xp: 14,
    ai: 'leap',
    poise: 6,
    staggerTime: 0.7,
    cooldown: 0.6,
    budget: 1,
    drops: [
      { item: 'hopper_tooth', min: 1, max: 1, chance: 0.45 },
      { item: 'hide', min: 1, max: 1, chance: 0.25 },
    ],
  },
  rabbit: {
    kind: 2,
    name: 'Meadow Rabbit',
    passive: true,
    ai: 'passive',
    hp: 8,
    speed: 4.6,
    radius: 0.3,
    damage: 0,
    sight: 6,
    windup: 0,
    strikeRange: 0,
    xp: 3,
    drops: [
      { item: 'raw_meat', min: 1, max: 1, chance: 0.9 },
      { item: 'hide', min: 1, max: 1, chance: 0.5 },
    ],
  },
  deer: {
    kind: 3,
    name: 'Eigendeer',
    passive: true,
    ai: 'passive',
    hp: 36,
    speed: 5.4,
    radius: 0.5,
    damage: 0,
    sight: 9,
    windup: 0,
    strikeRange: 0,
    xp: 12,
    drops: [
      { item: 'raw_meat', min: 2, max: 3, chance: 1 },
      { item: 'hide', min: 1, max: 2, chance: 0.8 },
    ],
  },
  /** ranged: keeps its distance and fires slow, dodgeable (and reflectable) orbs after a visible aim line */
  wisp: {
    kind: 4,
    name: 'Phase Wisp',
    hp: 18,
    speed: 2.5,
    radius: 0.35,
    damage: 8,
    sight: 10,
    windup: 0.8,
    strikeRange: 7,
    xp: 16,
    ai: 'caster',
    poise: 5,
    staggerTime: 0.8,
    cooldown: 1.5,
    budget: 1,
    drops: [
      { item: 'slime_gel', min: 1, max: 1, chance: 0.4 },
      { item: 'qubit_crystal', min: 1, max: 1, chance: 0.06 },
    ],
  },
  /** armoured bruiser: long telegraphed charge (crashes into walls), close-range ground slam */
  brute: {
    kind: 5,
    name: 'Decoherent Brute',
    hp: 95,
    speed: 1.7,
    radius: 0.55,
    damage: 16,
    sight: 9,
    windup: 0.95,
    strikeRange: 7,
    xp: 45,
    ai: 'brute',
    poise: 40,
    staggerTime: 1.4,
    armor: true,
    resist: 0.25,
    cooldown: 1.4,
    budget: 3,
    drops: [
      { item: 'iron_ore', min: 1, max: 2, chance: 0.7 },
      { item: 'coal', min: 1, max: 2, chance: 0.5 },
      { item: 'hide', min: 1, max: 1, chance: 0.35 },
    ],
  },
  /** swarm: tiny, fast, fragile, come in packs */
  mite: {
    kind: 6,
    name: 'Static Mite',
    hp: 6,
    speed: 4.3,
    radius: 0.22,
    damage: 3,
    sight: 8,
    windup: 0.32,
    strikeRange: 0.75,
    xp: 3,
    ai: 'swarm',
    poise: 0,
    staggerTime: 0.35,
    cooldown: 0.6,
    budget: 0.34,
    drops: [{ item: 'copper_ore', min: 1, max: 1, chance: 0.12 }],
  },
  /** wild boar: roots around peacefully; hurt it or crowd it and it lowers its head and charges (long telegraph, dodge sideways) */
  boar: {
    kind: 7,
    name: 'Wild Boar',
    neutral: true,
    ai: 'boar',
    hp: 58,
    speed: 2.4,
    radius: 0.5,
    damage: 13,
    sight: 7,
    windup: 0.75,
    strikeRange: 6,
    xp: 24,
    poise: 22,
    staggerTime: 1.0,
    resist: 0.5,
    cooldown: 1.6,
    budget: 0,
    drops: [
      { item: 'raw_meat', min: 2, max: 3, chance: 1 },
      { item: 'hide', min: 1, max: 2, chance: 0.7 },
      { item: 'boar_tusk', min: 1, max: 1, chance: 0.35 },
    ],
  },
  /** wolf: pack hunter of forests and snowfields; circles, then lunges with a short, readable windup */
  wolf: {
    kind: 8,
    name: 'Dire Wolf',
    hp: 44,
    speed: 4.2,
    radius: 0.45,
    damage: 10,
    sight: 12,
    windup: 0.6,
    strikeRange: 3.6,
    xp: 30,
    ai: 'leap',
    poise: 10,
    staggerTime: 0.8,
    cooldown: 0.9,
    budget: 1.5,
    drops: [
      { item: 'hide', min: 1, max: 2, chance: 0.8 },
      { item: 'wolf_fang', min: 1, max: 1, chance: 0.4 },
      { item: 'raw_meat', min: 1, max: 2, chance: 0.8 },
    ],
  },
  /** badger: small, stubborn and fast to bite; leave it alone and it digs for grubs */
  badger: {
    kind: 9,
    name: 'Badger',
    neutral: true,
    ai: 'melee',
    hp: 30,
    speed: 3.2,
    radius: 0.35,
    damage: 8,
    sight: 6,
    windup: 0.4,
    strikeRange: 1.1,
    xp: 14,
    poise: 6,
    staggerTime: 0.6,
    cooldown: 0.7,
    budget: 0,
    drops: [
      { item: 'hide', min: 1, max: 1, chance: 0.6 },
      { item: 'raw_meat', min: 1, max: 1, chance: 0.7 },
    ],
  },
  fox: {
    kind: 15,
    name: 'Copper Fox',
    passive: true,
    ai: 'passive',
    hp: 18,
    speed: 4.2,
    radius: 0.3,
    damage: 0,
    sight: 7,
    windup: 0,
    strikeRange: 0,
    xp: 5,
    drops: [{ item: 'hide', min: 1, max: 1, chance: 0.65 }],
  },
  otter: {
    kind: 16,
    name: 'River Otter',
    passive: true,
    ai: 'passive',
    hp: 20,
    speed: 3.4,
    radius: 0.3,
    damage: 0,
    sight: 6,
    windup: 0,
    strikeRange: 0,
    xp: 5,
    drops: [{ item: 'raw_meat', min: 1, max: 1, chance: 0.6 }],
  },
  tortoise: {
    kind: 17,
    name: 'Mossback Tortoise',
    passive: true,
    ai: 'passive',
    hp: 48,
    speed: 0.85,
    radius: 0.4,
    damage: 0,
    sight: 0,
    windup: 0,
    strikeRange: 0,
    xp: 4,
    armor: true,
    drops: [{ item: 'stone', min: 1, max: 2, chance: 0.65 }],
  },
  owl: {
    kind: 18,
    name: 'Lantern Owl',
    passive: true,
    ai: 'passive',
    hp: 12,
    speed: 2.8,
    radius: 0.25,
    damage: 0,
    sight: 7,
    windup: 0,
    strikeRange: 0,
    xp: 4,
    drops: [{ item: 'fiber', min: 1, max: 2, chance: 0.6 }],
  },
  thornling: {
    kind: 19,
    name: 'Briar Warden',
    hp: 64,
    speed: 1.65,
    radius: 0.45,
    damage: 11,
    sight: 8,
    windup: 0.9,
    strikeRange: 1.4,
    xp: 27,
    ai: 'melee',
    armor: true,
    poise: 22,
    staggerTime: 1.1,
    resist: 0.6,
    cooldown: 1.5,
    budget: 2,
    drops: [
      { item: 'wood', min: 2, max: 4, chance: 1 },
      { item: 'healing_herb', min: 1, max: 1, chance: 0.2 },
    ],
  },
  glasscrawler: {
    kind: 20,
    name: 'Prism Crawler',
    hp: 34,
    speed: 3.1,
    radius: 0.35,
    damage: 12,
    sight: 9,
    windup: 0.8,
    strikeRange: 3.1,
    xp: 26,
    ai: 'leap',
    poise: 8,
    staggerTime: 0.8,
    cooldown: 1.5,
    budget: 1.5,
    drops: [
      { item: 'copper_ore', min: 1, max: 2, chance: 0.7 },
      { item: 'qubit_crystal', min: 1, max: 1, chance: 0.08 },
    ],
  },
  reed_stalker: {
    kind: 22,
    name: 'Reed Stalker',
    hp: 42,
    speed: 2.7,
    radius: 0.4,
    damage: 10,
    sight: 8,
    windup: 0.9,
    strikeRange: 3.4,
    xp: 25,
    ai: 'ambusher',
    poise: 10,
    staggerTime: 0.9,
    cooldown: 2.2,
    budget: 1.5,
    drops: [
      { item: 'fiber', min: 2, max: 4, chance: 1 },
      { item: 'healing_herb', min: 1, max: 1, chance: 0.2 },
    ],
  },
  cinder_moth: {
    kind: 23,
    name: 'Cinder Moth',
    hp: 28,
    speed: 2.8,
    radius: 0.3,
    damage: 8,
    sight: 10,
    windup: 1,
    strikeRange: 6.5,
    xp: 28,
    ai: 'harrier',
    poise: 6,
    staggerTime: 0.8,
    cooldown: 2.4,
    budget: 1.5,
    drops: [
      { item: 'coal', min: 1, max: 2, chance: 1 },
      { item: 'qubit_crystal', min: 1, max: 1, chance: 0.08 },
    ],
  },
  echo_bat: {
    kind: 24,
    name: 'Echo Bat',
    hp: 20,
    speed: 3.1,
    radius: 0.28,
    damage: 5,
    sight: 8,
    windup: 1,
    strikeRange: 3.3,
    xp: 14,
    ai: 'ambusher',
    poise: 5,
    staggerTime: 1,
    cooldown: 2.8,
    budget: 1,
    drops: [{ item: 'fiber', min: 1, max: 2, chance: 0.8 }],
  },
  spore_sage: {
    kind: 25,
    name: 'Spore Sage',
    hp: 32,
    speed: 1.5,
    radius: 0.4,
    damage: 7,
    sight: 9,
    windup: 1.3,
    strikeRange: 6,
    xp: 24,
    ai: 'caster',
    poise: 8,
    staggerTime: 1.2,
    cooldown: 3,
    budget: 1.5,
    drops: [{ item: 'healing_herb', min: 1, max: 2, chance: 0.8 }],
  },
  prism_beetle: {
    kind: 26,
    name: 'Prism Scarab',
    hp: 54,
    speed: 1.8,
    radius: 0.42,
    damage: 9,
    sight: 7,
    windup: 1,
    strikeRange: 1.5,
    xp: 28,
    ai: 'melee',
    armor: true,
    poise: 20,
    staggerTime: 1.4,
    cooldown: 1.8,
    budget: 2,
    drops: [
      { item: 'copper_ore', min: 1, max: 3, chance: 1 },
      { item: 'qubit_crystal', min: 1, max: 1, chance: 0.12 },
    ],
  },
  blind_ram: {
    kind: 27,
    name: 'Blindstone Ram',
    hp: 68,
    speed: 1.5,
    radius: 0.5,
    damage: 12,
    sight: 8,
    windup: 1.2,
    strikeRange: 7,
    xp: 35,
    ai: 'boar',
    poise: 24,
    staggerTime: 1.8,
    cooldown: 2.8,
    budget: 2,
    drops: [{ item: 'iron_ore', min: 1, max: 3, chance: 1 }],
  },
  rime_skitter: {
    kind: 28,
    name: 'Rime Skitter',
    hp: 26,
    speed: 2.8,
    radius: 0.3,
    damage: 8,
    sight: 8,
    windup: 0.9,
    strikeRange: 3.5,
    xp: 23,
    ai: 'leap',
    poise: 6,
    staggerTime: 1,
    cooldown: 2,
    budget: 1.5,
    drops: [{ item: 'silver_ore', min: 1, max: 2, chance: 0.45 }],
  },
  pool_lurker: {
    kind: 29,
    name: 'Stillwater Lurker',
    hp: 38,
    speed: 2.2,
    radius: 0.4,
    damage: 9,
    sight: 9,
    windup: 1.2,
    strikeRange: 6,
    xp: 26,
    ai: 'harrier',
    poise: 8,
    staggerTime: 1,
    cooldown: 2.8,
    budget: 1.5,
    drops: [
      { item: 'slime_gel', min: 2, max: 3, chance: 1 },
      { item: 'healing_potion', min: 1, max: 1, chance: 0.15 },
    ],
  },
  vault_guardian: {
    kind: 30,
    name: 'Vault Guardian',
    hp: 240,
    speed: 1.4,
    radius: 0.7,
    damage: 15,
    sight: 12,
    windup: 1.3,
    strikeRange: 7,
    xp: 140,
    ai: 'brute',
    armor: true,
    poise: 65,
    staggerTime: 2,
    cooldown: 2.2,
    aoe: 1.3,
    budget: 4,
    drops: [
      { item: 'gold_ore', min: 3, max: 5, chance: 1 },
      { item: 'qubit_crystal', min: 1, max: 2, chance: 1 },
    ],
  },
  spore_matriarch: {
    kind: 31,
    name: 'Lanternroot Matriarch',
    hp: 200,
    speed: 1.2,
    radius: 0.75,
    damage: 13,
    sight: 12,
    windup: 1.6,
    strikeRange: 7,
    xp: 140,
    ai: 'caster',
    poise: 40,
    staggerTime: 2,
    cooldown: 2.5,
    budget: 4,
    drops: [
      { item: 'healing_potion', min: 2, max: 4, chance: 1 },
      { item: 'qubit_crystal', min: 1, max: 2, chance: 1 },
    ],
  },
  veyr: {
    kind: 33,
    name: 'Veyr, the Stormbound Colossus',
    boss: true,
    hp: 1350,
    speed: 1.45,
    radius: 1.2,
    damage: 18,
    sight: 20,
    windup: 1.25,
    strikeRange: 2.8,
    xp: 950,
    ai: 'brute',
    armor: true,
    poise: 140,
    staggerTime: 2.1,
    resist: 0.1,
    cooldown: 2.2,
    aoe: 1.7,
    budget: 99,
    drops: [
      { item: 'storm_heart', min: 1, max: 1, chance: 1 },
      { item: 'heart_crystal', min: 1, max: 1, chance: 1 },
      { item: 'qubit_crystal', min: 4, max: 6, chance: 1 },
      { item: 'gold_ingot', min: 3, max: 4, chance: 1 },
    ],
  },
  bellkeeper: {
    kind: 32,
    name: 'The Hollow Bellkeeper',
    boss: true,
    hp: 1100,
    speed: 1.5,
    radius: 1.3,
    damage: 17,
    sight: 18,
    windup: 1.3,
    strikeRange: 7,
    xp: 700,
    ai: 'brute',
    armor: true,
    poise: 160,
    staggerTime: 1.8,
    resist: 0.1,
    cooldown: 2,
    aoe: 1.6,
    budget: 99,
    drops: [
      { item: 'heart_crystal', min: 1, max: 1, chance: 1 },
      { item: 'qubit_crystal', min: 3, max: 5, chance: 1 },
      { item: 'gold_ingot', min: 3, max: 5, chance: 1 },
    ],
  },
  guild_guard: {
    kind: 21,
    name: 'Guild Escort',
    hp: 60,
    speed: 2.6,
    radius: 0.35,
    damage: 8,
    sight: 8,
    windup: 0.65,
    strikeRange: 1.2,
    xp: 0,
    ai: 'melee',
    poise: 14,
    staggerTime: 0.9,
    cooldown: 1.1,
    budget: 2,
    drops: [],
  },
  // ── bosses (see bosses.ts)
  slime_king: {
    kind: 10,
    name: 'Gelatinous Sovereign',
    boss: true,
    hp: 900,
    speed: 1.5,
    radius: 1.4,
    damage: 16,
    sight: 18,
    windup: 1.1,
    strikeRange: 5,
    xp: 500,
    ai: 'leap',
    poise: 150,
    staggerTime: 1.2,
    armor: true,
    resist: 0.08,
    cooldown: 1.3,
    aoe: 3,
    budget: 99,
    drops: [
      { item: 'slime_core', min: 1, max: 1, chance: 1 },
      { item: 'heart_crystal', min: 1, max: 1, chance: 1 },
      { item: 'slime_gel', min: 10, max: 16, chance: 1 },
      { item: 'qubit_crystal', min: 1, max: 2, chance: 0.6 },
    ],
  },
  warden: {
    kind: 11,
    name: 'Warden of the Grove',
    boss: true,
    hp: 1400,
    speed: 2.5,
    radius: 1.1,
    damage: 20,
    sight: 18,
    windup: 0.9,
    strikeRange: 9,
    xp: 900,
    ai: 'boar',
    poise: 200,
    staggerTime: 1.2,
    armor: true,
    resist: 0.1,
    cooldown: 1.2,
    aoe: 1.8,
    budget: 99,
    drops: [
      { item: 'warden_heart', min: 1, max: 1, chance: 1 },
      { item: 'heart_crystal', min: 1, max: 1, chance: 1 },
      { item: 'boar_tusk', min: 3, max: 5, chance: 1 },
      { item: 'wolf_fang', min: 2, max: 4, chance: 1 },
      { item: 'hide', min: 3, max: 5, chance: 1 },
      { item: 'heartwood', min: 2, max: 4, chance: 0.8 },
    ],
  },
  pirate: {
    kind: 13,
    name: 'Corsair Sloop',
    sea: true,
    hp: 80,
    speed: 2.7,
    radius: 0.9,
    damage: 11,
    sight: 16,
    windup: 0.9,
    strikeRange: 9,
    xp: 70,
    ai: 'caster',
    poise: 40,
    staggerTime: 0.9,
    armor: true,
    resist: 0.4,
    cooldown: 1.6,
    budget: 2,
    drops: [
      { item: 'doubloon', min: 1, max: 3, chance: 0.9 },
      { item: 'plank', min: 2, max: 5, chance: 0.8 },
      { item: 'cloth', min: 1, max: 3, chance: 0.5 },
      { item: 'iron_ingot', min: 1, max: 1, chance: 0.2 },
    ],
  },
  serpent: {
    kind: 14,
    name: 'Brine Serpent',
    sea: true,
    hp: 150,
    speed: 3.4,
    radius: 0.8,
    damage: 18,
    sight: 12,
    windup: 0.8,
    strikeRange: 7,
    xp: 120,
    ai: 'brute',
    poise: 80,
    staggerTime: 1.1,
    armor: true,
    resist: 0.3,
    cooldown: 1.4,
    budget: 3,
    drops: [
      { item: 'doubloon', min: 2, max: 5, chance: 0.8 },
      { item: 'hide', min: 2, max: 3, chance: 0.9 },
      { item: 'qubit_crystal', min: 1, max: 2, chance: 0.35 },
    ],
  },
  colossus: {
    kind: 12,
    name: 'Decoherent Colossus',
    boss: true,
    hp: 2200,
    speed: 1.8,
    radius: 1.5,
    damage: 26,
    sight: 20,
    windup: 1.0,
    strikeRange: 9,
    xp: 1600,
    ai: 'brute',
    poise: 300,
    staggerTime: 1.4,
    armor: true,
    resist: 0.1,
    cooldown: 1.3,
    aoe: 2.2,
    budget: 99,
    drops: [
      { item: 'void_core', min: 1, max: 1, chance: 1 },
      { item: 'heart_crystal', min: 2, max: 2, chance: 1 },
      { item: 'qubit_crystal', min: 4, max: 6, chance: 1 },
      { item: 'iron_ore', min: 6, max: 10, chance: 1 },
      { item: 'coal', min: 4, max: 8, chance: 1 },
    ],
  },
  // ── Undercroft 2: one signature monster per cave biome, then the four arena bosses ──
  amber_gnawer: {
    kind: 34,
    name: 'Amber Gnawer',
    hp: 62,
    speed: 2,
    radius: 0.45,
    damage: 9,
    sight: 7,
    windup: 0.9,
    strikeRange: 2.4,
    xp: 30,
    ai: 'leap',
    armor: true,
    poise: 22,
    staggerTime: 1.4,
    cooldown: 2.2,
    budget: 2,
    drops: [
      { item: 'coal', min: 1, max: 3, chance: 1 },
      { item: 'copper_ore', min: 1, max: 2, chance: 0.5 },
    ],
  },
  lantern_hound: {
    kind: 35,
    name: 'Lantern Hound',
    hp: 40,
    speed: 2.9,
    radius: 0.4,
    damage: 7,
    sight: 10,
    windup: 0.8,
    strikeRange: 3,
    xp: 26,
    ai: 'harrier',
    poise: 8,
    staggerTime: 1,
    cooldown: 2.4,
    budget: 1.5,
    drops: [
      { item: 'healing_herb', min: 1, max: 2, chance: 0.8 },
      { item: 'fiber', min: 1, max: 2, chance: 0.6 },
    ],
  },
  geode_golem: {
    kind: 36,
    name: 'Geode Golem',
    hp: 130,
    speed: 1.2,
    radius: 0.6,
    damage: 14,
    sight: 8,
    windup: 1.4,
    strikeRange: 6,
    xp: 55,
    ai: 'brute',
    armor: true,
    poise: 40,
    staggerTime: 1.8,
    cooldown: 3,
    aoe: 1.1,
    budget: 3.5,
    drops: [
      { item: 'qubit_crystal', min: 1, max: 2, chance: 0.7 },
      { item: 'silver_ore', min: 1, max: 2, chance: 0.6 },
    ],
  },
  cinder_drake: {
    kind: 37,
    name: 'Cinder Drake',
    hp: 56,
    speed: 1.9,
    radius: 0.5,
    damage: 10,
    sight: 10,
    windup: 1.1,
    strikeRange: 7,
    xp: 38,
    ai: 'caster',
    poise: 12,
    staggerTime: 1.2,
    cooldown: 3,
    budget: 2.5,
    drops: [
      { item: 'coal', min: 2, max: 3, chance: 1 },
      { item: 'iron_ore', min: 1, max: 2, chance: 0.6 },
    ],
  },
  frost_wraith: {
    kind: 38,
    name: 'Rime Wraith',
    hp: 44,
    speed: 2.4,
    radius: 0.4,
    damage: 9,
    sight: 9,
    windup: 1,
    strikeRange: 3.3,
    xp: 34,
    ai: 'ambusher',
    poise: 6,
    staggerTime: 1,
    cooldown: 2.6,
    budget: 2,
    drops: [{ item: 'silver_ore', min: 1, max: 2, chance: 0.6 }],
  },
  tide_eel: {
    kind: 39,
    name: 'Stillwater Eel',
    hp: 50,
    speed: 2.6,
    radius: 0.4,
    damage: 11,
    sight: 8,
    windup: 1,
    strikeRange: 6,
    xp: 32,
    ai: 'boar',
    poise: 10,
    staggerTime: 1,
    cooldown: 2.8,
    budget: 2,
    drops: [
      { item: 'slime_gel', min: 1, max: 2, chance: 0.9 },
      { item: 'copper_ore', min: 1, max: 2, chance: 0.5 },
    ],
  },
  geode_tyrant: {
    kind: 40,
    name: 'The Geode Tyrant',
    boss: true,
    hp: 1250,
    speed: 1.4,
    radius: 1.3,
    damage: 18,
    sight: 18,
    windup: 1.3,
    strikeRange: 7,
    xp: 800,
    ai: 'brute',
    armor: true,
    poise: 170,
    staggerTime: 1.9,
    resist: 0.1,
    cooldown: 2,
    aoe: 1.6,
    budget: 99,
    drops: [
      { item: 'heart_crystal', min: 1, max: 1, chance: 1 },
      { item: 'qubit_crystal', min: 4, max: 6, chance: 1 },
      { item: 'silver_ingot', min: 2, max: 4, chance: 1 },
    ],
  },
  cinder_wyrm: {
    kind: 41,
    name: 'The Cinder Wyrm',
    boss: true,
    hp: 1350,
    speed: 1.7,
    radius: 1.3,
    damage: 19,
    sight: 18,
    windup: 1.2,
    strikeRange: 7,
    xp: 850,
    ai: 'brute',
    armor: true,
    poise: 160,
    staggerTime: 1.8,
    resist: 0.1,
    cooldown: 2,
    aoe: 1.6,
    budget: 99,
    drops: [
      { item: 'heart_crystal', min: 1, max: 1, chance: 1 },
      { item: 'qubit_crystal', min: 3, max: 5, chance: 1 },
      { item: 'gold_ingot', min: 3, max: 5, chance: 1 },
    ],
  },
  rime_sovereign: {
    kind: 42,
    name: 'The Rime Sovereign',
    boss: true,
    hp: 1300,
    speed: 1.6,
    radius: 1.2,
    damage: 18,
    sight: 18,
    windup: 1.25,
    strikeRange: 7,
    xp: 880,
    ai: 'brute',
    armor: true,
    poise: 150,
    staggerTime: 2,
    resist: 0.1,
    cooldown: 2.1,
    aoe: 1.6,
    budget: 99,
    drops: [
      { item: 'heart_crystal', min: 1, max: 1, chance: 1 },
      { item: 'qubit_crystal', min: 4, max: 6, chance: 1 },
      { item: 'silver_ingot', min: 3, max: 5, chance: 1 },
    ],
  },
  tide_leviathan: {
    kind: 43,
    name: 'The Stillwater Leviathan',
    boss: true,
    hp: 1450,
    speed: 1.5,
    radius: 1.4,
    damage: 20,
    sight: 18,
    windup: 1.3,
    strikeRange: 7,
    xp: 900,
    ai: 'brute',
    armor: true,
    poise: 175,
    staggerTime: 1.9,
    resist: 0.1,
    cooldown: 2,
    aoe: 1.7,
    budget: 99,
    drops: [
      { item: 'heart_crystal', min: 1, max: 1, chance: 1 },
      { item: 'qubit_crystal', min: 4, max: 6, chance: 1 },
      { item: 'gold_ingot', min: 3, max: 5, chance: 1 },
    ],
  },
  griffin: {
    kind: 44,
    name: 'Gilded Griffin',
    hp: 120,
    speed: 3.4,
    radius: 0.6,
    damage: 13,
    sight: 12,
    windup: 0.7,
    strikeRange: 3.2,
    xp: 85,
    ai: 'harrier',
    poise: 30,
    staggerTime: 1.2,
    cooldown: 2.2,
    budget: 3,
    drops: [
      { item: 'griffin_plume', min: 1, max: 2, chance: 0.9 },
      { item: 'feather', min: 2, max: 4, chance: 0.9 },
      { item: 'raw_meat', min: 1, max: 2, chance: 0.7 },
    ],
  },
  spirit_stag: {
    kind: 45,
    name: 'Spirit Stag',
    neutral: true,
    hp: 150,
    speed: 3.6,
    radius: 0.55,
    damage: 12,
    sight: 8,
    windup: 0.8,
    strikeRange: 2.4,
    xp: 80,
    ai: 'boar',
    poise: 40,
    staggerTime: 1.2,
    cooldown: 1.8,
    budget: 2,
    drops: [
      { item: 'stag_antler', min: 1, max: 1, chance: 0.9 },
      { item: 'hide', min: 2, max: 3, chance: 0.9 },
      { item: 'healing_herb', min: 2, max: 4, chance: 0.8 },
    ],
  },
  iron_golem: {
    kind: 46,
    name: 'Iron Golem',
    hp: 240,
    speed: 1.3,
    radius: 0.7,
    damage: 18,
    sight: 8,
    windup: 1.3,
    strikeRange: 6,
    xp: 110,
    ai: 'brute',
    armor: true,
    poise: 70,
    staggerTime: 1.8,
    resist: 0.3,
    cooldown: 3,
    aoe: 1.2,
    budget: 4,
    drops: [
      { item: 'iron_heart', min: 1, max: 1, chance: 0.85 },
      { item: 'iron_ore', min: 3, max: 6, chance: 1 },
      { item: 'coal', min: 2, max: 4, chance: 0.8 },
    ],
  },
  raiju: {
    kind: 47,
    name: 'Raiju',
    hp: 85,
    speed: 3.8,
    radius: 0.45,
    damage: 11,
    sight: 13,
    windup: 0.75,
    strikeRange: 2.6,
    xp: 75,
    ai: 'caster',
    poise: 14,
    staggerTime: 0.9,
    cooldown: 2,
    budget: 3,
    drops: [
      { item: 'raiju_fang', min: 1, max: 1, chance: 0.8 },
      { item: 'hide', min: 1, max: 2, chance: 0.7 },
      { item: 'qubit_crystal', min: 1, max: 1, chance: 0.3 },
    ],
  },
  reef_naga: {
    kind: 48,
    name: 'Reef Naga',
    hp: 110,
    speed: 2.6,
    radius: 0.55,
    damage: 14,
    sight: 11,
    windup: 0.85,
    strikeRange: 3.6,
    xp: 80,
    ai: 'ambusher',
    poise: 24,
    staggerTime: 1.1,
    cooldown: 2.4,
    budget: 3,
    drops: [
      { item: 'naga_pearl', min: 1, max: 1, chance: 0.8 },
      { item: 'hide', min: 1, max: 2, chance: 0.8 },
      { item: 'doubloon', min: 1, max: 3, chance: 0.5 },
    ],
  },
  hellhound: {
    kind: 49,
    name: 'Hellhound',
    hp: 100,
    speed: 3.5,
    radius: 0.5,
    damage: 14,
    sight: 12,
    windup: 0.7,
    strikeRange: 3,
    xp: 80,
    ai: 'harrier',
    poise: 22,
    staggerTime: 1,
    cooldown: 2,
    budget: 3,
    drops: [
      { item: 'hellhound_ember', min: 1, max: 2, chance: 0.85 },
      { item: 'coal', min: 2, max: 3, chance: 0.9 },
      { item: 'raw_meat', min: 1, max: 2, chance: 0.6 },
    ],
  },
};
import { ARMY_DEFS, type ArmyKey } from './army';
export const ENEMY_DEFS = { ...BASE_ENEMY_DEFS, ...ARMY_DEFS, ...BESTIARY_DEFS } as Record<
  keyof typeof BASE_ENEMY_DEFS | ArmyKey | BestiaryKey,
  EnemyDef
>;
export const ENEMY_BY_KIND: EnemyDef[] = [
  ENEMY_DEFS.slime,
  ENEMY_DEFS.hopper,
  ENEMY_DEFS.rabbit,
  ENEMY_DEFS.deer,
  ENEMY_DEFS.wisp,
  ENEMY_DEFS.brute,
  ENEMY_DEFS.mite,
  ENEMY_DEFS.boar,
  ENEMY_DEFS.wolf,
  ENEMY_DEFS.badger,
  ENEMY_DEFS.slime_king,
  ENEMY_DEFS.warden,
  ENEMY_DEFS.colossus,
  ENEMY_DEFS.pirate,
  ENEMY_DEFS.serpent,
  ENEMY_DEFS.fox,
  ENEMY_DEFS.otter,
  ENEMY_DEFS.tortoise,
  ENEMY_DEFS.owl,
  ENEMY_DEFS.thornling,
  ENEMY_DEFS.glasscrawler,
  ENEMY_DEFS.guild_guard,
  ENEMY_DEFS.reed_stalker,
  ENEMY_DEFS.cinder_moth,
  ENEMY_DEFS.echo_bat,
  ENEMY_DEFS.spore_sage,
  ENEMY_DEFS.prism_beetle,
  ENEMY_DEFS.blind_ram,
  ENEMY_DEFS.rime_skitter,
  ENEMY_DEFS.pool_lurker,
  ENEMY_DEFS.vault_guardian,
  ENEMY_DEFS.spore_matriarch,
  ENEMY_DEFS.bellkeeper,
  ENEMY_DEFS.veyr,
  ENEMY_DEFS.amber_gnawer,
  ENEMY_DEFS.lantern_hound,
  ENEMY_DEFS.geode_golem,
  ENEMY_DEFS.cinder_drake,
  ENEMY_DEFS.frost_wraith,
  ENEMY_DEFS.tide_eel,
  ENEMY_DEFS.geode_tyrant,
  ENEMY_DEFS.cinder_wyrm,
  ENEMY_DEFS.rime_sovereign,
  ENEMY_DEFS.tide_leviathan,
  ENEMY_DEFS.griffin,
  ENEMY_DEFS.spirit_stag,
  ENEMY_DEFS.iron_golem,
  ENEMY_DEFS.raiju,
  ENEMY_DEFS.reef_naga,
  ENEMY_DEFS.hellhound,
  ...Object.values(ARMY_DEFS),
  ...BESTIARY_KEYS.map((id) => BESTIARY_DEFS[id]),
];
export type EnemyKindName = keyof typeof ENEMY_DEFS;
/** ENEMY_DEFS key by numeric kind, for rules that are written by species name. */
export const ENEMY_KEY_BY_KIND: Record<number, string> = Object.fromEntries(
  Object.entries(ENEMY_DEFS).map(([k, d]) => [d.kind, k]),
);

export const NIGHT_HP_MULT = 1.6;
export const NIGHT_DMG_MULT = 1.4;

/** Elite modifiers (bit flags, synced as EnemyState.elite). */
export const ELITE = { HARDENED: 1, SWIFT: 2, VOLATILE: 4 } as const;
export const ELITE_NAMES: Record<number, string> = { 1: 'Hardened', 2: 'Swift', 4: 'Volatile' };
export const ELITE_HP_MULT = 1.7;
export const ELITE_XP_MULT = 2.5;

export function eliteChance(level: number, night: boolean): number {
  if (level < 3) return 0;
  return Math.min(0.2, 0.02 + 0.012 * level + (night ? 0.04 : 0));
}

/** Stat multipliers for an enemy spawned for a player of `level` (1..10+). */
export function enemyScale(level: number): { hp: number; dmg: number; xp: number } {
  const l = Math.max(0, Math.min(14, level - 1));
  return { hp: 1 + 0.07 * l, dmg: 1 + 0.05 * l, xp: 1 + 0.06 * l };
}

/** Ambient encounter weights by habitat, level and time of day. */
export function spawnTable(
  level: number,
  night: boolean,
  biome: Biome = 'meadow',
  cave = false,
  cavern: CaveBiome = 'limestone',
  modern = false,
): Array<{ kind: EnemyKindName; w: number }> {
  if (cave && modern) {
    // Undercroft 2: each cave biome has its own signature monster alongside the common cave fauna
    const kinds: Record<CaveBiome, Array<[EnemyKindName, number, number]>> = {
      limestone: [
        ['echo_bat', 2, 1],
        ['amber_gnawer', 3, 3],
        ['blind_ram', 1, 4],
      ],
      glowmoss: [
        ['echo_bat', 1, 1],
        ['lantern_hound', 3, 2],
        ['spore_sage', 2, 3],
      ],
      crystal: [
        ['echo_bat', 1, 1],
        ['geode_golem', 2, 5],
        ['prism_beetle', 2, 3],
      ],
      basalt: [
        ['cinder_drake', 3, 4],
        ['blind_ram', 2, 3],
        ['prism_beetle', 1, 4],
      ],
      frost: [
        ['frost_wraith', 3, 3],
        ['rime_skitter', 2, 2],
        ['echo_bat', 1, 1],
      ],
      drowned: [
        ['tide_eel', 3, 3],
        ['pool_lurker', 2, 2],
        ['spore_sage', 1, 3],
      ],
    };
    const ok = kinds[cavern].filter(([, , min]) => level >= min).map(([kind, w]) => ({ kind, w }));
    return ok.length ? ok : [{ kind: 'echo_bat', w: 1 }];
  }
  if (cave) {
    const kinds: Record<CaveBiome, EnemyKindName[]> = {
      limestone: ['echo_bat', 'blind_ram'],
      glowmoss: ['echo_bat', 'spore_sage'],
      crystal: ['prism_beetle', 'echo_bat'],
      basalt: ['blind_ram', 'prism_beetle'],
      frost: ['rime_skitter', 'echo_bat'],
      drowned: ['pool_lurker', 'spore_sage'],
    };
    const allowed = kinds[cavern].filter((k) => level >= 3 || (k !== 'blind_ram' && k !== 'prism_beetle'));
    return level < 2 || !allowed.length ? [{ kind: 'echo_bat', w: 1 }] : allowed.map((kind) => ({ kind, w: 2 }));
  }
  if (level < 2)
    return [
      { kind: 'slime', w: 3 },
      { kind: 'hopper', w: 1 },
    ];
  const table: Array<[EnemyKindName, number]> =
    biome === 'enchanted'
      ? [
          ['wisp', 6],
          ['glasscrawler', 4],
          ['hopper', 1],
        ]
      : biome === 'corrupted'
        ? [
            ['mite', 5],
            ['brute', 3],
            ['glasscrawler', 2],
          ]
        : biome === 'swamp'
          ? [
              ['slime', 6],
              ['mite', 2],
              ['wisp', night ? 2 : 0],
              ['reed_stalker', 2],
            ]
          : biome === 'desert'
            ? [
                ['hopper', 5],
                ['mite', 3],
                ['brute', 1],
                ['cinder_moth', 2],
              ]
            : biome === 'taiga'
              ? [
                  ['wolf', 5],
                  ['hopper', 3],
                  ['slime', 2],
                ]
              : biome === 'forest' || biome === 'autumn'
                ? [
                    ['thornling', 3],
                    ['hopper', 4],
                    ['wolf', night ? 3 : 0],
                    ['slime', 2],
                    ['reed_stalker', 2],
                  ]
                : [
                    ['slime', 6],
                    ['hopper', 3],
                    ['wisp', night ? 2 : 0],
                  ];
  return [
    ...(modern ? rareSpawnEntries(level, night, biome) : []),
    ...table
      .filter(
        ([kind, w]) =>
          w > 0 &&
          (kind !== 'reed_stalker' || level >= 4) &&
          (kind !== 'cinder_moth' || level >= 5) &&
          (!['brute', 'wolf', 'thornling', 'glasscrawler'].includes(kind) || level >= (kind === 'brute' ? 4 : 3)),
      )
      .map(([kind, w]) => ({ kind, w })),
  ];
}

export function pickSpawn(
  level: number,
  night: boolean,
  roll: number,
  biome: Biome = 'meadow',
  cave = false,
  cavern: CaveBiome = 'limestone',
  modern = false,
): EnemyKindName {
  const t = spawnTable(level, night, biome, cave, cavern, modern);
  const total = t.reduce((a, b) => a + b.w, 0);
  let r = roll * total;
  for (const e of t) {
    r -= e.w;
    if (r < 0) return e.kind;
  }
  return t[t.length - 1]!.kind;
}

/** Spawn budget (sum of EnemyDef.budget) kept around each player. */
export function spawnBudget(level: number, night: boolean, biome: Biome = 'meadow'): number {
  return (night ? 4 : 3) + Math.min(2, Math.max(0, level - 1) * 0.2) + (biome === 'corrupted' ? 1 : 0);
}

/** Each kingdom's signature mythical beast, spawned in its wilds from revision 5. */
export const REALM_BEAST: Record<
  'aurelion' | 'sylvaris' | 'khardum' | 'raijin' | 'thalassara' | 'nethrakar',
  EnemyKindName
> = {
  aurelion: 'griffin',
  sylvaris: 'spirit_stag',
  khardum: 'iron_golem',
  raijin: 'raiju',
  thalassara: 'reef_naga',
  nethrakar: 'hellhound',
};
