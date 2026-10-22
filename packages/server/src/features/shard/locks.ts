import type { Redis } from 'ioredis';

/**
 * Exactly one room may simulate a shard. A room claims `shardlock:<id>` (Redis SET NX with a TTL it keeps refreshing,
 * or an in-process map without Redis). A room that loses the race redirects its players to the owner.
 */
export class ShardLocks {
  private mem = new Map<string, string>();
  constructor(private redis: Redis | null, private ttlMs = 15000) {}

  /**
   * Try to own `shard` for `roomId`; returns the owning room id (ours on success).
   * `alive` tells whether a current owner still exists (in-process rooms can be checked; Redis owners expire by TTL).
   */
  async claim(shard: string, roomId: string, alive: (id: string) => boolean = () => true): Promise<string> {
    if (!this.redis) {
      const cur = this.mem.get(shard);
      if (cur && cur !== roomId && alive(cur)) return cur;
      this.mem.set(shard, roomId);
      return roomId;
    }
    const k = `shardlock:${shard}`;
    const ok = await this.redis.set(k, roomId, 'PX', this.ttlMs, 'NX');
    if (ok) return roomId;
    return (await this.redis.get(k)) ?? (await this.claim(shard, roomId));
  }

  /** Keep the claim alive; false if someone else owns it now. */
  async refresh(shard: string, roomId: string): Promise<boolean> {
    if (!this.redis) return this.mem.get(shard) === roomId;
    const k = `shardlock:${shard}`;
    const cur = await this.redis.get(k);
    if (cur !== roomId) return false;
    await this.redis.pexpire(k, this.ttlMs);
    return true;
  }

  async owner(shard: string): Promise<string | null> {
    if (!this.redis) return this.mem.get(shard) ?? null;
    return this.redis.get(`shardlock:${shard}`);
  }

  async release(shard: string, roomId: string): Promise<void> {
    if (!this.redis) { if (this.mem.get(shard) === roomId) this.mem.delete(shard); return; }
    const k = `shardlock:${shard}`;
    if ((await this.redis.get(k)) === roomId) await this.redis.del(k);
  }
}
