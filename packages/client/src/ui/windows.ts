import { clear, h } from './dom';

/** One modal window at a time (inventory, crafting, shop...). Esc closes it. */
export class Windows {
  private root = h('div', { id: 'modal', class: 'overlay soft-modal' });
  private box = h('div', { class: 'window panel' });
  private titleEl = h('div', { class: 'win-title' });
  private body = h('div', { class: 'win-body' });
  private current: string | null = null;
  private closeCb: (() => void) | null = null;
  private previousFocus: HTMLElement | null = null;
  onChange: (open: boolean) => void = () => {};

  constructor() {
    this.root.hidden = true;
    this.box.setAttribute('role', 'dialog');
    this.box.setAttribute('aria-modal', 'true');
    this.titleEl.id = 'window-title';
    this.box.setAttribute('aria-labelledby', this.titleEl.id);
    const x = h('button', { class: 'win-x', text: '✕', title: 'Close (Esc)', on: { click: () => this.close() } });
    this.box.append(h('div', { class: 'win-head' }, this.titleEl, x), this.body);
    this.root.append(this.box);
    this.root.addEventListener('pointerdown', (e) => {
      if (e.target === this.root) this.close();
    });
    document.body.append(this.root);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.current) {
        e.preventDefault();
        this.close();
      }
    });
    this.root.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const nodes = [
        ...this.box.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), details > summary, [tabindex="0"]',
        ),
      ].filter((n) => n.getClientRects().length);
      const first = nodes[0],
        last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    });
  }

  get open(): boolean {
    return this.current !== null;
  }
  get name(): string | null {
    return this.current;
  }

  show(name: string, title: string, content: HTMLElement, opts: { wide?: boolean; onClose?: () => void } = {}): void {
    if (this.current) this.close();
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.current = name;
    this.closeCb = opts.onClose ?? null;
    this.titleEl.textContent = title;
    clear(this.body);
    this.body.append(content);
    this.box.classList.toggle('wide', !!opts.wide);
    this.root.hidden = false;
    this.box.querySelector<HTMLElement>('.win-x')?.focus();
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
    const cb = this.closeCb;
    this.closeCb = null;
    cb?.();
    this.onChange(false);
    if (!this.current && this.previousFocus?.isConnected) this.previousFocus.focus();
    this.previousFocus = null;
  }
}
