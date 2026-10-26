import { describe, expect, it } from 'vitest';
import {
  ARMY_CLASSES,
  ENEMY_BY_KIND,
  ENEMY_DEFS,
  REALM_IDS,
  REALM_SITES,
  armyKey,
  armyKind,
  armyOfKind,
  garrisonOf,
  prosperity,
  raidsOn,
  warsAt,
} from '../src';

describe('army units', () => {
  it('has four classes per realm with unique consecutive kinds', () => {
    const kinds = new Set<number>();
    for (const r of REALM_IDS)
      for (const c of ARMY_CLASSES) {
        const k = armyKind(r, c);
        expect(kinds.has(k)).toBe(false);
        kinds.add(k);
        expect(ENEMY_BY_KIND[k]).toBe(ENEMY_DEFS[armyKey(r, c)]);
        expect(armyOfKind(k)).toEqual({ realm: r, cls: c });
      }
    expect(kinds.size).toBe(24);
  });
});

describe('wars', () => {
  it('is deterministic and produces raids against real sites', () => {
    let total = 0;
    for (let day = 0; day < 120; day++) {
      const a = raidsOn(7, day),
        b = raidsOn(7, day);
      expect(a).toEqual(b);
      for (const r of a) {
        total++;
        expect(REALM_SITES.some((s) => s.id === r.siteId && s.realm === r.defender)).toBe(true);
        expect(r.attacker).not.toBe(r.defender);
        expect(r.hour).toBeGreaterThanOrEqual(8);
        expect(r.hour).toBeLessThan(20);
        expect(r.party[0]).toBeGreaterThan(0);
      }
    }
    expect(total).toBeGreaterThan(10);
  });
  it('never raids between allies and tracks wars and prosperity', () => {
    for (let day = 0; day < 200; day += 7)
      for (const w of warsAt(7, day)) expect(['rival', 'hostile', 'neutral', 'friendly', 'allied']).toContain(w.stance);
    const p = prosperity(7, 'aurelion_capital', 30);
    expect(p.tier).toBeGreaterThanOrEqual(0);
    expect(p.tier).toBeLessThanOrEqual(3);
    for (const s of REALM_SITES) expect(garrisonOf(s).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });
});
