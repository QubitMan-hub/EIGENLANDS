/**
 * The Circuit Board: a character's progression "talent tree", which is a real quantum circuit.
 * Lines = qubits (orbs), each powering one ability; cells hold gates. Shared by the client (live preview)
 * and the server (attune + casting), so both always agree. See docs/design/phase3-4-circuit-multiplayer.md.
 */
import {
  ABILITIES, ACTIVE_LINES, ELEMENTS, FLUX, hueWrap, isAbilityId, type AbilityId,
} from './classes';
import { MAX_QUBITS, QState, cumulative, repetitionError, sampleIndex, fmtAmp } from './quantum';

export type GateId = 'h' | 'x' | 'z' | 's' | 't' | 'cx' | 'm';
export const GATE_IDS: GateId[] = ['h', 'x', 't', 's', 'z', 'cx', 'm'];

export interface GateDef {
  id: GateId;
  /** friendly verb shown to everyone */
  name: string;
  glyph: string;
  /** real circuit symbol for Expert View */
  expert: string;
  /** palette index */
  color: number;
  desc: string;
  /** chance this gate adds a slip (bit flip) to its line(s) */
  err: number;
  /** Qubitpedia entry unlocked by first use */
  codex: string;
}

export const GATES: Record<GateId, GateDef> = {
  h: { id: 'h', name: 'Split', glyph: '◐', expert: 'H', color: 44, err: 0.01, codex: 'superposition', desc: 'Splits the ability: it can come out as either form. You only find out which when you cast.' },
  x: { id: 'x', name: 'Flip', glyph: '⇅', expert: 'X', color: 35, err: 0.005, codex: 'xgate', desc: 'Flips the ability to its opposite form and element.' },
  t: { id: 't', name: 'Tune ¼', glyph: '◔', expert: 'T', color: 38, err: 0.004, codex: 'phase', desc: 'Turns a split orb\'s colour one small step. Only shows on a split orb.' },
  s: { id: 's', name: 'Tune ½', glyph: '◑', expert: 'S', color: 36, err: 0.004, codex: 'phase', desc: 'Turns a split orb\'s colour two steps. Only shows on a split orb.' },
  z: { id: 'z', name: 'Tune', glyph: '●', expert: 'Z', color: 45, err: 0.004, codex: 'phase', desc: 'Turns a split orb\'s colour halfway round the wheel. Split it again afterwards and the colours interfere.' },
  cx: { id: 'cx', name: 'Link', glyph: '⛓', expert: 'CNOT', color: 47, err: 0.03, codex: 'entanglement', desc: 'Links this orb to another. Casting this one also fires the linked one, and their results become connected.' },
  m: { id: 'm', name: 'Lock in', glyph: '◉', expert: 'M', color: 22, err: 0.01, codex: 'measurement', desc: 'Decides this orb\'s result once, when you attune. It then stays fixed and hits harder.' },
};

export const isGateId = (v: unknown): v is GateId => typeof v === 'string' && Object.hasOwn(GATES, v);

export const BOARD_COLS = 8;
export const MAX_LOCKS = 4;
export const MAX_RUNES_PER_LINE = 2;
export const CROWD_FREE_GATES = 6;
export const CROWD_ERR = 0.006;
export const RUNE_PRICE = 150;
export const ATTUNE_COOLDOWN_MS = 5000;
/** |ρ10| below this means the line carries no colour (it is not split, or it is entangled). */
export const COHERENCE_MIN = 0.05;
export const QUBIT_UNLOCK_LEVELS = [1, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33];

/** Orbs unlocked at `level`; `bonus` covers the tutorial's early second orb. */
export function qubitsForLevel(level: number, bonus = 0): number {
  let n = 0;
  for (const l of QUBIT_UNLOCK_LEVELS) if (level >= l) n++;
  return Math.min(MAX_QUBITS, Math.max(1, n) + bonus);
}

