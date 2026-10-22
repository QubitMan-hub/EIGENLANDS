import { h } from './dom';

export interface TargetInfo {
  name: string; level: number; hp: number; maxHp: number;
  kind: 'enemy' | 'player';
  /** extra tags, e.g. "Hardened" */
  tags: string[];
  /** 0..100 armour bar, enemies that have poise */
  poise: number | null;
  /** distance in tiles */
  dist: number;
}

const CSS = `
#target-frame{position:fixed;top:12px;left:50%;transform:translateX(-50%);width:min(340px,70vw);z-index:30;pointer-events:none;
  font:600 12px/1.2 system-ui,sans-serif;color:#eaf0ff;text-shadow:0 1px 0 #000a;opacity:0;transition:opacity .15s}
#target-frame.on{opacity:1}
#target-frame .tf-head{display:flex;justify-content:space-between;gap:8px;margin-bottom:3px}
#target-frame .tf-name{font-size:13px;letter-spacing:.3px}
#target-frame .tf-tags{opacity:.75;font-weight:500}
#target-frame .tf-bar{position:relative;height:14px;background:#0b0c1acc;border:1px solid #7fa8ff88;border-radius:3px;overflow:hidden}
#target-frame .tf-ghost,#target-frame .tf-fill{position:absolute;left:0;top:0;bottom:0}
#target-frame .tf-ghost{background:#fff;opacity:.8;transition:width .5s ease .25s}
#target-frame .tf-fill{background:linear-gradient(#ff7a7a,#c93a4a);transition:width .12s}
#target-frame.ally .tf-fill{background:linear-gradient(#8bf59a,#2f9b5a)}
#target-frame .tf-num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px}
#target-frame .tf-poise{height:3px;margin-top:2px;background:#0b0c1acc;border-radius:2px;overflow:hidden}
#target-frame .tf-poise i{display:block;height:100%;background:#ffd36a;transition:width .1s}
`;

/** Top-centre target frame: name, level, health (with a trailing damage ghost), numbers, poise and tags. */
export class TargetFrame {
  readonly root = h('div', { id: 'target-frame' });
  private name = h('span', { class: 'tf-name' });
  private tags = h('span', { class: 'tf-tags' });
  private ghost = h('div', { class: 'tf-ghost' });
  private fill = h('div', { class: 'tf-fill' });
  private num = h('div', { class: 'tf-num' });
  private poiseFill = h('i');
  private poiseBar = h('div', { class: 'tf-poise' }, this.poiseFill);

  constructor() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.append(style);
    this.root.append(
      h('div', { class: 'tf-head' }, this.name, this.tags),
      h('div', { class: 'tf-bar' }, this.ghost, this.fill, this.num),
      this.poiseBar,
    );
    this.root.setAttribute('aria-live', 'off');
    document.body.append(this.root);
  }

  update(t: TargetInfo | null): void {
    this.root.classList.toggle('on', !!t);
    if (!t) return;
    this.root.classList.toggle('ally', t.kind === 'player');
    this.name.textContent = `${t.name} · Lv ${t.level}`;
    this.tags.textContent = [...t.tags, `${Math.round(t.dist)}m`].join(' · ');
    const pct = `${Math.max(0, Math.min(100, (t.hp / Math.max(1, t.maxHp)) * 100))}%`;
    this.fill.style.width = pct;
    this.ghost.style.width = pct;
    this.num.textContent = `${Math.max(0, Math.round(t.hp))} / ${Math.round(t.maxHp)}`;
    this.poiseBar.style.display = t.poise === null ? 'none' : '';
    if (t.poise !== null) this.poiseFill.style.width = `${t.poise}%`;
  }
}
