/** Completed frames in the trailing second, using wall time rather than capped ticker deltas. */
export class FrameRateWindow {
  private times: number[] = [];
  private head = 0;
  private started = -1;
  private previous = -1;

  sample(now: number): number {
    if (this.started < 0 || now < this.previous) {
      this.times = [];
      this.head = 0;
      this.started = now;
      this.previous = now;
      return 0;
    }
    if (now === this.previous) return this.rate(now);
    this.previous = now;
    this.times.push(now);
    while (this.head < this.times.length && this.times[this.head]! <= now - 1000) this.head++;
    if (this.head > 128) {
      this.times = this.times.slice(this.head);
      this.head = 0;
    }
    return this.rate(now);
  }

  private rate(now: number): number {
    const elapsed = Math.min(1000, now - this.started);
    return elapsed > 0 ? ((this.times.length - this.head) * 1000) / elapsed : 0;
  }
}
