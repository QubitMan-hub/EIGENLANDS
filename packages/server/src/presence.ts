import { Redis } from 'ioredis';

/** Account presence + single-session enforcement. Falls back to memory when Redis is unavailable. */
export class Presence {
  private mem = new Map<string, string>();
  constructor(private redis: Redis | null) {}

  static async connect(url: string | null): Promise<Presence> {
    if (!url) return new Presence(null);
    const r = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null });
    r.on('error', () => {});
    try {
      await r.connect();
      return new Presence(r);
    } catch {
      r.disconnect();
      return new Presence(null);
    }
  }

  get usingRedis(): boolean { return this.redis !== null; }

  async set(accountId: string, sessionId: string): Promise<void> {
    this.mem.set(accountId, sessionId);
    await this.redis?.set(`presence:${accountId}`, sessionId, 'EX', 120);
  }
  async get(accountId: string): Promise<string | null> {
    return (await this.redis?.get(`presence:${accountId}`)) ?? this.mem.get(accountId) ?? null;
  }
  async clear(accountId: string, sessionId: string): Promise<void> {
    if (this.mem.get(accountId) === sessionId) this.mem.delete(accountId);
    if (this.redis && (await this.redis.get(`presence:${accountId}`)) === sessionId) await this.redis.del(`presence:${accountId}`);
  }
  async onlineCount(): Promise<number> {
    if (!this.redis) return this.mem.size;
    const keys = await this.redis.keys('presence:*');
    return keys.length;
  }
  async close(): Promise<void> {
    await this.redis?.quit().catch(() => {});
  }
}
