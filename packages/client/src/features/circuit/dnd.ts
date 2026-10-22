/**
 * Pointer-event drag & drop for the Circuit Board (mouse, pen and touch alike; no HTML5 DnD so it works on phones).
 * A press that does not move is a click (tap); a touch held still is a long press; moving more than a few pixels
 * starts a drag with a ghost under the finger. Keyboard activation (Enter/Space) arrives as a plain click.
 */
export interface DragSource<S> {
  source: S;
  ghost(): HTMLElement;
  click?(): void;
  longPress?(): void;
  contextMenu?(): void;
}

export interface DropHost<S> {
  canDrop(src: S, target: HTMLElement): boolean;
  /** `target` is null when released over nothing that accepts it */
  drop(src: S, target: HTMLElement | null): void;
  hover?(src: S, target: HTMLElement | null): void;
  start?(src: S): void;
  end?(): void;
}

const MOVE_PX = 6;
const LONG_MS = 550;

export class DragDrop<S> {
  private ghost: HTMLElement | null = null;
  private over: HTMLElement | null = null;
  private active = false;
  private suppressClickUntil = 0;
  dragging = false;

  constructor(private root: HTMLElement, private host: DropHost<S>) {
    // the browser's own image/link dragging would cancel the pointer stream (pointercancel)
    root.addEventListener('dragstart', (e) => e.preventDefault());
  }

  bind(el: HTMLElement, get: () => DragSource<S> | null): void {
    el.addEventListener('pointerdown', (e) => this.down(e, el, get));
    el.addEventListener('click', (e) => {
      // pointer presses are handled on pointerup; this catches keyboard activation (detail 0) and stray clicks
      if (performance.now() < this.suppressClickUntil && e.detail !== 0) { e.preventDefault(); return; }
      if (e.detail === 0) get()?.click?.();
    });
    el.addEventListener('contextmenu', (e) => { const s = get(); if (s?.contextMenu) { e.preventDefault(); s.contextMenu(); } });
  }

  private down(e: PointerEvent, el: HTMLElement, get: () => DragSource<S> | null): void {
    if (this.active || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const spec = get();
    if (!spec) return;
    this.active = true;
    const id = e.pointerId, sx = e.clientX, sy = e.clientY;
    let moved = false, long = false;
    const timer = e.pointerType !== 'mouse' && spec.longPress
      ? window.setTimeout(() => { if (!moved) { long = true; navigator.vibrate?.(20); spec.longPress!(); } }, LONG_MS) : 0;
    const scroller = el.closest<HTMLElement>('.window');
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > MOVE_PX && !long) {
        moved = true;
        clearTimeout(timer);
        this.begin(spec);
      }
      if (!moved) return;
      ev.preventDefault();
      this.ghost!.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px)`;
      this.hoverAt(spec.source, ev.clientX, ev.clientY);
      // keep dragging comfortable on small screens: scroll the window near its edges
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        if (ev.clientY < r.top + 40) scroller.scrollTop -= 8; else if (ev.clientY > r.bottom - 40) scroller.scrollTop += 8;
      }
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      clearTimeout(timer);
      this.active = false;
      this.suppressClickUntil = performance.now() + 400;
      if (moved) {
        const t = ev.type === 'pointercancel' ? null : this.targetAt(spec.source, ev.clientX, ev.clientY);
        this.finish();
        this.host.drop(spec.source, t);
      } else if (!long && ev.type !== 'pointercancel') spec.click?.();
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  private begin(spec: DragSource<S>): void {
    this.dragging = true;
    const g = h('div', 'cb-ghost');
    g.append(spec.ghost());
    document.body.append(g);
    this.ghost = g;
    this.root.classList.add('cb-dragging');
    for (const t of this.root.querySelectorAll<HTMLElement>('[data-drop]')) t.classList.toggle('can', this.host.canDrop(spec.source, t));
    this.host.start?.(spec.source);
  }

  private targetAt(src: S, x: number, y: number): HTMLElement | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]') ?? null;
    return el && this.root.contains(el) && this.host.canDrop(src, el) ? el : null;
  }

  private hoverAt(src: S, x: number, y: number): void {
    const t = this.targetAt(src, x, y);
    if (t === this.over) return;
    this.over?.classList.remove('hover');
    t?.classList.add('hover');
    this.over = t;
    this.host.hover?.(src, t);
  }

  private finish(): void {
    this.ghost?.remove();
    this.ghost = null;
    this.over?.classList.remove('hover');
    this.over = null;
    this.dragging = false;
    this.root.classList.remove('cb-dragging');
    for (const t of this.root.querySelectorAll<HTMLElement>('[data-drop].can')) t.classList.remove('can');
    this.host.end?.();
  }
}

function h(tag: string, cls: string): HTMLElement { const e = document.createElement(tag); e.className = cls; return e; }
