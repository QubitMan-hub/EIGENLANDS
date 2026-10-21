import {
  ENEMY_BY_KIND, ENEMY_DEFS, NIGHT_DMG_MULT, NIGHT_HP_MULT, moveBody, type EnemyDef, type PosSample,
  type SolidQuery,
} from '@eigenlands/shared';
import { EnemyState } from '@eigenlands/shared';

export type EnemyMode = 'idle' | 'wander' | 'chase' | 'windup' | 'leap' | 'recover';

export interface Enemy {
  id: string;
  state: EnemyState;
  def: EnemyDef;
  x: number;
  y: number;
  kx: number; // knockback velocity
  ky: number;
  hp: number;
  maxHp: number;
  night: boolean;
  mode: EnemyMode;
  t: number;
  wx: number;
  wy: number;
  lockX: number;
  lockY: number;
  /** knockback multiplier (bosses will use 0..0.2) */
  resist: number;
  lastHitBy: string | null;
  history: PosSample[];
}

let seq = 0;

export type EnemyKind = keyof typeof ENEMY_DEFS;

export function createEnemy(kind: EnemyKind, x: number, y: number, night: boolean): Enemy {
  const def = ENEMY_DEFS[kind];
  const maxHp = Math.round(def.hp * (night && !def.passive ? NIGHT_HP_MULT : 1));
  const state = new EnemyState();
  const id = `e${++seq}`;
  state.id = id; state.kind = def.kind; state.x = x; state.y = y; state.hp = maxHp; state.maxHp = maxHp; state.night = night;
  return {
    id, state, def, x, y, kx: 0, ky: 0, hp: maxHp, maxHp, night, mode: 'idle', t: 1, wx: 0, wy: 0,
    lockX: 0, lockY: 0, resist: 1, lastHitBy: null, history: [],
  };
}

export const enemyDamage = (e: Enemy) => Math.round(e.def.damage * (e.night ? NIGHT_DMG_MULT : 1));
export const defOf = (kind: number) => ENEMY_BY_KIND[kind]!;

export interface Target { id: string; x: number; y: number; alive: boolean }
export interface EnemyHooks {
  /** Called when a strike lands; the room applies damage to anyone in range. */
  strike(e: Enemy, x: number, y: number, radius: number): void;
  telegraph(e: Enemy): void;
}

const LEAP_TIME = 0.25;

