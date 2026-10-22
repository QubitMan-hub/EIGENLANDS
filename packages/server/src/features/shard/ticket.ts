import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Carry } from '../types';

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const TTL_MS = 60_000;

/** A short-lived signed note that lets the next shard restore cooldowns and resources after a handoff. */
export function signTicket(accountId: string, shard: string, carry: Carry, secret: string, now = Date.now()): string {
  const body = b64(JSON.stringify({ a: accountId, s: shard, c: carry, exp: now + TTL_MS }));
  return `${body}.${b64(createHmac('sha256', `ticket:${secret}`).update(body).digest())}`;
}

export function verifyTicket(ticket: unknown, accountId: string, shard: string, secret: string, now = Date.now()): Carry | null {
  if (typeof ticket !== 'string' || ticket.length > 4096) return null;
  const [body, sig] = ticket.split('.');
  if (!body || !sig) return null;
  const expect = createHmac('sha256', `ticket:${secret}`).update(body).digest();
  let got: Buffer;
  try { got = Buffer.from(sig, 'base64url'); } catch { return null; }
  if (got.length !== expect.length || !timingSafeEqual(got, expect)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { a?: string; s?: string; c?: Carry; exp?: number };
    if (p.a !== accountId || p.s !== shard || typeof p.exp !== 'number' || p.exp < now || !p.c || typeof p.c !== 'object') return null;
    const out: Carry = {};
    if (p.c.cd && typeof p.c.cd === 'object') {
      out.cd = {};
      for (const [k, v] of Object.entries(p.c.cd)) if (typeof v === 'number' && v > 0 && v < 600_000) out.cd[k] = v;
    }
    if (typeof p.c.res === 'number' && Number.isFinite(p.c.res)) out.res = p.c.res;
    return out;
  } catch { return null; }
}
