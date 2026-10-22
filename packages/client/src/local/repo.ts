/**
 * Browser implementations of the server's persistence (packages/server/src/db/repo.ts and repo34.ts) on top of LocalDb.
 * Same method contracts and data semantics as the Postgres versions: JSON round-trips like JSONB, REAL coordinates,
 * ON DELETE CASCADE from accounts, atomic trades.
 */
import { BASE_PLAYER_HP, CHUNK_SIZE, type ChunkDiff, type WorldObj } from '@eigenlands/shared';
import type { Account, CharacterRow, Repo } from '../../../server/src/db/repo';
import type { Repo34 } from '../../../server/src/db/repo34';
import type { LocalDb } from './db';
import { createHash, randomBytes, randomUUID } from './shims/crypto';

type RepoApi = { [K in keyof Repo]: Repo[K] };
type Repo34Api = { [K in Exclude<keyof Repo34, 'pool'>]: Repo34[K] };

interface AccountRec { id: string; googleSub: string | null; email: string | null; guestHash: string | null }
interface Respawn { x: number; y: number; restore: number; at: number }

const hashSecret = (s: string) => createHash('sha256').update(s).digest('hex');
const toAccount = (r: AccountRec): Account => ({ id: r.id, googleSub: r.googleSub, email: r.email, isGuest: !r.googleSub });
const chunkKey = (seed: number, cx: number, cy: number) => `${seed}:${cx},${cy}`;
const chunkOfTile = (t: number) => Math.floor(t / CHUNK_SIZE);
/** Postgres REAL is a float32 */
const real = (v: number) => Math.fround(v);
const LOG_CAP = 500;

export class LocalRepo implements RepoApi {
  constructor(private db: LocalDb) {}

  async guestLogin(deviceSecret?: string): Promise<{ account: Account; deviceSecret: string }> {
    if (deviceSecret && deviceSecret.length >= 32) {
      const id = this.db.get<string>(`guest:${hashSecret(deviceSecret)}`);
      const a = id ? this.db.get<AccountRec>(`acct:${id}`) : undefined;
      if (a) return { account: toAccount(a), deviceSecret };
    }
    const secret = randomBytes(24).toString('hex');
    const a: AccountRec = { id: randomUUID(), googleSub: null, email: null, guestHash: hashSecret(secret) };
    this.db.put(`acct:${a.id}`, a);
    this.db.put(`guest:${a.guestHash}`, a.id);
    return { account: toAccount(a), deviceSecret: secret };
  }

  async googleLogin(): Promise<{ account: Account; upgraded: boolean }> {
    throw new Error('google sign-in is not available in single-player mode');
  }

  async getAccount(id: string): Promise<Account | null> {
    const a = this.db.get<AccountRec>(`acct:${id}`);
    return a ? toAccount(a) : null;
  }

  async deleteAccount(id: string): Promise<boolean> {
    const a = this.db.get<AccountRec>(`acct:${id}`);
    if (!a) return false;
    this.db.delete(`acct:${id}`);
    if (a.guestHash) this.db.delete(`guest:${a.guestHash}`);
    for (const k of [`char:${id}`, `prog:${id}`, `flag:${id}`]) this.db.delete(k); // ON DELETE CASCADE
    return true;
  }

  async getCharacter(accountId: string): Promise<CharacterRow | null> {
    return this.db.get<CharacterRow>(`char:${accountId}`) ?? null;
  }

  async createCharacter(accountId: string, name: string, x: number, y: number): Promise<CharacterRow> {
    const cur = this.db.get<CharacterRow>(`char:${accountId}`);
    if (cur) return cur; // ON CONFLICT (account_id) returns the existing row
    if (!this.db.has(`acct:${accountId}`)) throw new Error('characters.account_id violates foreign key');
    const c: CharacterRow = { id: randomUUID(), accountId, name, x: real(x), y: real(y), hp: BASE_PLAYER_HP, level: 1, xp: 0, data: {} };
    this.db.put(`char:${accountId}`, c);
    return this.db.get<CharacterRow>(`char:${accountId}`)!;
  }

  async saveCharacter(c: Pick<CharacterRow, 'accountId' | 'x' | 'y' | 'hp' | 'level' | 'xp'> & { data?: Record<string, unknown> }): Promise<void> {
    const cur = this.db.get<CharacterRow>(`char:${c.accountId}`);
    if (!cur) return; // UPDATE ... WHERE account_id = $1 matching no row
    this.db.put(`char:${c.accountId}`, {
      ...cur, x: real(c.x), y: real(c.y), hp: Math.round(c.hp), level: Math.round(c.level), xp: Math.round(c.xp), ...(c.data ? { data: c.data } : {}),
    });
  }

  async loadChunkDiff(seed: number, cx: number, cy: number): Promise<ChunkDiff> {
    return (await this.loadChunk(seed, cx, cy)).diff;
  }

  async loadChunk(seed: number, cx: number, cy: number): Promise<{ diff: ChunkDiff; day: number | null }> {
    const r = this.db.get<{ diff: Record<string, number>; day: number }>(`chunk:${chunkKey(seed, cx, cy)}`);
    const out: ChunkDiff = new Map();
    if (!r) return { diff: out, day: null };
    for (const [k, v] of Object.entries(r.diff)) out.set(Number(k), v);
    return { diff: out, day: Number(r.day) };
  }

