import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DAY_MS, MSG_CIV, REALM_GEO, type CivSummary } from '@eigenlands/shared';
import type { App } from '../src/app';
import { civOf, recordCiv } from '../src/features/civ/registry';
import { boot3, sleep, spawn3, tp, until } from './p3helpers';

let app: App;
beforeAll(async () => {
  app = await boot3({ newWorldGeneration: 6 });
});
afterAll(async () => {
  await app?.close();
});

describe('living kingdoms', () => {
  it('players receive the kingdoms state; the world turns daily with their deeds; intrigue is decided once', async () => {
    const p = await spawn3(app, 'Courtier');
    const states: CivSummary[] = [];
    p.r.onMessage(MSG_CIV.STATE, (m: CivSummary) => states.push(m));
    // the join message may have arrived before the listener: ask the room for today's world instead
    await until(() => !!civOf(p.room.seed), 5000);
    const w = civOf(p.room.seed)!;
    const day0 = w.day;
    // trade in Aurelion today, then let a day pass
    const before = w.kingdoms.aurelion.prosperity;
    recordCiv(p.room.seed, 'aurelion', 'trade', 20000);
    p.room.wclock.offset += DAY_MS;
    await until(() => states.some((s) => s.day > day0), 6000);
    expect(w.kingdoms.aurelion.prosperity).toBeGreaterThan(before);
    expect(w.ledger.aurelion.trade).toBe(0); // the ledger is spent on the day's turn
    // plant an intrigue and decide it from inside the kingdom
    w.kingdoms.aurelion.intrigue = {
      id: 'test',
      day: w.day,
      expires: w.day + 5,
      title: 'Letters in the Treasury',
      text: 'test',
      choices: [
        { id: 'a', label: 'a', outcome: 'good' },
        { id: 'b', label: 'b', outcome: 'bad' },
      ],
    };
    // from Hadamere: refused (court business is settled in the kingdom)
    p.r.send(MSG_CIV.CHOOSE, { realm: 'aurelion', choice: 'b' });
    await until(() => p.toasts.some((t) => /settled in Aurelion/.test(t.text)), 2000);
    const g = REALM_GEO.aurelion;
    await tp(p, g.cx + 0.5, g.cy + 40.5);
    const coins = p.sp.data.coins;
    p.r.send(MSG_CIV.CHOOSE, { realm: 'aurelion', choice: 'b' });
    await until(() => w.kingdoms.aurelion.intrigue === null, 3000);
    expect(p.sp.data.coins).toBeGreaterThan(coins);
    p.r.send(MSG_CIV.CHOOSE, { realm: 'aurelion', choice: 'a' });
    await sleep(300);
    expect(p.toasts.some((t) => /already been settled/.test(t.text))).toBe(true);
    await p.r.leave();
  });
});
