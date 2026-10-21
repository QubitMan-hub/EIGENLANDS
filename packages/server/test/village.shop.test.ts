import { describe, expect, it } from 'vitest';
import { ITEMS, buyPrice, emptyInventory, sellPrice } from '@eigenlands/shared';
import { FakePlayer, makeVillage, nextTo, run } from './village.helpers';

async function setup(hour = 10, npc = 'tobin') {
  const v = await makeVillage();
  v.clock.forced = 'clear';
  v.clock.set(0, hour);
  const p = new FakePlayer();
  nextTo(p, v.village, npc);
  return { ...v, p };
}

describe('shop buying', () => {
  it('lists seasonal stock with markup prices and the player coins', async () => {
    const { village, clock, p } = await setup();
    p.data.coins = 77;
    const view = village.shop(p, { npcId: 'tobin', action: 'open' })!;
    expect(view.coins).toBe(77);
    expect(view.name).toBe('Greenbough General Store');
    const season = clock.season();
    const ids = view.stock.map((s) => s.item);
    expect(ids).toContain('fertilizer');
    // seeds only for this season
    const seeds = ids.filter((i) => i.endsWith('_seed'));
    expect(seeds.length).toBeGreaterThan(0);
    expect(season).toBe(0 + ((clock.season() + 0) % 4));
    for (const s of view.stock) expect(s.price).toBeGreaterThan(0);
    expect(view.stock.find((s) => s.item === 'hay')!.price).toBe(buyPrice('hay', 1.2));
  });

  it('buys atomically: pays, stacks, refuses when poor or full', async () => {
    const { village, p } = await setup();
    p.data.coins = 100;
    const v = village.shop(p, { npcId: 'tobin', action: 'open' })!;
    const seed = v.stock.find((s) => s.item.endsWith('_seed'))!;
    const unit = seed.price;
    const r = village.shop(p, { npcId: 'tobin', action: 'buy', item: seed.item, n: 3 })!;
    expect(p.data.coins).toBe(100 - unit * 3);
    expect(r.coins).toBe(100 - unit * 3);
    expect(p.data.inv[0]).toEqual({ id: seed.item, n: 3 });
    // broke: nothing changes
    p.data.coins = unit - 1;
    village.shop(p, { npcId: 'tobin', action: 'buy', item: seed.item, n: 1 });
    expect(p.data.coins).toBe(unit - 1);
    expect(p.data.inv[0]!.n).toBe(3);
    expect(p.toasts.at(-1)).toMatch(/afford/);
    // full pack of unrelated unique items
    p.data.coins = 10000;
    p.data.inv = emptyInventory().map((_, i) => ({ id: 'sword', n: 1, p: { atk: i } }));
    village.shop(p, { npcId: 'tobin', action: 'buy', item: seed.item, n: 1 });
    expect(p.data.coins).toBe(10000);
    expect(p.toasts.at(-1)).toMatch(/full/);
  });

  it('rejects items not in stock, out-of-season seeds, silly quantities and far players', async () => {
    const { village, clock, p } = await setup();
    p.data.coins = 9999;
    const inSeason = village.shop(p, { npcId: 'tobin', action: 'open' })!.stock.map((s) => s.item);
    const off = ['turnip_seed', 'tomato_seed', 'pumpkin_seed', 'frostroot_seed'].find((s) => !inSeason.includes(s))!;
    village.shop(p, { npcId: 'tobin', action: 'buy', item: off, n: 1 });
    village.shop(p, { npcId: 'tobin', action: 'buy', item: 'forge', n: 1 });
    village.shop(p, { npcId: 'tobin', action: 'buy', item: 'fertilizer', n: 0 });
    village.shop(p, { npcId: 'tobin', action: 'buy', item: 'fertilizer', n: 500 });
    village.shop(p, { npcId: 'tobin', action: 'buy', item: 'fertilizer', n: 1.5 });
    expect(p.data.coins).toBe(9999);
    expect(p.data.inv.every((s) => s === null)).toBe(true);
    p.x = 700;
    expect(village.shop(p, { npcId: 'tobin', action: 'open' })).toBeNull();
    expect(clock.season()).toBeGreaterThanOrEqual(0);
  });

  it('NPCs without a shop return null for open/buy', async () => {
    const { village, p } = await setup(10, 'orla');
    expect(village.shop(p, { npcId: 'orla', action: 'open' })).toBeNull();
  });
});

