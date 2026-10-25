import { describe, expect, it } from 'vitest';
import {
  EXHAUST_DELAY,
  SPRINT_DRAIN,
  SPRINT_MIN,
  SPRINT_MULT,
  STAMINA_MAX,
  TICK_DT,
  decodeAck,
  encodeAck,
  newPlayerSim,
  sanitizeCmd,
  stepPlayer,
  type InputCmd,
  type SolidQuery,
} from '../src';

const open: SolidQuery = () => false;
const cmd = (o: Partial<InputCmd> = {}): InputCmd => sanitizeCmd({ dx: 1, dy: 0, ...o });
const run = (p: ReturnType<typeof newPlayerSim>, n: number, o: Partial<InputCmd> = {}) => {
  for (let i = 0; i < n; i++) stepPlayer(p, cmd({ seq: i + 1, ...o }), open);
};

describe('sprint', () => {
  it('runs faster by SPRINT_MULT and spends stamina', () => {
    const walk = newPlayerSim(0, 0),
      dash = newPlayerSim(0, 0);
    run(walk, 10);
    run(dash, 10, { sprint: true });
    expect(dash.x / walk.x).toBeCloseTo(SPRINT_MULT, 3);
    expect(dash.stamina).toBeCloseTo(STAMINA_MAX - 10 * SPRINT_DRAIN * TICK_DT, 1);
    expect(dash.sprint).toBe(1);
  });

  it('does nothing while standing still, and a diagonal sprint stays normalised', () => {
    const p = newPlayerSim(0, 0);
    run(p, 20, { dx: 0, dy: 0, sprint: true });
    expect(p.stamina).toBe(STAMINA_MAX);
    expect(p.x).toBe(0);
    const d = newPlayerSim(0, 0);
    run(d, 10, { dx: 1, dy: 1, sprint: true });
    const speed = Math.hypot(d.x, d.y) / (10 * TICK_DT);
    expect(speed).toBeCloseTo(4.5 * SPRINT_MULT, 1);
  });

  it('runs dry, locks out for a beat, then refills and can start again', () => {
    const p = newPlayerSim(0, 0);
    let drySeen = false;
    for (let i = 0; i < 200 && !drySeen; i++) {
      stepPlayer(p, cmd({ seq: i, sprint: true }), open);
      drySeen = p.stamina <= 0;
    }
    expect(drySeen).toBe(true);
    expect(p.sprint).toBe(0);
    // holding sprint on empty does not move faster
    const before = p.x;
    run(p, 5, { sprint: true });
    expect((p.x - before) / (5 * TICK_DT)).toBeCloseTo(4.5, 1);
    // rest through the exhaustion delay
    run(p, Math.ceil(EXHAUST_DELAY / TICK_DT) + 1, { dx: 0, dy: 0 });
    run(p, 10, { dx: 0, dy: 0 });
    expect(p.stamina).toBeGreaterThan(SPRINT_MIN);
    const x0 = p.x;
    run(p, 4, { sprint: true });
    expect((p.x - x0) / (4 * TICK_DT)).toBeGreaterThan(4.5 * 1.3);
  });

  it('needs SPRINT_MIN stamina to start but not to continue', () => {
    const p = newPlayerSim(0, 0);
    p.stamina = SPRINT_MIN - 1;
    p.staminaT = 5; // no regen while we check
    run(p, 3, { sprint: true });
    expect(p.sprint).toBe(0);
    p.stamina = SPRINT_MIN + 2;
    p.staminaT = 0;
    run(p, 1, { sprint: true });
    expect(p.sprint).toBe(1);
    run(p, 4, { sprint: true });
    expect(p.sprint).toBe(1); // dropped below SPRINT_MIN while running, still going
  });

  it('survives the ACK round trip so client replay matches the server', () => {
    const server = newPlayerSim(0, 0);
    const client = newPlayerSim(0, 0);
    const cmds = Array.from({ length: 60 }, (_, i) => cmd({ seq: i + 1, sprint: i % 17 < 12, dx: i % 9 ? 1 : 0 }));
    cmds.forEach((c, i) => {
      stepPlayer(server, c, open);
      if (i === 29) {
        // the client rewinds to the server's float32 ack, then replays the rest
        const ack = decodeAck(encodeAck({ seq: c.seq, tick: i, sim: server }));
        Object.assign(client, ack.sim);
      } else if (i > 29) stepPlayer(client, c, open);
    });
    expect(client.stamina).toBe(server.stamina);
    expect(client.staminaT).toBe(server.staminaT);
    expect(client.x).toBeCloseTo(server.x, 4);
  });

  it('is off for sailing, and cheats cannot send non-boolean sprint', () => {
    const boat = newPlayerSim(0, 0);
    boat.boat = 1;
    stepPlayer(boat, cmd({ sprint: true }), { ...open, sea: open });
    expect(boat.sprint).toBe(0);
    expect(sanitizeCmd({ dx: 1, sprint: 'yes' as unknown as boolean }).sprint).toBe(false);
  });
});
