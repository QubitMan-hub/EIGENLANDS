import {
  ATK,
  BRUTE_SLAM_RADIUS,
  BRUTE_SLAM_WINDUP,
  CHARGE_DIST,
  CHARGE_SPEED,
  CHARGE_WIDTH,
  ELITE,
  ELITE_HP_MULT,
  ENEMY_BY_KIND,
  ENEMY_DEFS,
  LEAP_RADIUS,
  LEAP_TIME,
  NIGHT_DMG_MULT,
  NIGHT_HP_MULT,
  ORB_RANGE,
  POISE_REGEN_DELAY,
  SHOCKWAVE_RADIUS,
  SLAM_SPEED,
  SLIP_SLOW,
  enemyScale,
  moveBody,
  type EnemyDef,
  type EnemyKindName,
  type PosSample,
  CLIFF,
  type SolidQuery,
} from '@eigenlands/shared';
import { EnemyState } from '@eigenlands/shared';

/**
 * 'recover' is also the generic "stunned, do nothing until t runs out" state (Phase 3 abilities stun with
 * e.mode = 'recover'; e.t = seconds), and slows work by swapping `e.def` for a clone with a lower speed.
 */
export type EnemyMode = 'idle' | 'wander' | 'chase' | 'windup' | 'leap' | 'recover' | 'stagger' | 'charge';

export interface Enemy {
  /** Scripted rescue guards cannot be farmed for rewards or ordinary hunt credit. */
  noRewards?: boolean;
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
  // ── combat 2.0
  poise: number;
  maxPoise: number;
  /** seconds since the last poise damage (poise refills after POISE_REGEN_DELAY) */
  poiseT: number;
  /** brief hit-react: no movement */
  flinchT: number;
  /** attack cooldown */
  cd: number;
  /** attack being telegraphed / performed (ATK.*) */
  atk: number;
  aimX: number;
  aimY: number;
  targetId: string | null;
  elite: number;
  level: number;
  dmgMult: number;
  speedMult: number;
  windMult: number;
  /** flank side (-1..1), fixed per enemy */
  orbit: number;
  /** phase slip: runs slowed while > 0 */
  slowT: number;
  /** players already hit by the current charge */
  chargeHits: Set<string>;
  /** counts attacks; a strike is identified by `${id}:${attackSeq}` */
  attackSeq: number;
  /** neutral wildlife fights back once it has been hurt */
  provoked: boolean;
}

let seq = 0;

export type EnemyKind = EnemyKindName;

export interface SpawnOpts {
  level?: number;
  elite?: number;
}

export function createEnemy(kind: EnemyKind, x: number, y: number, night: boolean, o: SpawnOpts = {}): Enemy {
  const def = ENEMY_DEFS[kind];
  const level = Math.max(1, o.level ?? 1);
  const elite = def.passive ? 0 : (o.elite ?? 0);
  const sc = enemyScale(level);
  const maxHp = Math.round(
    def.hp * (night && !def.passive ? NIGHT_HP_MULT : 1) * sc.hp * (elite & ELITE.HARDENED ? ELITE_HP_MULT : 1),
  );
  const maxPoise = (def.poise ?? 0) * (elite & ELITE.HARDENED ? 2 : 1);
  const state = new EnemyState();
  const id = `e${++seq}`;
  state.id = id;
  state.kind = def.kind;
  state.x = x;
  state.y = y;
  state.hp = maxHp;
  state.maxHp = maxHp;
  state.night = night;
  state.elite = elite;
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  const orbit = [-1, -0.5, 0.5, 1][Math.abs(h) % 4]!;
  return {
    id,
    state,
    def,
    x,
    y,
    kx: 0,
    ky: 0,
    hp: maxHp,
    maxHp,
    night,
    mode: 'idle',
    t: 1,
    wx: 0,
    wy: 0,
    lockX: 0,
    lockY: 0,
    resist: (def.resist ?? 1) * (elite & ELITE.HARDENED ? 0.5 : 1),
    lastHitBy: null,
    history: [],
    poise: maxPoise,
    maxPoise,
    poiseT: 0,
    flinchT: 0,
    cd: 0,
    atk: ATK.NONE,
    aimX: 0,
    aimY: 1,
    targetId: null,
    elite,
    level,
    dmgMult: sc.dmg,
    speedMult: elite & ELITE.SWIFT ? 1.35 : 1,
    windMult: elite & ELITE.SWIFT ? 0.85 : 1,
    orbit,
    slowT: 0,
    chargeHits: new Set(),
    attackSeq: 0,
    provoked: false,
  };
}

