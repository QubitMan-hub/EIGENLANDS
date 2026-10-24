import './circuit.css';
import {
  ABILITIES, ACTIVE_LINES, CLASSES, ELEMENTS, GATES, GATE_IDS, MSG34, RESOURCE_MAX, SPEC_LEVEL, TUTORIAL, TUTORIAL_DONE, CODEX_BY_ID,
  boardPreview, type AbilityId, type CastResultMsg, type ChooseMsg, type Preview, type ProgressMsg, type ResourceMsg,
} from '@eigenlands/shared';
import { keyLabel } from '../../input/keymap';
import type { ClientModule, ExtAction, P34Deps } from '../types';
import { elCol } from './art';
import { AbilityBar, type BarSlotInfo } from './bar';
import { BoardView, type BoardTab } from './board';
import { FloatLabels } from './labels';
import { LumenDialog, LumenSprite } from './lumen';
import { abilityTargeting, fillPlaceholders, mergeReady } from './model';
import { Progress, type ProgressKey } from './state';
import { SpellRenderer, type SpellLike } from './spells';
import { castShout, formName, orbName } from './text';
import type { MockServer } from './mock';

const SEEN_KEY = 'eigen.lumen.seen';
const ABILITY_ACTIONS: Record<string, number> = { ability1: 0, ability2: 1, ability3: 2, ability4: 3 };

