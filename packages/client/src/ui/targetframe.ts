import { h } from './dom';
import { HealthMeter } from './healthmeter';

export interface TargetInfo {
  id: string; name: string; level: number | null; hp: number; maxHp: number;
  kind: 'enemy' | 'player'; tags: string[];
  /** Server-normalized remaining poise, 0..100. */
  poise: number | null;
  dist: number;
}

/** Only the deliberately selected target receives screen-space detail. */
export class TargetFrame {
  readonly root = h('div', { id: 'target-frame' });
  private name = h('span', { class: 'tf-name' });
  private distance = h('span', { class: 'tf-distance' });
  private tags = h('div', { class: 'tf-tags' });
  private health = new HealthMeter();
  private poiseFill = h('i');
  private poiseText = h('span');
  private poiseBar = h('div', { class: 'tf-poise' }, this.poiseText, h('div', { class: 'tf-poise-track' }, this.poiseFill));

  constructor() {
    this.root.hidden = true;
    this.root.append(h('div', { class: 'tf-head' }, this.name, this.distance), this.health.root, this.poiseBar, this.tags);
    this.root.setAttribute('aria-live', 'off');
    this.poiseBar.setAttribute('role', 'progressbar');
    this.poiseBar.setAttribute('aria-label', 'Remaining poise');
    this.poiseBar.setAttribute('aria-valuemin', '0'); this.poiseBar.setAttribute('aria-valuemax', '100');
    document.body.append(this.root);
  }
  update(t: TargetInfo | null): void {
    this.root.hidden = !t;
    if (!t) return;
    this.root.classList.toggle('ally', t.kind === 'player');
    this.name.textContent = `${t.name}${t.level === null ? '' : ` · Lv ${t.level}`}`;
    this.distance.textContent = `${Math.round(t.dist)} tiles`;
    this.tags.textContent = t.tags.join(' · ');
    this.health.update(t.id, t.name, t.hp, t.maxHp);
    this.poiseBar.hidden = t.poise === null;
    if (t.poise !== null) {
      const p = Number.isFinite(t.poise) ? Math.max(0, Math.min(100, Math.round(t.poise))) : 0;
      this.poiseFill.style.width = `${p}%`; this.poiseText.textContent = `Poise ${p}%`;
      this.poiseBar.setAttribute('aria-valuenow', String(p));
    }
  }
}