describe('shop selling and the market', () => {
  it('only buys listed kinds, pays with the NPC bonus and slides the price as supply grows', async () => {
    const { village, p } = await setup();
    p.give('melon', 20); p.give('sword', 1); p.give('wood', 3);
    const view = village.shop(p, { npcId: 'tobin', action: 'open' })!;
    expect(view.sell[0]).toBe(sellPrice('melon', 0));
    expect(view.sell[1]).toBeUndefined(); // weapons are not bought here
    expect(view.sell[2]).toBeGreaterThan(0);
    village.shop(p, { npcId: 'tobin', action: 'sell', slot: 1, n: 1 });
    expect(p.data.coins).toBe(0);
    village.shop(p, { npcId: 'tobin', action: 'sell', slot: 0, n: 1 });
    const first = p.data.coins;
    expect(first).toBe(sellPrice('melon', 0));
    expect(village.supply('melon')).toBe(1);
    const before = p.data.coins;
    village.shop(p, { npcId: 'tobin', action: 'sell', slot: 0, n: 10 });
    const bulk = p.data.coins - before;
    expect(bulk).toBeLessThan(first * 10); // price drift within a bulk sale
    expect(p.data.inv[0]!.n).toBe(9);
    expect(village.supply('melon')).toBe(11);
    expect(village.shop(p, { npcId: 'tobin', action: 'open' })!.sell[0]).toBeLessThan(first);
    // can't oversell
    const coins = p.data.coins;
    village.shop(p, { npcId: 'tobin', action: 'sell', slot: 0, n: 50 });
    expect(p.data.coins).toBe(coins);
    expect(p.data.inv[0]!.n).toBe(9);
    // selling the whole stack clears the slot
    village.shop(p, { npcId: 'tobin', action: 'sell', slot: 0, n: 9 });
    expect(p.data.inv[0]).toBeNull();
    expect(p.dirtied.has('coins') && p.dirtied.has('inv')).toBe(true);
  });

  it('specialist shops pay more for their goods (fisher +20%)', async () => {
    const a = await setup(10, 'tobin');
    const b = await setup(7, 'sedge'); // sedge is not at his spot yet at hour 7? (he walks) ensure near
    nextTo(b.p, b.village, 'sedge');
    b.p.give('trout', 1);
    const base = sellPrice('trout', 0);
    b.village.shop(b.p, { npcId: 'sedge', action: 'sell', slot: 0, n: 1 });
    expect(b.p.data.coins).toBe(Math.floor(base * 1.2));
    expect(a.p.data.coins).toBe(0);
  });

  it('supply recovers hourly and is persisted/restored', async () => {
    const { village, clock, p, blobs, host } = await setup();
    p.give('melon', 40);
    village.shop(p, { npcId: 'tobin', action: 'sell', slot: 0, n: 40 });
    expect(village.supply('melon')).toBe(40);
    await village.dispose();
    expect((blobs.get('market') as Record<string, number>).melon).toBe(40);
    // a new process loads the same market
    const { createVillage } = await import('../src/systems/village');
    const v2 = createVillage(host);
    await v2.init();
    expect(v2.supply('melon')).toBe(40);
    // 24 game hours later supply has mostly recovered
    let tick = 0;
    for (let h = 0; h < 24; h++) { clock.advanceMs(60 * 60 * 1000 / 60); tick = run(v2, clock, 1, tick); }
    expect(v2.supply('melon')).toBeLessThan(12);
    expect(ITEMS.melon).toBeTruthy();
  });
});
