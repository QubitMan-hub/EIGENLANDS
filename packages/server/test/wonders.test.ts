import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DAY_MS,
  MSG,
  RESTED_XP_MULT,
  BOUNTY_STYLE,
  ELITE,
  bountyOf,
  chunkOf,
  dayNumber,
  gameHour,
  starfallOn,
  townAt,
  townsNear,
} from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot3, clearEnemies, dev, flatten, setLevel, sleep, spawn3, tp, until, type P3 } from './p3helpers';

let app: App;
beforeAll(async () => {
  app = await boot3({ newWorldGeneration: 6 });
});
afterAll(async () => {
  await sleep(300);
  await app?.close();
});

/** move the world clock to the next moment satisfying `ok` (searched in game-hour steps) */
function setClock(p: P3, ok: (t: number) => boolean): void {
  const step = DAY_MS / 48;
  let t = p.room.wclock.now();
  for (let i = 0; i < 48 * 400 && !ok(t); i++) t += step;
  expect(ok(t)).toBe(true);
  p.room.wclock.setOffset(t - Date.now());
}

describe('starfall', () => {
  it('on a starfall night a star falls near a traveller out in the open; broken open, it gives star shards', async () => {
    const p = await spawn3(app, 'Stargazer');
    await tp(p, 600.5, 600.5);
    flatten(p.room, 600, 600, 26);
    clearEnemies(p.room);
    const offset = p.room.wclock.offset;
    setClock(p, (t) => gameHour(t) >= 22 && gameHour(t) < 23 && starfallOn(p.room.seed, dayNumber(t)));
    // hurry fate along: the next check lands it
    const room = p.room as unknown as { rand: () => number };
    const rand = room.rand;
    room.rand = () => 0.01;
    await until(() => p.toasts.some((t) => /falling star/.test(t.text)), 6000);
    room.rand = rand;
    let star: { x: number; y: number } | null = null;
    for (let dy = -24; dy <= 24 && !star; dy++)
      for (let dx = -24; dx <= 24 && !star; dx++)
        if (p.room.store.objectAt(600 + dx, 600 + dy)?.sub === 'fallen_star') star = { x: 600 + dx, y: 600 + dy };
    expect(star).toBeTruthy();
    const d = Math.hypot(star!.x - 600, star!.y - 600);
    expect(d).toBeGreaterThan(8);
    expect(d).toBeLessThan(24);
    // only one star per traveller per night
    room.rand = () => 0.01;
    await sleep(2500);
    room.rand = rand;
    expect(p.toasts.filter((t) => /falling star/.test(t.text)).length).toBe(1);
    // break it open
    await tp(p, star!.x + 1.5, star!.y + 0.5);
    const xp = p.sp.xp + p.sp.level * 1e6;
    p.r.send(MSG.OPEN, { tx: star!.x, ty: star!.y });
    await until(() => p.sp.data.inv.some((s) => s?.id === 'star_shard'), 3000);
    expect(p.room.store.objectAt(star!.x, star!.y)).toBeUndefined();
    expect(p.sp.xp + p.sp.level * 1e6).toBeGreaterThan(xp);
    p.room.wclock.setOffset(offset);
    await p.r.leave();
  }, 30_000);
});

describe('home comforts', () => {
  it('your own bed under your own roof leaves you well rested: experience comes easier', async () => {
    const p = await spawn3(app, 'Homebody');
    await tp(p, 620.5, 620.5);
    flatten(p.room, 620, 620, 6);
    p.room.objects.put({
      x: 622,
      y: 620,
      kind: 'structure',
      sub: 'cell',
      owner: p.sp.accountId,
      data: { floor: 'timber_floor', roof: 'thatch_roof', roofTurn: 0 },
    });
    p.room.objects.put({ x: 622, y: 620, kind: 'furniture', sub: 'bed', owner: p.sp.accountId, data: {} });
    // a bed out under the sky rests you, but not like home
    p.room.objects.put({ x: 622, y: 623, kind: 'furniture', sub: 'bed', owner: p.sp.accountId, data: {} });
    await tp(p, 621.5, 623.5);
    p.r.send(MSG.OPEN, { tx: 622, ty: 623 });
    await until(() => !!p.sp.data.buffs.bed_rest, 3000);
    expect(p.sp.data.buffs.rested).toBeUndefined();
    delete p.sp.data.buffs.bed_rest;
    await tp(p, 621.5, 620.5);
    p.r.send(MSG.OPEN, { tx: 622, ty: 620 });
    await until(() => !!p.sp.data.buffs.rested, 3000);
    const before = p.sp.xp,
      lvl = p.sp.level;
    p.room.grantXp(p.sp, 20);
    expect(p.sp.level).toBe(lvl);
    expect(p.sp.xp - before).toBe(Math.round(20 * RESTED_XP_MULT));
    await p.r.leave();
  });
});

