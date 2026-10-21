import { afterAll, describe, expect, it } from 'vitest';
import { MSG } from '@eigenlands/shared';
import type { App } from '../src/app';
import { loadConfig } from '../src/config';
import { worldClock } from '../src/rooms/runtime';
import { boot, count, dev, give, sleep, spawn, tp, until } from './p2';
import { httpUrl } from './helpers';

let app: App;
afterAll(async () => { await app?.close(); });

describe('dev commands (enabled)', () => {
  it('tp, give, coins, level, friend, learn and time work', async () => {
    app = await boot();
    const p = await spawn(app);
    await tp(p, 5.5, 6.5);
    await give(p, 'coal', 25);
    expect(count(p, 'coal')).toBe(25);
    dev(p, { cmd: 'coins', n: 50 });
    await until(() => p.sp.data.coins === 150);
    dev(p, { cmd: 'coins', n: -1000 });
    await until(() => p.sp.data.coins === 0);
    dev(p, { cmd: 'level', level: 5 });
    await until(() => p.sp.level === 5 && p.sp.maxHp > 60);
    dev(p, { cmd: 'friend', npc: 'orla', pts: 130 });
    await until(() => p.sp.data.friends.orla?.pts === 130);
    dev(p, { cmd: 'learn', recipe: '*' });
    await until(() => p.sp.data.recipes.has('forge'));
    const day0 = worldClock().day();
    dev(p, { cmd: 'time', offsetMs: 1_440_000 });
    await until(() => worldClock().day() === day0 + 1);
    // garbage is ignored, never crashes
    dev(p, { cmd: 'give', id: 'nope', n: 1 });
    dev(p, { cmd: 'tp', x: NaN, y: 1e12 });
    dev(p, { cmd: 'bogus' });
    dev(p, null as any);
    await sleep(150);
    expect(p.sp.sim.x).toBeCloseTo(5.5, 1);
    expect(p.profiles.some((m) => m.coins === 150)).toBe(true);
  });

  it('/metrics still works', async () => {
    const m = await (await fetch(`${httpUrl(app)}/metrics`)).json() as any;
    expect(m.tickBudgetMs).toBe(50);
    expect(m.players).toBeGreaterThanOrEqual(1);
  });
});

describe('dev commands (disabled by default)', () => {
  it('are ignored when devCommands is off, and never enabled in production', async () => {
    await app.close();
    app = await boot({ devCommands: false });
    const p = await spawn(app, 'NoCheats');
    const before = p.sp.sim.x;
    p.r.send(MSG.DEV, { cmd: 'give', id: 'gold_ingot', n: 5 });
    p.r.send(MSG.DEV, { cmd: 'coins', n: 9999 });
    p.r.send(MSG.DEV, { cmd: 'tp', x: 99, y: 99 });
    await sleep(300);
    expect(count(p, 'gold_ingot')).toBe(0);
    expect(p.sp.data.coins).toBe(100);
    expect(p.sp.sim.x).toBe(before);
    expect(loadConfig({ DEV_COMMANDS: '1', NODE_ENV: 'production', SESSION_SECRET: 'x' } as any).devCommands).toBe(false);
    expect(loadConfig({ DEV_COMMANDS: '1' } as any).devCommands).toBe(true);
    expect(loadConfig({} as any).devCommands).toBe(false);
  });
});
