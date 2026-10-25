/**
 * AbilityEngine: executes Circuit Board ability forms authoritatively (bolts, rings, blinks, Echoes, shields, mirrors,
 * wards, tethers, pulses, pulls and swaps, heals, ultimates), element riders and enemy statuses (burn, slow, stun).
 * Visible effects are `SpellState` entries in `room.state.spells`, interest-managed through `view()`.
 * Every point of damage goes through `room.hitEnemy`, so drops, XP and kill credit stay Phase 2's.
 */
import {
  ABILITIES,
  FLUX,
  PLAYER_RADIUS,
  SPELL,
  SpellState,
  TICK_DT,
  moveBody,
  segmentHitsCircle,
  type AbilityForm,
  type WeaponShot,
  type AbilityId,
  type ClassId,
  type EnemyDef,
  highGroundRange,
} from '@eigenlands/shared';
import type { Enemy } from '../../game/enemies';
import type { GameRoom } from '../../rooms/GameRoom';
import type { ServerPlayer } from '../../rooms/player';

/** Bolt collision radius (tiles). */
export const BOLT_RADIUS = 0.25;
/** Echo Step: Echoes left by one player at once (Many Worlds Echoes come on top). */
export const MAX_ECHOES = 2;
/** Many Worlds: Echo distance from the caster and the power of every repeated cast. */
export const ULT_ECHO_DIST = 1.6;
export const ULT_REPEAT_POWER = 0.4;
/** Tethers snap when their ends are this far apart (tiles). */
export const LINK_BREAK = 24;
export const LINK_SECS = 8;
export const LINKS_MAX = 3;
export const LINKS_MAX_WEAVER = 5;
export const ECHO_PCT = 0.4;
export const ECHO_PCT_WEAVER = 0.55;
export const HEAL_ECHO_PCT_BONDKEEPER = 0.6;
export const BONDKEEPER_RANGE = 6;
export const BELL_RANGE = 7;
export const PARADOX_STUN = 1;
export const DODGE = 0.5;
export const DODGE_PHANTOM = 0.65;
export const PHANTOM_BONUS_SECS = 2;
/** Element riders. */
export const BURN_DPS = 3;
export const BURN_SECS = 3;
export const FROST_SLOW = 0.35;
export const FROST_SECS = 2;
export const SPARK_NIGHT = 1.2;
export const VERDANT_LEECH = 0.15;
export const TIDE_BONUS = 1.1;
export const VOID_BONUS = 1.25;
export const RADIANT_KB = 4;
export const TIDE_KB = 7;
export const BOLT_KB = 3;
/** Ward damage reduction never goes above this, whatever the power. */
export const WARD_CAP = 0.6;
/** Transient visuals (rings, blinks) live this long (s). */
const FLASH_SECS = 0.35;

export interface Kit {
  cls: ClassId;
  second: ClassId | null;
  spec: string | null;
}

/** What the engine needs from the circuit module. */
export interface EngineHost {
  kit(sid: string): Kit | null;
  /** an ability of `caster` hurt an enemy (resource, combat timer) */
  onHit(caster: ServerPlayer, dmg: number): void;
  /** damage or healing echoed along `owner`'s threads (Bond) */
  onEchoed(owner: ServerPlayer, amount: number): void;
  /** an ability of `caster` killed an enemy (tutorial) */
  onKill(caster: ServerPlayer, e: Enemy): void;
  /** a Tether of `caster` linked something (Paradox) */
  onTether(caster: ServerPlayer): void;
  /** `p` took a hit (combat timer) */
  onHurt(p: ServerPlayer): void;
}

/** One executed form. `power` already folds in Link and Lock-in multipliers. */
export interface CastCtx {
  caster: ServerPlayer;
  ability: AbilityId;
  bit: 0 | 1;
  hue: number;
  power: number;
  aimX: number;
  aimY: number;
  /** selected target (validated by the circuit module): an enemy id or a party mate's session id */
  target?: string;
}

interface Bolt {
  id: string;
  st: SpellState;
  owner: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  range: number;
  travelled: number;
  form: AbilityForm;
  hue: number;
  power: number;
  dmg: number;
  effect: 'dmg' | 'link_enemy' | 'link_ally';
  /** weapon bolts: enemies it may still pass through, and those already hit */
  pierce?: number;
  hit?: Set<string>;
  /** terrain level the bolt left from */
  level: number;
}
interface Echo {
  id: string;
  st: SpellState;
  owner: string;
  x: number;
  y: number;
  until: number;
  ult: boolean;
  ox: number;
  oy: number;
}
interface Aura {
  id: string;
  st: SpellState;
  owner: string;
  kind: 'shield' | 'mirror' | 'ward';
  until: number;
  amount: number;
}
interface Link {
  id: string;
  st: SpellState;
  owner: string;
  kind: 'enemy' | 'ally';
  target: string;
  until: number;
  at: number;
}
interface Flash {
  id: string;
  st: SpellState;
  until: number;
}
interface Bell {
  owner: string;
  until: number;
  pairs: Map<string, string>;
  spells: Array<{ id: string; st: SpellState; a: string; b: string }>;
}
interface Status {
  slowF: number;
  slowUntil: number;
  stunUntil: number;
  burnUntil: number;
  burnNext: number;
  burnOwner: string;
  orig: EnemyDef | null;
  clone: EnemyDef | null;
  applied: number;
}
interface Later {
  at: number;
  owner: string;
  fn: () => void;
}
interface EchoPlan {
  spooky: Array<{ owner: string; others: string[] }>;
  bell: Array<{ owner: string; partner: string }>;
}

interface HitOpts {
  dx: number;
  dy: number;
  kb: number;
  /** element (-1: none, used by echoes and reflections) */
  hue: number;
  slow?: number;
  slowSecs?: number;
  stun?: number;
  /** echoed damage never echoes again */
  echo?: boolean;
}

/** tiles within which Mend can reach a selected party mate */
export const MEND_TARGET_RANGE = 14;