export interface Cell { g: GateId; /** Link target line */ t?: number }
export interface Board {
  /** MAX_QUBITS lines × BOARD_COLS cells */
  lines: Array<Array<Cell | null>>;
  /** ability on each line */
  abilities: Array<AbilityId | null>;
  /** Error Correction runes on each line (0..2) */
  runes: number[];
}
/** Lock outcomes decided at attune time, keyed `${line}:${col}`. */
export type Locks = Record<string, 0 | 1>;
export type GateCounts = Record<GateId, number>;

export const lockKey = (q: number, c: number) => `${q}:${c}`;
export const emptyGateCounts = (): GateCounts => ({ h: 0, x: 0, z: 0, s: 0, t: 0, cx: 0, m: 0 });

export function emptyBoard(): Board {
  return {
    lines: Array.from({ length: MAX_QUBITS }, () => Array.from({ length: BOARD_COLS }, () => null)),
    abilities: Array.from({ length: MAX_QUBITS }, () => null),
    runes: Array.from({ length: MAX_QUBITS }, () => 0),
  };
}

export function cloneBoard(b: Board): Board {
  return { lines: b.lines.map((l) => l.map((c) => (c ? { ...c } : null))), abilities: [...b.abilities], runes: [...b.runes] };
}

const isInt = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;

/** Coerce anything (stored JSON, a client message) into a well-formed board. Shape only; rules are `checkBoard`. */
export function validBoard(raw: unknown): Board {
  const b = emptyBoard();
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof Board, unknown>>;
  if (Array.isArray(r.lines)) {
    for (let q = 0; q < MAX_QUBITS; q++) {
      const line = r.lines[q];
      if (!Array.isArray(line)) continue;
      for (let c = 0; c < BOARD_COLS; c++) {
        const cell = line[c] as Partial<Cell> | null | undefined;
        if (!cell || typeof cell !== 'object' || !isGateId(cell.g)) continue;
        if (cell.g === 'cx') { if (isInt(cell.t, 0, MAX_QUBITS - 1) && cell.t !== q) b.lines[q]![c] = { g: 'cx', t: cell.t }; }
        else b.lines[q]![c] = { g: cell.g };
      }
    }
  }
  if (Array.isArray(r.abilities)) for (let q = 0; q < MAX_QUBITS; q++) { const a = r.abilities[q]; if (isAbilityId(a)) b.abilities[q] = a; }
  if (Array.isArray(r.runes)) for (let q = 0; q < MAX_QUBITS; q++) { const n = r.runes[q]; if (isInt(n, 0, MAX_RUNES_PER_LINE)) b.runes[q] = n; }
  return b;
}

export function validLocks(raw: unknown): Locks {
  const out: Locks = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const m = /^(\d+):(\d+)$/.exec(k);
      if (m && Number(m[1]) < MAX_QUBITS && Number(m[2]) < BOARD_COLS && (v === 0 || v === 1)) out[k] = v;
    }
  }
  return out;
}

/** Gates placed on the board (a Link counts once). */
export function placedGates(b: Board): GateCounts {
  const n = emptyGateCounts();
  for (const line of b.lines) for (const c of line) if (c) n[c.g]++;
  return n;
}

export interface BoardRules {
  /** unlocked orbs */
  qubits: number;
  /** gate tokens owned (placed ones included) */
  gates: GateCounts;
  /** runes owned (placed ones included) */
  runes: number;
  allowed: AbilityId[];
}

/** Why a board is not allowed, in plain words; null when it is fine. */
export function checkBoard(b: Board, rules: BoardRules): string | null {
  const used = placedGates(b);
  for (const g of GATE_IDS) if (used[g] > rules.gates[g]) return `You only have ${rules.gates[g]} ${GATES[g].name} gate${rules.gates[g] === 1 ? '' : 's'}.`;
  if (used.m > MAX_LOCKS) return `At most ${MAX_LOCKS} Lock-ins fit on one board.`;
  const runes = b.runes.reduce((a, r) => a + r, 0);
  if (runes > rules.runes) return 'Not enough Error Correction runes.';
  const seen = new Set<AbilityId>();
  for (let q = 0; q < MAX_QUBITS; q++) {
    const a = b.abilities[q];
    const inUse = q < rules.qubits;
    if (!inUse) {
      if (a || b.runes[q] || b.lines[q]!.some((c) => c)) return 'That orb is not unlocked yet.';
      continue;
    }
    if (a) {
      if (!rules.allowed.includes(a)) return `${ABILITIES[a].name} is not one of your abilities.`;
      if (seen.has(a)) return `${ABILITIES[a].name} is already on another orb.`;
      seen.add(a);
    }
  }
  for (let c = 0; c < BOARD_COLS; c++) {
    const busy = new Set<number>();
    for (let q = 0; q < rules.qubits; q++) {
      const cell = b.lines[q]![c];
      if (!cell) continue;
      if (busy.has(q)) return 'Two gates overlap in one column.';
      busy.add(q);
      if (cell.g === 'cx') {
        const t = cell.t;
        if (t === undefined || t === q || t >= rules.qubits) return 'A Link needs another unlocked orb to connect to.';
        if (busy.has(t) || b.lines[t]![c]) return 'A Link\'s far end must land on an empty spot.';
        busy.add(t);
      }
    }
  }
  return null;
}

