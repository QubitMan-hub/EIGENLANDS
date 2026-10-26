import { beforeAll, afterAll, expect, it } from 'vitest';
import {
  MSG,
  MSG34,
  guildBoard,
  townFor,
  rotatingGuildContracts,
  T,
  addStack,
  hash2,
  readCharter,
  inspectHome,
  type GuildJourney,
  type WorldObj,
} from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot3, spawn3, tp, sleep, until, cast, st } from './p3helpers';
import { handleGuild } from '../src/systems/guild';
import { validQuests } from '../src/systems/profile';
let app: App;
beforeAll(async () => {
  app = await boot3({ newWorldGeneration: 6 });
});
afterAll(async () => {
  await sleep(250);
  await app.close();
});
it('surveys a real route, persists investigation evidence, rejects remote choices, branches and pays once', async () => {
  const p = await spawn3(app, 'Investigator'),
    b = guildBoard(townFor(p.room.seed))!;
  await p.room.ensureChunk(Math.floor(b.x / 32), Math.floor(b.y / 32));
  await tp(p, b.x + 0.5, b.y + 1.5);
  p.sp.data.quests['guild:rank:F'] = { state: 'done', progress: [] };
  const id = rotatingGuildContracts(p.room.seed, p.room.wclock.day(), 'F')[2]!.id;
  await handleGuild(p.room, p.sp, { npcId: 'guild', quest: id, action: 'accept', tx: b.x, ty: b.y });
  const d = p.sp.data.quests[id]!.journey!;
  expect(
    validQuests({ [id]: { state: 'active', progress: [], journey: { kind: 'invalid' } } }, p.room.wclock.day())[id],
  ).toBeUndefined();
  expect(d.points).toHaveLength(3);
  expect(d.points[2]).not.toEqual(d.home);
  expect(validQuests(JSON.parse(JSON.stringify(p.sp.data.quests)), p.room.wclock.day())[id]?.journey).toEqual(d);
  p.r.send('guild_journey', { id, action: 'choose', choice: 'mercy' });
  await sleep(80);
  expect(p.sp.data.quests[id]!.progress[0]).toBe(0);
  for (const point of d.points) {
    await tp(p, point.x, point.y);
    p.r.send('guild_journey', { id, action: 'inspect' });
    await until(() => d.stage > d.points.indexOf(point));
  }
  const answer = Math.floor(hash2(p.room.seed, p.room.wclock.day(), 0, 9801) * 3);
  p.r.send('guild_journey', { id, action: 'choose', choice: `accuse:${answer}` });
  await until(() => !!d.choice);
  p.r.send('guild_journey', { id, action: 'choose', choice: 'mercy' });
  await until(() => p.sp.data.quests[id]!.progress[0] === 1);
  await tp(p, b.x + 0.5, b.y + 1.5);
  await handleGuild(p.room, p.sp, { npcId: 'guild', quest: id, action: 'abandon', tx: b.x, ty: b.y });
  expect(p.sp.data.quests[id]!.progress[0]).toBe(1);
  const coins = p.sp.data.coins;
  await tp(p, b.x + 0.5, b.y + 1.5);
  await handleGuild(p.room, p.sp, { npcId: 'guild', quest: id, action: 'turnin', tx: b.x, ty: b.y });
  expect(p.sp.data.coins).toBe(coins + 60);
  await handleGuild(p.room, p.sp, { npcId: 'guild', quest: id, action: 'turnin', tx: b.x, ty: b.y });
  expect(p.sp.data.coins).toBe(coins + 60);
  await p.r.leave();
}, 30000);
it('requires the actual escort to arrive, can abandon failed work, and debits a diplomatic offer only once', async () => {
  const p = await spawn3(app, 'Roadkeeper'),
    day = p.room.wclock.day(),
    ids = rotatingGuildContracts(p.room.seed, day, 'F');
  const b = guildBoard(townFor(p.room.seed))!;
  await p.room.ensureChunk(Math.floor(b.x / 32), Math.floor(b.y / 32));
  await tp(p, b.x + 0.5, b.y + 1.5);
  p.sp.data.quests['guild:rank:F'] = { state: 'done', progress: [] };
  const id = ids[0]!.id;
  await handleGuild(p.room, p.sp, { npcId: 'guild', quest: id, action: 'accept', tx: b.x, ty: b.y });
  const d = p.sp.data.quests[id]!.journey!;
  await tp(p, d.points[2]!.x, d.points[2]!.y);
  await sleep(350);
  expect(p.sp.data.quests[id]!.progress[0]).toBe(0);
  expect(d.stage).toBe(0);
  await tp(p, b.x + 0.5, b.y + 1.5);
  d.failed = true;
  p.r.send(MSG.QUEST, { npcId: 'guild', quest: id, action: 'abandon', tx: b.x, ty: b.y });
  await until(() => !p.sp.data.quests[id]);
  const dip = ids[3]!.id;
  await handleGuild(p.room, p.sp, { npcId: 'guild', quest: dip, action: 'accept', tx: b.x, ty: b.y });
  const env = p.sp.data.quests[dip]!.journey!;
  p.sp.data.coins = 200;
  await tp(p, env.x, env.y);
  p.r.send('guild_journey', { id: dip, action: 'choose', choice: 'compromise' });
  await until(() => p.sp.data.quests[dip]!.progress[0] === 1);
  expect(p.sp.data.coins).toBe(150);
  p.r.send('guild_journey', { id: dip, action: 'choose', choice: 'compromise' });
  await sleep(150);
  expect(p.sp.data.coins).toBe(150);
  await p.r.leave();
}, 30000);
function home(p: any, x: number, y: number) {
  for (let dy = 0; dy <= 4; dy++)
    for (let dx = 0; dx <= 4; dx++) {
      const xx = x + dx,
        yy = y + dy;
      p.room.store.setTile(xx, yy, T.GRASS);
      p.room.objects.put({
        x: xx,
        y: yy,
        kind: 'structure',
        sub: 'cell',
        owner: p.accountId,
        data:
          dx === 0 || dx === 4 || dy === 0 || dy === 4
            ? { wall: dx === 2 && dy === 4 ? 'timber_door' : 'timber_wall' }
            : { floor: 'timber_floor', roof: 'thatch_roof' },
      });
    }
  for (const [dx, dy, sub] of [
    [1, 1, 'bed'],
    [2, 1, 'table'],
    [3, 1, 'oil_lamp'],
  ] as const)
    p.room.objects.put({ x: x + dx, y: y + dy, kind: 'furniture', sub, owner: p.accountId });
}
it('assigns genuine separate homes, protects treasury ownership, disables services after demolition and saves a charter', async () => {
  const p = await spawn3(app, 'Founder'),
    q = await spawn3(app, 'Visitor');
  await p.room.ensureChunk(6, 6);
  home(p, 202, 202);
  const b: WorldObj = { x: 200, y: 202, kind: 'deco', sub: 'guild_noticeboard', owner: p.accountId };
  p.room.objects.put(b);
  await tp(p, 200.5, 203.5);
  await tp(q, 200.5, 203.5);
  p.sp.data.coins = 1000;
  const send = (who: any, action: string, extra = {}) =>
    who.r.send('settlement', { tx: b.x, ty: b.y, action, ...extra });
  send(q, 'deposit');
  await sleep(100);
  expect(b.data?.charter).toBeUndefined();
  send(p, 'deposit');
  await until(() => !!b.data?.charter);
  send(p, 'invite', { x: 203, y: 203, role: 'warden' });
  await until(() => readCharter(b.data?.charter, 0).residents.length === 1);
  send(p, 'invite', { x: 203, y: 203, role: 'gardener' });
  await sleep(100);
  expect(readCharter(b.data?.charter, 0).residents).toHaveLength(1);
  expect(p.room.settlements.incomingDamage(p.sp, 100)).toBe(92);
  p.room.objects.remove(204, 204, true);
  expect(inspectHome(p.room.store, p.accountId, 203, 203).valid).toBe(false);
  expect(p.room.settlements.incomingDamage(p.sp, 100)).toBe(100);
  const creds = { token: p.token, accountId: p.accountId };
  await q.r.leave();
  await p.r.leave();
  await sleep(300);
  const again = await spawn3(app, 'Founder', creds);
  await again.room.ensureChunk(6, 6);
  expect(readCharter(again.room.store.objectAt(200, 202)?.data?.charter, 0).residents).toHaveLength(1);
  await again.r.leave();
}, 30000);
it('trains only happy adult owned mounts, syncs quiet animals, dismounts on damage and retains training', async () => {
  const p = await spawn3(app, 'Rider');
  await p.room.ensureChunk(6, 6);
  const day = p.room.wclock.day();
  for (let y = 218; y < 227; y++)
    for (let x = 218; x < 227; x++) {
      p.room.store.setTile(x, y, T.GRASS);
      p.room.store.get(6, 6).levels?.fill(0);
    }
  const o: WorldObj = {
    x: 222,
    y: 222,
    kind: 'shelter',
    sub: 'barn',
    owner: p.accountId,
    data: {
      herd: [
        { id: 0, species: 'horse', born: day - 6, happy: 90, bred: -9 },
        { id: 1, species: 'phasehart', born: day - 20, happy: 90, bred: -9, trained: true },
      ],
      serial: 1,
      lastDay: day,
    },
  };
  p.room.objects.put(o);
  p.sp.data.coins = 1000;
  addStack(p.sp.data.inv, { id: 'hay', n: 10 });
  await tp(p, 222.5, 223.5);
  p.room.enemies.clear();
  p.room.state.enemies.clear();
  p.r.send('ranch', { tx: 222, ty: 222, id: 0, action: 'train' });
  await until(() => !!(o.data?.herd as any[])?.[0]?.trained);
  expect(p.sp.data.coins).toBe(900);
  p.r.send('ranch', { tx: 222, ty: 222, id: 0, action: 'train' });
  await sleep(100);
  expect(p.sp.data.coins).toBe(900);
  p.r.send('ranch', { tx: 222, ty: 222, id: 0, action: 'ride' });
  await until(() => p.sp.sim.mount === 1);
  p.room.ranch.incomingDamage(p.sp, 1);
  expect(p.sp.sim.mount).toBe(0);
  await until(() => p.room.state.npcs.has('livestock:222,222:0'));
  const n = p.room.state.npcs.get('livestock:222,222:0')!;
  expect(n.farm).toBe('horse');
  expect(Math.hypot(n.x - 222, n.y - 222)).toBeLessThan(5);
  p.r.send('ranch', { tx: 222, ty: 222, id: 1, action: 'ride' });
  await until(() => p.sp.sim.mount === 5);
  await sleep(1200); // Includes travel care ticks: this must remain a Glimmerhart.
  expect(p.sp.sim.mount).toBe(5);
  p.room.ranch.incomingDamage(p.sp, 1);
  expect(p.sp.sim.mount).toBe(0);
  await p.r.leave();
}, 30000);
it('walks a real escort through checkpoints, frees a guarded rescue and shares only nearby living party quest credit', async () => {
  const p = await spawn3(app, 'Guide'),
    q = await spawn3(app, 'Ally'),
    far = await spawn3(app, 'Distant Ally');
  await p.room.ensureChunk(6, 6);
  const day = p.room.wclock.day();
  for (let y = 230; y <= 240; y++)
    for (let x = 230; x <= 240; x++) {
      p.room.store.setTile(x, y, T.GRASS);
      p.room.store.get(6, 6).levels?.fill(0);
      const o = p.room.store.objectAt(x, y);
      if (o && !o.static) p.room.objects.remove(x, y);
    }
  p.room.enemies.clear();
  p.room.state.enemies.clear();
  const id = rotatingGuildContracts(p.room.seed, day, 'F')[0]!.id;
  const journey: GuildJourney = {
    kind: 'escort',
    home: { x: 232.5, y: 233.5 },
    points: [
      { x: 234.5, y: 233.5 },
      { x: 236.5, y: 233.5 },
      { x: 238.5, y: 233.5 },
    ],
    x: 232.5,
    y: 233.5,
    stage: 0,
    hp: 100,
    released: true,
    failed: false,
  };
  p.sp.data.quests[id] = { state: 'active', progress: [0], journey };
  for (const point of journey.points) {
    await tp(p, point.x, point.y);
    await until(() => Math.hypot(journey.x - point.x, journey.y - point.y) < 2.2, 6000);
  }
  await until(() => p.sp.data.quests[id]!.progress[0] === 1, 6000);
  // Use actual existing party invitations, then dispatch the same authoritative kill hook as combat.
  p.r.send(MSG34.PARTY, { action: 'invite', name: q.sp.name });
  let invite: any;
  q.r.onMessage(MSG34.PARTY_INVITE, (m) => (invite = m));
  await until(() => !!invite);
  q.r.send(MSG34.PARTY, { action: 'accept', partyId: invite.partyId });
  await until(() => p.room.social.partyMates(p.accountId).includes(q.accountId));
  const killQuest = 'guild:F:0';
  p.sp.data.quests[killQuest] = { state: 'active', progress: [0] };
  q.sp.data.quests[killQuest] = { state: 'active', progress: [0] };
  await tp(p, 235.5, 236.5);
  await tp(q, 236.5, 236.5);
  const e = p.room.spawnEnemy('slime', 237.5, 236.5, false);
  p.room.journeys.killed(e, p.sp);
  expect(q.sp.data.quests[killQuest]!.progress[0]).toBe(1);
  expect(p.sp.data.quests[killQuest]!.progress[0]).toBe(0);
  q.sp.deadT = 3;
  p.room.journeys.killed(e, p.sp);
  expect(q.sp.data.quests[killQuest]!.progress[0]).toBe(1);
  q.sp.deadT = 0;
  await tp(q, 280.5, 280.5);
  p.room.journeys.killed(e, p.sp);
  expect(q.sp.data.quests[killQuest]!.progress[0]).toBe(1);
  e.noRewards = true;
  await tp(q, 236.5, 236.5);
  p.room.journeys.killed(e, p.sp);
  expect(q.sp.data.quests[killQuest]!.progress[0]).toBe(1);
  p.room.enemies.clear();
  p.room.state.enemies.clear();
  const rescue = rotatingGuildContracts(p.room.seed, day, 'F')[1]!.id;
  const r: GuildJourney = {
    ...journey,
    kind: 'rescue',
    x: 235.5,
    y: 233.5,
    home: { x: 232.5, y: 233.5 },
    stage: 0,
    released: false,
  };
  p.sp.data.quests[rescue] = { state: 'active', progress: [0], journey: r };
  await tp(p, 235.5, 234.5);
  await until(() => [...p.room.enemies.values()].some((e) => e.noRewards), 3000);
  expect(r.released).toBe(false);
  for (const e of [...p.room.enemies.values()])
    if (e.noRewards) {
      p.room.enemies.delete(e.id);
      p.room.state.enemies.delete(e.id);
    }
  await until(() => r.released);
  await tp(p, r.home.x, r.home.y);
  await until(() => p.sp.data.quests[rescue]!.progress[0] === 1, 6000);
  await far.r.leave();
  await q.r.leave();
  await p.r.leave();
}, 30000);

