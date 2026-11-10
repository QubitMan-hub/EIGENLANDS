import { voxelBoxesCanvas } from '../art/voxel-icons';
import { solidBox } from '../game/voxel/mesh';
import { h } from './dom';
import { FACTION_LABEL, type EnemyChip, type Faction } from './enemy-model';
import { HealthMeter } from './healthmeter';
import { iconSvg } from './icons';

/** Classification gem: a small isometric block in the camp's colours, drawn once per camp. */
const GEM: Record<Faction, number> = {
  hostile: 0xe16550,
  neutral: 0xdcb15f,
  passive: 0x63ba7f,
  ally: 0x5fbed3,
  elite: 0xe4b6fa,
};
const gems = new Map<Faction, string>();
export function gemUrl(f: Faction): string {
  let url = gems.get(f);
  if (url) return url;
  url = voxelBoxesCanvas(
    [
      solidBox(0, 0.12, 0, 0.65, 0.24, 0.65, 0x3b4741),
      solidBox(0, 0.42, 0, 0.45, 0.36, 0.45, GEM[f]),
      solidBox(0, 0.65, 0, 0.22, 0.1, 0.22, 0xffe4a3),
    ],
    64,
  ).toDataURL();
  gems.set(f, url);
  return url;
}

export interface TargetInfo {
  id: string;
  name: string;
  level: number | null;
  hp: number;
  maxHp: number;
  kind: 'enemy' | 'player';
  faction: Faction;
  chips: EnemyChip[];
  /** Server-normalized remaining poise, 0..100. */
  poise: number | null;
  poiseLabel: string;
  dist: number;
}

/** Only the deliberately selected target receives screen-space detail. */
export class TargetFrame {
  readonly root = h('div', { id: 'target-frame' });
  private name = h('span', { class: 'tf-name' });
  private distance = h('span', { class: 'tf-distance' });
  private tags = h('div', { class: 'tf-chips' });
  private gem = h('i', { class: 'tf-gem' });
  private shown = '';
  private health = new HealthMeter();
  private poiseFill = h('i');
  private poiseText = h('span');
  private poiseBar = h(
    'div',
    { class: 'tf-poise' },
    this.poiseText,
    h('div', { class: 'tf-poise-track' }, this.poiseFill),
  );

  constructor() {
    this.root.hidden = true;
    this.root.append(
      h('div', { class: 'tf-head' }, this.gem, this.name, this.distance),
      this.health.root,
      this.poiseBar,
      this.tags,
    );
    this.root.setAttribute('aria-live', 'off');
    this.poiseBar.setAttribute('role', 'progressbar');
    this.poiseBar.setAttribute('aria-label', 'Remaining poise or armor');
    this.poiseBar.setAttribute('aria-valuemin', '0');
    this.poiseBar.setAttribute('aria-valuemax', '100');
    document.body.append(this.root);
  }
  update(t: TargetInfo | null): void {
    this.root.hidden = !t;
    if (!t) return;
    this.root.dataset.faction = t.faction;
    this.root.classList.toggle('ally', t.faction === 'ally');
    this.name.textContent = `${t.name}${t.level === null ? '' : ` · Lv ${t.level}`}`;
    this.distance.textContent = `${Math.round(t.dist)} tiles`;
    const key = t.faction + t.chips.map((c) => c.id).join();
    if (key !== this.shown) {
      this.shown = key;
      this.gem.style.backgroundImage = `url(${gemUrl(t.faction)})`;
      this.gem.title = FACTION_LABEL[t.faction];
      this.tags.replaceChildren(
        ...t.chips.map((c) => {
          const el = h('span', { class: `tf-chip tone-${c.tone}`, title: c.desc });
          el.innerHTML = `${iconSvg(c.icon, 9)}<b></b>`;
          el.querySelector('b')!.textContent = c.label;
          return el;
        }),
      );
    }
    this.health.update(t.id, t.name, t.hp, t.maxHp);
    this.poiseBar.hidden = t.poise === null;
    if (t.poise !== null) {
      const p = Number.isFinite(t.poise) ? Math.max(0, Math.min(100, Math.round(t.poise))) : 0;
      this.poiseFill.style.width = `${p}%`;
      this.poiseText.textContent = `${t.poiseLabel} ${p}%`;
      this.poiseBar.setAttribute('aria-valuenow', String(p));
    }
  }
}
