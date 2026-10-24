import { ITEMS, PALETTE, TIER_NAMES, CROPS, itemName, type Stack } from '@eigenlands/shared';
import { itemIconUrl } from '../art/icons';

type Child = Node | string | null | undefined | false;
export interface Attrs {
  class?: string; text?: string; title?: string; style?: string; id?: string; type?: string; value?: string;
  placeholder?: string; src?: string; alt?: string; draggable?: boolean; disabled?: boolean; maxLength?: number;
  on?: Partial<{ [K in keyof HTMLElementEventMap]: (e: HTMLElementEventMap[K]) => void }>;
  data?: Record<string, string | number>;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs.class) el.className = attrs.class;
  if (attrs.text !== undefined) el.textContent = attrs.text;
  if (attrs.title) el.title = attrs.title;
  if (attrs.style) el.setAttribute('style', attrs.style);
  if (attrs.id) el.id = attrs.id;
  if (attrs.type) (el as HTMLInputElement).type = attrs.type;
  if (attrs.value !== undefined) (el as HTMLInputElement).value = attrs.value;
  if (attrs.placeholder) (el as HTMLInputElement).placeholder = attrs.placeholder;
  if (attrs.src) (el as HTMLImageElement).src = attrs.src;
  if (attrs.alt !== undefined) (el as HTMLImageElement).alt = attrs.alt;
  if (attrs.maxLength) (el as HTMLInputElement).maxLength = attrs.maxLength;
  if (attrs.draggable) el.draggable = true;
  if (attrs.disabled) (el as HTMLButtonElement).disabled = true;
  if (attrs.data) for (const [k, v] of Object.entries(attrs.data)) el.dataset[k] = String(v);
  if (attrs.on) for (const [k, fn] of Object.entries(attrs.on)) el.addEventListener(k, fn as EventListener);
  for (const k of kids) if (k) el.append(k);
  return el;
}

export function clear(el: Element): void { while (el.firstChild) el.removeChild(el.firstChild); }

/** Inventory/crafting item cell: pixel icon with a count badge. */
export function iconCell(stack: Stack | null, opts: { size?: number; showCount?: boolean } = {}): HTMLElement {
  const cell = h('div', { class: 'cell' });
  if (!stack) return cell;
  cell.append(h('img', { class: 'ico', style: `width:${(opts.size ?? 16) * 2}px;height:${(opts.size ?? 16) * 2}px` }));
  (cell.firstChild as HTMLImageElement).src = itemIconUrl(stack.id);
  (cell.firstChild as HTMLImageElement).alt = ITEMS[stack.id]?.name ?? stack.id;
  if ((opts.showCount ?? true) && stack.n > 1) cell.append(h('span', { class: 'cnt', text: String(stack.n) }));
  if (stack.p?.tier && ITEMS[stack.id]?.kind === 'tool') cell.append(h('span', { class: 'tier', text: String(stack.p.tier) }));
  return cell;
}

export const PHASE_COLOR = [35, 36, 38, 13, 47, 27, 43, 45].map((i) => PALETTE[i]!);
export const PHASE_NAME = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'violet', 'magenta'];
export const phaseDot = (phase: number): HTMLElement => {
  const c = PHASE_COLOR[Math.round(phase) % 8]!;
  return h('span', { class: 'phase-dot', style: `background:${c}`, title: `Phase: ${PHASE_NAME[Math.round(phase) % 8]}` });
};

export const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];

const STAT_LABEL: Record<string, string> = { atk: 'Attack', dur: 'Durability', eff: 'Efficiency', spd: 'Speed', mag: 'Magic' };