export const enemyDamage = (e: Enemy, mult = 1) =>
  Math.max(1, Math.round(e.def.damage * (e.night ? NIGHT_DMG_MULT : 1) * e.dmgMult * mult));
export const defOf = (kind: number) => ENEMY_BY_KIND[kind]!;

export interface Target {
  id: string;
  x: number;
  y: number;
  alive: boolean;
}
export interface EnemyHooks {
  /** A circular strike lands (the room applies damage to anyone inside, with lag compensation). */
  strike(e: Enemy, x: number, y: number, radius: number, mult?: number): void;
  telegraph(e: Enemy): void;
  /** charge path swept this tick */
  lane?(e: Enemy, ax: number, ay: number, bx: number, by: number, w: number): void;
  /** fire an orb */
  fire?(e: Enemy, dx: number, dy: number): void;
  /** knocked into a wall at `speed` tiles/s */
  slam?(e: Enemy, speed: number): void;
  /** a charge ended in a wall */
  crash?(e: Enemy): void;
}

export interface AiContext {
  allies: Enemy[];
  /** committed attackers per target id (windup/leap/charge), by token class */
  engaged: Map<string, number>;
  casting: Map<string, number>;
}

/** at most this many enemies commit to an attack on the same player at once (others circle and wait) */
export const MAX_ENGAGED = 2;
export const MAX_CASTING = 2;

const committed = (e: Enemy) => e.mode === 'windup' || e.mode === 'leap' || e.mode === 'charge';

/** Step every enemy with shared group context (attack tokens, separation). */
export function stepEnemies(
  list: Iterable<Enemy>,
  dt: number,
  tick: number,
  targets: Target[],
  solid: SolidQuery,
  rand: () => number,
  hooks: EnemyHooks,
): void {
  const all = [...list];
  const ctx: AiContext = { allies: all.filter((e) => !e.def.passive), engaged: new Map(), casting: new Map() };
  for (const e of ctx.allies) {
    if (!e.targetId || !committed(e)) continue;
    const m = e.def.ai === 'caster' || e.def.ai === 'harrier' ? ctx.casting : e.def.ai === 'swarm' ? null : ctx.engaged;
    if (m) m.set(e.targetId, (m.get(e.targetId) ?? 0) + 1);
  }
  for (const e of all) {
    if (e.slowT > 0) e.slowT = Math.max(0, e.slowT - dt);
    const wasCommitted = committed(e);
    stepEnemy(
      e,
      e.slowT > 0 ? dt * SLIP_SLOW : dt,
      tick,
      targets,
      e.def.sea ? (solid.sea ?? solid) : solid,
      rand,
      hooks,
      ctx,
    );
    if (!wasCommitted && committed(e) && e.targetId) {
      const slots =
        e.def.ai === 'caster' || e.def.ai === 'harrier' ? ctx.casting : e.def.ai === 'swarm' ? null : ctx.engaged;
      if (slots) slots.set(e.targetId, (slots.get(e.targetId) ?? 0) + 1);
    }
  }
}

