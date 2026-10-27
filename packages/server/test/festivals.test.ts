import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DAY_MS,
  MSG_FEST,
  WORLD_EPOCH_MS,
  dayNumber,
  festivalToday,
  homeTowns,
  tourneyOn,
  type FestHost,
  type TourneyState,
} from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot3, dev, setLevel, spawn3, tp, until, type P3 } from './p3helpers';

let app: App;
beforeAll(async () => {
  app = await boot3({ newWorldGeneration: 6 });
});
afterAll(async () => {
  await app?.close();
});

/** wind the world clock to `hour` on the first day from tomorrow that passes `ok` */
function windTo(p: P3, ok: (day: number) => boolean, hour: number): number {
  const now = p.room.wclock.now();
  let day = dayNumber(now) + 1;
  while (!ok(day)) day++;
  p.room.wclock.offset += WORLD_EPOCH_MS + day * DAY_MS + ((hour - 6) / 24) * DAY_MS - now;
  expect(p.room.wclock.day()).toBe(day);
  return day;
}

describe('festivals and tournaments', () => {
  it('a dish shared at a festival feast pays once; the festival dish is honoured best', async () => {
    const p = await spawn3(app, 'Reveller');
    const home = homeTowns(p.room.seed)[0]!;
    await tp(p, home.cx + 0.5, home.cy + 0.5);
    // no festival: refused
    windTo(p, (d) => !festivalToday('home', d), 14);
    dev(p, { cmd: 'give', id: 'fruit_pie', n: 1 });
    await until(() => p.sp.data.inv.some((s) => s?.id === 'fruit_pie'));
    expect(p.room.festivals.feast(p.sp, 'home')).toBe(false);
    const day = windTo(p, (d) => festivalToday('home', d)?.id === 'blossom_fair', 14);
    const coins = p.sp.data.coins;
    p.r.send(MSG_FEST.JOIN, { host: 'home' satisfies FestHost, act: 'feast' });
    await until(() => p.sp.data.coins > coins, 3000);
    expect(p.sp.data.inv.some((s) => s?.id === 'fruit_pie')).toBe(false);
    expect(p.sp.data.prog.fest).toContain(`f:home:${day}`);
    // once per feast
    dev(p, { cmd: 'give', id: 'fruit_pie', n: 1 });
    await until(() => p.sp.data.inv.some((s) => s?.id === 'fruit_pie'));
    expect(p.room.festivals.feast(p.sp, 'home')).toBe(false);
    // a kingdom's feast is only kept in that kingdom
    expect(p.room.festivals.feast(p.sp, 'aurelion')).toBe(false);
    await p.r.leave();
  });

  it('a tournament in the capital lists: three bouts against the kingdom’s soldiers crown a champion', async () => {
    const p = await spawn3(app, 'Lancer');
    await setLevel(p, 6);
    const lists = p.room.festivals.listsOf('aurelion');
    expect(lists).toBeTruthy();
    const states: TourneyState[] = [];
    p.r.onMessage(MSG_FEST.TOURNEY, (m: TourneyState) => states.push(m));
    windTo(p, (d) => !tourneyOn('aurelion', d), 14);
    await tp(p, lists!.c.x + 0.5, lists!.c.y + 0.5);
    expect(p.room.festivals.enter(p.sp, 'aurelion')).toBe(false); // not a tourney day
    const day = windTo(p, (d) => tourneyOn('aurelion', d), 9);
    expect(p.room.festivals.enter(p.sp, 'aurelion')).toBe(false); // the lists open at noon
    p.room.wclock.offset += (5 / 24) * DAY_MS; // the same day, 14:00
    // outside the lists: refused
    await tp(p, lists!.c.x + 0.5, lists!.c.y + 20);
    expect(p.room.festivals.enter(p.sp, 'aurelion')).toBe(false);
    await tp(p, lists!.c.x + 0.5, lists!.c.y + 0.5);
    const coins = p.sp.data.coins;
    p.r.send(MSG_FEST.JOIN, { host: 'aurelion', act: 'tourney' });
    for (let bout = 0; bout < 3; bout++) {
      await until(() => !!p.room.festivals.boutOf(p.sp)?.enemy, 8000);
      const b = p.room.festivals.boutOf(p.sp)!;
      expect(b.bout).toBe(bout);
      const e = p.room.enemies.get(b.enemy!)!;
      expect(e).toBeTruthy();
      // the ward is lifted over the lists while the bout is fought
      expect(p.room.festivals.warZone(e.x, e.y)).toBe(true);
      await tp(p, e.x + 1, e.y);
      p.sp.hp = p.sp.maxHp;
      dev(p, { cmd: 'kill', d: 4 });
      await until(() => p.room.festivals.boutOf(p.sp)?.bout !== bout || !p.room.festivals.boutOf(p.sp), 3000);
    }
    await until(() => !p.room.festivals.boutOf(p.sp), 3000);
    expect(p.sp.data.coins).toBeGreaterThan(coins);
    expect(p.sp.data.prog.titles).toContain('Golden Lance');
    expect(p.sp.data.prog.fest).toContain(`t:aurelion:${day}`);
    await until(() => states.some((s) => s.status === 'won'), 2000);
    expect(p.toasts.some((t) => /Champion/.test(t.text))).toBe(true);
    // the ward is back once the bout is over
    expect(p.room.festivals.warZone(lists!.c.x, lists!.c.y)).toBe(false);
    // a champion does not enter twice the same day
    expect(p.room.festivals.enter(p.sp, 'aurelion')).toBe(false);
    await p.r.leave();
  }, 60_000);

  it('leaving the lists forfeits the bout', async () => {
    const p = await spawn3(app, 'Squire');
    await setLevel(p, 4);
    const lists = p.room.festivals.listsOf('aurelion')!;
    windTo(p, (d) => tourneyOn('aurelion', d), 14);
    await tp(p, lists.c.x + 0.5, lists.c.y + 0.5);
    expect(p.room.festivals.enter(p.sp, 'aurelion')).toBe(true);
    await until(() => !!p.room.festivals.boutOf(p.sp)?.enemy, 8000);
    await tp(p, lists.c.x + 0.5, lists.c.y + 25);
    await until(() => !p.room.festivals.boutOf(p.sp), 3000);
    // Authority removes the bout before the websocket delivers the forfeit toast.
    await until(() => p.toasts.some((t) => /forfeit/.test(t.text)), 2000);
    expect(p.toasts.some((t) => /forfeit/.test(t.text))).toBe(true);
    await p.r.leave();
  });
});
