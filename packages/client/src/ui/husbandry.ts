import { LIVESTOCK, ITEMS, HERD_CAPACITY, type LivestockSpecies, type PanelMsg } from '@eigenlands/shared';
import type { Profile } from '../game/profile';
import { h } from './dom';
import { livestockPortrait } from '../art/livestock';
import './homestead.css';
export type HerdActions = {
  add(): void;
  feed(): void;
  collect(): void;
  buy(s: LivestockSpecies): void;
  care(): void;
  breed(s: LivestockSpecies): void;
};
export function buildHusbandry(p: PanelMsg, profile: Profile, act: HerdActions): HTMLElement {
  const s = p.shelter!,
    day = s.day ?? 0,
    root = h('div', { class: 'herd-panel' });
  root.append(
    h('h2', { text: s.type === 'coop' ? 'The chicken yard' : 'Your livestock shelter' }),
    h('p', {
      text: `${s.animals} / ${HERD_CAPACITY} stalls · ${s.fed ? 'Fed for the next dawn' : 'Needs hay'} · ${profile.coins} coins`,
    }),
  );
  const grid = h('div', { class: 'herd-grid' });
  for (const a of s.herd ?? []) {
    const def = LIVESTOCK[a.species],
      young = day - a.born < def.growth;
    grid.append(
      h(
        'article',
        { class: 'herd-animal' },
        h('img', { src: livestockPortrait(a.species), alt: def.name }),
        h('strong', { text: def.name }),
        h('div', {
          class: 'small',
          text: young ? `Young · ${def.growth - (day - a.born)} days to adulthood` : 'Adult',
        }),
        h('div', { class: 'small', text: `Happiness ${a.happy}/100` }),
        h('div', {
          class: 'small',
          text: `${ITEMS[def.product]?.name ?? def.product} every ${def.interval} fed day(s)`,
        }),
      ),
    );
  }
  root.append(grid);
  const actions = h(
    'div',
    { class: 'herd-actions' },
    h('button', {
      text: `Feed ${s.animals} hay (${profile.count('hay')} held)`,
      disabled: s.fed || !s.animals || profile.count('hay') < s.animals,
      on: { click: act.feed },
    }),
    h('button', { text: 'Brush & care', disabled: !s.animals || !!s.cared, on: { click: act.care } }),
    h('button', {
      class: 'primary',
      text: `Collect products (${s.ready})`,
      disabled: s.ready < 1,
      on: { click: act.collect },
    }),
  );
  root.append(
    actions,
    h('p', {
      class: 'small',
      text: 'One hay per animal feeds one dawn. Care raises happiness. Two happy, fed adults can breed with 2 extra hay; births need a spare stall and four days between litters. Young animals need time to mature.',
    }),
  );
  if (s.stock && s.ready)
    root.append(
      h('p', {
        class: 'small',
        text: Object.entries(s.stock)
          .filter(([, n]) => n > 0)
          .map(([id, n]) => `${n} ${ITEMS[id]?.name ?? id}`)
          .join(' · '),
      }),
    );
  const adoption = h('details', { class: 'herd-adoption' }, h('summary', { text: 'Adopt or breed livestock' }));
  for (const [species, def] of Object.entries(LIVESTOCK))
    if (def.shelter === s.type) {
      adoption.append(
        h('button', {
          text: `Adopt ${def.name} · ${def.price} coins`,
          disabled: s.animals >= s.max || profile.coins < def.price,
          on: { click: () => act.buy(species as LivestockSpecies) },
        }),
      );
      const pair = (s.herd ?? []).filter(
        (a) => a.species === species && day - a.born >= def.growth && a.happy >= 70 && day - a.bred >= 4,
      );
      if (pair.length >= 2)
        adoption.append(
          h('button', {
            text: `Breed ${def.name} pair`,
            disabled: !s.fed || s.animals >= s.max || profile.count('hay') < 2,
            on: { click: () => act.breed(species as LivestockSpecies) },
          }),
        );
    }
  const base = s.type === 'coop' ? 'chicken' : 'cow';
  if (profile.count(base) > 0)
    adoption.append(
      h('button', { text: `House a ${base} from your pack`, disabled: s.animals >= s.max, on: { click: act.add } }),
    );
  root.append(adoption);
  return root;
}
