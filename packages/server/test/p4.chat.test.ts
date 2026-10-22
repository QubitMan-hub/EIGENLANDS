import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CHAT_MAX, MSG34 } from '@eigenlands/shared';
import type { App } from '../src/app';
import { runtime34 } from '../src/features/runtime34';
import { TokenBucket } from '../src/rate';
import { bootP4, hasSys, joinP4, partyUp, relaxP4, sleep, until, waitSys, type P4 } from './p4helpers';

let app: App;
beforeAll(async () => { app = await bootP4(); });
afterAll(async () => { await app.close(); });

const leave = async (...ps: P4[]) => { for (const p of ps) await p.r.leave().catch(() => {}); await sleep(80); };
const said = (p: P4, ch: string, text: string) => p.chat.some((c) => c.ch === ch && c.text === text);

describe('chat channels', () => {
  it('local reaches players within range on the same shard only', async () => {
    const a = await joinP4(app, 'Lea'), near = await joinP4(app, 'Nim'), far = await joinP4(app, 'Fay');
    far.sp.sim.x = a.sp.sim.x + 60;
    a.r.send(MSG34.CHAT, { ch: 'local', text: 'hi neighbours' });
    await until(() => said(near, 'local', 'hi neighbours') && said(a, 'local', 'hi neighbours'));
    await sleep(150);
    expect(said(far, 'local', 'hi neighbours')).toBe(false);
    const m = near.chat.find((c) => c.text === 'hi neighbours')!;
    expect(m.from).toBe('Lea');
    expect(m.fromId).toBe(a.accountId);
    expect(m.t).toBeGreaterThan(0);
    await leave(a, near, far);
  });

  it('global reaches every shard; whispers reach any shard by name; offline names get a reply', async () => {
    const a = await joinP4(app, 'Glo', { shard: '0,0', pos: [1.5, 1.5] });
    const b = await joinP4(app, 'Bor', { shard: '1,0', pos: [210.5, 1.5] });
    a.r.send(MSG34.CHAT, { ch: 'global', text: 'hello world' });
    await until(() => said(b, 'global', 'hello world') && said(a, 'global', 'hello world'));
    a.r.send(MSG34.CHAT, { ch: 'whisper', to: 'bor', text: 'psst' });
    await until(() => b.chat.some((c) => c.ch === 'whisper' && c.text === 'psst' && c.from === 'Glo'));
    const echo = a.chat.find((c) => c.ch === 'whisper' && c.text === 'psst')!;
    expect(echo.to).toBe('Bor');
    a.r.send(MSG34.CHAT, { ch: 'whisper', to: 'Ghost Person', text: 'anyone?' });
    await waitSys(a, /Ghost Person is not online/);
    a.r.send(MSG34.CHAT, { ch: 'whisper', to: 'Glo', text: 'me' });
    await waitSys(a, /yourself/);
    // a fresh session replays recent global chat; a shard handoff would not
    const c = await joinP4(app, 'Cy', { shard: '0,0', pos: [3.5, 1.5] });
    expect(said(c, 'global', 'hello world')).toBe(true);
    await leave(a, b, c);
  });

  it('party chat reaches only party members; outside a party it explains how to make one', async () => {
    const a = await joinP4(app, 'Pa'), b = await joinP4(app, 'Pb'), c = await joinP4(app, 'Pc');
    c.r.send(MSG34.CHAT, { ch: 'party', text: 'lonely' });
    await waitSys(c, /not in a party/);
    await partyUp(a, b);
    a.r.send(MSG34.CHAT, { ch: 'party', text: 'team plan' });
    await until(() => said(b, 'party', 'team plan') && said(a, 'party', 'team plan'));
    await sleep(150);
    expect(said(c, 'party', 'team plan')).toBe(false);
    await leave(a, b, c);
  });
});

