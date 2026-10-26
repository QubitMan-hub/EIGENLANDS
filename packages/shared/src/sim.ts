import {
  ATTACK_BUFFER,
  CHARGE_FULL,
  CHARGE_MIN,
  CHARGE_MOVE_MULT,
  COMBO_WINDOW,
  DASH_CHARGES,
  DASH_COOLDOWN,
  DASH_SPEED,
  DASH_TIME,
  BOAT_SPEED_MULT,
  MOUNT_SPEED_MULT,
  ROAD_MULT,
  ROAD_MULT_MOUNTED,
  EXHAUST_DELAY,
  SPRINT_DRAIN,
  SPRINT_MIN,
  SPRINT_MULT,
  STAMINA_DELAY,
  STAMINA_MAX,
  STAMINA_REGEN,
  CLIFF,
  IFRAME_TIME,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  SKILL_COOLDOWN,
  SWING_MOVE_MULT,
  TICK_DT,
} from './constants';
import { isFlying } from './mounts';
import { mineStep, type MineTrack } from './mines';
import { meleeFamily, meleeTap, meleeHeavy, type MeleeFamily } from './combat';

/** Fixed-rate simulation stays real-time after a render/IO stall; never replay an unbounded suspension. */
export function simulationBudget(remainder: number, elapsedMs: number): { steps: number; remainder: number } {
  const total = remainder + Math.max(0, Math.min(Number.isFinite(elapsedMs) ? elapsedMs : 0, 250)),
    stepMs = TICK_DT * 1000;
  const steps = Math.min(5, Math.floor(total / stepMs));
  return { steps, remainder: total - steps * stepMs };
}

/**
 * Everything the client predicts about its own player. Dynamic numeric fields are in the ACK (see protocol.ts),
 * so the client can rewind and replay. Weapon metadata is derived from equipment, outside the packed ACK.
 */
export interface PlayerSim {
  x: number;
  y: number;
  faceX: number;
  faceY: number;
  dashT: number;
  /** recharge timer of the next dash charge */
  dashCd: number;
  dashDx: number;
  dashDy: number;
  /** a ranged weapon is wielded: attacks do not lunge */
  ranged?: boolean;
  /** Derived from equipped gear, not client input or packed ACK fields. */
  melee?: MeleeFamily;
  atkCd: number;
  combo: number; // index of the NEXT hit in the 3-hit combo
  comboT: number;
  skillCd: number;
  /** dash charges available (0..DASH_CHARGES) */
  dashN: number;
  /** invulnerability left from the current dash */
  ifrT: number;
  /** 1 when the attack button was held last step (edge detection for charge release) */
  hold: number;
  /** seconds of charge accumulated while holding attack */
  charge: number;
  /** buffered attack press */
  atkBuf: number;
  /** phase slip: set by the server on a perfect dodge; the next attack is a critical counter */
  slipT: number;
  /** 1 while sailing: water is open, land is solid, no dashing, faster, no lunges */
  boat: number;
  /** 0 walking; otherwise progress + 1 on a shared mine circuit. */
  cart: number;
  /** sprint stamina 0..STAMINA_MAX, quantised to 1/64 so client replay and server agree exactly */
  stamina: number;
  /** seconds before stamina starts refilling */
  staminaT: number;
  /** 1 while sprinting */
  sprint: number;
  /**
   * 0 on foot; otherwise a mount code (mounts.ts): horse, Moonlit Stag or griffin, fed or not. Attacking or skills
   * step a rider down first; a griffin rider cannot fight from the air at all.
   */
  mount: number;
}

export interface InputCmd {
  seq: number;
  /** movement intent, each in [-1, 1] */
  dx: number;
  dy: number;
  dash: boolean;
  /** sprint held (honoured only while moving with stamina) */
  sprint?: boolean;
  /** attack pressed this step (or a repeat request: held-to-repeat clients send it every step) */
  attack: boolean;
  /** attack button is held: charges a heavy strike that fires on release */
  hold: boolean;
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
  /** 0,1,2 hit index when a light attack came out */
  combo: number;
  skill: boolean;
  /** the attack was a charged heavy strike */
  heavy: boolean;
  /** heavy charge level 0..1 */
  level: number;
  /** the attack consumed a phase slip: guaranteed critical counter */
  counter: boolean;
  /** charge crossed CHARGE_MIN / CHARGE_FULL this step (for sounds) */
  chargeReady: boolean;
  chargeFull: boolean;
}

