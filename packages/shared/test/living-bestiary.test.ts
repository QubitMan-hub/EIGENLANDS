import { expect, it } from 'vitest';
import { ENEMY_DEFS, ENEMY_BY_KIND, spawnTable, ITEMS, BOSSES, RECIPES, bestiaryKind } from '../src';
const required = [
  'bandit',
  'raider',
  'goblin',
  'troll',
  'undead',
  'orc',
  'spider',
  'corrupted_beast',
  'rogue_mage',
  'dragon',
  'phoenix',
  'siren',
  'unicorn',
  'hydra',
  'manticore',
  'basilisk',
  'thunderbird',
  'primordial_dragon',
  'world_serpent',
  'sealed_entity',
  'forgotten_titan',
  'realm_guardian',
];
it('integrates the missing species with stable indexed kinds, real loot and exclusive ancient progression', () => {
  expect(required.every((id) => !!(ENEMY_DEFS as any)[id])).toBe(true);
  for (const [id, d] of Object.entries(ENEMY_DEFS)) {
    expect(ENEMY_BY_KIND[d.kind], id).toBe(d);
    for (const drop of d.drops ?? []) expect(ITEMS[drop.item], `${id} ${drop.item}`).toBeTruthy();
  }
  for (const id of required.slice(-5)) {
    const b = (BOSSES as any)[id];
    expect(b).toBeTruthy();
    expect(b.phases.length).toBeGreaterThanOrEqual(3);
    expect(ITEMS[b.item]?.special).toBe('summon');
    expect(RECIPES.some((r) => r.out.id === b.item)).toBe(true);
  }
});
it('keeps rare beasts habitat- and level-gated without raising the existing spawn budgets', () => {
  const low = spawnTable(1, false, 'meadow', false, 'limestone', true);
  expect(low.some((e) => required.includes(e.kind))).toBe(false);
  const forest = spawnTable(20, false, 'forest', false, 'limestone', true),
    desert = spawnTable(20, false, 'desert', false, 'limestone', true);
  expect(forest.some((e) => e.kind === 'goblin')).toBe(true);
  expect(desert.some((e) => e.kind === 'manticore')).toBe(true);
  expect(forest.some((e) => e.kind === 'manticore')).toBe(false);
  expect([...forest, ...desert].every((e) => !(ENEMY_DEFS as any)[e.kind].boss)).toBe(true);
  expect(
    [...forest, ...desert].filter((e) => ['dragon', 'manticore', 'phoenix'].includes(e.kind)).every((e) => e.w < 1),
  ).toBe(true);
});

it('allows only selected mythical living bonds and prevents ancient extraction', async () => {
  const { COMPANION_BONDS, canExtract } = await import('../src/index');
  expect(COMPANION_BONDS.filter((b) => (b.level ?? 0) >= 18)).toHaveLength(3);
  for (const id of [
    'primordial_dragon',
    'world_serpent',
    'sealed_entity',
    'forgotten_titan',
    'realm_guardian',
  ] as const) {
    expect(canExtract(bestiaryKind(id))).toBe(false);
    expect(COMPANION_BONDS.some((b) => b.kind === bestiaryKind(id))).toBe(false);
  }
});
