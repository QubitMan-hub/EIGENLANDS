import { createServer, type Server as HttpServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { JOIN_ROOM } from '@eigenlands/shared';
import { googleVerifier, type GoogleVerifier } from './auth/google';
import { authRouter } from './auth/routes';
import { loadConfig, type Config } from './config';
import { migrate } from './db/migrate';
import { createPool } from './db/pool';
import { Repo } from './db/repo';
import { Presence } from './presence';
import { setRuntime } from './rooms/runtime';
import { WorldRoom } from './rooms/WorldRoom';

export interface App {
  config: Config;
  repo: Repo;
  presence: Presence;
  game: Server;
  http: HttpServer;
  port: number;
  close(): Promise<void>;
}

export interface AppOptions {
  config?: Partial<Config>;
  googleVerify?: GoogleVerifier | null;
  ambientSpawns?: boolean;
}

export async function createApp(opts: AppOptions = {}): Promise<App> {
  const config = { ...loadConfig(), ...opts.config };
  const pool = createPool(config.databaseUrl);
  await migrate(pool);
  const repo = new Repo(pool);
  const presence = await Presence.connect(config.redisUrl);
  const googleVerify = opts.googleVerify !== undefined
    ? opts.googleVerify
    : config.googleClientId ? googleVerifier(config.googleClientId) : null;

  setRuntime({ config, repo, presence, googleVerify, ambientSpawns: opts.ambientSpawns ?? true });

  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.allowedOrigin }));
  app.get('/healthz', (_req, res) => res.json({ ok: true, redis: presence.usingRedis }));
  app.use('/api/auth', authRouter({ repo, secret: config.sessionSecret, googleVerify, googleClientId: config.googleClientId, ratePerSec: config.authRatePerSec, burst: config.authBurst }));

  const http = createServer(app);
  const game = new Server({ transport: new WebSocketTransport({ server: http }), greet: false });
  game.define(JOIN_ROOM, WorldRoom);
  await game.listen(config.port);
  const addr = http.address();
  const port = typeof addr === 'object' && addr ? addr.port : config.port;

  return {
    config, repo, presence, game, http, port,
    async close() {
      await game.gracefullyShutdown(false).catch(() => {});
      await presence.close();
      await pool.end().catch(() => {});
    },
  };
}
