import {
  ENEMY_DEFS,
  BOSS_BY_KIND,
  CREATURE_BLUEPRINTS,
  BIOME_NAMES,
  ITEMS,
  companionBond,
  spawnTable,
  type BestiaryKey,
  type Biome,
  type EnemyDef,
} from '@eigenlands/shared';
import { bestiaryPortrait } from '../art/bestiary-atlases';
import type { Profile } from '../game/profile';
import { h } from './dom';
import './bestiary.css';
export interface BestiaryPageState {
  query: string;
  category: string;
  limit: number;
  open: Set<string>;
}
const traits: Record<string, string> = {
  regrow: 'Regrows 2% health per second after a respite. Ember hits block regrowth for eight seconds.',
  rebirth: 'Rekindles once at 45% health. Finish the second life before claiming its reward.',
  web: 'Web hits drain 20 stamina and interrupt sprinting. Keep a dodge in reserve.',
  gaze: 'Its projected gaze only catches you while you face it. Turn away during the marked cast.',
  song: 'Song hits pull you toward the singer. Keep open water behind your boat.',
  venom: 'A poisonous ranged hunter. Distance, cover and antidotes matter in Adventure mode.',
  storm: 'Storm hits drain 30 stamina. Space your dodges instead of exhausting every charge.',
  breath: 'A broad, deliberate cone of projectiles. Move sideways during its long windup.',
  siphon: 'Landed attacks restore part of its health. Avoid trading blows.',
  blink: 'Phases backward after being hit, with an eight-second recovery between escapes.',
  many_heads: 'Multiple heads spread shots across a fan. Read the gaps rather than backing straight away.',
};
function category(id: string, d: EnemyDef): string {
  const extra = CREATURE_BLUEPRINTS[id as BestiaryKey];
  return (
    extra?.category ??
    (d.boss
      ? 'ancient'
      : id.match(/_(infantry|ranged|cavalry|elite)$/)
        ? 'forces'
        : d.passive || d.neutral
          ? 'passive'
          : d.mythical || (d.kind >= 44 && d.kind <= 49)
            ? 'mythical'
            : 'hostile')
  );
}
function habitat(id: string): string {
  const extra = CREATURE_BLUEPRINTS[id as BestiaryKey];
  if (extra) return extra.habitat.map((b) => (b === 'sea' ? 'Open water' : BIOME_NAMES[b])).join(', ');
  const biomes = (Object.keys(BIOME_NAMES) as Biome[]).filter((b) =>
    spawnTable(40, true, b).some((e) => e.kind === id),
  );
  return biomes.length
    ? biomes.map((b) => BIOME_NAMES[b]).join(', ')
    : 'Kingdom, ocean or surveyed underground encounter';
}
export function buildBestiary(profile: Profile, state: BestiaryPageState): HTMLElement {
  const root = h('section', { class: 'bestiary-book' }),
    controls = h('div', { class: 'bestiary-controls' }),
    list = h('div', { class: 'bestiary-list' });
  root.append(
    h('h3', { text: 'Field bestiary' }),
    h('p', {
      text: `${profile.bestiary.size} species recorded. Approach with a clear line of sight to add a sighting. Base notes below do not include local level, night or elite scaling.`,
    }),
  );
  const search = h('input', {
    type: 'search',
    placeholder: 'Search names or habitats',
    data: { focus: 'bestiary-search' },
  });
  search.value = state.query;
  search.setAttribute('aria-label', 'Search bestiary');
  const filter = h('select');
  filter.setAttribute('aria-label', 'Bestiary category');
  filter.dataset.focus = 'bestiary-category';
  for (const [id, name] of [
    ['all', 'All recorded species'],
    ['passive', 'Wildlife'],
    ['hostile', 'Hostiles'],
    ['mythical', 'Mythical'],
    ['ancient', 'Ancients & bosses'],
    ['forces', 'Kingdom forces'],
  ])
    filter.append(h('option', { value: id, text: name }));
  filter.value = state.category;
  controls.append(
    h('label', {}, h('span', { text: 'Find a species' }), search),
    h('label', {}, h('span', { text: 'Category' }), filter),
  );
  const render = () => {
    list.replaceChildren();
    const query = state.query.trim().toLowerCase();
    const entries = [...profile.bestiary]
      .filter((id) => Object.hasOwn(ENEMY_DEFS, id))
      .map((id) => ({ id, d: ENEMY_DEFS[id as keyof typeof ENEMY_DEFS] }))
      .filter(
        ({ id, d }) =>
          (state.category === 'all' || category(id, d) === state.category) &&
          `${d.name} ${id} ${habitat(id)}`.toLowerCase().includes(query),
      )
      .sort((a, b) => a.d.name.localeCompare(b.d.name));
    if (!entries.length)
      list.append(h('p', { text: 'No recorded species match. Explore quietly and watch the local wildlife.' }));
    for (const { id, d } of entries.slice(0, state.limit)) {
      const card = h('details', { class: 'bestiary-entry' });
      card.open = state.open.has(id);
      card.ontoggle = () => {
        if (card.open) state.open.add(id);
        else state.open.delete(id);
      };
      const summary = h('summary'),
        image = bestiaryPortrait(id);
      if (image) {
        const img = h('img', { src: image });
        img.alt = '';
        img.width = img.height = 64;
        summary.append(img);
      }
      summary.append(
        h('span', {}, h('strong', { text: d.name }), h('small', { text: `${category(id, d)} · ${habitat(id)}` })),
      );
      card.append(summary);
      const notes = h('div', { class: 'bestiary-notes' });
      notes.append(
        h('p', {
          text: `Base health ${d.hp} · attack ${d.damage} · ${d.armor ? 'armoured' : 'unarmoured'}. ${d.passive ? 'Flees danger.' : d.neutral ? 'Neutral until provoked.' : 'Hostile outside protected settlements.'}`,
        }),
      );
      if (d.trait) notes.append(h('p', { text: traits[d.trait] ?? '' }));
      if (d.territory)
        notes.append(
          h('p', {
            text: `Defends a ${d.territory}-tile territory and returns home instead of pursuing indefinitely. Rare territorial rivals are spaced apart.`,
          }),
        );
      if (d.predator)
        notes.append(
          h('p', { text: 'Hunts nearby wildlife; prey flees and a consumed kill produces no player loot.' }),
        );
      const bond = companionBond(d.kind);
      if (bond)
        notes.append(
          h('p', {
            text: `Living bond · offer ${bond.count} ${ITEMS[bond.food]?.name ?? bond.food} to healthy, unprovoked wildlife. ${bond.trait}: ${bond.detail}${bond.level ? ` Requires level ${bond.level}` : ''}${bond.boss ? ` and victory over ${bond.boss.replace(/_/g, ' ')}` : ''}.`,
          }),
        );
      const boss = BOSS_BY_KIND[d.kind];
      if (boss)
        notes.append(
          h('p', { text: `Level ${boss.level} rite · ${ITEMS[boss.item]?.name ?? boss.item}. ${boss.loot}` }),
        );
      const loot = (d.drops ?? []).map((drop) => ITEMS[drop.item]?.name ?? drop.item);
      if (loot.length) notes.append(h('p', { text: `Possible drops · ${[...new Set(loot)].join(', ')}` }));
      card.append(notes);
      list.append(card);
    }
    if (entries.length > state.limit)
      list.append(
        h('button', {
          text: `Show more (${entries.length - state.limit} remaining)`,
          on: {
            click: () => {
              state.limit += 24;
              render();
            },
          },
        }),
      );
  };
  search.oninput = () => {
    state.query = search.value;
    state.limit = 24;
    render();
  };
  filter.onchange = () => {
    state.category = filter.value;
    state.limit = 24;
    render();
  };
  root.append(controls, list);
  render();
  return root;
}
