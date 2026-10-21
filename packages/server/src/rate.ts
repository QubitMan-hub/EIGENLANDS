/** Token bucket. `take()` returns false when the caller is over its rate. */
export class TokenBucket {
  private tokens: number;
  private last: number;
  constructor(private ratePerSec: number, private burst: number, now = Date.now()) {
    this.tokens = burst;
    this.last = now;
  }
  take(cost = 1, now = Date.now()): boolean {
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.ratePerSec);
    this.last = now;
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }
}

/** Per-key limiter for HTTP endpoints (keyed by IP). Old keys are pruned. */
export class KeyedLimiter {
  private m = new Map<string, TokenBucket>();
  constructor(private ratePerSec: number, private burst: number) {}
  allow(key: string, now = Date.now()): boolean {
    let b = this.m.get(key);
    if (!b) {
      if (this.m.size > 10000) this.m.clear();
      b = new TokenBucket(this.ratePerSec, this.burst, now);
      this.m.set(key, b);
    }
    return b.take(1, now);
  }
}
