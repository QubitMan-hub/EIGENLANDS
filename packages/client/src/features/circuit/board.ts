/**
 * The Circuit Board window: orb lines as glowing light rails, crystal gates, Links, abilities, runes, the live
 * outcome preview, Expert View, the Qubitpedia and the class/path screen. Pure DOM (shared Windows host), driven
 * by mouse, touch, keyboard and gamepad. Edits happen on a local draft; "Attune" sends it to the server.
 */
import {
  ABILITIES, ACTIVE_LINES, BOARD_COLS, CLASSES, GATES, GATE_IDS, MAX_RUNES_PER_LINE, QUBIT_UNLOCK_LEVELS, RUNE_PRICE,
  boardPreview, checkBoard, cloneBoard, ketString, qubitsForLevel, MAX_QUBITS, SPEC_LEVEL, MULTICLASS_LEVEL,
  type AbilityId, type Board, type ChooseMsg, type GateId, type Preview, type LinePreview,
} from '@eigenlands/shared';
import type { Tooltip } from '../../ui/dom';
import { clear, h } from './el';
import type { Sfx } from '../../audio';
import { elementIcon, elHex, elName, gateTile, hex, runeIcon } from './art';
import { buildCodex } from './codex';
import { DragDrop } from './dnd';
import {
  available, azimuthDeg, boardsEqual, isAttuned, isFree, linkTargets, moveGate, occupant, pct, placeGate, railStates,
  removeAt, runesLeft, setAbility, setRunes, type EditResult, type RailSeg, type Spot,
} from './model';
import { buildGuides } from './guides';
import { applyPattern } from './patterns';
import { buildPath, type PathState } from './pathview';
import type { Progress } from './state';
import { formName, orbName, stabilityWord } from './text';

export type BoardTab = 'board' | 'codex' | 'path' | 'guides';

export interface BoardHost {
  progress: Progress;
  level(): number;
  coins(): number;
  /** server epoch ms */
  now(): number;
  keyFor(line: number): string;
  reduced(): boolean;
  tip: Tooltip;
  attune(b: Board): void;
  buyRune(): void;
  choose(m: ChooseMsg): void;
  skipStory(): void;
  /** UI blip (no caption) */
  blip(s: Sfx): void;
  /** current tutorial hint (placeholders filled), or null */
  hint(): string | null;
  tutorialActive(): boolean;
  /** Lumen's dialogue panel docks into the board while it is open */
  dock(slot: HTMLElement | null): void;
}

type Armed =
  | { kind: 'gate'; g: GateId }
  | { kind: 'move'; from: Spot }
  | { kind: 'link'; q: number; c: number; from?: Spot }
  | { kind: 'ability'; a: AbilityId }
  | null;

type Src =
  | { kind: 'gate'; g: GateId; from?: Spot }
  | { kind: 'end'; from: Spot }
  | { kind: 'ability'; a: AbilityId; from?: number }
  | { kind: 'rune'; from?: number };

const EXPERT_KEY = 'eigen.board.expert';
const spotKey = (s: Spot) => `${s.q}:${s.c}`;

export class BoardView {
  readonly el = h('div', { class: 'cb-root' });
  tab: BoardTab = 'board';
  expert = (() => { try { return localStorage.getItem(EXPERT_KEY) === '1'; } catch { return false; } })();
  draft: Board;
  private sent: Board | null = null;
  private sentAt = 0;
  private armed: Armed = null;
  private guide = { q: 0, id: 'split', review: false };
  private codexSel: string | null = null;
  private pathPending: PathState['pending'] = null;
  private status: { text: string; kind: 'info' | 'bad' } | null = null;
  private statusTimer = 0;
  private pop: string | null = null;
  private preview!: Preview;
  private rails!: RailSeg[][];
  private hoverTarget: number | null = null;
  private dnd: DragDrop<Src>;
  private ro: ResizeObserver | null = null;
  private attuneBtn: HTMLButtonElement | null = null;
  private skipArmedUntil = 0;
  private padPrev: boolean[] = [];
  private padRepeat = 0;
  isOpen = false;

  constructor(private host: BoardHost) {
    this.draft = cloneBoard(host.progress.board);
    this.recompute();
    this.dnd = new DragDrop<Src>(this.el, {
      canDrop: (s, t) => this.canDrop(s, t),
      drop: (s, t) => this.drop(s, t),
      hover: (s, t) => { if (s.kind === 'end' || (s.kind === 'gate' && s.g === 'cx')) { this.hoverTarget = t ? Number(t.dataset.q) : null; this.drawLinks(); } },
      end: () => { this.hoverTarget = null; this.drawLinks(); },
    });
    this.el.addEventListener('keydown', (e) => this.onKey(e));
    if (typeof ResizeObserver !== 'undefined') this.ro = new ResizeObserver(() => this.drawLinks());
  }

  // ───────────────────────── data ─────────────────────────

  get qubits(): number { return this.host.progress.qubitsFor(this.host.level()); }
  get dirty(): boolean { return !boardsEqual(this.draft, this.host.progress.board); }
  private rules() {
    const p = this.host.progress;
    return { qubits: this.qubits, gates: p.gates, runes: p.runes, allowed: p.allowed() };
  }

  private recompute(): void {
    const p = this.host.progress;
    const n = this.qubits;
    const locks = this.dirty ? null : p.locks;
    this.preview = boardPreview(this.draft, n, locks);
    this.rails = railStates(this.draft, n, locks);
  }

  /** Server progress changed. Keep the player's unsaved edits unless the server confirmed exactly them. */
  onProgress(changed: Set<string>): void {
    const p = this.host.progress;
    if (changed.has('board')) {
      if (this.sent && boardsEqual(this.sent, p.board)) { this.sent = null; this.draft = cloneBoard(p.board); this.flashAttuned(); }
      else if (!this.sent && !this.editedSinceLoad) this.draft = cloneBoard(p.board);
    }
    if (changed.has('cls') || changed.has('second') || changed.has('qubits')) {
      // a new class rewrites the server board; drop local edits that no longer fit
      this.draft = cloneBoard(p.board); this.sent = null; this.editedSinceLoad = false; this.pathPending = null;
      if (changed.has('cls') && this.tab === 'path' && p.cls !== 'wanderer') this.tab = 'board';
    }
    if (changed.has('locks') && this.sent && boardsEqual(this.sent, this.draft)) { this.sent = null; this.flashAttuned(); }
    this.recompute();
    if (this.isOpen) this.render();
  }
  private editedSinceLoad = false;

  private apply(r: EditResult, at?: Spot): boolean {
    if (!r.ok) { this.say(r.why, 'bad'); this.host.blip('till'); return false; }
    this.draft = r.board;
    this.editedSinceLoad = this.dirty;
    this.pop = at ? spotKey(at) : null;
    this.status = null;
    this.recompute();
    this.render();
    return true;
  }