/** Is the straight line between two points free of solid tiles? */
export function lineOfSight(solid: SolidQuery, ax: number, ay: number, bx: number, by: number): boolean {
  const d = Math.hypot(bx - ax, by - ay);
  const n = Math.ceil(d / 0.3);
  const level = solid.level;
  const from = level ? level(Math.floor(ax), Math.floor(ay)) : 0;
  for (let i = 1; i < n; i++) {
    const k = i / n;
    const tx = Math.floor(ax + (bx - ax) * k),
      ty = Math.floor(ay + (by - ay) * k);
    // rising ground that is a cliff higher than the viewer hides what lies behind it; looking down is unobstructed
    if (solid(tx, ty) || (level && level(tx, ty) - from >= CLIFF)) return false;
  }
  return true;
}

/** Farthest free point along a ray (for the brute's charge lane). */
function rayEnd(
  solid: SolidQuery,
  x: number,
  y: number,
  dx: number,
  dy: number,
  max: number,
): { x: number; y: number } {
  let px = x,
    py = y;
  for (let s = 0.25; s <= max + 1e-9; s += 0.25) {
    const nx = x + dx * s,
      ny = y + dy * s;
    if (solid(Math.floor(nx), Math.floor(ny))) break;
    px = nx;
    py = ny;
  }
  return { x: px, y: py };
}

function knockback(e: Enemy, dt: number, solid: SolidQuery, hooks: EnemyHooks): void {
  const sp = Math.hypot(e.kx, e.ky);
  if (sp > 0.05) {
    const bx = e.x,
      by = e.y;
    moveBody(e, e.kx * dt, e.ky * dt, e.def.radius, solid);
    const got = Math.hypot(e.x - bx, e.y - by);
    if (sp >= SLAM_SPEED && got < sp * dt * 0.5) {
      e.kx = 0;
      e.ky = 0;
      hooks.slam?.(e, sp);
      return;
    }
    const k = Math.pow(0.02, dt);
    e.kx *= k;
    e.ky *= k;
  } else {
    e.kx = 0;
    e.ky = 0;
  }
}

function startWindup(e: Enemy, atk: number, time: number, target: Target, hooks: EnemyHooks): void {
  e.mode = 'windup';
  e.atk = atk;
  e.t = time * e.windMult;
  e.lockX = target.x;
  e.lockY = target.y;
  e.targetId = target.id;
  e.attackSeq++;
  const dx = target.x - e.x,
    dy = target.y - e.y,
    d = Math.hypot(dx, dy) || 1;
  e.aimX = dx / d;
  e.aimY = dy / d;
  e.state.tele = 1;
  hooks.telegraph(e);
}

const WINDUP_TIME = (e: Enemy): number => (e.atk === ATK.SLAM ? BRUTE_SLAM_WINDUP : e.def.windup) * e.windMult;

