export interface Config {
  port: number;
  databaseUrl: string;
  redisUrl: string | null;
  sessionSecret: string;
  googleClientId: string | null;
  worldSeed: number;
  allowedOrigin: string;
  autosaveMs: number;
  authRatePerSec: number;
  authBurst: number;
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
    autosaveMs: Number(env.AUTOSAVE_MS ?? 30000),
    authRatePerSec: Number(env.AUTH_RATE ?? 2),
    authBurst: Number(env.AUTH_BURST ?? 20),
  };
}
