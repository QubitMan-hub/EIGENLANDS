/**
 * HUD ability bar: the four action-bar orbs (lines 0-3) and the ultimate, each with its glyph, the colour and glyph
 * of its most likely form, key label and a cooldown sweep; the class resource bar; the Board button. On phones the
 * same bar docks next to the touch buttons as big round buttons.
 */
import { ABILITIES, ACTIVE_LINES, CLASSES, RESOURCE_MAX, type AbilityId, type ClassId, type LinePreview } from '@eigenlands/shared';
import { h } from './el';
import { iconSvg } from '../../ui/icons';
import { elementIcon, elHex, elName, hex } from './art';
import { cdFraction, cdLabel } from './model';
import { formName, orbName } from './text';

export interface BarSlotInfo {
  ability: AbilityId | null;
  /** most likely form preview of the attuned board, null when the line is empty */
  line: LinePreview | null;
  unlocked: boolean;
  /** server ms when ready */
  readyAt: number;
  totalMs: number;
}

interface SlotEl { el: HTMLButtonElement; glyph: HTMLElement; el2: HTMLImageElement; key: HTMLElement; sweep: HTMLElement; num: HTMLElement; last: string }

export class AbilityBar {
  readonly root = h('div', { id: 'p3-abar' });
  private slots: SlotEl[] = [];
  private ult: SlotEl;
  private res = h('div', { class: 'p3-res' });
  private resFill = h('i');
  private resText = h('span');
  private resName = h('b');
  readonly boardBtn: HTMLButtonElement;
  private sig = '';
  private touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  constructor(private act: { cast(line: number, direct: boolean): void; ult(direct: boolean): void; board(): void }) {
    this.root.classList.toggle('p3-touch', this.touch);
    this.root.setAttribute('role', 'toolbar');
    this.root.setAttribute('aria-label', 'Orb abilities');
    const row = h('div', { class: 'p3-slots' });
    for (let i = 0; i < ACTIVE_LINES; i++) {
      const s = this.makeSlot(`p3-slot`, direct => this.act.cast(i, direct));
      this.slots.push(s);
      row.append(s.el);
    }
    this.ult = this.makeSlot('p3-slot p3-ult', direct => this.act.ult(direct));
    row.append(this.ult.el);
    this.res.append(this.resName, h('span', { class: 'p3-res-bar' }, this.resFill), this.resText);
    this.root.append(this.res, row);
    this.boardBtn = h('button', { id: 'btn-board', class: 'gatebtn', title: 'Circuit Board (B)', on: { click: () => this.act.board() } });
    this.boardBtn.innerHTML = iconSvg('bolt', 20);
    this.boardBtn.setAttribute('aria-label', 'Circuit Board (B)');
    const hud = document.getElementById('hud');
    (hud ?? document.body).append(this.root);
    const btns = document.getElementById('hud-btns');
    if (btns) btns.append(this.boardBtn); else this.root.append(this.boardBtn);
  }

  setArmed(q: number | null): void {
    [...this.slots, this.ult].forEach((s, i) => { s.el.classList.toggle('aiming', q === i); s.el.setAttribute('aria-pressed', String(q === i)); });
  }

