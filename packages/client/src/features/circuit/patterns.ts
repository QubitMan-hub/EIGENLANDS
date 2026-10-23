import { ACTIVE_LINES, BOARD_COLS, checkBoard, cloneBoard, type Board, type BoardRules, type GateId } from '@eigenlands/shared';
import { placeGate, removeAt, type EditResult } from './model';

export const PATTERNS: { id: string; name: string; gates: GateId[]; why: string; tryIt: string }[] = [
  { id: 'flip', name: 'Choose the other form', gates: ['x'], why: 'Flip makes the second form the ideal outcome. Slips can still change a real cast.', tryIt: 'Attune, close the Board and cast this orb. Look for the second form’s element.' },
  { id: 'split', name: 'Keep both possibilities', gates: ['h'], why: 'Split gives each form an equal chance. Each cast makes a fresh choice.', tryIt: 'Attune and cast several times. A short streak of the same form is normal; equal odds do not mean strict alternation.' },
  { id: 'interference', name: 'Make the paths interfere', gates: ['h', 'z', 'h'], why: 'Split, Tune, then Split again makes the second form the ideal outcome. The phase shift changes how the paths combine.', tryIt: 'Compare this with a single Split. Attune and cast; the second form should dominate, with occasional slips.' },
  { id: 'lock', name: 'Choose once, then keep it', gates: ['h', 'm'], why: 'Split offers both forms. Lock in chooses one when you Attune; that stored choice stays until the next Attune. Slips still apply.', tryIt: 'Attune and inspect the stored outcome on the Board. Re-attuning may choose the other one.' },
  { id: 'link', name: 'Share an outcome', gates: ['h', 'cx'], why: 'Split and Link connect two orbs. With an untouched partner, their ideal forms agree. Existing gates on that partner can change the result.', tryIt: 'Attune, then cast the first orb. Its linked partner fires too. Read their joint outcomes on the Board.' },
];

/** Replace only this orb's pattern, following the exact same constraints as manual edits. Never attunes. */
export function applyPattern(source: Board, id: string, q: number, rules: BoardRules): EditResult {
  const pattern = PATTERNS.find(p => p.id === id);
  if (!pattern) return { ok: false, why: 'Choose one of the listed patterns.' };
  if (!Number.isInteger(q) || q < 0 || q >= Math.min(rules.qubits, ACTIVE_LINES)) return { ok: false, why: 'Choose an unlocked orb on your action bar.' };
  if (!source.abilities[q]) return { ok: false, why: 'Give this orb an ability on the Board first.' };
  let board = cloneBoard(source);
  for (let c = 0; c < BOARD_COLS; c++) board = removeAt(board, q, c).board;
  const target = Array.from({ length: rules.qubits }, (_, i) => i).find(i => i !== q && !!board.abilities[i]);
  if (pattern.id === 'link' && target === undefined) return { ok: false, why: 'Link needs another unlocked orb with an ability.' };
  for (let c = 0; c < pattern.gates.length; c++) {
    const r = placeGate(board, q, c, pattern.gates[c]!, rules.gates, rules.qubits, target);
    if (!r.ok) return r;
    board = r.board;
  }
  const why = checkBoard(board, rules);
  return why ? { ok: false, why } : { ok: true, board };
}