// ───────────────────────── simulation ─────────────────────────

export interface Op { g: GateId; q: number; t?: number; c: number }

/** Gates in play order: column by column, top line first. */
export function compile(b: Board, n: number): Op[] {
  const ops: Op[] = [];
  for (let c = 0; c < BOARD_COLS; c++) {
    for (let q = 0; q < n; q++) {
      const cell = b.lines[q]![c];
      if (!cell) continue;
      if (cell.g === 'cx') { if (cell.t !== undefined && cell.t < n && cell.t !== q) ops.push({ g: 'cx', q, t: cell.t, c }); }
      else ops.push({ g: cell.g, q, c });
    }
  }
  return ops;
}

function applyOp(s: QState, op: Op): void {
  switch (op.g) {
    case 'h': s.h(op.q); break;
    case 'x': s.x(op.q); break;
    case 'z': s.z(op.q); break;
    case 's': s.s(op.q); break;
    case 't': s.t(op.q); break;
    case 'cx': s.cx(op.q, op.t!); break;
    case 'm': break; // handled by the caller
  }
}

export interface Evaluation {
  n: number;
  /** joint outcome probabilities over all n lines (index bit q = line q) */
  joint: Float64Array;
  cdf: Float64Array;
  /** ρ10 of each line just before the final read-out (mixture over unlocked branches) */
  rho: Array<{ re: number; im: number }>;
  /** P(line reads form B), noiseless */
  p1: number[];
  /** P(lock reads 1) for each lock (exactly 0/1 once attuned) */
  lockP1: Record<string, number>;
  /** a representative final state (the most likely branch), for Expert View */
  state: QState;
  branches: number;
}

/**
 * Evaluate a board. With `locks`, every Lock-in collapses to its stored outcome (an attuned board).
 * Without, every Lock-in branches both ways weighted by the Born rule (an exact preview of what attuning will do).
 */
export function evaluate(b: Board, n: number, locks?: Locks | null): Evaluation {
  n = Math.max(1, Math.min(MAX_QUBITS, n));
  const ops = compile(b, n);
  const joint = new Float64Array(1 << n);
  const rho = Array.from({ length: n }, () => ({ re: 0, im: 0 }));
  const lockW: Record<string, number> = {};
  const best: { w: number; s: QState | null } = { w: -1, s: null };
  let branches = 0;

  const finish = (s: QState, w: number) => {
    branches++;
    const p = s.probabilities();
    for (let i = 0; i < p.length; i++) joint[i] += w * p[i]!;
    for (let q = 0; q < n; q++) { const r = s.reduced(q); rho[q]!.re += w * r.cRe; rho[q]!.im += w * r.cIm; }
    if (w > best.w) { best.w = w; best.s = s; }
  };
  const run = (s: QState, from: number, w: number): void => {
    for (let i = from; i < ops.length; i++) {
      const op = ops[i]!;
      if (op.g !== 'm') { applyOp(s, op); continue; }
      const k = lockKey(op.q, op.c);
      if (locks) {
        const o = locks[k] ?? 0;
        s.collapse(op.q, o);
        lockW[k] = (lockW[k] ?? 0) + w * o;
        continue;
      }
      const p1 = s.prob1(op.q);
      lockW[k] = (lockW[k] ?? 0) + w * p1;
      if (p1 > 1e-9) { const s1 = 1 - p1 > 1e-9 ? s.clone() : s; s1.collapse(op.q, 1); run(s1, i + 1, w * p1); }
      if (1 - p1 > 1e-9) { s.collapse(op.q, 0); run(s, i + 1, w * (1 - p1)); }
      return;
    }
    finish(s, w);
  };
  run(new QState(n), 0, 1);

  const p1 = Array.from({ length: n }, (_, q) => {
    let s = 0;
    for (let i = 0; i < joint.length; i++) if (i & (1 << q)) s += joint[i]!;
    return Math.min(1, Math.max(0, s));
  });
  return { n, joint, cdf: cumulative(joint), rho, p1, lockP1: lockW, state: best.s!, branches };
}

