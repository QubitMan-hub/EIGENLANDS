/**
 * Phase 3 server: Circuit Board progression and class abilities.
 * Progress lives in `character_progress` (validated on load), the board is attuned and evaluated with the shared
 * simulator, casts are sampled from the attuned joint distribution and executed by the AbilityEngine.
 * See docs/phase3-4-design.md ("Phase 3").
 */
import {
  ABILITIES, ACTIVE_LINES, ATTUNE_COOLDOWN_MS, CLASSES, GATES, GATE_IDS, LINK_POWER, LOCK_POWER, LOCK_POWER_COLLAPSE,
  MSG34, MULTICLASS_LEVEL, PLAYABLE_CLASSES, RESOURCE_MAX, RUNE_PRICE, SPEC_LEVEL, TUTORIAL, TUTORIAL_DONE,
  TUTORIAL_REWARD, attuneLocks, castLines, checkBoard, evaluate, isClassId, isCodexId, lineErrors, placedGates,
  qubitsForLevel, rewardsForLevel, validBoard,
  type AbilityId, type AttuneMsg, type CastLineResult, type CastMsg, type CastResultMsg, type ChooseMsg, type ClassId,
  type Evaluation, type GateId, type ProgressMsg, type ResourceMsg, type TutorialGoal, type TutorialMsg, type UltMsg,
} from '@eigenlands/shared';
import type { Schema } from '@colyseus/schema';
import type { Enemy } from '../../game/enemies';
import type { GameRoom } from '../../rooms/GameRoom';
import type { ServerPlayer } from '../../rooms/player';
import { runtime } from '../../rooms/runtime';
import { runtime34 } from '../runtime34';
import type { Carry, CircuitApi, Module, Registrar } from '../types';
import { AbilityEngine, type Kit } from './engine';
import {
  MAX_GATE_TOKENS, MAX_RUNES, placeAbilities, rulesFor, serializeProgress, validProgress, type Progress,
} from './progress';

export { AbilityEngine } from './engine';
export * from './progress';

/** Superposer Coherence and Entangler Bond. */
export const RES_SPLIT_CAST = 12;
export const RES_HIT = 4;
export const RES_DECAY = 3;
export const RES_IDLE_MS = 4000;
/** RES messages are throttled to at most 4 per second. */
export const RES_SEND_MS = 250;
/** a line counts as "split" for Coherence when both forms are genuinely possible */
const SPLIT_MIN = 0.02;

export const DEV_MSG = 'p3_dev';
export type DevMsg34 =
  | { cmd: 'gates' }
  | { cmd: 'class'; cls: ClassId }
  | { cmd: 'tutorial'; step: number }
  | { cmd: 'res'; v: number };

/** Live per-player Circuit state. */
export interface CircuitState {
  p: ServerPlayer;
  pr: Progress;
  /** unlocked orbs */
  n: number;
  /** cached evaluation of the attuned board and each line's slip chance */
  ev: Evaluation;
  errors: number[];
  /** ability id (or 'ult') -> epoch ms when ready */
  cd: Map<AbilityId | 'ult', number>;
  attuneReady: number;
  res: number;
  resSent: number;
  resSentAt: number;
  lastCombat: number;
  /** Paradox: the next Swap after a Tether ignores and skips its cooldown */
  freeSwap: boolean;
  /** last JSON written to the database ('' = must be written) */
  saved: string;
  /** the stored progress could not be read: never overwrite it */
  noSave: boolean;
}

/** In-flight progress writes per account (process-wide), so a quick re-join always reads the latest save. */
const pending = new Map<string, Promise<void>>();

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const lineGates = (s: CircuitState, q: number): GateId[] => s.pr.board.lines[q]!.filter((c) => !!c).map((c) => c!.g);

/** Circuit Board progression + abilities (Phase 3). */
export class CircuitModule implements Module, CircuitApi {
  readonly engine: AbilityEngine;
  private states = new Map<string, CircuitState>();
  private secT = 0;

  constructor(readonly room: GameRoom) {
    this.engine = new AbilityEngine(room, {
      kit: (sid) => this.kit(sid),
      onHit: (p) => this.onHit(p),
      onEchoed: (p, amount) => this.onEchoed(p, amount),
      onKill: (p) => this.onKill(p),
      onTether: (p) => { const s = this.states.get(p.id); if (s && s.pr.cls === 'entangler' && s.pr.spec === 'paradox') s.freeSwap = true; },
      onHurt: (p) => { const s = this.states.get(p.id); if (s) s.lastCombat = Date.now(); },
    });
  }