const norm = (x: number, y: number): [number, number] => {
  const l = Math.hypot(x, y);
  return l > 1e-6 ? [x / l, y / l] : [0, 1];
};

export class AbilityEngine {
  /** simulation time (s), advanced by `tick` */
  t = 0;
  private seq = 0;
  private bolts = new Map<string, Bolt>();
  private echoes = new Map<string, Echo>();
  private auras = new Map<string, Aura>();
  private links = new Map<string, Link>();
  private flashes = new Map<string, Flash>();
  private bells = new Map<string, Bell>();
  private status = new Map<string, Status>();
  private later: Later[] = [];
  /** enemy id -> hp last seen by the engine (for damage dealt outside abilities: melee, skill shots) */
  private hpSeen = new Map<string, number>();
  /** depth of `room.hitEnemy` calls made by the engine (their kills are echoed by `hit` itself) */
  private inHit = 0;

  constructor(
    private room: GameRoom,
    private host: EngineHost,
  ) {}

  // ───────────────────────── spells (synced visuals) ─────────────────────────

  private spell(
    kind: number,
    x: number,
    y: number,
    hue: number,
    owner: string,
    extra: Partial<SpellState> = {},
  ): { id: string; st: SpellState } {
    const id = `sp${++this.seq}`;
    const st = new SpellState();
    st.id = id;
    st.kind = kind;
    st.x = x;
    st.y = y;
    st.hue = Math.max(0, Math.min(8, Math.round(hue)));
    st.owner = owner;
    Object.assign(st, extra);
    this.room.state.spells.set(id, st);
    return { id, st };
  }

  private unspell(id: string): void {
    this.room.state.spells.delete(id);
  }

  /** Interest management: every live spell with its world position. */
  view(push: (id: string, x: number, y: number, st: SpellState) => void): void {
    this.room.state.spells.forEach((st, id) => push(id, st.x, st.y, st));
  }

  /** Counts for debugging and tests. */
  counts(): Record<string, number> {
    return {
      bolts: this.bolts.size,
      echoes: this.echoes.size,
      auras: this.auras.size,
      links: this.links.size,
      bells: this.bells.size,
      statuses: this.status.size,
      spells: this.room.state.spells.size,
    };
  }

  // ───────────────────────── queries ─────────────────────────

  private player(sid: string): ServerPlayer | undefined {
    return this.room.players.get(sid);
  }
  private alive(p: ServerPlayer | undefined): p is ServerPlayer {
    return !!p && p.deadT <= 0 && this.room.players.get(p.id) === p;
  }
  private has(sid: string, cls: ClassId): boolean {
    const k = this.host.kit(sid);
    return !!k && (k.cls === cls || k.second === cls);
  }
  private spec(sid: string, cls: ClassId): string | null {
    const k = this.host.kit(sid);
    return k && k.cls === cls ? k.spec : null;
  }

  /** The player and their party mates on this shard. */
  allies(p: ServerPlayer): ServerPlayer[] {
    const out = [p];
    for (const acc of this.room.social?.partyMates(p.accountId) ?? []) {
      const q = this.room.playerByAccount(acc);
      if (q && q !== p) out.push(q);
    }
    return out;
  }

  echoesOf(sid: string): Echo[] {
    return [...this.echoes.values()].filter((e) => e.owner === sid);
  }
  linksOf(sid: string): Link[] {
    return [...this.links.values()].filter((l) => l.owner === sid);
  }
  aurasOf(sid: string): Aura[] {
    return [...this.auras.values()].filter((a) => a.owner === sid);
  }
  statusOf(enemyId: string): Readonly<Status> | undefined {
    return this.status.get(enemyId);
  }
  bellOf(sid: string): Bell | undefined {
    return this.bells.get(sid);
  }

  private linkMax(sid: string): number {
    return this.spec(sid, 'entangler') === 'weaver' ? LINKS_MAX_WEAVER : LINKS_MAX;
  }
  private echoSecs(sid: string, base: number): number {
    return base + (this.spec(sid, 'superposer') === 'phantom' ? PHANTOM_BONUS_SECS : 0);
  }

  // ───────────────────────── casting ─────────────────────────

  /** Execute one fired line's form. */
  execute(c: CastCtx): void {
    const form = this.formFor(c.caster.id, c.ability, c.bit);
    this.run(c, form, c.caster.sim.x, c.caster.sim.y, false);
    // Many Worlds: every Echo of the ultimate repeats offensive casts at reduced power
    if (form.kind === 'bolt' || form.kind === 'ring' || form.kind === 'link_enemy') {
      for (const e of this.echoesOf(c.caster.id))
        if (e.ult) this.run({ ...c, power: c.power * ULT_REPEAT_POWER }, form, e.x, e.y, true);
    }
  }

  /** The form after specialization changes (Splitter). */
  formFor(sid: string, ability: AbilityId, bit: 0 | 1): AbilityForm {
    const f = ABILITIES[ability].forms[bit];
    if (ability === 'split_shot' && this.spec(sid, 'superposer') === 'splitter')
      return bit ? { ...f, count: 3 } : { ...f, dmg: 24 };
    return f;
  }

  private run(c: CastCtx, f: AbilityForm, ox: number, oy: number, repeat: boolean): void {
    const p = c.caster;
    switch (f.kind) {
      case 'bolt':
        this.fireBolts(c, f, ox, oy, 'dmg');
        break;
      case 'link_enemy':
        this.fireBolts(c, f, ox, oy, 'link_enemy');
        break;
      case 'link_ally':
        this.fireBolts(c, f, ox, oy, 'link_ally');
        break;
      case 'ring':
        this.ring(c, f, ox, oy);
        break;
      case 'blink':
        if (!repeat) this.blink(c, f, false);
        break;
      case 'blink_back':
        if (!repeat) this.blink(c, f, true);
        break;
      case 'shield':
        this.aura(p, 'shield', (f.amount ?? 30) * c.power, f.secs ?? 5, c.hue, SPELL.SHIELD);
        break;
      case 'mirror':
        this.aura(p, 'mirror', (f.amount ?? 1.5) * c.power, f.secs ?? 5, c.hue, SPELL.MIRROR);
        break;
      case 'ward':
        this.aura(p, 'ward', Math.min(WARD_CAP, (f.amount ?? 0.35) * c.power), f.secs ?? 6, c.hue, SPELL.WARD);
        break;
      case 'heal':
        this.mend(c, f);
        break;
      case 'pulse_dmg':
        this.pulseDamage(c, f);
        break;
      case 'pulse_heal':
        this.pulseHeal(c, f);
        break;
      case 'pull':
        this.pull(c, f);
        break;
      case 'swap':
        this.swap(c, f);
        break;
    }
  }

