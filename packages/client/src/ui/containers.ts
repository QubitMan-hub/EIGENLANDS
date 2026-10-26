import { FARM_ANIMALS, type PanelMsg, type Slot } from '@eigenlands/shared';
import type { Profile } from '../game/profile';
import { clear, h, iconCell, tooltipFor, type Tooltip } from './dom';

export function buildChest(
  initial: PanelMsg,
  profile: Profile,
  tip: Tooltip,
  act: { put(slot: number, n: number): void; take(slot: number, n: number): void },
): { el: HTMLElement; setChest(c: Slot[]): void } {
  let chest: Slot[] = initial.chest ?? [];
  const root = h('div', { class: 'chest' });
  const render = () => {
    clear(root);
    const a = h('div', { class: 'col' }, h('div', { class: 'side-title', text: 'Chest' }));
    const ag = h('div', { class: 'inv-grid' });
    for (let i = 0; i < 30; i++) {
      const st = chest[i] ?? null;
      const slot = h(
        'div',
        {
          class: 'slot',
          on: {
            click: (e) => {
              if (st) act.take(i, e.shiftKey ? 1 : st.n);
            },
          },
        },
        st ? iconCell(st) : null,
      );
      if (st) tip.attach(slot, () => tooltipFor(st));
      ag.append(slot);
    }
    a.append(ag);
    const b = h('div', { class: 'col' }, h('div', { class: 'side-title', text: 'Your pack' }));
    const bg = h('div', { class: 'inv-grid' });
    profile.inv.forEach((st, i) => {
      const slot = h(
        'div',
        {
          class: 'slot',
          on: {
            click: (e) => {
              if (st) act.put(i, e.shiftKey ? 1 : st.n);
            },
          },
        },
        st ? iconCell(st) : null,
      );
      if (st) tip.attach(slot, () => tooltipFor(st));
      bg.append(slot);
    });
    b.append(bg, h('div', { class: 'small dim', text: 'Click to move a whole stack, Shift-click for one.' }));
    root.append(a, b);
  };
  render();
  const unsub = profile.onChange(() => {
    if (!root.isConnected) {
      unsub();
      return;
    }
    render();
  });
  return {
    el: root,
    setChest(c) {
      chest = c;
      render();
    },
  };
}

export function buildShelter(
  p: PanelMsg,
  profile: Profile,
  act: { add(): void; feed(): void; collect(): void },
): HTMLElement {
  const s = p.shelter!;
  const animal = s.animal ?? (s.type === 'coop' ? 'chicken' : 'cow');
  const product = s.product ?? (s.type === 'coop' ? 'eggs' : 'milk');
  const animalId = FARM_ANIMALS[s.type]?.animal ?? animal;
  const root = h('div', { class: 'shelter' });
  root.append(
    h('div', { class: 'side-title', text: s.name ?? (s.type === 'coop' ? 'Chicken coop' : 'Barn') }),
    h('div', { text: `${s.animals} / ${s.max} ${animal}s housed` }),
    h('div', {
      class: s.fed ? 'good' : 'bad',
      text: s.fed ? 'Fed today: they will produce at dawn.' : 'Hungry. Feed them hay to get products tomorrow.',
    }),
    h('div', { text: `${s.ready} ${product} ready to collect` }),
    h(
      'div',
      { class: 'dbtns' },
      h('button', {
        text: `Add a ${animal}`,
        disabled: s.animals >= s.max || profile.count(animalId) < 1,
        on: { click: act.add },
      }),
      h('button', {
        text: `Feed hay (${profile.count('hay')})`,
        disabled: s.fed || s.animals < 1 || profile.count('hay') < 1,
        on: { click: act.feed },
      }),
      h('button', { class: 'primary', text: `Collect ${product}`, disabled: s.ready < 1, on: { click: act.collect } }),
    ),
    h('div', {
      class: 'small dim',
      text: `Buy ${animal}s from the farmer; hay comes from fiber (field crafting) or the store.`,
    }),
  );
  return root;
}

export function buildSign(p: PanelMsg): HTMLElement {
  return h('div', { class: 'sign', text: p.sign ?? '(blank)' });
}
