import { createHmac, timingSafeEqual } from 'node:crypto';

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export function signToken(accountId: string, secret: string, ttlSec = 12 * 3600, now = Date.now()): string {
  const body = b64(JSON.stringify({ sub: accountId, exp: Math.floor(now / 1000) + ttlSec }));
  const sig = b64(createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}

/** Returns the account id, or null when the token is malformed, forged or expired. */
export function verifyToken(token: unknown, secret: string, now = Date.now()): string | null {
  if (typeof token !== 'string' || token.length > 512) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expect = createHmac('sha256', secret).update(body).digest();
  let got: Buffer;
  try { got = Buffer.from(sig, 'base64url'); } catch { return null; }
  if (got.length !== expect.length || !timingSafeEqual(got, expect)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { sub?: string; exp?: number };
    if (typeof p.sub !== 'string' || typeof p.exp !== 'number' || p.exp * 1000 < now) return null;
    return p.sub;
  } catch { return null; }
}
