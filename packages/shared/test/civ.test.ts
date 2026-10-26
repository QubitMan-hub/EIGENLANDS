import { describe, expect, it } from 'vitest';
import { REALM_IDS, civPriceFactor, initCiv, resolveIntrigue, stepCiv, validCiv, warRaidSites } from '../src/index';

const SEED = 20260101;
const run = (days: number, deeds?: (w: ReturnType<typeof initCiv>, d: number) => void) => {
  const w = initCiv(SEED, 0);
  for (let d = 1; d <= days; d++) {
    deeds?.(w, d);
    stepCiv(SEED, w, d);
  }
  return w;
};

describe('living kingdoms model', () => {
  it('is deterministic for the same seed and deeds', () => {
    expect(JSON.stringify(run(60))).toBe(JSON.stringify(run(60)));
  });
  it('kingdoms build works, issue decrees, keep chronicles, and wars both start and end', () => {
    const w = run(160);
    for (const r of REALM_IDS) {
      const k = w.kingdoms[r];
      expect(k.built.length, r).toBeGreaterThan(2);
      expect(k.chronicle.length, r).toBeGreaterThan(3);
      for (const v of [k.prosperity, k.might, k.stability]) expect(v).toBeGreaterThanOrEqual(0);
    }
    // watch the wars day by day: some begin, and some end in peace
    let began = 0,
      ended = 0;
    const seen = new Set<string>();
    run(160, (x) => {
      const now = new Set(REALM_IDS.flatMap((r) => x.kingdoms[r].wars.map((v) => `${r}-${v.with}`)));
      for (const k of now) if (!seen.has(k)) began++;
      for (const k of seen) if (!now.has(k)) ended++;
      seen.clear();
      for (const k of now) seen.add(k);
    });
    expect(began).toBeGreaterThan(0);
    expect(ended).toBeGreaterThan(0);
  });
  it('player deeds move a kingdom: trade raises prosperity, lost raids sap might', () => {
    const calm = run(30);
    const busy = run(30, (w) => {
      w.ledger.aurelion.trade += 4000;
      w.ledger.khardum.raidsLost += 1;
    });
    expect(busy.kingdoms.aurelion.prosperity).toBeGreaterThan(calm.kingdoms.aurelion.prosperity);
    expect(busy.kingdoms.khardum.might).toBeLessThan(calm.kingdoms.khardum.might);
  });
  it('kingdoms at war send raids against each other, and war makes goods dearer', () => {
    const w = initCiv(SEED, 0);
    w.kingdoms.aurelion.wars.push({ with: 'khardum', since: 0 });
    w.kingdoms.khardum.wars.push({ with: 'aurelion', since: 0 });
    let raids = 0;
    for (let d = 1; d < 20; d++) raids += warRaidSites(SEED, w, d).length;
    expect(raids).toBeGreaterThan(5);
    expect(civPriceFactor(w.kingdoms.aurelion, true)).toBeGreaterThan(civPriceFactor(w.kingdoms.raijin, true));
  });
  it('an intrigue is decided once, and its effects land on the kingdom', () => {
    const w = initCiv(SEED, 0);
    w.kingdoms.sylvaris.intrigue = {
      id: 'x',
      day: 0,
      expires: 5,
      title: 'Bread and Banners',
      text: '',
      choices: [
        { id: 'a', label: '', outcome: 'calm' },
        { id: 'b', label: '', outcome: 'order' },
      ],
    };
    const s0 = w.kingdoms.sylvaris.stability;
    const e = resolveIntrigue(w, 'sylvaris', 'a', 1)!;
    expect(e.stability).toBeGreaterThan(0);
    expect(w.kingdoms.sylvaris.stability).toBe(Math.min(100, s0 + e.stability));
    expect(resolveIntrigue(w, 'sylvaris', 'b', 1)).toBeNull();
  });
  it('a broken stored world starts afresh', () => {
    expect(validCiv(SEED, { day: 'x' }, 3).day).toBe(3);
    expect(validCiv(SEED, null, 3).kingdoms.aurelion).toBeTruthy();
  });
});
