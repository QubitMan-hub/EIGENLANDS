import pg from 'pg';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

let storage = process.env.TEST_STORAGE;
if (storage && !['memory', 'postgres'].includes(storage)) throw new Error('TEST_STORAGE must be memory or postgres');
if (!storage) {
  const pool = new pg.Pool({
    connectionString: process.env.TEST_DB_URL ?? 'postgres://eigen:eigen@localhost:5432/eigenlands_test',
    connectionTimeoutMillis: 750,
  });
  try {
    await pool.query('SELECT 1');
    storage = 'postgres';
  } catch {
    storage = 'memory';
  } finally {
    await pool.end();
  }
}
console.log(
  `Server tests: ${storage === 'postgres' ? 'PostgreSQL' : 'real browser LocalDb / LocalRepo / LocalRepo34 adapters (memory). PostgreSQL outage readiness and Redis cluster-bus tests are explicitly skipped.'}`,
);
const child = spawn(
  process.execPath,
  [fileURLToPath(new URL('../../../node_modules/vitest/vitest.mjs', import.meta.url)), 'run', ...process.argv.slice(2)],
  { stdio: 'inherit', env: { ...process.env, TEST_STORAGE: storage } },
);
child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
