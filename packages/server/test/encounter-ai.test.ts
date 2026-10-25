import { expect, it, vi } from 'vitest';
import { createEnemy, stepEnemies } from '../src/game/enemies';
import { ATK, spawnTable } from '@eigenlands/shared';
const target = (x: number) => [{ id: 'p', x, y: 0, alive: true }],
  hooks = () => ({ strike: vi.fn(), telegraph: vi.fn(), fire: vi.fn() });
it('stalkers wait at distance, telegraph a close leap, and disengage while recovering', () => {
  const e = createEnemy('reed_stalker', 0, 0, false),
    h = hooks();
  e.mode = 'chase';
  stepEnemies(
    [e],
    0.05,
    1,
    target(6),
    () => false,
    () => 0.5,
    h,
  );
  expect(e.x).toBe(0);
  expect(e.state.st).toBe(0);
  stepEnemies(
    [e],
    0.05,
    2,
    target(2),
    () => false,
    () => 0.5,
    h,
  );
  expect(e.atk).toBe(ATK.LEAP);
  expect(h.telegraph).toHaveBeenCalledTimes(1);
  e.mode = 'chase';
  e.cd = 1;
  stepEnemies(
    [e],
    0.05,
    3,
    target(2),
    () => false,
    () => 0.5,
    h,
  );
  expect(e.x).toBeLessThan(0);
});
it('moths back away at close range and share the ranged windup budget instead of swarming casts', () => {
  const h = hooks(),
    e = createEnemy('cinder_moth', 0, 0, false);
  e.mode = 'chase';
  stepEnemies(
    [e],
    0.05,
    1,
    target(1),
    () => false,
    () => 0.5,
    h,
  );
  expect(e.x).toBeLessThan(0);
  expect(h.telegraph).not.toHaveBeenCalled();
  const list = [0, 1, 2].map((y) => {
    const a = createEnemy('cinder_moth', 0, y * 0.1, false);
    a.mode = 'chase';
    return a;
  });
  stepEnemies(
    list,
    0.05,
    2,
    target(5),
    () => false,
    () => 0.5,
    h,
  );
  expect(list.filter((a) => a.mode === 'windup')).toHaveLength(2);
  for (let i = 0; i < 30; i++)
    stepEnemies(
      list,
      0.05,
      3 + i,
      target(5),
      () => false,
      () => 0.5,
      h,
    );
  expect(h.fire).toHaveBeenCalled();
});
it('new encounters belong to their habitats and respect beginner spawn safety', () => {
  expect(spawnTable(6, false, 'swamp').some((e) => e.kind === 'reed_stalker')).toBe(true);
  expect(spawnTable(6, false, 'desert').some((e) => e.kind === 'cinder_moth')).toBe(true);
  expect(spawnTable(1, true, 'swamp').some((e) => ['reed_stalker', 'cinder_moth'].includes(e.kind))).toBe(false);
});
