/**
 * Shadow Army: creatures you defeat leave a residue for a few seconds; channel the Sigil to extract it, and the
 * shadow joins your roster. Summoned shadows fight beside you (they reuse the enemy AI, aimed at hostiles instead of
 * players), earn XP, evolve through five ranks, and re-form after falling. See docs/design/shadow-army.md.
 */
import {
  ENEMY_DEFS, ENEMY_BY_KIND, EXTRACT_LEVEL, EXTRACT_RANGE, EXTRACT_SECS, MSG34, RESIDUE_SECS, ROSTER_MAX, SHADOW_REFORM_SECS, SPELL,
  STANCES, SpellState, ShadowState, addShadowXp, canExtract, extractChance, newShadow, rankName, rankOf, shadowSlots, shadowStats,
  shadowXpFrom, shapeHits, type ShadowCmd, type ShadowEvent, type ShadowRec, type ShadowRosterMsg, type Stance, type StrikeShape,
} from '@eigenlands/shared';
import type { Schema } from '@colyseus/schema';
import { createEnemy, enemyDamage, stepEnemy, type Enemy, type EnemyKind, type Target } from '../../game/enemies';
import type { GameRoom } from '../../rooms/GameRoom';
import type { ServerPlayer } from '../../rooms/player';
import { runtime34 } from '../runtime34';
import type { Module, Registrar } from '../types';

const KIND_NAME = new Map<number, EnemyKind>(Object.entries(ENEMY_DEFS).map(([k, d]) => [d.kind, k as EnemyKind]));
const LEASH = 14;
const TELEPORT_DIST = 28;

interface Residue { id: string; owner: string; kind: number; level: number; elite: boolean; x: number; y: number; until: number; st: SpellState }
interface Unit { rec: ShadowRec; en: Enemy; st: ShadowState; downUntil: number; chargeHits: Set<string> }
interface Saved { roster: ShadowRec[]; active: string[]; stance: Stance; seq: number }
interface Live {
  p: ServerPlayer;
  data: Saved;
  units: Map<string, Unit>;
  channel: { res: Residue; until: number; x: number; y: number; chance: number } | null;
  focus: string | null;
  loaded: boolean;
  dirty: boolean;
  level: number;
}

const clean = (raw: unknown): Saved => {
  const out: Saved = { roster: [], active: [], stance: 'assist', seq: 0 };
  const r = raw as Partial<Saved> | null;
  if (!r || typeof r !== 'object') return out;
  for (const x of Array.isArray(r.roster) ? r.roster.slice(0, ROSTER_MAX) : []) {
    const k = Number((x as ShadowRec)?.kind);
    if (!x || typeof x !== 'object' || !Number.isInteger(k) || !canExtract(k) || typeof x.id !== 'string' || x.id.length > 24) continue;
    out.roster.push({ id: x.id, kind: k, name: String(x.name ?? '').slice(0, 20) || newShadow(x.id, k, 1).name, level: Math.max(1, Math.min(50, Math.floor(Number(x.level) || 1))), xp: Math.max(0, Math.floor(Number(x.xp) || 0)) });
  }
  const ids = new Set(out.roster.map((x) => x.id));
  out.active = (Array.isArray(r.active) ? r.active : []).filter((i): i is string => typeof i === 'string' && ids.has(i));
  out.stance = STANCES.includes(r.stance as Stance) ? (r.stance as Stance) : 'assist';
  out.seq = Math.max(0, Math.floor(Number(r.seq) || 0), out.roster.length);
  return out;
};

export class ShadowModule implements Module {
  private live = new Map<string, Live>();
  private residues = new Map<string, Residue>();
  private seq = 0;
  private t = 0;

  constructor(private room: GameRoom) {}

  install(reg: Registrar): void {
    reg.on<Record<string, never>>(MSG34.EXTRACT, 'cast', (p) => this.startExtract(p));
    reg.on<ShadowCmd>(MSG34.SHADOW_CMD, 'board', (p, m) => this.command(p, m));
  }

  // ───────────────────────── lifecycle ─────────────────────────

  async join(p: ServerPlayer): Promise<void> {
    let raw: unknown = null;
    try { raw = await runtime34().repo34.loadShadows(p.accountId); } catch (e) { console.error('loadShadows failed', e); }
    const L: Live = { p, data: clean(raw), units: new Map(), channel: null, focus: null, loaded: true, dirty: false, level: p.level };
    this.live.set(p.id, L);
    for (const id of L.data.active.slice(0, shadowSlots(p.level))) this.summon(L, id, true);
    this.sendRoster(L);
  }