  install(reg: Registrar): void {
    reg.on<AttuneMsg>(MSG34.ATTUNE, 'board', (p, m) => this.onAttune(p, m));
    reg.on<CastMsg>(MSG34.CAST, 'cast', (p, m) => this.onCast(p, m));
    reg.on<UltMsg>(MSG34.ULT, 'cast', (p, m) => this.onUlt(p, m));
    reg.on<ChooseMsg>(MSG34.CHOOSE, 'board', (p, m) => this.onChoose(p, m));
    reg.on<Record<string, never>>(MSG34.BUY_RUNE, 'board', (p) => this.onBuyRune(p));
    reg.on<TutorialMsg>(MSG34.TUTORIAL, 'board', (p, m) => this.onTutorial(p, m));
    if (runtime().config.devCommands) reg.on<DevMsg34>(DEV_MSG, 'cast', (p, m) => this.onDev(p, m));
  }

  // ───────────────────────── API ─────────────────────────

  classOf(sid: string): ClassId { return this.states.get(sid)?.pr.cls ?? 'wanderer'; }
  /** Live state of a connected player (tests, tools). */
  stateOf(sid: string): CircuitState | undefined { return this.states.get(sid); }

  private kit(sid: string): Kit | null {
    const s = this.states.get(sid);
    return s ? { cls: s.pr.cls, second: s.pr.second, spec: s.pr.spec } : null;
  }

  // ───────────────────────── lifecycle ─────────────────────────

