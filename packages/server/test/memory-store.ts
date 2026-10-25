import { LocalDb } from '../../client/src/local/db';
import { LocalRepo, LocalRepo34 } from '../../client/src/local/repo';
import type { AppOptions } from '../src/app';
import type { Repo34 } from '../src/db/repo34';
import { runtime34 } from '../src/features/runtime34';

export const usesMemoryStore = process.env.TEST_STORAGE === 'memory';
let database: LocalDb | null = null;

export async function resetMemoryStore(): Promise<void> {
  await database?.wipe();
  database = await LocalDb.open();
}

export async function memoryStorage(): Promise<NonNullable<AppOptions['storage']>> {
  const db = (database ??= await LocalDb.open());
  return { repo: new LocalRepo(db), progress: new LocalRepo34(db), ready: async () => {}, close: () => db.flush() };
}

/** Inspect the actual adapter's audit records. No pretend SQL parser or fabricated query results. */
export async function auditRows(table: 'trades' | 'chat_reports', accountId: string): Promise<Record<string, any>[]> {
  if (!usesMemoryStore) {
    const sql =
      table === 'trades' ? 'SELECT * FROM trades WHERE a=$1 OR b=$1' : 'SELECT * FROM chat_reports WHERE reporter=$1';
    return (await (runtime34().repo34 as Repo34).pool.query(sql, [accountId])).rows;
  }
  const rows = database?.get<Record<string, any>[]>(`log:${table === 'trades' ? 'trades' : 'reports'}`) ?? [];
  return rows
    .filter((row) => (table === 'trades' ? row.a === accountId || row.b === accountId : row.reporter === accountId))
    .map((row) => ({
      ...row,
      a_items: row.aItems,
      b_items: row.bItems,
      a_coins: row.aCoins,
      b_coins: row.bCoins,
      target_name: row.targetName,
    }));
}