describe('moderation', () => {
  it('filters profanity, clamps length, drops empty and spam, suppresses repeats', async () => {
    const a = await joinP4(app, 'Mo'), b = await joinP4(app, 'Mi');
    a.r.send(MSG34.CHAT, { ch: 'local', text: 'what the fuck' });
    await until(() => b.chat.some((c) => c.text.startsWith('what the ')));
    expect(b.chat.find((c) => c.text.startsWith('what the '))!.text).toBe('what the ****');
    a.r.send(MSG34.CHAT, { ch: 'local', text: 'long story '.repeat(60) });
    await until(() => b.chat.some((c) => c.text.startsWith('long story')));
    expect(b.chat.find((c) => c.text.startsWith('long story'))!.text.length).toBeLessThanOrEqual(CHAT_MAX);
    a.r.send(MSG34.CHAT, { ch: 'local', text: '   \u0000\u0007  ' });
    a.r.send(MSG34.CHAT, { ch: 'local', text: 'aaaaaaaaaaaaaaaaaaaa' });
    await waitSys(a, /spam/);
    a.r.send(MSG34.CHAT, { ch: 'local', text: 'buy my stuff' });
    await until(() => said(b, 'local', 'buy my stuff'));
    a.r.send(MSG34.CHAT, { ch: 'local', text: 'BUY MY STUFF!!' });
    await waitSys(a, /You just said that/);
    await sleep(100);
    expect(b.chat.filter((c) => /buy my stuff/i.test(c.text)).length).toBe(1);
    await leave(a, b);
  });

  it('per-channel token buckets: local bursts then slows; global allows one per 3 s', async () => {
    const a = await joinP4(app, 'Rat');
    const lim = a.room.social.hub.limitsOf(a.accountId);
    lim.buckets = { local: new TokenBucket(2, 4), global: new TokenBucket(1 / 3, 1), party: new TokenBucket(2, 4), whisper: new TokenBucket(2, 4) };
    for (let i = 0; i < 10; i++) a.r.send(MSG34.CHAT, { ch: 'local', text: `line number ${i} ${'abcdefghij'[i]}` });
    await sleep(400);
    const got = a.chat.filter((c) => c.ch === 'local').length;
    expect(got).toBeGreaterThanOrEqual(4);
    expect(got).toBeLessThanOrEqual(5);
    expect(hasSys(a, /too fast/)).toBe(true);
    await sleep(1600);
    a.r.send(MSG34.CHAT, { ch: 'global', text: 'first global' });
    await until(() => said(a, 'global', 'first global'));
    a.r.send(MSG34.CHAT, { ch: 'global', text: 'second global' });
    await waitSys(a, /one message every 3 seconds/);
    expect(said(a, 'global', 'second global')).toBe(false);
    // the limit is kept per account: the room bucket cannot be dodged by re-joining
    expect(a.room.social.hub.limitsOf(a.accountId)).toBe(lim);
    await leave(a);
  });

  it('the admin mute flag (account_flags.muted_until) silences every channel', async () => {
    const a = await joinP4(app, 'Shh');
    await runtime34().repo34.setMute(a.accountId, new Date(Date.now() + 10 * 60_000));
    const creds = { token: a.token, accountId: a.accountId };
    await a.r.leave();
    await sleep(100);
    const a2 = await joinP4(app, 'Shh', { creds });
    await until(() => a2.room.social.hub.limitsOf(a2.accountId).mutedUntil > Date.now());
    for (const ch of ['local', 'global', 'party']) a2.r.send(MSG34.CHAT, { ch, text: `muted ${ch}` });
    await waitSys(a2, /You are muted for 10 more minutes/);
    await sleep(200);
    expect(a2.chat.some((c) => c.text.startsWith('muted '))).toBe(false);
    await runtime34().repo34.setMute(a.accountId, null);
    await leave(a2);
  });

  it('/report stores the report with the recent chat as context', async () => {
    const a = await joinP4(app, 'Rep'), b = await joinP4(app, 'Rude');
    for (let i = 0; i < 12; i++) b.r.send(MSG34.CHAT, { ch: 'local', text: `rude line ${i} ${'abcdefghijkl'[i]}` });
    await until(() => a.chat.filter((c) => c.from === 'Rude').length === 12);
    a.r.send(MSG34.REPORT, { name: 'rude', reason: 'being rude\u0000 to everyone' });
    await waitSys(a, /report about Rude was sent/);
    const r = await runtime34().repo34.pool.query('SELECT * FROM chat_reports WHERE reporter = $1', [a.accountId]);
    expect(r.rows.length).toBe(1);
    expect(r.rows[0].target).toBe(b.accountId);
    expect(r.rows[0].target_name).toBe('Rude');
    expect(r.rows[0].reason).toBe('being rude  to everyone');
    expect(r.rows[0].context.length).toBe(10);
    expect(r.rows[0].context[9].text).toBe('rude line 11 l');
    // report spam is limited
    for (let i = 0; i < 5; i++) a.r.send(MSG34.REPORT, { name: 'Rude', reason: `again ${i}` });
    await sleep(500);
    const r2 = await runtime34().repo34.pool.query('SELECT count(*)::int AS n FROM chat_reports WHERE reporter = $1', [a.accountId]);
    expect(r2.rows[0].n).toBe(3);
    await leave(a, b);
  });
});

describe('emotes', () => {
  it('broadcast to nearby players, validated and rate limited', async () => {
    const a = await joinP4(app, 'Emo'), b = await joinP4(app, 'Eve'), far = await joinP4(app, 'Efa');
    far.sp.sim.x += 100;
    a.r.send(MSG34.EMOTE, { e: 'wave' });
    await until(() => b.emotes.some((e) => e.id === a.r.sessionId && e.e === 'wave') && a.emotes.length === 1);
    a.r.send(MSG34.EMOTE, { e: 'dance' }); // too soon after the last one
    a.r.send(MSG34.EMOTE, { e: 'explode' });
    a.r.send(MSG34.EMOTE, { e: '__proto__' });
    await sleep(300);
    expect(b.emotes.length).toBe(1);
    expect(far.emotes.length).toBe(0);
    await sleep(500);
    a.r.send(MSG34.EMOTE, { e: 'cheer' });
    await until(() => b.emotes.length === 2);
    await leave(a, b, far);
  });
});

describe('robustness', () => {
  it('junk chat, report and emote payloads never crash the room', async () => {
    const a = await joinP4(app, 'Junk');
    relaxP4(a);
    const junk: any[] = [null, 0, 'x', [], {}, { ch: 'system', text: 'fake system' }, { ch: 'local' }, { ch: 'local', text: 42 },
      { ch: 'whisper', text: 'hi' }, { ch: 'whisper', to: { x: 1 }, text: 'hi' }, { ch: 'party', text: ['a'] }, { ch: '__proto__', text: 'x' },
      { ch: 'local', text: '‮​hidden' }, { name: null }, { name: 'x', reason: { a: 1 } }, { e: null }, { e: 7 }];
    for (const m of junk) { a.r.send(MSG34.CHAT, m); a.r.send(MSG34.REPORT, m); a.r.send(MSG34.EMOTE, m); }
    await sleep(400);
    expect(a.room.players.has(a.r.sessionId)).toBe(true);
    expect(a.chat.some((c) => c.text === 'fake system')).toBe(false);
    a.r.send(MSG34.CHAT, { ch: 'local', text: 'still alive' });
    await until(() => said(a, 'local', 'still alive'));
    await leave(a);
  });
});
