/**
 * Circuit Board progression: the persisted shape (`character_progress.data`), defaults for new characters and
 * validation of stored JSON (never trusted: a hand-edited or stale row is coerced into something the rules accept).
 */
import {
  ABILITIES, CLASSES, GATE_IDS, MAX_QUBITS, PLAYABLE_CLASSES, TUTORIAL, TUTORIAL_DONE,
  CODEX_BY_ID, GATES, allowedAbilities, checkBoard, compile, emptyBoard, emptyGateCounts, lockKey, qubitsForLevel,
  validBoard, validLocks,
  type AbilityId, type Board, type BoardRules, type ClassId, type GateCounts, type GateId, type Locks, type TutorialProgress,
} from '@eigenlands/shared';

// The shared `isClassId` / `isGateId` / `isAbilityId` / `isCodexId` use `in`, which also accepts prototype keys such as
// "toString" or "constructor". Client and stored input is checked with own-property tests instead.
const own = (o: object, v: unknown): v is string => typeof v === 'string' && Object.prototype.hasOwnProperty.call(o, v);
export const isClass = (v: unknown): v is ClassId => own(CLASSES, v);
export const isAbility = (v: unknown): v is AbilityId => own(ABILITIES, v);
export const isGate = (v: unknown): v is GateId => own(GATES, v);
export const isCodex = (v: unknown): v is string => own(CODEX_BY_ID, v);

/** `validBoard` plus own-property checks on gate and ability ids. */
export function cleanBoard(raw: unknown): Board {
  const b = validBoard(raw);
  for (const line of b.lines) for (let c = 0; c < line.length; c++) if (line[c] && !isGate(line[c]!.g)) line[c] = null;
  for (let q = 0; q < b.abilities.length; q++) if (b.abilities[q] && !isAbility(b.abilities[q])) b.abilities[q] = null;
  return b;
}

/** Most gate tokens of one kind a character may hold (a sanity cap for stored data). */
export const MAX_GATE_TOKENS = 999;
/** Most Error Correction runes a character may hold: enough for every line of a full board. */
export const MAX_RUNES = MAX_QUBITS * 2;

export interface Progress {
  cls: ClassId;
  spec: string | null;
  second: ClassId | null;
  board: Board;
  /** Lock-in outcomes of the attuned board */
  locks: Locks;
  /** gate tokens owned (placed ones included) */
  gates: GateCounts;
  /** runes owned (placed ones included) */
  runes: number;
  codex: string[];
  tutorial: TutorialProgress;
  /** highest tutorial step whose start grant was handed out (-1: none); restarting never grants twice */
  tutGranted: number;
  /** the end-of-tutorial reward (or the skip reward) was handed out */
  tutRewarded: boolean;
  /** level rewards were granted up to and including this level */
  rewardedLevel: number;
  /** extra orbs on top of the level schedule (the tutorial's early second orb) */
  qubitBonus: number;
}

/** A brand-new character: a Wanderer holding one orb with Glimmer Bolt and no gates, at the start of the story. */
export function newProgress(): Progress {
  const board = emptyBoard();
  board.abilities[0] = 'glimmer';
  return {
    cls: 'wanderer', spec: null, second: null, board, locks: {}, gates: emptyGateCounts(), runes: 0, codex: [],
    tutorial: { step: 0, count: 0, skipped: false }, tutGranted: 0, tutRewarded: false, rewardedLevel: 1, qubitBonus: 0,
  };
}

