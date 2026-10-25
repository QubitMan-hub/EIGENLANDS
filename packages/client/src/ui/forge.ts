import {
  ITEMS,
  MATERIALS,
  TEMPLATES,
  TIER_NAMES,
  preview,
  type Stack,
  type Stat,
  type Template,
} from '@eigenlands/shared';
import type { Profile } from '../game/profile';
import { PHASE_COLOR, PHASE_NAME, clear, h, iconCell, phaseDot, tooltipFor, type Tooltip } from './dom';

const STAT_NAMES: Record<Stat, string> = {
  atk: 'Attack',
  dur: 'Durability',
  eff: 'Efficiency',
  spd: 'Speed',
  mag: 'Magic',
};
const TEMPLATE_NAMES: Record<Template, string> = { sword: 'Sword', axe: 'Axe', pickaxe: 'Pickaxe', hoe: 'Hoe' };

/** An SVG phase wheel: 8 colour wedges, a marker per material and a ring where the alloy lands. */
export function phaseWheel(phases: number[], result: number | null, size = 150): SVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '-60 -60 120 120');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  const pt = (ang: number, r: number) => [Math.cos(ang) * r, Math.sin(ang) * r] as const;
  for (let i = 0; i < 8; i++) {
    const a0 = ((i - 0.5) * Math.PI) / 4 - Math.PI / 2,
      a1 = ((i + 0.5) * Math.PI) / 4 - Math.PI / 2;
    const [x0, y0] = pt(a0, 54),
      [x1, y1] = pt(a1, 54),
      [x2, y2] = pt(a1, 38),
      [x3, y3] = pt(a0, 38);
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', `M${x0},${y0} A54,54 0 0 1 ${x1},${y1} L${x2},${y2} A38,38 0 0 0 ${x3},${y3} Z`);
    p.setAttribute('fill', PHASE_COLOR[i]!);
    p.setAttribute('stroke', '#0b0c1a');
    p.setAttribute('stroke-width', '1.5');
    svg.append(p);
  }
  const dot = (ph: number, r: number, rad: number, fill: string, stroke: string) => {
    const [x, y] = pt((ph * Math.PI) / 4 - Math.PI / 2, rad);
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', String(x));
    c.setAttribute('cy', String(y));
    c.setAttribute('r', String(r));
    c.setAttribute('fill', fill);
    c.setAttribute('stroke', stroke);
    c.setAttribute('stroke-width', '2');
    svg.append(c);
  };
  phases.forEach((ph, i) => dot(ph, 6, 46 - i * 0, '#f4f4ff', '#0b0c1a'));
  if (result !== null && phases.length) {
    const [rx, ry] = pt((result * Math.PI) / 4 - Math.PI / 2, 24);
    for (const ph of phases) {
      const [x, y] = pt((ph * Math.PI) / 4 - Math.PI / 2, 38);
      const l = document.createElementNS(ns, 'line');
      l.setAttribute('x1', String(x));
      l.setAttribute('y1', String(y));
      l.setAttribute('x2', String(rx));
      l.setAttribute('y2', String(ry));
      l.setAttribute('stroke', '#f4f4ff');
      l.setAttribute('stroke-width', '1');
      l.setAttribute('stroke-dasharray', '3 3');
      svg.append(l);
    }
    dot(result, 8, 24, PHASE_COLOR[Math.round(result) % 8]!, '#f4f4ff');
  }
  return svg;
}

