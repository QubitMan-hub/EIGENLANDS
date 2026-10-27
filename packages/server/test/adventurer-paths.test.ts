import { beforeAll, afterAll, expect, it } from 'vitest';
import { T, MSG34, ADVENTURER_PATHS, allowedAbilities, type AbilityId } from '@eigenlands/shared';
import { boot3, spawn3, tp, sleep, until, dev3, st, attune, mkBoard, type P3 } from './p3helpers';
import type { App } from '../src/app';
let app: App;
beforeAll(async () => {
  app = await boot3({ newWorldGeneration: 6 });
});
afterAll(async () => {
  await sleep(200);
  await app.close();
});
async function field(name: string) {
  const p = await spawn3(app, name);
  p.sp.level = 20;
  await p.room.ensureChunk(6, 6);
  for (let y = 198; y < 214; y++)
    for (let x = 198; x < 216; x++) {
      p.room.store.setTile(x, y, T.GRASS);
      p.room.store.get(6, 6).levels?.fill(0);
      const o = p.room.store.objectAt(x, y);
      if (o && !o.static) p.room.objects.remove(x, y);
    }
  p.room.enemies.clear();
  p.room.state.enemies.clear();
  await tp(p, 204.5, 204.5);
  p.sp.invuln = 999;
  return p;
}
async function choose(p: P3, cls: any) {
  dev3(p, { cmd: 'class', cls });
  await until(() => st(p).pr.cls === cls);
}
it('implements a directional strike and temporary summons that follow, fight, expire and never enter the permanent roster', async () => {
  const p = await field('Conjurer');
  await choose(p, 'warrior');
  const front = p.room.spawnEnemy('brute', 206, 204.5, false),
    back = p.room.spawnEnemy('brute', 203, 204.5, false);
  p.circuit.engine.execute({ caster: p.sp, ability: 'warrior_0', bit: 0, hue: 2, power: 1, aimX: 1, aimY: 0 });
  expect(front.hp).toBeLessThan(front.maxHp);
  expect(back.hp).toBe(back.maxHp);
  p.room.enemies.clear();
  p.room.state.enemies.clear();
  await choose(p, 'mage');
  for (let i = 0; i < 3; i++)
    p.circuit.engine.execute({ caster: p.sp, ability: 'mage_2', bit: 0, hue: 3, power: 1, aimX: 1, aimY: 0 });
  const pets = () => [...p.room.state.shadows.values()].filter((s) => s.owner === p.sid);
  expect(pets()).toHaveLength(2);
  const enemy = p.room.spawnEnemy('slime', 208, 204.5, false);
  await until(() => enemy.hp < enemy.maxHp || !p.room.enemies.has(enemy.id), 8000);
  p.room.shadows.tick(Date.now(), 40);
  expect(pets()).toHaveLength(0);
  const creds = { token: p.token, accountId: p.accountId };
  await p.r.leave();
  await sleep(250);
  const again = await spawn3(app, 'Conjurer', creds);
  expect([...again.room.state.shadows.values()].filter((s) => s.owner === again.sid)).toHaveLength(0);
  await again.r.leave();
}, 30000);
it('rejects other path skills and unlocks only the chosen level-10 discipline through real messages', async () => {
  const p = await field('Knight candidate');
  await choose(p, 'warrior');
  const knight = ADVENTURER_PATHS.find((s) => s.id === 'knight')!;
  expect((await attune(p, mkBoard({}, { 0: knight.skill }))).ok).toBe(false);
  p.sp.level = 9;
  p.r.send(MSG34.CHOOSE, { what: 'spec', spec: 'knight' });
  await sleep(150);
  expect(st(p).pr.spec).toBeNull();
  p.sp.level = 20;
  p.r.send(MSG34.CHOOSE, { what: 'spec', spec: 'knight' });
  await until(() => st(p).pr.spec === 'knight');
  expect((await attune(p, mkBoard({}, { 0: knight.skill }))).ok).toBe(true);
  expect((await attune(p, mkBoard({}, { 0: 'warrior_guardian' as AbilityId }))).ok).toBe(false);
  expect(allowedAbilities('warrior', null, 'knight')).toContain(knight.skill);
  await p.r.leave();
});

