/**
 * Pure Circuit Board editing model (no DOM, no Pixi): placing, moving and removing gates, Links, abilities and runes,
 * plus the small maths the HUD needs (cooldowns, placeholders). Every edit returns a new board or an explanation,
 * so the UI can show why something does not fit. Unit-tested in test/p3model.test.ts.
 */
import {
  ABILITIES,
  BOARD_COLS,
  COHERENCE_MIN,
  GATES,
  MAX_LOCKS,
  MAX_QUBITS,
  MAX_RUNES_PER_LINE,
  cloneBoard,
  compile,
  evaluate,
  lineHue,
  lockKey,
  placedGates,
  tuneSteps,
  type AbilityId,
  type Board,
  type Cell,
  type Evaluation,
  type GateCounts,
  type GateId,
  type Locks,
} from '@eigenlands/shared';

export type EditResult = { ok: true; board: Board } | { ok: false; why: string };
/** Directional reach is the maximum possible form before the quantum outcome is measured. */
export function abilityTargeting(a: AbilityId): { skill: boolean; enemy: boolean; ally: boolean; range: number } {
  const forms = ABILITIES[a].forms,
    kinds = forms.map((f) => f.kind);
  const has = (...k: string[]) => kinds.some((x) => k.includes(x));
  const directional = forms.filter((f) =>
    ['bolt', 'strike', 'blink', 'blink_back', 'link_enemy', 'link_ally'].includes(f.kind),
  );
  return {
    skill: !!directional.length,
    enemy: has('bolt', 'strike', 'link_enemy', 'pull', 'swap'),
    ally: has('heal', 'link_ally', 'swap'),
    range: Math.max(0, ...directional.map((f) => f.range ?? f.radius ?? 7)),
  };
}
const ok = (board: Board): EditResult => ({ ok: true, board });
const no = (why: string): EditResult => ({ ok: false, why });

export interface Spot {
  q: number;
  c: number;
}

/** What occupies a cell: a gate placed there, the far end of a Link from another line, or nothing. */
export type Occupant = { kind: 'gate'; cell: Cell } | { kind: 'linkEnd'; from: number } | null;

export function occupant(b: Board, q: number, c: number): Occupant {
  const cell = b.lines[q]?.[c];
  if (cell) return { kind: 'gate', cell };
  for (let o = 0; o < MAX_QUBITS; o++) {
    const x = b.lines[o]?.[c];
    if (o !== q && x?.g === 'cx' && x.t === q) return { kind: 'linkEnd', from: o };
  }
  return null;
}

export const isFree = (b: Board, q: number, c: number): boolean => occupant(b, q, c) === null;

/** Gate tokens left in the collection (owned minus placed). Never negative. */
export function available(b: Board, owned: GateCounts): GateCounts {
  const used = placedGates(b);
  const out = { ...owned };
  for (const g of Object.keys(out) as GateId[]) out[g] = Math.max(0, (owned[g] ?? 0) - (used[g] ?? 0));
  return out;
}

export function runesLeft(b: Board, owned: number): number {
  return Math.max(0, owned - b.runes.reduce((a, r) => a + r, 0));
}

/** Lines a Link placed at (q, c) may connect to: other unlocked lines whose cell in that column is free. */
export function linkTargets(b: Board, q: number, c: number, qubits: number): number[] {
  const out: number[] = [];
  for (let t = 0; t < qubits; t++) if (t !== q && isFree(b, t, c)) out.push(t);
  return out;
}

const inRange = (q: number, c: number, qubits: number) => q >= 0 && q < qubits && c >= 0 && c < BOARD_COLS;

/** Place gate `g` at (q, c). A Link needs `target`. Checks ownership, the unlocked orbs and free cells. */
export function placeGate(
  b: Board,
  q: number,
  c: number,
  g: GateId,
  owned: GateCounts,
  qubits: number,
  target?: number,
): EditResult {
  if (!inRange(q, c, qubits)) return no('That orb is not unlocked yet.');
  if (!isFree(b, q, c)) return no('That spot is taken. Remove the gate there first.');
  if (available(b, owned)[g] < 1) return no(`No ${GATES[g].name} gates left in your collection.`);
  if (g === 'm' && placedGates(b).m >= MAX_LOCKS) return no(`At most ${MAX_LOCKS} Lock-ins fit on one board.`);
  const nb = cloneBoard(b);
  if (g === 'cx') {
    if (target === undefined || target === q || target < 0 || target >= qubits)
      return no('A Link needs another unlocked orb to connect to.');
    if (!isFree(b, target, c)) return no("The Link's far end must land on an empty spot.");
    nb.lines[q]![c] = { g: 'cx', t: target };
  } else nb.lines[q]![c] = { g };
  return ok(nb);
}

