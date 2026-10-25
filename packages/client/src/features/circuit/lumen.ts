/**
 * Lumen, the tutorial guide: a procedurally drawn pixel light-sprite that floats beside the player (bobbing, glowing,
 * with a little trail of sparks), and the story dialogue panel (typewriter text, portrait, "next" on click / tap /
 * E / Enter / Space). Lumen lives in the screen-space label layer so it glows above the night lighting.
 */
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { h } from './el';
import type { P34Deps } from '../types';
import { drawLumen, lumenUrl } from './art';

export class LumenSprite {
  private root = new Container();
  private glow = new Graphics();
  private trail = new Graphics();
  private sprite = new Sprite();
  private tex: Texture[][] = [];
  private pos: { x: number; y: number } | null = null;
  private sparks: Array<{ x: number; y: number; t: number }> = [];
  private lastSpark = 0;
  /** 0..1 fade */
  private alpha = 0;
  visible = false;
  /** extra excitement while Lumen talks */
  talking = false;

  constructor(private d: P34Deps) {
    for (let f = 0; f < 4; f++)
      this.tex.push(
        [false, true].map((b) => {
          const t = Texture.from(drawLumen(f, b));
          t.source.scaleMode = 'nearest';
          return t;
        }),
      );
    this.sprite.anchor.set(0.5);
    this.glow.blendMode = 'add';
    this.trail.blendMode = 'add';
    this.root.addChild(this.trail, this.glow, this.sprite);
    this.root.visible = false;
    d.labelLayer().addChild(this.root);
  }

  frame(now: number, dtMs: number): void {
    const me = this.d.me();
    const target = this.visible && me && !this.d.dead() ? 1 : 0;
    this.alpha += (target - this.alpha) * Math.min(1, dtMs / 250);
    this.root.visible = this.alpha > 0.02 && !!me;
    if (!this.root.visible || !me) {
      if (!target) this.pos = null;
      return;
    }
    const reduced = this.d.settings().reducedMotion;
    // follow a point beside the player's head (world units), lagging a little like something that flies
    const goal = { x: me.x - 0.55, y: me.y + 0.45 };
    if (!this.pos) this.pos = { ...goal };
    const k = Math.min(1, dtMs / (reduced ? 60 : 220));
    this.pos.x += (goal.x - this.pos.x) * k;
    this.pos.y += (goal.y - this.pos.y) * k;
    const s0 = this.d.toScreen(0, 0),
      s1 = this.d.toScreen(0, 1);
    const scale = Math.max(1, (s1.y - s0.y) / 8);
    const t = now / 1000;
    const bob = reduced ? 0 : Math.sin(t * 2.6) * 3 + (this.talking ? Math.sin(t * 9) * 1.2 : 0);
    const p = this.d.toScreen(this.pos.x, this.pos.y);
    const x = Math.round(p.x),
      y = Math.round(p.y - (30 + bob) * scale);
    this.root.alpha = this.alpha;
    this.sprite.texture = this.tex[reduced ? 0 : Math.floor(t * 8) % 4]![Math.floor(t * 10) % 37 === 0 ? 1 : 0]!;
    this.sprite.scale.set(scale);
    this.sprite.position.set(x, y);
    const pulse = reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 4);
    this.glow
      .clear()
      .circle(x, y, 14 * scale * pulse)
      .fill({ color: 0x5af0d0, alpha: 0.1 })
      .circle(x, y, 8 * scale * pulse)
      .fill({ color: 0xb4eaff, alpha: 0.16 });
    // trail of tiny sparks
    this.trail.clear();
    if (reduced) return;
    if (now - this.lastSpark > 70) {
      this.lastSpark = now;
      this.sparks.push({
        x: this.pos.x + (Math.random() - 0.5) * 0.15,
        y: this.pos.y + (Math.random() - 0.5) * 0.15,
        t: now,
      });
      if (this.sparks.length > 14) this.sparks.shift();
    }
    for (const sp of this.sparks) {
      const age = (now - sp.t) / 1000;
      if (age > 1) continue;
      const q = this.d.toScreen(sp.x, sp.y);
      const sz = Math.max(1, Math.round(scale));
      this.trail
        .rect(Math.round(q.x), Math.round(q.y - (26 + bob - age * 10) * scale), sz, sz)
        .fill({ color: age < 0.4 ? 0xffffff : 0x5af0d0, alpha: 1 - age });
    }
  }
}

