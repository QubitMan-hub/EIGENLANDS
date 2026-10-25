import { describe, expect, it } from 'vitest';
import { Interpolator, ServerClock } from '../src/net/interp';
import { Predictor } from '../src/net/prediction';

const pose = (x: number, y = 0) => ({ x, y, faceX: 1, faceY: 0 });
describe('continuous movement presentation', () => {
  it('preserves the drawn position at every render phase when reconciling a small correction', () => {
    for (const alpha of [0, 0.25, 0.5, 0.75, 1]) {
      const p = new Predictor(0.5, 0.5, () => false);
      const { cmd } = p.step({ dx: 1, dy: 0, dash: false, attack: false, skill: false, aimX: 1, aimY: 0 }, 0);
      const before = p.visual(alpha);
      p.reconcile({ seq: cmd.seq, tick: 1, sim: { ...p.sim, x: p.sim.x - 0.4 } });
      expect(p.visual(alpha).x).toBeCloseTo(before.x, 8);
    }
  });
  it('holds the bounded predicted endpoint without snapping backward when a packet is late', () => {
    const i = new Interpolator<ReturnType<typeof pose>>();
    i.push('mob', 1000, pose(0));
    i.push('mob', 1050, pose(1));
    const before = i.sample('mob', 1149)!.x;
    const after = i.sample('mob', 1151)!.x;
    expect(after).toBeGreaterThanOrEqual(before);
    expect(after).toBeLessThanOrEqual(2);
    expect(i.sample('mob', 5000)!.x).toBe(after);
  });
  it('never extrapolates a teleport into a second leap', () => {
    const i = new Interpolator<ReturnType<typeof pose>>();
    i.push('mob', 1000, pose(0));
    i.push('mob', 1050, pose(100));
    expect(i.sample('mob', 1075)!.x).toBe(100);
  });
  it('eases to a stop while staying inside the authoritative position interval', () => {
    const i = new Interpolator<ReturnType<typeof pose>>();
    i.push('mob', 1000, pose(0));
    i.push('mob', 1050, pose(1));
    i.push('mob', 1100, pose(1));
    expect(1 - i.sample('mob', 1049)!.x).toBeLessThan(0.002);
    for (let t = 1000; t <= 1200; t++) expect(i.sample('mob', t)!.x).toBeGreaterThanOrEqual(0);
    for (let t = 1000; t <= 1200; t++) expect(i.sample('mob', t)!.x).toBeLessThanOrEqual(1);
  });
  it('slews clock corrections rather than jumping when a faster packet arrives', () => {
    const c = new ServerClock();
    c.observe(10000, 0, 1000);
    const before = c.offset;
    c.observe(10100, 2, 1050);
    expect(c.offset - before).toBeLessThanOrEqual(2.5);
    expect(c.offset).toBeGreaterThan(before);
  });
});