  private say(text: string, kind: 'info' | 'bad' = 'info'): void {
    this.status = { text, kind };
    clearTimeout(this.statusTimer);
    this.statusTimer = window.setTimeout(() => { this.status = null; const s = this.el.querySelector('.cb-status'); if (s) s.textContent = ''; }, 4500);
    const s = this.el.querySelector<HTMLElement>('.cb-status');
    if (s) { s.textContent = text; s.className = `cb-status ${kind}`; }
  }

  // ───────────────────────── actions ─────────────────────────

  private placeAt(q: number, c: number, g: GateId): void {
    const p = this.host.progress;
    if (g === 'cx') {
      if (!isFree(this.draft, q, c)) { this.say('That spot is taken. Remove the gate there first.', 'bad'); return; }
      if (available(this.draft, p.gates).cx < 1) { this.say('No Link gates left in your collection.', 'bad'); return; }
      const t = linkTargets(this.draft, q, c, this.qubits);
      if (!t.length) { this.say(this.qubits < 2 ? 'A Link needs a second orb. You get one when you choose your path.' : 'No free spot in this column on another orb.', 'bad'); return; }
      if (t.length === 1) { if (this.apply(placeGate(this.draft, q, c, 'cx', p.gates, this.qubits, t[0]), { q, c })) this.host.blip('pickup'); this.armed = null; return; }
      this.armed = { kind: 'link', q, c };
      this.say(`Now pick the orb this Link connects ${orbName(q)} to.`);
      this.render();
      return;
    }
    if (this.apply(placeGate(this.draft, q, c, g, p.gates, this.qubits), { q, c })) this.host.blip('pickup');
  }

  private removeSpot(s: Spot): void {
    const r = removeAt(this.draft, s.q, s.c);
    if (!r.freed) return;
    this.armed = null;
    this.apply({ ok: true, board: r.board });
    this.host.blip('swing');
    this.say(`${GATES[r.freed].name} returned to your collection.`);
  }

  private cellClick(q: number, c: number): void {
    const a = this.armed;
    if (q >= this.qubits) return;
    if (a?.kind === 'link') {
      if (c === a.c && q !== a.q && isFree(this.draft, q, c)) {
        let base = this.draft;
        if (a.from) base = removeAt(base, a.from.q, a.from.c).board;
        if (this.apply(placeGate(base, a.q, a.c, 'cx', this.host.progress.gates, this.qubits, q), { q: a.q, c: a.c })) { this.host.blip('pickup'); this.say(`${orbName(a.q)} is now linked to ${orbName(q)}.`); }
        this.armed = null; this.render();
      } else if (q === a.q && c === a.c) { this.armed = null; this.say('Link cancelled.'); this.render(); }
      else this.say(`Pick a free spot in the same column (column ${a.c + 1}) on another orb.`, 'bad');
      return;
    }
    if (a?.kind === 'gate') {
      this.placeAt(q, c, a.g);
      if (this.armed?.kind === 'gate' && available(this.draft, this.host.progress.gates)[a.g] < 1) { this.armed = null; this.render(); }
      return;
    }
    if (a?.kind === 'move') {
      if (a.from.q === q && a.from.c === c) { this.armed = null; this.render(); return; }
      this.armed = null;
      if (this.apply(moveGate(this.draft, a.from, { q, c }, this.qubits), { q, c })) this.host.blip('pickup');
      else this.render();
      return;
    }
    const o = occupant(this.draft, q, c);
    if (o) { this.armed = { kind: 'move', from: { q, c } }; this.say(o.kind === 'gate' ? `${GATES[o.cell.g].name} picked up. Tap another spot to move it, or press Delete to remove it.` : 'Link end picked up. Tap another orb in this column to re-link.'); this.render(); }
    else this.say('Pick a gate from your collection first, or drag one here.');
  }

  private attune(): void {
    const err = checkBoard(this.draft, this.rules());
    if (err) { this.say(err, 'bad'); return; }
    const p = this.host.progress;
    if (p.attuneReady > this.host.now()) return;
    this.sent = cloneBoard(this.draft);
    this.sentAt = performance.now();
    this.host.attune(cloneBoard(this.draft));
    this.host.blip('craft');
    this.el.classList.add('cb-attuning');
    window.setTimeout(() => this.el.classList.remove('cb-attuning'), 900);
    this.render();
  }

  private flashAttuned(): void {
    this.el.classList.remove('cb-attuned');
    void this.el.offsetWidth;
    this.el.classList.add('cb-attuned');
    window.setTimeout(() => this.el.classList.remove('cb-attuned'), 1200);
    this.say('Attuned. Your orbs hum with the new pattern.');
  }

  openTab(tab: BoardTab): void { this.tab = tab; this.armed = null; this.render(); }

  showCodex(id: string): void { this.codexSel = id; this.openTab('codex'); }

  // ───────────────────────── drag & drop ─────────────────────────

  private canDrop(s: Src, t: HTMLElement): boolean {
    const kind = t.dataset.drop;
    const q = Number(t.dataset.q), c = Number(t.dataset.c);
    const p = this.host.progress;
    switch (s.kind) {
      case 'gate':
        if (kind === 'palette') return !!s.from;
        if (kind !== 'cell' || q >= this.qubits) return false;
        if (s.from) return (s.from.q === q && s.from.c === c) || moveGate(this.draft, s.from, { q, c }, this.qubits).ok;
        if (s.g === 'cx') return isFree(this.draft, q, c) && linkTargets(this.draft, q, c, this.qubits).length > 0;
        return placeGate(this.draft, q, c, s.g, p.gates, this.qubits).ok;
      case 'end':
        if (kind === 'palette') return true;
        return kind === 'cell' && moveGate(this.draft, s.from, { q, c }, this.qubits).ok;
      case 'ability':
        if (kind === 'abilities') return s.from !== undefined;
        return kind === 'ability' && q < this.qubits;
      case 'rune':
        if (kind === 'runes') return s.from !== undefined;
        return kind === 'rune' && q < this.qubits && s.from !== q && this.draft.runes[q]! < MAX_RUNES_PER_LINE && (s.from !== undefined || runesLeft(this.draft, p.runes) > 0);
    }
  }

  private drop(s: Src, t: HTMLElement | null): void {
    const p = this.host.progress;
    const kind = t?.dataset.drop;
    const q = Number(t?.dataset.q), c = Number(t?.dataset.c);
    switch (s.kind) {
      case 'gate':
        if (!t || kind === 'palette') { if (s.from) this.removeSpot(s.from); return; }
        if (s.from) { if (this.apply(moveGate(this.draft, s.from, { q, c }, this.qubits), { q, c })) this.host.blip('pickup'); return; }
        this.placeAt(q, c, s.g);
        return;
      case 'end':
        if (!t || kind === 'palette') { this.removeSpot(s.from); return; }
        if (this.apply(moveGate(this.draft, s.from, { q, c }, this.qubits), { q, c })) this.host.blip('pickup');
        return;
      case 'ability':
        if (!t || kind === 'abilities') { if (s.from !== undefined) this.apply(setAbility(this.draft, s.from, null, p.allowed(), this.qubits)); return; }
        if (this.apply(setAbility(this.draft, q, s.a, p.allowed(), this.qubits))) this.host.blip('pickup');
        return;
      case 'rune': {
        let b = this.draft;
        if (s.from !== undefined) { const r = setRunes(b, s.from, b.runes[s.from]! - 1, p.runes, this.qubits); if (r.ok) b = r.board; }
        if (!t || kind === 'runes') { this.apply({ ok: true, board: b }); return; }
        if (this.apply(setRunes(b, q, b.runes[q]! + 1, p.runes, this.qubits))) this.host.blip('pickup');
      }
    }
  }

