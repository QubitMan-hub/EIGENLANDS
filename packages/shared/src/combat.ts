import { PROJECTILE_DAMAGE } from './constants';

export interface ComboHit { damage: number; range: number; arc: number; knockback: number }

/** Three-hit sword combo. `arc` is the half-angle cosine threshold. */
export const COMBO: ComboHit[] = [
  { damage: 8, range: 1.4, arc: Math.cos((55 * Math.PI) / 180), knockback: 2.5 },
  { damage: 9, range: 1.4, arc: Math.cos((55 * Math.PI) / 180), knockback: 2.5 },
  { damage: 16, range: 1.8, arc: Math.cos((80 * Math.PI) / 180), knockback: 6 },
];

export const SKILL_DAMAGE = PROJECTILE_DAMAGE;

export interface Circle { x: number; y: number; r: number }

/** Does a melee arc from (ox,oy) facing (fx,fy) touch the target circle? */
export function inArc(ox: number, oy: number, fx: number, fy: number, hit: ComboHit, t: Circle): boolean {
  const dx = t.x - ox;
  const dy = t.y - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > hit.range + t.r) return false;
  if (dist <= t.r + 0.3) return true; // point blank always hits
  return (dx * fx + dy * fy) / dist >= hit.arc;
}

/** Segment (a->b) vs circle, for projectile sweeps. */
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

export function xpForLevel(level: number): number {
  return 30 + 20 * (level - 1);
}

export function maxHpForLevel(level: number, base: number): number {
  return base + (level - 1) * 8;
}

export interface EnemyDef {
  kind: number;
  name: string;
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  sight: number;
  windup: number;
  strikeRange: number;
  xp: number;
}

export const ENEMY_DEFS: Record<'slime' | 'hopper', EnemyDef> = {
  slime: { kind: 0, name: 'Wisp Slime', hp: 30, speed: 2.1, radius: 0.4, damage: 7, sight: 7, windup: 0.55, strikeRange: 1.1, xp: 10 },
  hopper: { kind: 1, name: 'Glint Hopper', hp: 22, speed: 3.0, radius: 0.35, damage: 9, sight: 9, windup: 0.7, strikeRange: 3.0, xp: 14 },
};
export const ENEMY_BY_KIND: EnemyDef[] = [ENEMY_DEFS.slime, ENEMY_DEFS.hopper];

export const NIGHT_HP_MULT = 1.6;
export const NIGHT_DMG_MULT = 1.4;