  private makeSlot(cls: string, fire: (direct: boolean) => void): SlotEl {
    const glyph = h('span', { class: 'p3-glyph' });
    const el2 = h('img', { class: 'p3-el', alt: '' });
    const key = h('span', { class: 'p3-key' });
    const sweep = h('span', { class: 'p3-sweep' });
    const num = h('span', { class: 'p3-cdn' });
    const el = h('button', { class: cls }, sweep, glyph, el2, key, num);
    // pointerdown so a tap fires at once on touch screens (no 300ms click delay, works while the stick is held)
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fire(e.pointerType === 'touch' || e.pointerType === 'pen'); });
    el.addEventListener('click', (e) => { if (e.detail === 0) fire(false); });
    return { el, glyph, el2, key, sweep, num, last: '' };
  }

  /** Static content (abilities, element tint, keys). Cheap to call often: only touches the DOM when something changed. */
  setup(info: BarSlotInfo[], keys: string[], cls: ClassId, ultKey: string, level: number): void {
    const sig = JSON.stringify([info.map((i) => [i.ability, i.unlocked, i.line?.pB.toFixed(2), i.line?.hueA, i.line?.hueB, i.line?.locked]), keys, cls, ultKey, level]);
    if (sig === this.sig) return;
    this.sig = sig;
    info.forEach((inf, i) => {
      const s = this.slots[i]!;
      const a = inf.ability;
      const lp = inf.line;
      s.el.classList.toggle('empty', !a);
      s.el.classList.toggle('locked', !inf.unlocked);
      s.key.textContent = keys[i] ?? '';
      if (!inf.unlocked) {
        s.glyph.textContent = '🔒︎'; s.el2.hidden = true;
        s.el.title = `${orbName(i)} is still asleep. Orbs unlock as you level up.`;
        s.el.setAttribute('aria-label', `${orbName(i)}: locked`);
        s.el.style.removeProperty('--c');
        return;
      }
      if (!a || !lp) {
        s.glyph.textContent = '+'; s.el2.hidden = true;
        s.el.title = `${orbName(i)} has no ability. Open the Circuit Board to put one on it.`;
        s.el.setAttribute('aria-label', `${orbName(i)}: empty, opens the Circuit Board`);
        s.el.style.removeProperty('--c');
        return;
      }
      const likelyB = lp.pB > 0.5;
      const hue = likelyB ? lp.hueB : lp.hueA;
      const def = ABILITIES[a];
      s.glyph.textContent = def.glyph;
      s.el2.hidden = false;
      s.el2.src = elementIcon(hue);
      s.el2.alt = elName(hue);
      s.el.style.setProperty('--c', elHex(hue));
      s.el.style.setProperty('--c2', elHex(likelyB ? lp.hueA : lp.hueB));
      s.el.classList.toggle('split', lp.pB > 0.02 && lp.pB < 0.98);
      s.el.classList.toggle('lockd', lp.locked === 0 || lp.locked === 1);
      const odds = lp.pB <= 0.02 ? formName(a, 0, lp.hueA) : lp.pB >= 0.98 ? formName(a, 1, lp.hueB) : `${formName(a, 0, lp.hueA)} or ${formName(a, 1, lp.hueB)}`;
      s.el.title = `${def.name} (${keys[i] ?? ''}): ${odds}`;
      s.el.setAttribute('aria-label', `${def.name}, ${odds}, key ${keys[i] ?? ''}`);
    });
    const c = CLASSES[cls];
    const u = this.ult;
    const hasUlt = cls !== 'wanderer';
    u.el.classList.toggle('locked', !hasUlt);
    u.glyph.textContent = hasUlt ? c.ultimate.glyph : '·';
    u.el2.hidden = true;
    u.key.textContent = ultKey;
    u.el.style.setProperty('--c', hex(c.resource.color));
    u.el.title = hasUlt ? `${c.ultimate.name} (${ultKey}): ${c.ultimate.desc} Needs a full ${c.resource.name} bar.` : 'Choose a path to unlock an ultimate.';
    u.el.setAttribute('aria-label', hasUlt ? `Ultimate: ${c.ultimate.name}, key ${ultKey}` : 'Ultimate: locked');
    this.res.hidden = !hasUlt;
    this.resName.textContent = c.resource.name;
    this.res.style.setProperty('--c', hex(c.resource.color));
    this.res.title = c.resource.desc;
    void level;
  }

  /** Per-frame: cooldown sweeps and the resource fill. */
  update(info: BarSlotInfo[], ult: { readyAt: number; totalMs: number; v: number; max: number }, now: number): void {
    info.forEach((inf, i) => this.sweep(this.slots[i]!, inf.readyAt, inf.totalMs, now));
    this.sweep(this.ult, ult.readyAt, ult.totalMs, now);
    const full = ult.v >= ult.max && ult.max > 0;
    this.ult.el.classList.toggle('charged', full && ult.readyAt <= now);
    this.ult.el.style.setProperty('--fill', `${Math.round((Math.min(ult.max, ult.v) / Math.max(1, ult.max)) * 100)}%`);
    const pctv = `${Math.round((Math.min(ult.max, ult.v) / Math.max(1, ult.max)) * 100)}%`;
    if (this.resFill.style.width !== pctv) this.resFill.style.width = pctv;
    const t = String(Math.floor(ult.v));
    if (this.resText.textContent !== t) this.resText.textContent = t;
  }

  private sweep(s: SlotEl, readyAt: number, total: number, now: number): void {
    const f = cdFraction(readyAt, now, total);
    const k = `${f.toFixed(3)}|${cdLabel(readyAt, now)}`;
    if (k === s.last) return;
    s.last = k;
    s.sweep.style.setProperty('--cd', `${(f * 360).toFixed(1)}deg`);
    s.el.classList.toggle('cooling', f > 0);
    s.num.textContent = cdLabel(readyAt, now);
  }

  /** Visual feedback on a slot: 'cast' flash, 'misfire', 'echo' (fired through a Link), 'denied'. */
  pulse(line: number | 'ult', kind: 'cast' | 'misfire' | 'echo' | 'denied'): void {
    const s = line === 'ult' ? this.ult : this.slots[line];
    if (!s) return;
    s.el.classList.remove(kind);
    void s.el.offsetWidth;
    s.el.classList.add(kind);
    window.setTimeout(() => s.el.classList.remove(kind), 600);
  }

  get resourceMax(): number { return RESOURCE_MAX; }
}
