import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MSG34, PARTY_MAX } from '@eigenlands/shared';
import type { App } from '../src/app';
import { OFFLINE_KEEP_MS, normalizeParty, type PartyRec } from '../src/features/social/party';
import { bootP4, hasSys, joinP4, lastParty, partyUp, sleep, until, waitSys, type P4 } from './p4helpers';

let app: App;
beforeAll(async () => { app = await bootP4(); });
afterAll(async () => { await app?.close(); });

const leave = async (...ps: P4[]) => { for (const p of ps) await p.r.leave().catch(() => {}); await sleep(80); };

describe('party rules (pure)', () => {
  const rec = (members: Array<[string, number]>, leader = members[0]![0]): PartyRec => ({
    id: 'pt_0123456789abcdef', v: 1, leader,
    members: members.map(([a, off]) => ({ accountId: a, name: a, level: 1, cls: 'wanderer', offlineSince: off })),
  });
  it('drops long-offline members, disbands below two, hands leadership to an online member', () => {
    const now = 10_000_000;
    expect(normalizeParty(rec([['a', 0], ['b', 0]]), now)?.leader).toBe('a');
    expect(normalizeParty(rec([['a', now - 1000], ['b', 0], ['c', 0]]), now)?.leader).toBe('b');
    expect(normalizeParty(rec([['a', now - 1000], ['b', now - 500]]), now)?.leader).toBe('a'); // nobody online: keep
    expect(normalizeParty(rec([['a', 0], ['b', now - OFFLINE_KEEP_MS - 1]]), now)).toBeNull();
    const r = normalizeParty(rec([['a', 0], ['b', now - OFFLINE_KEEP_MS - 1], ['c', 0]]), now)!;
    expect(r.members.map((m) => m.accountId)).toEqual(['a', 'c']);
  });
});

