import { describe, expect, it } from 'vitest';
import { CAVE_OY, dangerAt, dangerPressure } from '../src';

describe('danger by place', () => {
  it('rises outward from the crossroads through five regions, capped at level 15', () => {
    const at = (d: number) => dangerAt(d, 0);
    expect(at(0)).toMatchObject({ tier: 1, level: 1 });
    expect(at(200).tier).toBe(1);
    expect(at(500).tier).toBe(2);
    expect(at(1500).tier).toBe(3);
    expect(at(3000).tier).toBe(4);
    expect(at(7000).tier).toBe(5);
    expect(at(50000).level).toBe(15);
    let last = 0;
    for (let d = 0; d < 9000; d += 100) {
      const l = at(d).level;
      expect(l).toBeGreaterThanOrEqual(last);
      last = l;
    }
  });
  it('is a step harder underground and at night or on corrupted land', () => {
    const top = dangerAt(500, 0),
      deep = dangerAt(500, CAVE_OY);
    expect(deep.tier).toBe(top.tier + 1);
    expect(deep.level).toBe(top.level + 2);
    expect(dangerAt(500, 0, { night: true, corrupt: true }).level).toBe(top.level + 2);
  });
  it('presses harder further out', () => {
    expect(dangerPressure(1).pace).toBeLessThan(dangerPressure(5).pace);
    expect(dangerPressure(5).budget).toBeGreaterThan(dangerPressure(1).budget);
  });
});
