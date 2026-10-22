import { Container, Graphics, Text } from 'pixi.js';
import { EMOTE_GLYPH, PALETTE, type Emote } from '@eigenlands/shared';
import { h } from '../../ui/dom';
import type { P34Deps } from '../types';

const pc = (i: number) => parseInt(PALETTE[i]!.slice(1), 16);
const BUBBLE_MS = 3000;

interface Bubble { id: string; root: Container; born: number }

/** Emote bubbles above players' heads (screen-space, so they stay crisp at any zoom). */
export class EmoteBubbles {
  private list: Bubble[] = [];
  constructor(private d: P34Deps) {}

  /** world pixels per screen pixel ratio (CSS px per iso px) */
  private scale(): number { return Math.abs(this.d.toScreen(1, 0).x - this.d.toScreen(0, 0).x) / 16 || 1; }

  show(id: string, e: Emote): void {
    for (const b of this.list.filter((x) => x.id === id)) this.drop(b);
    const root = new Container();
    const txt = new Text({ text: EMOTE_GLYPH[e] ?? '?', style: { fontFamily: 'system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif', fontSize: 22, fill: pc(6) } });
    txt.anchor.set(0.5, 0.5);
    const w = Math.max(34, txt.width + 14), hgt = 32;
    const bg = new Graphics();
    bg.roundRect(-w / 2, -hgt / 2, w, hgt, 10).fill({ color: 0x0f1020, alpha: 0.88 }).stroke({ color: 0x5af0d0, width: 2 });
    bg.moveTo(-6, hgt / 2).lineTo(0, hgt / 2 + 7).lineTo(6, hgt / 2).fill({ color: 0x0f1020, alpha: 0.88 });
    root.addChild(bg, txt);
    root.visible = false;
    this.d.labelLayer().addChild(root);
    this.list.push({ id, root, born: performance.now() });
  }

  private drop(b: Bubble): void {
    b.root.destroy({ children: true });
    this.list = this.list.filter((x) => x !== b);
  }

  frame(now: number): void {
    if (!this.list.length) return;
    const S = this.scale();
    const reduced = this.d.settings().reducedMotion;
    for (const b of [...this.list]) {
      const age = now - b.born;
      if (age > BUBBLE_MS) { this.drop(b); continue; }
      const pos = this.d.entityPos(b.id);
      if (!pos) { b.root.visible = false; continue; }
      const s = this.d.toScreen(pos.x, pos.y);
      b.root.visible = true;
      const pop = reduced ? 1 : Math.min(1, age / 140);
      b.root.scale.set(0.6 + 0.4 * pop);
      b.root.alpha = age > BUBBLE_MS - 400 ? (BUBBLE_MS - age) / 400 : 1;
      b.root.x = Math.round(s.x);
      b.root.y = Math.round(s.y - 46 * S - (reduced ? 0 : Math.sin(age / 220) * 2));
    }
  }

  count(): number { return this.list.length; }
}

export interface MenuActs {
  whisper(name: string): void;
  invite(name: string): void;
  trade(name: string): void;
  block(name: string, id: string): void;
  unblock(name: string, id: string): void;
  isBlocked(name: string): boolean;
}

/** Small context menu for another player (click or tap on them). */
export class PlayerMenu {
  readonly el = h('div', { id: 'player-menu', class: 'pmenu panel' });
  private target: { name: string; id: string } | null = null;

  constructor(private acts: MenuActs) {
    this.el.hidden = true;
    this.el.setAttribute('role', 'menu');
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.body.append(this.el);
    window.addEventListener('pointerdown', (e) => { if (!this.el.hidden && !this.el.contains(e.target as Node)) this.close(); }, true);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !this.el.hidden) { e.stopPropagation(); this.close(); } }, true);
  }

  get open(): boolean { return !this.el.hidden; }

  show(name: string, accountish: string, x: number, y: number): void {
    this.target = { name, id: accountish };
    this.el.textContent = '';
    const item = (label: string, fn: () => void, cls = '') => {
      const b = h('button', { class: cls, text: label, on: { click: () => { this.close(); fn(); } } });
      b.setAttribute('role', 'menuitem');
      return b;
    };
    const blocked = this.acts.isBlocked(name);
    this.el.append(
      h('div', { class: 'pmenu-title', text: name }),
      item('Whisper', () => this.acts.whisper(name)),
      item('Invite to party', () => this.acts.invite(name)),
      item('Trade', () => this.acts.trade(name)),
      blocked ? item('Unblock', () => this.acts.unblock(name, accountish)) : item('Block', () => this.acts.block(name, accountish), 'danger'),
    );
    this.el.hidden = false;
    const r = this.el.getBoundingClientRect();
    this.el.style.left = `${Math.max(8, Math.min(window.innerWidth - r.width - 8, x + 6))}px`;
    this.el.style.top = `${Math.max(8, Math.min(window.innerHeight - r.height - 8, y + 6))}px`;
    (this.el.querySelector('button') as HTMLButtonElement | null)?.focus({ preventScroll: true });
  }

  close(): void { this.el.hidden = true; this.target = null; }
  get who(): string { return this.target?.name ?? ''; }
}
