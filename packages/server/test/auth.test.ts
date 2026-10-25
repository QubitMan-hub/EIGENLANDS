import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signToken, verifyToken } from '../src/auth/token';
import { TokenBucket } from '../src/rate';
import { sanitizeName } from '../src/rooms/WorldRoom';
import { guest, httpUrl, resetDb, startApp } from './helpers';
import type { App } from '../src/app';

describe('tokens', () => {
  it('round-trips, rejects forgeries and expiry', () => {
    const t = signToken('acc-1', 'secret', 60, 1_000_000);
    expect(verifyToken(t, 'secret', 1_000_000)).toBe('acc-1');
    expect(verifyToken(t, 'other', 1_000_000)).toBeNull();
    expect(verifyToken(t + 'x', 'secret', 1_000_000)).toBeNull();
    expect(verifyToken(t, 'secret', 1_000_000 + 61_000)).toBeNull();
    expect(verifyToken('garbage', 'secret')).toBeNull();
    expect(verifyToken(undefined, 'secret')).toBeNull();
    const [body, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'admin', exp: 9e9 })).toString('base64url');
    expect(verifyToken(`${forged}.${sig}`, 'secret')).toBeNull();
    expect(body).toBeTruthy();
  });
});

describe('rate limiting and names', () => {
  it('token bucket throttles then refills', () => {
    const b = new TokenBucket(10, 3, 0);
    expect([b.take(1, 0), b.take(1, 0), b.take(1, 0), b.take(1, 0)]).toEqual([true, true, true, false]);
    expect(b.take(1, 200)).toBe(true);
  });
  it('sanitises character names', () => {
    expect(sanitizeName('  <b>Ana</b>; DROP  ')).toBe('bAnab DROP');
    expect(sanitizeName('x'.repeat(100)).length).toBe(16);
    expect(sanitizeName(42)).toBe('');
    expect(sanitizeName('Zoë-Ann')).toBe('Zoë-Ann');
  });
});

describe('auth http api', () => {
  let app: App;
  const fakeGoogle = async (t: string) => {
    if (!t.startsWith('good:')) throw new Error('bad');
    return { sub: t.slice(5), email: 'p@example.com' };
  };
  beforeAll(async () => { await resetDb(); app = await startApp({ googleVerify: fakeGoogle }); });
  afterAll(async () => { await app?.close(); });

  const call = (path: string, init: RequestInit = {}) => fetch(`${httpUrl(app)}/api/auth${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });

  it('creates a guest and recognises the device secret again', async () => {
    const a = await guest(app);
    expect(a.token).toBeTruthy();
    const b = await guest(app, a.deviceSecret);
    expect(b.accountId).toBe(a.accountId);
    const c = await guest(app);
    expect(c.accountId).not.toBe(a.accountId);
  });

  it('upgrades a guest to a Google account keeping the same account id', async () => {
    const g = await guest(app);
    const r = await call('/google', { method: 'POST', body: JSON.stringify({ idToken: 'good:sub-123', deviceSecret: g.deviceSecret }) });
    const j = await r.json() as any;
    expect(r.status).toBe(200);
    expect(j.upgraded).toBe(true);
    expect(j.accountId).toBe(g.accountId);
    // later sign-in from a fresh device resolves to the same account
    const again = await (await call('/google', { method: 'POST', body: JSON.stringify({ idToken: 'good:sub-123' }) })).json() as any;
    expect(again.accountId).toBe(g.accountId);
    // the old device secret no longer works as a guest login for that account
    const stale = await guest(app, g.deviceSecret);
    expect(stale.accountId).not.toBe(g.accountId);
  });

  it('rejects bad google tokens and unauthenticated calls', async () => {
    expect((await call('/google', { method: 'POST', body: JSON.stringify({ idToken: 'evil' }) })).status).toBe(401);
    expect((await call('/google', { method: 'POST', body: JSON.stringify({}) })).status).toBe(400);
    expect((await call('/me')).status).toBe(401);
    expect((await call('/me', { headers: { authorization: 'Bearer nope' } })).status).toBe(401);
  });

  it('deletes an account and its data', async () => {
    const g = await guest(app);
    const h = { authorization: `Bearer ${g.token}` };
    expect((await call('/me', { headers: h })).status).toBe(200);
    expect((await call('/account', { method: 'DELETE', headers: h })).status).toBe(200);
    expect((await call('/me', { headers: h })).status).toBe(401);
  });

  it('rate limits floods', async () => {
    const strict = await startApp({ config: { authRatePerSec: 1, authBurst: 5 } });
    let limited = false;
    for (let i = 0; i < 40; i++) {
      if ((await fetch(`${httpUrl(strict)}/api/auth/config`)).status === 429) { limited = true; break; }
    }
    await strict.close();
    expect(limited).toBe(true);
  });
});
