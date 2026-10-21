import { describe, expect, it } from 'vitest';
import { GIFT_POINTS, NPC_BY_ID, TALK_POINTS, hearts, mulberry32, tierOf } from '@eigenlands/shared';
import { FakePlayer, makeVillage, nextTo, run } from './village.helpers';

async function setup(hour = 10) {
  const v = await makeVillage();
  v.clock.forced = 'clear';
  v.clock.set(0, hour);
  const p = new FakePlayer();
  return { ...v, p };
}

describe('talking', () => {
  it('requires being close; awards points once per day; resets the next day', async () => {
    const { village, clock, p } = await setup();
    p.x = 500; p.y = 500;
    expect(village.talk(p, 'orla')).toBeNull();
    nextTo(p, village, 'orla');
    const a = village.talk(p, 'orla')!;
    expect(a.pts).toBe(TALK_POINTS);
    expect(a.name).toBe('Orla Brightwater');
    expect(a.text.length).toBeGreaterThan(5);
    expect(p.dirtied.has('friends')).toBe(true);
    expect(village.talk(p, 'orla')!.pts).toBe(TALK_POINTS); // same day: no extra points
    clock.set(1, 10);
    run(village, clock, 1);
    nextTo(p, village, 'orla');
    expect(village.talk(p, 'orla')!.pts).toBe(TALK_POINTS * 2);
    expect(village.talk(p, 'nobody')).toBeNull();
  });

  it('reports shop/gift/chat capabilities and the NPC activity', async () => {
    const { village, p } = await setup(9);
    nextTo(p, village, 'tobin');
    const m = village.talk(p, 'tobin')!;
    expect(m.canShop).toBe(true);
    expect(m.canGift).toBe(true);
    expect(m.canChat).toBe(false);
    expect(m.doing).toBe('minding the counter');
    nextTo(p, village, 'orla');
    expect(village.talk(p, 'orla')!.canShop).toBe(false);
  });

  it('hearts and tiers follow points; high-tier greetings differ from tier 0', async () => {
    expect(hearts(0)).toBe(0);
    expect(hearts(160)).toBe(4);
    expect(tierOf(100)).toBe(0);
    expect(tierOf(120)).toBe(1);
    expect(tierOf(300)).toBe(2);
    const { village, p } = await setup();
    nextTo(p, village, 'tobin');
    p.data.friends.tobin = { pts: 330, talked: -1, gifted: -1 };
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) { p.data.friends.tobin!.talked = -1; seen.add(village.talk(p, 'tobin')!.text); }
    expect(seen.size).toBeGreaterThan(3);
  });

  it('remembers the last gift', async () => {
    const { village, p } = await setup();
    nextTo(p, village, 'tobin');
    p.give('melon', 2);
    village.gift(p, 'tobin', 0);
    let remembered = false;
    for (let i = 0; i < 60 && !remembered; i++) { p.data.friends.tobin!.talked = -1; if (village.talk(p, 'tobin')!.text.startsWith('Thanks again for the melon')) remembered = true; }
    expect(remembered).toBe(true);
  });

  it('teaches recipes only at 4+ hearts, once, through shop learn', async () => {
    const { village, p } = await setup(9);
    nextTo(p, village, 'maribel');
    expect(village.talk(p, 'maribel')!.teaches).toEqual([]);
    village.shop(p, { npcId: 'maribel', action: 'learn', item: 'fruit_pie' });
    expect(p.data.recipes.has('fruit_pie')).toBe(false);
    expect(p.toasts.at(-1)).toMatch(/4 hearts/);
    p.data.friends.maribel!.pts = 170;
    const t = village.talk(p, 'maribel')!;
    expect(t.teaches).toContain('fruit_pie');
    expect(t.teaches).toContain('hearty_stew');
    village.shop(p, { npcId: 'maribel', action: 'learn', item: 'fruit_pie' });
    expect(p.data.recipes.has('fruit_pie')).toBe(true);
    expect(village.talk(p, 'maribel')!.teaches).toEqual(['hearty_stew']);
    // wrong teacher / unknown recipe
    village.shop(p, { npcId: 'maribel', action: 'learn', item: 'barn' });
    expect(p.data.recipes.has('barn')).toBe(false);
    expect(NPC_BY_ID.maribel).toBeTruthy();
  });
});

describe('gifts', () => {
  it('love/like/neutral/hate adjust points, consume one item, once per day', async () => {
    const { village, clock, p } = await setup();
    nextTo(p, village, 'orla');
    p.give('fruit_pie', 3); p.give('daffodil', 1); p.give('wood', 5); p.give('slime_gel', 1);
    const love = village.gift(p, 'orla', 0)!;
    expect(love.gift).toEqual({ taste: 'love', delta: GIFT_POINTS.love });
    expect(love.pts).toBe(40);
    expect(p.data.inv[0]!.n).toBe(2);
    expect(p.dirtied.has('inv')).toBe(true);
    const again = village.gift(p, 'orla', 1)!;
    expect(again.gift!.delta).toBe(0);
    expect(p.data.inv[1]!.n).toBe(1); // untouched: already gifted today
    clock.set(1, 10);
    run(village, clock, 1);
    nextTo(p, village, 'orla');
    expect(village.gift(p, 'orla', 1)!.gift!.taste).toBe('like');
    expect(p.data.inv[1]).toBeNull();
    clock.set(2, 10);
    run(village, clock, 1);
    nextTo(p, village, 'orla');
    expect(village.gift(p, 'orla', 2)!.gift!.taste).toBe('neutral');
    clock.set(3, 10);
    run(village, clock, 1);
    nextTo(p, village, 'orla');
    const hate = village.gift(p, 'orla', 3)!;
    expect(hate.gift!.taste).toBe('hate');
    expect(hate.pts).toBe(Math.max(0, 40 + 20 + 6 - 20));
  });

  it('rejects empty/invalid slots, far players, and never goes below zero points', async () => {
    const { village, p } = await setup();
    nextTo(p, village, 'orla');
    expect(village.gift(p, 'orla', 5)!.gift!.delta).toBe(0);
    expect(p.toasts.at(-1)).toMatch(/Nothing/);
    expect(village.gift(p, 'orla', -3)!.gift!.delta).toBe(0);
    expect(village.gift(p, 'orla', 1.5 as number)!.gift!.delta).toBe(0);
    p.give('slime_gel', 1);
    expect(village.gift(p, 'orla', 0)!.pts).toBe(0);
    p.x = 900;
    expect(village.gift(p, 'orla', 0)).toBeNull();
  });

  it('a loved gift becomes a rumor', async () => {
    const { village, p } = await setup();
    nextTo(p, village, 'orla');
    p.give('fruit_pie', 1);
    village.gift(p, 'orla', 0);
    expect(village.rumorBook().list.at(-1)!.text).toContain('Tester gave Orla Brightwater exactly what they wanted.');
  });
});

void mulberry32;
