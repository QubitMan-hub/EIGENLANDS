import { ITEMS, type ShopViewMsg } from '@eigenlands/shared';
import type { Profile } from '../game/profile';
import { clear, h, iconCell, tooltipFor, type Tooltip } from './dom';

export interface ShopActions { buy(item: string, n: number): void; sell(slot: number, n: number): void }

export function buildShop(view: ShopViewMsg, profile: Profile, tip: Tooltip, act: ShopActions): HTMLElement {
  const root = h('div', { class: 'shop' });
  const render = () => {
    clear(root);
    const buy = h('div', { class: 'col' }, h('div', { class: 'side-title', text: 'For sale' }));
    for (const s of view.stock) {
      const d = ITEMS[s.item]; if (!d) continue;
      const afford = (n: number) => profile.coins >= s.price * n;
      const row = h('div', { class: 'srow' }, iconCell({ id: s.item, n: 1 }, { showCount: false }), h('div', { class: 'sname' }, h('b', { text: d.name }), h('div', { class: 'small dim', text: d.desc })), h('b', { class: 'price', text: `${s.price}c` }),
        h('button', { text: '×1', disabled: !afford(1), on: { click: () => act.buy(s.item, 1) } }), h('button', { text: '×5', disabled: !afford(5), on: { click: () => act.buy(s.item, 5) } }));
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
      const row = h('div', { class: 'srow' }, iconCell(st), h('div', { class: 'sname' }, h('b', { text: ITEMS[st.id]!.name })), h('b', { class: 'price', text: `${price}c` }),
        h('button', { text: 'Sell 1', on: { click: () => act.sell(i, 1) } }), st.n > 1 ? h('button', { text: `All ${st.n}`, on: { click: () => act.sell(i, st.n) } }) : null);
      tip.attach(row.querySelector('.cell') as HTMLElement, () => tooltipFor(st));
      sell.append(row);
    });
    if (!any) sell.append(h('div', { class: 'small dim', text: 'Nothing in your pack that they want.' }));
    root.append(h('div', { class: 'coins big', text: `${profile.coins} coins` }), buy, sell);
  };
  render();
  const unsub = profile.onChange(() => { if (!root.isConnected) { unsub(); return; } render(); });
  return root;
}
