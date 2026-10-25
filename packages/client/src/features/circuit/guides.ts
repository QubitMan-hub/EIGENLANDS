import {
  ABILITIES,
  ACTIVE_LINES,
  GATES,
  boardPreview,
  type Board,
  type BoardRules,
  type Locks,
} from '@eigenlands/shared';
import { h } from './el';
import { gateTile } from './art';
import { PATTERNS, applyPattern } from './patterns';
import { boardsEqual, pct } from './model';
import { formName, orbName } from './text';

export interface GuideState {
  board: Board;
  rules: BoardRules;
  locks: Locks | null;
  loaded: boolean;
  pending: boolean;
  q: number;
  id: string;
  review: boolean;
}
export interface GuideActions {
  orb(q: number): void;
  pattern(id: string): void;
  review(): void;
  use(): void;
  board(): void;
}
/** Guided edits use the same evaluator and token rules as the live board, without sending anything. */
export function buildGuides(s: GuideState, act: GuideActions): HTMLElement {
  const root = h('section', { class: 'cb-guides' });
  const intro = h(
    'div',
    { class: 'cb-guide-intro' },
    h('h3', { text: 'Learn a pattern' }),
    h('p', {
      text: 'Choose an orb, compare a pattern, then try it in your draft. Attune on the Board when you are ready to save it.',
    }),
  );
  const selector = h('select', { data: { focus: 'guide-orb' } });
  selector.setAttribute('aria-label', 'Pattern orb');
  for (let q = 0; q < Math.min(s.rules.qubits, ACTIVE_LINES); q++) {
    const ability = s.board.abilities[q];
    selector.append(
      h('option', {
        value: String(q),
        text: `${orbName(q)} · ${ability ? ABILITIES[ability].name : 'No ability assigned'}`,
      }),
    );
  }
  selector.value = String(s.q);
  selector.onchange = () => act.orb(Number(selector.value));
  intro.append(h('label', {}, 'Try on ', selector));
  const list = h('nav', { class: 'cb-guide-list' });
  list.setAttribute('aria-label', 'Gate patterns');
  for (const pattern of PATTERNS) {
    const button = h('button', {
      text: pattern.name,
      data: { focus: `guide:${pattern.id}` },
      on: { click: () => act.pattern(pattern.id) },
    });
    button.setAttribute('aria-pressed', String(pattern.id === s.id));
    list.append(button);
  }
  const pattern = PATTERNS.find((p) => p.id === s.id) ?? PATTERNS[0]!;
  const result = applyPattern(s.board, pattern.id, s.q, s.rules);
  const page = h('article', { class: 'cb-guide-page' }, h('h3', { text: pattern.name }));
  const chain = h('ol', { class: 'cb-guide-chain' });
  chain.setAttribute('aria-label', 'Gates from left to right');
  for (const gate of pattern.gates)
    chain.append(
      h('li', {}, h('img', { src: gateTile(gate, 'friendly'), alt: '' }), h('span', { text: GATES[gate].name })),
    );
  page.append(chain, h('p', { text: pattern.why }));
  const needs = new Map<string, number>();
  for (const gate of pattern.gates) needs.set(gate, (needs.get(gate) ?? 0) + 1);
  page.append(
    h('p', {
      class: 'cb-guide-needs',
      text: `Uses ${[...needs].map(([gate, n]) => `${n} ${GATES[gate as keyof typeof GATES].name}`).join(', ')} from your collection. Gates already on this orb can be reused.`,
    }),
  );
  if (!s.loaded || s.pending || !result.ok) {
    page.append(
      h('p', {
        class: 'cb-guide-message',
        role: 'status',
        text: !s.loaded
          ? 'Waiting for your collection from the world…'
          : s.pending
            ? 'Wait for your current Attune to finish.'
            : !result.ok
              ? result.why
              : '',
      }),
      h('button', { text: 'Return to Board', data: { focus: 'guide-board' }, on: { click: act.board } }),
    );
  } else if (!s.review) {
    page.append(
      h('button', {
        class: 'primary',
        text: 'Preview pattern',
        data: { focus: 'guide-review' },
        on: { click: act.review },
      }),
    );
  } else {
    const before = boardPreview(s.board, s.rules.qubits, s.locks).lines[s.q]!;
    const after = boardPreview(result.board, s.rules.qubits, boardsEqual(s.board, result.board) ? s.locks : null).lines[
      s.q
    ]!;
    const table = h(
      'table',
      { class: 'cb-guide-table' },
      h('caption', { text: `${orbName(s.q)} · projected cast outcomes` }),
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          h('th', { text: 'Outcome' }),
          h('th', { text: 'Current draft' }),
          h('th', { text: 'Pattern draft' }),
        ),
      ),
    );
    const body = h('tbody');
    for (const bit of [0, 1] as const) {
      body.append(
        h(
          'tr',
          {},
          h('th', { text: bit ? 'Second form' : 'First form' }),
          ...[before, after].map((line) =>
            h(
              'td',
              {},
              h('b', { text: pct(bit ? line.pB : 1 - line.pB) }),
              h('span', { text: formName(line.ability, bit, bit ? line.hueB : line.hueA) }),
            ),
          ),
        ),
      );
    }
    body.append(
      h(
        'tr',
        {},
        h('th', { text: 'Slip chance' }),
        ...[before, after].map((line) => h('td', { text: pct(1 - line.stability) })),
      ),
    );
    table.append(body);
    page.append(table);
    if (after.locked === 'pending')
      page.append(
        h('p', {
          text: 'Lock in has not chosen yet. These are the odds before Attune; the saved result will appear on the Board afterward.',
        }),
      );
    if (after.fires.length)
      page.append(
        h('p', {
          text: `Also fires ${after.fires.map(orbName).join(', ')}. See joint outcomes on the Board for the full linked pattern.`,
        }),
      );
    page.append(
      h('p', {
        class: 'cb-guide-message',
        text: 'This replaces gates on the selected orb, including any incoming Link. Abilities, runes and unrelated gates stay. Nothing is saved until you Attune.',
      }),
      h('button', {
        class: 'primary',
        text: 'Use pattern in draft',
        data: { focus: 'guide-use' },
        on: { click: act.use },
      }),
    );
  }
  page.append(
    h(
      'details',
      { class: 'cb-guide-try' },
      h('summary', { text: 'Try it in the world' }),
      h('p', { text: pattern.tryIt }),
    ),
  );
  root.append(intro, list, page);
  return root;
}
