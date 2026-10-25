import { GATES, GATE_IDS, QUBITPEDIA, type CodexEntry } from '@eigenlands/shared';
import { h } from './el';
import { gateTile } from './art';

/** The Qubitpedia tab: unlocked entries readable, the rest shown as "???" so players know there is more to find. */
export function buildCodex(
  unlocked: string[],
  selected: string | null,
  expert: boolean,
  select: (id: string) => void,
): HTMLElement {
  const have = new Set(unlocked);
  const first = QUBITPEDIA.find((e) => have.has(e.id));
  const cur: CodexEntry | undefined = QUBITPEDIA.find((e) => e.id === selected && have.has(e.id)) ?? first;
  const root = h('div', { class: 'cb-codex' });
  const list = h('div', { class: 'cb-cx-list', data: { focusgroup: 'codex' } });
  list.setAttribute('role', 'tablist');
  QUBITPEDIA.forEach((e, i) => {
    const open = have.has(e.id);
    const b = h(
      'button',
      {
        class: `cb-cx-item${open ? '' : ' locked'}${cur?.id === e.id ? ' on' : ''}`,
        data: { focus: `cx:${e.id}` },
        on: {
          click: () => {
            if (open) select(e.id);
          },
        },
      },
      h('span', { class: 'cb-cx-n', text: String(i + 1).padStart(2, '0') }),
      h('span', { text: open ? e.title : '???' }),
    );
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(cur?.id === e.id));
    if (!open) {
      b.setAttribute('aria-disabled', 'true');
      b.title = 'Not discovered yet. Keep experimenting with your Board.';
    }
    list.append(b);
  });
  const count = h('div', { class: 'cb-cx-count', text: `${have.size} of ${QUBITPEDIA.length} discovered` });
  const page = h('article', { class: 'cb-cx-page' });
  if (!cur) {
    page.append(
      h('h3', { text: 'Nothing here yet' }),
      h('p', {
        text: 'Every time you try a new idea on your Board, a page of the Qubitpedia fills itself in. Start with a Split.',
      }),
    );
  } else {
    const gates = GATE_IDS.filter((g) => GATES[g].codex === cur.id);
    page.append(
      h(
        'h3',
        {},
        ...gates.map((g) =>
          h('img', { class: 'cb-cx-gem', src: gateTile(g, expert ? 'expert' : 'friendly'), title: GATES[g].name }),
        ),
        cur.title,
      ),
      h('div', { class: 'cb-cx-k', text: 'What you saw' }),
      h('p', { text: cur.seen }),
      h('div', { class: 'cb-cx-k', text: 'The idea' }),
      h('p', { class: 'cb-cx-idea', text: cur.idea }),
      h('details', { class: 'cb-cx-deep' }, h('summary', { text: 'For the curious' }), h('p', { text: cur.curious })),
    );
    if (expert) (page.querySelector('details') as HTMLDetailsElement).open = true;
  }
  root.append(h('div', { class: 'cb-cx-side' }, count, list), page);
  return root;
}
