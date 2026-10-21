import type pg from 'pg';

/** Phase 3/4 persistence: progression, trades, chat reports, moderation flags. */
export class Repo34 {
  constructor(readonly pool: pg.Pool) {}

  async loadProgress(accountId: string): Promise<unknown | null> {
    const r = await this.pool.query('SELECT data FROM character_progress WHERE account_id = $1', [accountId]);
    return r.rows[0]?.data ?? null;
  }

  async saveProgress(accountId: string, data: unknown): Promise<void> {
    await this.pool.query(
      `INSERT INTO character_progress (account_id, data, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (account_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [accountId, JSON.stringify(data)],
    );
  }

  /**
   * Commit a completed trade: both characters' private data (inventory, coins) and an audit row, in one transaction.
   * Throws (and changes nothing) if any part fails.
   */
  async commitTrade(t: {
    a: string; b: string; aData: unknown; bData: unknown;
    aItems: unknown; bItems: unknown; aCoins: number; bCoins: number;
  }): Promise<void> {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      for (const [acct, data] of [[t.a, t.aData], [t.b, t.bData]] as const) {
        const r = await c.query('UPDATE characters SET data = $2, updated_at = now() WHERE account_id = $1', [acct, JSON.stringify(data)]);
        if (r.rowCount !== 1) throw new Error('trade: character missing');
      }
      await c.query(
        'INSERT INTO trades (a, b, a_items, b_items, a_coins, b_coins) VALUES ($1,$2,$3,$4,$5,$6)',
        [t.a, t.b, JSON.stringify(t.aItems), JSON.stringify(t.bItems), t.aCoins, t.bCoins],
      );
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  }

  async report(reporter: string, targetName: string, target: string | null, reason: string, context: unknown): Promise<void> {
    await this.pool.query(
      'INSERT INTO chat_reports (reporter, target_name, target, reason, context) VALUES ($1,$2,$3,$4,$5)',
      [reporter, targetName, target, reason, JSON.stringify(context)],
    );
  }

  async mutedUntil(accountId: string): Promise<number> {
    const r = await this.pool.query('SELECT muted_until FROM account_flags WHERE account_id = $1', [accountId]);
    const t = r.rows[0]?.muted_until as Date | null | undefined;
    return t ? t.getTime() : 0;
  }

  async setMute(accountId: string, until: Date | null): Promise<void> {
    await this.pool.query(
      `INSERT INTO account_flags (account_id, muted_until) VALUES ($1, $2)
       ON CONFLICT (account_id) DO UPDATE SET muted_until = EXCLUDED.muted_until`,
      [accountId, until],
    );
  }

  /** Character id lookup by exact name (case-insensitive) for whispers, invites and reports. */
  async accountByName(name: string): Promise<{ accountId: string; name: string } | null> {
    const r = await this.pool.query('SELECT account_id, name FROM characters WHERE lower(name) = lower($1) LIMIT 1', [name]);
    return r.rows[0] ? { accountId: r.rows[0].account_id, name: r.rows[0].name } : null;
  }
}