  /**
   * A weapon's basic or charged attack (staves, crossbow): the same bolts, rings and heals as abilities, so elements,
   * Spooky Action echoes and kill credit all behave identically. `power` scales damage (charge level).
   */
  weaponShot(caster: ServerPlayer, shot: WeaponShot, aimX: number, aimY: number, power = 1, target?: string): void {
    const hue = shot.hue < 0 ? 8 : shot.hue;
    const form: AbilityForm = {
      name: shot.name,
      hue,
      kind: shot.kind === 'bolt' ? 'bolt' : 'ring',
      dmg: shot.dmg,
      count: shot.count,
      spread: shot.spread,
      range: shot.range,
      speed: shot.speed,
      radius: shot.radius,
      slow: shot.slow,
      secs: shot.secs,
      push: shot.push,
    };
    const c: CastCtx = { caster, ability: 'glimmer', bit: 0, hue, power, aimX, aimY, target };
    if (shot.kind === 'bolt') this.fireBolts(c, form, caster.sim.x, caster.sim.y, 'dmg', shot.pierce);
    else if (shot.kind === 'ring') {
      this.ring(c, form, caster.sim.x, caster.sim.y);
      if (shot.heal) this.healAround(caster, shot.radius ?? 3, shot.heal * power, hue);
    } else if (shot.kind === 'heal_pulse') {
      this.flash(SPELL.RING, caster.sim.x, caster.sim.y, hue, caster.id, { r: shot.radius ?? 5 });
      this.healAround(caster, shot.radius ?? 5, (shot.heal ?? 20) * power, hue);
    }
  }

  /** Heal `p` and their party mates within `r` tiles. */
  private healAround(p: ServerPlayer, r: number, amt: number, hue: number): void {
    for (const q of this.allies(p)) {
      if (!this.alive(q) || Math.hypot(q.sim.x - p.sim.x, q.sim.y - p.sim.y) > r) continue;
      this.heal(q, amt);
      this.flash(SPELL.WARD, q.sim.x, q.sim.y, hue, p.id, { target: q.id, r: 0.5 });
    }
  }

