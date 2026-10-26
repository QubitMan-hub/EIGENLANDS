import { afterAll, beforeAll, expect, it } from 'vitest';
import { REALM_SITE_BY_ID, armyKey, type RaidPlan } from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot3, spawn3, tp, until, sleep, setLevel } from './p3helpers';

let app: App;
beforeAll(async () => {
  app = await boot3({ newWorldGeneration: 5 });
});
afterAll(async () => {
  await sleep(250);
  await app?.close();
});

it('garrisons a settlement with its realm soldiers when a player is near', async () => {
  const p = await spawn3(app, 'Visitor');
  const site = REALM_SITE_BY_ID['aurelion_capital']!;
  await tp(p, site.cx, site.cy + 8);
  await p.room.ensureChunk(Math.floor(site.cx / 32), Math.floor(site.cy / 32));
  await until(() => p.room.state.army.size >= 6, 6000);
  const kinds = new Set<number>();
  p.room.state.army.forEach((u) => kinds.add(u.kind));
  expect(kinds.size).toBeGreaterThanOrEqual(2);
  for (const u of p.room.army.garrison()) expect(u.site.realm).toBe('aurelion');
  await p.r.leave();
});

it('fights a scheduled raid: raiders spawn, the garrison engages and the raid ends with a result', async () => {
  const p = await spawn3(app, 'Defender');
  await setLevel(p, 6);
  const site = REALM_SITE_BY_ID['aurelion_capital']!;
  await tp(p, site.cx, site.cy + 8);
  await p.room.ensureChunk(Math.floor(site.cx / 32), Math.floor(site.cy / 32));
  await until(() => p.room.state.army.size >= 4, 6000);
  const plan: RaidPlan = {
    id: 'raid:test',
    day: p.room.wclock.day(),
    hour: 8,
    attacker: 'nethrakar',
    defender: 'aurelion',
    siteId: site.id,
    scale: 1,
    party: [2, 1, 0, 0],
    beast: false,
  };
  expect(p.room.army.startNow(plan)).toBe(true);
  const raiders = [...p.room.enemies.values()].filter((e) => e.state.fac > 0);
  expect(raiders.length).toBe(3);
  expect(raiders.every((e) => e.def.name.length > 0)).toBe(true);
  expect(raiders[0]!.def.kind).toBe(p.room.enemies.get(raiders[0]!.id)!.def.kind);
  expect(armyKey('nethrakar', 'infantry')).toContain('nethrakar');
  // raiders keep their fight inside the walls: not removed as intruders of the sanctuary
  for (const e of raiders) {
    e.x = site.cx;
    e.y = site.cy + 4;
  }
  await sleep(300);
  expect([...p.room.enemies.values()].filter((e) => e.state.fac > 0).length).toBe(3);
  // beat them back: the module finishes the raid and records the outcome
  for (const e of raiders) p.room.hitEnemy(e, 99999, p.sp, 1, 0, 0);
  await until(() => p.room.army.activeRaids().length === 0, 4000);
  expect(p.room.army.results.get(site.id)?.repelled).toBe(true);
  await p.r.leave();
});
