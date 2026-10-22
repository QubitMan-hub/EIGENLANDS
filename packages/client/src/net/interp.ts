import { TICK_MS } from '@eigenlands/shared';

export interface Pose { x: number; y: number; faceX: number; faceY: number }
interface Sample<T> { t: number; v: T }

/** Monotone tangents keep smooth turns/stops inside the snapshot interval. */
const tangent = (a: number, b: number) => a * b > 0 ? 2 * a * b / (a + b) : 0;
function smooth<T extends Pose>(before: Sample<T> | undefined, a: Sample<T>, b: Sample<T>, after: Sample<T> | undefined, k: number, axis: 'x' | 'y'): number {
  const h = b.t - a.t, delta = (b.v[axis] - a.v[axis]) / h;
  const m0 = before && Math.hypot(a.v.x - before.v.x, a.v.y - before.v.y) <= 6
    ? tangent((a.v[axis] - before.v[axis]) / (a.t - before.t), delta) : delta;
  const m1 = after && Math.hypot(after.v.x - b.v.x, after.v.y - b.v.y) <= 6
    ? tangent(delta, (after.v[axis] - b.v[axis]) / (after.t - b.t)) : delta;
  const k2 = k * k, k3 = k2 * k;
  const v = (2 * k3 - 3 * k2 + 1) * a.v[axis] + (k3 - 2 * k2 + k) * h * m0
    + (-2 * k3 + 3 * k2) * b.v[axis] + (k3 - k2) * h * m1;
  return Math.max(Math.min(a.v[axis], b.v[axis]), Math.min(Math.max(a.v[axis], b.v[axis]), v));
}

/** Entity interpolation: remote entities are drawn slightly in the past, blended between server snapshots. */
export class Interpolator<T extends Pose> {
  private buf = new Map<string, Sample<T>[]>();

  push(id: string, t: number, v: T): void {
    let b = this.buf.get(id);
    if (!b) { b = []; this.buf.set(id, b); }
    if (b.length && t <= b[b.length - 1]!.t) return;
    b.push({ t, v });
    if (b.length > 24) b.shift();
  }

  remove(id: string): void { this.buf.delete(id); }
  has(id: string): boolean { return this.buf.has(id); }
  ids(): IterableIterator<string> { return this.buf.keys(); }

  /** Pose at server time `t`. Eases between snapshots; predicts at most one step/100 ms, then holds that endpoint. */
  sample(id: string, t: number): { pose: T; x: number; y: number } | null {
    const b = this.buf.get(id);
    if (!b || !b.length) return null;
    const last = b[b.length - 1]!;
    if (t >= last.t) {
      const prev = b[b.length - 2];
      if (prev && last.t - prev.t <= 250 && Math.hypot(last.v.x - prev.v.x, last.v.y - prev.v.y) <= 6) {
        const age = Math.min(100, t - last.t);
        // Ease velocity to zero during a late packet. Holding this endpoint
        // avoids the old backward jump when extrapolation expired at 100 ms.
        const k = Math.min(1, age * (1 - age / 200) / Math.max(1, last.t - prev.t));
        return { pose: last.v, x: last.v.x + (last.v.x - prev.v.x) * k, y: last.v.y + (last.v.y - prev.v.y) * k };
      }
      return { pose: last.v, x: last.v.x, y: last.v.y };
    }
    if (t <= b[0]!.t) return { pose: b[0]!.v, x: b[0]!.v.x, y: b[0]!.v.y };
    for (let i = b.length - 1; i > 0; i--) {
      const a = b[i - 1]!, c = b[i]!;
      if (t >= a.t) {
        const k = (t - a.t) / (c.t - a.t);
        // teleports (respawn, far corrections) must not slide across the map
        if (Math.hypot(c.v.x - a.v.x, c.v.y - a.v.y) > 6) return { pose: c.v, x: c.v.x, y: c.v.y };
        return { pose: c.v, x: smooth(b[i - 2], a, c, b[i + 1], k, 'x'), y: smooth(b[i - 2], a, c, b[i + 1], k, 'y') };
      }
    }
    return null;
  }
}

/** Estimates the server clock from snapshot timestamps and maps times to ticks. */
export class ServerClock {
  private samples: Array<{ at: number; diff: number }> = [];
  private refTick = 0;
  private refServer = 0;
  private _offset = 0;
  ready = false;
  private lastArrival = 0;
  private gapAvg = 50;
  private jitter = 0;
  /** Adaptive interpolation delay (ms): two snapshot gaps plus a jitter allowance, 80..200. */
  interpDelay = INTERP_DELAY_MS;

  observe(serverTime: number, tick: number, localNow: number): void {
    const elapsed = Math.max(0, localNow - this.lastArrival);
    if (this.lastArrival) {
      const gap = Math.min(1000, localNow - this.lastArrival);
      this.gapAvg += (gap - this.gapAvg) * 0.05;
      this.jitter += (Math.abs(gap - this.gapAvg) - this.jitter) * 0.05;
      const target = Math.min(200, Math.max(80, 2 * this.gapAvg + 2 * this.jitter));
      // move slowly so remote entities never visibly jump in time
      this.interpDelay += Math.max(-0.5, Math.min(0.5, target - this.interpDelay));
    }
    this.lastArrival = localNow;
    this.samples.push({ at: localNow, diff: serverTime - localNow });
    while (this.samples.length && localNow - this.samples[0]!.at > 4000) this.samples.shift();
    // the largest diff corresponds to the lowest-latency packet in the window
    let best = -Infinity;
    for (const s of this.samples) if (s.diff > best) best = s.diff;
    // A new lowest-latency packet must not jump every remote actor in time.
    // Initialise exactly, then slew by at most 5% of elapsed wall time.
    const limit = Math.min(50, elapsed * 0.05);
    this._offset = this.ready ? this._offset + Math.max(-limit, Math.min(limit, best - this._offset)) : best;
    this.refTick = tick;
    this.refServer = serverTime;
    this.ready = true;
  }

  get offset(): number { return this._offset; }
  serverNow(localNow: number): number { return localNow + this._offset; }
  tickAt(serverTime: number): number { return this.refTick + (serverTime - this.refServer) / TICK_MS; }
}

export const INTERP_DELAY_MS = 100;
