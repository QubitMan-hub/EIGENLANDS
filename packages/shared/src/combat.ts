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
  damage: number; range: number; arc: number; knockback: number;
  poise: number; weight: number;
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
    damage: Math.round(20 + 14 * l), range: 2.1 + 0.35 * l, arc: cosDeg(100), knockback: 8.5 + 4 * l,
    poise: Math.round(24 + 16 * l), weight: l >= 1 ? 3 : 2, lunge: 0.35 + 0.35 * l, recovery: 0.45,
  };
}

export const SKILL_DAMAGE = PROJECTILE_DAMAGE;
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

export function critChance(luck: number): number { return Math.min(0.5, CRIT_BASE + CRIT_PER_LUCK * Math.max(0, luck)); }

/** Random crits only come from melee; a counter (attack after a perfect dodge) always crits. */
export function rollCrit(roll: number, luck: number, counter: boolean, melee: boolean): boolean {
  if (counter) return true;
  return melee && roll < critChance(luck);
}

export interface HitResult { damage: number; poise: number; knockback: number; flinch: boolean }

/** Final damage/poise/knockback of a hit on an enemy after crit, stagger vulnerability and armour. */
export function resolveHit(
  def: Pick<EnemyDef, 'armor'>, base: { damage: number; poise: number; knockback: number; weight: number },
  o: { crit: boolean; staggered: boolean; counter?: boolean },
): HitResult {
  let dmg = base.damage, poise = base.poise, kb = base.knockback;
  if (o.crit) dmg *= CRIT_MULT;
  if (o.counter) poise *= 1.5;
  if (o.staggered) dmg *= VULNERABLE_MULT;
  const armoured = !!def.armor && !o.staggered && base.weight < 1;
  if (armoured) { dmg *= ARMOR_LIGHT_MULT; poise = 0; kb *= 0.3; }
  return { damage: Math.max(1, Math.round(dmg)), poise, knockback: kb, flinch: !armoured };
}

// ───────────────────────── wall slam ─────────────────────────

/** knockback speed (tiles/s) at which being blocked by a wall counts as a slam */
export const SLAM_SPEED = 4.5;
export function slamDamage(speed: number): number { return Math.round(4 + speed * 0.9); }
export const SLAM_POISE = 18;

// ───────────────────────── dodging ─────────────────────────

/** `ifrT` counts down from IFRAME_TIME when a dash starts. */
export function hasIframes(sim: { ifrT: number }): boolean { return sim.ifrT > 0; }
export function isPerfectDodge(sim: { ifrT: number }): boolean { return sim.ifrT > IFRAME_TIME - PERFECT_WINDOW + 1e-9; }

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

export interface Circle { x: number; y: number; r: number }

/** Does a melee arc from (ox,oy) facing (fx,fy) touch the target circle? */
export function inArc(ox: number, oy: number, fx: number, fy: number, hit: Pick<ComboHit, 'range' | 'arc'>, t: Circle): boolean {
  const dx = t.x - ox;
  const dy = t.y - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > hit.range + t.r) return false;
  if (dist <= t.r + 0.3) return true; // point blank always hits
  return (dx * fx + dy * fy) / dist >= hit.arc;
}

/** Segment (a->b) vs circle, for projectile sweeps and charge lanes. */
export function segmentHitsCircle(ax: number, ay: number, bx: number, by: number, rad: number, c: Circle): boolean {
  const vx = bx - ax, vy = by - ay;
  const l2 = vx * vx + vy * vy;
  let t = l2 > 0 ? ((c.x - ax) * vx + (c.y - ay) * vy) / l2 : 0;
  t = Math.min(1, Math.max(0, t));
  const px = ax + vx * t - c.x;
  const py = ay + vy * t - c.y;
  const rr = rad + c.r;
  return px * px + py * py <= rr * rr;
}

export interface PosSample { tick: number; x: number; y: number }

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

