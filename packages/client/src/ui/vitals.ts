/**
 * Vitals HUD: health, mana (class resource), stamina (dash charges), food and water as isometric vials, plus an
 * expandable status row. All values come from real game state; see vitals-model.ts for the rules and
 * vitals-art.ts for the painter.
 */
import { Iso } from '../art/isokit';
import { makeCanvas, rasterPixels, C } from '../art/shade';
import { h } from './dom';
import { iconSvg } from './icons';
import {
  GaugeMotion,
  collectStatuses,
  formatLeft,
  lowHealth,
  needTone,
  splitChips,
  type GaugeId,
  type StatusEntry,
  type StatusInput,
  type StatusTone,
} from './vitals-model';
import { renderVitals, vitalsLayout, type VialSpec } from './vitals-art';

export interface VitalsFrame {
  hp: number;
  maxHp: number;
  /** class resource (mana); null when the class has none yet */
  mana: { v: number; max: number; name: string } | null;
  /** sprint stamina as a fraction and a 0..100 value; dash charges ride on the plinth as pips */
  stamina: { frac: number; value: number; charges: number; max: number };
  needs: { food: number; water: number } | null;
  auras: StatusInput['auras'];
  buffs: StatusInput['buffs'];
  serverNow: number;
}

const GAUGE_LABEL: Record<GaugeId, string> = {
  health: 'Health',
  mana: 'Mana',
  stamina: 'Stamina',
  food: 'Food',
  water: 'Water',
};
const ICON: Record<GaugeId, string> = {
  health: 'heart',
  mana: 'rune',
  stamina: 'bolt',
  food: 'st_food',
  water: 'st_drop',
};

/** A small isometric pedestal (2:1 block) per status tone, drawn once and reused as the chip's floor. */
const pedestals = new Map<StatusTone, string>();
export function pedestal(tone: StatusTone): string {
  let url = pedestals.get(tone);
  if (url) return url;
  const ramp: Record<StatusTone, [number, number, number]> = {
    buff: [C.g2, C.g4, C.g6],
    debuff: [C.r1, C.r3, C.r5],
    aura: [C.w2, C.w4, C.w6],
    need: [C.e3, C.e5, C.e7],
  };
  const [dk, md, lt] = ramp[tone];
  const { canvas, ctx } = makeCanvas(14, 11);
  rasterPixels(ctx, 14, 11, () => {
    const iso = new Iso(ctx, 7, 2);
    iso.box(0, 0, 0, 6, 6, 2, {
      top: (a, b) => (a < 0.2 || b < 0.2 ? lt : md),
      left: () => dk,
      right: () => C.night,
    });
  });
  url = canvas.toDataURL();
  pedestals.set(tone, url);
  return url;
}

export class VitalsHud {
  private readonly canvas = h('canvas', { class: 'vitals-canvas' });
  private readonly labels = h('div', { class: 'vitals-labels' });
  private readonly chips = h('div', { class: 'status-row' });
  private readonly list = h('ul', { class: 'status-list' });
  private readonly motion: Record<GaugeId, GaugeMotion> = {
    health: new GaugeMotion(),
    mana: new GaugeMotion(),
    stamina: new GaugeMotion(),
    food: new GaugeMotion(),
    water: new GaugeMotion(),
  };
  private ids: GaugeId[] = [];
  private layout = vitalsLayout([]);
  private labelEls = new Map<GaugeId, HTMLElement>();
  private lastText = new Map<GaugeId, string>();
  private key = '';
  private lastPaint = -1;
  private statusKey = '';
  private expanded = false;
  private t = 0;
  private entries: StatusEntry[] = [];

  constructor(private readonly root: HTMLElement) {
    this.canvas.setAttribute('aria-hidden', 'true');
    this.list.hidden = true;
    this.list.id = 'status-list';
    root.append(this.canvas, this.labels, this.chips, this.list);
    root.classList.add('vitals');
  }

  /** Test/debug view of what the HUD currently shows. */
  debug(): Record<string, unknown> {
    return {
      gauges: this.ids,
      statuses: this.entries.map((e) => ({ id: e.id, left: e.left })),
      expanded: this.expanded,
    };
  }