/** Remove whatever is at (q, c). Removing a Link's far end removes the whole Link. Returns the gate freed. */
export function removeAt(b: Board, q: number, c: number): { board: Board; freed: GateId | null } {
  const o = occupant(b, q, c);
  if (!o) return { board: b, freed: null };
  const nb = cloneBoard(b);
  if (o.kind === 'gate') {
    nb.lines[q]![c] = null;
    return { board: nb, freed: o.cell.g };
  }
  nb.lines[o.from]![c] = null;
  return { board: nb, freed: 'cx' };
}

/**
 * Move the gate at `from` to `to`. A Link keeps its target line when it can (and is refused when it cannot);
 * dragging a Link's far end re-targets the Link to the line it is dropped on (same column only).
 */
export function moveGate(b: Board, from: Spot, to: Spot, qubits: number): EditResult {
  if (from.q === to.q && from.c === to.c) return ok(b);
  if (!inRange(to.q, to.c, qubits)) return no('That orb is not unlocked yet.');
  const o = occupant(b, from.q, from.c);
  if (!o) return no('Nothing to move there.');
  if (o.kind === 'linkEnd') {
    if (to.c !== from.c) return no("A Link's far end stays in its column. Drag the Link itself to move it.");
    if (to.q === o.from) return no('A Link cannot connect an orb to itself.');
    if (!isFree(b, to.q, to.c)) return no('That spot is taken.');
    const nb = cloneBoard(b);
    nb.lines[o.from]![from.c] = { g: 'cx', t: to.q };
    return ok(nb);
  }
  const cell = o.cell;
  // the source cell is vacated first, so a gate may move onto a spot its own Link used to cover
  const without = removeAt(b, from.q, from.c).board;
  if (!isFree(without, to.q, to.c)) return no('That spot is taken.');
  const nb = cloneBoard(without);
  if (cell.g === 'cx') {
    const t = cell.t ?? -1;
    if (t === to.q || t < 0 || t >= qubits) return no('A Link cannot connect an orb to itself.');
    if (!isFree(without, t, to.c)) return no("The Link's far end would land on a taken spot.");
    nb.lines[to.q]![to.c] = { g: 'cx', t };
  } else nb.lines[to.q]![to.c] = { g: cell.g };
  return ok(nb);
}

/** Put ability `a` on line q (null clears). If it already sits on another line, the two lines swap. */
export function setAbility(b: Board, q: number, a: AbilityId | null, allowed: AbilityId[], qubits: number): EditResult {
  if (q < 0 || q >= qubits) return no('That orb is not unlocked yet.');
  if (a && !allowed.includes(a)) return no(`${ABILITIES[a].name} is not one of your abilities.`);
  const nb = cloneBoard(b);
  const prev = nb.abilities[q] ?? null;
  if (a) {
    const other = nb.abilities.indexOf(a);
    if (other >= 0 && other !== q) nb.abilities[other] = prev;
  }
  nb.abilities[q] = a;
  return ok(nb);
}

/** Set the number of Error Correction runes on line q (0..2), within the runes owned. */
export function setRunes(b: Board, q: number, n: number, owned: number, qubits: number): EditResult {
  if (q < 0 || q >= qubits) return no('That orb is not unlocked yet.');
  n = Math.max(0, Math.min(MAX_RUNES_PER_LINE, Math.round(n)));
  const others = b.runes.reduce((s, r, i) => s + (i === q ? 0 : r), 0);
  if (others + n > owned)
    return no(
      owned
        ? 'No Error Correction runes left. Buy one or take one off another orb.'
        : 'You have no Error Correction runes yet.',
    );
  const nb = cloneBoard(b);
  nb.runes[q] = n;
  return ok(nb);
}

/** Strip everything the rules no longer allow (orbs above `qubits`, abilities not allowed). Used after class changes. */
export function fitBoard(b: Board, qubits: number, allowed: AbilityId[]): Board {
  const nb = cloneBoard(b);
  for (let q = 0; q < MAX_QUBITS; q++) {
    if (q >= qubits) {
      nb.lines[q] = nb.lines[q]!.map(() => null);
      nb.abilities[q] = null;
      nb.runes[q] = 0;
      continue;
    }
    if (nb.abilities[q] && !allowed.includes(nb.abilities[q]!)) nb.abilities[q] = null;
    nb.lines[q] = nb.lines[q]!.map((c) => (c?.g === 'cx' && (c.t === undefined || c.t >= qubits) ? null : c));
  }
  return nb;
}

