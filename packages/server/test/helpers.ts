import { Client, type Room } from 'colyseus.js';
import { MSG, TICK_MS, type InputCmd } from '@eigenlands/shared';
import { createApp, type App, type AppOptions } from '../src/app';
import { createPool } from '../src/db/pool';
import { migrate } from '../src/db/migrate';
import { signToken } from '../src/auth/token';

/** Parallel workers set TEST_DB_URL so they never truncate each other's tables. */
export const TEST_DB = process.env.TEST_DB_URL ?? 'postgres://eigen:eigen@localhost:5432/eigenlands_test';

export async function resetDb(): Promise<void> {
  const pool = createPool(TEST_DB);
  await migrate(pool);
  await pool.query('TRUNCATE accounts, characters, chunk_diffs CASCADE');
  await pool.end();
}

export async function startApp(o: AppOptions = {}): Promise<App> {
  return createApp({
    ambientSpawns: false,
    ...o,
    config: { port: 0, databaseUrl: TEST_DB, redisUrl: 'redis://localhost:6379', autosaveMs: 200, authRatePerSec: 1000, authBurst: 1000, ...o.config },
  });
}

export const wsUrl = (app: App) => `ws://localhost:${app.port}`;
export const httpUrl = (app: App) => `http://localhost:${app.port}`;

export async function guest(app: App, deviceSecret?: string) {
  const r = await fetch(`${httpUrl(app)}/api/auth/guest`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deviceSecret }),
  });
  return (await r.json()) as { token: string; deviceSecret: string; accountId: string };
}

let lastId = '';
export const lastRoomId = () => lastId;
export async function join(app: App, token: string, name?: string): Promise<Room<any>> {
  const client = new Client(wsUrl(app));
  const r = await client.joinOrCreate('world', { token, name });
  lastId = r.roomId;
  return r;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function until(cond: () => boolean, ms = 3000, step = 20): Promise<void> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timeout waiting for condition');
    await sleep(step);
  }
}

/** Sends `n` ticks of the same input at the server tick rate, returning the cmds sent. */
export async function drive(room: Room<any>, startSeq: number, n: number, base: Partial<InputCmd>): Promise<InputCmd[]> {
  const out: InputCmd[] = [];
  for (let i = 0; i < n; i++) {
    const cmd = { seq: startSeq + i, dx: 0, dy: 0, dash: false, attack: false, skill: false, aimX: 0, aimY: 0, viewTick: 0, ...base } as InputCmd;
    out.push(cmd);
    room.send(MSG.INPUT, { cmds: [cmd] });
    await sleep(TICK_MS);
  }
  return out;
}

export { signToken };
export function me(room: Room<any>): any {
  return (room.state as any)?.players?.get(room.sessionId);
}