it('heals only nearby living party members and earns resource only for effective support', async () => {
  const p = await field('Medic'),
    q = await spawn3(app, 'Patient'),
    stranger = await spawn3(app, 'Stranger');
  await tp(q, 205.5, 204.5);
  await tp(stranger, 204.5, 205.5);
  await choose(p, 'support');
  let invitation: any;
  q.r.onMessage(MSG34.PARTY_INVITE, (m) => (invitation = m));
  p.r.send(MSG34.PARTY, { action: 'invite', name: q.sp.name });
  await until(() => !!invitation);
  q.r.send(MSG34.PARTY, { action: 'accept', partyId: invitation.partyId });
  await until(() => p.room.social.partyMates(p.accountId).includes(q.accountId));
  p.sp.hp = p.sp.maxHp;
  q.sp.hp = 10;
  stranger.sp.hp = 10;
  p.circuit.engine.execute({ caster: p.sp, ability: 'support_1', bit: 0, hue: 3, power: 1, aimX: 1, aimY: 0 });
  expect(q.sp.hp).toBeGreaterThan(10);
  expect(stranger.sp.hp).toBe(10);
  expect(st(p).res).toBeGreaterThan(0);
  st(p).res = 0;
  st(p).lastResourceAt = 0;
  q.sp.hp = q.sp.maxHp;
  p.circuit.engine.execute({ caster: p.sp, ability: 'support_1', bit: 0, hue: 3, power: 1, aimX: 1, aimY: 0 });
  expect(st(p).res).toBe(0);
  q.sp.hp = 10;
  await tp(q, 214.5, 204.5);
  p.circuit.engine.execute({ caster: p.sp, ability: 'support_1', bit: 0, hue: 3, power: 1, aimX: 1, aimY: 0 });
  expect(q.sp.hp).toBe(10);
  await Promise.all([p.r.leave(), q.r.leave(), stranger.r.leave()]);
});
it('awards real hostile-hit resource, blocks through-wall strikes and gives each family a gated ultimate', async () => {
  const p = await field('Vanguard');
  await choose(p, 'warrior');
  const e = p.room.spawnEnemy('brute', 207.5, 204.5, false);
  p.room.store.setTile(206, 204, T.WALL);
  p.circuit.engine.execute({ caster: p.sp, ability: 'warrior_knight', bit: 0, hue: 2, power: 1, aimX: 1, aimY: 0 });
  expect(e.hp).toBe(e.maxHp);
  expect(st(p).res).toBe(0);
  p.room.store.setTile(206, 204, T.GRASS);
  p.room.hitEnemy(e, 10, p.sp, 1, 0, 0);
  expect(st(p).res).toBeGreaterThan(0);
  const passive = p.room.spawnEnemy('rabbit', 205.5, 204.5, false);
  st(p).lastResourceAt = 0;
  const resource = st(p).res;
  p.room.hitEnemy(passive, 1, p.sp, 1, 0, 0);
  expect(st(p).res).toBe(resource);
  for (const cls of ['warrior', 'ranged', 'mage', 'stealth', 'support', 'hybrid'] as const) {
    await choose(p, cls);
    const s = st(p);
    s.res = 100;
    s.cd.clear();
    p.sp.level = 14;
    const n = p.casts.length;
    p.r.send(MSG34.ULT, { aimX: 1, aimY: 0 });
    await until(() => p.casts.length > n);
    expect(p.casts.at(-1)?.ok).toBe(false);
    expect(s.res).toBe(100);
    p.sp.level = 20;
    const n2 = p.casts.length;
    p.r.send(MSG34.ULT, { aimX: 1, aimY: 0 });
    await until(() => p.casts.length > n2);
    expect(p.casts.at(-1)?.ok).toBe(true);
    expect(s.res).toBe(0);
    expect(s.cd.has('ult')).toBe(true);
  }
  await p.r.leave();
});