/** The story panel. Lines queue up; each one types itself out, and "next" finishes it or moves on. */
export class LumenDialog {
  readonly el = h('div', { id: 'p3-lumen', class: 'panel' });
  private portrait = h('img', { class: 'p3-lumen-face', alt: 'Lumen' });
  private text = h('div', { class: 'p3-lumen-text' });
  private next = h('button', { class: 'p3-lumen-next', text: 'Next ▸' });
  private skipBtn = h('button', { class: 'p3-lumen-skip', text: 'Skip story' });
  private queue: string[] = [];
  private cur = '';
  private shown = 0;
  private typingFrom = 0;
  private home: HTMLElement;
  private skipArmed = 0;
  onSkip: () => void = () => {};
  onIdle: () => void = () => {};
  docked = false;

  constructor(private reduced: () => boolean) {
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Lumen says');
    this.text.setAttribute('aria-live', 'polite');
    const name = h(
      'div',
      { class: 'p3-lumen-name' },
      'Lumen',
      h('span', { class: 'p3-lumen-sub', text: 'light-sprite' }),
    );
    this.el.append(
      h('div', { class: 'p3-lumen-port' }, this.portrait),
      h(
        'div',
        { class: 'p3-lumen-body' },
        name,
        this.text,
        h('div', { class: 'p3-lumen-btns' }, this.skipBtn, this.next),
      ),
    );
    this.el.addEventListener('pointerdown', (e) => {
      if (!(e.target as HTMLElement).closest('button')) {
        e.preventDefault();
        this.advance();
      }
    });
    this.next.addEventListener('click', () => this.advance());
    this.skipBtn.addEventListener('click', () => {
      if (performance.now() < this.skipArmed) {
        this.skipArmed = 0;
        this.onSkip();
        return;
      }
      this.skipArmed = performance.now() + 4000;
      this.skipBtn.textContent = 'Really skip? Click again';
      window.setTimeout(() => {
        this.skipBtn.textContent = 'Skip story';
      }, 4000);
    });
    this.home = document.getElementById('hud') ?? document.body;
    this.home.append(this.el);
  }

  get open(): boolean {
    return !this.el.hidden;
  }
  set skippable(v: boolean) {
    this.skipBtn.hidden = !v;
  }

  say(lines: string[]): void {
    if (!lines.length) return;
    this.queue.push(...lines);
    if (!this.open) this.nextLine();
  }

  clear(): void {
    this.queue = [];
    this.el.hidden = true;
  }

  /** Finish the line being typed, or show the next one (closing after the last). */
  advance(): void {
    if (!this.open) return;
    if (this.shown < this.cur.length) {
      this.shown = this.cur.length;
      this.text.textContent = this.cur;
      return;
    }
    this.nextLine();
  }

  private nextLine(): void {
    const l = this.queue.shift();
    if (l === undefined) {
      this.el.hidden = true;
      this.onIdle();
      return;
    }
    this.cur = l;
    this.shown = this.reduced() ? l.length : 0;
    this.typingFrom = performance.now();
    this.text.textContent = this.reduced() ? l : '';
    this.next.textContent = this.queue.length ? 'Next ▸' : 'Got it ✓';
    this.el.hidden = false;
  }

  /** Move the panel into the Board window (or back to the HUD with null). */
  dock(slot: HTMLElement | null): void {
    this.docked = !!slot;
    this.el.classList.toggle('docked', this.docked);
    (slot ?? this.home).append(this.el);
  }

  frame(now: number): void {
    if (!this.open) return;
    if (this.shown < this.cur.length) {
      const n = Math.min(this.cur.length, Math.floor(((now - this.typingFrom) / 1000) * 45));
      if (n !== this.shown) {
        this.shown = n;
        this.text.textContent = this.cur.slice(0, n);
      }
    }
    const f = this.reduced() ? 0 : Math.floor(now / 125) % 4;
    const blink = Math.floor(now / 100) % 40 === 0;
    const u = lumenUrl(f, blink);
    if (this.portrait.src !== u) this.portrait.src = u;
  }
}
