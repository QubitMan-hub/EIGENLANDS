/**
 * Optional network simulator for testing the feel of lag: `?lag=150&jitter=20&loss=0.01` delays (one way = lag/2)
 * and drops messages in both directions. Off unless the URL asks for it.
 */
export class NetSim {
  readonly lag: number;
  readonly jitter: number;
  readonly loss: number;
  constructor(q = new URLSearchParams(typeof location === 'undefined' ? '' : location.search)) {
    this.lag = Math.max(0, Math.min(2000, Number(q.get('lag') ?? 0) || 0));
    this.jitter = Math.max(0, Math.min(500, Number(q.get('jitter') ?? 0) || 0));
    this.loss = Math.max(0, Math.min(0.5, Number(q.get('loss') ?? 0) || 0));
  }
  get on(): boolean {
    return this.lag > 0 || this.jitter > 0 || this.loss > 0;
  }
  private last = 0;
  /** Run `fn` after a simulated one-way delay (order preserved, like TCP). Unreliable messages may be dropped. */
  run(fn: () => void, droppable: boolean): void {
    if (!this.on) {
      fn();
      return;
    }
    if (droppable && Math.random() < this.loss) return;
    const due = Math.max(this.last, performance.now() + this.lag / 2 + Math.random() * this.jitter);
    this.last = due;
    setTimeout(fn, due - performance.now());
  }
}
