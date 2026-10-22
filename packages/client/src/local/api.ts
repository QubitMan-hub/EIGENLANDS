/**
 * The game server's HTTP API (server/src/auth/routes.ts and p34/shard/routes.ts) answered in the page for solo builds.
 * Guest accounts only; tokens are signed and checked with the server's own token code (HMAC via the crypto shim).
 */
import { shardAt } from '@eigenlands/shared';
import { signToken, verifyToken } from '../../../server/src/auth/token';
import { getHost, type LocalHost } from './host';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function authed(h: LocalHost, headers: Headers): Promise<string | null> {
  const a = headers.get('authorization') ?? '';
  const id = verifyToken(a.startsWith('Bearer ') ? a.slice(7) : '', h.config.sessionSecret);
  return id && (await h.repo.getAccount(id)) ? id : null;
}

export async function localFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const path = new URL(input, location.href).pathname.replace(/^.*?(\/api\/)/, '$1');
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  let body: Record<string, unknown> = {};
  try { body = init.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {}; } catch { return json(400, { error: 'bad request' }); }
  const h = await getHost();
  try {
    if (path === '/api/auth/config' && method === 'GET') return json(200, { googleClientId: null, solo: true });
    if (path === '/api/auth/guest' && method === 'POST') {
      const secret = typeof body.deviceSecret === 'string' ? body.deviceSecret : undefined;
      const { account, deviceSecret } = await h.repo.guestLogin(secret);
      return json(200, { token: signToken(account.id, h.config.sessionSecret), deviceSecret, accountId: account.id, guest: true });
    }
    if (path === '/api/auth/google') return json(503, { error: 'google sign-in not configured' });
    if (path === '/api/auth/me' && method === 'GET') {
      const id = await authed(h, headers);
      if (!id) return json(401, { error: 'unauthorized' });
      const account = (await h.repo.getAccount(id))!;
      const ch = await h.repo.getCharacter(id);
      return json(200, { account, character: ch && { name: ch.name, level: ch.level, xp: ch.xp } });
    }
    if (path === '/api/auth/account' && method === 'DELETE') {
      const id = await authed(h, headers);
      if (!id) return json(401, { error: 'unauthorized' });
      // single player: the whole world is this player's data
      await h.wipe();
      return json(200, { deleted: true });
    }
    if (path === '/api/shard' && method === 'GET') {
      const id = await authed(h, headers);
      if (!id) return json(401, { error: 'unauthorized' });
      const ch = await h.repo.getCharacter(id);
      return json(200, { shard: ch ? shardAt(ch.x, ch.y) : '0,0' });
    }
    return json(404, { error: 'not found' });
  } catch (e) {
    console.error(e);
    return json(500, { error: 'server error' });
  }
}