  async leave(p: ServerPlayer): Promise<void> {
    const L = this.live.get(p.id);
    if (!L) return;
    await this.persist(L, true);
    this.clearUnits(L);
    this.live.delete(p.id);
  }

  async save(p: ServerPlayer): Promise<void> {
    const L = this.live.get(p.id);
    if (L) await this.persist(L, false);
  }

  private async persist(L: Live, force: boolean): Promise<void> {
    if (!L.loaded || (!L.dirty && !force)) return;
    L.dirty = false;
    L.data.active = [...L.units.keys()];
    try { await runtime34().repo34.saveShadows(L.p.accountId, L.data); } catch (e) { L.dirty = true; if (!String(e).includes('pool')) console.error('saveShadows failed', e); }
  }

  private clearUnits(L: Live): void {
    for (const u of L.units.values()) this.room.state.shadows.delete(u.st.id);
    L.units.clear();
  }

  async dispose(): Promise<void> {
    for (const L of this.live.values()) await this.persist(L, true).catch(() => {});
  }

  // ───────────────────────── residues & extraction ─────────────────────────

  killed(e: Enemy, killer: ServerPlayer | undefined): void {
    // shadows near the owner share the XP
    if (killer) {
      const L = this.live.get(killer.id);
      if (L) for (const u of L.units.values()) if (u.en.hp > 0 && Math.hypot(u.en.x - e.x, u.en.y - e.y) < 18) this.gainXp(L, u, shadowXpFrom(e.def.xp * (e.elite ? 2 : 1)));
    }
    if (!killer || killer.level < EXTRACT_LEVEL || !canExtract(e.def.kind) || !this.live.has(killer.id)) return;
    const id = `rs${++this.seq}`;
    const st = new SpellState();
    st.id = id; st.kind = SPELL.RESIDUE; st.x = e.x; st.y = e.y; st.hue = 6; st.owner = killer.id; st.dx = e.def.kind; st.dy = e.level; st.r = RESIDUE_SECS;
    this.room.state.spells.set(id, st);
    this.residues.set(id, { id, owner: killer.id, kind: e.def.kind, level: e.level, elite: e.elite !== 0, x: e.x, y: e.y, until: this.t + RESIDUE_SECS, st });
  }

  private nearestResidue(p: ServerPlayer): Residue | null {
    let best: Residue | null = null, bd = EXTRACT_RANGE;
    for (const r of this.residues.values()) {
      if (r.owner !== p.id) continue;
      const d = Math.hypot(r.x - p.sim.x, r.y - p.sim.y);
      if (d <= bd) { bd = d; best = r; }
    }
    return best;
  }

  private startExtract(p: ServerPlayer): void {
    const L = this.live.get(p.id);
    if (!L || L.channel || p.deadT > 0) return;
    if (p.level < EXTRACT_LEVEL) return this.ev(p, { kind: 'failed', reason: 'level' });
    const r = this.nearestResidue(p);
    if (!r) return this.ev(p, { kind: 'failed', reason: 'range' });
    if (L.data.roster.length >= ROSTER_MAX) return this.ev(p, { kind: 'failed', reason: 'full' });
    const chance = extractChance(p.level, r.level, { elite: r.elite, kind: r.kind });
    L.channel = { res: r, until: this.t + EXTRACT_SECS, x: p.sim.x, y: p.sim.y, chance };
    this.ev(p, { kind: 'channel', chance, secs: EXTRACT_SECS, name: ENEMY_BY_KIND[r.kind]!.name });
  }

  private finishExtract(L: Live): void {
    const c = L.channel!;
    L.channel = null;
    const p = L.p;
    if (!this.residues.has(c.res.id)) return this.ev(p, { kind: 'failed', reason: 'gone' });
    this.removeResidue(c.res);
    if (this.room.rand() >= c.chance) {
      this.room.fx({ kind: 'shadow', x: c.res.x, y: c.res.y, v: 4, id: p.id });
      return this.ev(p, { kind: 'failed', reason: 'roll' });
    }
    const rec = newShadow(`s${p.id.slice(0, 4)}${Date.now().toString(36)}${++L.data.seq}`, c.res.kind, c.res.level);
    L.data.roster.push(rec);
    L.dirty = true;
    this.room.fx({ kind: 'shadow', x: c.res.x, y: c.res.y, v: 0, id: p.id });
    this.ev(p, { kind: 'extracted', rec });
    if (L.units.size < shadowSlots(p.level)) this.summon(L, rec.id, false);
    this.sendRoster(L);
  }

  private removeResidue(r: Residue): void { this.residues.delete(r.id); this.room.state.spells.delete(r.id); }

  // ───────────────────────── roster commands ─────────────────────────