/** Circuit Board UI, ability bar, resource bar, Lumen tutorial, Qubitpedia, spell rendering (Phase 3). */
export class CircuitClient implements ClientModule {
  readonly progress = new Progress();
  private board: BoardView;
  private bar: AbilityBar;
  private spells: SpellRenderer;
  private labels: FloatLabels;
  private lumen: LumenSprite;
  private dialog: LumenDialog;
  private res: ResourceMsg = { v: 0, max: RESOURCE_MAX };
  /** predicted cooldown ends (server ms) per ability id / 'ult', until the server answers */
  private predicted: Record<string, number> = {};
  private attuned: Preview | null = null;
  private stateSpells: SpellLike[] = [];
  private mockSpells: SpellLike[] = [];
  private mock: MockServer | null = null;
  private lastSetup = 0;
  private specNagged = false;
  private sentLog: Array<{ type: string; msg: unknown; at: number }> = [];
  private lastCast: CastResultMsg | null = null;
  private touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  constructor(readonly d: P34Deps) {
    this.dialog = new LumenDialog(() => d.settings().reducedMotion);
    this.dialog.onSkip = () => this.skipStory();
    this.dialog.onIdle = () => this.afterDialog();
    this.board = new BoardView({
      progress: this.progress,
      level: () => d.level(),
      coins: () => d.profile.coins,
      now: () => this.now(),
      keyFor: (q) => this.keyName(`ability${q + 1}` as ExtAction),
      reduced: () => d.settings().reducedMotion,
      tip: d.tip,
      attune: (board) => this.send(MSG34.ATTUNE, { board }),
      buyRune: () => this.send(MSG34.BUY_RUNE, {}),
      choose: (m: ChooseMsg) => this.send(MSG34.CHOOSE, m),
      skipStory: () => this.skipStory(),
      blip: (s) => { try { d.audio.play(s); } catch { /* audio unavailable */ } },
      hint: () => this.stepHint(),
      tutorialActive: () => this.progress.tutorialActive,
      dock: (slot) => this.dialog.dock(slot),
    });
    this.bar = new AbilityBar({ cast: (q, direct) => { this.action(`ability${q + 1}` as ExtAction, direct); }, ult: (direct) => { this.action('ultimate', direct); }, board: () => this.toggleBoard() });
    d.input.onArmChange = a => this.bar.setArmed(a === 'ultimate' ? 4 : a ? ABILITY_ACTIONS[a] ?? null : null);
    this.spells = new SpellRenderer(d);
    this.labels = new FloatLabels(d);
    this.lumen = new LumenSprite(d);
    this.progress.onChange((c, prev) => this.onProgress(c, prev));
    // Lumen's lines: E / Enter / Space advance them (captured before the game sees the key)
    window.addEventListener('keydown', (e) => this.dialogKey(e), { capture: true });
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('p3mock')) void this.startMock();
  }

  // ───────────────────────── net ─────────────────────────

  private now(): number { return this.d.clock.ready ? this.d.clock.serverNow(performance.now()) : Date.now(); }

  /** Every outgoing Phase 3 message goes through here (the dev mock intercepts it; tests read `sentLog`). */
  send(type: string, msg: unknown): void {
    this.sentLog.push({ type, msg, at: performance.now() });
    if (this.sentLog.length > 60) this.sentLog.shift();
    if (this.mock) { const m = this.mock; queueMicrotask(() => m.handle(type, structuredClone(msg))); return; }
    try { this.d.net()?.send(type, msg); } catch { /* not connected yet */ }
  }

  handlers(): Record<string, (m: any) => void> {
    return {
      [MSG34.PROGRESS]: (m: ProgressMsg) => this.progress.apply(m),
      [MSG34.CAST_R]: (m: CastResultMsg) => this.onCastResult(m),
      [MSG34.RES]: (m: ResourceMsg) => { if (m && typeof m.v === 'number') this.res = { v: m.v, max: m.max || RESOURCE_MAX }; },
    };
  }

  private async startMock(): Promise<void> {
    const { MockServer } = await import('./mock');
    const h = this.handlers();
    this.mock = new MockServer({
      emit: (t, m) => h[t]?.(m),
      toast: (t) => this.d.toasts.add(t, 'bad'),
      now: () => this.now(),
      me: () => this.d.me(),
      myId: () => this.d.myId(),
      others: () => [...this.d.interp().ids()].filter((id) => id !== this.d.myId() && !!this.d.entityPos(id)),
    });
    let last = performance.now();
    window.setInterval(() => {
      const n = performance.now();
      this.mockSpells = this.mock!.tick(n - last);
      last = n;
      this.feedSpells();
    }, 50);
  }

  onState(s: any): void {
    const list: SpellLike[] = [];
    s?.spells?.forEach?.((v: SpellLike, id: string) => list.push({ id, kind: v.kind, x: v.x, y: v.y, hue: v.hue, owner: v.owner, target: v.target, r: v.r, dx: v.dx, dy: v.dy }));
    this.stateSpells = list;
    this.feedSpells(typeof s?.serverTime === 'number' ? s.serverTime : undefined);
  }

  private feedSpells(t?: number): void {
    this.spells.ingest(this.mockSpells.length ? [...this.stateSpells, ...this.mockSpells] : this.stateSpells, t ?? this.now());
  }

  // ───────────────────────── progress & tutorial ─────────────────────────

  private onProgress(c: Set<ProgressKey>, prev: Progress): void {
    const p = this.progress;
    const first = !prev.loaded;
    this.attuned = boardPreview(p.board, p.qubits, p.locks);
    this.board.onProgress(c as Set<string>);
    this.lastSetup = 0;
    if (c.has('cd')) this.predicted = {};
    if (!first) {
      if (c.has('gates')) for (const g of GATE_IDS) {
        const n = (p.gates[g] ?? 0) - (prev.gates[g] ?? 0);
        if (n > 0) this.d.toasts.add(`New gate${n > 1 ? `s` : ''}: ${GATES[g].name}${n > 1 ? ` ×${n}` : ''}`, 'good');
      }
      if (c.has('runes') && p.runes > prev.runes) this.d.toasts.add('An Error Correction rune joins your collection.', 'good');
      if (c.has('qubits') && p.qubits > prev.qubits) this.d.toasts.add(`A new orb wakes up: ${orbName(p.qubits - 1)}.`, 'good');
      if (c.has('codex')) for (const id of p.codex) if (!prev.codex.includes(id)) this.d.toasts.add(`Qubitpedia: “${CODEX_BY_ID[id]?.title ?? id}” discovered.`, 'good');
      if (c.has('cls') && p.cls !== prev.cls) this.d.sfx('levelup'); // the server announces the class itself
    }
    if (c.has('tutorial') || first) this.tutorialChanged(prev, first);
    if (!this.specNagged && p.loaded && p.cls !== 'wanderer' && !p.spec && this.d.level() >= SPEC_LEVEL) {
      this.specNagged = true;
      this.d.toasts.add(`You can choose a specialization: open the Board (${this.keyName('board')}) → ${CLASSES[p.cls].name}.`, 'info');
    }
  }

  private seen(step: number): boolean { try { return Number(localStorage.getItem(SEEN_KEY) ?? -1) >= step; } catch { return false; } }
  private markSeen(step: number): void { try { localStorage.setItem(SEEN_KEY, String(step)); } catch { /* ignore */ } }

  private tutorialChanged(prev: Progress, first: boolean): void {
    const t = this.progress.tutorial;
    this.dialog.skippable = !t.skipped && t.step < TUTORIAL_DONE;
    if (t.skipped) {
      if (!first && !prev.tutorial.skipped) { this.dialog.clear(); this.d.toasts.add('Story skipped. Your gates are in your collection; choose your path on the Board.', 'info'); this.board.render(); }
      this.lumen.visible = false;
      return;
    }
    const lines: string[] = [];
    if (!first && t.step > prev.tutorial.step) {
      for (let s = prev.tutorial.step; s < t.step; s++) if (TUTORIAL[s]) lines.push(TUTORIAL[s]!.done);
      this.d.sfx('levelup');
    }
    if (t.step < TUTORIAL_DONE && (!this.seen(t.step) || (!first && t.step > prev.tutorial.step))) {
      lines.push(...TUTORIAL[t.step]!.lines);
      this.markSeen(t.step);
    }
    if (t.step >= TUTORIAL_DONE && !first && prev.tutorial.step < TUTORIAL_DONE) this.d.toasts.add('The Qubitpedia is open: find it on your Board.', 'good');
    this.lumen.visible = t.step < TUTORIAL_DONE || this.dialog.open || lines.length > 0;
    this.say(lines);
    if (this.board.isOpen) this.board.render();
  }

  private say(lines: string[]): void {
    if (!lines.length) return;
    this.lumen.talking = true;
    this.dialog.say(lines.map((l) => this.fill(l)));
  }

  private afterDialog(): void {
    this.lumen.talking = false;
    const p = this.progress;
    if (p.tutorialDone) this.lumen.visible = false;
    // the story's "Choose" step opens the class cards right away
    if (p.tutorialActive && TUTORIAL[p.tutorial.step]?.goal.kind === 'choose_class' && p.cls === 'wanderer') this.openBoard('path');
  }

  private skipStory(): void {
    this.send(MSG34.TUTORIAL, { action: 'skip' });
    this.dialog.clear();
  }

  private fill(text: string): string {
    return fillPlaceholders(text, this.touch
      ? { board: 'the Board button', cast: 'your first orb button', journal: 'the Journal button', map: 'the Atlas button', dash: 'Dodge' }
      : { board: this.keyName('board'), cast: this.keyName('ability1'), journal: this.d.keys().journal.map(keyLabel).join(' / ') || 'the Journal button', map: this.keyName('map'), dash: this.d.keys().dash.map(keyLabel).join(' / ') || 'the Dodge button' });
  }

  private keyName(a: ExtAction): string { const k = this.d.keys()[a]?.[0]; return k ? keyLabel(k) : '?'; }

  private stepHint(): string | null {
    const p = this.progress;
    if (!p.tutorialActive) return null;
    const s = TUTORIAL[p.tutorial.step];
    if (!s) return null;
    const g = s.goal;
    const n = g.kind === 'casts' || g.kind === 'kills' ? ` (${p.tutorial.count}/${g.n})` : '';
    return `${this.fill(s.hint)}${n}`;
  }

  hint(): string | null {
    const h = this.stepHint();
    return h ? `✦ Lumen: ${h}` : null;
  }

  private dialogKey(e: KeyboardEvent): void {
    if (!this.dialog.open || !this.dialog.el.getClientRects().length || e.repeat) return;
    if (this.d.wins.open && this.d.wins.name !== 'circuit') return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    // when docked in the Board, Enter/Space belong to the focused button
    if (this.dialog.docked && (tag === 'BUTTON' || tag === 'SUMMARY')) return;
    const k = this.d.keys();
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || this.dialog.docked && (e.code === 'Space' || k.interact.includes(e.code))) {
      e.preventDefault(); e.stopImmediatePropagation();
      this.dialog.advance();
    }
  }

  // ───────────────────────── board window ─────────────────────────

  private openBoard(tab?: BoardTab): void {
    this.d.learn?.('openedCircuit');
    if (tab) this.board.tab = tab;
    if (this.d.wins.name !== 'circuit') {
      this.d.wins.show('circuit', 'Circuit Board', this.board.el, { wide: true, onClose: () => { this.board.isOpen = false; this.dialog.dock(null); } });
      this.board.isOpen = true;
      this.board.draft = this.board.dirty ? this.board.draft : structuredClone(this.progress.board);
    }
    this.board.render();
    if (this.progress.tutorialActive) this.send(MSG34.TUTORIAL, { action: 'board_open' });
  }

  private toggleBoard(): void {
    if (this.d.wins.name === 'circuit') this.d.wins.close();
    else this.openBoard();
  }

  // ───────────────────────── casting ─────────────────────────

  private slotInfo(): BarSlotInfo[] {
    const p = this.progress;
    const n = p.qubitsFor(this.d.level());
    const now = this.now();
    return Array.from({ length: ACTIVE_LINES }, (_, q) => {
      const a = q < n ? p.board.abilities[q] ?? null : null;
      return {
        ability: a, unlocked: q < n,
        line: a && this.attuned && q < this.attuned.lines.length ? this.attuned.lines[q]! : null,
        readyAt: a ? mergeReady(p.cd[a], this.predicted[a], !(a in this.predicted)) : 0,
        totalMs: a ? ABILITIES[a].cd * 1000 : 1,
      };
    }).map((s) => ({ ...s, readyAt: s.readyAt > now ? s.readyAt : 0 }));
  }

  /** How an ability is aimed: `quick` abilities fire at once; `skill` abilities are skill shots (arm, aim, click). */
  private style(a: AbilityId): { skill: boolean; enemy: boolean; ally: boolean } {
    return abilityTargeting(a);
  }

  aimRange(): number | null {
    const q = this.d.input.armed ? ABILITY_ACTIONS[this.d.input.armed] : undefined;
    const ability = q === undefined ? null : this.progress.board.abilities[q];
    return ability ? abilityTargeting(ability).range : null;
  }

  /** The selected target if this ability can use it (enemy for attacks, party mate for heals/threads). */
  private pick(a: AbilityId): string | undefined {
    const t = this.d.target();
    if (!t) return undefined;
    const st = this.style(a);
    return (t.kind === 'enemy' && st.enemy) || (t.kind === 'player' && st.ally) ? t.id : undefined;
  }

  private cast(q: number, manual = false): void {
    if (this.d.dead() || this.d.wins.open || this.d.input.blocked()) return;
    const p = this.progress;
    const info = this.slotInfo()[q];
    if (!info) return;
    if (!info.unlocked) { this.bar.pulse(q, 'denied'); this.d.toasts.add(`${orbName(q)} is still asleep. More orbs wake up as you level.`, 'info'); return; }
    if (!info.ability) { this.bar.pulse(q, 'denied'); this.d.toasts.add(`${orbName(q)} has no ability yet. Open the Board (${this.keyName('board')}).`, 'info'); return; }
    if (info.readyAt > this.now()) { this.bar.pulse(q, 'denied'); return; }
    const aim = this.d.aim();
    const target = manual ? undefined : this.pick(info.ability);
    this.send(MSG34.CAST, { line: q, aimX: aim.x, aimY: aim.y, ...(target ? { target } : {}) });
    // prediction: cooldown sweep, flash and sound start now; the server's reply decides the form
    this.predicted[info.ability] = this.now() + ABILITIES[info.ability].cd * 1000;
    this.bar.pulse(q, 'cast');
    this.d.sfx('shot');
    const me = this.d.me();
    const lp = info.line;
    if (me && lp) {
      const hue = lp.pB > 0.5 ? lp.hueB : lp.hueA;
      const other = lp.pB > 0.5 ? lp.hueA : lp.hueB;
      this.d.fx().burst(me.x + aim.x * 0.4, me.y + aim.y * 0.4, [ELEMENTS[hue]!.color, ELEMENTS[other]!.color, 7], 8);
    }
    void p;
  }

  private ult(manual = false): void {
    if (this.d.dead() || this.d.wins.open || this.d.input.blocked()) return;
    const p = this.progress;
    if (p.cls === 'wanderer') { this.bar.pulse('ult', 'denied'); this.d.toasts.add('Choose a path on the Board to unlock an ultimate.', 'info'); return; }
    if (this.res.v < this.res.max) { this.bar.pulse('ult', 'denied'); this.d.toasts.add(`${CLASSES[p.cls].ultimate.name} needs a full ${CLASSES[p.cls].resource.name} bar.`, 'info'); return; }
    if ((p.cd.ult ?? 0) > this.now()) { this.bar.pulse('ult', 'denied'); return; }
    const aim = this.d.aim();
    const t = manual ? null : this.d.target();
    this.send(MSG34.ULT, { aimX: aim.x, aimY: aim.y, ...(t && t.kind === 'enemy' && p.cls === 'superposer' ? { target: t.id } : {}) });
    this.bar.pulse('ult', 'cast');
    this.d.sfx('levelup');
  }

  private onCastResult(m: CastResultMsg): void {
    if (!m) return;
    this.lastCast = m;
    const p = this.progress;
    if (m.cd) p.cd = { ...p.cd, ...m.cd };
    const a = m.ult ? 'ult' : p.board.abilities[m.line];
    if (a) delete this.predicted[a];
    const me = this.d.me();
    if (!m.ok) {
      if (!m.ult && m.line >= 0 && m.line < ACTIVE_LINES) this.bar.pulse(m.line, 'denied');
      if (m.error) this.d.toasts.add(m.error, 'bad');
      return;
    }
    this.d.learn?.('orbCast');
    if (!me) return;
    if (m.ult) this.labels.add(me.x, me.y, `${CLASSES[p.cls].ultimate.name}!`, 0xfcd45a, { size: 18 });
    let echo = 0;
    for (const r of m.results ?? []) {
      const col = r.misfire ? elCol(7) : elCol(r.hue);
      if (!r.link) {
        this.labels.add(me.x, me.y, castShout(r.ability, r.bit, r.hue, r.misfire), col, { size: 16 });
        if (r.misfire) { this.labels.add(me.x, me.y, `(${formName(r.ability, r.bit, r.hue)} in wild Flux)`, col, { size: 11, delay: 120 }); this.bar.pulse(m.line, 'misfire'); }
        if (r.locked) this.labels.add(me.x, me.y, '◉ Locked', 0xecd08e, { size: 11, delay: 200 });
      } else {
        echo++;
        const name = r.ability ? ABILITIES[r.ability].name : orbName(r.q);
        this.labels.add(me.x, me.y, `⛓ ${name}: ${castShout(r.ability, r.bit, r.hue, r.misfire)}`, col, { size: 12, delay: 160 * echo });
        if (r.q < ACTIVE_LINES) window.setTimeout(() => this.bar.pulse(r.q, 'echo'), 160 * echo);
        window.setTimeout(() => { const pos = this.d.me(); if (pos) this.d.fx().ring(pos.x, pos.y, ELEMENTS[r.misfire ? 7 : r.hue]!.color, 1.4); }, 160 * echo);
      }
    }
  }

  // ───────────────────────── hooks ─────────────────────────

  action(a: ExtAction, direct = false): boolean {
    if (this.dialog.open && !this.dialog.docked && !this.d.wins.open && this.dialog.el.getClientRects().length && a === 'chat') { this.dialog.advance(); return true; }
    if (a === 'board') { this.toggleBoard(); return true; }
    if (a in ABILITY_ACTIONS) {
      if (this.d.wins.open || this.d.input.blocked()) return true;
      if (!direct && this.d.input.armed === a) { this.d.input.arm(null); return true; }
      this.d.input.arm(null);
      const q = ABILITY_ACTIONS[a]!, info = this.slotInfo()[q];
      // Desktop directional skills always wait for confirmation, even with a selected target.
      if (!direct && info?.ability && info.unlocked && info.readyAt <= this.now() && this.style(info.ability).skill && !this.d.dead()) this.d.input.arm(a as ExtAction);
      else this.cast(q);
      return true;
    }
    if (a === 'ultimate') {
      if (this.d.wins.open || this.d.input.blocked()) return true;
      if (!direct && this.d.input.armed === a) { this.d.input.arm(null); return true; }
      this.d.input.arm(null);
      if (!direct && this.progress.cls === 'superposer' && this.res.v >= this.res.max && !this.d.dead()) this.d.input.arm('ultimate');
      else this.ult();
      return true;
    }
    return false;
  }

  fire(a: ExtAction): void {
    if (this.d.wins.open) return;
    if (a in ABILITY_ACTIONS) this.cast(ABILITY_ACTIONS[a]!, true);
    else if (a === 'ultimate') this.ult(true);
  }

  // Story pages stay in the Board; gameplay keeps dodge, interaction and chat outside it.
  blocking(): boolean { return false; }

  frame(now: number, dt: number): void {
    const srv = this.now();
    this.spells.frame(now);
    this.labels.frame(now);
    this.lumen.frame(now, dt);
    this.dialog.frame(now);
    const info = this.slotInfo();
    if (now - this.lastSetup > 250) {
      this.lastSetup = now;
      const k = this.d.keys();
      this.bar.setup(info, [0, 1, 2, 3].map((i) => this.keyName(`ability${i + 1}` as ExtAction)), this.progress.cls, k.ultimate?.[0] ? keyLabel(k.ultimate[0]) : '', this.d.level());
      this.bar.boardBtn.title = `Circuit Board (${this.keyName('board')})`;
    }
    const ultReady = mergeReady(this.progress.cd.ult, this.predicted.ult, !('ult' in this.predicted));
    this.bar.update(info, { readyAt: ultReady > srv ? ultReady : 0, totalMs: (CLASSES[this.progress.cls].ultimate.secs || 6) * 5000, v: this.res.v, max: this.res.max }, srv);
    if (this.board.isOpen) {
      this.board.tick();
      this.board.pad(now, () => this.d.wins.close());
    }
  }

  debug(): Record<string, unknown> {
    const p = this.progress;
    return {
      circuit: {
        loaded: p.loaded, cls: p.cls, qubits: p.qubits, step: p.tutorial.step, skipped: p.tutorial.skipped, codex: p.codex.length,
        boardOpen: this.board.isOpen, dirty: this.board.dirty, draft: this.board.draft, tab: this.board.tab, expert: this.board.expert,
        dialog: this.dialog.open ? (document.querySelector('.p3-lumen-text')?.textContent ?? '') : null,
        spells: this.spells.count(), spellKinds: this.spells.kinds(), res: this.res.v, mock: !!this.mock,
        sent: this.sentLog.map((s) => ({ type: s.type, msg: s.msg })), lastCast: this.lastCast,
      },
    };
  }
}