/** `sea` (when present) is the collision query of a ship: land and obstacles are solid, open water is not. */
export type SolidQuery = ((tx: number, ty: number) => boolean) & {
  sea?: (tx: number, ty: number) => boolean;
  mine?: (x: number, y: number) => MineTrack | null;
  /** terrain elevation level of a tile; steps of CLIFF levels or more are impassable (revision 3) */
  level?: (tx: number, ty: number) => number;
  /** a kept road or path tile: walking and riding on it is a little faster */
  road?: (tx: number, ty: number) => boolean;
  /** collision for a flying mount: walls, doors and settlement wards only */
  fly?: (tx: number, ty: number) => boolean;
};

/** Switching families cannot carry a finisher/charge across weapons or erase recovery. */
export function setMeleeWeapon(p: PlayerSim, id: unknown): void {
  const next = meleeFamily(id);
  if (next !== meleeFamily(p.melee)) {
    p.combo = 0;
    p.comboT = 0;
    p.atkBuf = 0;
    p.charge = 0;
    p.hold = 0;
  }
  p.melee = next;
}

/** Quantise to 1/64 (exact in float32): the ACK carries stamina and the replay must match the server bit for bit. */
const qs = (v: number) => Math.round(v * 64) / 64;

function stepStamina(p: PlayerSim): void {
  if (p.sprint) {
    p.stamina = qs(Math.max(0, p.stamina - SPRINT_DRAIN * TICK_DT));
    p.staminaT = q(p.stamina <= 0 ? EXHAUST_DELAY : STAMINA_DELAY);
    if (p.stamina <= 0) p.sprint = 0;
  } else if (p.staminaT > 0) p.staminaT = down(p.staminaT);
  else p.stamina = Math.min(STAMINA_MAX, qs(p.stamina + STAMINA_REGEN * TICK_DT));
}

export function newPlayerSim(x: number, y: number): PlayerSim {
  return {
    x,
    y,
    faceX: 0,
    faceY: 1,
    dashT: 0,
    dashCd: 0,
    dashDx: 0,
    dashDy: 0,
    atkCd: 0,
    combo: 0,
    comboT: 0,
    skillCd: 0,
    dashN: DASH_CHARGES,
    ifrT: 0,
    hold: 0,
    charge: 0,
    atkBuf: 0,
    slipT: 0,
    boat: 0,
    mount: 0,
    cart: 0,
    stamina: STAMINA_MAX,
    staminaT: 0,
    sprint: 0,
  };
}

export function clonePlayerSim(p: PlayerSim): PlayerSim {
  return { ...p };
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/**
 * Timers are rounded to 1e-6 after every update. The ACK carries float32s; rounding makes the client's replay
 * (which starts from float32 values) land on exactly the same timer values as the server's float64 sim,
 * so thresholds like `atkCd <= 0` flip on the same tick on both sides.
 */
const q = (v: number) => Math.round(v * 1e6) / 1e6;
const down = (v: number) => (v > 0 ? Math.max(0, q(v - TICK_DT)) : 0);

/** Never trust client commands: clamp ranges, limit vector length, coerce types. */
export function sanitizeCmd(raw: Partial<InputCmd>): InputCmd {
  let dx = clamp(num(raw.dx), -1, 1);
  let dy = clamp(num(raw.dy), -1, 1);
  const len = Math.hypot(dx, dy);
  if (len > 1) {
    dx /= len;
    dy /= len;
  }
  let ax = clamp(num(raw.aimX), -1, 1);
  let ay = clamp(num(raw.aimY), -1, 1);
  const al = Math.hypot(ax, ay);
  if (al > 1e-6) {
    ax /= al;
    ay /= al;
  } else {
    ax = 0;
    ay = 0;
  }
  return {
    seq: Math.max(0, Math.floor(num(raw.seq))),
    dx,
    dy,
    dash: raw.dash === true,
    sprint: raw.sprint === true,
    attack: raw.attack === true,
    hold: raw.hold === true,
    skill: raw.skill === true,
    aimX: ax,
    aimY: ay,
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
  const level = solid.level;
  if (level && (x0 !== x1 || y0 !== y1)) {
    // a body may not overlap ground a cliff higher or lower than the tile under its centre
    const here = level(Math.floor(x), Math.floor(y));
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) if (Math.abs(level(tx, ty) - here) >= CLIFF) return true;
  }
  return false;
}

/** Move a circle-ish AABB by (dx,dy), resolving each axis independently, in sub-steps so it can never tunnel. */
export function moveBody(pos: { x: number; y: number }, dx: number, dy: number, r: number, solid: SolidQuery): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.25));
  const sx = dx / n,
    sy = dy / n;
  for (let i = 0; i < n; i++) {
    if (sx !== 0) {
      const nx = pos.x + sx;
      if (!overlapsSolid(nx, pos.y, r, solid)) pos.x = nx;
      else {
        const edge = sx > 0 ? Math.floor(nx + r) - r - EPS : Math.floor(nx - r) + 1 + r + EPS;
        // A side obstruction or newly synchronized cliff can overlap the body.
        // Collision may shorten this step, never reverse or enlarge its input.
        pos.x = sx > 0 ? Math.max(pos.x, Math.min(nx, edge)) : Math.min(pos.x, Math.max(nx, edge));
      }
    }
    if (sy !== 0) {
      const ny = pos.y + sy;
      if (!overlapsSolid(pos.x, ny, r, solid)) pos.y = ny;
      else {
        const edge = sy > 0 ? Math.floor(ny + r) - r - EPS : Math.floor(ny - r) + 1 + r + EPS;
        pos.y = sy > 0 ? Math.max(pos.y, Math.min(ny, edge)) : Math.min(pos.y, Math.max(ny, edge));
      }
    }
  }
}

