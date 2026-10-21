import { clear, h } from './dom';

/** One modal window at a time (inventory, crafting, shop...). Esc closes it. */
export class Windows {
  private root = h('div', { id: 'modal', class: 'overlay soft-modal' });
  private box = h('div', { class: 'window panel' });
  private titleEl = h('div', { class: 'win-title' });
  private body = h('div', { class: 'win-body' });
  private current: string | null = null;
  private closeCb: (() => void) | null = null;
  onChange: (open: boolean) => void = () => {};

  constructor() {
    this.root.hidden = true;
    const x = h('button', { class: 'win-x', text: '✕', title: 'Close (Esc)', on: { click: () => this.close() } });
    this.box.append(h('div', { class: 'win-head' }, this.titleEl, x), this.body);
    this.root.append(this.box);
    this.root.addEventListener('pointerdown', (e) => { if (e.target === this.root) this.close(); });
    document.body.append(this.root);
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.current) { e.preventDefault(); this.close(); } });
  }

  get open(): boolean { return this.current !== null; }
  get name(): string | null { return this.current; }

  show(name: string, title: string, content: HTMLElement, opts: { wide?: boolean; onClose?: () => void } = {}): void {
    if (this.current) this.close();
    this.current = name;
    this.closeCb = opts.onClose ?? null;
    this.titleEl.textContent = title;
    clear(this.body);
    this.body.append(content);
    this.box.classList.toggle('wide', !!opts.wide);
    this.root.hidden = false;
    this.onChange(true);
  }

  /** Replace the body without closing (live updates). */
  update(name: string, content: HTMLElement): void {
    if (this.current !== name) return;
    clear(this.body);
    this.body.append(content);
  }

  close(): void {
    if (!this.current) return;
    this.current = null;
    this.root.hidden = true;
    const cb = this.closeCb; this.closeCb = null;
    cb?.();
    this.onChange(false);
  }
}
