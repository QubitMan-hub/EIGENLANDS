import { ITEMS } from '../src/items';
import { expect, it } from 'vitest';
import { CLASSES, PLAYABLE_CLASSES, ABILITIES, CLASS_INDEX, allowedAbilities } from '../src/classes';
const families = ['warrior', 'ranged', 'mage', 'stealth', 'support', 'hybrid'] as const;
const names = [
  'Knight',
  'Guardian',
  'Berserker',
  'Samurai',
  'Paladin',
  'Dragoon',
  'Archer',
  'Ranger',
  'Marksman',
  'Beast Hunter',
  'Elementalist',
  'Sorcerer',
  'Summoner',
  'Druid',
  'Necromancer',
  'Chronomancer',
  'Rogue',
  'Assassin',
  'Ninja',
  'Shadowblade',
  'Cleric',
  'Bard',
  'Alchemist',
  'Spirit Healer',
  'Spellblade',
  'Beastmaster',
  'Artificer',
  'Runic Engineer',
  'Dragon Tamer',
  'Quantum Weaver',
];
it('offers six real families and every requested named path while preserving old class indices', () => {
  expect(CLASS_INDEX.slice(0, 3)).toEqual(['wanderer', 'superposer', 'entangler']);
  expect(PLAYABLE_CLASSES).toEqual(expect.arrayContaining(families));
  const paths = families.flatMap((id) => (CLASSES as any)[id]?.specs ?? []);
  expect(paths.map((p) => p.name).sort()).toEqual([...names].sort());
  expect(new Set(paths.map((p) => p.id)).size).toBe(30);
  for (const family of families) {
    const c = (CLASSES as any)[family];
    expect(c.abilities.length).toBeGreaterThanOrEqual(8);
    expect(c.weakness).toBeTruthy();
    expect(c.gear).toBeTruthy();
    const base = allowedAbilities(family as any, null);
    expect(base).toHaveLength(4);
    for (const path of c.specs) {
      expect(path.gear).toBeTruthy();
      for (const id of path.gear) expect(ITEMS[id]).toBeTruthy();
      expect(path.skill).toBeTruthy();
      expect(base).not.toContain(path.skill);
      const unlocked = (allowedAbilities as any)(family, null, path.id);
      expect(unlocked).toContain(path.skill);
      expect(unlocked).toHaveLength(5);
      const a = (ABILITIES as any)[path.skill];
      expect(a?.forms).toHaveLength(2);
      expect((a.forms[0].hue + 4) % 8).toBe(a.forms[1].hue);
      expect(a.cd).toBeGreaterThan(0);
    }
  }
});
