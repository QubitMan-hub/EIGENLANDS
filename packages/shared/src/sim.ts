import {
  ATTACK_COOLDOWN, COMBO_WINDOW, DASH_COOLDOWN, DASH_SPEED, DASH_TIME, PLAYER_RADIUS,
  PLAYER_SPEED, SKILL_COOLDOWN, TICK_DT,
} from './constants';

export interface PlayerSim {
  x: number;
  y: number;
  faceX: number;
  faceY: number;
  dashT: number;
  dashCd: number;
  dashDx: number;
  dashDy: number;
  atkCd: number;
  combo: number; // index of the NEXT hit in the 3-hit combo
  comboT: number;
  skillCd: number;
}

export interface InputCmd {
  seq: number;
  /** movement intent, each in [-1, 1] */
  dx: number;
  dy: number;
  dash: boolean;
  attack: boolean;
  skill: boolean;
  /** aim direction (unit-ish vector from the player) */
  aimX: number;
  aimY: number;
  /** server tick the client was displaying remote entities at (lag compensation) */
  viewTick: number;
}

export interface StepEvents {
  dashed: boolean;
  attacked: boolean;
  /** 0,1,2 hit index when attacked */
  combo: number;
  skill: boolean;
}

export type SolidQuery = (tx: number, ty: number) => boolean;

export function newPlayerSim(x: number, y: number): PlayerSim {
  return {
    x, y, faceX: 0, faceY: 1, dashT: 0, dashCd: 0, dashDx: 0, dashDy: 0,
    atkCd: 0, combo: 0, comboT: 0, skillCd: 0,
  };
}

export function clonePlayerSim(p: PlayerSim): PlayerSim {
  return { ...p };
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Never trust client commands: clamp ranges, limit vector length, coerce types. */
export function sanitizeCmd(raw: Partial<InputCmd>): InputCmd {
  let dx = clamp(num(raw.dx), -1, 1);
  let dy = clamp(num(raw.dy), -1, 1);
  const len = Math.hypot(dx, dy);
  if (len > 1) { dx /= len; dy /= len; }
  let ax = clamp(num(raw.aimX), -1, 1);
  let ay = clamp(num(raw.aimY), -1, 1);
  const al = Math.hypot(ax, ay);
  if (al > 1e-6) { ax /= al; ay /= al; } else { ax = 0; ay = 0; }
  return {
    seq: Math.max(0, Math.floor(num(raw.seq))),
    dx, dy,
    dash: raw.dash === true,
    attack: raw.attack === true,
    skill: raw.skill === true,
    aimX: ax, aimY: ay,
    viewTick: Math.max(0, Math.floor(num(raw.viewTick))),
  };
}

const EPS = 1e-4;

function overlapsSolid(x: number, y: number, r: number, solid: SolidQuery): boolean {
  const x0 = Math.floor(x - r);
  const x1 = Math.floor(x + r - EPS);
  const y0 = Math.floor(y - r);
  const y1 = Math.floor(y + r - EPS);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solid(tx, ty)) return true;
  return false;
}

/** Move a circle-ish AABB by (dx,dy), resolving each axis independently, in sub-steps so it can never tunnel. */
export function moveBody(
  pos: { x: number; y: number }, dx: number, dy: number, r: number, solid: SolidQuery,
): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.25));
  const sx = dx / n, sy = dy / n;
  for (let i = 0; i < n; i++) {
    if (sx !== 0) {
      const nx = pos.x + sx;
      if (!overlapsSolid(nx, pos.y, r, solid)) pos.x = nx;
      else pos.x = sx > 0 ? Math.floor(nx + r) - r - EPS : Math.floor(nx - r) + 1 + r + EPS;
    }
    if (sy !== 0) {
      const ny = pos.y + sy;
      if (!overlapsSolid(pos.x, ny, r, solid)) pos.y = ny;
      else pos.y = sy > 0 ? Math.floor(ny + r) - r - EPS : Math.floor(ny - r) + 1 + r + EPS;
    }
  }
}

/** One fixed 50 ms step. Identical on client (prediction) and server (authority). */
export function stepPlayer(p: PlayerSim, cmd: InputCmd, solid: SolidQuery): StepEvents {
  const ev: StepEvents = { dashed: false, attacked: false, combo: 0, skill: false };

  p.dashCd = Math.max(0, p.dashCd - TICK_DT);
  p.atkCd = Math.max(0, p.atkCd - TICK_DT);
  p.skillCd = Math.max(0, p.skillCd - TICK_DT);
  if (p.comboT > 0) {
    p.comboT -= TICK_DT;
    if (p.comboT <= 0) { p.comboT = 0; p.combo = 0; }
  }

  const moving = cmd.dx !== 0 || cmd.dy !== 0;
  if (moving) {
    const l = Math.hypot(cmd.dx, cmd.dy);
    p.faceX = cmd.dx / l;
    p.faceY = cmd.dy / l;
  }
  const hasAim = cmd.aimX !== 0 || cmd.aimY !== 0;

  if (cmd.dash && p.dashT <= 0 && p.dashCd <= 0) {
    p.dashT = DASH_TIME;
    p.dashCd = DASH_COOLDOWN;
    p.dashDx = moving ? p.faceX : p.faceX;
    p.dashDy = moving ? p.faceY : p.faceY;
    ev.dashed = true;
  }

  if (cmd.attack && p.atkCd <= 0 && p.dashT <= 0) {
    if (hasAim) { p.faceX = cmd.aimX; p.faceY = cmd.aimY; }
    ev.attacked = true;
    ev.combo = p.combo;
    p.atkCd = ATTACK_COOLDOWN + (p.combo === 2 ? 0.2 : 0);
    p.combo = (p.combo + 1) % 3;
    p.comboT = COMBO_WINDOW;
  }

  if (cmd.skill && p.skillCd <= 0 && p.dashT <= 0) {
    if (hasAim) { p.faceX = cmd.aimX; p.faceY = cmd.aimY; }
    ev.skill = true;
    p.skillCd = SKILL_COOLDOWN;
  }

  let vx = 0, vy = 0;
  if (p.dashT > 0) {
    vx = p.dashDx * DASH_SPEED;
    vy = p.dashDy * DASH_SPEED;
    p.dashT = Math.max(0, p.dashT - TICK_DT);
  } else {
    // slight lunge slow while swinging
    const k = p.atkCd > ATTACK_COOLDOWN * 0.5 ? 0.4 : 1;
    vx = cmd.dx * PLAYER_SPEED * k;
    vy = cmd.dy * PLAYER_SPEED * k;
  }
  moveBody(p, vx * TICK_DT, vy * TICK_DT, PLAYER_RADIUS, solid);
  return ev;
}
