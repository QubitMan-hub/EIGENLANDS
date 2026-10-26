import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MSG, caravanAt, caravanRoutes, sanctuaryAt, type ShopViewMsg } from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot3, clearEnemies, spawn3, tp, until } from './p3helpers';

let app: App;
beforeAll(async () => {
  app = await boot3({ newWorldGeneration: 6 });
});
afterAll(async () => {
  await app?.close();
});

describe('road caravans', () => {
  it('trade at the wagon while it is in reach, and only then', async () => {
    const p = await spawn3(app, 'Merchant');
    const views: ShopViewMsg[] = [];
    p.r.onMessage(MSG.SHOP_VIEW, (m: ShopViewMsg) => views.push(m));
    // stand beside where a caravan out on the open road will be a moment from now (it may be rolling)
    const soon = p.room.wclock.now() + 1500;
    const r = caravanRoutes(p.room.seed).find((route) => {
      const c = caravanAt(p.room.seed, route, soon);
      return !c.hidden && !caravanAt(p.room.seed, route, soon + 2000).hidden;
    })!;
    const at = caravanAt(p.room.seed, r, soon);
    await tp(p, at.x + 1, at.y);
    p.r.send(MSG.SHOP, { npcId: `caravan:${r.id}`, action: 'open' });
    await until(() => views.length > 0, 3000);
    expect(views[0]!.name).toContain(r.name);
    expect(views[0]!.stock.length).toBeGreaterThan(5);
    expect(p.sp.data.prog.caravans).toContain(r.id);
    // buy something on the wagon
    const item = views[0]!.stock[0]!;
    p.sp.data.coins = 5000;
    p.r.send(MSG.SHOP, { npcId: `caravan:${r.id}`, action: 'buy', item: item.item, n: 1 });
    await until(() => p.sp.data.inv.some((s) => s?.id === item.item), 3000);
    // far from the road: refused
    await tp(p, at.x + 60, at.y + 60);
    p.r.send(MSG.SHOP, { npcId: `caravan:${r.id}`, action: 'open' });
    await until(() => p.toasts.some((t) => /moved on/.test(t.text)), 3000);
    await p.r.leave();
  });

  it('beating off an ambush pays everyone defending the wagon', async () => {
    const p = await spawn3(app, 'Guard');
    clearEnemies(p.room);
    // a moment when some caravan rolls along open (unwarded) road where wolves can stand
    let ok = false;
    search: for (let dt = 0; dt < 1_800_000 && !ok; dt += 5000)
      for (const r of caravanRoutes(p.room.seed)) {
        const c = caravanAt(p.room.seed, r, p.room.wclock.now() + dt);
        if (!c.moving || c.hidden || sanctuaryAt(p.room.seed, c.x, c.y)) continue;
        await tp(p, c.x + 1, c.y + 1);
        if (p.room.caravans.ambush(r, c.x, c.y, c.fx, c.fy, 5)) {
          ok = true;
          break search;
        }
      }
    expect(ok).toBe(true);
    await until(() => p.toasts.some((t) => /Wolves fall/.test(t.text)), 2000);
    const coins = p.sp.data.coins;
    p.r.send(MSG.DEV, { cmd: 'kill', d: 40 });
    await until(() => p.sp.data.coins > coins, 4000);
    expect(p.toasts.some((t) => /owes you/.test(t.text))).toBe(true);
    await p.r.leave();
  });
});
