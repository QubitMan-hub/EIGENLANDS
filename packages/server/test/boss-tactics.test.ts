import { expect, it, vi } from 'vitest';
import { ATK, BOSSES, type BossId } from '@eigenlands/shared';
import { bossTactic } from '../src/features/bosses/tactics';
import { createEnemy, stepEnemies } from '../src/game/enemies';
it('gives all 14 bosses distinct, bounded, deterministic patterns with warnings and punish windows', () => {
  const names = new Set<string>();
  for (const id of Object.keys(BOSSES) as BossId[]) {
    for (const phase of [0, 1, 2, 3]) {
      const origin = { x: -100, y: 200 },
        target = { x: -97, y: 202 };
      const p = bossTactic(id, phase, 3, origin, target);
      expect(p).toEqual(bossTactic(id, phase, 3, origin, target));
      names.add(p.name);
      expect(p.hint.length).toBeGreaterThan(25);
      expect(p.impacts.length).toBeGreaterThan(2);
      expect(p.impacts.length).toBeLessThanOrEqual(16);
      expect(p.recovery).toBeGreaterThanOrEqual(1.3);
      for (const impact of p.impacts) {
        expect(Number.isFinite(impact.x + impact.y)).toBe(true);
        expect(Math.hypot(impact.x - origin.x, impact.y - origin.y)).toBeLessThan(18);
        expect(impact.delay).toBeGreaterThanOrEqual(1.4);
        expect(impact.radius).toBeLessThanOrEqual(3);
      }
      const saved = JSON.stringify(p);
      target.x += 100;
      expect(JSON.stringify(p)).toBe(saved);
    }
  }
  expect(names.size).toBe(14);
});
it('never produces an extra generic melee hit when a scripted windup expires', () => {
  const e = createEnemy('colossus', 0, 0, false),
    h = { strike: vi.fn(), telegraph: vi.fn(), fire: vi.fn() };
  e.mode = 'windup';
  e.t = 0.01;
  e.scriptedWindup = 1.5;
  e.atk = ATK.NONE;
  stepEnemies(
    [e],
    0.05,
    1,
    [{ id: 'p', x: 1, y: 0, alive: true }],
    () => false,
    () => 0.5,
    h,
  );
  expect(e.mode).toBe('recover');
  expect(h.strike).not.toHaveBeenCalled();
  expect(h.fire).not.toHaveBeenCalled();
  expect(e.scriptedWindup).toBeUndefined();
});
it('boss pursuit accelerates smoothly and casts stop at their actual ground contact', () => {
  for (const id of Object.keys(BOSSES) as BossId[]) {
    const e = createEnemy(id, 0, 0, false),
      h = { strike: vi.fn(), telegraph: vi.fn() };
    e.mode = 'chase';
    e.cd = 10;
    const positions = [];
    for (let i = 0; i < 8; i++) {
      const x = e.x,
        y = e.y;
      stepEnemies(
        [e],
        0.05,
        i,
        [{ id: 'p', x: 8, y: 0, alive: true }],
        () => false,
        () => 0.5,
        h,
      );
      positions.push(Math.hypot(e.x - x, e.y - y));
    }
    expect(positions[0]).toBeGreaterThan(0);
    expect(positions[0]).toBeLessThan(e.def.speed * 0.05);
    expect(positions.every((d) => d <= e.def.speed * 0.05 + 0.001)).toBe(true);
    const x = e.x,
      y = e.y;
    e.mode = 'windup';
    e.scriptedWindup = 1.5;
    e.t = 1.5;
    e.atk = ATK.NONE;
    stepEnemies(
      [e],
      0.05,
      9,
      [{ id: 'p', x: 8, y: 0, alive: true }],
      () => false,
      () => 0.5,
      h,
    );
    expect([e.x, e.y]).toEqual([x, y]);
    expect([e.steerX, e.steerY]).toEqual([0, 0]);
  }
});
