import { describe, expect, it } from 'vitest';
import {
  HOME_FESTIVALS,
  ITEMS,
  KINGDOMS,
  NPC_BY_ID,
  REALM_IDS,
  feastReward,
  festivalToday,
  neighbourLine,
  nextFestivalOf,
  nextTourney,
  tiesOf,
  tourneyOn,
  tourneyPurse,
} from '../src/index';

describe('festivals and tournaments', () => {
  it('the home continent keeps a festival every season, with a real dish', () => {
    expect(HOME_FESTIVALS.map((f) => f.season)).toEqual([0, 1, 2, 3]);
    for (const f of HOME_FESTIVALS) expect(ITEMS[f.feast]?.kind, f.feast).toBe('food');
    for (const r of REALM_IDS) for (const f of KINGDOMS[r].festivals) expect(ITEMS[f.feast], f.feast).toBeTruthy();
    const days = Array.from({ length: 28 }, (_, d) => festivalToday('home', d)).filter(Boolean);
    expect(days.length).toBe(4);
    const n = nextFestivalOf('home', 0);
    expect(festivalToday('home', n.in)?.id).toBe(n.festival.id);
    expect(feastReward(5, true).coins).toBeGreaterThan(feastReward(5, false).coins);
  });

  it('each capital holds a tournament every few days, and on its festivals', () => {
    for (const r of REALM_IDS) {
      const held = Array.from({ length: 30 }, (_, d) => tourneyOn(r, d)).filter(Boolean).length;
      expect(held).toBeGreaterThanOrEqual(6);
      expect(nextTourney(r, 0)).toBeLessThanOrEqual(5);
      expect(tourneyOn(r, nextTourney(r, 7) + 7)).toBe(true);
      for (let d = 0; d < 28; d++) if (festivalToday(r, d)) expect(tourneyOn(r, d)).toBe(true);
    }
    expect(tourneyPurse(5, true).coins).toBeGreaterThan(tourneyPurse(5, false).coins);
  });
});

describe('neighbours', () => {
  it('every resident with neighbours has mutual ties and talks about where they are', () => {
    let withTies = 0;
    for (const id of Object.keys(NPC_BY_ID)) {
      const ties = tiesOf(id);
      if (ties.length) withTies++;
      for (const t of ties) {
        expect(t.other).not.toBe(id);
        expect(
          tiesOf(t.other).some((u) => u.other === id),
          `${id}->${t.other}`,
        ).toBe(true);
      }
    }
    expect(withTies).toBeGreaterThan(Object.keys(NPC_BY_ID).length * 0.8);
    const line = neighbourLine('orla', 10, 'clear', 0.2);
    expect(line).toMatch(/about now/);
  });
});

describe('evolving ties', () => {
  it('stories unfold over the seasons, both sides always agree, and fresh news is told', async () => {
    const { tiesOn, tieNewsOn, NPC_BY_ID } = await import('../src/index');
    const ids = Object.keys(NPC_BY_ID);
    let changed = 0,
      weddings = 0,
      news = 0;
    for (const id of ids.slice(0, 200)) {
      const early = tiesOn(id, 0);
      const late = tiesOn(id, 200);
      for (const t of late) {
        const back = tiesOn(t.other, 200).find((u) => u.other === id)!;
        expect(back, `${id}<->${t.other}`).toBeTruthy();
        if (t.kind !== 'mentor' && t.kind !== 'apprentice') expect(back.kind).toBe(t.kind);
        expect(back.since).toBe(t.since);
        if (t.kind === 'spouse') weddings++;
      }
      if (late.some((t, i) => t.kind !== early[i]!.kind)) changed++;
      for (let d = 0; d < 120; d++) if (tieNewsOn(id, d)) news++;
    }
    expect(changed).toBeGreaterThan(20);
    expect(weddings).toBeGreaterThan(2);
    expect(news).toBeGreaterThan(20);
    // on day 0 the ties are as they began
    for (const id of ids.slice(0, 50)) for (const t of tiesOn(id, 0)) expect(t.since).toBe(0);
  });
});