/** Gates on a line, left to right (for the tutorial's "Split → Tune → Split" checks and the summary). */
export function lineGates(b: Board, q: number): GateId[] {
  return (b.lines[q] ?? []).filter((c): c is Cell => !!c).map((c) => c.g);
}

export const boardsEqual = (a: Board, b: Board): boolean => JSON.stringify(a) === JSON.stringify(b);

/** True when every Lock-in on the board has a stored outcome (the board is attuned as it stands). */
export function isAttuned(b: Board, n: number, locks: Locks | null): boolean {
  return (
    !!locks &&
    compile(b, n)
      .filter((o) => o.g === 'm')
      .every((o) => lockKey(o.q, o.c) in locks)
  );
}

/** One stretch of an orb's light rail: the chance of form B there and the colour of each form. */
export interface RailSeg {
  p1: number;
  hueA: number;
  hueB: number;
  tuned: boolean;
}

/**
 * The state of every line between columns, for drawing the rails: `out[k][q]` is line q after columns 0..k-1
 * (so `out[0]` is the untouched orb and `out[BOARD_COLS]` the final read-out). Noise-free, like the bars' "ideal".
 */
export function railStates(b: Board, n: number, locks: Locks | null): RailSeg[][] {
  n = Math.max(1, Math.min(MAX_QUBITS, n));
  const lk = isAttuned(b, n, locks) ? locks : null;
  const out: RailSeg[][] = [];
  let last = -1;
  for (let k = 0; k <= BOARD_COLS; k++) {
    // columns with nothing in them do not change the state: reuse the previous evaluation
    const colEmpty = k > 0 && b.lines.slice(0, n).every((l) => !l[k - 1]);
    if (k > 0 && colEmpty && last >= 0) {
      out.push(out[last]!);
      continue;
    }
    const t = cloneBoard(b);
    for (const line of t.lines) for (let c = k; c < BOARD_COLS; c++) line[c] = null;
    const ev = evaluate(t, n, lk);
    out.push(
      Array.from({ length: n }, (_, q) => ({
        p1: ev.p1[q]!,
        hueA: lineHue(t, ev, q, 0),
        hueB: lineHue(t, ev, q, 1),
        tuned: tuneSteps(ev, q) !== null,
      })),
    );
    last = k;
  }
  return out;
}

/** Bloch azimuth of a line in degrees (0..360), or null when it carries no phase (not split, or entangled). */
export function azimuthDeg(ev: Evaluation, q: number): number | null {
  const r = ev.rho[q];
  if (!r || Math.hypot(r.re, r.im) < COHERENCE_MIN) return null;
  return ((Math.atan2(r.im, r.re) * 180) / Math.PI + 360) % 360;
}

// ───────────────────────── text ─────────────────────────

/** Replace `{board}`, `{cast}` … in Lumen's lines with the player's current bindings. Unknown keys stay as written. */
export function fillPlaceholders(text: string, labels: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => labels[k] ?? m);
}

// ───────────────────────── cooldowns ─────────────────────────

/** Remaining fraction (1 = just cast, 0 = ready) of a cooldown that ends at `readyAt` (server ms) and lasts `totalMs`. */
export function cdFraction(readyAt: number | undefined, now: number, totalMs: number): number {
  if (!readyAt || readyAt <= now || totalMs <= 0) return 0;
  return Math.min(1, (readyAt - now) / totalMs);
}

/** Short label for the time left: "4", "1.5", "" when ready. */
export function cdLabel(readyAt: number | undefined, now: number): string {
  if (!readyAt || readyAt <= now) return '';
  const s = (readyAt - now) / 1000;
  return s >= 2 ? String(Math.ceil(s)) : s.toFixed(1);
}

/** The bigger of a predicted local cooldown and the server's (the server always wins once it has answered). */
export function mergeReady(server: number | undefined, predicted: number | undefined, answered: boolean): number {
  if (answered) return server ?? 0;
  return Math.max(server ?? 0, predicted ?? 0);
}

/** Percent text without false precision: "50%", "85%", "<1%", ">99%". */
export function pct(p: number): string {
  if (p <= 0) return '0%';
  if (p >= 1) return '100%';
  if (p < 0.01) return '<1%';
  if (p > 0.99) return '>99%';
  return `${Math.round(p * 100)}%`;
}
