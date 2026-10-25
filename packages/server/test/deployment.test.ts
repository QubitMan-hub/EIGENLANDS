import { usesMemoryStore } from './memory-store';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type pg from 'pg';
import type { App } from '../src/app';
import { httpUrl, resetDb, startApp } from './helpers';
let app: App;
beforeAll(async () => {
  await resetDb();
  app = await startApp();
});
afterAll(async () => app?.close());
it.skipIf(usesMemoryStore)(
  'separates database readiness from process liveness and recovers after an outage',
  async () => {
    expect((await fetch(`${httpUrl(app)}/readyz`)).status).toBe(200);
    const pool = (app.repo as unknown as { pool: pg.Pool }).pool,
      query = pool.query;
    pool.query = (() => Promise.reject(new Error('offline'))) as typeof pool.query;
    try {
      expect((await fetch(`${httpUrl(app)}/readyz`)).status).toBe(503);
      expect((await fetch(`${httpUrl(app)}/healthz`)).status).toBe(200);
    } finally {
      pool.query = query;
    }
    expect((await fetch(`${httpUrl(app)}/readyz`)).status).toBe(200);
  },
);
it('ignores forwarded IPs by default and trusts exactly one private ingress when enabled', async () => {
  for (const trustProxy of [false, true]) {
    const strict = await startApp({ config: { trustProxy, authRatePerSec: 0, authBurst: 1 } });
    try {
      const call = (ip: string) => fetch(`${httpUrl(strict)}/api/auth/config`, { headers: { 'x-forwarded-for': ip } });
      expect((await call('203.0.113.1')).status).toBe(200);
      expect((await call('203.0.113.2')).status).toBe(trustProxy ? 200 : 429);
      expect((await call('192.0.2.50, 203.0.113.2')).status).toBe(429);
    } finally {
      await strict.close();
    }
  }
});
