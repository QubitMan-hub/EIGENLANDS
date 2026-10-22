import { Redis } from 'ioredis';

export type BusHandler = (msg: unknown) => void;

/**
 * Cross-shard messaging. In one process every room shares a MemoryBus; with Redis, RedisBus fans messages out to
 * every process. Channels: `shard:<id>`, `party:<id>`, `chat:global`, `player:<accountId>`, `parties`.
 */
export interface Bus {
  publish(channel: string, msg: unknown): void;
  /** returns an unsubscribe function */
  subscribe(channel: string, fn: BusHandler): () => void;
  close(): Promise<void>;
  readonly kind: 'memory' | 'redis';
}

export class MemoryBus implements Bus {
  readonly kind = 'memory' as const;
  private subs = new Map<string, Set<BusHandler>>();
  publish(channel: string, msg: unknown): void {
    const set = this.subs.get(channel);
    if (!set) return;
    // deliver asynchronously, like a real bus, so handlers never run inside the publisher's call stack
    const copy = structuredClone(msg);
    queueMicrotask(() => { for (const fn of [...set]) { try { fn(copy); } catch (e) { console.error('bus handler failed', e); } } });
  }
  subscribe(channel: string, fn: BusHandler): () => void {
    let set = this.subs.get(channel);
    if (!set) { set = new Set(); this.subs.set(channel, set); }
    set.add(fn);
    return () => { set!.delete(fn); if (!set!.size) this.subs.delete(channel); };
  }
  async close(): Promise<void> { this.subs.clear(); }
}

export class RedisBus implements Bus {
  readonly kind = 'redis' as const;
  private local = new MemoryBus();
  private counts = new Map<string, number>();
  private constructor(private pub: Redis, private sub: Redis) {
    sub.on('message', (channel: string, raw: string) => {
      let msg: unknown;
      try { msg = JSON.parse(raw); } catch { return; }
      this.local.publish(channel, msg);
    });
  }

  static async connect(url: string): Promise<RedisBus | null> {
    const mk = () => { const r = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 }); r.on('error', () => {}); return r; };
    const pub = mk(), sub = mk();
    try {
      await Promise.all([pub.connect(), sub.connect()]);
      return new RedisBus(pub, sub);
    } catch {
      pub.disconnect(); sub.disconnect();
      return null;
    }
  }

  publish(channel: string, msg: unknown): void { void this.pub.publish(channel, JSON.stringify(msg)).catch(() => {}); }
  subscribe(channel: string, fn: BusHandler): () => void {
    const n = this.counts.get(channel) ?? 0;
    if (n === 0) void this.sub.subscribe(channel).catch(() => {});
    this.counts.set(channel, n + 1);
    const off = this.local.subscribe(channel, fn);
    return () => {
      off();
      const m = (this.counts.get(channel) ?? 1) - 1;
      if (m <= 0) { this.counts.delete(channel); void this.sub.unsubscribe(channel).catch(() => {}); } else this.counts.set(channel, m);
    };
  }
  async close(): Promise<void> {
    await Promise.all([this.pub.quit().catch(() => {}), this.sub.quit().catch(() => {})]);
  }
}