  async saveChunkDiffs(seed: number, diffs: Array<{ cx: number; cy: number; diff: ChunkDiff }>, day = 0): Promise<void> {
    for (const d of diffs) this.db.put(`chunk:${chunkKey(seed, d.cx, d.cy)}`, { diff: Object.fromEntries(d.diff), day });
  }

  async loadObjects(seed: number, cx: number, cy: number): Promise<WorldObj[]> {
    const rec = this.db.get<Record<string, WorldObj>>(`objs:${chunkKey(seed, cx, cy)}`) ?? {};
    return Object.values(rec).map((o) => ({ x: o.x, y: o.y, kind: o.kind, sub: o.sub, ...(o.owner ? { owner: o.owner } : {}), data: o.data ?? {} }));
  }

  async saveObjects(seed: number, upserts: WorldObj[], deletes: Array<{ x: number; y: number }>): Promise<void> {
    this.editByChunk<WorldObj>('objs', seed, [
      ...upserts.map((o) => ({ x: o.x, y: o.y, v: { x: o.x, y: o.y, kind: o.kind, sub: o.sub, ...(o.owner ? { owner: o.owner } : {}), data: o.data ?? {} } })),
      ...deletes.map((d) => ({ x: d.x, y: d.y, v: null })),
    ]);
  }

  async loadRespawns(seed: number, cx: number, cy: number): Promise<Respawn[]> {
    return Object.values(this.db.get<Record<string, Respawn>>(`resp:${chunkKey(seed, cx, cy)}`) ?? {});
  }

  async saveRespawns(seed: number, upserts: Respawn[], deletes: Array<{ x: number; y: number }>): Promise<void> {
    this.editByChunk<Respawn>('resp', seed, [
      ...upserts.map((o) => ({ x: o.x, y: o.y, v: { x: o.x, y: o.y, restore: o.restore, at: o.at } })),
      ...deletes.map((d) => ({ x: d.x, y: d.y, v: null })),
    ]);
  }

  /** Applies upserts (v) and deletes (v = null) in order, one record per chunk, all at once (a "transaction"). */
  private editByChunk<T>(kind: string, seed: number, ops: Array<{ x: number; y: number; v: T | null }>): void {
    const touched = new Map<string, Record<string, T>>();
    for (const op of ops) {
      const k = `${kind}:${chunkKey(seed, chunkOfTile(op.x), chunkOfTile(op.y))}`;
      let rec = touched.get(k);
      if (!rec) { rec = this.db.get<Record<string, T>>(k) ?? {}; touched.set(k, rec); }
      if (op.v === null) delete rec[`${op.x},${op.y}`]; else rec[`${op.x},${op.y}`] = op.v;
    }
    for (const [k, rec] of touched) { if (Object.keys(rec).length) this.db.put(k, rec); else this.db.delete(k); }
  }

  async getBlob<T>(key: string): Promise<T | null> {
    return this.db.get<T>(`blob:${key}`) ?? null;
  }

  async putBlob(key: string, value: unknown): Promise<void> {
    this.db.put(`blob:${key}`, value ?? null);
  }
}

export class LocalRepo34 implements Repo34Api {
  constructor(private db: LocalDb) {}

  async loadProgress(accountId: string): Promise<unknown | null> {
    return this.db.get(`prog:${accountId}`) ?? null;
  }

  async saveProgress(accountId: string, data: unknown): Promise<void> {
    if (!this.db.has(`acct:${accountId}`)) throw new Error('character_progress.account_id violates foreign key');
    this.db.put(`prog:${accountId}`, data ?? null);
  }

  async commitTrade(t: { a: string; b: string; aData: unknown; bData: unknown; aItems: unknown; bItems: unknown; aCoins: number; bCoins: number }): Promise<void> {
    const a = this.db.get<CharacterRow>(`char:${t.a}`), b = this.db.get<CharacterRow>(`char:${t.b}`);
    if (!a || !b) throw new Error('trade: character missing'); // nothing changed
    this.db.put(`char:${t.a}`, { ...a, data: t.aData });
    this.db.put(`char:${t.b}`, { ...b, data: t.bData });
    this.log('trades', { a: t.a, b: t.b, aItems: t.aItems, bItems: t.bItems, aCoins: t.aCoins, bCoins: t.bCoins, at: Date.now() });
  }

  async report(reporter: string, targetName: string, target: string | null, reason: string, context: unknown): Promise<void> {
    this.log('reports', { reporter, targetName, target, reason, context, at: Date.now() });
  }

  async mutedUntil(accountId: string): Promise<number> {
    return this.db.get<{ mutedUntil: number | null }>(`flag:${accountId}`)?.mutedUntil ?? 0;
  }

  async setMute(accountId: string, until: Date | null): Promise<void> {
    this.db.put(`flag:${accountId}`, { mutedUntil: until ? until.getTime() : null });
  }

  async accountByName(name: string): Promise<{ accountId: string; name: string } | null> {
    const n = name.toLowerCase();
    for (const k of this.db.keys('char:')) {
      const c = this.db.get<CharacterRow>(k)!;
      if (c.name.toLowerCase() === n) return { accountId: c.accountId, name: c.name };
    }
    return null;
  }

  private log(kind: string, row: unknown): void {
    const list = this.db.get<unknown[]>(`log:${kind}`) ?? [];
    list.push(row);
    this.db.put(`log:${kind}`, list.slice(-LOG_CAP));
  }
}