  update(f: VitalsFrame, dt: number, reduced: boolean): void {
    this.t += reduced ? 0 : dt;
    const ids: GaugeId[] = ['health'];
    if (f.mana) ids.push('mana');
    ids.push('stamina');
    if (f.needs) ids.push('food', 'water');
    if (ids.join() !== this.ids.join()) this.rebuild(ids);

    const frac: Record<GaugeId, number> = {
      health: f.maxHp > 0 ? f.hp / f.maxHp : 0,
      mana: f.mana && f.mana.max > 0 ? f.mana.v / f.mana.max : 0,
      stamina: f.stamina.frac,
      food: f.needs ? f.needs.food / 100 : 0,
      water: f.needs ? f.needs.water / 100 : 0,
    };
    let moving = false;
    for (const id of this.ids) moving = this.motion[id].step(dt, frac[id], reduced) || moving;

    const auraTop = f.auras.includes('shield')
      ? 'shield'
      : f.auras.includes('mirror')
        ? 'mirror'
        : f.auras.includes('ward')
          ? 'ward'
          : null;
    const specs = {} as Record<GaugeId, VialSpec>;
    let pulsing = false;
    for (const id of this.ids) {
      const m = this.motion[id];
      const tone =
        id === 'food' ? needTone(f.needs?.food ?? 100) : id === 'water' ? needTone(f.needs?.water ?? 100) : 'ok';
      const low = id === 'health' ? lowHealth(f.hp, f.maxHp) : tone !== 'ok';
      const ready = id === 'mana' && !!f.mana && f.mana.v >= f.mana.max && f.mana.max > 0;
      if (!reduced && (low || ready)) pulsing = true;
      specs[id] = {
        id,
        shown: m.shown,
        trail: m.trail,
        flash: m.flash,
        gain: m.gain,
        low,
        tone,
        aura: id === 'health' ? auraTop : null,
        pips: id === 'stamina' ? f.stamina.charges : 0,
        pipMax: id === 'stamina' ? f.stamina.max : 0,
        ready,
        t: reduced ? 0 : this.t,
      };
    }
    const key =
      this.ids
        .map((id) => {
          const s = specs[id];
          return `${id}:${Math.round(s.shown * 60)}:${Math.round(s.trail * 60)}:${s.tone}:${s.low ? 1 : 0}:${s.ready ? 1 : 0}:${s.pips}`;
        })
        .join('|') + `|${auraTop}`;
    const frameDue = this.t - this.lastPaint >= 0.07 || this.lastPaint < 0;
    if (key !== this.key || (moving && frameDue) || (pulsing && frameDue)) {
      this.key = key;
      this.lastPaint = this.t;
      renderVitals(this.canvas.getContext('2d')!, this.layout, this.layout.places, specs);
    }
    this.text(f, specs);
    this.statuses(f);
  }

  private rebuild(ids: GaugeId[]): void {
    this.ids = ids;
    this.layout = vitalsLayout(ids);
    this.canvas.width = this.layout.width;
    this.canvas.height = this.layout.height;
    this.canvas.getContext('2d')!.imageSmoothingEnabled = false;
    this.root.style.setProperty('--vw', String(this.layout.width));
    this.root.style.setProperty('--vh', String(this.layout.height));
    this.labels.replaceChildren();
    this.labelEls.clear();
    this.lastText.clear();
    this.key = '';
    for (const p of this.layout.places) {
      const el = h('span', { class: `v-label v-${p.id}` });
      el.style.setProperty('--row', String(p.h));
      el.style.setProperty('--gap', String(3));
      el.setAttribute('role', 'progressbar');
      el.setAttribute('aria-label', GAUGE_LABEL[p.id]);
      el.setAttribute('aria-valuemin', '0');
      el.innerHTML = `${iconSvg(ICON[p.id], 9)}<b></b>`;
      this.labels.append(el);
      this.labelEls.set(p.id, el);
    }
  }

