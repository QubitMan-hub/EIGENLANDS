/**
 * `process` for server modules bundled into the single-player build (injected per module by the solo Vite plugin, never
 * installed as a global). NODE_ENV is 'production' so the room behaves exactly like the deployed server (sharded world,
 * no dev shortcuts); no AI dialogue keys exist in the browser.
 */
const env: Record<string, string | undefined> = { NODE_ENV: 'production' };

const process = {
  env,
  argv: [] as string[],
  platform: 'browser',
  version: '',
  versions: {} as Record<string, string>,
  pid: 1,
  cwd: () => '/',
  uptime: () => performance.now() / 1000,
  hrtime: Object.assign(
    (prev?: [number, number]) => {
      const t = performance.now(),
        s = Math.floor(t / 1000),
        ns = Math.floor((t % 1000) * 1e6);
      return prev ? [s - prev[0], ns - prev[1]] : [s, ns];
    },
    { bigint: () => BigInt(Math.floor(performance.now() * 1e6)) },
  ),
  memoryUsage: () => ({ rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 }),
  nextTick: (fn: (...a: unknown[]) => void, ...args: unknown[]) => queueMicrotask(() => fn(...args)),
  on: () => process,
  once: () => process,
  off: () => process,
  emitWarning: (w: unknown) => console.warn(w),
  exit: (code?: number) => {
    throw new Error(`process.exit(${code ?? 0}) called in the browser build`);
  },
};

export { env };
export default process;
