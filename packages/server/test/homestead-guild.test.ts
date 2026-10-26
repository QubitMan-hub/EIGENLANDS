import { beforeAll, afterAll, expect, it } from 'vitest';
import { MSG, guildBoard, townFor, guildRank, countItem, addStack, type HerdData } from '@eigenlands/shared';
import { handleShelter } from '../src/systems/containers';
import { rollShelter } from '../src/systems/farming';
import { questEvent } from '../src/systems/quests';
import type { App } from '../src/app';
import { boot3, spawn3, tp, sleep, until } from './p3helpers';
let app: App;
beforeAll(async () => {
  app = await boot3({ newWorldGeneration: 6 });
});
afterAll(async () => {
  await sleep(250);
  await app?.close();
});
it('registers at a real guild board, denies remote rank claims, records commissions and retains identity after reconnect', async () => {
  const p = await spawn3(app, 'Guild applicant');
  const b = guildBoard(townFor(p.room.seed))!;
  expect(b).toBeTruthy();
  await p.room.ensureChunk(Math.floor(b.x / 32), Math.floor(b.y / 32));
  p.r.send(MSG.QUEST, { npcId: 'guild', quest: 'guild:rank:F', action: 'accept', tx: b.x, ty: b.y });
  await sleep(100);
  expect(guildRank(p.sp.data.quests)).toBeNull();
  await tp(p, b.x + 0.5, b.y + 1.5);
  p.r.send(MSG.QUEST, { npcId: 'guild', quest: 'guild:rank:F', action: 'accept', tx: b.x, ty: b.y });
  await until(() => guildRank(p.sp.data.quests) === 'F');
  p.r.send(MSG.QUEST, { npcId: 'guild', quest: 'guild:rank:SSS', action: 'accept', tx: b.x, ty: b.y });
  await sleep(120);
  expect(p.sp.data.quests['guild:rank:SSS']).toBeUndefined();
  p.r.send(MSG.QUEST, { npcId: 'guild', quest: 'guild:F:0', action: 'accept', tx: b.x, ty: b.y });
  await until(() => !!p.sp.data.quests['guild:F:0']);
  questEvent(p.sp, { type: 'kill', target: 'slime', n: 3 });
  const coins = p.sp.data.coins;
  p.r.send(MSG.QUEST, { npcId: 'guild', quest: 'guild:F:0', action: 'turnin', tx: b.x, ty: b.y });
  await until(() => p.sp.data.quests['guild:F:0']?.state === 'done');
  expect(p.sp.data.coins).toBe(coins + 35);
  p.r.send(MSG.QUEST, { npcId: 'guild', quest: 'guild:F:0', action: 'turnin', tx: b.x, ty: b.y });
  await sleep(150);
  expect(p.sp.data.coins).toBe(coins + 35);
  const creds = { token: p.token, accountId: p.accountId };
  await p.r.leave();
  await sleep(300);
  const again = await spawn3(app, 'Guild applicant', creds);
  expect(guildRank(again.sp.data.quests)).toBe('F');
  expect(again.sp.data.quests['guild:F:0']?.state).toBe('done');
  await again.r.leave();
}, 30000);
it('owns, adopts, feeds, grows, breeds and collects a persistent individual herd atomically', async () => {
  const p = await spawn3(app, 'Rancher'),
    other = await spawn3(app, 'Neighbour');
  const x = 203,
    y = 202,
    day = p.room.wclock.day();
  await p.room.ensureChunk(6, 6);
  p.sp.sim.x = x + 0.5;
  p.sp.sim.y = y + 1.5;
  other.sp.sim.x = x + 1.5;
  other.sp.sim.y = y + 1.5;
  const o = {
    x,
    y,
    kind: 'shelter' as const,
    sub: 'barn',
    owner: p.accountId,
    data: { animals: 0, fed: false, ready: 0, lastDay: day },
  };
  p.room.objects.put(o);
  p.sp.data.coins = 10000;
  addStack(p.sp.data.inv, { id: 'hay', n: 50 });
  const act = (action: 'buy' | 'feed' | 'breed' | 'collect' | 'care', species: 'cow' | 'sheep' = 'cow') =>
    handleShelter(p.room, p.sp, { tx: x, ty: y, action, species });
  handleShelter(p.room, other.sp, { tx: x, ty: y, action: 'buy', species: 'cow' });
  expect(o.data.animals).toBe(0);
  act('buy');
  act('buy');
  expect(o.data.animals).toBe(2);
  expect(p.sp.data.coins).toBe(8960);
  act('feed');
  const hay = countItem(p.sp.data.inv, 'hay');
  act('feed');
  expect(countItem(p.sp.data.inv, 'hay')).toBe(hay);
  let d = o.data as unknown as HerdData;
  d.herd.forEach((a) => {
    a.born = day - 4;
    a.happy = 90;
  });
  act('breed');
  expect(o.data.animals).toBe(3);
  act('breed');
  expect(o.data.animals).toBe(3);
  rollShelter(o, day + 1);
  d = o.data as unknown as HerdData;
  expect(d.stock.milk).toBe(2);
  rollShelter(o, day + 1);
  expect(d.stock.milk).toBe(2);
  // Full pack refuses the whole collection without erasing ready stock.
  const inv = p.sp.data.inv.slice();
  p.sp.data.inv.fill(null);
  p.sp.data.inv = p.sp.data.inv.map(() => ({ id: 'stone', n: 999 }));
  act('collect');
  expect((o.data as unknown as HerdData).stock.milk).toBe(2);
  p.sp.data.inv = inv;
  act('collect');
  expect(countItem(p.sp.data.inv, 'milk')).toBe(2);
  expect((o.data as unknown as HerdData).ready).toBe(0);
  await other.r.leave();
  await p.r.leave();
  await sleep(300);
  const again = await spawn3(app, 'Rancher', { token: p.token, accountId: p.accountId });
  await again.room.ensureChunk(6, 6);
  expect((again.room.store.objectAt(x, y)?.data as unknown as HerdData).herd).toHaveLength(3);
  await again.r.leave();
}, 30000);