describe('town bounties', () => {
  it('a town posts a named beast; out where it was seen it waits, and bringing it down pays the bounty', async () => {
    const p = await spawn3(app, 'Huntress');
    await setLevel(p, 6);
    // the home town, on the next day it posts a bounty whose beast prowls inside this room
    const town = townsNear(p.room.seed, -200, -200, 200, 200).find((t) => !t.abandoned)!;
    expect(town).toBeTruthy();
    const offset = p.room.wclock.offset;
    const initialDay = p.room.wclock.day();
    setClock(p, (t) => {
      const b = bountyOf(p.room.seed, town, dayNumber(t));
      return dayNumber(t) > initialDay && gameHour(t) >= 11 && gameHour(t) < 12 && !!b && p.room.owns(b.x, b.y);
    });
    const day = p.room.wclock.day();
    const b = bountyOf(p.room.seed, town, day)!;
    await tp(p, town.cx + 0.5, town.cy + 0.5);
    expect(townAt(p.room.seed, Math.floor(p.sp.sim.x), Math.floor(p.sp.sim.y))?.name).toBe(town.name);
    p.room.wonders.tick(p.room.wclock.now(), 2.1);
    await until(() => p.toasts.some((t) => t.text.includes(`Bounty posted in ${town.name}`)), 5000);
    expect(p.toasts.find((t) => t.text.includes('Bounty posted'))!.text).toContain(b.name);
    // out to where it was seen
    await tp(p, b.x + 0.5, b.y + 6.5);
    await p.room.ensureChunk(chunkOf(b.x), chunkOf(b.y));
    p.room.wonders.tick(p.room.wclock.now(), 2.1);
    await until(() => p.room.wonders.bountyState(b.id) === 'out', 8000);
    // it is no ordinary beast: marked, renamed and fighting in its own way
    const beast = [...p.room.enemies.values()].find((e: any) => e.state.elite & ELITE.BOUNTY)!;
    expect(beast).toBeTruthy();
    expect(beast.def.name).toBe(b.name);
    expect(beast.def.ai).toBe(BOUNTY_STYLE[b.kind].ai);
    expect(p.room.wonders.bountyAt(town.cx, town.cy)?.state).toBe('out');
    const coins = p.sp.data.coins;
    p.sp.hp = p.sp.maxHp;
    for (let i = 0; i < 20 && p.room.wonders.bountyState(b.id) !== 'slain'; i++) {
      dev(p, { cmd: 'kill', d: 30 });
      await sleep(200);
    }
    expect(p.room.wonders.bountyState(b.id)).toBe('slain');
    await until(() => p.sp.data.coins >= coins + b.reward, 3000);
    expect(p.room.wonders.bountyAt(town.cx, town.cy)?.state).toBe('slain');
    await until(() => p.toasts.some((t) => t.text.includes(`${b.name} is slain`)), 3000);
    expect(p.toasts.some((t) => t.text.includes(`${b.name} is slain`))).toBe(true);
    // it does not rise again today
    await sleep(2500);
    expect(p.room.wonders.bountyState(b.id)).toBe('slain');
    p.room.wclock.setOffset(offset);
    await p.r.leave();
  }, 40_000);

  it('a town without a request board gets a notice board by its well, once', async () => {
    const p = await spawn3(app, 'Reader');
    const town = townsNear(p.room.seed, -700, -700, 700, 700).find(
      (t) =>
        !t.abandoned && !t.objects.some((o) => o.sub === 'board') && p.room.owns(Math.round(t.cx), Math.round(t.cy)),
    );
    expect(town).toBeTruthy();
    if (!town) return;
    await tp(p, town.cx + 0.5, town.cy + 0.5);
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) await p.room.ensureChunk(chunkOf(town.cx) + dx, chunkOf(town.cy) + dy);
    p.room.wonders.ensureBoard(town);
    const boards = () => {
      const out: Array<{ x: number; y: number }> = [];
      for (let y = Math.round(town.cy) - 20; y <= Math.round(town.cy) + 20; y++)
        for (let x = Math.round(town.cx) - 20; x <= Math.round(town.cx) + 20; x++)
          if (p.room.store.objectAt(x, y)?.sub === 'bounty_board') out.push({ x, y });
      return out;
    };
    expect(boards().length).toBe(1);
    p.room.wonders.ensureBoard(town);
    expect(boards().length).toBe(1);
    await p.r.leave();
  });
});
