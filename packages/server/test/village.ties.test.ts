import { describe, expect, it } from 'vitest';
import { GIFT_POINTS, giftTaste, NPC_BY_ID, tiesOn } from '@eigenlands/shared';
import { FakePlayer, makeVillage, nextTo } from './village.helpers';

describe('word travels', () => {
  it('a gift a resident loves warms their friends and cools their rival', async () => {
    const v = await makeVillage();
    v.clock.forced = 'clear';
    v.clock.set(0, 10);
    const day = v.clock.day();
    // a resident of the village with both a close tie and a rival, and something they love
    const who = Object.keys(NPC_BY_ID).find(
      (id) =>
        !!v.village.npc(id) &&
        tiesOn(id, day).some((t) => t.kind === 'rival') &&
        tiesOn(id, day).some((t) => ['friend', 'kin', 'sweetheart', 'spouse', 'betrothed'].includes(t.kind)) &&
        (NPC_BY_ID[id]!.loves?.length ?? 0) > 0,
    );
    expect(who).toBeTruthy();
    const p = new FakePlayer();
    nextTo(p, v.village, who!);
    const ties = tiesOn(who!, day);
    const rival = ties.find((t) => t.kind === 'rival')!.other;
    const close = ties.find((t) => t.kind !== 'rival' && t.kind !== 'former')!.other;
    p.data.friends[rival] = { pts: 100, talked: -1, gifted: -1 };
    const love = NPC_BY_ID[who!]!.loves![0]!;
    expect(giftTaste(NPC_BY_ID[who!]!, love)).toBe('love');
    p.give(love, 1);
    const m = v.village.gift(p, who!, 0);
    expect(m?.gift?.taste).toBe('love');
    expect(p.data.friends[close]!.pts).toBe(Math.round(GIFT_POINTS.love / 4));
    expect(p.data.friends[rival]!.pts).toBe(100 - Math.round(GIFT_POINTS.love / 6));
  });
});
