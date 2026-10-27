import { expect, it } from 'vitest';
import { GUILD_QUESTS, GUILD_RANKS, guildRank, guildBoard } from '../src/guild';
import { ENEMY_DEFS } from '../src/combat';
import { ITEMS } from '../src/items';
import { townFor, townsFor } from '../src/town';
import { isUpperY } from '../src/floors';
import { ChunkStore } from '../src/chunks';
import type { QuestLog } from '../src/quests';
it('defines a complete, ordered, non-grindable rank path with valid content', () => {
  expect(GUILD_RANKS).toEqual(['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS']);
  expect(new Set(GUILD_QUESTS.map((q) => q.id)).size).toBe(GUILD_QUESTS.length);
  const log: QuestLog = {};
  expect(guildRank(log)).toBeNull();
  for (const rank of GUILD_RANKS) {
    log[`guild:rank:${rank}`] = { state: 'done', progress: [] };
    expect(guildRank(log)).toBe(rank);
  }
  const last = GUILD_QUESTS.find((q) => q.id === 'guild:rank:SSS')!;
  expect(last.objectives.filter((o) => o.target.startsWith('guild:defend:'))).toHaveLength(6);
  for (const q of GUILD_QUESTS) {
    expect(q.objectives.length).toBeLessThanOrEqual(8);
    for (const id of q.requires ?? []) expect(GUILD_QUESTS.some((d) => d.id === id)).toBe(true);
    for (const o of q.objectives) {
      if (o.type === 'kill') expect(ENEMY_DEFS[o.target], o.target).toBeTruthy();
      if (o.type === 'deliver') expect(ITEMS[o.target], o.target).toBeTruthy();
    }
  }
});
it('places reachable boards inside civic buildings without overwriting furnishings or saved walls', () => {
  const seed = 20260101,
    store = new ChunkStore(seed, 80, 6);
  const ts = townsFor(seed, 6).filter((t) => t.buildings.some((b) => b.kind === 'hall' || b.kind === 'inn'));
  expect(ts.length).toBeGreaterThan(30);
  for (const t of [townFor(seed), ...ts]) {
    const b = guildBoard(t);
    if (t.abandoned || isUpperY(t.cy)) {
      expect(b).toBeNull();
      continue;
    }
    expect(b, `${t.name} board`).toBeTruthy();
    if (!b) continue;
    expect(t.objects.some((o) => o.x === b.x && o.y === b.y)).toBe(false);
    expect(
      store
        .townObjectsIn(Math.floor(b.x / 32), Math.floor(b.y / 32))
        .some((o) => o.sub === 'guild_board' && o.x === b.x && o.y === b.y),
    ).toBe(true);
    expect(
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => !store.solidAt(b.x + dx!, b.y + dy!)),
    ).toBe(true);
  }
}, 30000);