  // ───────────────────────── input ─────────────────────────

  private onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement;
    if (e.key === 'Escape' && (this.armed || this.pathPending)) {
      e.stopPropagation(); e.preventDefault();
      this.armed = null; this.pathPending = null; this.say('Cancelled.'); this.render();
      return;
    }
    // the game binds Enter (chat) and Space (interaction) and swallows their default action, so press buttons ourselves
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat && (t.tagName === 'BUTTON' || t.tagName === 'SUMMARY')) {
      e.preventDefault(); e.stopPropagation();
      t.click();
      return;
    }
    if (t.tagName === 'BUTTON' && !e.ctrlKey && !e.metaKey && /^(Arrow|Tab$)/.test(e.key) && !t.closest('.cb-cell')) {
      // arrows move between controls instead of walking the character behind the window
      if (e.key.startsWith('Arrow')) { e.preventDefault(); e.stopPropagation(); this.spatialMove(e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0, e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0); }
      return;
    }
    const cell = t.closest<HTMLElement>('.cb-cell');
    if (cell) {
      const q = Number(cell.dataset.q), c = Number(cell.dataset.c);
      const move: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
      const m = move[e.key];
      if (m) {
        e.preventDefault(); e.stopPropagation();
        const nq = Math.max(0, Math.min(this.qubits - 1, q + m[0])), nc = Math.max(0, Math.min(BOARD_COLS - 1, c + m[1]));
        this.el.querySelector<HTMLElement>(`.cb-cell[data-q="${nq}"][data-c="${nc}"]`)?.focus();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); this.removeSpot({ q, c }); return; }
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.armed?.kind === 'move') { e.preventDefault(); e.stopPropagation(); this.removeSpot(this.armed.from); }
  }

  /** Gamepad while the board is open: d-pad moves focus, A presses, B cancels/closes, X removes, Y attunes, LB/RB switch tabs. */
  pad(now: number, close: () => void): void {
    const pad = navigator.getGamepads?.().find((p) => !!p);
    if (!pad) return;
    const b = (i: number) => !!pad.buttons[i]?.pressed;
    const edge = (i: number) => b(i) && !this.padPrev[i];
    const dirs: Array<[number, number, number]> = [[12, 0, -1], [13, 0, 1], [14, -1, 0], [15, 1, 0]];
    let dir: [number, number] | null = null;
    for (const [i, dx, dy] of dirs) if (edge(i) || (b(i) && now > this.padRepeat)) { dir = [dx, dy]; this.padRepeat = now + (edge(i) ? 380 : 120); }
    const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
    if (!dir && Math.hypot(ax, ay) > 0.6 && now > this.padRepeat) { dir = Math.abs(ax) > Math.abs(ay) ? [Math.sign(ax), 0] : [0, Math.sign(ay)]; this.padRepeat = now + 200; }
    if (dir) this.spatialMove(dir[0], dir[1]);
    const f = document.activeElement as HTMLElement | null;
    const inside = !!f && this.el.contains(f);
    if (edge(0)) { if (inside) f!.click(); else this.focusFirst(); }
    if (edge(1)) { if (this.armed) { this.armed = null; this.render(); } else close(); }
    if (edge(2) && inside) { const c = f!.closest<HTMLElement>('.cb-cell'); if (c) this.removeSpot({ q: Number(c.dataset.q), c: Number(c.dataset.c) }); }
    if (edge(3) && this.tab === 'board') this.attune();
    if (edge(4) || edge(5)) { const tabs: BoardTab[] = ['board', 'guides', 'codex', 'path']; this.openTab(tabs[(tabs.indexOf(this.tab) + (edge(5) ? 1 : tabs.length - 1)) % tabs.length]!); this.focusFirst(); }
    this.padPrev = pad.buttons.map((x) => x.pressed);
  }

  private focusFirst(): void { this.el.querySelector<HTMLElement>('.cb-cell, button')?.focus(); }

  private spatialMove(dx: number, dy: number): void {
    const all = [...this.el.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"], summary')].filter((e) => e.offsetParent !== null);
    const cur = document.activeElement as HTMLElement | null;
    if (!cur || !this.el.contains(cur)) { all[0]?.focus(); return; }
    const r = cur.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best: HTMLElement | null = null, bd = Infinity;
    for (const e of all) {
      if (e === cur) continue;
      const o = e.getBoundingClientRect();
      const ox = o.left + o.width / 2 - cx, oy = o.top + o.height / 2 - cy;
      const along = ox * dx + oy * dy;
      if (along <= 4) continue;
      const across = Math.abs(ox * dy - oy * dx);
      const d = along + across * 2.5;
      if (d < bd) { bd = d; best = e; }
    }
    if (best) { best.focus(); best.scrollIntoView({ block: 'nearest' }); }
  }

  // ───────────────────────── render ─────────────────────────

  /** Rebuild the window body. Keeps focus and scroll position so keyboard and gamepad users never lose their place. */
  render(): void {
    if (!this.isOpen) return;
    const focusKey = (document.activeElement as HTMLElement | null)?.dataset?.focus;
    const scroller = this.el.closest<HTMLElement>('.window');
    const top = scroller?.scrollTop ?? 0;
    this.host.dock(null);
    clear(this.el);
    this.el.classList.toggle('cb-still', this.host.reduced());
    this.el.classList.toggle('cb-expert', this.expert);
    this.el.append(this.header());
    const slot = h('div', { class: 'cb-lumen-slot' });
    this.el.append(slot);
    this.host.dock(slot);
    if (this.tab === 'board') this.el.append(this.boardTab());
    else if (this.tab === 'guides') this.el.append(this.guidesTab());
    else if (this.tab === 'codex') this.el.append(buildCodex(this.host.progress.codex, this.codexSel, this.expert, (id) => { this.codexSel = id; this.render(); }));
    else this.el.append(this.pathTab());
    if (scroller) scroller.scrollTop = top;
    if (focusKey) this.el.querySelector<HTMLElement>(`[data-focus="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
    this.pop = null;
    requestAnimationFrame(() => this.drawLinks());
  }

  private header(): HTMLElement {
    const p = this.host.progress;
    const tabs = h('div', { class: 'cb-tabs', data: { focusgroup: 'tabs' } });
    tabs.setAttribute('role', 'tablist');
    const pathBadge = (p.cls === 'wanderer' && p.loaded) || (p.cls !== 'wanderer' && !p.spec && this.host.level() >= SPEC_LEVEL) || (p.cls !== 'wanderer' && !p.second && this.host.level() >= MULTICLASS_LEVEL);
    const items: Array<[BoardTab, string, string]> = [['board', '◈', 'Board'], ['guides', '', 'Guides'], ['codex', '❖', 'Qubitpedia'], ['path', '✧', p.cls === 'wanderer' ? 'Choose path' : CLASSES[p.cls].name]];
    for (const [id, glyph, label] of items) {
      const b = h('button', { class: `cb-tab${this.tab === id ? ' on' : ''}`, data: { focus: `tab:${id}` }, on: { click: () => this.openTab(id) } },
        h('span', { class: 'cb-tab-g', text: glyph }), label, id === 'path' && pathBadge ? h('span', { class: 'cb-dot', title: 'Something to choose here' }) : null);
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', label);
      b.setAttribute('aria-selected', String(this.tab === id));
      tabs.append(b);
    }
    const exp = h('button', {
      class: `cb-toggle${this.expert ? ' on' : ''}`, data: { focus: 'expert' }, title: 'Show the real quantum circuit underneath: symbols, state vector, exact odds.',
      on: { click: () => { this.expert = !this.expert; try { localStorage.setItem(EXPERT_KEY, this.expert ? '1' : '0'); } catch { /* ignore */ } this.render(); } },
    }, h('span', { class: 'cb-switch' }), 'Expert View');
    exp.setAttribute('aria-pressed', String(this.expert));
    return h('div', { class: 'cb-head' }, tabs, h('div', { class: 'cb-head-r' }, h('span', { class: 'cb-coins', text: `${this.host.coins()} coins` }), exp));
  }

  private guidesTab(): HTMLElement {
    this.guide.q = Math.min(this.guide.q, Math.min(ACTIVE_LINES, this.qubits) - 1);
    return buildGuides({ ...this.guide, board: this.draft, rules: this.rules(), loaded: this.host.progress.loaded,
      pending: !!this.sent, locks: this.dirty ? null : this.host.progress.locks }, {
      orb: q => { this.guide.q = q; this.guide.review = false; this.render(); },
      pattern: id => { this.guide.id = id; this.guide.review = false; this.render(); },
      review: () => { this.guide.review = true; this.render(); this.el.querySelector<HTMLElement>('[data-focus="guide-use"]')?.focus(); },
      use: () => {
        if (!this.host.progress.loaded || this.sent) return;
        const result = applyPattern(this.draft, this.guide.id, this.guide.q, this.rules());
        if (!result.ok) { this.say(result.why, 'bad'); this.render(); return; }
        this.tab = 'board'; this.armed = null;
        this.apply(result);
        this.say('Pattern in your draft. Review the outcomes, then Attune to save it.');
        this.el.querySelector<HTMLElement>('[data-focus="attune"]')?.focus();
      },
      board: () => this.openTab('board'),
    });
  }

  private pathTab(): HTMLElement {
    const p = this.host.progress;
    return buildPath({
      cls: p.cls, spec: p.spec, second: p.second, level: this.host.level(), qubits: this.qubits, pending: this.pathPending,
      tutorialChoose: this.host.tutorialActive(),
    }, {
      pick: (x) => { this.pathPending = x; this.render(); },
      confirm: (m) => { this.pathPending = null; this.host.choose(m); this.host.blip('levelup'); this.render(); },
    });
  }

  // ── the Board tab ──

  private boardTab(): HTMLElement {
    const root = h('div', { class: 'cb-board-tab' });
    const p = this.host.progress;
    const hint = this.host.hint();
    if (hint) root.append(h('div', { class: 'cb-hint' }, h('span', { class: 'cb-hint-l', text: 'Lumen' }), hint));
    if (!p.loaded) root.append(h('div', { class: 'cb-wait', text: 'Your orbs are still waking up: the world has not answered yet. You can plan your board meanwhile.' }));
    root.append(h('div', { class: 'cb-draft-guide' }, h('span', { text: 'Gates change the form your ability takes. Changes stay in this draft until you Attune.' }), h('button', { text: 'Learn a pattern', data: { focus: 'guide-open' }, on: { click: () => this.openTab('guides') } })));
    root.append(this.palette());
    root.append(this.lines());
    const joints = this.joints();
    if (joints) root.append(joints);
    if (this.expert) root.append(this.expertPanel());
    root.append(this.footer());
    return root;
  }

  private palette(): HTMLElement {
    const p = this.host.progress;
    const left = available(this.draft, p.gates);
    const gates = h('div', { class: 'cb-pal-gates', data: { drop: 'palette' } });
    for (const g of GATE_IDS) {
      const owned = p.gates[g] ?? 0, l = left[g];
      const armed = this.armed?.kind === 'gate' && this.armed.g === g;
      const gem = h('button', {
        class: `cb-gem${l < 1 ? ' empty' : ''}${owned < 1 ? ' unknown' : ''}${armed ? ' armed' : ''}`, data: { focus: `gem:${g}`, gate: g },
      },
      h('img', { src: gateTile(g, this.expert ? 'expert' : 'friendly', l < 1), alt: '' }),
      h('span', { class: 'cb-gem-n', text: owned < 1 ? '?' : String(l) }),
      h('span', { class: 'cb-gem-name', text: owned < 1 ? '???' : this.expert ? `${GATES[g].expert}` : GATES[g].name }),
      owned > 0 ? h('span', { class: 'cb-gem-of', text: `${owned - l}/${owned} set` }) : null);
      gem.setAttribute('aria-label', owned < 1 ? 'Unknown gate, not found yet' : `${GATES[g].name}: ${l} of ${owned} left${armed ? ', selected' : ''}`);
      gem.setAttribute('aria-pressed', String(armed));
      this.host.tip.attach(gem, () => this.gateTip(g));
      if (owned > 0) {
        this.dnd.bind(gem, () => (left[g] < 1 ? { source: { kind: 'gate', g }, ghost: () => h('div'), click: () => this.say(`All your ${GATES[g].name} gates are on the board.`, 'bad') } : {
          source: { kind: 'gate', g },
          ghost: () => h('img', { class: 'cb-ghost-gem', src: gateTile(g, this.expert ? 'expert' : 'friendly') }),
          click: () => {
            this.armed = armed ? null : { kind: 'gate', g };
            if (!armed) this.say(g === 'cx' ? 'Link selected. Tap a spot on an orb\'s line, then the orb to connect it to.' : `${GATES[g].name} selected. Tap a spot on an orb's line to place it.`);
            this.render();
          },
        }));
      } else gem.addEventListener('click', () => this.say('You have not found this gate yet. Level up and follow Lumen to collect more.'));
      gates.append(gem);
    }

    // abilities
    const abil = h('div', { class: 'cb-pal-abil', data: { drop: 'abilities' } });
    for (const a of p.allowed()) {
      const on = this.draft.abilities.indexOf(a);
      const armed = this.armed?.kind === 'ability' && this.armed.a === a;
      const chip = this.chip(a, { cls: `${on >= 0 ? ' used' : ''}${armed ? ' armed' : ''}`, note: on >= 0 ? orbName(on) : '' });
      chip.dataset.focus = `chip:${a}`;
      chip.setAttribute('aria-pressed', String(armed));
      this.dnd.bind(chip, () => ({
        source: { kind: 'ability', a },
        ghost: () => this.chip(a, {}),
        click: () => { this.armed = armed ? null : { kind: 'ability', a }; if (!armed) this.say(`${ABILITIES[a].name} selected. Tap an orb's ability slot.`); this.render(); },
      }));
      abil.append(chip);
    }

    // runes
    const rl = runesLeft(this.draft, p.runes);
    const rune = h('button', { class: `cb-runetok${rl < 1 ? ' empty' : ''}`, data: { focus: 'runetok' } },
      h('img', { src: runeIcon(rl > 0), alt: '' }), h('span', { text: `${rl} left` }));
    rune.setAttribute('aria-label', `Error Correction runes: ${rl} of ${p.runes} left`);
    this.host.tip.attach(rune, () => h('div', { class: 'tip' }, h('div', { class: 'tip-name', text: 'Error Correction rune' }), h('div', { class: 'tip-desc', text: 'Drag onto an orb\'s rune sockets (up to 2). It makes the orb vote between copies of its result, so slips almost never get through.' }), h('div', { class: 'tip-line', text: `${p.runes - rl} of ${p.runes} placed` })));
    this.dnd.bind(rune, () => ({ source: { kind: 'rune' }, ghost: () => h('img', { class: 'cb-ghost-rune', src: runeIcon(true) }), click: () => this.say(rl > 0 ? 'Tap an empty rune socket next to an orb to place a rune.' : 'No runes left. Buy one, or take one off another orb.') }));
    const coins = this.host.coins();
    const buy = h('button', { class: 'cb-buy', disabled: coins < RUNE_PRICE, data: { focus: 'buy' }, text: `Buy rune · ${RUNE_PRICE}c`, on: { click: () => { this.host.buyRune(); this.host.blip('coin'); } } });
    buy.title = coins < RUNE_PRICE ? `You need ${RUNE_PRICE} coins.` : 'A currency sink with a purpose: steadier orbs.';
    const runes = h('div', { class: 'cb-pal-runes', data: { drop: 'runes' } }, rune, buy);

    return h('div', { class: 'cb-pal' },
      h('div', { class: 'cb-pal-sec' }, h('div', { class: 'cb-k', text: 'Gates' }), gates),
      h('div', { class: 'cb-pal-sec' }, h('div', { class: 'cb-k', text: 'Abilities' }), abil),
      h('div', { class: 'cb-pal-sec' }, h('div', { class: 'cb-k', text: 'Runes' }), runes));
  }

  private chip(a: AbilityId, o: { cls?: string; note?: string; hue?: number }): HTMLElement {
    const def = ABILITIES[a];
    const el = h('button', { class: `cb-chip${o.cls ?? ''}`, style: `--ca:${elHex(o.hue ?? def.forms[0].hue)};--cb:${elHex(def.forms[1].hue)}` },
      h('span', { class: 'cb-medal', text: def.glyph }),
      h('span', { class: 'cb-chip-t' }, h('b', { text: def.name }), o.note ? h('small', { text: o.note }) : null));
    el.setAttribute('aria-label', `${def.name}${o.note ? `, on ${o.note}` : ''}`);
    this.host.tip.attach(el, () => this.abilityTip(a));
    return el;
  }

  private lines(): HTMLElement {
    const wrap = h('div', { class: 'cb-lines' });
    const n = this.qubits;
    const head = h('div', { class: 'cb-line cb-colhead' },
      h('div', { class: 'cb-orbcol' }), h('div', { class: 'cb-rail' }, ...Array.from({ length: BOARD_COLS }, (_, c) => h('span', { class: 'cb-colno', text: String(c + 1) }))),
      h('div', { class: 'cb-kit cb-k', text: 'Ability · runes' }), h('div', { class: 'cb-out cb-k', text: this.expert ? 'Measurement' : 'What comes out' }));
    head.setAttribute('aria-hidden', 'true');
    wrap.append(head);
    for (let q = 0; q < n; q++) wrap.append(this.line(q, this.preview.lines[q]!));
    wrap.append(this.lockedLines(n));
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('cb-links');
    svg.setAttribute('aria-hidden', 'true');
    wrap.append(svg);
    this.ro?.disconnect();
    this.ro?.observe(wrap);
    return wrap;
  }

  private lockedLines(n: number): HTMLElement {
    const lvl = this.host.level();
    const bonus = Math.max(0, n - qubitsForLevel(lvl));
    const rest: HTMLElement[] = [];
    for (let q = n; q < MAX_QUBITS; q++) {
      const at = QUBIT_UNLOCK_LEVELS[q - bonus] ?? QUBIT_UNLOCK_LEVELS[q]!;
      rest.push(h('span', { class: 'cb-lk', title: `${orbName(q)} unlocks at level ${at}` }, h('span', { class: 'cb-sphere off' }), h('small', { text: `Lv ${at}` })));
    }
    if (!rest.length) return h('div');
    const first = rest.shift()!;
    const nextQ = n;
    const row = h('div', { class: 'cb-line locked' },
      h('div', { class: 'cb-orbcol' }, h('span', { class: 'cb-sphere off' }), h('div', { class: 'cb-orbname', text: orbName(nextQ) })),
      h('div', { class: 'cb-rail off' }, ...Array.from({ length: BOARD_COLS }, () => h('span', { class: 'cb-cell off' }))),
      h('div', { class: 'cb-lockmsg' }, h('span', { class: 'cb-padlock', text: '🔒︎' }), ` Unlocks at level ${first.querySelector('small')!.textContent!.slice(3)}`,
        rest.length ? h('div', { class: 'cb-lk-row' }, ...rest) : null));
    return row;
  }

  private line(q: number, lp: LinePreview): HTMLElement {
    const b = this.draft;
    const rails = this.rails;
    const a = b.abilities[q] ?? null;
    const likelyB = lp.pB > 0.5;
    const style = `--ca:${elHex(lp.hueA)};--cb:${elHex(lp.hueB)};--pb:${lp.pB.toFixed(3)}`;
    const row = h('div', { class: `cb-line${lp.active ? '' : ' support'}${lp.locked !== null ? ' haslock' : ''}`, style, data: { q } });

    // orb
    const orb = h('div', { class: 'cb-orbcol' },
      h('span', { class: `cb-sphere${lp.pB > 0.02 && lp.pB < 0.98 ? ' split' : ''}`, style: `--o:${elHex(likelyB ? lp.hueB : lp.hueA)}` },
        h('img', { class: 'cb-elicon', src: elementIcon(likelyB ? lp.hueB : lp.hueA, '#f4f4ff'), alt: '' })),
      h('div', { class: 'cb-orbname' }, orbName(q), lp.active ? h('kbd', { text: this.host.keyFor(q) }) : h('small', { text: 'support' })));
    row.append(orb);

    // rail
    const rail = h('div', { class: 'cb-rail' });
    rail.setAttribute('role', 'group');
    rail.setAttribute('aria-label', `${orbName(q)} line`);
    const armed = this.armed;
    for (let c = 0; c < BOARD_COLS; c++) {
      const o = occupant(b, q, c);
      const before = rails[c]![q]!, after = rails[c + 1]![q]!;
      const cell = h('button', { class: 'cb-cell', data: { drop: 'cell', q, c, focus: `cell:${q}:${c}` }, style: `--k:${c}` });
      cell.append(...strands(before, 'l'), ...strands(after, 'r'));
      let label = `${orbName(q)}, spot ${c + 1}: empty`;
      if (o?.kind === 'gate') {
        const g = o.cell.g;
        const img = h('img', { class: `cb-cellgem${this.pop === `${q}:${c}` ? ' pop' : ''}`, src: gateTile(g, this.expert ? (g === 'cx' ? 'control' : 'expert') : 'friendly'), alt: '' });
        img.style.setProperty('--d', `${((q * 7 + c * 3) % 11) * 0.37}s`);
        cell.append(img);
        cell.classList.add('full');
        label = `${orbName(q)}, spot ${c + 1}: ${GATES[g].name}${g === 'cx' ? ` to ${orbName(o.cell.t ?? 0)}` : ''}`;
        this.host.tip.attach(cell, () => this.gateTip(g, o.cell.t));
        this.dnd.bind(cell, () => ({
          source: { kind: 'gate', g, from: { q, c } },
          ghost: () => h('img', { class: 'cb-ghost-gem', src: gateTile(g, this.expert ? 'expert' : 'friendly') }),
          click: () => this.cellClick(q, c), longPress: () => this.removeSpot({ q, c }), contextMenu: () => this.removeSpot({ q, c }),
        }));
      } else if (o?.kind === 'linkEnd') {
        cell.append(this.expert ? h('img', { class: 'cb-cellgem', src: gateTile('cx', 'target'), alt: '' }) : h('span', { class: 'cb-knot' }));
        cell.classList.add('end');
        label = `${orbName(q)}, spot ${c + 1}: far end of a Link from ${orbName(o.from)}`;
        this.dnd.bind(cell, () => ({
          source: { kind: 'end', from: { q, c } }, ghost: () => h('span', { class: 'cb-knot' }),
          click: () => this.cellClick(q, c), longPress: () => this.removeSpot({ q, c }), contextMenu: () => this.removeSpot({ q, c }),
        }));
      } else {
        // empty cells are drop targets; a press on one is a tap (or Enter/Space), never a drag
        cell.addEventListener('click', () => this.cellClick(q, c));
      }
      if (armed?.kind === 'link') {
        if (c === armed.c && q === armed.q) { cell.classList.add('linksrc'); if (!o) cell.append(h('img', { class: 'cb-cellgem ghosted', src: gateTile('cx', this.expert ? 'control' : 'friendly'), alt: '' })); }
        else if (c === armed.c && isFree(b, q, c)) { cell.classList.add('tgt'); cell.addEventListener('pointerenter', () => { this.hoverTarget = q; this.drawLinks(); }); cell.addEventListener('pointerleave', () => { this.hoverTarget = null; this.drawLinks(); }); }
      }
      if (armed?.kind === 'move' && armed.from.q === q && armed.from.c === c) cell.classList.add('picked');
      if (armed?.kind === 'gate' && !o) cell.classList.add('ready');
      cell.setAttribute('aria-label', label);
      rail.append(cell);
    }
    rail.append(h('span', { class: 'cb-tail' }, ...strands(rails[BOARD_COLS]![q]!, 'l')));
    row.append(rail);

    // ability + runes
    const slot = h('div', { class: `cb-aslot${a ? ' full' : ''}`, data: { drop: 'ability', q, focus: `aslot:${q}` } });
    if (a) {
      const chip = this.chip(a, { hue: lp.hueA });
      chip.dataset.focus = `achip:${q}`;
      this.dnd.bind(chip, () => ({
        source: { kind: 'ability', a, from: q }, ghost: () => this.chip(a, {}),
        click: () => { if (this.armed?.kind === 'ability') this.drop({ kind: 'ability', a: this.armed.a }, slot); else this.say(`Drag ${ABILITIES[a].name} to another orb to swap, or off the board to clear it.`); this.armed = null; },
      }));
      const x = h('button', { class: 'cb-x', text: '✕', title: 'Clear this orb\'s ability', on: { click: () => this.apply(setAbility(this.draft, q, null, this.host.progress.allowed(), this.qubits)) } });
      x.setAttribute('aria-label', `Clear ${ABILITIES[a].name} from ${orbName(q)}`);
      slot.append(chip, x);
    } else {
      const add = h('button', { class: 'cb-aslot-empty', text: this.armed?.kind === 'ability' ? 'Place here' : '+ ability', data: { focus: `aslot:${q}` } });
      add.addEventListener('click', () => {
        if (this.armed?.kind === 'ability') { this.apply(setAbility(this.draft, q, this.armed.a, this.host.progress.allowed(), this.qubits)); this.armed = null; this.render(); }
        else this.say('Drag an ability chip here, or tap a chip above and then this slot.');
      });
      slot.append(add);
    }
    const runes = h('div', { class: 'cb-rsocks' });
    for (let i = 0; i < MAX_RUNES_PER_LINE; i++) {
      const on = i < (b.runes[q] ?? 0);
      const s = h('button', { class: `cb-rsock${on ? ' on' : ''}`, data: { drop: 'rune', q, focus: `rs:${q}:${i}` } }, h('img', { src: runeIcon(on), alt: '' }));
      s.setAttribute('aria-label', on ? `Rune ${i + 1} on ${orbName(q)}: remove` : `Empty rune socket ${i + 1} on ${orbName(q)}: add a rune`);
      s.title = on ? 'Error Correction rune (click to take it off)' : 'Empty rune socket (click to add a rune)';
      if (on) this.dnd.bind(s, () => ({ source: { kind: 'rune', from: q }, ghost: () => h('img', { class: 'cb-ghost-rune', src: runeIcon(true) }), click: () => this.apply(setRunes(this.draft, q, (this.draft.runes[q] ?? 0) - 1, this.host.progress.runes, this.qubits)) }));
      else s.addEventListener('click', () => this.apply(setRunes(this.draft, q, (this.draft.runes[q] ?? 0) + 1, this.host.progress.runes, this.qubits)));
      runes.append(s);
    }
    row.append(h('div', { class: 'cb-kit' }, slot, runes));

    // outcome
    row.append(this.outcome(q, lp));
    return row;
  }

  private outcome(q: number, lp: LinePreview): HTMLElement {
    const a = lp.ability;
    const out = h('div', { class: 'cb-out' });
    const locked = lp.locked === 0 || lp.locked === 1;
    const bar = (bit: 0 | 1) => {
      const p = bit ? lp.pB : 1 - lp.pB;
      const hue = bit ? lp.hueB : lp.hueA;
      const isLock = locked && lp.locked === bit;
      const el = h('div', { class: `cb-bar${p < 0.005 ? ' zero' : ''}${isLock ? ' lockwin' : ''}`, style: `--c:${elHex(hue)}` },
        h('img', { class: 'cb-elicon', src: elementIcon(hue), alt: elName(hue), title: elName(hue) }),
        h('span', { class: 'cb-bar-n', text: formName(a, bit, hue) }),
        h('span', { class: 'cb-meter' }, h('i', { style: `width:${(p * 100).toFixed(1)}%` })),
        h('b', { text: this.expert ? p.toFixed(4) : pct(p) }));
      el.setAttribute('aria-label', `${formName(a, bit, hue)} (${elName(hue)}): ${pct(p)}`);
      return el;
    };
    out.append(bar(0), bar(1));
    const st = stabilityWord(lp.stability);
    const chips = h('div', { class: 'cb-tags' });
    if (locked) chips.append(h('span', { class: 'cb-badge lock', text: '◉ Locked +power' }));
    else if (lp.locked === 'pending') chips.append(h('span', { class: 'cb-badge pend', text: '◉ Decided on attune' }));
    if (lp.fires.length) chips.append(h('span', { class: 'cb-badge link', text: `⛓ fires ${lp.fires.map((t) => orbName(t)).join(', ')}` }));
    if (lp.firedBy.length) chips.append(h('span', { class: 'cb-badge link', text: `⛓ echo of ${lp.firedBy.map((t) => orbName(t)).join(', ')}` }));
    const stab = h('div', { class: `cb-stab ${st.cls}` },
      h('span', { class: 'cb-stab-w', text: st.word }),
      h('span', { class: 'cb-pips' }, ...Array.from({ length: 10 }, (_, i) => h('i', { class: i < Math.round(lp.stability * 10) ? 'on' : '' }))),
      chips);
    stab.title = `Stability ${pct(lp.stability)}${lp.rawStability !== lp.stability ? ` (without runes ${pct(lp.rawStability)})` : ''}. Every gate adds a tiny chance of a misfire; runes cancel most of it.`;
    out.append(stab, h('div', { class: 'cb-sum', text: lp.summary }));
    if (this.expert) {
      const az = azimuthDeg(this.preview.ev, q);
      const raw = 1 - lp.rawStability, eff = 1 - lp.stability;
      out.append(h('div', { class: 'cb-xline' },
        h('span', { text: `P(|1⟩)=${lp.pBIdeal.toFixed(4)}` }),
        h('span', { text: `φ=${az === null ? '—' : `${az.toFixed(1)}°`}` }),
        h('span', { text: `ε=${(eff * 100).toFixed(2)}%${this.draft.runes[q] ? ` (raw ${(raw * 100).toFixed(2)}%, d=${2 * this.draft.runes[q]! + 1})` : ''}` })));
    }
    return out;
  }

  private joints(): HTMLElement | null {
    const js = this.preview.joints;
    if (!js.length) return null;
    const box = h('div', { class: 'cb-joints' }, h('div', { class: 'cb-k', text: this.expert ? 'Joint distribution of linked lines' : 'Linked orbs fire together' }));
    for (const j of js) {
      const lines = j.lines;
      const lead = lines[0]!;
      const leadName = this.draft.abilities[lead] ? ABILITIES[this.draft.abilities[lead]!].name : orbName(lead);
      const grp = h('div', { class: 'cb-joint' }, h('div', { class: 'cb-joint-h', text: `When you cast ${leadName} (${orbName(lead)}):` }));
      for (const o of j.outcomes) {
        const lp = this.preview.lines;
        const pills = o.bits.map((bit, k) => {
          const q = lines[k]!;
          const hue = bit ? lp[q]!.hueB : lp[q]!.hueA;
          return h('span', { class: 'cb-pill', style: `--c:${elHex(hue)}` }, h('img', { class: 'cb-elicon', src: elementIcon(hue), alt: elName(hue) }), formName(this.draft.abilities[q] ?? null, bit, hue));
        });
        const sep: HTMLElement[] = [];
        pills.forEach((p, i) => { if (i) sep.push(h('span', { class: 'cb-plus', text: '+' })); sep.push(p); });
        const ket = this.expert ? h('code', { class: 'cb-ket', text: `|${[...o.bits].reverse().join('')}⟩` }) : null;
        grp.append(h('div', { class: 'cb-joint-row' }, ket, ...sep, h('span', { class: 'cb-meter sm' }, h('i', { style: `width:${(o.p * 100).toFixed(1)}%` })), h('b', { text: this.expert ? o.p.toFixed(4) : pct(o.p) })));
      }
      const same = j.outcomes.every((o) => o.bits.every((x) => x === o.bits[0]));
      const diff = lines.length === 2 && j.outcomes.every((o) => o.bits[0] !== o.bits[1]);
      if (j.outcomes.length > 1 && (same || diff)) grp.append(h('div', { class: 'cb-joint-note', text: same ? 'Their forms always match: entangled.' : 'Their forms always differ: entangled.' }));
      box.append(grp);
    }
    return box;
  }

  private expertPanel(): HTMLElement {
    const ev = this.preview.ev;
    const n = this.qubits;
    return h('div', { class: 'cb-expertbox' },
      h('div', { class: 'cb-k', text: 'State vector (most likely branch)' }),
      h('code', { class: 'cb-ketline', text: `|ψ⟩ = ${ketString(ev.state)}` }),
      h('div', { class: 'cb-x-note', text: `Bits read ${orbName(n - 1)} … ${orbName(0)} (left to right). ${this.preview.gates} gates, ${ev.branches} measurement branch${ev.branches === 1 ? '' : 'es'}${isAttuned(this.draft, n, this.dirty ? null : this.host.progress.locks) ? ', locks attuned' : ''}. Crowding adds 0.6% per gate beyond 6.` }));
  }

  private footer(): HTMLElement {
    const p = this.host.progress;
    const err = checkBoard(this.draft, this.rules());
    const warn: string[] = [];
    for (let q = 0; q < Math.min(ACTIVE_LINES, this.qubits); q++) if (!this.draft.abilities[q]) warn.push(`${orbName(q)} has no ability yet.`);
    for (const lp of this.preview.lines) if (lp.stability < 0.75) warn.push(`${orbName(lp.q)} is very unstable.`);
    const box = h('div', { class: 'cb-warn' });
    if (err) box.append(h('div', { class: 'bad', text: `⚠ ${err}` }));
    for (const w of warn.slice(0, 3)) box.append(h('div', { class: 'warn', text: `• ${w}` }));
    const status = h('div', { class: `cb-status ${this.status?.kind ?? ''}`, text: this.status?.text ?? '' });
    status.setAttribute('aria-live', 'polite');

    const left = h('div', { class: 'cb-foot-l' }, box, status);
    const btns = h('div', { class: 'cb-foot-r' });
    if (this.host.tutorialActive()) {
      const armedSkip = performance.now() < this.skipArmedUntil;
      btns.append(h('button', { class: 'cb-skip', text: armedSkip ? 'Really skip? Click again' : 'Skip the story', data: { focus: 'skip' }, on: { click: () => {
        if (performance.now() < this.skipArmedUntil) { this.skipArmedUntil = 0; this.host.skipStory(); } else { this.skipArmedUntil = performance.now() + 4000; this.render(); window.setTimeout(() => this.render(), 4100); }
      } } }));
    }
    if (this.dirty) btns.append(h('button', { class: 'cb-revert', text: 'Revert', data: { focus: 'revert' }, title: 'Throw away unsaved changes', on: { click: () => { this.draft = cloneBoard(p.board); this.editedSinceLoad = false; this.armed = null; this.recompute(); this.render(); } } }));
    const at = h('button', { class: `primary cb-attune${this.dirty && !err ? ' hot' : ''}`, data: { focus: 'attune' }, on: { click: () => this.attune() } },
      h('i', { class: 'cb-attune-fill' }), h('span', { class: 'cb-attune-t', text: 'Attune' }));
    at.title = 'Save this board to your orbs. Re-rolls every Lock-in.';
    this.attuneBtn = at;
    btns.append(at);
    this.tick();
    return h('div', { class: 'cb-foot' }, left, btns);
  }

  /** Cheap per-frame update of time-based bits (attune cooldown), without a re-render. */
  tick(): void {
    const at = this.attuneBtn;
    if (!at || !at.isConnected) return;
    const p = this.host.progress;
    const now = this.host.now();
    const wait = p.attuneReady - now;
    const err = checkBoard(this.draft, this.rules());
    const pending = this.sent && performance.now() - this.sentAt < 2500;
    if (this.sent && !pending) { this.sent = null; this.say('Not attuned: the world refused this board (see the message on the left).', 'bad'); }
    const t = pending ? 'Attuning…' : wait > 0 ? `Attune in ${Math.ceil(wait / 1000)}s` : this.dirty ? 'Attune changes' : 'Attune';
    const span = at.querySelector('.cb-attune-t')!;
    if (span.textContent !== t) span.textContent = t;
    const dis = !!err || wait > 0 || !!pending;
    if (at.disabled !== dis) at.disabled = dis;
    (at.querySelector('.cb-attune-fill') as HTMLElement).style.width = wait > 0 ? `${Math.min(100, (wait / 5000) * 100)}%` : '0%';
  }

  // ── Links (SVG threads) ──

  drawLinks(): void {
    const wrap = this.el.querySelector<HTMLElement>('.cb-lines');
    const svg = wrap?.querySelector('svg.cb-links');
    if (!wrap || !svg) return;
    const wr = wrap.getBoundingClientRect();
    svg.setAttribute('width', String(wr.width));
    svg.setAttribute('height', String(wr.height));
    svg.setAttribute('viewBox', `0 0 ${wr.width} ${wr.height}`);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const centre = (q: number, c: number) => {
      const el = wrap.querySelector<HTMLElement>(`.cb-cell[data-q="${q}"][data-c="${c}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left - wr.left + r.width / 2, y: r.top - wr.top + r.height / 2 };
    };
    const NS = 'http://www.w3.org/2000/svg';
    const thread = (a: { x: number; y: number }, b: { x: number; y: number }, cls: string, color: string) => {
      const dy = b.y - a.y, bulge = Math.min(14, Math.abs(dy) * 0.12);
      const d = `M${a.x} ${a.y} C${a.x + bulge} ${a.y + dy * 0.33}, ${b.x - bulge} ${a.y + dy * 0.66}, ${b.x} ${b.y}`;
      for (const k of ['glow', 'core', 'flow']) {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', d);
        p.setAttribute('class', `${cls} ${k}`);
        p.style.setProperty('--c', color);
        svg.append(p);
      }
    };
    const n = this.qubits;
    for (let q = 0; q < n; q++) for (let c = 0; c < BOARD_COLS; c++) {
      const cell = this.draft.lines[q]![c];
      if (cell?.g !== 'cx' || cell.t === undefined || cell.t >= n) continue;
      const a = centre(q, c), b = centre(cell.t, c);
      if (a && b) thread(a, b, 'cb-thread', hex(GATES.cx.color));
    }
    const arm = this.armed;
    if (arm?.kind === 'link' && this.hoverTarget !== null) {
      const a = centre(arm.q, arm.c), b = centre(this.hoverTarget, arm.c);
      if (a && b) thread(a, b, 'cb-thread preview', hex(GATES.cx.color));
    }
  }

  // ── tooltips ──

  private gateTip(g: GateId, t?: number): HTMLElement {
    const d = GATES[g];
    const p = this.host.progress;
    const box = h('div', { class: 'tip cb-tip' },
      h('div', { class: 'tip-name' }, h('img', { class: 'cb-tipgem', src: gateTile(g, this.expert ? 'expert' : 'friendly') }), d.name, this.expert ? h('code', { text: ` ${d.expert}` }) : null),
      h('div', { class: 'tip-desc', text: d.desc }));
    if (t !== undefined) box.append(h('div', { class: 'tip-line', text: `Connected to ${orbName(t)}.` }));
    if (this.expert) box.append(h('div', { class: 'tip-line', text: `Error rate ${(d.err * 100).toFixed(1)}% per use` }));
    box.append(h('div', { class: 'tip-val', text: `${available(this.draft, p.gates)[g]} of ${p.gates[g] ?? 0} left` }));
    if (p.codex.includes(d.codex)) box.append(h('div', { class: 'small dim', text: 'Qubitpedia: see the ❖ tab.' }));
    return box;
  }

  private abilityTip(a: AbilityId): HTMLElement {
    const d = ABILITIES[a];
    const forms = d.forms.map((f, i) => h('div', { class: 'tip-line cb-tipform' }, h('img', { class: 'cb-elicon', src: elementIcon(f.hue), alt: '' }), `${i ? 'Form B' : 'Form A'}: ${f.name}`));
    return h('div', { class: 'tip cb-tip' }, h('div', { class: 'tip-name', text: `${d.glyph} ${d.name}` }), h('div', { class: 'tip-desc', text: d.desc }), ...forms, h('div', { class: 'tip-kind', text: `Cooldown ${d.cd}s` }));
  }
}

/** The two strands of a light rail on one half of a cell: one for each form, as thick as its chance. */
function strands(s: RailSeg, side: 'l' | 'r'): HTMLElement[] {
  const pA = 1 - s.p1, pB = s.p1;
  const split = pA > 0.02 && pB > 0.02;
  const w = (p: number) => (p < 0.02 ? 0 : Math.max(1, Math.round(1 + p * 3)));
  const mk = (form: 'a' | 'b', p: number, hue: number) => {
    const el = document.createElement('i');
    el.className = `cb-r ${side} ${form}${split ? ' split' : ''}`;
    el.style.cssText = `--c:${elHex(hue)};--w:${w(p)}px;opacity:${p < 0.02 ? 0 : (0.55 + 0.45 * p).toFixed(2)}`;
    return el;
  };
  return [mk('a', pA, s.hueA), mk('b', pB, s.hueB)];
}
