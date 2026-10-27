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

describe('local economies', () => {
  it('settlements make some goods cheap, want others and run short of one kind a day', async () => {
    const { REALM_SITES, localEconomy, localPriceFactor } = await import('../src/index');
    const farm = REALM_SITES.find((s) => s.kind === 'farm')!;
    const outpost = REALM_SITES.find((s) => s.kind === 'outpost')!;
    const ef = localEconomy(1234, farm.id, 5)!;
    const eo = localEconomy(1234, outpost.id, 5)!;
    expect(localPriceFactor(ef, 'crop')).toBeLessThan(1);
    expect(localPriceFactor(eo, 'resource')).toBeLessThan(1);
    expect(localPriceFactor(eo, 'food')).toBeGreaterThan(1);
    expect(ef.produces).not.toContain(ef.shortage);
    expect(ef.note).toMatch(/Short today/);
    expect(localEconomy(1234, farm.id, 5)).toEqual(ef);
    const shortages = new Set(Array.from({ length: 20 }, (_, d) => localEconomy(1234, farm.id, d)!.shortage));
    expect(shortages.size).toBeGreaterThan(2);
    expect(localEconomy(1234, 'nowhere', 5)).toBeNull();
    expect(localPriceFactor(null, 'food')).toBe(1);
  });
});

describe('royal events', () => {
  it('over a long reign the crowns see births, jubilees, hunts and weddings, and celebrations steady the realm', async () => {
    const { initCiv, stepCiv, royalCelebration, civPriceFactor, REALM_IDS } = await import('../src/index');
    const w = initCiv(77, 0);
    const kinds = new Set<string>();
    let celebrating = 0;
    for (let d = 1; d <= 600; d++) {
      stepCiv(77, w, d);
      for (const r of REALM_IDS) {
        const k = w.kingdoms[r];
        if (k.royal && k.royal.day === d) kinds.add(k.royal.kind);
        if (royalCelebration(k, d)) celebrating++;
        if (k.royal?.kind === 'plague')
          expect(civPriceFactor(k, true)).toBeGreaterThan(civPriceFactor({ ...k, royal: null }, true));
      }
    }
    expect(kinds.size).toBeGreaterThanOrEqual(3);
    expect(celebrating).toBeGreaterThan(5);
    // a reloaded world keeps its royal state, and nonsense is cleaned up
    const { validCiv } = await import('../src/index');
    const raw = JSON.parse(JSON.stringify(w));
    raw.kingdoms.aurelion.royal = { kind: 'birth' };
    raw.kingdoms.sylvaris.monarch = 7;
    const v = validCiv(77, raw, 600);
    expect(v.kingdoms.aurelion.royal).toBeNull();
    expect(v.kingdoms.sylvaris.monarch).toBeUndefined();
  });
});