  private text(f: VitalsFrame, specs: Record<GaugeId, VialSpec>): void {
    const set = (id: GaugeId, text: string, now: number, max: number, title: string) => {
      const el = this.labelEls.get(id);
      if (!el) return;
      el.classList.toggle('low', specs[id].low);
      if (this.lastText.get(id) === text) return;
      this.lastText.set(id, text);
      el.querySelector('b')!.textContent = text;
      el.title = title;
      el.setAttribute('aria-valuenow', String(now));
      el.setAttribute('aria-valuemax', String(max));
      el.setAttribute('aria-valuetext', title);
    };
    set('health', `${f.hp}/${f.maxHp}`, f.hp, f.maxHp, `Health ${f.hp} of ${f.maxHp}`);
    if (f.mana)
      set(
        'mana',
        String(Math.round(f.mana.v)),
        Math.round(f.mana.v),
        f.mana.max,
        `${f.mana.name} ${Math.round(f.mana.v)} of ${f.mana.max}. Casting spends it; striking and spells build it.`,
      );
    set(
      'stamina',
      String(Math.round(f.stamina.value)),
      Math.round(f.stamina.value),
      100,
      `Stamina ${Math.round(f.stamina.value)} of 100. Hold sprint to run; dash charges ${f.stamina.charges} of ${f.stamina.max} (studs on the plinth).`,
    );
    if (f.needs) {
      set(
        'food',
        String(Math.ceil(f.needs.food)),
        Math.ceil(f.needs.food),
        100,
        `Food ${Math.ceil(f.needs.food)} of 100`,
      );
      set(
        'water',
        String(Math.ceil(f.needs.water)),
        Math.ceil(f.needs.water),
        100,
        `Water ${Math.ceil(f.needs.water)} of 100`,
      );
    }
  }

  private statuses(f: VitalsFrame): void {
    const entries = collectStatuses({ buffs: f.buffs, serverNow: f.serverNow, auras: f.auras, needs: f.needs });
    this.entries = entries;
    const key = `${this.expanded}|` + entries.map((e) => `${e.id}:${formatLeft(e.left)}`).join(',');
    if (key === this.statusKey) return;
    this.statusKey = key;
    this.chips.hidden = entries.length === 0;
    if (!entries.length) {
      this.list.hidden = true;
      this.expanded = false;
      this.chips.replaceChildren();
      return;
    }
    const { shown, more } = splitChips(entries, this.expanded);
    const toggle = () => {
      this.expanded = !this.expanded;
      this.statusKey = '';
      this.statuses(f);
    };
    const chipEls: HTMLElement[] = [
      ...shown.map((e) => {
        const b = h('button', {
          class: `st-chip tone-${e.tone}`,
          type: 'button',
          title: `${e.label}. ${e.desc}`,
          on: { click: toggle },
        });
        b.style.setProperty('--ped', `url(${pedestal(e.tone)})`);
        b.setAttribute('aria-expanded', String(this.expanded));
        b.setAttribute('aria-controls', 'status-list');
        b.setAttribute('aria-label', `${e.label}${e.left !== null ? ` ${formatLeft(e.left)}` : ''}`);
        b.innerHTML = `<i>${iconSvg(e.icon, 18)}</i>`;
        if (e.left !== null) b.append(h('span', { text: formatLeft(e.left) }));
        return b;
      }),
    ];
    if (more) {
      const b = h('button', {
        class: 'st-chip st-more',
        type: 'button',
        text: `+${more}`,
        title: 'Show all effects',
        on: { click: toggle },
      });
      b.setAttribute('aria-expanded', 'false');
      b.setAttribute('aria-controls', 'status-list');
      chipEls.push(b);
    }
    this.chips.replaceChildren(...chipEls);
    this.list.hidden = !this.expanded;
    this.list.replaceChildren(
      ...(this.expanded
        ? entries.map((e) =>
            h(
              'li',
              { class: `tone-${e.tone}` },
              h('i', { style: 'display:inline-block' }),
              h('b', { text: e.label }),
              h('span', { text: e.left !== null ? formatLeft(e.left) : '' }),
              h('small', { text: e.desc }),
            ),
          )
        : []),
    );
    if (this.expanded)
      this.list.querySelectorAll('li > i').forEach((el, i) => {
        el.innerHTML = iconSvg(entries[i]!.icon, 9);
      });
  }
}
