import { afterAll, beforeAll, expect, it } from 'vitest';
import { MSG, REALM_SITE_BY_ID, ITEMS } from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot3, spawn3, tp, dev, until, sleep, noon } from './p3helpers';
import { gainRep } from '../src/systems/reputation';

let app: App;
beforeAll(async () => {
  app = await boot3({ newWorldGeneration: 5 });
});
afterAll(async () => {
  await sleep(250);
  await app?.close();
});

it('runs kingdom residents at revision 5 and prices shops by standing', async () => {
  const p = await spawn3(app, 'Envoy');
  expect(p.room.store.generation).toBe(5);
  const cap = REALM_SITE_BY_ID['aurelion_capital']!;
  const queen = p.room.village.npc('aurelion_isolde');
  expect(queen).toBeTruthy();
  const merchant = p.room.village.npc('aurelion_capital_merchant')!;
  // shops keep hours of the world clock, which follows real time: move it to noon so the test never depends on when it runs
  await noon(p);
  expect(merchant).toBeTruthy();
  const views: any[] = [];
  p.r.onMessage(MSG.SHOP_VIEW, (m) => views.push(m));
  // the merchant strolls about her stall: stand beside wherever she is when asking
  const open = async (n: number) => {
    for (let i = 0; i < 6 && views.length < n; i++) {
      await tp(p, merchant.x + 0.8, merchant.y);
      p.r.send(MSG.SHOP, { npcId: 'aurelion_capital_merchant', action: 'open' });
      await sleep(350);
    }
    await until(() => views.length >= n, 4000);
  };
  await open(1);
  const first = views[0].stock[0];
  expect(first).toBeTruthy();
  // champion standing: cheaper goods
  gainRep(p.sp, 'aurelion', 2000, true);
  expect(p.sp.data.rep.aurelion).toBeGreaterThanOrEqual(1500);
  await open(views.length + 1);
  const second = views[views.length - 1].stock.find((s: any) => s.item === first.item);
  expect(second.price).toBeLessThan(first.price);
  expect(ITEMS[first.item]).toBeTruthy();
  expect(cap.cx).toBeGreaterThan(0);
  await p.r.leave();
}, 40_000);

it('spills standing to allies and rivals and clamps it', async () => {
  const p = await spawn3(app, 'Diplomat');
  gainRep(p.sp, 'aurelion', 400, true);
  const others = Object.entries(p.sp.data.rep).filter(([k]) => k !== 'aurelion');
  expect(others.length).toBeGreaterThan(0);
  gainRep(p.sp, 'aurelion', 99999, true);
  expect(p.sp.data.rep.aurelion).toBeLessThanOrEqual(3000);
  void dev;
  await p.r.leave();
});
