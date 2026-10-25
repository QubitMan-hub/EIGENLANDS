import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { loadConfig } from '../config';
import { createPool } from './pool';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

/** Applies pending .sql files in order, each inside a transaction. Safe to run concurrently (advisory lock). */
export async function migrate(pool: pg.Pool): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query('SELECT pg_advisory_lock(7368425)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
    );
    const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name as string));
    for (const f of readdirSync(dir)
      .filter((n) => n.endsWith('.sql'))
      .sort()) {
      if (done.has(f)) continue;
      await client.query('BEGIN');
      try {
        await client.query(readFileSync(join(dir, f), 'utf8'));
        await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f]);
        await client.query('COMMIT');
        applied.push(f);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(7368425)').catch(() => {});
    client.release();
  }
  return applied;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const pool = createPool(loadConfig().databaseUrl);
  migrate(pool)
    .then((a) => {
      console.log('applied', a);
      return pool.end();
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