/** Decide every Lock-in (attuning). `rand` returns [0,1). */
export function attuneLocks(b: Board, n: number, rand: () => number): Locks {
  n = Math.max(1, Math.min(MAX_QUBITS, n));
  const s = new QState(n);
  const locks: Locks = {};
  for (const op of compile(b, n)) {
    if (op.g === 'm') locks[lockKey(op.q, op.c)] = s.measure(op.q, rand());
    else applyOp(s, op);
  }
  return locks;
}

/** Raw slip chance of each line (before runes): its gates after its last Lock-in, plus crowding. */
export function rawLineErrors(b: Board, n: number): number[] {
  const ops = compile(b, n);
  const crowd = CROWD_ERR * Math.max(0, ops.length - CROWD_FREE_GATES);
  const keep = Array.from({ length: n }, () => 1);
  for (const op of ops) {
    const e = GATES[op.g].err;
    if (op.g === 'm') { keep[op.q] = 1 - e; continue; } // a lock resets the line's history
    keep[op.q]! *= 1 - e;
    if (op.g === 'cx') keep[op.t!]! *= 1 - e;
  }
  return keep.map((k) => Math.min(0.5, 1 - k + crowd));
}

/** Slip chance of each line after its Error Correction runes (a repetition code of distance 2r+1). */
export function lineErrors(b: Board, n: number): number[] {
  return rawLineErrors(b, n).map((p, q) => repetitionError(p, 2 * (b.runes[q] ?? 0) + 1));
}

/** Lines that fire when `q` is cast: q, then everything reachable through Links (control → target). */
export function firedLines(b: Board, n: number, q: number): number[] {
  const out = [q];
  const seen = new Set([q]);
  for (let i = 0; i < out.length; i++) {
    const from = out[i]!;
    for (let c = 0; c < BOARD_COLS; c++) {
      const cell = b.lines[from]?.[c];
      if (cell?.g === 'cx' && cell.t !== undefined && cell.t < n && !seen.has(cell.t)) { seen.add(cell.t); out.push(cell.t); }
    }
  }
  return out;
}

export function hasLock(b: Board, q: number): boolean { return b.lines[q]!.some((c) => c?.g === 'm'); }

/** Colour steps (0..7) a line has been tuned by, or null when it carries no colour. */
export function tuneSteps(ev: Evaluation, q: number): number | null {
  const r = ev.rho[q]!;
  if (Math.hypot(r.re, r.im) < COHERENCE_MIN) return null;
  return hueWrap(Math.atan2(r.im, r.re) / (Math.PI / 4));
}

/** Element of a line's form `bit` (0 = A, 1 = B), including tuning. */
export function lineHue(b: Board, ev: Evaluation, q: number, bit: 0 | 1): number {
  const a = b.abilities[q];
  const base = a ? ABILITIES[a].forms[bit].hue : bit ? 4 : 0;
  const st = tuneSteps(ev, q);
  return hueWrap(base + (st ?? 0));
}

export interface CastLine { q: number; bit: 0 | 1; hue: number; misfire: boolean; locked: boolean; link: boolean }