/** Rich tooltip content for an item stack. */
export function tooltipFor(s: Stack): HTMLElement {
  const d = ITEMS[s.id];
  const root = h('div', { class: 'tip' });
  if (!d) { root.append(h('b', { text: s.id })); return root; }
  const q = s.p?.qname ? ` q-${s.p.qname.toLowerCase()}` : '';
  root.append(h('div', { class: `tip-name${q}`, text: itemName(s) }));
  root.append(h('div', { class: 'tip-kind', text: d.kind }));
  if (d.tool) root.append(h('div', { class: 'tip-line', text: `Tier ${s.p?.tier ?? 1} (${TIER_NAMES[(s.p?.tier ?? 1) - 1] ?? '?'})` }));
  if (d.id === 'sword') root.append(h('div', { class: 'tip-line', text: `Attack +${s.p?.atk ?? 0}` }));
  if (s.p?.phase !== undefined) root.append(h('div', { class: 'tip-line' }, 'Phase ', phaseDot(s.p.phase), ` ${PHASE_NAME[Math.round(s.p.phase) % 8]}`));
  else if (d.phase !== undefined) root.append(h('div', { class: 'tip-line' }, 'Phase ', phaseDot(d.phase), ` ${PHASE_NAME[d.phase]}`));
  if (s.p?.stats) for (const [k, v] of Object.entries(s.p.stats)) if (v) root.append(h('div', { class: `tip-line ${v > 0 ? 'good' : 'bad'}`, text: `${v > 0 ? '+' : ''}${v} ${STAT_LABEL[k] ?? k}` }));
  if (s.p?.note) root.append(h('div', { class: 'tip-note', text: s.p.note }));
  if (d.kind === 'ring' && s.p?.stat) root.append(h('div', { class: 'tip-line good', text: `+${s.p.val} ${s.p.stat === 'hp' ? 'max HP' : s.p.stat === 'atk' ? 'attack' : s.p.stat === 'luck' ? 'luck' : 'haste'}` }));
  if(d.nourishment)root.append(h('div',{class:'tip-line good',text:`Restores ${d.nourishment} food`}));
  if (d.heal) root.append(h('div', { class: 'tip-line good', text: `Heals ${d.heal}` }));
  if (d.buff) root.append(h('div', { class: 'tip-line good', text: `${d.buff.kind} for ${d.buff.secs}s` }));
  if (d.kind === 'seed' && d.crop && CROPS[d.crop]) {
    const c = CROPS[d.crop]!;
    root.append(h('div', { class: 'tip-line', text: `${c.days} day${c.days > 1 ? 's' : ''} to ripen${c.regrow ? `, regrows in ${c.regrow}` : ''}` }));
    root.append(h('div', { class: 'tip-line', text: c.seasons.map((i) => SEASON_NAMES[i]).join(' / ') }));
  }
  if (s.id === 'superposed_seed' && s.p?.a && s.p?.b) root.append(h('div', { class: 'tip-line', text: `${ITEMS[`${s.p.a}`]?.name ?? s.p.a} ⇄ ${ITEMS[`${s.p.b}`]?.name ?? s.p.b}` }));
  root.append(h('div', { class: 'tip-desc', text: d.desc }));
  if (d.value) root.append(h('div', { class: 'tip-val', text: `Base value ${d.value}c` }));
  return root;
}

/** Floating tooltip that follows the pointer. */
export class Tooltip {
  private el = h('div', { id: 'tooltip', class: 'panel' });
  constructor() { this.el.hidden = true; document.body.append(this.el); }
  show(content: HTMLElement, x: number, y: number): void {
    clear(this.el); this.el.append(content); this.el.hidden = false;
    const r = this.el.getBoundingClientRect();
    this.el.style.left = `${Math.min(window.innerWidth - r.width - 8, x + 14)}px`;
    this.el.style.top = `${Math.min(window.innerHeight - r.height - 8, y + 14)}px`;
  }
  hide(): void { this.el.hidden = true; }
  attach(el: HTMLElement, get: () => HTMLElement | null): void {
    el.addEventListener('pointerenter', (e) => { const c = get(); if (c) this.show(c, e.clientX, e.clientY); });
    el.addEventListener('pointermove', (e) => { if (!this.el.hidden) this.show(this.el.firstElementChild as HTMLElement, e.clientX, e.clientY); });
    el.addEventListener('pointerleave', () => this.hide());
    el.addEventListener('pointerdown', () => this.hide());
  }
}
