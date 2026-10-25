import { Router } from 'express';
import { shardAt } from '@eigenlands/shared';
import type { RepoStore } from '../../db/repo';
import { verifyToken } from '../../auth/token';

/** GET /api/shard (Bearer token): which shard the character should join. New characters start at spawn. */
export function shardRouter(d: { repo: RepoStore; secret: string }): Router {
  const r = Router();
  r.get('/', async (req, res) => {
    const id = verifyToken((req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''), d.secret);
    if (!id) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    try {
      const ch = await d.repo.getCharacter(id);
      res.json({ shard: ch ? shardAt(ch.x, ch.y) : '0,0' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'server error' });
    }
  });
  return r;
}
