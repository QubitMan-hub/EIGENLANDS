import { describe, expect, it } from 'vitest';
import { ITEMS, RECIPES } from '../src';

describe('star shard recipes', () => {
  it('every recipe that takes star shards makes a real item from real items', () => {
    const uses = RECIPES.filter((r) => r.inputs.some((i) => i.id === 'star_shard'));
    expect(uses.map((r) => r.out.id).sort()).toEqual(['stardust_cake', 'starlight_draught', 'starstone']);
    for (const r of uses) {
      expect(ITEMS[r.out.id], r.out.id).toBeTruthy();
      for (const i of r.inputs) expect(ITEMS[i.id], i.id).toBeTruthy();
    }
  });
  it('the starstone recipe asks for enchanting skill', () => {
    const r = RECIPES.find((x) => x.id === 'starstone_from_shards')!;
    expect(r.station).toBe('enchanting');
    expect(r.learn).toBe('level');
    expect(r.lvl).toBe(6);
  });
});