/** Sample one cast of line `q` from an attuned evaluation. `rand` returns [0,1). */
export function castLines(b: Board, ev: Evaluation, q: number, errors: number[], rand: () => number): CastLine[] {
  const idx = sampleIndex(ev.cdf, rand());
  return firedLines(b, ev.n, q).map((line) => {
    let bit: 0 | 1 = (idx >> line) & 1 ? 1 : 0;
    const misfire = rand() < (errors[line] ?? 0);
    if (misfire) bit = bit ? 0 : 1;
    return { q: line, bit, hue: misfire ? FLUX : lineHue(b, ev, line, bit), misfire, locked: hasLock(b, line), link: line !== q };
  });
}

// ───────────────────────── preview ─────────────────────────

export interface LinePreview {
  q: number;
  ability: AbilityId | null;
  /** chance of form B including slips */
  pB: number;
  /** chance of form B with a perfect board */
  pBIdeal: number;
  hueA: number;
  hueB: number;
  tuned: boolean;
  /** 1 - slip chance */
  stability: number;
  rawStability: number;
  /** lock state: the attuned outcome, 'pending' when the board has a lock but is not attuned, null when no lock */
  locked: 0 | 1 | 'pending' | null;
  fires: number[];
  firedBy: number[];
  active: boolean;
  summary: string;
}
export interface JointPreview { lines: number[]; outcomes: Array<{ bits: Array<0 | 1>; p: number }> }
export interface Preview { lines: LinePreview[]; joints: JointPreview[]; ev: Evaluation; gates: number }

export function oddsWord(p: number): string {
  if (p <= 0.005) return 'never';
  if (p < 0.1) return 'rarely';
  if (p < 0.35) return 'sometimes';
  if (p < 0.45) return 'a bit less than half the time';
  if (p <= 0.55) return 'half the time';
  if (p <= 0.65) return 'a bit more than half the time';
  if (p < 0.9) return 'usually';
  if (p < 0.995) return 'almost always';
  return 'always';
}

function formLabel(a: AbilityId | null, bit: 0 | 1, hue: number): string {
  if (!a) return bit ? 'second form' : 'first form';
  const f = ABILITIES[a].forms[bit];
  const el = ELEMENTS[hue]!.name;
  const base = ELEMENTS[f.hue]!.name;
  return hue === f.hue ? f.name : f.name.replace(base, el);
}

/** Everything the Board shows, from a board and (optionally) its attuned locks. */
export function boardPreview(b: Board, n: number, locks: Locks | null): Preview {
  n = Math.max(1, Math.min(MAX_QUBITS, n));
  const attuned = !!locks && compile(b, n).filter((o) => o.g === 'm').every((o) => lockKey(o.q, o.c) in locks);
  const ev = evaluate(b, n, attuned ? locks : null);
  const raw = rawLineErrors(b, n);
  const err = lineErrors(b, n);
  const firedBy: number[][] = Array.from({ length: n }, () => []);
  const fires = Array.from({ length: n }, (_, q) => firedLines(b, n, q).slice(1));
  fires.forEach((f, q) => f.forEach((t) => firedBy[t]!.push(q)));
  const lines: LinePreview[] = [];
  for (let q = 0; q < n; q++) {
    const pI = ev.p1[q]!, e = err[q]!;
    const pB = pI * (1 - e) + (1 - pI) * e;
    const hueA = lineHue(b, ev, q, 0), hueB = lineHue(b, ev, q, 1);
    const lockOps = compile(b, n).filter((o) => o.g === 'm' && o.q === q);
    const lastLock = lockOps[lockOps.length - 1];
    const locked: LinePreview['locked'] = !lastLock ? null : attuned ? (locks![lockKey(lastLock.q, lastLock.c)] ?? 0) : 'pending';
    const lp: LinePreview = {
      q, ability: b.abilities[q] ?? null, pB, pBIdeal: pI, hueA, hueB, tuned: tuneSteps(ev, q) !== null,
      stability: 1 - e, rawStability: 1 - raw[q]!, locked, fires: fires[q]!, firedBy: firedBy[q]!, active: q < ACTIVE_LINES, summary: '',
    };
    lp.summary = summarize(b, lp);
    lines.push(lp);
  }
  // joint outcomes for each group of linked lines
  const joints: JointPreview[] = [];
  const grouped = new Set<number>();
  for (let q = 0; q < n; q++) {
    if (grouped.has(q) || !fires[q]!.length || firedBy[q]!.length) continue;
    const group = [q, ...fires[q]!];
    group.forEach((g) => grouped.add(g));
    const m = new Map<number, number>();
    for (let i = 0; i < ev.joint.length; i++) {
      const pr = ev.joint[i]!;
      if (pr < 1e-12) continue;
      let key = 0;
      group.forEach((g, k) => { if (i & (1 << g)) key |= 1 << k; });
      m.set(key, (m.get(key) ?? 0) + pr);
    }
    const outcomes = [...m.entries()].filter(([, p]) => p > 0.002).sort((a, c) => c[1] - a[1]).slice(0, 6)
      .map(([key, p]) => ({ bits: group.map((_, k) => ((key >> k) & 1 ? 1 : 0) as 0 | 1), p }));
    joints.push({ lines: group, outcomes });
  }
  return { lines, joints, ev, gates: compile(b, n).length };
}

