import { createHash, randomBytes } from 'node:crypto';
import type pg from 'pg';
import { BASE_PLAYER_HP, CHUNK_SIZE, type ChunkDiff, type WorldObj, type WorldObjKind } from '@eigenlands/shared';

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

  async saveCharacter(c: Pick<CharacterRow, 'accountId' | 'x' | 'y' | 'hp' | 'level' | 'xp'> & { data?: Record<string, unknown> }): Promise<void> {
    if (c.data) {
      await this.pool.query(
        'UPDATE characters SET x=$2, y=$3, hp=$4, level=$5, xp=$6, data=$7, updated_at=now() WHERE account_id=$1',
        [c.accountId, c.x, c.y, c.hp, c.level, c.xp, JSON.stringify(c.data)],
      );
      return;
    }
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

  /** Diff plus the world day it was last saved on (used to dry watered soil lazily). */
  async loadChunk(seed: number, cx: number, cy: number): Promise<{ diff: ChunkDiff; day: number | null }> {
    const r = await this.pool.query('SELECT diff, day FROM chunk_diffs WHERE world_seed=$1 AND cx=$2 AND cy=$3', [seed, cx, cy]);
    const out: ChunkDiff = new Map();
    if (!r.rows[0]) return { diff: out, day: null };
    for (const [k, v] of Object.entries(r.rows[0].diff as Record<string, number>)) out.set(Number(k), v);
    return { diff: out, day: Number(r.rows[0].day) };
  }

  async loadObjects(seed: number, cx: number, cy: number): Promise<WorldObj[]> {
    const x0 = cx * CHUNK_SIZE, y0 = cy * CHUNK_SIZE;
    const r = await this.pool.query(
      'SELECT x, y, kind, sub, owner, data FROM world_objects WHERE world_seed=$1 AND x >= $2 AND x < $3 AND y >= $4 AND y < $5',
      [seed, x0, x0 + CHUNK_SIZE, y0, y0 + CHUNK_SIZE],
    );
    return r.rows.map((o) => ({ x: o.x, y: o.y, kind: o.kind as WorldObjKind, sub: o.sub, ...(o.owner ? { owner: o.owner as string } : {}), data: o.data as Record<string, unknown> }));
  }

  async saveObjects(seed: number, upserts: WorldObj[], deletes: Array<{ x: number; y: number }>): Promise<void> {
    if (!upserts.length && !deletes.length) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const o of upserts) {
        await client.query(
          `INSERT INTO world_objects (world_seed, x, y, kind, sub, owner, data) VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (world_seed, x, y) DO UPDATE SET kind=EXCLUDED.kind, sub=EXCLUDED.sub, owner=EXCLUDED.owner, data=EXCLUDED.data, updated_at=now()`,
          [seed, o.x, o.y, o.kind, o.sub, o.owner ?? null, JSON.stringify(o.data ?? {})],
        );
      }
      for (const d of deletes) await client.query('DELETE FROM world_objects WHERE world_seed=$1 AND x=$2 AND y=$3', [seed, d.x, d.y]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async loadRespawns(seed: number, cx: number, cy: number): Promise<Array<{ x: number; y: number; restore: number; at: number }>> {
    const x0 = cx * CHUNK_SIZE, y0 = cy * CHUNK_SIZE;
    const r = await this.pool.query(
      'SELECT x, y, restore_tile, at_ms FROM respawns WHERE world_seed=$1 AND x >= $2 AND x < $3 AND y >= $4 AND y < $5',
      [seed, x0, x0 + CHUNK_SIZE, y0, y0 + CHUNK_SIZE],
    );
    return r.rows.map((o) => ({ x: o.x, y: o.y, restore: o.restore_tile, at: Number(o.at_ms) }));
  }

  async saveRespawns(seed: number, upserts: Array<{ x: number; y: number; restore: number; at: number }>, deletes: Array<{ x: number; y: number }>): Promise<void> {
    if (!upserts.length && !deletes.length) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const o of upserts) {
        await client.query(
          `INSERT INTO respawns (world_seed, x, y, restore_tile, at_ms) VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (world_seed, x, y) DO UPDATE SET restore_tile=EXCLUDED.restore_tile, at_ms=EXCLUDED.at_ms`,
          [seed, o.x, o.y, o.restore, o.at],
        );
      }
      for (const d of deletes) await client.query('DELETE FROM respawns WHERE world_seed=$1 AND x=$2 AND y=$3', [seed, d.x, d.y]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async getBlob<T>(key: string): Promise<T | null> {
    const r = await this.pool.query('SELECT value FROM world_state WHERE key=$1', [key]);
    return r.rows[0] ? (r.rows[0].value as T) : null;
  }

  async putBlob(key: string, value: unknown): Promise<void> {
    await this.pool.query(
      `INSERT INTO world_state (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
      [key, JSON.stringify(value)],
    );
  }

  /** Persist several chunk diffs atomically. `day` is the world day of this save. */
  async saveChunkDiffs(seed: number, diffs: Array<{ cx: number; cy: number; diff: ChunkDiff }>, day = 0): Promise<void> {
    if (!diffs.length) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const d of diffs) {
        await client.query(
          `INSERT INTO chunk_diffs (world_seed, cx, cy, diff, day) VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (world_seed, cx, cy) DO UPDATE SET diff = EXCLUDED.diff, day = EXCLUDED.day, updated_at = now()`,
          [seed, d.cx, d.cy, JSON.stringify(Object.fromEntries(d.diff)), day],
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