it('gates the Wayguard specialization by real guild rank, not level alone', async () => {
  const p = await spawn3(app, 'Wayguard');
  p.r.send(MSG34.CHOOSE, { what: 'class', cls: 'superposer' });
  await until(() => p.prog.cls === 'superposer');
  p.sp.level = 10;
  p.r.send(MSG34.CHOOSE, { what: 'spec', spec: 'guild_warden' });
  await until(() => p.toasts.some((t) => t.text.includes('guild rank B')));
  expect(p.prog.spec).toBeNull();
  for (const rank of ['F', 'E', 'D', 'C', 'B'])
    p.sp.data.quests[`guild:rank:${rank}`] = { state: 'done', progress: [] };
  p.r.send(MSG34.CHOOSE, { what: 'spec', spec: 'guild_warden' });
  await until(() => p.prog.spec === 'guild_warden');
  await p.r.leave();
});

it('casts real Circuit abilities and ultimates on foot even when a travel or ranch mount was active', async () => {
  const p = await spawn3(app, 'Mounted caster');
  p.sp.sim.mount = 1;
  expect((await cast(p, 0)).ok).toBe(true);
  expect(p.sp.sim.mount).toBe(0);
  p.r.send(MSG34.CHOOSE, { what: 'class', cls: 'superposer' });
  await until(() => p.prog.cls === 'superposer');
  st(p).res = 100;
  p.sp.sim.mount = 5;
  p.r.send(MSG34.ULT, { aimX: 1, aimY: 0 });
  await until(() => p.casts.some((c) => c.ult && c.ok));
  expect(p.sp.sim.mount).toBe(0);
  await p.r.leave();
});
