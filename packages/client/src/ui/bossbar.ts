/** The legendary-boss header: themed pixel frame (boss-frames.ts) with DOM text, fill, chips and a mechanic line. */
import type { BossDef } from '@eigenlands/shared';
import { ENEMY_BY_KIND } from '@eigenlands/shared';
import { h } from './dom';
import { enemyChips, poiseLabel, type EnemyChip } from './enemy-model';
import { bossPhase, type Encounter } from './encounter-model';
import { HealthMeter } from './healthmeter';
import { iconSvg } from './icons';
import { BOSS_H, BOSS_W, WINDOW, renderBossFrame, themeFor, themeVars } from './boss-frames';

export interface BossFrameInput extends Encounter {
  poise?: number;
  st?: number;
}

export class BossBar {
  readonly root = h('div', { id: 'boss-bar' });
  private canvas = h('canvas', { class: 'bb-canvas' });
  private name = h('span', { class: 'bb-name' });
  private title = h('span', { class: 'bb-title' });
  private phase = h('span', { class: 'bb-phase' });
  private sub = h('div', { class: 'bb-sub' });
  private chips = h('div', { class: 'bb-chips' });
  private armorFill = h('i');
  private armorText = h('span');
  private armor = h(
    'div',
    { class: 'bb-armor' },
    this.armorText,
    h('div', { class: 'bb-armor-track' }, this.armorFill),
  );
  private health = new HealthMeter();
  private ticks = h('div', { class: 'bb-ticks' });
  private identity = '';
  private paintedKey = '';
  private chipKey = '';
  private lastPaint = -1;

  constructor() {
    this.canvas.width = BOSS_W;
    this.canvas.height = BOSS_H;
    this.canvas.setAttribute('aria-hidden', 'true');
    this.health.root.append(this.ticks);
    this.sub.setAttribute('aria-live', 'polite');
    this.armor.setAttribute('role', 'progressbar');
    this.armor.setAttribute('aria-label', 'Boss armor');
    this.armor.setAttribute('aria-valuemin', '0');
    this.armor.setAttribute('aria-valuemax', '100');
    const style = this.root.style;
    style.setProperty('--bw', String(BOSS_W));
    style.setProperty('--bh', String(BOSS_H));
    style.setProperty('--wx', String(WINDOW.x));
    style.setProperty('--wy', String(WINDOW.y));
    style.setProperty('--ww', String(WINDOW.w));
    style.setProperty('--wh', String(WINDOW.h));
    this.root.append(
      this.canvas,
      h('div', { class: 'bb-head' }, h('span', { class: 'bb-names' }, this.name, this.title), this.phase),
      this.health.root,
      this.armor,
      this.chips,
      this.sub,
    );
    this.root.hidden = true;
    document.body.append(this.root);
  }

  hide(): void {
    this.root.hidden = true;
  }

  update(b: BossFrameInput, def: BossDef, note: string, t: number): void {
    this.root.hidden = false;
    const theme = themeFor(def);
    if (this.identity !== `${b.id}:${b.kind}`) {
      this.identity = `${b.id}:${b.kind}`;
      this.paintedKey = '';
      this.chipKey = '';
      this.root.dataset.boss = def.id;
      for (const [k, v] of Object.entries(themeVars(theme))) this.root.style.setProperty(k, v);
      this.name.textContent = theme.name;
      this.title.textContent = theme.title;
      this.ticks.replaceChildren(...def.phases.map((ph) => h('i', { class: 'bb-tick', style: `left:${ph * 100}%` })));
    }
    this.health.update(b.id, theme.name, b.hp, b.maxHp);
    const frac = b.maxHp > 0 ? b.hp / b.maxHp : 0;
    const phaseNow = bossPhase(b.kind, b.hp, b.maxHp);
    this.phase.textContent = `Phase ${phaseNow} / ${def.phases.length + 1}`;
    // frame art: repaint on phase gems changing, and a few times a second while the runes shimmer
    const key = `${this.identity}:${phaseNow}`;
    if (key !== this.paintedKey || (t > 0 && t - this.lastPaint > 0.25)) {
      this.paintedKey = key;
      this.lastPaint = t;
      renderBossFrame(this.canvas.getContext('2d')!, theme, { frac, phases: def.phases, t });
    }
    // armour, stance and the encounter's own hint
    const enemy = ENEMY_BY_KIND[b.kind];
    const hasArmor = !!enemy?.poise && b.poise !== undefined;
    this.armor.hidden = !hasArmor;
    if (hasArmor) {
      const p = Math.max(0, Math.min(100, Math.round(b.poise!)));
      this.armorFill.style.width = `${p}%`;
      const label = `${poiseLabel(enemy)} ${p}%`;
      if (this.armorText.textContent !== label) this.armorText.textContent = label;
      this.armor.setAttribute('aria-valuenow', String(p));
    }
    const chips: EnemyChip[] = [
      {
        id: 'phase',
        label: `Phase ${phaseNow}`,
        icon: 'rune',
        tone: 'warn',
        desc: 'Bosses change tactics at health thresholds.',
      },
      ...enemyChips({ faction: 'hostile', def: enemy, elite: 0, st: b.st ?? 0, night: false }).filter((c) =>
        ['windup', 'staggered', 'recovering'].includes(c.id),
      ),
    ];
    const ck = chips.map((c) => c.label).join();
    if (ck !== this.chipKey) {
      this.chipKey = ck;
      this.chips.replaceChildren(
        ...chips.map((c) => {
          const el = h('span', { class: `tf-chip tone-${c.tone}`, title: c.desc });
          el.innerHTML = `${iconSvg(c.icon, 9)}<b></b>`;
          el.querySelector('b')!.textContent = c.label;
          return el;
        }),
      );
    }
    if (this.sub.textContent !== note) this.sub.textContent = note;
  }
}
