import { describe, expect, it } from 'vitest';
import { ENEMY_DEFS, ITEMS, NPC_BY_ID, QUEST_BY_ID, REALM_IDS, RECIPES, realmQuests } from '../src';

describe('kingdom quests', () => {
  const quests = realmQuests();
  it('has a four-step chain per kingdom', () => expect(quests.length).toBe(REALM_IDS.length * 4));
  it('uses real givers, targets, items and recipes', () => {
    for (const q of quests) {
      expect(QUEST_BY_ID[q.id], q.id).toBeTruthy();
      expect(NPC_BY_ID[q.giver], `${q.id} giver ${q.giver}`).toBeTruthy();
      for (const o of q.objectives) {
        if (o.type === 'talk') expect(NPC_BY_ID[o.target], `${q.id} ${o.target}`).toBeTruthy();
        if (o.type === 'deliver') expect(ITEMS[o.target], `${q.id} ${o.target}`).toBeTruthy();
        if (o.type === 'kill') expect(ENEMY_DEFS[o.target as keyof typeof ENEMY_DEFS], q.id).toBeTruthy();
      }
      for (const req of q.requires ?? []) expect(QUEST_BY_ID[req], `${q.id} requires ${req}`).toBeTruthy();
      if (q.rewards.recipe)
        expect(
          RECIPES.some((r) => r.id === q.rewards.recipe),
          q.id,
        ).toBe(true);
      expect(q.rewards.rep).toBeGreaterThan(0);
    }
  });
});