/** One AI tick. Pure with respect to the world apart from the hooks. */
export function stepEnemy(
  e: Enemy,
  dt: number,
  tick: number,
  targets: Target[],
  solid: SolidQuery,
  rand: () => number,
  hooks: EnemyHooks,
  ctx?: AiContext,
): void {
  if (e.def.passive || (e.def.neutral && !e.provoked)) {
    stepPassive(e, dt, tick, targets, solid, rand);
    return;
  }
  knockback(e, dt, solid, hooks);
  e.flinchT = Math.max(0, e.flinchT - dt);
  e.cd = Math.max(0, e.cd - dt);
  e.poiseT += dt;
  if (e.poiseT >= POISE_REGEN_DELAY && e.poise < e.maxPoise && e.mode !== 'stagger') e.poise = e.maxPoise;

  // target: keep the current one while it stays roughly in sight, else the nearest
  let target: Target | null = null;
  let best = e.def.sight;
  for (const p of targets) {
    if (!p.alive) continue;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < best) {
      best = d;
      target = p;
    }
  }
  const cur = e.targetId ? targets.find((p) => p.id === e.targetId && p.alive) : undefined;
  if (
    cur &&
    Math.hypot(cur.x - e.x, cur.y - e.y) < e.def.sight * 1.4 &&
    (!target || Math.hypot(cur.x - e.x, cur.y - e.y) < best + 1.5)
  )
    target = cur;
  if (!committed(e)) e.targetId = target?.id ?? null;
  const speed = e.def.speed * e.speedMult;
  const ai = e.def.ai ?? 'melee';

  e.t -= dt;
  switch (e.mode) {
    case 'idle':
    case 'wander': {
      if (target) {
        e.mode = 'chase';
        break;
      }
      if (e.t <= 0) {
        if (e.mode === 'idle') {
          const a = rand() * Math.PI * 2;
          e.wx = Math.cos(a);
          e.wy = Math.sin(a);
          e.mode = 'wander';
          e.t = 0.8 + rand() * 1.2;
        } else {
          e.mode = 'idle';
          e.t = 1 + rand() * 2;
        }
      }
      if (e.mode === 'wander' && e.flinchT <= 0 && ai !== 'ambusher') {
        moveBody(e, e.wx * speed * 0.4 * dt, e.wy * speed * 0.4 * dt, e.def.radius, solid);
        e.state.faceX = e.wx;
        e.state.faceY = e.wy;
      }
      break;
    }
    case 'chase': {
      if (!target) {
        e.mode = 'idle';
        e.t = 1;
        break;
      }
      const dx = target.x - e.x,
        dy = target.y - e.y,
        d = Math.hypot(dx, dy) || 1;
      const ux = dx / d,
        uy = dy / d;
      e.state.faceX = ux;
      e.state.faceY = uy;
      const engaged = ctx?.engaged.get(target.id) ?? 0;
      const casting = ctx?.casting.get(target.id) ?? 0;
      const token = engaged < MAX_ENGAGED;
      if (ai === 'ambusher' && d > 4.5 && e.cd <= 0) break;
      if (e.cd <= 0 && e.flinchT <= 0) {
        if (ai === 'ambusher' && token && d <= 3 && lineOfSight(solid, e.x, e.y, target.x, target.y)) {
          startWindup(e, ATK.LEAP, e.def.windup, target, hooks);
          break;
        }
        if (
          ai === 'harrier' &&
          casting < MAX_CASTING &&
          d >= 3 &&
          d <= e.def.strikeRange &&
          lineOfSight(solid, e.x, e.y, target.x, target.y)
        ) {
          startWindup(e, ATK.ORB, e.def.windup, target, hooks);
          break;
        }
        if (ai === 'melee' && token && d <= e.def.strikeRange * 0.8) {
          startWindup(e, ATK.SELF, e.def.windup, target, hooks);
          break;
        }
        if (ai === 'leap' && token && d <= e.def.strikeRange * 0.85) {
          startWindup(e, ATK.LEAP, e.def.windup, target, hooks);
          break;
        }
        if (ai === 'boar' && token) {
          if (d <= 1.3) {
            startWindup(e, ATK.SELF, 0.5, target, hooks);
            break;
          }
          if (d >= 2.6 && d <= e.def.strikeRange && lineOfSight(solid, e.x, e.y, target.x, target.y)) {
            startWindup(e, ATK.CHARGE, e.def.windup, target, hooks);
            break;
          }
        }
        if (ai === 'swarm' && d <= e.def.strikeRange + 0.25) {
          startWindup(e, ATK.SELF, e.def.windup, target, hooks);
          break;
        }
        if (ai === 'brute' && token) {
          if (d <= BRUTE_SLAM_RADIUS * (e.def.aoe ?? 1) * 0.85) {
            startWindup(e, ATK.SLAM, BRUTE_SLAM_WINDUP, target, hooks);
            break;
          }
          if (d >= 2.8 && d <= e.def.strikeRange && lineOfSight(solid, e.x, e.y, target.x, target.y)) {
            startWindup(e, ATK.CHARGE, e.def.windup, target, hooks);
            break;
          }
        }
        if (
          ai === 'caster' &&
          casting < MAX_CASTING &&
          d <= e.def.strikeRange + 1 &&
          lineOfSight(solid, e.x, e.y, target.x, target.y)
        ) {
          startWindup(e, ATK.ORB, e.def.windup, target, hooks);
          break;
        }
      }
      if (e.flinchT > 0) break;
      // movement: approach on a flank, circle when the target is already busy, keep distance as a caster
      const px = -uy,
        py = ux;
      let vx = ux,
        vy = uy,
        k = 1;
      if (ai === 'ambusher' && e.cd > 0) {
        vx = -ux + px * e.orbit * 0.5;
        vy = -uy + py * e.orbit * 0.5;
        k = 0.8;
      } else if (ai === 'harrier') {
        const retreat = d < 3.5 ? -1 : d > 5.5 ? 1 : 0;
        vx = ux * retreat + px * e.orbit * 0.8;
        vy = uy * retreat + py * e.orbit * 0.8;
        k = 0.8;
      } else if (ai === 'caster') {
        if (d < 3.5) {
          vx = -ux;
          vy = -uy;
          k = 0.9;
        } else if (d > 6) {
          vx = ux + px * e.orbit * 0.4;
          vy = uy + py * e.orbit * 0.4;
        } else {
          vx = px * e.orbit;
          vy = py * e.orbit;
          k = 0.6;
          if (rand() < 0.01) e.orbit = -e.orbit;
        }
      } else if (ai !== 'swarm' && !token && d < 3.2) {
        const ring = 2.6;
        vx = px * Math.sign(e.orbit) + ux * (d - ring) * 0.8;
        vy = py * Math.sign(e.orbit) + uy * (d - ring) * 0.8;
        k = 0.7;
      } else if (d > 1.6) {
        vx = ux + px * e.orbit * 0.55;
        vy = uy + py * e.orbit * 0.55;
      }
      if (ai === 'swarm') {
        const j = Math.sin(tick * 0.9 + e.orbit * 7) * 0.9;
        vx += px * j;
        vy += py * j;
      }
      // separation: never stack on allies
      for (const o of ctx?.allies ?? []) {
        if (o === e) continue;
        const ox = e.x - o.x,
          oy = e.y - o.y,
          od = Math.hypot(ox, oy);
        const min = e.def.radius + o.def.radius + 0.35;
        if (od > 1e-6 && od < min) {
          const s = ((min - od) / min) * 2.2;
          vx += (ox / od) * s;
          vy += (oy / od) * s;
        }
      }
      const vl = Math.hypot(vx, vy);
      if (vl > 1e-6) moveBody(e, (vx / vl) * speed * k * dt, (vy / vl) * speed * k * dt, e.def.radius, solid);
      break;
    }
    case 'windup': {
      const total = WINDUP_TIME(e);
      const prog = Math.min(1, Math.max(0, 1 - e.t / total));
      e.state.tele = Math.max(1, Math.min(100, Math.round(prog * 100)));
      // ranged/charge attacks track the target until 65% of the windup, then lock (readable, dodgeable)
      if ((e.atk === ATK.ORB || e.atk === ATK.CHARGE) && prog < 0.65 && target) {
        const dx = target.x - e.x,
          dy = target.y - e.y,
          d = Math.hypot(dx, dy) || 1;
        e.aimX = dx / d;
        e.aimY = dy / d;
      }
      e.state.faceX = e.aimX;
      e.state.faceY = e.aimY;
      if (e.atk === ATK.ORB) {
        e.lockX = e.x + e.aimX * ORB_RANGE * 0.6;
        e.lockY = e.y + e.aimY * ORB_RANGE * 0.6;
      } else if (e.atk === ATK.CHARGE) {
        const p = rayEnd(solid, e.x, e.y, e.aimX, e.aimY, CHARGE_DIST);
        e.lockX = p.x;
        e.lockY = p.y;
      } else if (e.atk === ATK.SELF || e.atk === ATK.SLAM) {
        e.lockX = e.x;
        e.lockY = e.y;
      }
      if (e.t <= 0) {
        e.state.tele = 0;
        e.cd = e.def.cooldown ?? 0.6;
        switch (e.atk) {
          case ATK.LEAP:
            e.mode = 'leap';
            e.t = LEAP_TIME;
            break;
          case ATK.CHARGE:
            e.mode = 'charge';
            e.t = CHARGE_DIST / CHARGE_SPEED;
            e.chargeHits.clear();
            break;
          case ATK.ORB:
            hooks.fire?.(e, e.aimX, e.aimY);
            e.mode = 'recover';
            e.t = 0.45;
            e.atk = ATK.NONE;
            break;
          case ATK.SLAM:
            hooks.strike(e, e.x, e.y, BRUTE_SLAM_RADIUS * (e.def.aoe ?? 1), 0.75);
            e.mode = 'recover';
            e.t = 1.0;
            e.atk = ATK.NONE;
            break;
          default:
            hooks.strike(e, e.x, e.y, ai === 'boar' ? 1.4 * (e.def.aoe ?? 1) : e.def.strikeRange);
            e.mode = 'recover';
            e.t = ai === 'swarm' ? 0.35 : 0.65;
            e.atk = ATK.NONE;
        }
      }
      break;
    }
    case 'leap': {
      const dx = e.lockX - e.x,
        dy = e.lockY - e.y,
        d = Math.hypot(dx, dy);
      const maxStep = ((e.def.strikeRange + 1.2) / LEAP_TIME) * dt;
      if (d > 0.05) {
        const s = Math.min(d, maxStep);
        moveBody(e, (dx / d) * s, (dy / d) * s, e.def.radius, solid);
      }
      if (e.t <= 0) {
        hooks.strike(e, e.x, e.y, LEAP_RADIUS * (e.def.aoe ?? 1));
        e.mode = 'recover';
        e.t = 0.9;
        e.atk = ATK.NONE;
      }
      break;
    }
    case 'charge': {
      const step = CHARGE_SPEED * dt;
      const bx = e.x,
        by = e.y;
      moveBody(e, e.aimX * step, e.aimY * step, e.def.radius, solid);
      hooks.lane?.(e, bx, by, e.x, e.y, CHARGE_WIDTH);
      const got = Math.hypot(e.x - bx, e.y - by);
      if (got < step * 0.5) {
        // crashed into a wall: dazed and open
        e.atk = ATK.NONE;
        hooks.crash?.(e);
        e.mode = 'stagger';
        e.t = 1.6;
        e.poise = 0;
        e.poiseT = 0;
        break;
      }
      if (e.t <= 0) {
        if (e.night) hooks.strike(e, e.x, e.y, SHOCKWAVE_RADIUS, 0.6);
        e.mode = 'recover';
        e.t = 0.8;
        e.atk = ATK.NONE;
      }
      break;
    }
    case 'stagger':
      e.state.tele = 0;
      e.atk = ATK.NONE;
      if (e.t <= 0) {
        e.mode = 'idle';
        e.t = 0.15;
        e.poise = e.maxPoise;
        e.poiseT = 0;
      }
      break;
    case 'recover':
      e.state.tele = 0;
      e.atk = ATK.NONE;
      if (e.t <= 0) {
        e.mode = 'idle';
        e.t = 0.3;
      }
      break;
  }
  syncState(e, tick);
}