/** One AI tick. Pure with respect to the world apart from the hooks. */
export function stepEnemy(
  e: Enemy, dt: number, tick: number, targets: Target[], solid: SolidQuery, rand: () => number, hooks: EnemyHooks,
): void {
  if (e.def.passive) { stepPassive(e, dt, tick, targets, solid, rand); return; }
  // knockback decay
  if (Math.abs(e.kx) + Math.abs(e.ky) > 0.05) {
    moveBody(e, e.kx * dt, e.ky * dt, e.def.radius, solid);
    const k = Math.pow(0.02, dt);
    e.kx *= k; e.ky *= k;
  } else { e.kx = 0; e.ky = 0; }

  let target: Target | null = null;
  let best = e.def.sight;
  for (const p of targets) {
    if (!p.alive) continue;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < best) { best = d; target = p; }
  }

  e.t -= dt;
  switch (e.mode) {
    case 'idle':
    case 'wander': {
      if (target) { e.mode = 'chase'; break; }
      if (e.t <= 0) {
        if (e.mode === 'idle') {
          const a = rand() * Math.PI * 2;
          e.wx = Math.cos(a); e.wy = Math.sin(a);
          e.mode = 'wander'; e.t = 0.8 + rand() * 1.2;
        } else { e.mode = 'idle'; e.t = 1 + rand() * 2; }
      }
      if (e.mode === 'wander') {
        moveBody(e, e.wx * e.def.speed * 0.4 * dt, e.wy * e.def.speed * 0.4 * dt, e.def.radius, solid);
        e.state.faceX = e.wx; e.state.faceY = e.wy;
      }
      break;
    }
    case 'chase': {
      if (!target) { e.mode = 'idle'; e.t = 1; break; }
      const dx = target.x - e.x, dy = target.y - e.y, d = Math.hypot(dx, dy) || 1;
      e.state.faceX = dx / d; e.state.faceY = dy / d;
      const trigger = e.def.kind === 1 ? e.def.strikeRange * 0.85 : e.def.strikeRange * 0.8;
      if (d <= trigger) {
        e.mode = 'windup'; e.t = e.def.windup;
        e.lockX = target.x; e.lockY = target.y;
        hooks.telegraph(e);
      } else {
        moveBody(e, (dx / d) * e.def.speed * dt, (dy / d) * e.def.speed * dt, e.def.radius, solid);
      }
      break;
    }
    case 'windup': {
      e.state.tele = Math.max(1, Math.min(100, Math.round((1 - e.t / e.def.windup) * 100)));
      if (e.t <= 0) {
        e.state.tele = 0;
        if (e.def.kind === 1) {
          // hopper commits to the locked position; dodgeable by moving away / dashing
          e.mode = 'leap'; e.t = LEAP_TIME;
        } else {
          hooks.strike(e, e.x, e.y, e.def.strikeRange);
          e.mode = 'recover'; e.t = 0.7;
        }
      }
      break;
    }
    case 'leap': {
      const dx = e.lockX - e.x, dy = e.lockY - e.y, d = Math.hypot(dx, dy);
      const maxStep = (e.def.strikeRange + 1.2) / LEAP_TIME * dt;
      if (d > 0.05) {
        const s = Math.min(d, maxStep);
        moveBody(e, (dx / d) * s, (dy / d) * s, e.def.radius, solid);
      }
      if (e.t <= 0) {
        hooks.strike(e, e.x, e.y, 1.0);
        e.mode = 'recover'; e.t = 0.9;
      }
      break;
    }
    case 'recover':
      if (e.t <= 0) { e.mode = 'idle'; e.t = 0.3; }
      break;
  }

  e.state.x = e.x; e.state.y = e.y;
  e.history.push({ tick, x: e.x, y: e.y });
  if (e.history.length > 12) e.history.shift();
}

/** Passive fauna: wander, bolt away from players that get close, never attack. */
function stepPassive(e: Enemy, dt: number, tick: number, targets: Target[], solid: SolidQuery, rand: () => number): void {
  if (Math.abs(e.kx) + Math.abs(e.ky) > 0.05) {
    moveBody(e, e.kx * dt, e.ky * dt, e.def.radius, solid);
    const k = Math.pow(0.02, dt);
    e.kx *= k; e.ky *= k;
  } else { e.kx = 0; e.ky = 0; }
  let threat: Target | null = null;
  let best = e.def.sight;
  for (const p of targets) {
    if (!p.alive) continue;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < best) { best = d; threat = p; }
  }
  e.t -= dt;
  if (threat) {
    // flee directly away, with a little zig-zag so they are huntable but not trivial
    const dx = e.x - threat.x, dy = e.y - threat.y, d = Math.hypot(dx, dy) || 1;
    const jitter = Math.sin(tick * 0.6 + e.maxHp) * 0.5;
    const ux = dx / d, uy = dy / d;
    const vx = ux - uy * jitter, vy = uy + ux * jitter, vl = Math.hypot(vx, vy) || 1;
    moveBody(e, (vx / vl) * e.def.speed * dt, (vy / vl) * e.def.speed * dt, e.def.radius, solid);
    e.mode = 'chase';
    e.state.faceX = vx / vl; e.state.faceY = vy / vl;
  } else {
    if (e.t <= 0) {
      if (e.mode !== 'wander') { const a = rand() * Math.PI * 2; e.wx = Math.cos(a); e.wy = Math.sin(a); e.mode = 'wander'; e.t = 0.8 + rand() * 1.6; }
      else { e.mode = 'idle'; e.t = 1.5 + rand() * 3; }
    }
    if (e.mode === 'wander') {
      moveBody(e, e.wx * e.def.speed * 0.25 * dt, e.wy * e.def.speed * 0.25 * dt, e.def.radius, solid);
      e.state.faceX = e.wx; e.state.faceY = e.wy;
    }
  }
  e.state.x = e.x; e.state.y = e.y;
  e.history.push({ tick, x: e.x, y: e.y });
  if (e.history.length > 12) e.history.shift();
}
