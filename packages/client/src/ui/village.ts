/** Village panels: the Statue of QubitMan (lore) and the daily request board. */
import { ITEMS, NPC_BY_ID, objectiveText, type BoardRequest, type PanelMsg } from '@eigenlands/shared';
import type { Profile } from '../game/profile';
import { clear, h } from './dom';
import { ensureP2Styles } from './p2style';

export function buildLore(m: PanelMsg, portrait: (npcId: string) => string): HTMLElement {
  ensureP2Styles();
  const lore = m.lore!;
  const root = h('div', { class: 'lore' });
  let page = -1; // -1 = the plaque
  const body = h('div');
  const render = () => {
    clear(body);
    if (page < 0) {
      body.append(
        h(
          'div',
          { class: 'lore-plaque' },
          h('div', { class: 'hail', text: lore.plaque }),
          h('div', { class: 'ep', text: lore.epitaph }),
        ),
        h('div', {
          class: 'small dim',
          text: 'A bronze figure in a long coat holds up a lantern. Up close, the bronze seems to shimmer between two colours. Below the plaque, a longer inscription tells his legend.',
        }),
      );
    } else body.append(h('div', { class: 'lore-page', text: lore.pages[page]! }));
    const nav = h(
      'div',
      { class: 'lore-nav' },
      h('button', {
        text: '◂ Back',
        disabled: page < 0,
        on: {
          click: () => {
            page--;
            render();
          },
        },
      }),
      h('span', {
        class: 'small dim',
        text: page < 0 ? 'The plaque' : `The Legend of QubitMan · ${page + 1}/${lore.pages.length}`,
      }),
      page < lore.pages.length - 1
        ? h('button', {
            class: 'primary',
            text: page < 0 ? 'Read the legend ▸' : 'Next ▸',
            on: {
              click: () => {
                page++;
                render();
              },
            },
          })
        : h('button', {
            class: 'primary',
            text: 'ALL HAIL QUBITMAN',
            on: {
              click: () => {
                page = -1;
                render();
              },
            },
          }),
    );
    body.append(nav);
    if (lore.remark && page === lore.pages.length - 1) {
      const n = NPC_BY_ID[lore.remark.npc];
      body.append(
        h(
          'div',
          { class: 'lore-remark' },
          h('img', { src: portrait(lore.remark.npc), alt: n?.name ?? '' }),
          h('span', { text: `${n?.name.split(' ')[0] ?? 'A villager'} says: “${lore.remark.text}”` }),
        ),
      );
    }
  };
  render();
  root.append(body);
  return root;
}

export interface BoardActions {
  accept(id: string): void;
  turnin(id: string): void;
}

export function buildBoard(
  m: PanelMsg,
  profile: Profile,
  portrait: (npcId: string) => string,
  act: BoardActions,
): HTMLElement {
  ensureP2Styles();
  const b = m.board!;
  const root = h('div', { class: 'board' });
  root.append(
    h('div', {
      class: 'small dim',
      text: 'Villagers pin jobs here every morning. Take up to three at a time. Bring what they ask for (it stays in your pack until you hand it in), then hand it in here or to the person who asked. Jobs taken today can be handed in until the end of tomorrow.',
    }),
  );
  const list = h('div', { class: 'board-list' });
  const row = (r: BoardRequest) => {
    const n = NPC_BY_ID[r.giver];
    const live = profile.quests[r.id];
    const progress = r.objectives
      .map((o, i) => {
        const have = o.type === 'deliver' ? profile.count(o.target) : (live?.progress[i] ?? r.progress[i] ?? 0);
        return objectiveText(o, have);
      })
      .join(' · ');
    const ready =
      r.state === 'active' &&
      r.objectives.every((o, i) => (o.type === 'deliver' ? profile.count(o.target) : (live?.progress[i] ?? 0)) >= o.n);
    const state = ready ? 'ready' : r.state;
    const btn =
      state === 'open'
        ? h('button', { class: 'primary', text: 'Accept', on: { click: () => act.accept(r.id) } })
        : state === 'ready'
          ? h('button', { class: 'primary', text: 'Hand in', on: { click: () => act.turnin(r.id) } })
          : h('span', {
              class: 'small',
              text: state === 'done' ? '✓ Done' : state === 'expired' ? 'Taken down' : 'In progress',
            });
    const item = r.objectives[0]?.type === 'deliver' ? ITEMS[r.objectives[0].target] : undefined;
    return h(
      'div',
      { class: `req ${state}` },
      h('img', { src: portrait(r.giver), alt: n?.name ?? r.giver }),
      h(
        'div',
        {},
        h('b', { text: `${n?.name.split(' ')[0] ?? r.giver}: ${r.title}` }),
        h('div', { class: 'small', text: r.summary }),
        h('div', { class: 'small', text: progress }),
        h('div', {
          class: 'rw',
          text: `Reward: ${r.coins} coins + friendship with ${n?.name.split(' ')[0] ?? 'them'}${item ? ` (${item.name}: ${item.kind})` : ''}`,
        }),
      ),
      btn,
    );
  };
  for (const r of b.requests) list.append(row(r));
  if (!b.requests.length) list.append(h('div', { class: 'small dim', text: 'The board is empty today.' }));
  root.append(list);
  if (m.sign) root.append(h('div', { class: 'board-notice', text: m.sign }));
  return root;
}