function syncState(e: Enemy, tick: number): void {
  const s = e.state;
  const moving = Math.hypot(s.x - e.x, s.y - e.y) > 0.001;
  s.x = e.x;
  s.y = e.y;
  s.st =
    e.mode === 'chase' || e.mode === 'wander'
      ? moving
        ? 1
        : 0
      : e.mode === 'windup'
        ? 2
        : e.mode === 'leap' || e.mode === 'charge'
          ? 3
          : e.mode === 'recover'
            ? 4
            : e.mode === 'stagger'
              ? 5
              : 0;
  s.atk = e.mode === 'windup' || e.mode === 'leap' || e.mode === 'charge' ? e.atk : ATK.NONE;
  s.tx = e.lockX;
  s.ty = e.lockY;
  s.poise = e.maxPoise > 0 ? Math.max(0, Math.min(100, Math.round((e.poise / e.maxPoise) * 100))) : 100;
  if (e.mode !== 'windup') s.tele = 0;
  e.history.push({ tick, x: e.x, y: e.y });
  if (e.history.length > 12) e.history.shift();
}

/** Passive fauna: wander, bolt away from players that get close, never attack. */
function stepPassive(
  e: Enemy,
  dt: number,
  tick: number,
  targets: Target[],
  solid: SolidQuery,
  rand: () => number,
): void {
  if (Math.abs(e.kx) + Math.abs(e.ky) > 0.05) {
    moveBody(e, e.kx * dt, e.ky * dt, e.def.radius, solid);
    const k = Math.pow(0.02, dt);
    e.kx *= k;
    e.ky *= k;
  } else {
    e.kx = 0;
    e.ky = 0;
  }
  let threat: Target | null = null;
  let best = e.def.sight;
  for (const p of targets) {
    if (!p.alive) continue;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < best) {
      best = d;
      threat = p;
    }
  }
  e.t -= dt;
  // Notice at a distance, flee only inside a comfort radius; remain wary until the pursuer is farther away.
  if (threat && e.def.passive && best > (e.mode === 'chase' ? 6.5 : 3.5) && e.hp >= e.maxHp) threat = null;
  if (!threat && e.mode === 'chase') {
    e.mode = 'idle';
    e.t = 4 + rand() * 4;
  }
  // neutral wildlife never flees: it keeps an eye on anyone close and otherwise goes about its business
  if (threat && e.def.neutral) {
    const dx = threat.x - e.x,
      dy = threat.y - e.y,
      d = Math.hypot(dx, dy) || 1;
    if (d < 2.2)
      e.provoked = true; // crowded: it will charge
    else if (d < 5) {
      e.state.faceX = dx / d;
      e.state.faceY = dy / d;
      threat = null;
      e.mode = 'idle';
      e.t = Math.max(e.t, 0.4);
    } else threat = null;
  }
  if (threat) {
    // flee directly away, with a little zig-zag so they are huntable but not trivial
    const dx = e.x - threat.x,
      dy = e.y - threat.y,
      d = Math.hypot(dx, dy) || 1;
    const jitter = Math.sin(tick * 0.045 + e.maxHp) * 0.12;
    const ux = dx / d,
      uy = dy / d;
    const vx = ux - uy * jitter,
      vy = uy + ux * jitter,
      vl = Math.hypot(vx, vy) || 1;
    moveBody(e, (vx / vl) * e.def.speed * dt, (vy / vl) * e.def.speed * dt, e.def.radius, solid);
    e.mode = 'chase';
    e.state.faceX = vx / vl;
    e.state.faceY = vy / vl;
  } else {
    if (e.t <= 0) {
      if (e.mode !== 'wander') {
        const a = rand() * Math.PI * 2;
        e.wx = Math.cos(a);
        e.wy = Math.sin(a);
        e.mode = 'wander';
        e.t = 0.7 + rand() * 1.1;
      } else {
        e.mode = 'idle';
        e.t = 4.5 + rand() * 5;
      }
    }
    if (e.mode === 'wander') {
      moveBody(e, e.wx * e.def.speed * 0.18 * dt, e.wy * e.def.speed * 0.18 * dt, e.def.radius, solid);
      e.state.faceX = e.wx;
      e.state.faceY = e.wy;
    }
  }
  e.state.x = e.x;
  e.state.y = e.y;
  e.state.st = e.mode === 'chase' || e.mode === 'wander' ? 1 : 0;
  e.history.push({ tick, x: e.x, y: e.y });
  if (e.history.length > 12) e.history.shift();
}
