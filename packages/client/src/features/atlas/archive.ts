import { Exploration, encodeChart, validPage } from './model';

const DB = 'eigenlands-atlas',
  PAGES = 'pages',
  MASKS = 'discovery',
  DELETED = 'deleted';
const range = (prefix: string) => IDBKeyRange.bound(prefix, `${prefix}\uffff`);
const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Chart transaction aborted'));
  });
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let abandoned = false;
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore(PAGES);
      r.result.createObjectStore(MASKS);
      r.result.createObjectStore(DELETED);
    };
    r.onerror = () => reject(r.error);
    r.onblocked = () => {
      abandoned = true;
      reject(new Error('Chart database is blocked'));
    };
    r.onsuccess = () => {
      if (abandoned) {
        r.result.close();
        return;
      }
      r.result.onversionchange = () => r.result.close();
      resolve(r.result);
    };
  });
}
const maskFor = (tiles: Int16Array): Uint8Array => {
  const mask = new Uint8Array(128);
  tiles.forEach((n, i) => {
    if (n >= 0) mask[i >> 3]! |= 1 << (i & 7);
  });
  return mask;
};
/** Disk history, separate from bounded resident pages. Unknown cells never overwrite discoveries. */
export class ChartArchive {
  readonly discovery = new Map<string, Uint8Array>();
  private db?: IDBDatabase;
  private pending = new Map<string, Int16Array>();
  private loading = new Set<string>();
  private writing: Promise<void> | null = null;
  private stopped = false;
  private ready: Promise<void>;
  private retryAt = 0;
  revision = 0;
  limited = false;
  status: 'opening' | 'saved' | 'pending' | 'unavailable' = 'opening';
  constructor(
    private scope: string,
    private journal: Exploration,
    private failed: () => void,
    recovery: string | null = null,
  ) {
    // Keep the legacy snapshot intact; importing it is idempotent and happens in normal transactions.
    const source = recovery === null ? journal : new Exploration();
    if (recovery) source.restore(recovery);
    for (const [key, page] of source.chunks) this.record(key, page.tiles);
    this.ready = this.init();
  }
  recovery(): string {
    return encodeChart(this.pending);
  }
  private async init(): Promise<void> {
    try {
      this.db = await open();
      if (this.stopped) {
        this.db.close();
        return;
      }
      const tx = this.db.transaction(MASKS, 'readonly'),
        complete = done(tx);
      const cursor = tx.objectStore(MASKS).openCursor(range(`${this.scope}|`));
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (!c) return;
        const key = String(c.key).slice(this.scope.length + 1),
          mask = c.value;
        if (/^-?\d{1,5},-?\d{1,5}$/.test(key) && mask instanceof Uint8Array && mask.length === 128) {
          const current = this.discovery.get(key);
          if (current) for (let i = 0; i < 128; i++) mask[i] |= current[i]!;
          this.discovery.set(key, mask);
        }
        c.continue();
      };
      await complete;
      this.status = this.pending.size ? 'pending' : 'saved';
    } catch {
      this.unavailable();
    }
  }
  private unavailable(): void {
    if (this.stopped) return;
    this.status = 'unavailable';
    this.retryAt = Date.now() + 5000;
    this.failed();
  }
  record(key: string, cells: Int16Array): void {
    if (this.stopped || !validPage(key, cells)) return;
    this.revision++;
    const delta = this.pending.get(key) ?? new Int16Array(1024).fill(-1);
    cells.forEach((n, i) => {
      if (n >= 0) delta[i] = n;
    });
    this.pending.delete(key);
    this.pending.set(key, delta);
    const mask = this.discovery.get(key) ?? new Uint8Array(128),
      added = maskFor(cells);
    for (let i = 0; i < 128; i++) mask[i]! |= added[i]!;
    this.discovery.set(key, mask);
    // Under prolonged quota failure keep the newest recovery window, never unbounded tile arrays.
    if (this.pending.size > 512) {
      this.limited = true;
      this.pending.delete(this.pending.keys().next().value!);
      this.unavailable();
    } else if (this.status === 'saved') this.status = 'pending';
  }
  seen(x: number, y: number): boolean {
    x = Math.floor(x);
    y = Math.floor(y);
    const cx = Math.floor(x / 32),
      cy = Math.floor(y / 32),
      i = x - cx * 32 + (y - cy * 32) * 32;
    return !!(this.discovery.get(`${cx},${cy}`)?.[i >> 3]! & (1 << (i & 7)));
  }
  async flush(): Promise<void> {
    await this.ready;
    if (this.stopped || Date.now() < this.retryAt) return;
    if (!this.db) {
      this.ready = this.init();
      await this.ready;
    }
    if (!this.db || this.stopped) return;
    if (this.writing) {
      await this.writing;
      return;
    }
    if (!this.pending.size) return;
    const batch = [...this.pending].slice(0, 64).map(([key, cells]) => [key, cells.slice()] as const);
    this.writing = (async () => {
      try {
        const tx = this.db!.transaction([PAGES, MASKS, DELETED], 'readwrite'),
          complete = done(tx),
          pages = tx.objectStore(PAGES);
        const deleted = tx.objectStore(DELETED).get(this.scope.slice(0, this.scope.lastIndexOf(':') + 1));
        deleted.onsuccess = () => {
          if (deleted.result) {
            this.stopped = true;
            this.pending.clear();
            return;
          }
          for (const [key, delta] of batch) {
            const id = `${this.scope}|${key}`,
              read = pages.get(id);
            read.onsuccess = () => {
              const tiles = validPage(key, read.result) ? read.result : new Int16Array(1024).fill(-1);
              delta.forEach((n, i) => {
                if (n >= 0) tiles[i] = n;
              });
              pages.put(tiles, id);
              tx.objectStore(MASKS).put(maskFor(tiles), id);
            };
          }
        };
        await complete;
        for (const [key, delta] of batch) {
          const current = this.pending.get(key);
          if (!current) continue;
          delta.forEach((n, i) => {
            if (n === current[i]) current[i] = -1;
          });
          if (current.every((n) => n < 0)) this.pending.delete(key);
        }
        this.revision++;
        this.status = this.pending.size ? 'pending' : 'saved';
      } catch {
        this.unavailable();
      }
    })();
    await this.writing;
    this.writing = null;
  }
  /** The caller supplies visible archive keys; reads never access the world ChunkStore. */
  load(keys: string[]): void {
    if (!this.db || this.stopped || Date.now() < this.retryAt) return;
    const wanted = keys
      .filter((k) => !this.journal.chunks.has(k) && !this.loading.has(k))
      .slice(0, Math.max(0, 64 - this.loading.size));
    if (!wanted.length) return;
    try {
      const tx = this.db.transaction(PAGES, 'readonly'),
        complete = done(tx);
      for (const key of wanted) {
        this.loading.add(key);
        const read = tx.objectStore(PAGES).get(`${this.scope}|${key}`);
        read.onsuccess = () => {
          if (!this.stopped && validPage(key, read.result)) {
            // Unsaved edits win even when a page was evicted while the read was in flight.
            const delta = this.pending.get(key);
            if (delta)
              delta.forEach((n, i) => {
                if (n >= 0) read.result[i] = n;
              });
            this.journal.merge(key, read.result);
          }
        };
      }
      void complete.catch(() => this.unavailable()).finally(() => wanted.forEach((k) => this.loading.delete(k)));
    } catch {
      this.unavailable();
    }
  }
  /** Detach on identity change; only the captured old identity may finish outstanding writes. */
  async close(): Promise<void> {
    await this.ready;
    while (this.pending.size && this.status !== 'unavailable' && !this.stopped) await this.flush();
    this.stopped = true;
    await this.writing;
    this.db?.close();
  }
  async erase(prefix: string): Promise<void> {
    this.stopped = true;
    this.pending.clear();
    await this.ready;
    await this.writing;
    this.db?.close();
    const db = await open();
    const tx = db.transaction([PAGES, MASKS, DELETED], 'readwrite'),
      complete = done(tx);
    tx.objectStore(DELETED).put(true, prefix);
    tx.objectStore(PAGES).delete(range(prefix));
    tx.objectStore(MASKS).delete(range(prefix));
    await complete;
    this.discovery.clear();
    db.close();
  }
}
