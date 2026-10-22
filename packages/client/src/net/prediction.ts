import {
  clonePlayerSim, newPlayerSim, sanitizeCmd, stepPlayer,
  type Ack, type InputCmd, type PlayerSim, type SolidQuery, type StepEvents,
} from '@eigenlands/shared';

export interface LocalInput {
  dx: number; dy: number; dash: boolean; attack: boolean; skill: boolean; aimX: number; aimY: number;
  /** attack button held (charge); older callers may omit it */
  hold?: boolean;
}

/**
 * Client-side prediction with server reconciliation.
 * Inputs are applied immediately with the same shared sim the server runs; when an ack arrives we
 * rewind to the authoritative state and replay every input the server has not yet processed.
 */
export class Predictor {
  sim: PlayerSim;
  private prev: { x: number; y: number };
  pending: InputCmd[] = [];
  private seq = 0;
  /** visual smoothing offset that decays after a correction */
  private err = { x: 0, y: 0 };
  lastCorrection = 0;

  constructor(x: number, y: number, private solid: SolidQuery) {
    this.sim = newPlayerSim(x, y);
    this.prev = { x, y };
  }

  step(input: LocalInput, viewTick: number): { cmd: InputCmd; ev: StepEvents } {
    this.prev = { x: this.sim.x, y: this.sim.y };
    const cmd = sanitizeCmd({ ...input, seq: ++this.seq, viewTick });
    const ev = stepPlayer(this.sim, cmd, this.solid);
    this.pending.push(cmd);
    if (this.pending.length > 120) this.pending.shift(); // ~6 s without an ack: stop growing
    return { cmd, ev };
  }

  reconcile(ack: Ack): number {
    const bx = this.sim.x, by = this.sim.y;
    this.sim = clonePlayerSim(ack.sim);
    this.pending = this.pending.filter((c) => c.seq > ack.seq);
    for (const c of this.pending) stepPlayer(this.sim, c, this.solid);
    const ex = bx - this.sim.x, ey = by - this.sim.y;
    const dist = Math.hypot(ex, ey);
    this.lastCorrection = dist;
    if (dist > 3) { this.err.x = 0; this.err.y = 0; this.prev = { x: this.sim.x, y: this.sim.y }; }
    else if (dist > 0.002) { this.err.x += ex; this.err.y += ey; }
    return dist;
  }

  /** Teleport (respawn) without smoothing. */
  snap(x: number, y: number): void {
    this.sim = newPlayerSim(x, y);
    this.prev = { x, y };
    this.err = { x: 0, y: 0 };
    this.pending = [];
  }

  update(dt: number): void {
    const k = Math.exp(-dt * 12);
    this.err.x *= k; this.err.y *= k;
  }

  /** Position to draw: interpolate between the last two fixed steps, plus the decaying correction. */
  visual(alpha: number): { x: number; y: number } {
    return {
      x: this.prev.x + (this.sim.x - this.prev.x) * alpha + this.err.x,
      y: this.prev.y + (this.sim.y - this.prev.y) * alpha + this.err.y,
    };
  }
}
