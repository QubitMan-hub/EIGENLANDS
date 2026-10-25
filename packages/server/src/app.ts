import { createServer, type Server as HttpServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'colyseus';
import { Encoder } from '@colyseus/schema';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { JOIN_ROOM } from '@eigenlands/shared';
import { googleVerifier, type GoogleVerifier } from './auth/google';
import { authRouter } from './auth/routes';
import { loadConfig, type Config } from './config';
import { migrate } from './db/migrate';
import { createPool } from './db/pool';
import { Repo, type RepoStore } from './db/repo';
import { Presence } from './presence';
import { setRuntime } from './rooms/runtime';
import { metrics } from './rooms/WorldRoom';
import { GameRoom } from './rooms/GameRoom';
import { Repo34, type ProgressStore } from './db/repo34';
import { MemoryBus, RedisBus, type Bus } from './features/bus';
import { setRuntime34 } from './features/runtime34';
import { ShardLocks } from './features/shard/locks';
import { shardRouter } from './features/shard/routes';
import { Redis } from 'ioredis';

export interface App {
  config: Config;
  repo: RepoStore;
  presence: Presence;
  game: Server;
  http: HttpServer;
  port: number;
  close(): Promise<void>;
}

export interface AppOptions {
  /** Explicit store injection for real browser-adapter integration tests. Production always defaults to PostgreSQL. */
  storage?: { repo: RepoStore; progress: ProgressStore; ready(): Promise<void>; close(): Promise<void> };
  config?: Partial<Config>;
  googleVerify?: GoogleVerifier | null;
  ambientSpawns?: boolean;
  /** multi-process cluster: Redis bus + Redis shard locks (env CLUSTER=1) */
  cluster?: boolean;
}

// Default is 8 KB: a crowded view (dozens of players + mobs) overflows it and corrupts the stream.
Encoder.BUFFER_SIZE = 512 * 1024;

export async function createApp(opts: AppOptions = {}): Promise<App> {
  const config = { ...loadConfig(), ...opts.config };
  const storage =
    opts.storage ??
    (await (async () => {
      const pool = createPool(config.databaseUrl);
      try {
        await migrate(pool);
      } catch (error) {
        await pool.end();
        throw error;
      }
      return {
        repo: new Repo(pool),
        progress: new Repo34(pool),
        ready: async () => {
          await pool.query('SELECT 1');
        },
        close: () => pool.end(),
      };
    })());
  const repo = storage.repo;
  const presence = await Presence.connect(config.redisUrl);
  const googleVerify =
    opts.googleVerify !== undefined
      ? opts.googleVerify
      : config.googleClientId
        ? googleVerifier(config.googleClientId)
        : null;

  setRuntime({ config, repo, presence, googleVerify, ambientSpawns: opts.ambientSpawns ?? true });
  // Phase 3/4: progression/social persistence, cross-shard bus and shard ownership locks
  const cluster = (opts.cluster ?? process.env.CLUSTER === '1') && !!config.redisUrl;
  const bus: Bus = (cluster ? await RedisBus.connect(config.redisUrl!) : null) ?? new MemoryBus();
  let lockRedis: Redis | null = null;
  if (cluster && bus.kind === 'redis') {
    lockRedis = new Redis(config.redisUrl!, { maxRetriesPerRequest: 1 });
    lockRedis.on('error', () => {});
  }
  const repo34 = storage.progress;
  setRuntime34({ repo34, bus, locks: new ShardLocks(lockRedis) });

  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);
  app.use(cors({ origin: config.allowedOrigin }));
  app.get('/healthz', (_req, res) => res.json({ ok: true, redis: presence.usingRedis }));
  app.get('/readyz', async (_req, res) => {
    try {
      await storage.ready();
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });
  app.get('/metrics', (_req, res) =>
    res.json({
      ...metrics,
      tickBudgetMs: 50,
      uptimeS: Math.round(process.uptime()),
      rssMb: Math.round(process.memoryUsage().rss / 1e6),
    }),
  );
  app.use('/api/shard', shardRouter({ repo, secret: config.sessionSecret }));
  app.use(
    '/api/auth',
    authRouter({
      repo,
      secret: config.sessionSecret,
      googleVerify,
      googleClientId: config.googleClientId,
      ratePerSec: config.authRatePerSec,
      burst: config.authBurst,
    }),
  );

  const http = createServer(app);
  // main.ts owns process shutdown; a second framework exit handler can interrupt database saves.
  const game = new Server({
    transport: new WebSocketTransport({ server: http, maxPayload: 16 * 1024 }),
    greet: false,
    gracefullyShutdown: false,
  });
  game.define(JOIN_ROOM, GameRoom).filterBy(['shard']);
  await game.listen(config.port);
  const addr = http.address();
  const port = typeof addr === 'object' && addr ? addr.port : config.port;

  let closing: Promise<void> | null = null;
  return {
    config,
    repo,
    presence,
    game,
    http,
    port,
    close() {
      return (closing ??= (async () => {
        await game.gracefullyShutdown(false).catch(() => {});
        await presence.close();
        await bus.close();
        lockRedis?.disconnect();
        await storage.close().catch(() => {});
      })());
    },
  };
}
