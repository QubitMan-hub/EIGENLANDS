/**
 * Browser save store for the single-player world: one IndexedDB object store of JSON-able records, fully loaded into
 * memory at start (reads never touch the disk) and written behind in batches so autosaves never block a frame.
 *
 * Durability: dirty records are flushed ~0.5 s after they change. On page unload the host first lets the room save
 * (synchronously, see host.ts) and then `journalSync()` copies every record that is not yet known to be on disk into
 * localStorage, which is synchronous; the next start merges that journal over IndexedDB.
 */
const DB_NAME = 'eigenlands-solo';
const STORE = 'kv';
const JOURNAL_KEY = 'eigen.solo.journal';
const FLUSH_DELAY_MS = 500;

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

const req = <T>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const txDone = (t: IDBTransaction) => new Promise<void>((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error ?? new Error('transaction aborted')); });

function openIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    let r: IDBOpenDBRequest;
    try { r = indexedDB.open(DB_NAME, 1); } catch { resolve(null); return; }
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => resolve(null); // private mode etc.: play on, saved in memory (and the unload journal) only
    r.onblocked = () => resolve(null);
  });
}

export class LocalDb {
  private mem = new Map<string, unknown>();
  /** key → version; bumped on every write */
  private ver = new Map<string, number>();
  /** keys whose latest version is not yet on disk */
  private dirty = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing: Promise<void> | null = null;
  private wiped = false;
  private journalPending = false;

  private constructor(private idb: IDBDatabase | null) {}

  static async open(): Promise<LocalDb> {
    const db = new LocalDb(await openIdb());
    if (db.idb) {
      const t = db.idb.transaction(STORE, 'readonly');
      const s = t.objectStore(STORE);
      const [keys, vals] = await Promise.all([req(s.getAllKeys()), req(s.getAll())]);
      keys.forEach((k, i) => db.mem.set(String(k), vals[i]));
    }
    // a journal written while the page was closing is newer than anything in IndexedDB
    const j = ls.get(JOURNAL_KEY);
    if (j) {
      try {
        const rec = JSON.parse(j) as Record<string, unknown>;
        for (const [k, v] of Object.entries(rec)) {
          if (v === null) db.mem.delete(k); else db.mem.set(k, v);
          db.dirty.add(k);
          db.ver.set(k, 1);
        }
        db.journalPending = true;
        db.schedule(0);
      } catch { ls.del(JOURNAL_KEY); }
    }
    return db;
  }

  get persistent(): boolean { return this.idb !== null; }

  // ── record access (values are deep-copied in and out, like rows from a database) ──

  get<T>(key: string): T | undefined {
    const v = this.mem.get(key);
    return v === undefined ? undefined : structuredClone(v) as T;
  }

  has(key: string): boolean { return this.mem.has(key); }

  /** keys starting with `prefix` */
  keys(prefix: string): string[] {
    const out: string[] = [];
    for (const k of this.mem.keys()) if (k.startsWith(prefix)) out.push(k);
    return out;
  }

  put(key: string, value: unknown): void {
    if (this.wiped) return;
    this.mem.set(key, JSON.parse(JSON.stringify(value)) as unknown); // JSONB semantics: drops undefined, no shared refs
    this.touch(key);
  }

  delete(key: string): void {
    if (this.wiped || !this.mem.has(key)) return;
    this.mem.delete(key);
    this.touch(key);
  }

  private touch(key: string): void {
    this.ver.set(key, (this.ver.get(key) ?? 0) + 1);
    this.dirty.add(key);
    this.schedule(FLUSH_DELAY_MS);
  }

  private schedule(ms: number): void {
    if (this.timer || this.wiped) return;
    this.timer = setTimeout(() => { this.timer = null; void this.flush().catch((e) => console.warn('save failed (will retry)', e)); }, ms);
  }

  /** Write every dirty record to IndexedDB in one transaction. */
  async flush(): Promise<void> {
    if (this.flushing) { await this.flushing; if (!this.dirty.size) return; }
    if (!this.idb || this.wiped || !this.dirty.size) return;
    const batch = [...this.dirty].map((k) => [k, this.ver.get(k) ?? 0] as const);
    const t = this.idb.transaction(STORE, 'readwrite');
    const s = t.objectStore(STORE);
    for (const [k] of batch) { const v = this.mem.get(k); if (v === undefined) s.delete(k); else s.put(v, k); }
    this.flushing = txDone(t).then(() => {
      for (const [k, v] of batch) if (this.ver.get(k) === v) this.dirty.delete(k);
      if (this.journalPending && !this.dirty.size) { ls.del(JOURNAL_KEY); this.journalPending = false; }
    }).finally(() => { this.flushing = null; });
    try { await this.flushing; } catch (e) { this.schedule(2000); throw e; }
    if (this.dirty.size) this.schedule(FLUSH_DELAY_MS);
  }

  /** Synchronously stash every record that may not be on disk yet (page is closing). */
  journalSync(): void {
    if (this.wiped || !this.dirty.size) return;
    const rec: Record<string, unknown> = {};
    for (const k of this.dirty) rec[k] = this.mem.get(k) ?? null;
    if (ls.set(JOURNAL_KEY, JSON.stringify(rec))) this.journalPending = true;
    void this.flush().catch(() => {});
  }

  /** Erase the whole save (accounts, character, world). No writes are accepted afterwards. */
  async wipe(): Promise<void> {
    this.wiped = true;
    if (this.timer) clearTimeout(this.timer);
    this.mem.clear(); this.dirty.clear();
    ls.del(JOURNAL_KEY);
    await this.flushing?.catch(() => {});
    if (this.idb) {
      const t = this.idb.transaction(STORE, 'readwrite');
      t.objectStore(STORE).clear();
      await txDone(t).catch(() => {});
    }
  }

  /** debugging / e2e: number of records and how many still wait for the disk */
  stats(): { records: number; dirty: number; persistent: boolean } {
    return { records: this.mem.size, dirty: this.dirty.size, persistent: this.persistent };
  }
}
