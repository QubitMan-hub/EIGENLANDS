import { describe, expect, it } from 'vitest';
import { ENEMY_DEFS } from '../src/combat';
import {
  addShadowXp,
  extractChance,
  newShadow,
  rankOf,
  shadowSlots,
  shadowStats,
  shadowXpNeeded,
} from '../src/shadows';

describe('shadows', () => {
  it('ranks follow level thresholds and slots grow with the player', () => {
    expect([1, 5, 6, 13, 14, 24, 38, 50].map(rankOf)).toEqual([0, 0, 1, 1, 2, 3, 4, 4]);
    expect(shadowSlots(4)).toBe(0);
    expect(shadowSlots(5)).toBe(1);
    expect(shadowSlots(16)).toBe(3);
    expect(shadowSlots(99)).toBe(8);
  });
  it('extraction odds favour the stronger hunter and are always in range', () => {
    const slime = ENEMY_DEFS.slime.kind,
      brute = ENEMY_DEFS.brute.kind;
    expect(extractChance(10, 5, { kind: slime })).toBeGreaterThan(extractChance(10, 10, { kind: slime }));
    expect(extractChance(10, 10, { kind: brute })).toBeLessThan(extractChance(10, 10, { kind: slime }));
    expect(extractChance(10, 10, { kind: slime, elite: true })).toBeLessThan(extractChance(10, 10, { kind: slime }));
    for (const pl of [1, 20, 80])
      for (const el of [1, 20, 200]) {
        const c = extractChance(pl, el, { kind: brute, elite: true });
        expect(c).toBeGreaterThanOrEqual(0.1);
        expect(c).toBeLessThanOrEqual(0.92);
      }
  });
  it('shadows level, evolve at rank thresholds, and are capped by the owner', () => {
    const rec = newShadow('a', ENEMY_DEFS.wolf.kind, 5);
    expect(rec.name).toBe('Shade Wolf');
    let evolved = false;
    for (let i = 0; i < 40; i++) {
      const r = addShadowXp(rec, shadowXpNeeded(rec.level), 20);
      evolved ||= r.evolved;
    }
    expect(evolved).toBe(true);
    expect(rec.level).toBeGreaterThan(rankOf(0));
    const capped = newShadow('b', ENEMY_DEFS.wolf.kind, 5);
    addShadowXp(capped, 1e6, 5);
    expect(capped.level).toBe(10); // owner level + 5
    expect(shadowStats(ENEMY_DEFS.wolf.kind, 30).hp).toBeGreaterThan(shadowStats(ENEMY_DEFS.wolf.kind, 1).hp * 3);
  });
});
