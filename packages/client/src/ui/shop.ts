import { ITEMS, type ShopViewMsg } from '@eigenlands/shared';
import type { Profile } from '../game/profile';
import { clear, h, iconCell, tooltipFor, type Tooltip } from './dom';

export interface ShopActions {
  buy(item: string, n: number): void;
  sell(slot: number, n: number): void;
  /** a caravan's escort job (sign on) */
  job?(): void;
}

let jobStyled = false;
function jobStyles(): void {
  if (jobStyled || typeof document === 'undefined') return;
  jobStyled = true;
  const el = document.createElement('style');
  el.textContent = `.shop-job{grid-column:1/-1;display:grid;grid-template-columns:auto 1fr auto;gap:4px 12px;align-items:center;
    padding:8px 12px;margin-bottom:8px;background:var(--parch-hi);box-shadow:inset 0 0 0 1px #8a7143}
    .shop-job b{font-family:var(--pix);color:var(--ink-head,#6a4519)} .shop-job span{color:var(--ink-dark)}`;
  document.head.append(el);
}

export function buildShop(view: ShopViewMsg, profile: Profile, tip: Tooltip, act: ShopActions): HTMLElement {
  const root = h('div', { class: 'shop' });
  jobStyles();
  const render = () => {
    clear(root);
    const buy = h('div', { class: 'col' }, h('div', { class: 'side-title', text: 'For sale' }));
    for (const s of view.stock) {
      const d = ITEMS[s.item];
      if (!d) continue;
      const afford = (n: number) => profile.coins >= s.price * n;
      const row = h(
        'div',
        { class: 'srow' },
        iconCell({ id: s.item, n: 1 }, { showCount: false }),
        h('div', { class: 'sname' }, h('b', { text: d.name }), h('div', { class: 'small dim', text: d.desc })),
        h('b', { class: 'price', text: `${s.price}c` }),
        h('button', { text: '×1', disabled: !afford(1), on: { click: () => act.buy(s.item, 1) } }),
        h('button', { text: '×5', disabled: !afford(5), on: { click: () => act.buy(s.item, 5) } }),
      );
      tip.attach(row.querySelector('.cell') as HTMLElement, () => tooltipFor({ id: s.item, n: 1 }));
      buy.append(row);
    }
    if (!view.stock.length) buy.append(h('div', { class: 'small dim', text: 'Nothing in stock this season.' }));
    const sell = h('div', { class: 'col' }, h('div', { class: 'side-title', text: 'They’ll buy' }));
    let any = false;
    profile.inv.forEach((st, i) => {
      const price = view.sell[i];
      if (!st || price === undefined) return;
      any = true;
      const row = h(
        'div',
        { class: 'srow' },
        iconCell(st),
        h('div', { class: 'sname' }, h('b', { text: ITEMS[st.id]!.name })),
        h('b', { class: 'price', text: `${price}c` }),
        h('button', { text: 'Sell 1', on: { click: () => act.sell(i, 1) } }),
        st.n > 1 ? h('button', { text: `All ${st.n}`, on: { click: () => act.sell(i, st.n) } }) : null,
      );
      tip.attach(row.querySelector('.cell') as HTMLElement, () => tooltipFor(st));
      sell.append(row);
    });
    if (!any) sell.append(h('div', { class: 'small dim', text: 'Nothing in your pack that they want.' }));
    root.append(h('div', { class: 'coins big', text: `${profile.coins} coins` }));
    if (view.job)
      root.append(
        h(
          'div',
          { class: 'shop-job' },
          h('b', { text: view.job.active ? 'Escorting this caravan' : 'Escort wanted' }),
          h('span', { text: view.job.text }),
          view.job.offer
            ? h('button', { class: 'primary', text: `Sign on · ${view.job.pay}c`, on: { click: () => act.job?.() } })
            : null,
        ),
      );
    root.append(buy, sell);
  };
  render();
  const unsub = profile.onChange(() => {
    if (!root.isConnected) {
      unsub();
      return;
    }
    render();
  });
  return root;
}
