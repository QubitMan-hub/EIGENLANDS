/**
 * Celebration cards for the moments that deserve more than a toast: level-ups, quest completions, unlocked gates,
 * discovered recipes, grown hearts. One card at a time, top centre under any encounter header, pointer-transparent,
 * with an isometric emblem on a pedestal. Reduced motion swaps the entrance for a plain fade.
 */
import { C, ITEMS, type Stack } from '@eigenlands/shared';
import { Iso } from '../art/isokit';
import { makeCanvas, rasterPixels } from '../art/shade';
import { h } from './dom';

export type MomentKind = 'levelup' | 'quest' | 'skill' | 'recipe' | 'heart';
export interface Moment {
  kind: MomentKind;
  title: string;
  sub: string;
}
export interface MomentSink {
  show(m: Moment): void;
}

/** Turn the server's plain-text toasts into a celebration; null for ordinary messages. */
export function momentFromToast(text: string): Moment | null {
  let m = /^Quest complete: (.+?)! \((.*)\)$/.exec(text);
  if (m) return { kind: 'quest', title: 'Quest complete', sub: `${m[1]} · ${m[2]}` };
  m = /^New gates?: (.+)$/.exec(text);
  if (m) return { kind: 'skill', title: 'Gate unlocked', sub: m[1]! };
  m = /^You discovered (.+)!$/.exec(text);
  if (m) return { kind: 'recipe', title: 'Recipe discovered', sub: m[1]! };
  m = /taught you a recipe: (.+)!$/.exec(text);
  if (m) return { kind: 'recipe', title: 'Recipe learned', sub: m[1]! };
  m = /^(\w[\w ]*?) level (\d+)!$/.exec(text);
  if (m) return { kind: 'skill', title: `${m[1]} level ${m[2]}`, sub: 'Your practice is paying off.' };
  if (/^Your heart grows/.test(text))
    return { kind: 'heart', title: 'Heart grows', sub: text.replace(/^Your heart grows: /, '') };
  return null;
}

export const levelMoment = (level: number): Moment => ({
  kind: 'levelup',
  title: `Level ${level}`,
  sub: 'You grow stronger.',
});

/** Finds worth a gilt toast: forged quality, high tiers, and valuable non-food items. */
export function isRareStack(s: Stack): boolean {
  const def = ITEMS[s.id];
  if (s.p?.qname) return true;
  if ((s.p?.tier ?? 0) >= 3) return true;
  return !!def && def.kind !== 'food' && def.value >= 250;
}

const SHOW_MS = 3400;
const SHOW_MS_BUSY = 2000;
const MAX_QUEUE = 3;

const emblems = new Map<MomentKind, string>();
function emblem(kind: MomentKind): string {
  let url = emblems.get(kind);
  if (url) return url;
  const W = 26,
    H = 28;
  const { canvas, ctx } = makeCanvas(W, H);
  rasterPixels(ctx, W, H, () => {
    const iso = new Iso(ctx, 13, 14);
    // stone pedestal
    iso.box(-7, -7, 0, 14, 14, 3, {
      top: (a, b) => (a < 0.12 || b < 0.12 ? C.mist : C.steel),
      left: () => C.slate,
      right: () => C.night,
    });
    switch (kind) {
      case 'levelup':
        for (let i = 0; i < 9; i++) iso.dot(0, 0, 3 + i, i < 2 || i > 6 ? C.r6 : C.r7, 1 + Math.min(i, 8 - i), 1);
        iso.dot(0, 0, 12, C.white);
        break;
      case 'quest':
        iso.box(-5, -3, 3, 10, 6, 1, { top: () => C.e7, left: () => C.e5, right: () => C.e4 });
        iso.dot(1, 0, 4, C.r3, 3, 1);
        iso.line3(-4, -3, 4, -4, -3, 13, C.e2);
        iso.dot(-3, -3, 12, C.r4, 4, 2);
        break;
      case 'skill':
        for (const u of [-5, 3]) iso.box(u, -1, 3, 2, 2, 9, { top: () => C.q6, left: () => C.q4, right: () => C.q2 });
        iso.dot(0, 0, 12, C.q7, 8, 1);
        iso.dot(0, 0, 8, C.q7, 2, 2);
        break;
      case 'recipe':
        iso.box(-5, -4, 3, 10, 8, 1, { top: () => C.e7, left: () => C.e6, right: () => C.e5 });
        iso.line3(0, -4, 4, 0, 4, 4, C.e3);
        for (let i = 0; i < 3; i++) iso.dot(-3, -2 + i * 2, 4, C.e3, 3, 1);
        break;
      case 'heart':
        iso.box(-3, -3, 3, 6, 6, 8, { top: () => C.r5, left: () => C.r3, right: () => C.r1 });
        iso.dot(-1, 0, 8, C.q6, 1, 3);
        break;
    }
  });
  url = canvas.toDataURL();
  emblems.set(kind, url);
  return url;
}

export class Moments implements MomentSink {
  private root = h('div', { id: 'moment' });
  private queue: Moment[] = [];
  private timer = 0;

  constructor() {
    this.root.hidden = true;
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');
    document.body.append(this.root);
  }

  show(m: Moment): void {
    if (this.queue.length >= MAX_QUEUE) this.queue.shift();
    this.queue.push(m);
    if (this.root.hidden && !this.timer) this.next();
  }

  private next(): void {
    const m = this.queue.shift();
    if (!m) {
      this.root.hidden = true;
      this.timer = 0;
      return;
    }
    this.root.hidden = false;
    this.root.dataset.kind = m.kind;
    this.root.classList.remove('in');
    void this.root.offsetWidth; // restart the entrance
    this.root.classList.add('in');
    this.root.replaceChildren(
      h('img', { class: 'mo-emblem', src: emblem(m.kind), alt: '' }),
      h('div', { class: 'mo-text' }, h('b', { text: m.title }), h('span', { text: m.sub })),
    );
    this.timer = window.setTimeout(() => this.next(), this.queue.length ? SHOW_MS_BUSY : SHOW_MS);
  }
}