function summarize(b: Board, l: LinePreview): string {
  const a = l.ability;
  if (!a) return l.fires.length ? 'No ability here yet, but it still passes its Link along.' : 'Drag an ability onto this orb to use it.';
  const name = ABILITIES[a].name;
  const A = formLabel(a, 0, l.hueA), B = formLabel(a, 1, l.hueB);
  const parts: string[] = [];
  if (l.locked === 0 || l.locked === 1) parts.push(`Locked in: ${l.locked ? B : A}, with extra power.`);
  else if (l.pBIdeal <= 0.005) parts.push(`${name}: always ${A}.`);
  else if (l.pBIdeal >= 0.995) parts.push(`${name}: always ${B}.`);
  else parts.push(`${name}: ${A} or ${B}; the second form comes ${oddsWord(l.pBIdeal)}.`);
  if (l.locked === 'pending') parts.push('Its Lock-in is decided when you attune.');
  if (l.tuned && l.locked === null) parts.push(`Tuned towards ${ELEMENTS[l.hueA]!.name}.`);
  if (l.fires.length) parts.push(`Also fires ${l.fires.map((t) => (b.abilities[t] ? ABILITIES[b.abilities[t]!].name : 'an empty orb')).join(' and ')}.`);
  if (!l.active && !l.firedBy.length) parts.push('This is a support orb: Link an active orb to it to make it fire.');
  if (l.stability < 0.75) parts.push('Very unstable: add Error Correction runes or use fewer gates.');
  else if (l.stability < 0.9) parts.push('A little unstable.');
  return parts.join(' ');
}

// ───────────────────────── rewards ─────────────────────────

const LEVEL_CYCLE: GateId[] = ['h', 't', 'x', 'cx', 's', 'h', 'z', 'm', 'cx', 't'];

/** Gates and runes earned by reaching `level` (level 1 gives nothing). */
export function rewardsForLevel(level: number): { gates: GateId[]; runes: number } {
  if (level < 2) return { gates: [], runes: 0 };
  const gates: GateId[] = [LEVEL_CYCLE[(level - 2) % LEVEL_CYCLE.length]!];
  if (level % 5 === 0) gates.push('h');
  return { gates, runes: level % 4 === 0 ? 1 : 0 };
}

// ───────────────────────── Expert View ─────────────────────────

/** The largest amplitudes as ket notation, e.g. "0.707|00⟩ + 0.707|11⟩". Bit strings read line n-1 … line 0. */
export function ketString(s: QState, max = 6): string {
  const items: Array<{ i: number; p: number }> = [];
  for (let i = 0; i < s.size; i++) { const p = s.re[i]! ** 2 + s.im[i]! ** 2; if (p > 1e-6) items.push({ i, p }); }
  items.sort((a, c) => c.p - a.p);
  const shown = items.slice(0, max).sort((a, c) => a.i - c.i);
  const body = shown.map(({ i }) => `${fmtAmp(s.re[i]!, s.im[i]!)}|${i.toString(2).padStart(s.n, '0')}⟩`).join(' + ');
  return items.length > max ? `${body} + … (${items.length - max} more)` : body;
}