  async join(p: ServerPlayer, carry: Carry | null): Promise<void> {
    await pending.get(p.accountId);
    let raw: unknown = null, failed = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      try { raw = await runtime34().repo34.loadProgress(p.accountId); failed = false; break; } catch (e) {
        failed = true;
        if (attempt === 1) console.error('loadProgress failed', e);
      }
    }
    if (this.room.players.get(p.id) !== p) return; // left while loading
    const { pr, reroll } = validProgress(failed ? null : raw, p.level);
    const n = qubitsForLevel(p.level, pr.qubitBonus);
    if (reroll) pr.locks = attuneLocks(pr.board, n, () => this.room.rand());
    const s: CircuitState = {
      p, pr, n, ev: evaluate(pr.board, n, pr.locks), errors: lineErrors(pr.board, n), cd: new Map(), attuneReady: 0,
      res: 0, resSent: -1, resSentAt: 0, lastCombat: 0, freeSwap: false, saved: '', noSave: failed,
    };
    if (raw !== null && !failed && !reroll) s.saved = JSON.stringify(serializeProgress(pr));
    const now = Date.now();
    if (carry?.cd) {
      for (const [k, ms] of Object.entries(carry.cd)) if (k === 'ult' || k in ABILITIES) s.cd.set(k as AbilityId | 'ult', now + ms);
    }
    if (pr.cls !== 'wanderer' && typeof carry?.res === 'number') s.res = Math.max(0, Math.min(RESOURCE_MAX, carry.res));
    this.states.set(p.id, s);
    // a story step whose gifts were never handed out (stored mid-step) gets them now
    if (pr.tutorial.step < TUTORIAL_DONE) this.grantStep(s, pr.tutorial.step);
    this.sendProgress(s, 'all');
    this.sendRes(s, true);
    this.levelRewards(s);
    if (failed) p.toast('Your Circuit Board could not be loaded. Changes made now will not be saved.', 'bad');
  }

  async leave(p: ServerPlayer): Promise<void> {
    const s = this.states.get(p.id);
    if (!s || s.p !== p) return;
    this.states.delete(p.id);
    this.engine.removePlayer(p.id);
    await this.persist(s);
  }

  async save(p: ServerPlayer): Promise<void> {
    const s = this.states.get(p.id);
    if (s && s.p === p) await this.persist(s);
  }

  /** Write progress if it changed; writes per account are chained so they never land out of order. */
  private persist(s: CircuitState): Promise<void> {
    if (s.noSave) return Promise.resolve();
    const data = serializeProgress(s.pr);
    const json = JSON.stringify(data);
    const acc = s.p.accountId;
    if (json === s.saved) return pending.get(acc) ?? Promise.resolve();
    s.saved = json;
    const prev = pending.get(acc) ?? Promise.resolve();
    const write = prev.then(() => runtime34().repo34.saveProgress(acc, data)).catch((e) => {
      if (s.saved === json) s.saved = ''; // try again on the next save
      throw e;
    });
    const tracked: Promise<void> = write.then(() => {}, () => {}).finally(() => { if (pending.get(acc) === tracked) pending.delete(acc); });
    pending.set(acc, tracked);
    return write;
  }

  carry(p: ServerPlayer, into: Carry): void {
    const s = this.states.get(p.id);
    if (!s) return;
    const now = Date.now();
    const cd: Record<string, number> = {};
    for (const [k, t] of s.cd) if (t > now) cd[k] = t - now;
    into.cd = { ...(into.cd ?? {}), ...cd };
    into.res = s.res;
  }

  async dispose(): Promise<void> { this.engine.clear(); }

  // ───────────────────────── hooks ─────────────────────────

  tick(_now: number, dt: number): void {
    this.engine.tick(dt);
    const now = Date.now();
    this.secT += dt;
    const second = this.secT >= 1;
    if (second) this.secT -= 1;
    for (const s of this.states.values()) {
      if (s.pr.cls !== 'wanderer' && s.res > 0 && now - s.lastCombat > RES_IDLE_MS) s.res = Math.max(0, s.res - RES_DECAY * dt);
      this.sendRes(s, false);
      if (second) this.levelRewards(s);
    }
  }

  incomingDamage(p: ServerPlayer, dmg: number, e: Enemy): number {
    if (!this.states.has(p.id)) return dmg;
    return this.engine.incoming(p, dmg, e);
  }

  killed(e: Enemy): void { this.engine.killed(e); }

  viewEntities(push: (id: string, x: number, y: number, st: Schema) => void): void { this.engine.view(push); }

  // ───────────────────────── messages ─────────────────────────

  private onAttune(p: ServerPlayer, m: AttuneMsg): void {
    const s = this.states.get(p.id);
    if (!s || !m.board || typeof m.board !== 'object') return;
    const now = Date.now();
    if (now < s.attuneReady) { p.toast('Your Board is still settling. Try again in a moment.', 'bad'); return; }
    const board = validBoard(m.board);
    const err = checkBoard(board, rulesFor(s.pr, p.level));
    if (err) { p.toast(err, 'bad'); return; }
    s.pr.board = board;
    s.pr.locks = attuneLocks(board, s.n, () => this.room.rand());
    this.recompute(s);
    s.attuneReady = now + ATTUNE_COOLDOWN_MS;
    // the Qubitpedia opens up as concepts are used
    const used = placedGates(board);
    const codex = ['qubit', ...GATE_IDS.filter((g) => used[g] > 0).map((g) => GATES[g].codex)];
    if (board.runes.some((r) => r > 0)) codex.push('correction');
    const keys: Array<keyof ProgressMsg> = ['board', 'locks', 'attuneReady'];
    if (this.unlock(s, codex)) keys.push('codex');
    this.sendProgress(s, keys);
    const goal = this.goal(s);
    if (goal?.kind === 'lock' && used.m > 0) this.advance(s);
  }

  private onCast(p: ServerPlayer, m: CastMsg): void {
    const s = this.states.get(p.id);
    if (!s) return;
    const line = m.line;
    const fail = (error: string) => this.reply(p, { ok: false, error, line: Number.isInteger(line) ? line : -1, results: [], cd: this.cdMsg(s) });
    if (!Number.isInteger(line) || line < 0 || line >= ACTIVE_LINES) return fail('There is no such orb.');
    if (line >= s.n) return fail('That orb has not woken up yet.');
    const ability = s.pr.board.abilities[line];
    if (!ability) return fail('No ability on that orb.');
    if (p.deadT > 0) return fail('You are down.');
    const now = Date.now();
    const free = ability === 'swap' && s.freeSwap && s.pr.cls === 'entangler' && s.pr.spec === 'paradox';
    if ((s.cd.get(ability) ?? 0) > now && !free) return fail('Not ready yet.');

    const [ax, ay] = this.aim(p, m.aimX, m.aimY);
    const lockPow = s.pr.cls === 'superposer' && s.pr.spec === 'collapse' ? LOCK_POWER_COLLAPSE : LOCK_POWER;
    const lines = castLines(s.pr.board, s.ev, line, s.errors, () => this.room.rand());
    const results: CastLineResult[] = [];
    if (free) s.freeSwap = false; // spent before executing, so a Tether in the same cast re-arms it
    else s.cd.set(ability, now + ABILITIES[ability].cd * 1000);
    s.lastCombat = now;
    for (const l of lines) {
      const a = s.pr.board.abilities[l.q] ?? null;
      results.push({ q: l.q, ability: a, bit: l.bit, hue: l.hue, misfire: l.misfire, link: l.link, locked: l.locked });
      if (!a || !this.room.players.has(p.id)) continue;
      const power = (l.link ? LINK_POWER : 1) * (l.locked ? 1 + lockPow : 1);
      this.engine.execute({ caster: p, ability: a, bit: l.bit, hue: l.hue, power, aimX: ax, aimY: ay });
    }
    if (s.pr.cls === 'superposer') {
      const p1 = s.ev.p1[line] ?? 0;
      if (p1 > SPLIT_MIN && p1 < 1 - SPLIT_MIN) this.addRes(s, RES_SPLIT_CAST);
    }
    this.reply(p, { ok: true, line, results, cd: this.cdMsg(s) });

    const goal = this.goal(s);
    if (goal?.kind === 'casts' && line === 0) {
      const g = lineGates(s, 0);
      if (g.length === goal.pattern.length && g.every((x, i) => x === goal.pattern[i])) this.progressCount(s, goal.n);
    } else if (goal?.kind === 'link_cast' && lines.length >= 2) this.advance(s);
  }

  private onUlt(p: ServerPlayer, m: UltMsg): void {
    const s = this.states.get(p.id);
    if (!s) return;
    const fail = (error: string) => this.reply(p, { ok: false, error, line: -1, ult: true, results: [], cd: this.cdMsg(s) });
    const cls = s.pr.cls;
    if (cls === 'wanderer') return fail('Choose a class to unlock an ultimate.');
    if (p.deadT > 0) return fail('You are down.');
    const now = Date.now();
    if ((s.cd.get('ult') ?? 0) > now) return fail('Not ready yet.');
    if (s.res < RESOURCE_MAX - 1e-6) return fail(`${CLASSES[cls].resource.name} is not full yet.`);
    const [ax, ay] = this.aim(p, m.aimX, m.aimY);
    const secs = CLASSES[cls].ultimate.secs;
    if (cls === 'superposer') this.engine.manyWorlds(p, secs, ax, ay);
    else this.engine.bellState(p, secs);
    s.res = 0;
    s.lastCombat = now;
    s.cd.set('ult', now + secs * 1000);
    this.reply(p, { ok: true, line: -1, ult: true, results: [], cd: this.cdMsg(s) });
    this.sendRes(s, true);
  }

  private onChoose(p: ServerPlayer, m: ChooseMsg): void {
    const s = this.states.get(p.id);
    if (!s) return;
    const pr = s.pr;
    if (m.what === 'class') {
      if (!isClassId(m.cls) || !PLAYABLE_CLASSES.includes(m.cls)) return;
      const viaTutorial = this.goal(s)?.kind === 'choose_class';
      if (pr.cls !== 'wanderer' && !viaTutorial) { p.toast('Your path is already chosen.', 'bad'); return; }
      if (m.cls === pr.second) { p.toast('That is already your second class.', 'bad'); return; }
      this.setClass(s, m.cls);
      p.toast(`You are now a ${CLASSES[m.cls].name}.`, 'good');
      this.sendProgress(s, ['cls', 'spec', 'second', 'board', 'locks', 'qubits']);
      if (viaTutorial) this.advance(s);
    } else if (m.what === 'spec') {
      if (pr.cls === 'wanderer') { p.toast('Choose a class first.', 'bad'); return; }
      if (p.level < SPEC_LEVEL) { p.toast(`Specializations open at level ${SPEC_LEVEL}.`, 'bad'); return; }
      if (pr.spec) { p.toast('You have already specialized.', 'bad'); return; }
      const spec = CLASSES[pr.cls].specs.find((x) => x.id === m.spec);
      if (!spec) return;
      pr.spec = spec.id;
      p.toast(`Specialization: ${spec.name}.`, 'good');
      this.sendProgress(s, ['spec']);
    } else if (m.what === 'second') {
      if (!isClassId(m.cls) || !PLAYABLE_CLASSES.includes(m.cls)) return;
      if (pr.cls === 'wanderer') { p.toast('Choose a class first.', 'bad'); return; }
      if (p.level < MULTICLASS_LEVEL) { p.toast(`A second class opens at level ${MULTICLASS_LEVEL}.`, 'bad'); return; }
      if (pr.second) { p.toast('You already have a second class.', 'bad'); return; }
      if (m.cls === pr.cls) { p.toast('Pick a different class for your second path.', 'bad'); return; }
      pr.second = m.cls;
      placeAbilities(pr, s.n);
      this.recompute(s);
      p.toast(`Second class: ${CLASSES[m.cls].name}. Its abilities can now go on your orbs.`, 'good');
      this.sendProgress(s, ['second', 'board']);
    }
  }

  private setClass(s: CircuitState, cls: ClassId): void {
    const pr = s.pr;
    if (pr.cls !== cls) { pr.spec = null; s.res = 0; s.freeSwap = false; }
    pr.cls = cls;
    if (pr.second === cls || cls === 'wanderer') pr.second = null;
    placeAbilities(pr, s.n);
    this.recompute(s);
    this.sendRes(s, true);
  }

  private onBuyRune(p: ServerPlayer): void {
    const s = this.states.get(p.id);
    if (!s) return;
    if (s.pr.runes >= MAX_RUNES) { p.toast('You already hold every rune your Board can use.', 'bad'); return; }
    if (p.data.coins < RUNE_PRICE) { p.toast(`An Error Correction rune costs ${RUNE_PRICE} coins.`, 'bad'); return; }
    p.data.coins -= RUNE_PRICE;
    p.dirty('coins');
    s.pr.runes++;
    p.toast('You bought an Error Correction rune.', 'good');
    this.sendProgress(s, ['runes']);
  }

  private onTutorial(p: ServerPlayer, m: TutorialMsg): void {
    const s = this.states.get(p.id);
    if (!s) return;
    const t = s.pr.tutorial;
    if (m.action === 'board_open') {
      if (this.goal(s)?.kind === 'open_board') this.advance(s);
    } else if (m.action === 'skip') {
      if (t.step >= TUTORIAL_DONE) return;
      this.grantStep(s, TUTORIAL.length - 1);
      t.step = TUTORIAL_DONE; t.count = 0; t.skipped = true;
      this.finishTutorial(s);
      p.toast(s.pr.cls === 'wanderer' ? 'Lumen will be around. Choose your class on the Board.' : 'Lumen will be around if you need her.', 'info');
      this.sendProgress(s, ['tutorial', 'gates', 'runes', 'qubits', 'board', 'locks']);
    } else if (m.action === 'restart') {
      t.step = 0; t.count = 0; t.skipped = false;
      this.sendProgress(s, ['tutorial']);
    }
  }

  private onDev(p: ServerPlayer, m: DevMsg34): void {
    const s = this.states.get(p.id);
    if (!s) return;
    switch (m.cmd) {
      case 'gates':
        for (const g of GATE_IDS) s.pr.gates[g] = Math.min(MAX_GATE_TOKENS, s.pr.gates[g] + 9);
        s.pr.runes = Math.min(MAX_RUNES, s.pr.runes + 6);
        this.sendProgress(s, ['gates', 'runes']);
        break;
      case 'class':
        if (!isClassId(m.cls)) return;
        this.setClass(s, m.cls);
        this.sendProgress(s, ['cls', 'spec', 'second', 'board', 'locks']);
        break;
      case 'tutorial': {
        if (!Number.isInteger(m.step) || m.step < 0 || m.step > TUTORIAL_DONE) return;
        s.pr.tutorial = { step: m.step, count: 0, skipped: false };
        this.grantStep(s, Math.min(m.step, TUTORIAL.length - 1));
        if (m.step >= TUTORIAL_DONE) this.finishTutorial(s);
        this.sendProgress(s, ['tutorial', 'gates', 'runes', 'qubits', 'codex', 'board', 'locks']);
        break;
      }
      case 'res': {
        const v = num(m.v);
        if (v === null) return;
        s.res = Math.max(0, Math.min(RESOURCE_MAX, v));
        s.lastCombat = Date.now();
        this.sendRes(s, true);
        break;
      }
    }
  }

  // ───────────────────────── tutorial ─────────────────────────

  private goal(s: CircuitState): TutorialGoal | null { return TUTORIAL[s.pr.tutorial.step]?.goal ?? null; }

  private progressCount(s: CircuitState, n: number): void {
    s.pr.tutorial.count++;
    if (s.pr.tutorial.count >= n) this.advance(s);
    else this.sendProgress(s, ['tutorial']);
  }

  /** Complete the current step: its codex entries, then the next step's gifts (or the final reward). */
  private advance(s: CircuitState): void {
    const t = s.pr.tutorial;
    const step = TUTORIAL[t.step];
    if (!step) return;
    this.unlock(s, step.codex ?? []);
    t.step++; t.count = 0;
    if (t.step < TUTORIAL_DONE) this.grantStep(s, t.step);
    else this.finishTutorial(s);
    this.sendProgress(s, ['tutorial', 'codex', 'gates', 'runes', 'qubits', 'board', 'locks']);
  }

  /** Hand out every story gift up to step `upTo` that was not handed out before. */
  private grantStep(s: CircuitState, upTo: number): void {
    const pr = s.pr;
    let qubitsChanged = false;
    for (let i = pr.tutGranted + 1; i <= upTo && i < TUTORIAL.length; i++) {
      const g = TUTORIAL[i]!.grant;
      for (const id of g?.gates ?? []) pr.gates[id] = Math.min(MAX_GATE_TOKENS, pr.gates[id] + 1);
      if (g?.qubitBonus && g.qubitBonus > pr.qubitBonus) { pr.qubitBonus = g.qubitBonus; qubitsChanged = true; }
      pr.tutGranted = i;
    }
    if (qubitsChanged) {
      this.recompute(s);
      // the new orb gets an ability straight away when the class has one to spare
      placeAbilities(pr, s.n);
      this.recompute(s);
    }
  }

  private finishTutorial(s: CircuitState): void {
    const pr = s.pr;
    if (pr.tutRewarded) return;
    pr.tutRewarded = true;
    for (const g of TUTORIAL_REWARD.gates) pr.gates[g] = Math.min(MAX_GATE_TOKENS, pr.gates[g] + 1);
    pr.runes = Math.min(MAX_RUNES, pr.runes + TUTORIAL_REWARD.runes);
    s.p.data.coins += TUTORIAL_REWARD.coins;
    s.p.dirty('coins');
    s.p.toast(`Lumen's gifts: ${TUTORIAL_REWARD.gates.map((g) => GATES[g].name).join(', ')}, a rune and ${TUTORIAL_REWARD.coins} coins.`, 'good');
  }

  // ───────────────────────── rewards and resource ─────────────────────────

  /** Grant gate and rune rewards for every level above `rewardedLevel`, and wake new orbs. */
  private levelRewards(s: CircuitState): void {
    const p = s.p, pr = s.pr;
    const keys: Array<keyof ProgressMsg> = [];
    if (p.level > pr.rewardedLevel) {
      const got: GateId[] = [];
      let runes = 0;
      for (let l = pr.rewardedLevel + 1; l <= p.level; l++) {
        const r = rewardsForLevel(l);
        got.push(...r.gates);
        runes += r.runes;
        if (l === SPEC_LEVEL && pr.cls !== 'wanderer' && !pr.spec) p.toast('You can now choose a specialization on your Board.', 'good');
        if (l === MULTICLASS_LEVEL && pr.cls !== 'wanderer' && !pr.second) p.toast('You can now take up a second class on your Board.', 'good');
      }
      pr.rewardedLevel = p.level;
      for (const g of got) pr.gates[g] = Math.min(MAX_GATE_TOKENS, pr.gates[g] + 1);
      pr.runes = Math.min(MAX_RUNES, pr.runes + runes);
      if (got.length) {
        const counts = new Map<GateId, number>();
        for (const g of got) counts.set(g, (counts.get(g) ?? 0) + 1);
        const names = [...counts].map(([g, c]) => (c > 1 ? `${GATES[g].name} ×${c}` : GATES[g].name));
        p.toast(got.length === 1 ? `New gate: ${names[0]}` : `New gates: ${names.join(', ')}`, 'good');
      }
      if (runes) p.toast(runes === 1 ? 'New Error Correction rune' : `${runes} new Error Correction runes`, 'good');
      keys.push('gates', 'runes');
    }
    const n = qubitsForLevel(p.level, pr.qubitBonus);
    if (n !== s.n) {
      if (n > s.n) p.toast(n - s.n === 1 ? 'A new orb awakens on your Board.' : `${n - s.n} new orbs awaken on your Board.`, 'good');
      this.recompute(s);
      keys.push('qubits');
    }
    if (keys.length) this.sendProgress(s, keys);
  }

  private onHit(p: ServerPlayer): void {
    const s = this.states.get(p.id);
    if (!s) return;
    s.lastCombat = Date.now();
    if (s.pr.cls === 'superposer') this.addRes(s, RES_HIT);
  }

  private onEchoed(p: ServerPlayer, amount: number): void {
    const s = this.states.get(p.id);
    if (!s) return;
    s.lastCombat = Date.now();
    if (s.pr.cls === 'entangler') this.addRes(s, amount / 2);
  }

  private onKill(p: ServerPlayer): void {
    const s = this.states.get(p.id);
    if (!s) return;
    const goal = this.goal(s);
    if (goal?.kind === 'kills') this.progressCount(s, goal.n);
  }

  private addRes(s: CircuitState, v: number): void { s.res = Math.max(0, Math.min(RESOURCE_MAX, s.res + v)); }

  private sendRes(s: CircuitState, force: boolean): void {
    const v = Math.round(s.res);
    const now = Date.now();
    if (v === s.resSent || (!force && now - s.resSentAt < RES_SEND_MS)) return;
    s.resSent = v; s.resSentAt = now;
    const m: ResourceMsg = { v, max: RESOURCE_MAX };
    s.p.client.send(MSG34.RES, m);
  }

  // ───────────────────────── helpers ─────────────────────────

  private recompute(s: CircuitState): void {
    s.n = qubitsForLevel(s.p.level, s.pr.qubitBonus);
    s.ev = evaluate(s.pr.board, s.n, s.pr.locks);
    s.errors = lineErrors(s.pr.board, s.n);
  }

  private unlock(s: CircuitState, ids: string[]): boolean {
    let changed = false;
    for (const id of ids) if (isCodexId(id) && !s.pr.codex.includes(id)) { s.pr.codex.push(id); changed = true; }
    return changed;
  }

  private aim(p: ServerPlayer, x: unknown, y: unknown): [number, number] {
    const ax = num(x) ?? 0, ay = num(y) ?? 0;
    const l = Math.hypot(ax, ay);
    if (l > 1e-6 && Number.isFinite(l)) return [ax / l, ay / l];
    const fl = Math.hypot(p.sim.faceX, p.sim.faceY) || 1;
    return [p.sim.faceX / fl, p.sim.faceY / fl];
  }

  private cdMsg(s: CircuitState): Partial<Record<AbilityId | 'ult', number>> {
    const now = Date.now();
    const out: Partial<Record<AbilityId | 'ult', number>> = {};
    for (const [k, t] of s.cd) if (t > now) out[k] = t;
    return out;
  }

  private reply(p: ServerPlayer, m: CastResultMsg): void { p.client.send(MSG34.CAST_R, m); }

  private sendProgress(s: CircuitState, keys: Array<keyof ProgressMsg> | 'all'): void {
    const pr = s.pr;
    const full: Required<ProgressMsg> = {
      cls: pr.cls, spec: pr.spec, second: pr.second, board: pr.board, locks: pr.locks, gates: pr.gates, runes: pr.runes,
      qubits: s.n, codex: pr.codex, tutorial: pr.tutorial, attuneReady: s.attuneReady, cd: this.cdMsg(s),
    };
    const m: ProgressMsg = keys === 'all' ? full : Object.fromEntries(keys.map((k) => [k, full[k]])) as ProgressMsg;
    s.p.client.send(MSG34.PROGRESS, m);
  }
}