/** Charge level 0..1 of a held heavy (0 below CHARGE_MIN). */
export function chargeLevel(charge: number): number {
  return clamp((charge - CHARGE_MIN) / (CHARGE_FULL - CHARGE_MIN), 0, 1);
}

/**
 * One fixed 50 ms step. Identical on client (prediction) and server (authority).
 *
 * Combat rules:
 * - tap attack: 3-hit combo (slash, slash, lunging finisher); presses during recovery or a dash are buffered.
 * - hold attack: after the opening swing recovers, charge builds; release past CHARGE_MIN for a heavy strike.
 * - dash: DASH_CHARGES charges that recharge one at a time; cancels swing recovery and charge, keeps the combo.
 * - phase slip (set by the server on a perfect dodge): the next attack is a critical counter.
 */
export function stepPlayer(p: PlayerSim, cmd: InputCmd, land: SolidQuery): StepEvents {
  const sailing = p.boat > 0 && !!land.sea;
  const flying = !sailing && isFlying(p.mount) && !!land.fly;
  // nobody fights or dashes from a griffin's back: those inputs simply do nothing in the air
  if (flying) cmd = { ...cmd, attack: false, hold: false, skill: false, dash: false };
  const solid: SolidQuery = sailing ? land.sea! : flying ? land.fly! : land;
  const ev: StepEvents = {
    dashed: false,
    attacked: false,
    combo: 0,
    skill: false,
    heavy: false,
    level: 0,
    counter: false,
    chargeReady: false,
    chargeFull: false,
  };

  if (p.cart > 0) {
    const loop = land.mine?.(p.x, p.y);
    if (!loop) {
      p.cart = 0;
      return ev;
    }
    p.dashT = 0;
    p.hold = 0;
    p.charge = 0;
    p.atkBuf = 0;
    p.atkCd = down(p.atkCd);
    p.skillCd = down(p.skillCd);
    p.ifrT = down(p.ifrT);
    // Loops run while any movement is held and brake on release; a haulage line is steered along its rails.
    if (cmd.dx !== 0 || cmd.dy !== 0) {
      const move = mineStep(loop, p.cart - 1, cmd.dx, cmd.dy, 6.8 * TICK_DT);
      if (move && !overlapsSolid(move.x, move.y, 0.42, land)) {
        p.x = move.x;
        p.y = move.y;
        p.faceX = move.fx;
        p.faceY = move.fy;
        p.cart = move.progress + 1;
      }
    }
    return ev;
  }

  // timers
  if (p.dashN < DASH_CHARGES) {
    p.dashCd = down(p.dashCd);
    if (p.dashCd <= 0) {
      p.dashN = Math.min(DASH_CHARGES, p.dashN + 1);
      p.dashCd = p.dashN < DASH_CHARGES ? DASH_COOLDOWN : 0;
    }
  } else p.dashCd = 0;
  p.atkCd = down(p.atkCd);
  p.skillCd = down(p.skillCd);
  p.ifrT = down(p.ifrT);
  p.slipT = down(p.slipT);
  p.atkBuf = down(p.atkBuf);
  if (p.comboT > 0) {
    p.comboT = down(p.comboT);
    if (p.comboT <= 0) {
      p.comboT = 0;
      p.combo = 0;
    }
  }

  const moving = cmd.dx !== 0 || cmd.dy !== 0;
  if (moving) {
    const l = Math.hypot(cmd.dx, cmd.dy);
    p.faceX = cmd.dx / l;
    p.faceY = cmd.dy / l;
  }
  const hasAim = cmd.aimX !== 0 || cmd.aimY !== 0;
  const aim = () => {
    if (hasAim) {
      p.faceX = cmd.aimX;
      p.faceY = cmd.aimY;
    }
  };

  // a rider who attacks, charges or casts steps down from the saddle first (then the blow lands on foot)
  if (p.mount > 0 && (sailing || cmd.attack || cmd.hold || cmd.skill)) p.mount = 0;
  const riding = p.mount > 0;

  // dash (always available while a charge remains: cancels swing recovery and a held charge)
  if (cmd.dash && p.dashT <= 0 && p.dashN >= 1 && !sailing && !riding) {
    p.dashN -= 1;
    if (p.dashCd <= 0) p.dashCd = DASH_COOLDOWN;
    p.dashT = DASH_TIME;
    p.ifrT = IFRAME_TIME;
    p.dashDx = p.faceX;
    p.dashDy = p.faceY;
    p.atkCd = 0;
    p.charge = 0;
    if (p.comboT > 0) p.comboT = Math.max(p.comboT, q(DASH_TIME + 0.35));
    ev.dashed = true;
  }

  const counter = () => {
    if (p.slipT > 0) {
      ev.counter = true;
      p.slipT = 0;
    }
  };

  // heavy strike: released after charging
  const held = cmd.hold;
  if (!held && p.hold && p.charge >= CHARGE_MIN && p.dashT <= 0 && p.atkCd <= 0) {
    aim();
    const level = chargeLevel(p.charge);
    const h = meleeHeavy(p.melee, level);
    ev.attacked = true;
    ev.heavy = true;
    ev.level = level;
    ev.combo = 0;
    p.atkCd = h.recovery;
    p.combo = 0;
    p.comboT = 0;
    p.charge = 0;
    p.atkBuf = 0;
    counter();
    if (!p.ranged) moveBody(p, p.faceX * h.lunge, p.faceY * h.lunge, PLAYER_RADIUS, solid);
  }

  // light combo (buffered)
  if (cmd.attack) p.atkBuf = ATTACK_BUFFER;
  if (!ev.attacked && p.atkBuf > 0 && p.atkCd <= 0 && p.dashT <= 0) {
    aim();
    const hit = meleeTap(p.melee, p.combo);
    ev.attacked = true;
    ev.combo = p.combo;
    p.atkCd = hit.recovery;
    p.combo = (p.combo + 1) % 3;
    p.comboT = p.combo === 0 ? 0 : COMBO_WINDOW;
    p.atkBuf = 0;
    counter();
    if (!p.ranged) moveBody(p, p.faceX * hit.lunge, p.faceY * hit.lunge, PLAYER_RADIUS, solid);
  }

  // charging
  if (held && p.dashT <= 0 && p.atkCd <= 0 && !ev.attacked) {
    const before = p.charge;
    p.charge = Math.min(CHARGE_FULL + 0.5, q(p.charge + TICK_DT));
    ev.chargeReady = before < CHARGE_MIN && p.charge >= CHARGE_MIN;
    ev.chargeFull = before < CHARGE_FULL && p.charge >= CHARGE_FULL;
    aim();
  } else if (!held) p.charge = 0;
  p.hold = held ? 1 : 0;

  if (cmd.skill && p.skillCd <= 0 && p.dashT <= 0) {
    aim();
    ev.skill = true;
    p.skillCd = SKILL_COOLDOWN;
  }

  let vx: number, vy: number;
  if (p.dashT > 0) {
    vx = p.dashDx * DASH_SPEED;
    vy = p.dashDy * DASH_SPEED;
    p.dashT = down(p.dashT);
  } else {
    // committed swing slows you; so does holding a charge
    const k = p.atkCd > 0.15 ? SWING_MOVE_MULT : p.charge > 0 ? CHARGE_MOVE_MULT : 1;
    const onRoad = !sailing && !flying && !!land.road?.(Math.floor(p.x), Math.floor(p.y));
    const sp = sailing
      ? PLAYER_SPEED * BOAT_SPEED_MULT
      : PLAYER_SPEED * (MOUNT_SPEED_MULT[p.mount] ?? 1) * (onRoad ? (riding ? ROAD_MULT_MOUNTED : ROAD_MULT) : 1);
    // sprint only while moving freely: not mid-swing, charging, sailing or riding; it needs a little stamina to begin
    const moving = cmd.dx !== 0 || cmd.dy !== 0;
    const sprinting =
      cmd.sprint && moving && !sailing && !riding && k === 1 && p.stamina >= (p.sprint ? 0.01 : SPRINT_MIN) ? 1 : 0;
    p.sprint = sprinting;
    vx = cmd.dx * sp * k * (sprinting ? SPRINT_MULT : 1);
    vy = cmd.dy * sp * k * (sprinting ? SPRINT_MULT : 1);
  }
  stepStamina(p);
  moveBody(p, vx * TICK_DT, vy * TICK_DT, PLAYER_RADIUS, solid);
  return ev;
}