  private command(p: ServerPlayer, m: ShadowCmd): void {
    const L = this.live.get(p.id);
    if (!L || p.deadT > 0) return;
    switch (m.act) {
      case 'summon': if (typeof m.id === 'string') this.summon(L, m.id, false); break;
      case 'dismiss': { if (typeof m.id === 'string') this.dismiss(L, m.id); break; }
      case 'dismiss_all': for (const id of [...L.units.keys()]) this.dismiss(L, id); break;
      case 'stance': if (STANCES.includes(m.stance)) { L.data.stance = m.stance; L.dirty = true; } break;
      case 'focus': L.focus = typeof m.target === 'string' && m.target.length <= 32 ? m.target : null; return;
      case 'rename': {
        const rec = L.data.roster.find((r) => r.id === m.id);
        const name = typeof m.name === 'string' ? m.name.replace(/[^\p{L}\p{N} _'-]/gu, '').trim().slice(0, 20) : '';
        if (rec && name) { rec.name = name; const u = L.units.get(rec.id); if (u) u.st.name = name; L.dirty = true; }
        break;
      }
      case 'release': {
        const i = L.data.roster.findIndex((r) => r.id === m.id);
        if (i >= 0) { this.dismiss(L, m.id); L.data.roster.splice(i, 1); L.dirty = true; }
        break;
      }
    }
    this.sendRoster(L);
  }

  private summon(L: Live, id: string, quiet: boolean): void {
    const rec = L.data.roster.find((r) => r.id === id);
    if (!rec || L.units.has(id) || L.units.size >= shadowSlots(L.p.level)) return;
    const name = KIND_NAME.get(rec.kind);
    if (!name) return;
    const p = L.p;
    const a = this.room.rand() * Math.PI * 2;
    const x = p.sim.x + Math.cos(a) * 1.5, y = p.sim.y + Math.sin(a) * 1.5;
    const en = createEnemy(name, this.room.store.solidAt(Math.floor(x), Math.floor(y)) ? p.sim.x : x, this.room.store.solidAt(Math.floor(x), Math.floor(y)) ? p.sim.y : y, false);
    en.provoked = true;
    this.applyStats(en, rec);
    const st = new ShadowState();
    st.id = `sh_${id}`; st.owner = p.id; st.name = rec.name; st.kind = rec.kind;
    const u: Unit = { rec, en, st, downUntil: 0, chargeHits: new Set() };
    this.sync(u);
    L.units.set(id, u);
    this.room.state.shadows.set(st.id, st);
    L.dirty = true;
    if (!quiet) this.room.fx({ kind: 'shadow', x: en.x, y: en.y, v: 1, id: p.id });
  }

  private dismiss(L: Live, id: string): void {
    const u = L.units.get(id);
    if (!u) return;
    this.room.state.shadows.delete(u.st.id);
    L.units.delete(id);
    L.dirty = true;
    this.room.fx({ kind: 'shadow', x: u.en.x, y: u.en.y, v: 3, id: L.p.id });
  }

  private applyStats(en: Enemy, rec: ShadowRec, keepHpRatio = 1): void {
    const s = shadowStats(rec.kind, rec.level);
    en.maxHp = s.hp; en.hp = Math.max(1, Math.round(s.hp * keepHpRatio));
    en.dmgMult = s.dmg; en.speedMult = s.speed; en.night = false; en.windMult = 0.9;
  }

  private gainXp(L: Live, u: Unit, xp: number): void {
    const r = addShadowXp(u.rec, xp, L.p.level);
    L.dirty = true;
    if (r.levels) {
      this.applyStats(u.en, u.rec, u.en.hp / u.en.maxHp);
      this.ev(L.p, { kind: 'level', id: u.rec.id, level: u.rec.level });
    }
    if (r.evolved) {
      this.ev(L.p, { kind: 'evolved', id: u.rec.id, rank: rankOf(u.rec.level), name: u.rec.name });
      this.room.fx({ kind: 'shadow', x: u.en.x, y: u.en.y, v: 2, id: L.p.id });
    }
    if (r.levels) this.sendRoster(L);
  }

  // ───────────────────────── simulation ─────────────────────────

  tick(_now: number, dt: number): void {
    this.t += dt;
    for (const r of [...this.residues.values()]) if (r.until <= this.t || !this.live.has(r.owner)) this.removeResidue(r);
    const tick = this.room.state.tick;
    for (const L of this.live.values()) {
      const p = L.p;
      if (L.channel) {
        if (p.deadT > 0 || Math.hypot(p.sim.x - L.channel.x, p.sim.y - L.channel.y) > 0.9) { L.channel = null; this.ev(p, { kind: 'failed', reason: 'moved' }); }
        else if (this.t >= L.channel.until) this.finishExtract(L);
      }
      if (p.level !== L.level) { L.level = p.level; this.sendRoster(L); }
      if (p.deadT > 0) continue;
      // too many for the player's level (they were summoned at a higher level, or the roster changed): send the extras home
      while (L.units.size > shadowSlots(p.level)) this.dismiss(L, [...L.units.keys()].pop()!);
      let i = 0;
      for (const u of L.units.values()) this.stepUnit(L, u, i++, dt, tick);
    }
  }

  private hostiles(): Enemy[] {
    const out: Enemy[] = [];
    for (const e of this.room.enemies.values()) if (e.hp > 0 && !e.def.passive && (!e.def.neutral || e.provoked)) out.push(e);
    return out;
  }

  private stepUnit(L: Live, u: Unit, index: number, dt: number, tick: number): void {
    const p = L.p, en = u.en, solid = this.room.store.solidAt;
    if (u.downUntil) {
      if (this.t >= u.downUntil) {
        u.downUntil = 0;
        this.applyStats(en, u.rec, 0.6);
        en.x = p.sim.x; en.y = p.sim.y; en.mode = 'idle'; en.cd = 0.5;
        this.ev(p, { kind: 'reformed', id: u.rec.id });
        this.room.fx({ kind: 'shadow', x: en.x, y: en.y, v: 1, id: p.id });
      } else { u.st.st = 6; return; }
    }
    // out-of-combat regeneration
    if (en.hp < en.maxHp && en.mode === 'idle') en.hp = Math.min(en.maxHp, en.hp + en.maxHp * 0.04 * dt);
    const dOwner = Math.hypot(p.sim.x - en.x, p.sim.y - en.y);
    if (dOwner > TELEPORT_DIST) { en.x = p.sim.x + 1; en.y = p.sim.y; en.mode = 'idle'; this.room.fx({ kind: 'shadow', x: en.x, y: en.y, v: 1, id: p.id }); }

    // what to fight: the owner's focus target first, then by stance
    const reach = L.data.stance === 'guard' ? 5 : L.data.stance === 'aggressive' ? 15 : 9;
    const hostile = this.hostiles();
    const focus = L.focus ? hostile.find((h) => h.id === L.focus && Math.hypot(h.x - p.sim.x, h.y - p.sim.y) < 22) : undefined;
    const targets: Target[] = [];
    if (focus) targets.push({ id: focus.id, x: focus.x, y: focus.y, alive: true });
    else for (const h of hostile) {
      if (Math.hypot(h.x - p.sim.x, h.y - p.sim.y) <= reach + 3 || (L.data.stance === 'aggressive' && Math.hypot(h.x - en.x, h.y - en.y) <= reach)) targets.push({ id: h.id, x: h.x, y: h.y, alive: true });
    }
    const committed = en.mode === 'windup' || en.mode === 'leap' || en.mode === 'charge';
    if (!targets.length && !committed) {
      // follow: hold a loose formation around the owner
      const ang = (index / Math.max(1, L.units.size)) * Math.PI * 2 + 0.6;
      const gx = p.sim.x + Math.cos(ang) * 2.2, gy = p.sim.y + Math.sin(ang) * 2.2;
      const dx = gx - en.x, dy = gy - en.y, d = Math.hypot(dx, dy);
      en.mode = 'idle'; en.atk = 0; en.state.tele = 0;
      if (d > 0.7) {
        const sp = en.def.speed * en.speedMult * (d > 6 ? 1.8 : 1.1);
        const step = Math.min(d, sp * dt);
        const nx = en.x + (dx / d) * step, ny = en.y + (dy / d) * step;
        if (!solid(Math.floor(nx), Math.floor(ny))) { en.x = nx; en.y = ny; }
        else if (!solid(Math.floor(nx), Math.floor(en.y))) en.x = nx;
        else if (!solid(Math.floor(en.x), Math.floor(ny))) en.y = ny;
        en.state.faceX = dx / d; en.state.faceY = dy / d;
        en.state.st = 1;
      } else en.state.st = 0;
      this.sync(u, en.state.st);
      return;
    }
    stepEnemy(en, dt, tick, targets, solid, this.room.rand, this.hooks(L, u), { allies: [], engaged: new Map(), casting: new Map() });
    this.sync(u);
  }

  private sync(u: Unit, forceSt?: number): void {
    const en = u.en, s = u.st;
    s.x = en.x; s.y = en.y; s.faceX = en.state.faceX; s.faceY = en.state.faceY;
    s.hp = Math.max(0, Math.round(en.hp)); s.maxHp = Math.round(en.maxHp);
    s.rank = rankOf(u.rec.level); s.level = u.rec.level; s.name = u.rec.name;
    s.st = u.downUntil ? 6 : (forceSt ?? en.state.st); s.tele = en.state.tele; s.atk = en.state.atk; s.tx = en.state.tx; s.ty = en.state.ty;
  }

  /** Strike hooks for a shadow: damage lands on hostile enemies (credited to the owner, so XP and drops are theirs). */
  private hooks(L: Live, u: Unit) {
    const owner = L.p, en = u.en;
    const hit = (e: Enemy, dmg: number, kb: number) => {
      const dx = e.x - en.x, dy = e.y - en.y, d = Math.hypot(dx, dy) || 1;
      this.room.hitEnemy(e, dmg, owner, dx / d, dy / d, kb);
      if (e.hp > 0 && e.def.neutral) e.provoked = true;
    };
    return {
      telegraph: () => {},
      strike: (_en: Enemy, x: number, y: number, r: number, mult = 1) => {
        const dmg = enemyDamage(en, mult);
        for (const e of this.hostiles()) if (Math.hypot(e.x - x, e.y - y) <= r + e.def.radius) hit(e, dmg, mult > 1 ? 7 : 4);
      },
      lane: (_en: Enemy, ax: number, ay: number, bx: number, by: number, w: number) => {
        const shape: StrikeShape = { kind: 'lane', ax, ay, bx, by, w };
        for (const e of this.hostiles()) if (!u.chargeHits.has(e.id) && shapeHits(shape, { x: e.x, y: e.y, r: e.def.radius })) { u.chargeHits.add(e.id); hit(e, enemyDamage(en, 1.4), 9); }
        if (en.mode !== 'charge') u.chargeHits.clear();
      },
      fire: (_en: Enemy, dx: number, dy: number) => {
        // a shadow's bolt is hitscan: the first hostile along the ray within range
        let best: Enemy | null = null, bd = 10;
        for (const e of this.hostiles()) {
          const t = (e.x - en.x) * dx + (e.y - en.y) * dy;
          if (t < 0 || t > bd) continue;
          if (Math.hypot(en.x + dx * t - e.x, en.y + dy * t - e.y) <= e.def.radius + 0.35) { bd = t; best = e; }
        }
        if (best) hit(best, enemyDamage(en), 3);
      },
    };
  }

  // ───────────────────────── enemies attacking shadows ─────────────────────────

  targets(): Target[] {
    const out: Target[] = [];
    for (const L of this.live.values()) for (const u of L.units.values()) if (!u.downUntil && u.en.hp > 0) out.push({ id: u.st.id, x: u.en.x, y: u.en.y, alive: true });
    return out;
  }

  /** An enemy strike landed in `shape`: any shadow inside takes it. */
  strikeShadows(e: Enemy, shape: StrikeShape, dmg: number): void {
    for (const L of this.live.values()) for (const u of L.units.values()) {
      if (u.downUntil || u.en.hp <= 0 || !shapeHits(shape, { x: u.en.x, y: u.en.y, r: 0.4 })) continue;
      u.en.hp -= Math.max(1, Math.round(dmg * 0.75));
      u.en.flinchT = 0.1;
      if (u.en.hp <= 0) {
        u.en.hp = 0; u.downUntil = this.t + SHADOW_REFORM_SECS; u.en.mode = 'idle'; u.en.atk = 0; u.en.state.tele = 0;
        this.ev(L.p, { kind: 'fallen', id: u.rec.id, name: u.rec.name });
      }
      this.sync(u);
    }
  }

  viewEntities(push: (id: string, x: number, y: number, st: Schema) => void): void {
    this.room.state.shadows.forEach((s, id) => push(`sh:${id}`, s.x, s.y, s));
  }

  // ───────────────────────── messages ─────────────────────────

  private ev(p: ServerPlayer, m: ShadowEvent): void { p.client.send(MSG34.SHADOW_EV, m); }

  private sendRoster(L: Live): void {
    const m: ShadowRosterMsg = { roster: L.data.roster, active: [...L.units.keys()], slots: shadowSlots(L.p.level), stance: L.data.stance, unlock: EXTRACT_LEVEL };
    L.p.client.send(MSG34.SHADOW_ROSTER, m);
  }

  // ───────────────────────── queries (tests, other modules) ─────────────────────────

  stateOf(sid: string): Live | undefined { return this.live.get(sid); }
  residueCount(): number { return this.residues.size; }
  rankLabel(rec: ShadowRec): string { return rankName(rec.level); }
}
