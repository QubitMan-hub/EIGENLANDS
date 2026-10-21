import { describe, expect, it } from 'vitest';
import { ChunkStore, TICK_MS, sanitizeCmd, stepPlayer, newPlayerSim, type InputCmd, type PlayerSim } from '@eigenlands/shared';
import { Predictor } from '../src/net/prediction';
import { ServerClock } from '../src/net/interp';
import { NetSim } from '../src/net/netsim';

const inp = (o = {}) => ({ dx: 0, dy: 0, dash: false, attack: false, skill: false, aimX: 0, aimY: 0, ...o });

/** Deterministic PRNG for jitter. */
function rng(seed: number): () => number { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

/**
 * A discrete-event model of client ⇄ server at 150 ms round trip (75 ms each way) with ±20 ms jitter (order preserved,
 * like TCP): the client predicts every 50 ms step, the server applies one input per tick, acks come back late.
 */
function simulate(oneWay: number, jitter: number, steps: number, plan: (i: number) => Partial<InputCmd>, solid = (_x: number, _y: number) => false) {
  const r = rng(42);
  const client = new Predictor(0.5, 0.5, solid);
  const server: { sim: PlayerSim; queue: InputCmd[]; last: number } = { sim: newPlayerSim(0.5, 0.5), queue: [], last: 0 };
  const events: Array<{ t: number; fn: () => void }> = [];
  let lastUp = 0, lastDown = 0, maxCorr = 0;
  const at = (t: number, fn: () => void) => { events.push({ t, fn }); };
  for (let i = 0; i < steps + 10; i++) {
    const t = i * TICK_MS;
    if (i < steps) at(t, () => {
      const { cmd } = client.step(inp(plan(i)), 0);
      const arrive = Math.max(lastUp, t + oneWay + r() * jitter); lastUp = arrive;
      at(arrive, () => server.queue.push(cmd));
    });
    // server tick, slightly offset from the client's steps
    at(t + 25, () => {
      const cmd = server.queue.shift();
      if (!cmd) return;
      server.last = cmd.seq;
      stepPlayer(server.sim, sanitizeCmd(cmd), solid);
      const ack = { seq: server.last, tick: i, sim: { ...server.sim } };
      const back = Math.max(lastDown, t + 25 + oneWay + r() * jitter); lastDown = back;
      at(back, () => { maxCorr = Math.max(maxCorr, client.reconcile(ack)); });
    });
  }
  for (let k = 0; k < events.length; k++) {
    events.sort((a, b) => a.t - b.t);
    const e = events.shift()!; k = -1;
    e.fn();
  }
  return { client, server, maxCorr };
}

describe('feel at 150 ms ping', () => {
  it('walking, turning and dashing never needs a visible correction', () => {
    const plan = (i: number) => ({ dx: i < 40 ? 1 : i < 80 ? 0 : -0.7, dy: i < 40 ? 0.2 : i < 80 ? 1 : -0.7, dash: i === 50 || i === 90 });
    const { client, server, maxCorr } = simulate(75, 20, 120, plan);
    expect(maxCorr).toBeLessThan(0.05);
    expect(client.sim.x).toBeCloseTo(server.sim.x, 3);
    expect(client.sim.y).toBeCloseTo(server.sim.y, 3);
  });

  it('walls are predicted identically too', () => {
    const store = new ChunkStore(20260101);
    const { maxCorr } = simulate(75, 20, 160, (i) => ({ dx: Math.cos(i / 9), dy: Math.sin(i / 13), dash: i % 37 === 0 }), store.solidAt);
    expect(maxCorr).toBeLessThan(0.05);
  });
});

describe('adaptive interpolation delay', () => {
  it('settles near two snapshot gaps with steady snapshots and grows with jitter, within 80..200 ms', () => {
    const c = new ServerClock();
    let now = 0;
    for (let i = 0; i < 2000; i++) { now += 50; c.observe(i * 50, i, now); }
    expect(c.interpDelay).toBeGreaterThan(95);
    expect(c.interpDelay).toBeLessThan(110);
    const r = rng(1);
    const j = new ServerClock();
    now = 0;
    for (let i = 0; i < 4000; i++) { now += 50 + (r() - 0.5) * 80; j.observe(i * 50, i, now); }
    expect(j.interpDelay).toBeGreaterThan(c.interpDelay + 10);
    expect(j.interpDelay).toBeLessThanOrEqual(200);
  });
});

describe('network simulator', () => {
  it('is off by default and parses url parameters within bounds', () => {
    expect(new NetSim(new URLSearchParams('')).on).toBe(false);
    const s = new NetSim(new URLSearchParams('lag=150&jitter=9999&loss=0.9'));
    expect(s.on).toBe(true);
    expect(s.lag).toBe(150); expect(s.jitter).toBe(500); expect(s.loss).toBe(0.5);
    let ran = 0;
    new NetSim(new URLSearchParams('')).run(() => ran++, true);
    expect(ran).toBe(1);
  });
});
