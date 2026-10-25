import { Router, json } from 'express';
import type { RepoStore } from '../db/repo';
import type { GoogleVerifier } from './google';
import { signToken, verifyToken } from './token';
import { KeyedLimiter } from '../rate';

export interface AuthDeps {
  repo: RepoStore;
  secret: string;
  googleVerify: GoogleVerifier | null;
  googleClientId: string | null;
  ratePerSec: number;
  burst: number;
}

export function authRouter(d: AuthDeps): Router {
  const r = Router();
  r.use(json({ limit: '8kb' }));
  const limiter = new KeyedLimiter(d.ratePerSec, d.burst);
  r.use((req, res, next) => {
    if (!limiter.allow(req.ip ?? 'unknown')) {
      res.status(429).json({ error: 'slow down' });
      return;
    }
    next();
  });

  r.get('/config', (_req, res) => res.json({ googleClientId: d.googleClientId }));

  r.post('/guest', async (req, res) => {
    try {
      const secret = typeof req.body?.deviceSecret === 'string' ? req.body.deviceSecret : undefined;
      const { account, deviceSecret } = await d.repo.guestLogin(secret);
      res.json({ token: signToken(account.id, d.secret), deviceSecret, accountId: account.id, guest: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'server error' });
    }
  });

  r.post('/google', async (req, res) => {
    if (!d.googleVerify) {
      res.status(503).json({ error: 'google sign-in not configured' });
      return;
    }
    const idToken = req.body?.idToken;
    if (typeof idToken !== 'string' || idToken.length > 4096) {
      res.status(400).json({ error: 'bad request' });
      return;
    }
    try {
      const id = await d.googleVerify(idToken);
      const secret = typeof req.body?.deviceSecret === 'string' ? req.body.deviceSecret : undefined;
      const { account, upgraded } = await d.repo.googleLogin(id.sub, id.email, secret);
      res.json({ token: signToken(account.id, d.secret), accountId: account.id, guest: false, upgraded });
    } catch {
      res.status(401).json({ error: 'invalid google token' });
    }
  });

  const authed = async (req: any, res: any): Promise<string | null> => {
    const h = String(req.headers.authorization ?? '');
    const id = verifyToken(h.startsWith('Bearer ') ? h.slice(7) : '', d.secret);
    if (!id || !(await d.repo.getAccount(id))) {
      res.status(401).json({ error: 'unauthorized' });
      return null;
    }
    return id;
  };

  r.get('/me', async (req, res) => {
    const id = await authed(req, res);
    if (!id) return;
    const account = (await d.repo.getAccount(id))!;
    const ch = await d.repo.getCharacter(id);
    res.json({ account, character: ch && { name: ch.name, level: ch.level, xp: ch.xp } });
  });

  r.delete('/account', async (req, res) => {
    const id = await authed(req, res);
    if (!id) return;
    await d.repo.deleteAccount(id);
    res.json({ deleted: true });
  });

  return r;
}
