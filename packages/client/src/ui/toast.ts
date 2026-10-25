import { ITEMS, itemName, type Stack } from '@eigenlands/shared';
import { itemIconUrl } from '../art/icons';
import { h } from './dom';

/** Bottom-left feed: item pickups (merged), messages. Also announces to screen readers. */
export class Toasts {
  private root = h('div', { id: 'toasts' });
  private recent = new Map<string, { el: HTMLElement; n: number; at: number }>();
  constructor() {
    this.root.setAttribute('aria-live', 'polite');
    document.body.append(this.root);
  }

  add(text: string, kind: 'info' | 'good' | 'bad' | 'item' = 'info', item?: Stack): void {
    if (kind === 'item' && item) {
      const key = item.id + JSON.stringify(item.p ?? {});
      const r = this.recent.get(key);
      if (r && r.el.isConnected && performance.now() - r.at < 1500) {
        r.n += item.n;
        r.at = performance.now();
        r.el.querySelector('.tn')!.textContent = `+${r.n}`;
        this.root.append(r.el); // a merged pickup is the newest notification
        this.keep(r.el);
        return;
      }
      const el = h(
        'div',
        { class: 'toast item' },
        h('img', { class: 'ico', src: itemIconUrl(item.id) }),
        h('span', { class: 'tn', text: `+${item.n}` }),
        h('span', { text: item.p?.qname ? itemName(item) : (ITEMS[item.id]?.name ?? item.id) }),
      );
      this.recent.set(key, { el, n: item.n, at: performance.now() });
      this.push(el);
      return;
    }
    this.push(h('div', { class: `toast ${kind}`, text }));
  }
  private push(el: HTMLElement): void {
    this.root.append(el);
    while (this.root.children.length > 6) this.root.firstChild?.remove();
    this.keep(el);
  }
  private keep(el: HTMLElement): void {
    el.classList.remove('fade');
    const t = (el as unknown as { _t?: number })._t;
    if (t) clearTimeout(t);
    (el as unknown as { _t?: number })._t = window.setTimeout(() => {
      el.classList.add('fade');
      setTimeout(() => el.remove(), 600);
    }, 3200);
  }
}