  private fireBolts(c: CastCtx, f: AbilityForm, ox: number, oy: number, effect: Bolt['effect'], pierce = 0): void {
    const n = Math.max(1, f.count ?? 1);
    const spread = ((f.spread ?? 10) * Math.PI) / 180;
    const base = Math.atan2(c.aimY, c.aimX);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      const dx = Math.cos(a),
        dy = Math.sin(a);
      const sp = this.spell(SPELL.BOLT, ox, oy, c.hue, c.caster.id, { dx, dy });
      const level = this.room.store.levelAt(Math.floor(ox), Math.floor(oy));
      this.bolts.set(sp.id, {
        ...sp,
        level,
        owner: c.caster.id,
        x: ox,
        y: oy,
        dx,
        dy,
        speed: f.speed ?? 12,
        range: (f.range ?? 9) * highGroundRange(level),
        travelled: 0,
        form: f,
        hue: c.hue,
        power: c.power,
        dmg: (f.dmg ?? 0) * c.power,
        effect,
        pierce,
        hit: new Set<string>(),
      });
    }
  }

  private stepBolts(dt: number): void {
    const solid = this.room.store.shotBlockedAt;
    for (const b of [...this.bolts.values()]) {
      const caster = this.player(b.owner);
      const step = Math.min(b.speed * dt, b.range - b.travelled);
      if (!caster || step <= 1e-6) {
        this.bolts.delete(b.id);
        this.unspell(b.id);
        continue;
      }
      const nx = b.x + b.dx * step,
        ny = b.y + b.dy * step;
      let landed = false;
      if (b.effect === 'link_ally') {
        for (const q of this.allies(caster)) {
          if (q === caster || q.deadT > 0) continue;
          if (segmentHitsCircle(b.x, b.y, nx, ny, BOLT_RADIUS, { x: q.sim.x, y: q.sim.y, r: PLAYER_RADIUS })) {
            this.link(caster, 'ally', q.id, b.hue, b.form.secs ?? LINK_SECS);
            landed = true;
            break;
          }
        }
      } else {
        let best: Enemy | null = null,
          bd = Infinity;
        for (const e of this.room.enemies.values()) {
          if (
            e.hp <= 0 ||
            b.hit?.has(e.id) ||
            !segmentHitsCircle(b.x, b.y, nx, ny, BOLT_RADIUS, { x: e.x, y: e.y, r: e.def.radius })
          )
            continue;
          const d = Math.hypot(e.x - b.x, e.y - b.y);
          if (d < bd) {
            bd = d;
            best = e;
          }
        }
        if (best) {
          const target = best;
          // a Tether links first, so its own damage already echoes along the caster's other threads
          if (b.effect === 'link_enemy') this.link(caster, 'enemy', target.id, b.hue, b.form.secs ?? LINK_SECS);
          if (b.dmg > 0)
            this.hit(caster, target, b.dmg, {
              dx: b.dx,
              dy: b.dy,
              kb: b.form.push ?? BOLT_KB,
              hue: b.hue,
              slow: b.form.slow,
              slowSecs: b.form.secs,
            });
          if ((b.pierce ?? 0) > 0) {
            b.pierce!--;
            (b.hit ??= new Set()).add(target.id);
          } else landed = true;
        }
      }
      const wall = !landed && solid(Math.floor(nx), Math.floor(ny), b.level);
      if (!wall) {
        b.x = nx;
        b.y = ny;
        b.travelled += step;
        b.st.x = nx;
        b.st.y = ny;
      }
      const spent = b.travelled >= b.range - 1e-6;
      if (!landed && !wall && !spent) continue;
      // a friendly tether that found nobody links its caster
      if (!landed && b.effect === 'link_ally') this.link(caster, 'ally', caster.id, b.hue, b.form.secs ?? LINK_SECS);
      this.bolts.delete(b.id);
      this.unspell(b.id);
    }
  }

  private ring(c: CastCtx, f: AbilityForm, ox: number, oy: number): void {
    const r = f.radius ?? 2.5;
    this.flash(SPELL.RING, ox, oy, c.hue, c.caster.id, { r });
    for (const e of [...this.room.enemies.values()]) {
      const d = Math.hypot(e.x - ox, e.y - oy);
      if (d > r + e.def.radius) continue;
      const [dx, dy] = norm(e.x - ox, e.y - oy);
      this.hit(c.caster, e, (f.dmg ?? 0) * c.power, {
        dx,
        dy,
        kb: f.push ?? 0,
        hue: c.hue,
        slow: f.slow,
        slowSecs: f.secs,
      });
    }
  }

  private blink(c: CastCtx, f: AbilityForm, back: boolean): void {
    const p = c.caster;
    const x0 = p.sim.x,
      y0 = p.sim.y;
    const dist = (f.radius ?? 4) * Math.min(1, c.power);
    const [ax, ay] = norm(c.aimX, c.aimY);
    // stepwise collision: blinks slide along walls, never through them
    moveBody(p.sim, ax * dist, ay * dist, PLAYER_RADIUS, this.room.store.solidAt);
    p.sim.faceX = ax;
    p.sim.faceY = ay;
    this.flash(SPELL.BLINK, x0, y0, c.hue, p.id, {
      dx: p.sim.x - x0,
      dy: p.sim.y - y0,
      r: Math.hypot(p.sim.x - x0, p.sim.y - y0),
    });
    const echoSecs = this.echoSecs(p.id, (ABILITIES.echo_step.forms[0].secs ?? 4) * Math.max(1, c.power));
    if (!back) {
      this.addEcho(p, x0, y0, echoSecs, c.hue, false);
      return;
    }
    const snap = f.secs ?? 1.5;
    this.later.push({
      at: this.t + snap,
      owner: p.id,
      fn: () => {
        if (!this.alive(p)) return;
        // the self you leave behind stays as an Echo where you stood
        this.addEcho(p, p.sim.x, p.sim.y, echoSecs, c.hue, false);
        const x1 = p.sim.x,
          y1 = p.sim.y;
        p.sim.x = x0;
        p.sim.y = y0;
        this.flash(SPELL.BLINK, x1, y1, c.hue, p.id, { dx: x0 - x1, dy: y0 - y1, r: Math.hypot(x0 - x1, y0 - y1) });
      },
    });
  }

  private addEcho(
    p: ServerPlayer,
    x: number,
    y: number,
    secs: number,
    hue: number,
    ult: boolean,
    ox = 0,
    oy = 0,
  ): void {
    if (!ult) {
      const mine = this.echoesOf(p.id)
        .filter((e) => !e.ult)
        .sort((a, b) => a.until - b.until);
      while (mine.length >= MAX_ECHOES) this.removeEcho(mine.shift()!.id);
    }
    const sp = this.spell(SPELL.ECHO, x, y, hue, p.id, { target: p.id, r: ult ? 1 : 0 });
    this.echoes.set(sp.id, { ...sp, owner: p.id, x, y, until: this.t + secs, ult, ox, oy });
  }

  private removeEcho(id: string): void {
    if (this.echoes.delete(id)) this.unspell(id);
  }

  private aura(
    p: ServerPlayer,
    kind: Aura['kind'],
    amount: number,
    secs: number,
    hue: number,
    spellKind: number,
  ): void {
    for (const a of this.aurasOf(p.id))
      if (a.kind === kind) {
        this.auras.delete(a.id);
        this.unspell(a.id);
      }
    const sp = this.spell(spellKind, p.sim.x, p.sim.y, hue, p.id, { target: p.id, r: 0.7 });
    this.auras.set(sp.id, { ...sp, owner: p.id, kind, until: this.t + secs, amount });
  }

  private flash(kind: number, x: number, y: number, hue: number, owner: string, extra: Partial<SpellState>): void {
    const sp = this.spell(kind, x, y, hue, owner, extra);
    this.flashes.set(sp.id, { ...sp, until: this.t + FLASH_SECS });
  }

  // ───────────────────────── Entangler ─────────────────────────

  private linkOn(owner: string, kind: Link['kind']): Link[] {
    return this.linksOf(owner).filter((l) => l.kind === kind);
  }

  private link(caster: ServerPlayer, kind: Link['kind'], target: string, hue: number, secs: number): void {
    const existing = this.linksOf(caster.id).find((l) => l.target === target);
    if (existing) {
      existing.until = this.t + secs;
      existing.at = this.t;
      this.host.onTether(caster);
      return;
    }
    const mine = this.linksOf(caster.id).sort((a, b) => a.at - b.at);
    while (mine.length >= this.linkMax(caster.id)) this.unlink(mine.shift()!.id);
    const pos = this.pos(target) ?? { x: caster.sim.x, y: caster.sim.y };
    const sp = this.spell(SPELL.TETHER, (pos.x + caster.sim.x) / 2, (pos.y + caster.sim.y) / 2, hue, caster.id, {
      target,
    });
    this.links.set(sp.id, { ...sp, owner: caster.id, kind, target, until: this.t + secs, at: this.t });
    if (kind === 'enemy') {
      const e = this.room.enemies.get(target);
      if (e) this.hpSeen.set(e.id, e.hp);
    }
    this.host.onTether(caster);
  }

  private unlink(id: string): void {
    if (this.links.delete(id)) this.unspell(id);
  }

  /** World position of an enemy or a player session. */
  private pos(id: string): { x: number; y: number } | null {
    const e = this.room.enemies.get(id);
    if (e) return { x: e.x, y: e.y };
    const p = this.room.players.get(id);
    return p ? { x: p.sim.x, y: p.sim.y } : null;
  }

  private pulseDamage(c: CastCtx, f: AbilityForm): void {
    const p = c.caster,
      r = f.radius ?? 14;
    for (const l of this.linkOn(p.id, 'enemy')) {
      const e = this.room.enemies.get(l.target);
      if (!e || Math.hypot(e.x - p.sim.x, e.y - p.sim.y) > r) continue;
      const [dx, dy] = norm(e.x - p.sim.x, e.y - p.sim.y);
      this.hit(p, e, (f.dmg ?? 16) * c.power, { dx, dy, kb: 0, hue: c.hue });
    }
  }

  private pulseHeal(c: CastCtx, f: AbilityForm): void {
    const p = c.caster,
      r = f.radius ?? 14,
      amt = (f.heal ?? 14) * c.power;
    const healed = new Set<string>([p.id]);
    this.heal(p, amt);
    for (const l of this.linkOn(p.id, 'ally')) {
      if (healed.has(l.target)) continue;
      const q = this.player(l.target);
      if (!q || Math.hypot(q.sim.x - p.sim.x, q.sim.y - p.sim.y) > r) continue;
      healed.add(q.id);
      this.heal(q, amt);
    }
  }

  private nearestLinked(p: ServerPlayer, r: number, kinds: Array<Link['kind']>, prefer?: string): Link | null {
    let best: Link | null = null,
      bd = Infinity;
    if (prefer) {
      const l = this.linksOf(p.id).find((x) => x.target === prefer && kinds.includes(x.kind));
      const pos = l && this.pos(prefer);
      if (l && pos && Math.hypot(pos.x - p.sim.x, pos.y - p.sim.y) <= r) return l;
    }
    for (const l of this.linksOf(p.id)) {
      if (!kinds.includes(l.kind) || l.target === p.id) continue;
      const pos = this.pos(l.target);
      if (!pos) continue;
      const d = Math.hypot(pos.x - p.sim.x, pos.y - p.sim.y);
      if (d <= r && d < bd) {
        bd = d;
        best = l;
      }
    }
    return best;
  }

  private pull(c: CastCtx, f: AbilityForm): void {
    const p = c.caster;
    const l = this.nearestLinked(p, f.radius ?? 12, ['enemy'], c.target);
    const e = l ? this.room.enemies.get(l.target) : undefined;
    if (!e) return;
    const dx = p.sim.x - e.x,
      dy = p.sim.y - e.y,
      d = Math.hypot(dx, dy);
    const stop = PLAYER_RADIUS + e.def.radius + 0.6;
    if (d > stop) moveBody(e, (dx / d) * (d - stop), (dy / d) * (d - stop), e.def.radius, this.room.store.solidAt);
    e.kx = 0;
    e.ky = 0;
    e.state.x = e.x;
    e.state.y = e.y;
    this.flash(SPELL.BLINK, e.x, e.y, c.hue, p.id, { target: e.id, dx: -dx, dy: -dy, r: d });
    if (this.spec(p.id, 'entangler') === 'paradox') this.stun(e, PARADOX_STUN);
  }

  private swap(c: CastCtx, f: AbilityForm): void {
    const p = c.caster;
    const l = this.nearestLinked(p, f.radius ?? 12, ['enemy', 'ally'], c.target);
    if (!l) return;
    const x0 = p.sim.x,
      y0 = p.sim.y;
    const e = this.room.enemies.get(l.target);
    if (e) {
      p.sim.x = e.x;
      p.sim.y = e.y;
      e.x = x0;
      e.y = y0;
      e.kx = 0;
      e.ky = 0;
      e.state.x = x0;
      e.state.y = y0;
      if (this.spec(p.id, 'entangler') === 'paradox') this.stun(e, PARADOX_STUN);
    } else {
      const q = this.player(l.target);
      if (!q || q.deadT > 0) return;
      p.sim.x = q.sim.x;
      p.sim.y = q.sim.y;
      q.sim.x = x0;
      q.sim.y = y0;
    }
    this.flash(SPELL.BLINK, x0, y0, c.hue, p.id, {
      target: l.target,
      dx: p.sim.x - x0,
      dy: p.sim.y - y0,
      r: Math.hypot(p.sim.x - x0, p.sim.y - y0),
    });
  }

  private mend(c: CastCtx, f: AbilityForm): void {
    const p = c.caster,
      amt = (f.heal ?? 20) * c.power;
    // a selected party mate in reach receives the heal instead of the caster
    const sel = c.target ? this.allies(p).find((q) => q.id === c.target && q !== p) : undefined;
    if (sel && this.alive(sel) && Math.hypot(sel.sim.x - p.sim.x, sel.sim.y - p.sim.y) <= MEND_TARGET_RANGE) {
      this.heal(sel, amt);
      this.flash(SPELL.WARD, sel.sim.x, sel.sim.y, c.hue, p.id, { target: sel.id, r: 0.5 });
      return;
    }
    this.heal(p, amt);
    if (this.spec(p.id, 'entangler') === 'bondkeeper') {
      for (const q of this.allies(p))
        if (q !== p && Math.hypot(q.sim.x - p.sim.x, q.sim.y - p.sim.y) <= BONDKEEPER_RANGE) this.heal(q, amt);
    }
    this.flash(SPELL.WARD, p.sim.x, p.sim.y, c.hue, p.id, { target: p.id, r: 0.5 });
  }

  /** Heal `target` (alive only); healing on a Linked ally echoes to the owner's other Linked allies (Spooky Action). */
  heal(target: ServerPlayer, amount: number, echo = true): number {
    if (!this.alive(target)) return 0;
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + Math.max(0, Math.round(amount)));
    const done = target.hp - before;
    if (echo && amount > 0) {
      for (const l of [...this.links.values()]) {
        if (l.kind !== 'ally' || l.target !== target.id || !this.has(l.owner, 'entangler')) continue;
        const owner = this.player(l.owner);
        if (!owner) continue;
        const pct = this.spec(owner.id, 'entangler') === 'bondkeeper' ? HEAL_ECHO_PCT_BONDKEEPER : ECHO_PCT;
        let echoed = 0;
        for (const o of this.linkOn(owner.id, 'ally')) {
          if (o.target === target.id) continue;
          const q = this.player(o.target);
          if (q) echoed += this.heal(q, amount * pct, false);
        }
        if (echoed > 0) this.host.onEchoed(owner, echoed);
      }
    }
    return done;
  }

  // ───────────────────────── damage ─────────────────────────

  /**
   * Damage an enemy with an ability: element riders, statuses, then the passives (Spooky Action echoes, Bell State
   * mirroring). Returns the damage dealt.
   */
  hit(caster: ServerPlayer | null, e: Enemy, base: number, o: HitOpts): number {
    if (!this.room.enemies.has(e.id) || e.hp <= 0 || base <= 0) return 0;
    let dmg = base,
      kb = o.kb;
    switch (o.hue) {
      case 1:
        if (e.night) dmg *= SPARK_NIGHT;
        break;
      case 2:
        kb += RADIANT_KB;
        break;
      case 5:
        dmg *= TIDE_BONUS;
        kb += TIDE_KB;
        break;
      case 6:
        dmg *= VOID_BONUS;
        break;
      case FLUX:
        dmg *= 0.6 + this.room.rand();
        break;
    }
    const dealt = Math.max(1, Math.round(dmg));
    const hpBefore = e.hp;
    // who echoes this hit is decided before it lands: a killing blow removes the enemy's threads
    const plan = o.echo ? null : this.echoPlan(e);
    this.inHit++;
    try {
      this.room.hitEnemy(e, dealt, caster, o.dx, o.dy, kb);
    } finally {
      this.inHit--;
    }
    const real = Math.min(dealt, Math.max(0, hpBefore));
    const dead = !this.room.enemies.has(e.id);
    if (this.hpSeen.has(e.id)) this.hpSeen.set(e.id, e.hp);
    if (!dead) {
      if (o.hue === 0) this.burn(e, caster);
      let slow = o.slow ?? 0,
        secs = o.slowSecs ?? 0;
      if (o.hue === 4) {
        slow = Math.max(slow, FROST_SLOW);
        secs = Math.max(secs, FROST_SECS);
      }
      if (slow > 0 && secs > 0) this.slow(e, slow, secs);
      if (o.stun) this.stun(e, o.stun);
    }
    if (caster) {
      if (o.hue === 3) this.heal(caster, real * VERDANT_LEECH, false);
      this.host.onHit(caster, real);
      if (dead) this.host.onKill(caster, e);
    }
    if (plan) this.applyEchoes(e, real, plan);
    return real;
  }

  /** The Entanglers whose threads hold `e` (Spooky Action) and Bell State partners of `e`. */
  private echoPlan(e: Enemy): EchoPlan {
    const spooky: EchoPlan['spooky'] = [];
    for (const l of this.links.values()) {
      if (l.kind !== 'enemy' || l.target !== e.id || !this.has(l.owner, 'entangler')) continue;
      const others = this.linkOn(l.owner, 'enemy')
        .map((o) => o.target)
        .filter((id) => id !== e.id);
      if (others.length) spooky.push({ owner: l.owner, others });
    }
    const bell: EchoPlan['bell'] = [];
    for (const b of this.bells.values()) {
      const partner = b.pairs.get(e.id);
      if (partner) bell.push({ owner: b.owner, partner });
    }
    return { spooky, bell };
  }

  /** Spooky Action and Bell State for `dmg` that landed on `e` (from anything: abilities, melee, skill shots). */
  private applyEchoes(e: Enemy, dmg: number, plan: EchoPlan): void {
    if (dmg <= 0) return;
    for (const { owner: sid, others } of plan.spooky) {
      const owner = this.player(sid);
      if (!owner) continue;
      const pct = this.spec(sid, 'entangler') === 'weaver' ? ECHO_PCT_WEAVER : ECHO_PCT;
      let echoed = 0;
      for (const id of others) {
        const other = this.room.enemies.get(id);
        if (!other) continue;
        const [dx, dy] = norm(other.x - e.x, other.y - e.y);
        echoed += this.hit(owner, other, dmg * pct, { dx, dy, kb: 0, hue: -1, echo: true });
      }
      if (echoed > 0) this.host.onEchoed(owner, echoed);
    }
    for (const { owner, partner } of plan.bell) {
      const other = this.room.enemies.get(partner);
      if (other) this.hit(this.player(owner) ?? null, other, dmg, { dx: 0, dy: 0, kb: 0, hue: -1, echo: true });
    }
  }

  private st(e: Enemy): Status {
    let s = this.status.get(e.id);
    if (!s) {
      s = {
        slowF: 0,
        slowUntil: 0,
        stunUntil: 0,
        burnUntil: 0,
        burnNext: 0,
        burnOwner: '',
        orig: null,
        clone: null,
        applied: 0,
      };
      this.status.set(e.id, s);
    }
    return s;
  }

  burn(e: Enemy, by: ServerPlayer | null): void {
    const s = this.st(e);
    if (s.burnUntil <= this.t) s.burnNext = this.t + 1;
    s.burnUntil = this.t + BURN_SECS + 1e-6;
    s.burnOwner = by?.id ?? '';
  }

  slow(e: Enemy, f: number, secs: number): void {
    const s = this.st(e);
    s.slowF = s.slowUntil > this.t ? Math.max(s.slowF, f) : f;
    s.slowUntil = Math.max(s.slowUntil, this.t + secs);
    this.applyMove(e, s);
  }

  stun(e: Enemy, secs: number): void {
    const s = this.st(e);
    s.stunUntil = Math.max(s.stunUntil, this.t + secs);
    e.mode = 'recover';
    e.t = Math.max(e.t, s.stunUntil - this.t);
    e.state.tele = 0;
    this.applyMove(e, s);
  }

  /** Movement statuses work by swapping the enemy's def for a slower clone, restored when they wear off. */
  private applyMove(e: Enemy, s: Status): void {
    const stunned = s.stunUntil > this.t;
    const f = stunned ? 1 : s.slowUntil > this.t ? s.slowF : 0;
    if (s.clone && e.def !== s.clone) {
      s.orig = e.def;
      s.clone = null;
    } // replaced from outside: adopt it as the base
    if (f <= 0) {
      if (s.clone && e.def === s.clone && s.orig) e.def = s.orig;
      s.clone = null;
      s.applied = 0;
      return;
    }
    if (s.clone && s.applied === f) return;
    const base = s.clone ? s.orig! : e.def;
    s.orig = base;
    s.clone = { ...base, speed: base.speed * (1 - f) };
    s.applied = f;
    e.def = s.clone;
  }

  private stepStatus(): void {
    for (const [id, s] of [...this.status]) {
      const e = this.room.enemies.get(id);
      if (!e) {
        this.status.delete(id);
        continue;
      }
      if (s.stunUntil > this.t && e.mode !== 'recover') {
        e.mode = 'recover';
        e.t = s.stunUntil - this.t;
        e.state.tele = 0;
      }
      while (s.burnUntil > this.t && s.burnNext <= this.t && this.room.enemies.has(id)) {
        s.burnNext += 1;
        this.hit(this.player(s.burnOwner) ?? null, e, BURN_DPS, { dx: 0, dy: 0, kb: 0, hue: -1, echo: true });
      }
      if (!this.room.enemies.has(id)) {
        this.status.delete(id);
        continue;
      }
      this.applyMove(e, s);
      if (s.stunUntil <= this.t && s.slowUntil <= this.t && s.burnUntil <= this.t && !s.clone) this.status.delete(id);
    }
  }

  // ───────────────────────── ultimates ─────────────────────────

  /** Many Worlds: three Echoes surround the caster and repeat their offensive casts. */
  manyWorlds(p: ServerPlayer, secs: number, aimX: number, aimY: number): void {
    for (const e of this.echoesOf(p.id)) if (e.ult) this.removeEcho(e.id);
    const base = Math.atan2(aimY, aimX);
    const dur = this.echoSecs(p.id, secs);
    for (let i = 0; i < 3; i++) {
      const a = base + (i * 2 * Math.PI) / 3;
      const ox = Math.cos(a) * ULT_ECHO_DIST,
        oy = Math.sin(a) * ULT_ECHO_DIST;
      this.addEcho(p, p.sim.x + ox, p.sim.y + oy, dur, 7, true, ox, oy);
    }
  }

  /** Bell State: pair every hostile enemy within range; damage on one is mirrored to its partner. */
  bellState(p: ServerPlayer, secs: number): number {
    this.endBell(p.id);
    const near = [...this.room.enemies.values()]
      .filter((e) => !e.def.passive && e.hp > 0 && Math.hypot(e.x - p.sim.x, e.y - p.sim.y) <= BELL_RANGE)
      .sort((a, b) => Math.hypot(a.x - p.sim.x, a.y - p.sim.y) - Math.hypot(b.x - p.sim.x, b.y - p.sim.y));
    const bell: Bell = { owner: p.id, until: this.t + secs, pairs: new Map(), spells: [] };
    for (let i = 0; i + 1 < near.length; i += 2) {
      const a = near[i]!,
        b = near[i + 1]!;
      bell.pairs.set(a.id, b.id);
      bell.pairs.set(b.id, a.id);
      this.hpSeen.set(a.id, a.hp);
      this.hpSeen.set(b.id, b.hp);
      // a Bell pair is drawn as a tether between the two enemies (owner and target are both enemy ids)
      const sp = this.spell(SPELL.TETHER, (a.x + b.x) / 2, (a.y + b.y) / 2, 6, a.id, { target: b.id, r: 1 });
      bell.spells.push({ ...sp, a: a.id, b: b.id });
    }
    this.bells.set(p.id, bell);
    this.flash(SPELL.RING, p.sim.x, p.sim.y, 6, p.id, { r: BELL_RANGE });
    return bell.pairs.size / 2;
  }

  private endBell(owner: string): void {
    const b = this.bells.get(owner);
    if (!b) return;
    for (const s of b.spells) this.unspell(s.id);
    this.bells.delete(owner);
  }

  // ───────────────────────── incoming damage ─────────────────────────

  /** An enemy strike is about to hurt `p` by `dmg`. Echo dodge, mirror, ward, then shield. */
  incoming(p: ServerPlayer, dmg: number, e: Enemy): number {
    this.host.onHurt(p);
    // Two Places at Once: the hit may land on an Echo instead; you collapse to where it was
    if (this.has(p.id, 'superposer')) {
      const mine = this.echoesOf(p.id);
      if (mine.length) {
        const chance = this.spec(p.id, 'superposer') === 'phantom' ? DODGE_PHANTOM : DODGE;
        if (this.room.rand() < chance) {
          const echo = mine[Math.floor(this.room.rand() * mine.length)] ?? mine[0]!;
          this.flash(SPELL.BLINK, p.sim.x, p.sim.y, 1, p.id, {
            dx: echo.x - p.sim.x,
            dy: echo.y - p.sim.y,
            r: Math.hypot(echo.x - p.sim.x, echo.y - p.sim.y),
          });
          p.sim.x = echo.x;
          p.sim.y = echo.y;
          p.invuln = Math.max(p.invuln, 0.3);
          this.removeEcho(echo.id);
          return 0;
        }
      }
    }
    let d = dmg;
    for (const a of this.aurasOf(p.id)) {
      if (a.kind !== 'mirror') continue;
      this.auras.delete(a.id);
      this.unspell(a.id);
      const [dx, dy] = norm(e.x - p.sim.x, e.y - p.sim.y);
      this.hit(p, e, dmg * a.amount, { dx, dy, kb: 4, hue: -1 });
      return 0;
    }
    for (const a of this.aurasOf(p.id)) if (a.kind === 'ward') d = d * (1 - a.amount);
    for (const a of this.aurasOf(p.id)) {
      if (a.kind !== 'shield' || d <= 0) continue;
      const absorbed = Math.min(a.amount, d);
      a.amount -= absorbed;
      d -= absorbed;
      if (a.amount <= 0.01) {
        this.auras.delete(a.id);
        this.unspell(a.id);
      }
    }
    return Math.max(0, Math.round(d));
  }

  // ───────────────────────── upkeep ─────────────────────────

  tick(dt = TICK_DT): void {
    this.t += dt;
    const due = this.later.filter((l) => l.at <= this.t);
    if (due.length) {
      this.later = this.later.filter((l) => l.at > this.t);
      for (const l of due) l.fn();
    }
    this.stepBolts(dt);
    this.stepStatus();
    this.detectOutsideDamage();

    for (const e of [...this.echoes.values()]) {
      const p = this.player(e.owner);
      if (!p || e.until <= this.t) {
        this.removeEcho(e.id);
        continue;
      }
      if (e.ult) {
        e.x = p.sim.x + e.ox;
        e.y = p.sim.y + e.oy;
        e.st.x = e.x;
        e.st.y = e.y;
      }
    }
    for (const a of [...this.auras.values()]) {
      const p = this.player(a.owner);
      if (!p || a.until <= this.t) {
        this.auras.delete(a.id);
        this.unspell(a.id);
        continue;
      }
      a.st.x = p.sim.x;
      a.st.y = p.sim.y;
    }
    for (const l of [...this.links.values()]) {
      const owner = this.player(l.owner);
      const pos = this.pos(l.target);
      const gone = !owner || !pos || l.until <= this.t || (l.kind === 'ally' && !this.room.players.has(l.target));
      if (gone || Math.hypot(pos!.x - owner!.sim.x, pos!.y - owner!.sim.y) > LINK_BREAK) {
        this.unlink(l.id);
        continue;
      }
      l.st.x = (pos!.x + owner!.sim.x) / 2;
      l.st.y = (pos!.y + owner!.sim.y) / 2;
    }
    for (const b of [...this.bells.values()]) {
      if (b.until <= this.t || !this.player(b.owner)) {
        this.endBell(b.owner);
        continue;
      }
      b.spells = b.spells.filter((s) => {
        const a = this.room.enemies.get(s.a),
          c = this.room.enemies.get(s.b);
        if (!a || !c) {
          this.unspell(s.id);
          b.pairs.delete(s.a);
          b.pairs.delete(s.b);
          return false;
        }
        s.st.x = (a.x + c.x) / 2;
        s.st.y = (a.y + c.y) / 2;
        return true;
      });
    }
    for (const f of [...this.flashes.values()])
      if (f.until <= this.t) {
        this.flashes.delete(f.id);
        this.unspell(f.id);
      }

    // forget hp of enemies nothing tracks any more
    if (this.hpSeen.size) {
      const tracked = this.trackedEnemies();
      for (const id of [...this.hpSeen.keys()])
        if (!tracked.has(id) || !this.room.enemies.has(id)) this.hpSeen.delete(id);
    }
  }

  private trackedEnemies(): Set<string> {
    const s = new Set<string>();
    for (const l of this.links.values()) if (l.kind === 'enemy') s.add(l.target);
    for (const b of this.bells.values()) for (const id of b.pairs.keys()) s.add(id);
    return s;
  }

  /** Melee and skill shots bypass `hit`: notice their damage on Linked / paired enemies and run the passives. */
  private detectOutsideDamage(): void {
    for (const id of this.trackedEnemies()) {
      const e = this.room.enemies.get(id);
      if (!e) continue;
      const seen = this.hpSeen.get(id);
      if (seen !== undefined && e.hp < seen) {
        this.hpSeen.set(id, e.hp);
        this.applyEchoes(e, seen - e.hp, this.echoPlan(e));
      }
      if (this.room.enemies.has(id)) this.hpSeen.set(id, e.hp);
    }
  }

  /** An enemy died (or was removed): drop everything attached to it. */
  killed(e: Enemy): void {
    // a killing blow from outside the engine (melee, skill shot) still echoes along the threads
    const seen = this.hpSeen.get(e.id);
    if (!this.inHit && seen !== undefined && seen > 0) this.applyEchoes(e, seen, this.echoPlan(e));
    this.status.delete(e.id);
    this.hpSeen.delete(e.id);
    for (const l of [...this.links.values()]) if (l.target === e.id) this.unlink(l.id);
  }

  /** A player left: remove everything they own or are tethered by. */
  removePlayer(sid: string): void {
    for (const b of [...this.bolts.values()])
      if (b.owner === sid) {
        this.bolts.delete(b.id);
        this.unspell(b.id);
      }
    for (const e of [...this.echoes.values()]) if (e.owner === sid) this.removeEcho(e.id);
    for (const a of [...this.auras.values()])
      if (a.owner === sid) {
        this.auras.delete(a.id);
        this.unspell(a.id);
      }
    for (const l of [...this.links.values()]) if (l.owner === sid || l.target === sid) this.unlink(l.id);
    this.endBell(sid);
    this.later = this.later.filter((l) => l.owner !== sid);
    for (const s of this.status.values()) if (s.burnOwner === sid) s.burnOwner = '';
  }

  /** Remove every spell (room disposal). */
  clear(): void {
    for (const id of [...this.room.state.spells.keys()]) this.unspell(id);
    for (const [id, s] of this.status) {
      const e = this.room.enemies.get(id);
      if (e && s.clone && e.def === s.clone && s.orig) e.def = s.orig;
    }
    this.bolts.clear();
    this.echoes.clear();
    this.auras.clear();
    this.links.clear();
    this.flashes.clear();
    this.bells.clear();
    this.status.clear();
    this.hpSeen.clear();
    this.later = [];
  }
}
