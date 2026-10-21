import { createHash, randomBytes } from 'node:crypto';
import type pg from 'pg';
import { BASE_PLAYER_HP, type ChunkDiff } from '@eigenlands/shared';

export interface Account { id: string; googleSub: string | null; email: string | null; isGuest: boolean }
export interface CharacterRow { id: string; accountId: string; name: string; x: number; y: number; hp: number; level: number; xp: number; data: Record<string, unknown> }

const hashSecret = (s: string) => createHash('sha256').update(s).digest('hex');
const toAccount = (r: any): Account => ({ id: r.id, googleSub: r.google_sub, email: r.email, isGuest: !r.google_sub });
const toChar = (r: any): CharacterRow => ({
  id: r.id, accountId: r.account_id, name: r.name, x: r.x, y: r.y, hp: r.hp, level: r.level, xp: r.xp, data: r.data,
});

export class Repo {
  constructor(private pool: pg.Pool) {}

  /** Finds or creates a guest account for a device secret. Returns the secret to store client-side. */
  async guestLogin(deviceSecret?: string): Promise<{ account: Account; deviceSecret: string }> {
    if (deviceSecret && deviceSecret.length >= 32) {
      const r = await this.pool.query('UPDATE accounts SET last_login_at = now() WHERE guest_hash = $1 RETURNING *', [hashSecret(deviceSecret)]);
      if (r.rows[0]) return { account: toAccount(r.rows[0]), deviceSecret };
    }
    const secret = randomBytes(24).toString('hex');
    const r = await this.pool.query('INSERT INTO accounts (guest_hash) VALUES ($1) RETURNING *', [hashSecret(secret)]);
    return { account: toAccount(r.rows[0]), deviceSecret: secret };
  }

  /**
   * Google sign-in. If a guest device secret is supplied and the Google identity is new,
   * the guest account is upgraded in place so the character is kept.
   */
  async googleLogin(sub: string, email: string | null, deviceSecret?: string): Promise<{ account: Account; upgraded: boolean }> {
    const existing = await this.pool.query('UPDATE accounts SET last_login_at = now(), email = COALESCE($2, email) WHERE google_sub = $1 RETURNING *', [sub, email]);
    if (existing.rows[0]) return { account: toAccount(existing.rows[0]), upgraded: false };
    if (deviceSecret) {
      const up = await this.pool.query(
        'UPDATE accounts SET google_sub = $1, email = $2, guest_hash = NULL, last_login_at = now() WHERE guest_hash = $3 AND google_sub IS NULL RETURNING *',
        [sub, email, hashSecret(deviceSecret)],
      );
      if (up.rows[0]) return { account: toAccount(up.rows[0]), upgraded: true };
    }
    const r = await this.pool.query('INSERT INTO accounts (google_sub, email) VALUES ($1, $2) RETURNING *', [sub, email]);
    return { account: toAccount(r.rows[0]), upgraded: false };
  }

  async getAccount(id: string): Promise<Account | null> {
    const r = await this.pool.query('SELECT * FROM accounts WHERE id = $1', [id]);
    return r.rows[0] ? toAccount(r.rows[0]) : null;
  }

  /** Account deletion (privacy): cascades to characters. */
  async deleteAccount(id: string): Promise<boolean> {
    const r = await this.pool.query('DELETE FROM accounts WHERE id = $1', [id]);
    return (r.rowCount ?? 0) > 0;
  }

  async getCharacter(accountId: string): Promise<CharacterRow | null> {
    const r = await this.pool.query('SELECT * FROM characters WHERE account_id = $1', [accountId]);
    return r.rows[0] ? toChar(r.rows[0]) : null;
  }

  async createCharacter(accountId: string, name: string, x: number, y: number): Promise<CharacterRow> {
    const r = await this.pool.query(
      `INSERT INTO characters (account_id, name, x, y, hp) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (account_id) DO UPDATE SET account_id = EXCLUDED.account_id RETURNING *`,
      [accountId, name, x, y, BASE_PLAYER_HP],
    );
    return toChar(r.rows[0]);
  }

  async saveCharacter(c: Pick<CharacterRow, 'accountId' | 'x' | 'y' | 'hp' | 'level' | 'xp'>): Promise<void> {
    await this.pool.query(
      'UPDATE characters SET x=$2, y=$3, hp=$4, level=$5, xp=$6, updated_at=now() WHERE account_id=$1',
      [c.accountId, c.x, c.y, c.hp, c.level, c.xp],
    );
  }

  async loadChunkDiff(seed: number, cx: number, cy: number): Promise<ChunkDiff> {
    const r = await this.pool.query('SELECT diff FROM chunk_diffs WHERE world_seed=$1 AND cx=$2 AND cy=$3', [seed, cx, cy]);
    const out: ChunkDiff = new Map();
    if (r.rows[0]) for (const [k, v] of Object.entries(r.rows[0].diff as Record<string, number>)) out.set(Number(k), v);
    return out;
  }

  /** Persist several chunk diffs atomically. */
  async saveChunkDiffs(seed: number, diffs: Array<{ cx: number; cy: number; diff: ChunkDiff }>): Promise<void> {
    if (!diffs.length) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const d of diffs) {
        await client.query(
          `INSERT INTO chunk_diffs (world_seed, cx, cy, diff) VALUES ($1,$2,$3,$4)
           ON CONFLICT (world_seed, cx, cy) DO UPDATE SET diff = EXCLUDED.diff, updated_at = now()`,
          [seed, d.cx, d.cy, JSON.stringify(Object.fromEntries(d.diff))],
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