describe('parties', () => {
  it('invite by name, accept: both get PARTY_STATE, nameplates carry the party id', async () => {
    const a = await joinP4(app, 'Ada'), b = await joinP4(app, 'Bix');
    const id = await partyUp(a, b);
    await until(() => lastParty(a)?.id === id && lastParty(a)?.members?.length === 2 && lastParty(b)?.id === id);
    const st = lastParty(b)!;
    expect(st.leader).toBe(a.accountId);
    const meInB = st.members!.find((m) => m.accountId === b.accountId)!;
    expect(meInB.sid).toBe(b.r.sessionId);
    expect(meInB.online).toBe(true);
    expect(meInB.maxHp).toBeGreaterThan(0);
    expect(st.members!.find((m) => m.accountId === a.accountId)!.name).toBe('Ada');
    expect(hasSys(a, /Invited Bix/)).toBe(true);
    await until(() => a.sp.state.party === id && b.sp.state.party === id);
    expect(a.room.social.partyMates(a.accountId)).toEqual([b.accountId]);
    await waitSys(a, /Bix joined the party/);
    await leave(a, b);
  });

  it('unknown or offline names, self-invites, duplicates and non-leaders are refused politely', async () => {
    const a = await joinP4(app, 'Cato'), b = await joinP4(app, 'Dree'), c = await joinP4(app, 'Eno');
    a.r.send(MSG34.PARTY, { action: 'invite', name: 'Nobody Here' });
    await waitSys(a, /Nobody Here is not online/);
    a.r.send(MSG34.PARTY, { action: 'invite', name: 'cato' });
    await waitSys(a, /can't invite yourself/);
    await partyUp(a, b);
    a.r.send(MSG34.PARTY, { action: 'invite', name: 'Dree' });
    await waitSys(a, /already in your party/);
    b.r.send(MSG34.PARTY, { action: 'invite', name: 'Eno' });
    await waitSys(b, /Only the party leader can invite/);
    c.r.send(MSG34.PARTY, { action: 'invite', name: 'Dree' });
    await waitSys(c, /already in a party/);
    await leave(a, b, c);
  });

  it('decline tells the inviter; expired and forged invites do nothing', async () => {
    const a = await joinP4(app, 'Fen'), b = await joinP4(app, 'Gil');
    a.r.send(MSG34.PARTY, { action: 'invite', name: 'Gil' });
    await until(() => b.invites.length === 1);
    b.r.send(MSG34.PARTY, { action: 'decline', partyId: b.invites[0]!.partyId });
    await waitSys(a, /Gil declined your party invite/);
    // accepting a declined invite fails
    b.r.send(MSG34.PARTY, { action: 'accept', partyId: b.invites[0]!.partyId });
    await waitSys(b, /expired/);
    // expiry (60 s): age the stored invite
    a.r.send(MSG34.PARTY, { action: 'invite', name: 'Gil' });
    await until(() => b.invites.length === 2);
    const hub = a.room.social.hub;
    for (const inv of hub.invites.get(b.accountId)?.values() ?? []) inv.exp = Date.now() - 1;
    b.chat.length = 0;
    b.r.send(MSG34.PARTY, { action: 'accept', partyId: b.invites[1]!.partyId });
    await waitSys(b, /expired/);
    // a forged party id
    b.r.send(MSG34.PARTY, { action: 'accept', partyId: 'pt_ffffffffffffffff' });
    await sleep(100);
    expect(a.room.social.partyOf(b.accountId)).toBe('');
    await leave(a, b);
  });

  it(`at most ${PARTY_MAX} members; kick and promote are leader-only`, async () => {
    const names = ['Hal', 'Ivo', 'Jun', 'Kai', 'Lux', 'Moe'];
    const ps: P4[] = [];
    for (const n of names) ps.push(await joinP4(app, n));
    const [lead, ...rest] = ps;
    for (const p of rest.slice(0, PARTY_MAX - 1)) await partyUp(lead!, p);
    const id = lead!.room.social.partyOf(lead!.accountId);
    expect(lead!.room.social.hub.parties.get(id)!.members.length).toBe(PARTY_MAX);
    lead!.r.send(MSG34.PARTY, { action: 'invite', name: 'Moe' });
    await waitSys(lead!, /party is full/);

    const [ivo, jun] = [rest[0]!, rest[1]!];
    ivo.r.send(MSG34.PARTY, { action: 'kick', accountId: jun.accountId });
    await waitSys(ivo, /Only the party leader can remove/);
    lead!.r.send(MSG34.PARTY, { action: 'kick', accountId: jun.accountId });
    await until(() => lead!.room.social.partyOf(jun.accountId) === '');
    await waitSys(jun, /removed from the party/);
    await until(() => lastParty(jun)?.id === null);

    ivo.r.send(MSG34.PARTY, { action: 'promote', accountId: ivo.accountId });
    lead!.r.send(MSG34.PARTY, { action: 'promote', accountId: ivo.accountId });
    await until(() => lead!.room.social.hub.parties.get(id)!.leader === ivo.accountId);
    await until(() => lastParty(lead!)?.leader === ivo.accountId);
    // the old leader can no longer kick
    lead!.r.send(MSG34.PARTY, { action: 'kick', accountId: ivo.accountId });
    await waitSys(lead!, /Only the party leader/);
    await leave(...ps);
  });

  it('leaving a two-person party disbands it', async () => {
    const a = await joinP4(app, 'Nia'), b = await joinP4(app, 'Oto');
    const id = await partyUp(a, b);
    b.r.send(MSG34.PARTY, { action: 'leave' });
    await until(() => !a.room.social.hub.parties.get(id));
    await until(() => lastParty(a)?.id === null && lastParty(b)?.id === null);
    await waitSys(a, /disbanded/);
    expect(a.sp.state.party === '' || (await until(() => a.sp.state.party === '').then(() => true))).toBe(true);
    await leave(a, b);
  });

  it('leader disconnect hands leadership over; the leader stays listed as offline, then returns', async () => {
    const a = await joinP4(app, 'Pim'), b = await joinP4(app, 'Quo'), c = await joinP4(app, 'Rae');
    const id = await partyUp(a, b);
    await partyUp(a, c);
    const creds = { token: a.token, accountId: a.accountId };
    await a.r.leave();
    const hub = b.room.social.hub;
    await until(() => hub.parties.get(id)?.leader === b.accountId);
    await until(() => lastParty(b)?.members?.find((m) => m.accountId === a.accountId)?.online === false);
    expect(lastParty(b)!.members!.length).toBe(3);
    // back online: listed online again, no longer leader
    const a2 = await joinP4(app, 'Pim', { creds });
    await until(() => lastParty(a2)?.id === id);
    await until(() => lastParty(b)?.members?.find((m) => m.accountId === a.accountId)?.online === true);
    expect(hub.parties.get(id)!.leader).toBe(b.accountId);
    // offline for more than 5 minutes: dropped
    await c.r.leave();
    await until(() => hub.parties.get(id)!.members.find((m) => m.accountId === c.accountId)!.offlineSince > 0);
    await hub.parties.sweep(hub.parties.get(id)!, Date.now() + OFFLINE_KEEP_MS + 1000, () => Date.now() + OFFLINE_KEEP_MS);
    await until(() => !hub.parties.get(id)?.members.some((m) => m.accountId === c.accountId));
    await leave(a2, b);
  });

  it('cross-shard: invite reaches a player on another shard; frames carry shard, HP and position at ~2 Hz', async () => {
    const a = await joinP4(app, 'Sol', { shard: '0,0', pos: [2.5, 4.5] });
    const b = await joinP4(app, 'Tam', { shard: '1,0', pos: [145.5, 3.5] });
    expect(a.room).not.toBe(b.room);
    expect(b.room.shard).toBe('1,0');
    const id = await partyUp(a, b);
    await until(() => {
      const m = lastParty(a)?.members?.find((x) => x.accountId === b.accountId);
      return !!m && m.shard === '1,0' && m.online && Math.abs(m.x - 145.5) < 0.6;
    }, 4000);
    const inA = lastParty(a)!;
    expect(inA.id).toBe(id);
    const bInA = inA.members!.find((x) => x.accountId === b.accountId)!;
    expect(bInA.sid).toBe(''); // not on A's shard
    expect(bInA.maxHp).toBeGreaterThan(0);
    expect(inA.members!.find((x) => x.accountId === a.accountId)!.sid).toBe(a.r.sessionId);
    // frames keep coming while nothing changes
    const n = a.party.length;
    await sleep(1200);
    expect(a.party.length - n).toBeGreaterThanOrEqual(2);
    // live HP updates cross the shard border
    b.sp.hp = 7;
    await until(() => lastParty(a)?.members?.find((x) => x.accountId === b.accountId)?.hp === 7, 3000);
    // party chat reaches across shards too
    b.r.send(MSG34.CHAT, { ch: 'party', text: 'hello from region one' });
    await until(() => a.chat.some((c) => c.ch === 'party' && c.text === 'hello from region one' && c.from === 'Tam'));
    await leave(a, b);
  });

  it('shared XP: members within 30 tiles of the kill get +50%; others get nothing', async () => {
    const a = await joinP4(app, 'Uma'), b = await joinP4(app, 'Vex'), c = await joinP4(app, 'Wyn'), far = await joinP4(app, 'Xan');
    await partyUp(a, b);
    await partyUp(a, far);
    for (const p of [a, b, c, far]) { p.sp.level = 5; p.sp.xp = 0; }
    far.sp.sim.x = 300; far.sp.sim.y = 300;
    const e = a.room.spawnEnemy('slime', a.sp.sim.x + 1, a.sp.sim.y, false);
    a.room.hitEnemy(e, 9999, a.sp, 1, 0, 0);
    expect(a.sp.xp).toBe(10);
    expect(b.sp.xp).toBe(5);
    expect(c.sp.xp).toBe(0);
    expect(far.sp.xp).toBe(0);
    await leave(a, b, c, far);
  });

  it('junk party payloads never crash the room', async () => {
    const a = await joinP4(app, 'Yul');
    const junk: any[] = [null, 1, 'x', [], {}, { action: 'invite' }, { action: 'invite', name: 5 }, { action: 'invite', name: 'x'.repeat(500) },
      { action: 'accept' }, { action: 'accept', partyId: { a: 1 } }, { action: 'kick', accountId: ['x'] }, { action: 'promote', accountId: null },
      { action: '__proto__' }, { action: 'leave', extra: 1 }];
    for (const m of junk) a.r.send(MSG34.PARTY, m);
    await sleep(300);
    expect(a.room.players.has(a.r.sessionId)).toBe(true);
    await leave(a);
  });
});

describe('parties on the Redis cluster bus', () => {
  it('invite, accept and frames work with the Redis party store and directory', async () => {
    await app.close();
    app = await bootP4({ cluster: true });
    const a = await joinP4(app, 'Zed'), b = await joinP4(app, 'Abe');
    expect(a.room.social.hub.bus.kind).toBe('redis');
    const id = await partyUp(a, b);
    await until(() => lastParty(a)?.id === id && lastParty(a)?.members?.length === 2);
    b.r.send(MSG34.PARTY, { action: 'leave' });
    await until(() => lastParty(a)?.id === null);
    await leave(a, b);
  });
});