export function buildForge(
  profile: Profile,
  tip: Tooltip,
  act: { start(template: Template, slots: number[]): void },
): HTMLElement {
  const root = h('div', { class: 'forge' });
  let template: Template = 'sword';
  const picked: number[] = []; // pack slot indices (repeats allowed up to the stack size)

  const render = () => {
    clear(root);
    const ids = picked.map((i) => profile.inv[i]?.id ?? '');
    const pv = ids.length >= 2 ? preview(ids, 0.5) : null;

    const tpl = h(
      'div',
      { class: 'tpl' },
      ...TEMPLATES.map((t) =>
        h('button', {
          class: t === template ? 'primary' : '',
          text: TEMPLATE_NAMES[t],
          on: {
            click: () => {
              template = t;
              render();
            },
          },
        }),
      ),
    );

    const chosen = h('div', { class: 'chosen' });
    for (let i = 0; i < 3; i++) {
      const slot = picked[i];
      const st = slot !== undefined ? profile.inv[slot] : null;
      const el = h(
        'div',
        {
          class: 'slot big',
          title: st ? 'click to remove' : 'pick materials below',
          on: {
            click: () => {
              if (st) {
                picked.splice(i, 1);
                render();
              }
            },
          },
        },
        st
          ? iconCell({ id: st.id, n: 1 }, { showCount: false })
          : h('span', { class: 'eqlabel', text: i < 2 ? 'metal' : '+ opt.' }),
      );
      if (st) el.append(phaseDot(MATERIALS[st.id]!.phase));
      chosen.append(el);
    }

    const pack = h('div', { class: 'pack-pick' });
    profile.inv.forEach((st, i) => {
      if (!st || !MATERIALS[st.id]) return;
      const used = picked.filter((p) => p === i).length;
      if (used >= st.n) return;
      const slot = h(
        'div',
        {
          class: 'slot small',
          on: {
            click: () => {
              if (picked.length < 3) {
                picked.push(i);
                render();
              }
            },
          },
        },
        iconCell({ ...st, n: st.n - used }),
      );
      slot.append(phaseDot(MATERIALS[st.id]!.phase));
      tip.attach(slot, () => tooltipFor(st));
      pack.append(slot);
    });

    const left = h(
      'div',
      { class: 'col' },
      h('div', { class: 'side-title', text: '1 · Pick what to forge' }),
      tpl,
      h('div', { class: 'side-title', text: '2 · Choose 2–3 materials' }),
      chosen,
      pack.childElementCount
        ? pack
        : h('div', {
            class: 'small dim',
            text: 'No forgeable materials. Smelt ingots at a furnace; qubit crystals, slime gel, hopper teeth and heartwood work too.',
          }),
      h('div', {
        class: 'small dim',
        text: 'Metals have a phase (colour). Matching phases reinforce each other (bonus stats). Opposite phases cancel each other’s flaws. Then hit the beats at the anvil to tune the result.',
      }),
    );

    const right = h('div', { class: 'col' }, h('div', { class: 'side-title', text: 'Interference preview' }));
    right.append(
      h(
        'div',
        { class: 'wheel' },
        phaseWheel(
          ids.map((id) => MATERIALS[id]?.phase ?? 0),
          pv ? pv.phase : null,
        ),
      ),
    );
    if (pv) {
      const c = pv.coherence;
      right.append(
        h(
          'div',
          { class: 'coh' },
          h('span', { class: 'small', text: 'cancels flaws' }),
          h('div', { class: 'cohbar' }, h('i', { style: `left:${50 + c * 50}%` })),
          h('span', { class: 'small', text: 'reinforces' }),
        ),
      );
      right.append(h('div', { class: 'small', text: pv.note }));
      const stats = h('div', { class: 'fstats' });
      (Object.keys(pv.stats) as Stat[]).forEach((k) => {
        const v = pv.stats[k];
        stats.append(
          h(
            'div',
            { class: 'frow' },
            h('span', { text: STAT_NAMES[k] }),
            h(
              'div',
              { class: 'fbar' },
              h('i', { class: v < 0 ? 'neg' : '', style: `width:${Math.min(100, Math.abs(v) * 4)}%` }),
            ),
            h('b', { class: v < 0 ? 'bad' : v > 0 ? 'good' : '', text: String(v) }),
          ),
        );
      });
      right.append(stats);
      right.append(
        h(
          'div',
          { class: 'ftier' },
          template === 'sword'
            ? `Sword · Attack ${Math.max(0, pv.stats.atk) + 3}`
            : `${TEMPLATE_NAMES[template]} · Tier ${pv.tier} (${TIER_NAMES[pv.tier - 1]})`,
          ' · phase ',
          phaseDot(pv.phase),
          ` ${PHASE_NAME[Math.round(pv.phase) % 8]}`,
        ),
      );
      right.append(
        h('div', { class: 'small dim', text: 'Hit the beats for a better result. Perfect timing: +35% stats.' }),
      );
    } else
      right.append(h('div', { class: 'small dim', text: 'Pick two materials to see how their phases interfere.' }));
    right.append(
      h('button', {
        class: 'primary big',
        text: '🔨 Strike the anvil',
        disabled: !pv,
        on: { click: () => act.start(template, [...picked]) },
      }),
    );

    root.append(left, right);
  };
  render();
  const unsub = profile.onChange(() => {
    if (!root.isConnected) {
      unsub();
      return;
    }
    // drop selections that no longer exist
    for (let i = picked.length - 1; i >= 0; i--) {
      const slot = picked[i]!;
      const st = profile.inv[slot];
      if (!st || !MATERIALS[st.id] || picked.filter((p) => p === slot).length > st.n) picked.splice(i, 1);
    }
    render();
  });
  return root;
}

export function describeForged(item: Stack): string {
  const d = ITEMS[item.id]?.name ?? item.id;
  return `${item.p?.qname ?? ''} ${d}`.trim();
}
