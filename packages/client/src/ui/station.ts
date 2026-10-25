import { ITEMS, STATION_NAMES, matchExperiment, recipesFor, type Recipe, type StationId } from '@eigenlands/shared';
import type { Profile } from '../game/profile';
import { clear, h, iconCell, tooltipFor, type Tooltip } from './dom';

export interface StationActions {
  craft(recipe: string, n: number): void;
  experiment?(items: Array<{ slot: number; n: number }>): void;
}

const have = (profile: Profile, id: string) => profile.count(id);

/** Recipe book + free-form experiment bench for one station. */
export function buildStation(station: StationId, profile: Profile, tip: Tooltip, act: StationActions): HTMLElement {
  const root = h('div', { class: 'station', ...(!act.experiment ? { style: 'grid-template-columns:1fr' } : {}) });
  const list = h('div', { class: 'recipes' });
  const exp = h('div', { class: 'experiment' });
  const offered: Array<{ slot: number; n: number }> = [];

  const need = (r: Recipe, n: number) =>
    r.inputs.map((i) => {
      const wild = i.id.startsWith('*');
      const hv = wild ? 0 : have(profile, i.id);
      const ok = !wild && hv >= i.n * n;
      return h(
        'span',
        { class: `ing ${ok ? 'ok' : 'no'}`, title: wild ? 'Any two different seeds' : '' },
        iconCell({ id: wild ? 'turnip_seed' : i.id, n: 1 }, { showCount: false }),
        h('span', { text: `${wild ? i.n + '× seed' : `${Math.min(hv, 999)}/${i.n * n}`}` }),
      );
    });

  const renderList = () => {
    clear(list);
    const rs = recipesFor(station);
    const known = rs.filter((r) => profile.recipes.has(r.id));
    const unknown = rs.filter((r) => !profile.recipes.has(r.id));
    for (const r of known) {
      const def = ITEMS[r.out.id]!;
      const wild = r.inputs.some((i) => i.id.startsWith('*'));
      const can = !wild && r.inputs.every((i) => have(profile, i.id) >= i.n);
      const outStack = { id: r.out.id, n: r.out.n, ...(r.out.p ? { p: r.out.p as never } : {}) };
      const row = h(
        'div',
        { class: `recipe${can ? ' can' : ''}` },
        h(
          'div',
          { class: 'rout' },
          iconCell(outStack),
          h(
            'div',
            { class: 'rname' },
            h('b', { text: def.name }),
            h('div', {
              class: 'small dim',
              text: wild ? 'Use the experiment bench → any two seeds + crystal' : def.desc,
            }),
          ),
        ),
        h('div', { class: 'rin' }, ...need(r, 1)),
        wild
          ? h('span')
          : h(
              'div',
              { class: 'rbtns' },
              h('button', { text: '×1', disabled: !can, on: { click: () => act.craft(r.id, 1) } }),
              h('button', {
                text: '×5',
                disabled: !r.inputs.every((i) => have(profile, i.id) >= i.n * 5),
                on: { click: () => act.craft(r.id, 5) },
              }),
            ),
      );
      tip.attach(row.querySelector('.cell') as HTMLElement, () => tooltipFor(outStack));
      list.append(row);
    }
    if (unknown.length) {
      list.append(h('div', { class: 'side-title', text: `Undiscovered (${unknown.length})` }));
      for (const r of unknown)
        list.append(
          h(
            'div',
            { class: 'recipe locked' },
            h(
              'div',
              { class: 'rout' },
              h('div', { class: 'cell unk', text: '?' }),
              h(
                'div',
                { class: 'rname' },
                h('b', { text: '???' }),
                h('div', {
                  class: 'small dim',
                  text: r.learn.startsWith('npc:') ? `Taught by a villager (${r.learn.slice(4)})` : `Hint: ${r.hint}`,
                }),
              ),
            ),
          ),
        );
    }
  };

  const renderExp = () => {
    clear(exp);
    exp.append(
      h('div', { class: 'side-title', text: 'Experiment' }),
      h('div', {
        class: 'small dim',
        text: 'Click items in your pack to add them. If they combine into something, you will discover it.',
      }),
    );
    const slots = h('div', { class: 'exp-slots' });
    for (let i = 0; i < 4; i++) {
      const o = offered[i];
      const st = o ? profile.inv[o.slot] : null;
      const s = h(
        'div',
        {
          class: 'slot',
          title: 'click to remove',
          on: {
            click: () => {
              offered.splice(i, 1);
              renderExp();
            },
          },
        },
        st ? iconCell({ id: st.id, n: o!.n, ...(st.p ? { p: st.p } : {}) }) : null,
      );
      slots.append(s);
    }
    exp.append(slots);
    const ids = offered.map((o) => ({ id: profile.inv[o.slot]?.id ?? '', n: o.n }));
    const m = offered.length ? matchExperiment(station, ids) : null;
    exp.append(
      h('button', {
        class: 'primary',
        text: 'Try it',
        disabled: !offered.length,
        on: {
          click: () => {
            act.experiment?.(offered.map((o) => ({ ...o })));
            offered.length = 0;
            renderExp();
          },
        },
      }),
    );
    if (m && profile.recipes.has(m.id))
      exp.append(h('div', { class: 'small good', text: `Known: ${ITEMS[m.out.id]!.name}` }));
    // pack picker
    const pack = h('div', { class: 'pack-pick' });
    profile.inv.forEach((st, i) => {
      if (!st) return;
      const used = offered.find((o) => o.slot === i)?.n ?? 0;
      if (used >= st.n) return;
      const slot = h(
        'div',
        {
          class: 'slot small',
          on: {
            click: () => {
              if (offered.length >= 4 && !offered.find((o) => o.slot === i)) return;
              const o = offered.find((x) => x.slot === i);
              if (o) o.n++;
              else offered.push({ slot: i, n: 1 });
              renderExp();
            },
          },
        },
        iconCell({ ...st, n: st.n - used }, { showCount: true }),
      );
      tip.attach(slot, () => tooltipFor(st));
      pack.append(slot);
    });
    exp.append(h('div', { class: 'side-title', text: 'Your pack' }), pack);
  };

  const rerender = () => {
    renderList();
    if (act.experiment) renderExp();
  };
  rerender();
  root.append(
    h('div', { class: 'col' }, h('div', { class: 'side-title', text: `${STATION_NAMES[station]} recipes` }), list),
  );
  if (act.experiment) root.append(h('div', { class: 'col' }, exp));
  const unsub = profile.onChange(() => {
    if (!root.isConnected) {
      unsub();
      return;
    }
    rerender();
  });
  return root;
}
