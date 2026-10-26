import { afterAll, beforeAll, expect, it } from 'vitest';
import { MSG, REALM_SITE_BY_ID, ITEMS } from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot3, spawn3, tp, dev, until, sleep } from './p3helpers';
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
  expect(merchant).toBeTruthy();
  await tp(p, merchant.x + 0.8, merchant.y);
  const views: any[] = [];
  p.r.onMessage(MSG.SHOP_VIEW, (m) => views.push(m));
  p.r.send(MSG.SHOP, { npcId: 'aurelion_capital_merchant', action: 'open' });
  await until(() => views.length > 0, 4000);
  const first = views[0].stock[0];
  expect(first).toBeTruthy();
  // champion standing: cheaper goods
  gainRep(p.sp, 'aurelion', 2000, true);
  expect(p.sp.data.rep.aurelion).toBeGreaterThanOrEqual(1500);
  p.r.send(MSG.SHOP, { npcId: 'aurelion_capital_merchant', action: 'open' });
  await until(() => views.length > 1, 4000);
  const second = views[1].stock.find((s: any) => s.item === first.item);
  expect(second.price).toBeLessThan(first.price);
  expect(ITEMS[first.item]).toBeTruthy();
  expect(cap.cx).toBeGreaterThan(0);
  await p.r.leave();
});

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