const int = (v: unknown, lo: number, hi: number, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : d;

export function rulesFor(pr: Progress, level: number): BoardRules {
  return {
    qubits: qubitsForLevel(level, pr.qubitBonus),
    gates: pr.gates,
    runes: pr.runes,
    allowed: allowedAbilities(pr.cls, pr.second),
  };
}

/**
 * Put the class's abilities on the board: drop abilities the character may no longer slot, then fill empty unlocked
 * orbs with missing class abilities (in class order).
 */
export function placeAbilities(pr: Progress, qubits: number): void {
  const allowed = allowedAbilities(pr.cls, pr.second);
  const seen = new Set<AbilityId>();
  for (let q = 0; q < MAX_QUBITS; q++) {
    const a = pr.board.abilities[q];
    if (!a) continue;
    if (q >= qubits || !allowed.includes(a) || seen.has(a)) pr.board.abilities[q] = null;
    else seen.add(a);
  }
  const order: AbilityId[] = [...CLASSES[pr.cls].abilities, ...(pr.second ? CLASSES[pr.second].abilities : [])];
  for (const a of order) {
    if (seen.has(a) || !allowed.includes(a)) continue;
    const q = pr.board.abilities.findIndex((x, i) => i < qubits && !x);
    if (q < 0) break;
    pr.board.abilities[q] = a;
    seen.add(a);
  }
}

/** Every Lock-in on the board has a stored outcome (and no stale keys are kept). */
export function locksComplete(b: Board, n: number, locks: Locks): Locks | null {
  const out: Locks = {};
  for (const op of compile(b, n)) {
    if (op.g !== 'm') continue;
    const k = lockKey(op.q, op.c);
    if (locks[k] === undefined) return null;
    out[k] = locks[k]!;
  }
  return out;
}

/**
 * Coerce stored JSON into a valid Progress for a character at `level`. Anything malformed falls back to a safe value;
 * a board that breaks the rules is reset to the class's abilities with no gates (tokens are kept, so nothing is lost).
 * Returns the progress and whether the Lock-ins must be re-rolled (missing outcomes).
 */
export function validProgress(raw: unknown, level: number): { pr: Progress; reroll: boolean } {
  const pr = newProgress();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { pr, reroll: false };
  const r = raw as Record<string, unknown>;

  if (isClass(r.cls)) pr.cls = r.cls;
  if (pr.cls !== 'wanderer' && typeof r.spec === 'string' && CLASSES[pr.cls].specs.some((s) => s.id === r.spec)) pr.spec = r.spec;
  if (pr.cls !== 'wanderer' && isClass(r.second) && PLAYABLE_CLASSES.includes(r.second) && r.second !== pr.cls) pr.second = r.second;

  const g = (r.gates && typeof r.gates === 'object' ? r.gates : {}) as Record<string, unknown>;
  for (const id of GATE_IDS) pr.gates[id] = int(g[id], 0, MAX_GATE_TOKENS, 0);
  pr.runes = int(r.runes, 0, MAX_RUNES, 0);

  if (Array.isArray(r.codex)) pr.codex = [...new Set(r.codex.filter(isCodex))];

  const t = (r.tutorial && typeof r.tutorial === 'object' ? r.tutorial : {}) as Record<string, unknown>;
  pr.tutorial = { step: int(t.step, 0, TUTORIAL_DONE, 0), count: int(t.count, 0, 1000, 0), skipped: t.skipped === true };
  pr.tutGranted = int(r.tutGranted, -1, TUTORIAL.length - 1, pr.tutorial.step >= TUTORIAL_DONE ? TUTORIAL.length - 1 : Math.min(pr.tutorial.step, TUTORIAL.length - 1));
  pr.tutRewarded = r.tutRewarded === true;
  pr.rewardedLevel = int(r.rewardedLevel, 1, 10_000, 1);
  pr.qubitBonus = int(r.qubitBonus, 0, 1, 0);

  const n = qubitsForLevel(level, pr.qubitBonus);
  const board = cleanBoard(r.board);
  pr.board = board;
  // an orb set with no ability at all (a lost or blank row) gets the class's abilities back
  if (!board.abilities.slice(0, n).some(Boolean)) placeAbilities(pr, n);
  if (checkBoard(board, rulesFor(pr, level))) {
    pr.board = emptyBoard();
    pr.locks = {};
    placeAbilities(pr, n);
    return { pr, reroll: false };
  }
  const locks = locksComplete(board, n, validLocks(r.locks));
  if (!locks) return { pr, reroll: true };
  pr.locks = locks;
  return { pr, reroll: false };
}

/** The JSON stored in `character_progress.data`. */
export function serializeProgress(pr: Progress): Record<string, unknown> {
  return {
    v: 1, cls: pr.cls, spec: pr.spec, second: pr.second, board: pr.board, locks: pr.locks, gates: pr.gates, runes: pr.runes,
    codex: pr.codex, tutorial: pr.tutorial, tutGranted: pr.tutGranted, tutRewarded: pr.tutRewarded,
    rewardedLevel: pr.rewardedLevel, qubitBonus: pr.qubitBonus,
  };
}
