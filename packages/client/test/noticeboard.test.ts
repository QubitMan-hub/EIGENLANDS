import { describe, expect, it } from 'vitest';
import { DAY_MS, WORLD_EPOCH_MS, bountyOf, realmTowns } from '@eigenlands/shared';
import { boardNotices } from '../src/game/noticeboard';

const SEED = 20260101;
const towns = realmTowns(SEED).filter((t) => !t.abandoned && t.buildings.length > 3);

describe('town notice boards', () => {
  it('pin up the same bounty the town actually posts, plus caravans, festivals and the forecast', () => {
    let wanted = 0;
    for (const t of towns.slice(0, 12))
      for (let day = 3; day < 10; day++) {
        const now = WORLD_EPOCH_MS + day * DAY_MS + DAY_MS / 3;
        const n = boardNotices(SEED, t, 'aurelion', day, now);
        const b = bountyOf(SEED, t, day);
        if (b) {
          wanted++;
          expect(n[0]!.wanted).toBe(true);
          expect(n[0]!.head).toContain(b.name);
          expect(n[0]!.text).toContain(`${b.reward} coins`);
          expect(n[0]!.text).toContain(b.dir);
        } else expect(n[0]!.wanted).toBeFalsy();
        expect(n.some((x) => x.head === 'Tomorrow')).toBe(true);
        expect(n.some((x) => x.head === 'Festivals' || x.head.startsWith('Today:'))).toBe(true);
        // deterministic: everyone reads the same board
        expect(boardNotices(SEED, t, 'aurelion', day, now)).toEqual(n);
      }
    expect(wanted).toBeGreaterThan(10);
  });
});
