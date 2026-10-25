import { CHARGE_FULL, CHARGE_MIN } from '@eigenlands/shared';
import type { AttackGuide, weaponComparison } from './equipment-preview';
import { h } from './dom';
const n = (v: number) => String(Number(v.toFixed(2)));
const series = (v: number[], charged = false) => v.map(n).join(charged ? '–' : ' / ');
const output = (a: AttackGuide, charged = false) => {
  const damage =
    a.damage.some((d) => d > 0) || !a.healing.length
      ? `${series(a.damage, charged)} damage${a.count > 1 ? ` per bolt × ${a.count} bolts` : ''}`
      : '';
  const healing = a.healing.length ? `${series(a.healing, charged)} healing` : '';
  return `${a.name}: ${[damage, healing].filter(Boolean).join(' · ')}`;
};
const reach = (a: AttackGuide, charged = false) => `${series(a.reach, charged)} tiles${a.radius ? ' radius' : ''}`;
const cooldown = (a: AttackGuide) => (a.cooldown ? `${n(a.cooldown)}s` : 'None');

/** A quiet field-guide table inside selected pack details, not an estimated combat simulator. */
export function buildWeaponGuide(view: NonNullable<ReturnType<typeof weaponComparison>>): HTMLElement {
  const { before, after } = view;
  const table = h('table', { class: 'weapon-guide-table' }),
    body = h('tbody');
  table.append(
    h('caption', { text: 'Attack comparison' }),
    h(
      'thead',
      {},
      h(
        'tr',
        {},
        h('th', { text: 'Attack' }),
        h('th', { text: `Now · ${before.name}` }),
        h('th', { text: `After · ${after.name}` }),
      ),
    ),
  );
  for (const [label, read] of [
    ['Tap', (w: typeof before) => w.tap.map((a) => output(a)).join(' OR ')],
    ['Heavy · ready–full charge', (w: typeof before) => output(w.heavy, true)],
    ['Tap reach', (w: typeof before) => reach(w.tap[0]!)],
    ['Heavy reach', (w: typeof before) => reach(w.heavy, true)],
    ['Weapon cooldown · tap / heavy', (w: typeof before) => `${cooldown(w.tap[0]!)} / ${cooldown(w.heavy)}`],
  ] as const)
    body.append(h('tr', {}, h('th', { text: label }), h('td', { text: read(before) }), h('td', { text: read(after) })));
  for (const th of body.querySelectorAll('th')) th.scope = 'row';
  table.append(body);
  const timing = h(
    'details',
    {},
    h('summary', { text: 'Attack timing and effects', data: { focus: 'attack-details' } }),
    h('p', {
      text: `After the opening swing recovers, hold Attack for ${CHARGE_MIN}s to ready a heavy or ${CHARGE_FULL}s for full charge. Damage ranges above run from ready to full. Melee tap numbers are the three combo hits; OR means one random form per tap.`,
    }),
  );
  for (const [label, w] of [
    ['Now', before],
    ['After', after],
  ] as const)
    timing.append(
      h('p', {
        text: `${label} · ${w.name}. Base swing recovery: ${series(w.tap[0]!.recovery)}s; heavy ${series(w.heavy.recovery)}s. Both swing recovery and weapon cooldown must finish; haste shortens only the weapon cooldown.`,
      }),
      ...w.tap.flatMap((a) => a.details.map((text) => h('p', { class: 'small', text }))),
      ...w.heavy.details.map((text) => h('p', { class: 'small', text })),
    );
  return h(
    'section',
    { class: 'weapon-guide' },
    h('p', { class: 'small', text: view.note }),
    table,
    h('p', {
      class: 'small dim',
      text: 'Base output with your passive bonuses. Before temporary buffs, critical hits, enemy defences, elemental effects and class interactions. Bolts can miss; volley totals are not guaranteed damage. Sailing uses cannons instead.',
    }),
    timing,
  );
}
