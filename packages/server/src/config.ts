export interface Config {
  port: number;
  databaseUrl: string;
  redisUrl: string | null;
  sessionSecret: string;
  googleClientId: string | null;
  worldSeed: number;
  allowedOrigin: string;
  /** Exactly one trusted reverse proxy, used only behind the private deployment ingress. */
  trustProxy: boolean;
  autosaveMs: number;
  authRatePerSec: number;
  authBurst: number;
  /** enable DEV messages (teleport, give items, shift time...). Never in production. */
  devCommands: boolean;
  /** revision given to a brand-new world (existing worlds stay pinned to their saved revision) */
  newWorldGeneration: 1 | 2 | 3 | 4 | 5 | 6;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const secret = env.SESSION_SECRET;
  if (!secret && env.NODE_ENV === 'production') throw new Error('SESSION_SECRET is required in production');
  return {
    port: Number(env.PORT ?? 2567),
    databaseUrl: env.DATABASE_URL ?? 'postgres://eigen:eigen@localhost:5432/eigenlands',
    redisUrl: env.REDIS_URL ?? (env.NODE_ENV === 'production' ? null : 'redis://localhost:6379'),
    sessionSecret: secret ?? 'dev-only-secret-change-me',
    googleClientId: env.GOOGLE_CLIENT_ID ?? null,
    worldSeed: Number(env.WORLD_SEED ?? 20260101),
    allowedOrigin: env.ALLOWED_ORIGIN ?? '*',
    trustProxy: env.TRUST_PROXY === '1',
    autosaveMs: Number(env.AUTOSAVE_MS ?? 30000),
    authRatePerSec: Number(env.AUTH_RATE ?? 2),
    authBurst: Number(env.AUTH_BURST ?? 20),
    devCommands: env.DEV_COMMANDS === '1' && env.NODE_ENV !== 'production',
    newWorldGeneration:
      env.NEW_WORLD_GENERATION === '2'
        ? 2
        : env.NEW_WORLD_GENERATION === '3'
          ? 3
          : env.NEW_WORLD_GENERATION === '4'
            ? 4
            : env.NEW_WORLD_GENERATION === '5'
              ? 5
              : 6,
  };
}
