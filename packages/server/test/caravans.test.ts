import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  DAY_MS,
  MSG,
  WORLD_EPOCH_MS,
  caravanAt,
  caravanById,
  caravanRoutes,
  dayNumber,
  sanctuaryAt,
  type ShopViewMsg,
} from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot3, clearEnemies, sleep, spawn3, tp, until } from './p3helpers';

let app: App;
afterEach(() => vi.restoreAllMocks());
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
    // Pin the fixture clock: chunk preparation must not move the wagon away during the network round trip.
    vi.spyOn(p.room.wclock, 'now').mockReturnValue(soon);
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

  it('an escort rides with the wagon to its next stop and is paid; one who wanders off loses the job', async () => {
    const p = await spawn3(app, 'Escort');
    clearEnemies(p.room);
    const views: ShopViewMsg[] = [];
    p.r.onMessage(MSG.SHOP_VIEW, (m: ShopViewMsg) => views.push(m));
    const soon = p.room.wclock.now() + 1500;
    const r = caravanRoutes(p.room.seed).find((route) => !caravanAt(p.room.seed, route, soon).hidden)!;
    let c = caravanAt(p.room.seed, r, soon);
    await tp(p, c.x + 1, c.y);
    p.r.send(MSG.SHOP, { npcId: `caravan:${r.id}`, action: 'open' });
    await until(() => views.some((v) => v.job?.offer), 3000);
    const pay = views.find((v) => v.job?.offer)!.job!.pay;
    p.r.send(MSG.SHOP, { npcId: `caravan:${r.id}`, action: 'job' });
    await until(() => !!p.room.caravans.escorting(p.sp), 3000);
    const coins = p.sp.data.coins;
    // ride along: wind the world clock forward and keep beside the wagon (and beat off any wolves)
    for (let i = 0; i < 80 && p.room.caravans.escorting(p.sp); i++) {
      p.room.wclock.offset += 15000;
      c = caravanAt(p.room.seed, r, p.room.wclock.now());
      if (!c.hidden) await tp(p, c.x + 1, c.y);
      p.r.send(MSG.DEV, { cmd: 'kill', d: 30 });
      await sleep(1100);
    }
    expect(p.room.caravans.escorting(p.sp)).toBeNull();
    // the fare is fixed at sign-on (the road left by then); a wolf bounty may come on top
    expect(p.sp.data.coins).toBeGreaterThanOrEqual(coins + Math.floor(pay * 0.8));
    expect(p.toasts.some((t) => /pays you/.test(t.text))).toBe(true);
    // a second job, abandoned
    c = caravanAt(p.room.seed, r, p.room.wclock.now() + 1500);
    if (!c.hidden) {
      await tp(p, c.x + 1, c.y);
      p.r.send(MSG.SHOP, { npcId: `caravan:${r.id}`, action: 'job' });
      await until(() => !!p.room.caravans.escorting(p.sp), 3000);
      await tp(p, c.x + 200, c.y + 200);
      (p.room.caravans as unknown as { escorts: Map<string, { away: number }> }).escorts.get(p.sp.id)!.away = 40;
      await until(() => p.toasts.some((t) => /find another guard/.test(t.text)), 3000);
    }
    await p.r.leave();
  }, 120_000);

  it('the wandering peddler keeps market hours in a home town and sells rare wares', async () => {
    const p = await spawn3(app, 'Browser');
    const views: ShopViewMsg[] = [];
    p.r.onMessage(MSG.SHOP_VIEW, (m: ShopViewMsg) => views.push(m));
    // wind the clock to the middle of the next market day (the game day starts at 06:00)
    const now = p.room.wclock.now();
    const noon = WORLD_EPOCH_MS + (dayNumber(now) + 1) * DAY_MS + DAY_MS / 4;
    p.room.wclock.offset += noon - now;
    const r = caravanById(p.room.seed, 'peddler')!;
    const c = caravanAt(p.room.seed, r, p.room.wclock.now());
    expect(c.hidden).toBe(false);
    await tp(p, c.x + 1, c.y);
    const rep = JSON.stringify(p.sp.data.rep ?? {});
    p.r.send(MSG.SHOP, { npcId: 'caravan:peddler', action: 'open' });
    await until(() => views.length > 0, 3000);
    expect(views[0]!.name).toContain('Peddler');
    expect(views[0]!.stock.some((s) => s.item === 'recall_shard')).toBe(true);
    expect(views[0]!.job).toBeUndefined(); // the peddler hires no escort
    expect(JSON.stringify(p.sp.data.rep ?? {})).toBe(rep); // and belongs to no kingdom
    await p.r.leave();
  });
});