export interface DropDef { item: string; min: number; max: number; chance: number }
export type EnemyAi = 'melee' | 'leap' | 'caster' | 'brute' | 'swarm' | 'passive' | 'boar';
export interface EnemyDef {
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
export const ENEMY_DEFS: Record<'slime' | 'hopper' | 'rabbit' | 'deer' | 'wisp' | 'brute' | 'mite' | 'boar' | 'wolf' | 'badger' | 'slime_king' | 'warden' | 'colossus', EnemyDef> = {
  slime: { kind: 0, name: 'Wisp Slime', hp: 30, speed: 2.1, radius: 0.4, damage: 7, sight: 7, windup: 0.55, strikeRange: 1.1, xp: 10, ...melee, poise: 8, staggerTime: 0.7, cooldown: 0.5, budget: 1, drops: [{ item: 'slime_gel', min: 1, max: 2, chance: 0.7 }] },
  hopper: { kind: 1, name: 'Glint Hopper', hp: 22, speed: 3.0, radius: 0.35, damage: 9, sight: 9, windup: 0.7, strikeRange: 3.0, xp: 14, ai: 'leap', poise: 6, staggerTime: 0.7, cooldown: 0.6, budget: 1, drops: [{ item: 'hopper_tooth', min: 1, max: 1, chance: 0.45 }, { item: 'hide', min: 1, max: 1, chance: 0.25 }] },
  rabbit: { kind: 2, name: 'Meadow Rabbit', passive: true, ai: 'passive', hp: 8, speed: 4.6, radius: 0.3, damage: 0, sight: 6, windup: 0, strikeRange: 0, xp: 3, drops: [{ item: 'raw_meat', min: 1, max: 1, chance: 0.9 }, { item: 'hide', min: 1, max: 1, chance: 0.5 }] },
  deer: { kind: 3, name: 'Eigendeer', passive: true, ai: 'passive', hp: 36, speed: 5.4, radius: 0.5, damage: 0, sight: 9, windup: 0, strikeRange: 0, xp: 12, drops: [{ item: 'raw_meat', min: 2, max: 3, chance: 1 }, { item: 'hide', min: 1, max: 2, chance: 0.8 }] },
  /** ranged: keeps its distance and fires slow, dodgeable (and reflectable) orbs after a visible aim line */
  wisp: { kind: 4, name: 'Phase Wisp', hp: 18, speed: 2.5, radius: 0.35, damage: 8, sight: 10, windup: 0.8, strikeRange: 7, xp: 16, ai: 'caster', poise: 5, staggerTime: 0.8, cooldown: 1.5, budget: 1, drops: [{ item: 'slime_gel', min: 1, max: 1, chance: 0.4 }, { item: 'qubit_crystal', min: 1, max: 1, chance: 0.06 }] },
  /** armoured bruiser: long telegraphed charge (crashes into walls), close-range ground slam */
  brute: { kind: 5, name: 'Decoherent Brute', hp: 95, speed: 1.7, radius: 0.55, damage: 16, sight: 9, windup: 0.95, strikeRange: 7, xp: 45, ai: 'brute', poise: 40, staggerTime: 1.4, armor: true, resist: 0.25, cooldown: 1.4, budget: 3, drops: [{ item: 'iron_ore', min: 1, max: 2, chance: 0.7 }, { item: 'coal', min: 1, max: 2, chance: 0.5 }, { item: 'hide', min: 1, max: 1, chance: 0.35 }] },
  /** swarm: tiny, fast, fragile, come in packs */
  mite: { kind: 6, name: 'Static Mite', hp: 6, speed: 4.3, radius: 0.22, damage: 3, sight: 8, windup: 0.32, strikeRange: 0.75, xp: 3, ai: 'swarm', poise: 0, staggerTime: 0.35, cooldown: 0.6, budget: 0.34, drops: [{ item: 'copper_ore', min: 1, max: 1, chance: 0.12 }] },
  /** wild boar: roots around peacefully; hurt it or crowd it and it lowers its head and charges (long telegraph, dodge sideways) */
  boar: { kind: 7, name: 'Wild Boar', neutral: true, ai: 'boar', hp: 58, speed: 2.4, radius: 0.5, damage: 13, sight: 7, windup: 0.75, strikeRange: 6, xp: 24, poise: 22, staggerTime: 1.0, resist: 0.5, cooldown: 1.6, budget: 0, drops: [{ item: 'raw_meat', min: 2, max: 3, chance: 1 }, { item: 'hide', min: 1, max: 2, chance: 0.7 }, { item: 'boar_tusk', min: 1, max: 1, chance: 0.35 }] },
  /** wolf: pack hunter of forests and snowfields; circles, then lunges with a short, readable windup */
  wolf: { kind: 8, name: 'Dire Wolf', hp: 44, speed: 4.2, radius: 0.45, damage: 10, sight: 12, windup: 0.6, strikeRange: 3.6, xp: 30, ai: 'leap', poise: 10, staggerTime: 0.8, cooldown: 0.9, budget: 1.5, drops: [{ item: 'hide', min: 1, max: 2, chance: 0.8 }, { item: 'wolf_fang', min: 1, max: 1, chance: 0.4 }, { item: 'raw_meat', min: 1, max: 2, chance: 0.8 }] },
  /** badger: small, stubborn and fast to bite; leave it alone and it digs for grubs */
  badger: { kind: 9, name: 'Badger', neutral: true, ai: 'melee', hp: 30, speed: 3.2, radius: 0.35, damage: 8, sight: 6, windup: 0.4, strikeRange: 1.1, xp: 14, poise: 6, staggerTime: 0.6, cooldown: 0.7, budget: 0, drops: [{ item: 'hide', min: 1, max: 1, chance: 0.6 }, { item: 'raw_meat', min: 1, max: 1, chance: 0.7 }] },
  // ── bosses (see bosses.ts)
  slime_king: { kind: 10, name: 'Gelatinous Sovereign', boss: true, hp: 900, speed: 1.5, radius: 1.4, damage: 16, sight: 18, windup: 1.1, strikeRange: 5, xp: 500, ai: 'leap', poise: 150, staggerTime: 1.2, armor: true, resist: 0.08, cooldown: 1.3, aoe: 3, budget: 99,
    drops: [{ item: 'slime_core', min: 1, max: 1, chance: 1 }, { item: 'heart_crystal', min: 1, max: 1, chance: 1 }, { item: 'slime_gel', min: 10, max: 16, chance: 1 }, { item: 'qubit_crystal', min: 1, max: 2, chance: 0.6 }] },
  warden: { kind: 11, name: 'Warden of the Grove', boss: true, hp: 1400, speed: 2.5, radius: 1.1, damage: 20, sight: 18, windup: 0.9, strikeRange: 9, xp: 900, ai: 'boar', poise: 200, staggerTime: 1.2, armor: true, resist: 0.1, cooldown: 1.2, aoe: 1.8, budget: 99,
    drops: [{ item: 'warden_heart', min: 1, max: 1, chance: 1 }, { item: 'heart_crystal', min: 1, max: 1, chance: 1 }, { item: 'boar_tusk', min: 3, max: 5, chance: 1 }, { item: 'wolf_fang', min: 2, max: 4, chance: 1 }, { item: 'hide', min: 3, max: 5, chance: 1 }, { item: 'heartwood', min: 2, max: 4, chance: 0.8 }] },
  colossus: { kind: 12, name: 'Decoherent Colossus', boss: true, hp: 2200, speed: 1.8, radius: 1.5, damage: 26, sight: 20, windup: 1.0, strikeRange: 9, xp: 1600, ai: 'brute', poise: 300, staggerTime: 1.4, armor: true, resist: 0.1, cooldown: 1.3, aoe: 2.2, budget: 99,
    drops: [{ item: 'void_core', min: 1, max: 1, chance: 1 }, { item: 'heart_crystal', min: 2, max: 2, chance: 1 }, { item: 'qubit_crystal', min: 4, max: 6, chance: 1 }, { item: 'iron_ore', min: 6, max: 10, chance: 1 }, { item: 'coal', min: 4, max: 8, chance: 1 }] },
};
export const ENEMY_BY_KIND: EnemyDef[] = [ENEMY_DEFS.slime, ENEMY_DEFS.hopper, ENEMY_DEFS.rabbit, ENEMY_DEFS.deer, ENEMY_DEFS.wisp, ENEMY_DEFS.brute, ENEMY_DEFS.mite, ENEMY_DEFS.boar, ENEMY_DEFS.wolf, ENEMY_DEFS.badger, ENEMY_DEFS.slime_king, ENEMY_DEFS.warden, ENEMY_DEFS.colossus];
export type EnemyKindName = keyof typeof ENEMY_DEFS;

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

/** Ambient spawn table for the meadow: weights by player level and time of day. */
export function spawnTable(level: number, night: boolean): Array<{ kind: EnemyKindName; w: number }> {
  const t: Array<{ kind: EnemyKindName; w: number }> = [
    { kind: 'slime', w: night ? 26 : 40 },
    { kind: 'hopper', w: night ? 26 : 22 },
  ];
  if (level >= 2 || night) t.push({ kind: 'wisp', w: night ? 20 : 14 }, { kind: 'mite', w: night ? 16 : 10 });
  if (level >= 4 || (night && level >= 3)) t.push({ kind: 'brute', w: night ? 12 : 7 });
  return t;
}

export function pickSpawn(level: number, night: boolean, roll: number): EnemyKindName {
  const t = spawnTable(level, night);
  const total = t.reduce((a, b) => a + b.w, 0);
  let r = roll * total;
  for (const e of t) { r -= e.w; if (r < 0) return e.kind; }
  return t[t.length - 1]!.kind;
}

/** Spawn budget (sum of EnemyDef.budget) kept around each player. */
export function spawnBudget(level: number, night: boolean): number {
  return (night ? 8 : 4.5) + Math.min(3, Math.max(0, level - 1) * 0.35);
}
